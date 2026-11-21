const prisma = require("../config/prisma");
const { getTeacherIdForUser, getAssignedCourseIds } = require("../services/academicAccess");

const ALLOWED_FIELDS = new Set(["name", "code", "description", "academicYear"]);

const validateCourse = (body, { partial = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const unknown = Object.keys(body).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  if (partial) {
    if (Object.keys(body).length === 0) return { error: "At least one course field is required" };
  } else {
    for (const field of ["name", "code", "academicYear"]) {
      if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
    }
  }

  const data = {};
  for (const [field, max] of [["name", 120], ["code", 32], ["academicYear", 20]]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== "string" || !body[field].trim()) return { error: `${field} must be a non-empty string` };
    const value = body[field].trim();
    if (value.length > max) return { error: `${field} must be at most ${max} characters` };
    data[field] = field === "code" ? value.toUpperCase() : value;
  }
  if (Object.hasOwn(body, "description")) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 2000)) {
      return { error: "description must be a string of at most 2000 characters or null" };
    }
    data.description = body.description;
  }
  return { data };
};

const handleError = (res, error) => {
  if (error && error.code === "P2002") {
    return res.status(409).json({ success: false, message: "Course code already exists in this school" });
  }
  if (error && error.code === "P2003") {
    return res.status(409).json({ success: false, message: "Course still has subject assignments" });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const visibleCoursesForTeacher = async (req) => {
  const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
  if (!teacherId) return null;
  return getAssignedCourseIds(req.user.tenantId, teacherId);
};

const listCourses = async (req, res) => {
  try {
    let where = { tenantId: req.user.tenantId };
    if (req.user.role === "TEACHER") {
      const ids = await visibleCoursesForTeacher(req);
      if (ids === null) return res.status(404).json({ success: false, message: "Teacher profile not found" });
      where = { tenantId: req.user.tenantId, id: { in: ids } };
    }
    const courses = await prisma.course.findMany({ where, orderBy: { name: "asc" } });
    return res.status(200).json({ success: true, courses });
  } catch (error) {
    return handleError(res, error);
  }
};

const getCourse = async (req, res) => {
  try {
    const course = await prisma.course.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    if (req.user.role === "TEACHER") {
      const ids = await visibleCoursesForTeacher(req);
      if (!ids || !ids.includes(course.id)) return res.status(404).json({ success: false, message: "Course not found" });
    }
    return res.status(200).json({ success: true, course });
  } catch (error) {
    return handleError(res, error);
  }
};

const createCourse = async (req, res) => {
  const { data, error } = validateCourse(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const course = await prisma.course.create({ data: { ...data, tenantId: req.user.tenantId } });
    return res.status(201).json({ success: true, course });
  } catch (err) {
    return handleError(res, err);
  }
};

const updateCourse = async (req, res) => {
  const { data, error } = validateCourse(req.body, { partial: true });
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const result = await prisma.course.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: { ...data, updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ success: false, message: "Course not found" });
    const course = await prisma.course.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    return res.status(200).json({ success: true, course });
  } catch (err) {
    return handleError(res, err);
  }
};

const deleteCourse = async (req, res) => {
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });
    const result = await prisma.$transaction(async (tx) => {
      const linked = await tx.courseSubject.count({ where: { tenantId: req.user.tenantId, courseId: course.id } });
      if (linked) return { linked: true };
      const deleted = await tx.course.deleteMany({ where: { id: course.id, tenantId: req.user.tenantId } });
      return { deleted: deleted.count === 1 };
    });
    if (result.linked) return res.status(409).json({ success: false, message: "Remove subject assignments before deleting this course" });
    if (!result.deleted) return res.status(404).json({ success: false, message: "Course not found" });
    return res.status(200).json({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { createCourse, listCourses, getCourse, updateCourse, deleteCourse };
