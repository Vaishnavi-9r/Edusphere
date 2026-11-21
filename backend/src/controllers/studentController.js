const prisma = require("../config/prisma");

const ALLOWED_FIELDS = new Set(["name", "rollNumber", "grade"]);
const FIELD_LIMITS = { name: 120, rollNumber: 50, grade: 50 };

const validateStudentInput = (body, { partial = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const fields = Object.keys(body);
  const unknownFields = fields.filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length > 0) {
    return { error: `Unsupported field: ${unknownFields[0]}` };
  }

  if (fields.length === 0 || (!partial && fields.length !== ALLOWED_FIELDS.size)) {
    return {
      error: partial
        ? "At least one of name, rollNumber, or grade is required"
        : "name, rollNumber, and grade are required",
    };
  }

  const data = {};
  for (const field of fields) {
    if (typeof body[field] !== "string") {
      return { error: `${field} must be a string` };
    }

    const value = body[field].trim();
    if (!value) {
      return { error: `${field} must not be empty` };
    }
    if (value.length > FIELD_LIMITS[field]) {
      return { error: `${field} must be at most ${FIELD_LIMITS[field]} characters` };
    }
    data[field] = value;
  }

  return { data };
};

const isDuplicateRollNumber = (error) => error && error.code === "P2002";

const handleStudentError = (res, error) => {
  if (isDuplicateRollNumber(error)) {
    return res.status(409).json({
      success: false,
      message: "A student with this roll number already exists in this school",
    });
  }

  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const createStudent = async (req, res) => {
  const { data, error } = validateStudentInput(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  try {
    const student = await prisma.student.create({
      data: { ...data, tenantId: req.user.tenantId },
    });
    return res.status(201).json({ success: true, student });
  } catch (err) {
    return handleStudentError(res, err);
  }
};

const listStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, students });
  } catch (error) {
    return handleStudentError(res, error);
  }
};

const getStudent = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    return res.status(200).json({ success: true, student });
  } catch (error) {
    return handleStudentError(res, error);
  }
};

const updateStudent = async (req, res) => {
  const { data, error } = validateStudentInput(req.body, { partial: true });
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  try {
    const result = await prisma.student.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data,
    });
    if (result.count === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const student = await prisma.student.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    return res.status(200).json({ success: true, student });
  } catch (error) {
    return handleStudentError(res, error);
  }
};

const deleteStudent = async (req, res) => {
  try {
    const deleted = await prisma.$transaction(async tx => {
      const student = await tx.student.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        select: { id: true, userId: true },
      });
      if (!student) return false;
      if (student.userId) {
        await tx.user.updateMany({
          where: { id: student.userId, tenantId: req.user.tenantId, role: "STUDENT" },
          data: { isActive: false },
        });
      }
      const result = await tx.student.deleteMany({ where: { id: student.id, tenantId: req.user.tenantId } });
      return result.count > 0;
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    return res.status(200).json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    return handleStudentError(res, error);
  }
};

module.exports = {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
};
