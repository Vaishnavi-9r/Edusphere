const prisma = require("../config/prisma");
const { getAssignedCourseIds } = require("../services/academicAccess");
const { isValidUuid } = require("../middleware/validateUuidParam");

const STATUSES = new Set(["ACTIVE", "COMPLETED", "WITHDRAWN"]);
const enrollmentInclude = {
  student: { select: { id: true, name: true, rollNumber: true, grade: true } },
  course: { select: { id: true, name: true, code: true, academicYear: true } },
};
const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const validateEnrollment = (body, update = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const allowed = update ? new Set(["status", "enrollmentDate"]) : new Set(["studentId", "courseId", "academicYear", "enrollmentDate", "status"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  if (update && Object.keys(body).length === 0) return { error: "At least one enrollment field is required" };
  if (!update) {
    for (const key of ["studentId", "courseId", "academicYear", "enrollmentDate"]) {
      if (!Object.hasOwn(body, key)) return { error: `${key} is required` };
    }
  }
  const data = {};
  for (const key of ["studentId", "courseId"]) {
    if (!Object.hasOwn(body, key)) continue;
    if (typeof body[key] !== "string" || !isValidUuid(body[key])) return { error: `${key} must be a valid UUID` };
    data[key] = body[key];
  }
  if (Object.hasOwn(body, "academicYear")) {
    if (typeof body.academicYear !== "string" || !body.academicYear.trim() || body.academicYear.trim().length > 20) {
      return { error: "academicYear must be a non-empty string of at most 20 characters" };
    }
    data.academicYear = body.academicYear.trim();
  }
  if (Object.hasOwn(body, "enrollmentDate")) {
    if (!isValidDate(body.enrollmentDate)) return { error: "enrollmentDate must be a valid YYYY-MM-DD date" };
    data.enrollmentDate = new Date(`${body.enrollmentDate}T00:00:00.000Z`);
  }
  if (Object.hasOwn(body, "status")) {
    if (!STATUSES.has(body.status)) return { error: "status must be ACTIVE, COMPLETED, or WITHDRAWN" };
    data.status = body.status;
  }
  return { data };
};

const serializeEnrollment = (enrollment) => ({
  ...enrollment,
  enrollmentDate: enrollment.enrollmentDate.toISOString().slice(0, 10),
});
const handleError = (res, error) => {
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "Student is already enrolled in this course for the academic year" });
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "Enrollment is referenced by another record and cannot be removed or changed" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const getCourseScope = async (req) => {
  if (req.user.role !== "TEACHER") return {};
  const teacher = await prisma.teacher.findFirst({
    where: { tenantId: req.user.tenantId, userId: req.user.userId }, select: { id: true },
  });
  if (!teacher) return null;
  const ids = await getAssignedCourseIds(req.user.tenantId, teacher.id);
  return { courseId: { in: ids } };
};

const createEnrollment = async (req, res) => {
  const validated = validateEnrollment(req.body);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  const data = validated.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const [student, course] = await Promise.all([
        tx.student.findFirst({ where: { id: data.studentId, tenantId: req.user.tenantId }, select: { id: true } }),
        tx.course.findFirst({ where: { id: data.courseId, tenantId: req.user.tenantId, academicYear: data.academicYear }, select: { id: true } }),
      ]);
      if (!student || !course) return { missing: true };
      const enrollment = await tx.studentEnrollment.create({
        data: { ...data, tenantId: req.user.tenantId, status: data.status || "ACTIVE" }, include: enrollmentInclude,
      });
      return { enrollment };
    });
    if (result.missing) return res.status(404).json({ success: false, message: "Student or course not found in this tenant and academic year" });
    return res.status(201).json({ success: true, enrollment: serializeEnrollment(result.enrollment) });
  } catch (error) { return handleError(res, error); }
};

const listEnrollments = async (req, res) => {
  try {
    const scope = await getCourseScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { tenantId: req.user.tenantId, ...scope }, include: enrollmentInclude,
      orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
    });
    return res.status(200).json({ success: true, enrollments: enrollments.map(serializeEnrollment) });
  } catch (error) { return handleError(res, error); }
};

const getEnrollment = async (req, res) => {
  try {
    const scope = await getCourseScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, ...scope }, include: enrollmentInclude,
    });
    if (!enrollment) return res.status(404).json({ success: false, message: "Enrollment not found" });
    return res.status(200).json({ success: true, enrollment: serializeEnrollment(enrollment) });
  } catch (error) { return handleError(res, error); }
};

const updateEnrollment = async (req, res) => {
  const validated = validateEnrollment(req.body, true);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  try {
    const result = await prisma.studentEnrollment.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: { ...validated.data, updatedAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ success: false, message: "Enrollment not found" });
    const enrollment = await prisma.studentEnrollment.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: enrollmentInclude });
    return res.status(200).json({ success: true, enrollment: serializeEnrollment(enrollment) });
  } catch (error) { return handleError(res, error); }
};

const deleteEnrollment = async (req, res) => {
  try {
    const result = await prisma.studentEnrollment.deleteMany({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Enrollment not found" });
    return res.status(200).json({ success: true, message: "Enrollment deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

const listStudentEnrollments = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const scope = await getCourseScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id, ...scope }, include: enrollmentInclude,
      orderBy: { academicYear: "desc" },
    });
    return res.status(200).json({ success: true, enrollments: enrollments.map(serializeEnrollment) });
  } catch (error) { return handleError(res, error); }
};

const listCourseEnrollments = async (req, res) => {
  try {
    const scope = await getCourseScope(req);
    if (!scope) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    if (scope.courseId && !scope.courseId.in.includes(req.params.courseId)) return res.status(404).json({ success: false, message: "Course not found" });
    const course = await prisma.course.findFirst({ where: { id: req.params.courseId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { tenantId: req.user.tenantId, courseId: course.id }, include: enrollmentInclude,
      orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
    });
    return res.status(200).json({ success: true, enrollments: enrollments.map(serializeEnrollment) });
  } catch (error) { return handleError(res, error); }
};

module.exports = { createEnrollment, listEnrollments, getEnrollment, updateEnrollment, deleteEnrollment, listStudentEnrollments, listCourseEnrollments };
