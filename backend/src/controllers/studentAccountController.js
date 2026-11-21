const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const createStudentAccount = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["email", "password"].includes(key))) {
    return res.status(400).json({ success: false, message: "Only email and password are accepted" });
  }
  if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).json({ success: false, message: "A valid email is required" });
  }
  if (typeof body.password !== "string" || body.password.length < 8 || Buffer.byteLength(body.password, "utf8") > 72) {
    return res.status(400).json({ success: false, message: "Password must be 8 to 72 UTF-8 bytes" });
  }
  try {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await prisma.$transaction(async tx => {
      const student = await tx.student.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true, name: true, rollNumber: true, grade: true, userId: true } });
      if (!student) return { status: 404, message: "Student not found" };
      if (student.userId) return { status: 409, message: "Student already has a login account" };
      const user = await tx.user.create({ data: { fullName: student.name, email: body.email.trim().toLowerCase(), passwordHash, role: "STUDENT", tenantId: req.user.tenantId }, select: { id: true, email: true, role: true, isActive: true } });
      const linked = await tx.student.updateMany({ where: { id: student.id, tenantId: req.user.tenantId, userId: null }, data: { userId: user.id } });
      if (!linked.count) throw Object.assign(new Error("Student account link changed concurrently"), { code: "STUDENT_ALREADY_LINKED" });
      return { student: { id: student.id, name: student.name, rollNumber: student.rollNumber, grade: student.grade }, user };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(201).json({ success: true, student: result.student, user: result.user });
  } catch (error) {
    if (error?.code === "P2002") return res.status(409).json({ success: false, message: "Email is already registered or the student already has an account" });
    if (error?.code === "STUDENT_ALREADY_LINKED") return res.status(409).json({ success: false, message: "Student already has a login account" });
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const deactivateStudentAccount = async (req, res) => {
  try {
    const result = await prisma.$transaction(async tx => {
      const student = await tx.student.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { userId: true } });
      if (!student) return { status: 404 };
      if (!student.userId) return { status: 404 };
      await tx.user.updateMany({ where: { id: student.userId, tenantId: req.user.tenantId, role: "STUDENT" }, data: { isActive: false } });
      return { status: 200 };
    });
    if (result.status === 404) return res.status(404).json({ success: false, message: "Student account not found" });
    return res.json({ success: true, message: "Student account deactivated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { createStudentAccount, deactivateStudentAccount };
