const prisma = require("../config/prisma");
const { isValidUuid, effectiveStatus, serializeStudentFee } = require("../services/feeUtils");

const feeInclude = {
  student: { select: { id: true, name: true, rollNumber: true, grade: true } },
  feeStructure: { select: { id: true, name: true, category: true, academicYear: true, courseId: true, course: { select: { id: true, name: true, code: true } } } },
  enrollment: { select: { id: true, academicYear: true, status: true, course: { select: { id: true, name: true, code: true } } } },
};
const paymentsInclude = { payments: { select: { id: true, amount: true, paymentMethod: true, transactionReference: true, paymentDate: true } } };
const validateAssignment = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const unknown = Object.keys(body).find((key) => !["studentId", "feeStructureId", "enrollmentId"].includes(key));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  for (const field of ["studentId", "feeStructureId"]) {
    if (typeof body[field] !== "string" || !isValidUuid(body[field])) return { error: `${field} must be a valid UUID` };
  }
  if (body.enrollmentId !== undefined && body.enrollmentId !== null && (typeof body.enrollmentId !== "string" || !isValidUuid(body.enrollmentId))) {
    return { error: "enrollmentId must be a valid UUID or null" };
  }
  return { data: body };
};
const handleError = (res, error) => {
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "This student has already been assigned this fee structure" });
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "Fee assignment references a record that cannot be changed" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const assignStudentFee = async (req, res) => {
  const validated = validateAssignment(req.body);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  const input = validated.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const [student, structure] = await Promise.all([
        tx.student.findFirst({ where: { id: input.studentId, tenantId: req.user.tenantId }, select: { id: true } }),
        tx.feeStructure.findFirst({ where: { id: input.feeStructureId, tenantId: req.user.tenantId, isActive: true } }),
      ]);
      if (!student || !structure) return { status: 404, message: "Student or active fee structure not found in this tenant" };
      if (structure.courseId && !input.enrollmentId) return { status: 400, message: "enrollmentId is required for a course-specific fee" };
      let enrollment = null;
      if (input.enrollmentId) {
        enrollment = await tx.studentEnrollment.findFirst({
          where: {
            id: input.enrollmentId, tenantId: req.user.tenantId, studentId: student.id,
            academicYear: structure.academicYear,
            ...(structure.courseId ? { courseId: structure.courseId } : {}),
          }, select: { id: true },
        });
        if (!enrollment) return { status: 400, message: "Enrollment must belong to this student and fee academic year, and match the fee course when specified" };
      }
      const dueDate = structure.dueDate;
      const fee = await tx.studentFee.create({
        data: {
          tenantId: req.user.tenantId, studentId: student.id, feeStructureId: structure.id,
          enrollmentId: enrollment?.id || null, academicYear: structure.academicYear,
          totalAmount: structure.amount, amountPaid: 0, dueDate, status: effectiveStatus({ totalAmount: structure.amount, amountPaid: 0, dueDate }),
        }, include: feeInclude,
      });
      return { fee };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(201).json({ success: true, studentFee: serializeStudentFee(result.fee) });
  } catch (error) { return handleError(res, error); }
};

const getStudentFee = async (req, res) => {
  try {
    const fee = await prisma.studentFee.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: feeInclude });
    if (!fee) return res.status(404).json({ success: false, message: "Student fee not found" });
    return res.status(200).json({ success: true, studentFee: serializeStudentFee(fee) });
  } catch (error) { return handleError(res, error); }
};

const getStudentFees = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const fees = await prisma.studentFee.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id }, include: feeInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });
    return res.status(200).json({ success: true, studentFees: fees.map(serializeStudentFee) });
  } catch (error) { return handleError(res, error); }
};

const getStudentFeeSummary = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true, name: true, rollNumber: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const fees = await prisma.studentFee.findMany({
      where: { tenantId: req.user.tenantId, studentId: student.id }, include: feeInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });
    const statuses = { PENDING: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0 };
    for (const fee of fees) statuses[effectiveStatus(fee)] += 1;
    const totalAmount = fees.reduce((sum, fee) => sum + fee.totalAmount, 0);
    const amountPaid = fees.reduce((sum, fee) => sum + fee.amountPaid, 0);
    return res.status(200).json({
      success: true, student, feeCount: fees.length, totalAmount, amountPaid,
      outstandingAmount: totalAmount - amountPaid, statuses,
      studentFees: fees.map(serializeStudentFee), currencyUnit: "paise",
    });
  } catch (error) { return handleError(res, error); }
};

module.exports = { assignStudentFee, getStudentFee, getStudentFees, getStudentFeeSummary, feeInclude, handleError };
