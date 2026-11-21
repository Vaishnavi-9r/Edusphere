const prisma = require("../config/prisma");
const { isValidUuid, isValidDate, toDate, dateString, isValidPaise } = require("../services/feeUtils");

const CATEGORIES = new Set(["TUITION", "EXAMINATION", "TRANSPORT", "LIBRARY", "OTHER"]);
const include = { course: { select: { id: true, name: true, code: true, academicYear: true } } };
const validate = (body, partial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const allowed = partial
    ? new Set(["name", "description", "category", "amount", "dueDate", "isActive"])
    : new Set(["name", "description", "category", "amount", "academicYear", "courseId", "dueDate", "isActive"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  if (partial && Object.keys(body).length === 0) return { error: "At least one fee structure field is required" };
  if (!partial) for (const field of ["name", "category", "amount", "academicYear", "dueDate"]) {
    if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
  }
  const data = {};
  if (Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) return { error: "name must be a non-empty string of at most 120 characters" };
    data.name = body.name.trim();
  }
  if (Object.hasOwn(body, "description")) {
    if (body.description !== null && (typeof body.description !== "string" || body.description.length > 2000)) return { error: "description must be a string of at most 2000 characters or null" };
    data.description = body.description;
  }
  if (Object.hasOwn(body, "category")) {
    if (!CATEGORIES.has(body.category)) return { error: "category must be TUITION, EXAMINATION, TRANSPORT, LIBRARY, or OTHER" };
    data.category = body.category;
  }
  if (Object.hasOwn(body, "amount")) {
    if (!isValidPaise(body.amount)) return { error: "amount must be a positive integer number of paise" };
    data.amount = body.amount;
  }
  if (Object.hasOwn(body, "academicYear")) {
    if (typeof body.academicYear !== "string" || !body.academicYear.trim() || body.academicYear.trim().length > 20) return { error: "academicYear must be a non-empty string of at most 20 characters" };
    data.academicYear = body.academicYear.trim();
  }
  if (Object.hasOwn(body, "courseId")) {
    if (body.courseId !== null && (typeof body.courseId !== "string" || !isValidUuid(body.courseId))) return { error: "courseId must be a valid UUID or null" };
    data.courseId = body.courseId;
  }
  if (Object.hasOwn(body, "dueDate")) {
    if (!isValidDate(body.dueDate)) return { error: "dueDate must be a valid YYYY-MM-DD date" };
    data.dueDate = toDate(body.dueDate);
  }
  if (Object.hasOwn(body, "isActive")) {
    if (typeof body.isActive !== "boolean") return { error: "isActive must be a boolean" };
    data.isActive = body.isActive;
  }
  return { data };
};
const serialize = (structure) => ({ ...structure, dueDate: dateString(structure.dueDate) });
const handleError = (res, error) => {
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "Fee structure is assigned to students and cannot be deleted" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const createFeeStructure = async (req, res) => {
  const { data, error } = validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    if (data.courseId) {
      const course = await prisma.course.findFirst({ where: { id: data.courseId, tenantId: req.user.tenantId, academicYear: data.academicYear }, select: { id: true } });
      if (!course) return res.status(404).json({ success: false, message: "Course not found in this tenant and academic year" });
    }
    const feeStructure = await prisma.feeStructure.create({ data: { ...data, tenantId: req.user.tenantId }, include });
    return res.status(201).json({ success: true, feeStructure: serialize(feeStructure) });
  } catch (error) { return handleError(res, error); }
};

const listFeeStructures = async (req, res) => {
  try {
    const feeStructures = await prisma.feeStructure.findMany({ where: { tenantId: req.user.tenantId }, include, orderBy: [{ academicYear: "desc" }, { name: "asc" }] });
    return res.status(200).json({ success: true, feeStructures: feeStructures.map(serialize) });
  } catch (error) { return handleError(res, error); }
};

const getFeeStructure = async (req, res) => {
  try {
    const feeStructure = await prisma.feeStructure.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include });
    if (!feeStructure) return res.status(404).json({ success: false, message: "Fee structure not found" });
    return res.status(200).json({ success: true, feeStructure: serialize(feeStructure) });
  } catch (error) { return handleError(res, error); }
};

const updateFeeStructure = async (req, res) => {
  const { data, error } = validate(req.body, true);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true, academicYear: true, courseId: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Fee structure not found" });
    const academicYear = data.academicYear || existing.academicYear;
    const courseId = existing.courseId;
    if (courseId) {
      const course = await prisma.course.findFirst({ where: { id: courseId, tenantId: req.user.tenantId, academicYear }, select: { id: true } });
      if (!course) return res.status(400).json({ success: false, message: "academicYear must continue to match the linked course" });
    }
    const result = await prisma.feeStructure.updateMany({ where: { id: existing.id, tenantId: req.user.tenantId }, data: { ...data, updatedAt: new Date() } });
    if (!result.count) return res.status(404).json({ success: false, message: "Fee structure not found" });
    const feeStructure = await prisma.feeStructure.findFirst({ where: { id: existing.id, tenantId: req.user.tenantId }, include });
    return res.status(200).json({ success: true, feeStructure: serialize(feeStructure) });
  } catch (error) { return handleError(res, error); }
};

const deleteFeeStructure = async (req, res) => {
  try {
    const result = await prisma.feeStructure.deleteMany({ where: { id: req.params.id, tenantId: req.user.tenantId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Fee structure not found" });
    return res.status(200).json({ success: true, message: "Fee structure deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

module.exports = { createFeeStructure, listFeeStructures, getFeeStructure, updateFeeStructure, deleteFeeStructure };
