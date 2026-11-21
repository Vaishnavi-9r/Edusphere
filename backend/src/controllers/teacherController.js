const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const PROFILE_FIELDS = new Set([
  "employeeId",
  "fullName",
  "email",
  "password",
  "phoneNumber",
  "qualification",
  "specialization",
  "joiningDate",
  "employmentStatus",
]);
const OPTIONAL_TEXT_LIMITS = { phoneNumber: 30, qualification: 120, specialization: 120 };
const EMPLOYMENT_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseDate = (value) => value === null ? null : new Date(`${value}T00:00:00.000Z`);

const normalizeEmail = (value) => value.trim().toLowerCase();
const validEmail = (value) => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validateTeacher = (body, { partial = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }
  const unknown = Object.keys(body).find((field) => !PROFILE_FIELDS.has(field));
  if (unknown) return { error: `Unsupported field: ${unknown}` };

  if (partial) {
    if (Object.keys(body).length === 0) return { error: "At least one teacher field is required" };
  } else {
    for (const field of ["employeeId", "fullName", "email", "password"]) {
      if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
    }
  }

  const data = {};
  for (const field of ["employeeId", "fullName"]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return { error: `${field} must be a non-empty string` };
    }
    const value = body[field].trim();
    const limit = field === "employeeId" ? 50 : 120;
    if (value.length > limit) return { error: `${field} must be at most ${limit} characters` };
    data[field] = value;
  }

  if (Object.hasOwn(body, "email")) {
    if (!validEmail(body.email)) return { error: "email must be a valid email address" };
    data.email = normalizeEmail(body.email);
  }

  if (Object.hasOwn(body, "password")) {
    const byteLength = typeof body.password === "string" ? Buffer.byteLength(body.password, "utf8") : 0;
    if (typeof body.password !== "string" || body.password.length < 8 || byteLength > 72) {
      return { error: "password must be at least 8 characters and no more than 72 UTF-8 bytes" };
    }
    data.password = body.password;
  }

  for (const [field, limit] of Object.entries(OPTIONAL_TEXT_LIMITS)) {
    if (!Object.hasOwn(body, field)) continue;
    if (body[field] !== null && (typeof body[field] !== "string" || body[field].length > limit)) {
      return { error: `${field} must be a string of at most ${limit} characters or null` };
    }
    data[field] = body[field] === null ? null : body[field].trim();
  }

  if (Object.hasOwn(body, "joiningDate")) {
    if (body.joiningDate !== null && !validDate(body.joiningDate)) {
      return { error: "joiningDate must be a valid YYYY-MM-DD date or null" };
    }
    data.joiningDate = parseDate(body.joiningDate);
  }

  if (Object.hasOwn(body, "employmentStatus")) {
    if (!EMPLOYMENT_STATUSES.has(body.employmentStatus)) {
      return { error: "employmentStatus must be ACTIVE or INACTIVE" };
    }
    data.employmentStatus = body.employmentStatus;
  }

  return { data };
};

const teacherInclude = {
  user: { select: { fullName: true, email: true, isActive: true } },
};

const serializeTeacher = (teacher) => ({
  id: teacher.id,
  employeeId: teacher.employeeId,
  fullName: teacher.user.fullName,
  email: teacher.user.email,
  phoneNumber: teacher.phoneNumber,
  qualification: teacher.qualification,
  specialization: teacher.specialization,
  joiningDate: teacher.joiningDate ? teacher.joiningDate.toISOString().slice(0, 10) : null,
  employmentStatus: teacher.user.isActive ? "ACTIVE" : "INACTIVE",
  createdAt: teacher.createdAt,
  updatedAt: teacher.updatedAt,
});

const handleTeacherError = (res, error) => {
  if (error && error.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "A teacher with this email or employee ID already exists",
    });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const createTeacher = async (req, res) => {
  const { data, error } = validateTeacher(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const employmentStatus = data.employmentStatus || "ACTIVE";
    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          passwordHash,
          role: "TEACHER",
          tenantId: req.user.tenantId,
          isActive: employmentStatus === "ACTIVE",
        },
      });
      return tx.teacher.create({
        data: {
          tenantId: req.user.tenantId,
          userId: user.id,
          employeeId: data.employeeId,
          phoneNumber: data.phoneNumber ?? null,
          qualification: data.qualification ?? null,
          specialization: data.specialization ?? null,
          joiningDate: data.joiningDate ?? null,
        },
        include: teacherInclude,
      });
    });
    return res.status(201).json({ success: true, teacher: serializeTeacher(teacher) });
  } catch (error) {
    return handleTeacherError(res, error);
  }
};

const listTeachers = async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { tenantId: req.user.tenantId },
      include: teacherInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, teachers: teachers.map(serializeTeacher) });
  } catch (error) {
    return handleTeacherError(res, error);
  }
};

const getTeacher = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: teacherInclude,
    });
    if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
    return res.status(200).json({ success: true, teacher: serializeTeacher(teacher) });
  } catch (error) {
    return handleTeacherError(res, error);
  }
};

const updateTeacher = async (req, res) => {
  const { data, error } = validateTeacher(req.body, { partial: true });
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      select: { id: true, userId: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Teacher not found" });

    const teacher = await prisma.$transaction(async (tx) => {
      const userData = {};
      if (Object.hasOwn(data, "fullName")) userData.fullName = data.fullName;
      if (Object.hasOwn(data, "email")) userData.email = data.email;
      if (Object.hasOwn(data, "employmentStatus")) {
        userData.isActive = data.employmentStatus === "ACTIVE";
      }
      if (Object.keys(userData).length) {
        await tx.user.updateMany({
          where: { id: existing.userId, tenantId: req.user.tenantId },
          data: userData,
        });
      }

      const profileData = {};
      for (const field of ["employeeId", "phoneNumber", "qualification", "specialization", "joiningDate"]) {
        if (Object.hasOwn(data, field)) profileData[field] = data[field];
      }
      if (Object.keys(profileData).length) {
        await tx.teacher.updateMany({
          where: { id: req.params.id, tenantId: req.user.tenantId },
          data: profileData,
        });
      }

      return tx.teacher.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: teacherInclude,
      });
    });
    if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
    return res.status(200).json({ success: true, teacher: serializeTeacher(teacher) });
  } catch (error) {
    return handleTeacherError(res, error);
  }
};

const deactivateTeacher = async (req, res) => {
  try {
    const existing = await prisma.teacher.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      select: { id: true, userId: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Teacher not found" });

    const teacher = await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: existing.userId, tenantId: req.user.tenantId },
        data: { isActive: false },
      });
      return tx.teacher.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: teacherInclude,
      });
    });
    if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
    return res.status(200).json({ success: true, teacher: serializeTeacher(teacher) });
  } catch (error) {
    return handleTeacherError(res, error);
  }
};

module.exports = { createTeacher, listTeachers, getTeacher, updateTeacher, deactivateTeacher };
