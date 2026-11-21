const prisma = require("../config/prisma");
const { getTeacherIdForUser, getAssignedSubjectIds } = require("../services/academicAccess");

const ALLOWED_FIELDS = new Set(["name", "code", "description"]);

const validateSubject = (body, { partial = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const unknown = Object.keys(body).find((field) => !ALLOWED_FIELDS.has(field));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  if (partial) {
    if (Object.keys(body).length === 0) return { error: "At least one subject field is required" };
  } else {
    for (const field of ["name", "code"]) {
      if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
    }
  }

  const data = {};
  for (const [field, max] of [["name", 120], ["code", 32]]) {
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
    return res.status(409).json({ success: false, message: "Subject code already exists in this school" });
  }
  if (error && error.code === "P2003") {
    return res.status(409).json({ success: false, message: "Subject is still linked to teachers or courses" });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const listSubjects = async (req, res) => {
  try {
    let where = { tenantId: req.user.tenantId };
    if (req.user.role === "TEACHER") {
      const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
      if (!teacherId) return res.status(404).json({ success: false, message: "Teacher profile not found" });
      const ids = await getAssignedSubjectIds(req.user.tenantId, teacherId);
      where = { tenantId: req.user.tenantId, id: { in: ids } };
    }
    const subjects = await prisma.subject.findMany({ where, orderBy: { name: "asc" } });
    return res.status(200).json({ success: true, subjects });
  } catch (error) {
    return handleError(res, error);
  }
};

const getSubject = async (req, res) => {
  try {
    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });

    if (req.user.role === "TEACHER") {
      const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
      const assignment = teacherId && await prisma.teacherSubject.findFirst({
        where: { tenantId: req.user.tenantId, teacherId, subjectId: subject.id },
        select: { subjectId: true },
      });
      if (!assignment) return res.status(404).json({ success: false, message: "Subject not found" });
    }
    return res.status(200).json({ success: true, subject });
  } catch (error) {
    return handleError(res, error);
  }
};

const createSubject = async (req, res) => {
  const { data, error } = validateSubject(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const subject = await prisma.subject.create({ data: { ...data, tenantId: req.user.tenantId } });
    return res.status(201).json({ success: true, subject });
  } catch (err) {
    return handleError(res, err);
  }
};

const updateSubject = async (req, res) => {
  const { data, error } = validateSubject(req.body, { partial: true });
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const result = await prisma.subject.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: { ...data, updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ success: false, message: "Subject not found" });
    const subject = await prisma.subject.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });
    return res.status(200).json({ success: true, subject });
  } catch (err) {
    return handleError(res, err);
  }
};

const deleteSubject = async (req, res) => {
  try {
    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });
    const result = await prisma.$transaction(async (tx) => {
      const [teacherLinks, courseLinks] = await Promise.all([
        tx.teacherSubject.count({ where: { tenantId: req.user.tenantId, subjectId: subject.id } }),
        tx.courseSubject.count({ where: { tenantId: req.user.tenantId, subjectId: subject.id } }),
      ]);
      if (teacherLinks || courseLinks) return { linked: true };
      const deleted = await tx.subject.deleteMany({ where: { id: subject.id, tenantId: req.user.tenantId } });
      return { deleted: deleted.count === 1 };
    });
    if (result.linked) return res.status(409).json({ success: false, message: "Remove teacher and course assignments before deleting this subject" });
    if (!result.deleted) return res.status(404).json({ success: false, message: "Subject not found" });
    return res.status(200).json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};

const listSubjectTeachers = async (req, res) => {
  try {
    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });
    const assignments = await prisma.teacherSubject.findMany({
      where: { tenantId: req.user.tenantId, subjectId: subject.id },
      include: { teacher: { include: { user: { select: { fullName: true, email: true, isActive: true } } } } },
      orderBy: { assignedAt: "asc" },
    });
    const teachers = assignments.map(({ teacher, assignedAt }) => ({
      id: teacher.id,
      employeeId: teacher.employeeId,
      fullName: teacher.user.fullName,
      email: teacher.user.email,
      employmentStatus: teacher.user.isActive ? "ACTIVE" : "INACTIVE",
      assignedAt,
    }));
    return res.status(200).json({ success: true, teachers });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { createSubject, listSubjects, getSubject, updateSubject, deleteSubject, listSubjectTeachers };
