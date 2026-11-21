const prisma = require("../config/prisma");
const { getTeacherIdForUser } = require("../services/academicAccess");
const { isValidUuid } = require("../middleware/validateUuidParam");

const EXAM_TYPES = new Set(["UNIT_TEST", "MID_TERM", "FINAL_EXAM", "PRACTICAL", "ASSIGNMENT"]);
const CREATE_FIELDS = new Set([
  "name", "examType", "courseId", "subjectId", "academicYear", "examDate",
  "startTime", "endTime", "maximumMarks", "passingMarks", "description",
]);
const examInclude = {
  course: { select: { id: true, name: true, code: true, academicYear: true } },
  subject: { select: { id: true, name: true, code: true } },
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
const secondsSinceMidnight = (value) => {
  const [hours, minutes, seconds = "00"] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};
const toTime = (value) => new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}.000Z`);
const decimalValue = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || !/^\d{1,6}(\.\d{1,2})?$/.test(String(value))) return null;
  return value.toFixed(2);
};

const validateExam = (body, { partial = false } = {}) => {
  if (!isObject(body)) return { error: "Request body must be a JSON object" };
  const unsupported = Object.keys(body).find((field) => !CREATE_FIELDS.has(field));
  if (unsupported) return { error: `Unsupported field: ${unsupported}` };
  if (partial && Object.keys(body).length === 0) return { error: "At least one examination field is required" };
  const required = ["name", "examType", "courseId", "subjectId", "academicYear", "examDate", "startTime", "endTime", "maximumMarks", "passingMarks"];
  if (!partial) {
    const missing = required.find((field) => !Object.hasOwn(body, field));
    if (missing) return { error: `${missing} is required` };
  }

  const data = {};
  for (const [field, max] of [["name", 120], ["academicYear", 20]]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== "string" || !body[field].trim()) return { error: `${field} must be a non-empty string` };
    if (body[field].trim().length > max) return { error: `${field} must be at most ${max} characters` };
    data[field] = body[field].trim();
  }
  if (Object.hasOwn(body, "examType")) {
    if (!EXAM_TYPES.has(body.examType)) return { error: "examType must be UNIT_TEST, MID_TERM, FINAL_EXAM, PRACTICAL, or ASSIGNMENT" };
    data.examType = body.examType;
  }
  for (const field of ["courseId", "subjectId"]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== "string" || !isValidUuid(body[field])) return { error: `${field} must be a valid UUID` };
    data[field] = body[field];
  }
  if (Object.hasOwn(body, "examDate")) {
    if (!isValidDate(body.examDate)) return { error: "examDate must be a valid YYYY-MM-DD date" };
    data.examDate = toDate(body.examDate);
  }
  for (const field of ["startTime", "endTime"]) {
    if (!Object.hasOwn(body, field)) continue;
    if (!validTime(body[field])) return { error: `${field} must use HH:mm or HH:mm:ss 24-hour format` };
    data[field] = toTime(body[field]);
  }
  if (Object.hasOwn(body, "maximumMarks")) {
    data.maximumMarks = decimalValue(body.maximumMarks);
    if (data.maximumMarks === null || Number(body.maximumMarks) <= 0) return { error: "maximumMarks must be a positive number with at most two decimal places" };
  }
  if (Object.hasOwn(body, "passingMarks")) {
    data.passingMarks = decimalValue(body.passingMarks);
    if (data.passingMarks === null || Number(body.passingMarks) < 0) return { error: "passingMarks must be a non-negative number with at most two decimal places" };
  }
  if (Object.hasOwn(body, "description")) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 2000)) {
      return { error: "description must be a string of at most 2000 characters or null" };
    }
    data.description = body.description;
  }
  const maximum = Object.hasOwn(data, "maximumMarks") ? Number(data.maximumMarks) : body.maximumMarks;
  const passing = Object.hasOwn(data, "passingMarks") ? Number(data.passingMarks) : body.passingMarks;
  if (maximum !== undefined && passing !== undefined && passing > maximum) return { error: "passingMarks cannot exceed maximumMarks" };
  const start = Object.hasOwn(body, "startTime") ? body.startTime : null;
  const end = Object.hasOwn(body, "endTime") ? body.endTime : null;
  if (start && end && secondsSinceMidnight(start) >= secondsSinceMidnight(end)) return { error: "endTime must be after startTime" };
  return { data };
};

const serializeExam = (exam) => ({
  ...exam,
  examDate: exam.examDate.toISOString().slice(0, 10),
  startTime: exam.startTime.toISOString().slice(11, 19),
  endTime: exam.endTime.toISOString().slice(11, 19),
  maximumMarks: Number(exam.maximumMarks),
  passingMarks: Number(exam.passingMarks),
});

const isConflictError = (error) => {
  const code = error?.meta?.code || error?.meta?.database_error_code || error?.cause?.code;
  const text = [error?.message, error?.meta?.database_error, error?.meta?.message].filter(Boolean).join(" ");
  return error?.code === "P2004" || code === "23P01" || /23P01|exclusion constraint|Examination_no_(course|subject)_overlap/i.test(text);
};
const handleError = (res, error) => {
  if (isConflictError(error)) return res.status(409).json({ success: false, message: "Examination conflicts with another examination for this course or subject" });
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "Examination is still referenced by another record" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const teacherScope = async (req) => {
  if (req.user.role !== "TEACHER") return {};
  const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
  if (!teacherId) return null;
  return { subject: { teacherAssignments: { some: { tenantId: req.user.tenantId, teacherId } } } };
};

const validateCourseSubject = async (db, tenantId, courseId, subjectId, academicYear) => {
  const course = await db.course.findFirst({ where: { id: courseId, tenantId, academicYear }, select: { id: true } });
  if (!course) return "Course not found in this tenant or academic year does not match";
  const assignment = await db.courseSubject.findFirst({ where: { tenantId, courseId, subjectId }, select: { subjectId: true } });
  if (!assignment) return "Subject is not assigned to this course in this tenant";
  return null;
};

const validateTimetableSlot = async (db, tenantId, exam) => {
  const dayOfWeek = exam.examDate.getUTCDay();
  const matchingEntry = await db.timetableEntry.findFirst({
    where: {
      tenantId, courseId: exam.courseId, subjectId: exam.subjectId, academicYear: exam.academicYear, dayOfWeek,
      startTime: { lt: exam.endTime }, endTime: { gt: exam.startTime },
    }, select: { id: true },
  });
  return Boolean(matchingEntry);
};

const createExamination = async (req, res) => {
  const validated = validateExam(req.body);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  try {
    const data = validated.data;
    const assignmentError = await validateCourseSubject(prisma, req.user.tenantId, data.courseId, data.subjectId, data.academicYear);
    if (assignmentError) return res.status(400).json({ success: false, message: assignmentError });
    if (await validateTimetableSlot(prisma, req.user.tenantId, data)) {
      return res.status(409).json({ success: false, message: "Examination overlaps a scheduled timetable period for this course and subject" });
    }
    const examination = await prisma.examination.create({ data: { ...data, tenantId: req.user.tenantId }, include: examInclude });
    return res.status(201).json({ success: true, examination: serializeExam(examination) });
  } catch (error) { return handleError(res, error); }
};

const listExaminations = async (req, res) => {
  try {
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const examinations = await prisma.examination.findMany({
      where: { tenantId: req.user.tenantId, ...scope }, include: examInclude,
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
    return res.status(200).json({ success: true, examinations: examinations.map(serializeExam) });
  } catch (error) { return handleError(res, error); }
};

const getExamination = async (req, res) => {
  try {
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const examination = await prisma.examination.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, ...scope }, include: examInclude,
    });
    if (!examination) return res.status(404).json({ success: false, message: "Examination not found" });
    return res.status(200).json({ success: true, examination: serializeExam(examination) });
  } catch (error) { return handleError(res, error); }
};

const updateExamination = async (req, res) => {
  const validated = validateExam(req.body, { partial: true });
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  try {
    const existing = await prisma.examination.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!existing) return res.status(404).json({ success: false, message: "Examination not found" });
    const merged = {
      name: existing.name, examType: existing.examType, courseId: existing.courseId, subjectId: existing.subjectId,
      academicYear: existing.academicYear, examDate: existing.examDate.toISOString().slice(0, 10),
      startTime: existing.startTime.toISOString().slice(11, 19), endTime: existing.endTime.toISOString().slice(11, 19),
      maximumMarks: Number(existing.maximumMarks), passingMarks: Number(existing.passingMarks), description: existing.description,
      ...req.body,
    };
    const complete = validateExam(merged);
    if (complete.error) return res.status(400).json({ success: false, message: complete.error });
    const data = complete.data;
    const assignmentError = await validateCourseSubject(prisma, req.user.tenantId, data.courseId, data.subjectId, data.academicYear);
    if (assignmentError) return res.status(400).json({ success: false, message: assignmentError });
    if (await validateTimetableSlot(prisma, req.user.tenantId, data)) {
      return res.status(409).json({ success: false, message: "Examination overlaps a scheduled timetable period for this course and subject" });
    }
    const result = await prisma.examination.updateMany({ where: { id: existing.id, tenantId: req.user.tenantId }, data: { ...data, updatedAt: new Date() } });
    if (!result.count) return res.status(404).json({ success: false, message: "Examination not found" });
    const examination = await prisma.examination.findFirst({ where: { id: existing.id, tenantId: req.user.tenantId }, include: examInclude });
    return res.status(200).json({ success: true, examination: serializeExam(examination) });
  } catch (error) { return handleError(res, error); }
};

const deleteExamination = async (req, res) => {
  try {
    const result = await prisma.examination.deleteMany({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Examination not found" });
    return res.status(200).json({ success: true, message: "Examination deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

const listCourseExaminations = async (req, res) => {
  try {
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    const examinations = await prisma.examination.findMany({
      where: { tenantId: req.user.tenantId, courseId: course.id, ...scope }, include: examInclude,
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
    return res.status(200).json({ success: true, examinations: examinations.map(serializeExam) });
  } catch (error) { return handleError(res, error); }
};

const listStudentExaminations = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id },
      select: { courseId: true, academicYear: true },
    });
    if (enrollments.length === 0) return res.status(200).json({ success: true, examinations: [] });
    const scope = await teacherScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const examinations = await prisma.examination.findMany({
      where: {
        tenantId: req.user.tenantId,
        OR: enrollments.map(({ courseId, academicYear }) => ({ courseId, academicYear })),
        ...scope,
      },
      include: examInclude,
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
    return res.status(200).json({ success: true, examinations: examinations.map(serializeExam) });
  } catch (error) { return handleError(res, error); }
};

module.exports = {
  createExamination, listExaminations, getExamination, updateExamination, deleteExamination,
  listCourseExaminations, listStudentExaminations,
};
