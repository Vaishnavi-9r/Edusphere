const prisma = require("../config/prisma");
const { getTeacherIdForUser } = require("../services/academicAccess");
const { isValidUuid } = require("../middleware/validateUuidParam");
const { getGradeLabel } = require("../config/gradingScale");

const gradeInclude = {
  student: { select: { id: true, name: true, rollNumber: true, grade: true } },
  examination: {
    select: {
      id: true, name: true, examType: true, examDate: true, courseId: true, subjectId: true, academicYear: true,
      course: { select: { id: true, name: true, code: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
  },
  enrollment: { select: { id: true, status: true, academicYear: true } },
  enteredBy: { select: { id: true, fullName: true, role: true } },
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const decimalInput = (value) => typeof value === "number" && Number.isFinite(value) && /^\d{1,6}(\.\d{1,2})?$/.test(String(value));
const validateGradeInput = (body, update = false) => {
  if (!isObject(body)) return { error: "Request body must be a JSON object" };
  const allowed = update ? new Set(["marksObtained", "remarks"]) : new Set(["studentId", "examinationId", "enrollmentId", "marksObtained", "remarks"]);
  const unsupported = Object.keys(body).find((field) => !allowed.has(field));
  if (unsupported) return { error: `Unsupported field: ${unsupported}` };
  if (update && Object.keys(body).length === 0) return { error: "At least one grade field is required" };
  if (!update) {
    for (const field of ["studentId", "examinationId", "enrollmentId", "marksObtained"]) {
      if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
    }
    for (const field of ["studentId", "examinationId", "enrollmentId"]) {
      if (typeof body[field] !== "string" || !isValidUuid(body[field])) return { error: `${field} must be a valid UUID` };
    }
  }
  if (Object.hasOwn(body, "marksObtained") && (!decimalInput(body.marksObtained) || body.marksObtained < 0)) {
    return { error: "marksObtained must be a non-negative number with at most two decimal places" };
  }
  if (Object.hasOwn(body, "remarks") && body.remarks !== null && (typeof body.remarks !== "string" || body.remarks.length > 2000)) {
    return { error: "remarks must be a string of at most 2000 characters or null" };
  }
  return { data: { ...body } };
};

const percentageFor = (marks, maximum) => Math.round((marks / maximum) * 10000) / 100;
const serializeGrade = (grade) => ({
  ...grade,
  marksObtained: Number(grade.marksObtained),
  maximumMarks: Number(grade.maximumMarks),
  percentage: Number(grade.percentage),
});
const handleError = (res, error) => {
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "A grade already exists for this student and examination" });
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "Grade references an enrollment, examination, student, or user that cannot be changed" });
  if (error?.code === "P2004") return res.status(400).json({ success: false, message: "Grade values violate database validation rules" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const teacherIdForRequest = async (db, req) => {
  const teacher = await db.teacher.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.userId }, select: { id: true } });
  return teacher?.id || null;
};
const teacherMayGrade = async (db, req, subjectId) => {
  if (req.user.role !== "TEACHER") return true;
  const teacherId = await teacherIdForRequest(db, req);
  if (!teacherId) return false;
  return Boolean(await db.teacherSubject.findFirst({
    where: { tenantId: req.user.tenantId, teacherId, subjectId }, select: { teacherId: true },
  }));
};
const teacherScope = async (req) => {
  if (req.user.role !== "TEACHER") return {};
  const teacherId = await teacherIdForRequest(prisma, req);
  if (!teacherId) return null;
  return { examination: { subject: { teacherAssignments: { some: { tenantId: req.user.tenantId, teacherId } } } } };
};

const createGrade = async (req, res) => {
  const validated = validateGradeInput(req.body);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const { studentId, examinationId, enrollmentId, marksObtained, remarks } = validated.data;
      const examination = await tx.examination.findFirst({
        where: { id: examinationId, tenantId: req.user.tenantId },
        select: { id: true, courseId: true, subjectId: true, academicYear: true, maximumMarks: true },
      });
      if (!examination) return { status: 404, message: "Examination not found" };
      const enrollment = await tx.studentEnrollment.findFirst({
        where: {
          id: enrollmentId, tenantId: req.user.tenantId, studentId,
          courseId: examination.courseId, academicYear: examination.academicYear,
        },
        select: { id: true },
      });
      if (!enrollment) return { status: 400, message: "Student enrollment must match the examination course and academic year" };
      if (!await teacherMayGrade(tx, req, examination.subjectId)) return { status: 403, message: "Teacher is not assigned to this examination subject" };
      const maximumMarks = Number(examination.maximumMarks);
      if (marksObtained > maximumMarks) return { status: 400, message: "marksObtained cannot exceed the examination maximum marks" };
      const percentage = percentageFor(marksObtained, maximumMarks);
      const grade = await tx.grade.create({
        data: {
          tenantId: req.user.tenantId, studentId, examinationId, enrollmentId,
          courseId: examination.courseId, academicYear: examination.academicYear,
          marksObtained: marksObtained.toFixed(2), maximumMarks: examination.maximumMarks,
          percentage: percentage.toFixed(2), grade: getGradeLabel(percentage),
          ...(Object.hasOwn(validated.data, "remarks") ? { remarks } : {}),
          enteredById: req.user.userId,
        }, include: gradeInclude,
      });
      return { grade };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(201).json({ success: true, grade: serializeGrade(result.grade) });
  } catch (error) { return handleError(res, error); }
};

const listGrades = async (req, res) => {
  try {
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const grades = await prisma.grade.findMany({ where: { tenantId: req.user.tenantId, ...scope }, include: gradeInclude, orderBy: [{ createdAt: "desc" }] });
    return res.status(200).json({ success: true, grades: grades.map(serializeGrade) });
  } catch (error) { return handleError(res, error); }
};

const getGrade = async (req, res) => {
  try {
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const grade = await prisma.grade.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId, ...scope }, include: gradeInclude });
    if (!grade) return res.status(404).json({ success: false, message: "Grade not found" });
    return res.status(200).json({ success: true, grade: serializeGrade(grade) });
  } catch (error) { return handleError(res, error); }
};

const updateGrade = async (req, res) => {
  const validated = validateGradeInput(req.body, true);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: { examination: { select: { subjectId: true } } } });
      if (!existing) return { status: 404, message: "Grade not found" };
      if (!await teacherMayGrade(tx, req, existing.examination.subjectId)) return { status: 403, message: "Teacher is not assigned to this examination subject" };
      const marksObtained = Object.hasOwn(validated.data, "marksObtained") ? validated.data.marksObtained : Number(existing.marksObtained);
      const maximumMarks = Number(existing.maximumMarks);
      if (marksObtained > maximumMarks) return { status: 400, message: "marksObtained cannot exceed the examination maximum marks" };
      const percentage = percentageFor(marksObtained, maximumMarks);
      await tx.grade.updateMany({
        where: { id: existing.id, tenantId: req.user.tenantId },
        data: {
          ...(Object.hasOwn(validated.data, "marksObtained") ? { marksObtained: marksObtained.toFixed(2) } : {}),
          ...(Object.hasOwn(validated.data, "remarks") ? { remarks: validated.data.remarks } : {}),
          percentage: percentage.toFixed(2), grade: getGradeLabel(percentage), updatedAt: new Date(),
        },
      });
      const grade = await tx.grade.findFirst({ where: { id: existing.id, tenantId: req.user.tenantId }, include: gradeInclude });
      return { grade };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(200).json({ success: true, grade: serializeGrade(result.grade) });
  } catch (error) { return handleError(res, error); }
};

const deleteGrade = async (req, res) => {
  try {
    const result = await prisma.grade.deleteMany({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Grade not found" });
    return res.status(200).json({ success: true, message: "Grade deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

const listStudentGrades = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const grades = await prisma.grade.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id, ...scope }, include: gradeInclude,
      orderBy: [{ examination: { examDate: "desc" } }],
    });
    return res.status(200).json({ success: true, studentId: student.id, grades: grades.map(serializeGrade) });
  } catch (error) { return handleError(res, error); }
};

const listExaminationGrades = async (req, res) => {
  try {
    const examination = await prisma.examination.findFirst({ where: { id: req.params.examinationId, tenantId: req.user.tenantId }, select: { id: true, subjectId: true } });
    if (!examination) return res.status(404).json({ success: false, message: "Examination not found" });
    if (!await teacherMayGrade(prisma, req, examination.subjectId)) return res.status(404).json({ success: false, message: "Examination not found" });
    const grades = await prisma.grade.findMany({ where: { tenantId: req.user.tenantId, examinationId: examination.id }, include: gradeInclude, orderBy: { student: { name: "asc" } } });
    return res.status(200).json({ success: true, examinationId: examination.id, grades: grades.map(serializeGrade) });
  } catch (error) { return handleError(res, error); }
};

const getStudentReportCard = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.studentId, tenantId: req.user.tenantId },
      select: { id: true, name: true, rollNumber: true, grade: true },
    });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id },
      include: {
        course: { select: { id: true, name: true, code: true } },
        grades: { where: { tenantId: req.user.tenantId, ...scope }, include: { examination: { include: { subject: { select: { id: true, name: true, code: true } } } } }, orderBy: { examination: { examDate: "asc" } } },
      },
      orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
    });
    const report = enrollments.map((enrollment) => {
      const grades = enrollment.grades.map((item) => serializeGrade({ ...item, student, enrollment: { id: enrollment.id, status: enrollment.status, academicYear: enrollment.academicYear }, enteredBy: undefined }));
      const marksObtained = grades.reduce((sum, item) => sum + item.marksObtained, 0);
      const maximumMarks = grades.reduce((sum, item) => sum + item.maximumMarks, 0);
      const percentage = maximumMarks === 0 ? 0 : percentageFor(marksObtained, maximumMarks);
      return {
        enrollmentId: enrollment.id, course: enrollment.course, academicYear: enrollment.academicYear,
        enrollmentStatus: enrollment.status, grades, totalMarksObtained: marksObtained,
        totalMaximumMarks: maximumMarks, percentage, overallGrade: maximumMarks ? getGradeLabel(percentage) : null,
      };
    });
    return res.status(200).json({
      success: true, student, gradingScaleRule: "Configured by EDUSPHERE_GRADING_SCALE; default: A >= 90, B >= 80, C >= 70, D >= 60, F >= 0",
      reportCards: report,
      calculationRule: "Enrollment percentage is total marks obtained divided by total examination maximum marks, multiplied by 100 and rounded to two decimal places.",
    });
  } catch (error) { return handleError(res, error); }
};

module.exports = { createGrade, listGrades, getGrade, updateGrade, deleteGrade, listStudentGrades, listExaminationGrades, getStudentReportCard };
