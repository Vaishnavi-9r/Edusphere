const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { isValidUuid } = require("../middleware/validateUuidParam");

const relationships = new Set(["FATHER", "MOTHER", "GUARDIAN", "OTHER"]);
const safeParent = (parent) => ({ ...parent, user: { id: parent.user.id, fullName: parent.user.fullName, email: parent.user.email, role: parent.user.role, isActive: parent.user.isActive } });
const fail = (res, error) => {
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "Email or parent-student link already exists" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};
const parentInclude = { user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } }, studentLinks: { include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } } } };

const createParent = async (req, res) => {
  const b = req.body;
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some(k => !["fullName", "email", "password", "phoneNumber", "address"].includes(k))) return res.status(400).json({ success: false, message: "Invalid parent request fields" });
  if (typeof b.fullName !== "string" || !b.fullName.trim() || typeof b.email !== "string" || !/^\S+@\S+\.\S+$/.test(b.email) || typeof b.password !== "string" || b.password.length < 8) return res.status(400).json({ success: false, message: "fullName, valid email, and password of at least 8 characters are required" });
  if (["phoneNumber", "address"].some(k => b[k] != null && typeof b[k] !== "string")) return res.status(400).json({ success: false, message: "phoneNumber and address must be strings or null" });
  try {
    const parent = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { fullName: b.fullName.trim(), email: b.email.trim().toLowerCase(), passwordHash: await bcrypt.hash(b.password, 10), role: "PARENT", tenantId: req.user.tenantId } });
      return tx.parent.create({ data: { tenantId: req.user.tenantId, userId: user.id, phoneNumber: b.phoneNumber?.trim() || null, address: b.address?.trim() || null }, include: parentInclude });
    });
    return res.status(201).json({ success: true, parent: safeParent(parent) });
  } catch (e) { return fail(res, e); }
};
const listParents = async (req, res) => { try { const rows = await prisma.parent.findMany({ where: { tenantId: req.user.tenantId }, include: parentInclude, orderBy: { createdAt: "desc" } }); return res.json({ success: true, parents: rows.map(safeParent) }); } catch (e) { return fail(res, e); } };
const getParent = async (req, res) => { try { const p = await prisma.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: parentInclude }); return p ? res.json({ success: true, parent: safeParent(p) }) : res.status(404).json({ success: false, message: "Parent not found" }); } catch (e) { return fail(res, e); } };
const updateParent = async (req, res) => {
  const b = req.body; const allowed = ["fullName", "email", "phoneNumber", "address"];
  if (!b || typeof b !== "object" || Array.isArray(b) || !Object.keys(b).length || Object.keys(b).some(k => !allowed.includes(k))) return res.status(400).json({ success: false, message: "Provide supported parent fields to update" });
  if ((b.fullName !== undefined && (typeof b.fullName !== "string" || !b.fullName.trim())) || (b.email !== undefined && (typeof b.email !== "string" || !/^\S+@\S+\.\S+$/.test(b.email))) || ["phoneNumber", "address"].some(k => b[k] != null && typeof b[k] !== "string")) return res.status(400).json({ success: false, message: "Invalid parent details" });
  try {
    const p = await prisma.$transaction(async tx => {
      const existing = await tx.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { userId: true } }); if (!existing) return null;
      const userData = {}; if (b.fullName !== undefined) userData.fullName = b.fullName.trim(); if (b.email !== undefined) userData.email = b.email.trim().toLowerCase();
      if (Object.keys(userData).length) await tx.user.updateMany({ where: { id: existing.userId, tenantId: req.user.tenantId, role: "PARENT" }, data: userData });
      const data = {}; for (const k of ["phoneNumber", "address"]) if (Object.hasOwn(b, k)) data[k] = b[k]?.trim() || null;
      if (Object.keys(data).length) await tx.parent.updateMany({ where: { id: req.params.id, tenantId: req.user.tenantId }, data: { ...data, updatedAt: new Date() } });
      return tx.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: parentInclude });
    });
    return p ? res.json({ success: true, parent: safeParent(p) }) : res.status(404).json({ success: false, message: "Parent not found" });
  } catch (e) { return fail(res, e); }
};
const deactivateParent = async (req, res) => { try { const p = await prisma.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { userId: true } }); if (!p) return res.status(404).json({ success: false, message: "Parent not found" }); await prisma.user.updateMany({ where: { id: p.userId, tenantId: req.user.tenantId, role: "PARENT" }, data: { isActive: false } }); return res.json({ success: true, message: "Parent account deactivated" }); } catch (e) { return fail(res, e); } };
const linkStudent = async (req, res) => {
  const b = req.body;
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some(k => !["studentId", "relationshipType", "isPrimaryContact"].includes(k)) || typeof b.studentId !== "string" || !isValidUuid(b.studentId) || !relationships.has(b.relationshipType) || (b.isPrimaryContact !== undefined && typeof b.isPrimaryContact !== "boolean")) return res.status(400).json({ success: false, message: "studentId must be a UUID, relationshipType must be FATHER, MOTHER, GUARDIAN, or OTHER, and isPrimaryContact must be boolean when provided" });
  try {
    const [parent, student] = await Promise.all([prisma.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true } }), prisma.student.findFirst({ where: { id: b.studentId, tenantId: req.user.tenantId }, select: { id: true } })]);
    if (!parent || !student) return res.status(404).json({ success: false, message: "Parent or student not found in this tenant" });
    const link = await prisma.parentStudent.create({ data: { tenantId: req.user.tenantId, parentId: parent.id, studentId: student.id, relationshipType: b.relationshipType, isPrimaryContact: b.isPrimaryContact ?? false } });
    return res.status(201).json({ success: true, relationship: link });
  } catch (e) { return fail(res, e); }
};
const unlinkStudent = async (req, res) => { try { const d = await prisma.parentStudent.deleteMany({ where: { tenantId: req.user.tenantId, parentId: req.params.id, studentId: req.params.studentId } }); return d.count ? res.json({ success: true, message: "Student unlinked" }) : res.status(404).json({ success: false, message: "Parent-student link not found" }); } catch (e) { return fail(res, e); } };
const listLinkedStudents = async (req, res) => { try { const p = await prisma.parent.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true } }); if (!p) return res.status(404).json({ success: false, message: "Parent not found" }); const links = await prisma.parentStudent.findMany({ where: { tenantId: req.user.tenantId, parentId: p.id }, include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } } }); return res.json({ success: true, students: links.map(x => ({ ...x.student, relationshipType: x.relationshipType, isPrimaryContact: x.isPrimaryContact })) }); } catch (e) { return fail(res, e); } };
module.exports = { createParent, listParents, getParent, updateParent, deactivateParent, linkStudent, unlinkStudent, listLinkedStudents };
