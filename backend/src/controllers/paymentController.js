const prisma = require("../config/prisma");
const { isValidUuid, isValidDate, isValidPaise, effectiveStatus, serializePayment, serializeStudentFee } = require("../services/feeUtils");
const { handleError } = require("./studentFeeController");

const METHODS = new Set(["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"]);
const paymentInclude = {
  studentFee: {
    include: {
      student: { select: { id: true, name: true, rollNumber: true } },
      feeStructure: { select: { id: true, name: true, category: true, academicYear: true } },
    },
  },
  receivedBy: { select: { id: true, fullName: true, role: true } },
};
const validatePayment = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Request body must be a JSON object" };
  const allowed = new Set(["studentFeeId", "amount", "paymentMethod", "transactionReference", "paymentDate"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  for (const field of ["studentFeeId", "amount", "paymentMethod"]) if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
  if (typeof body.studentFeeId !== "string" || !isValidUuid(body.studentFeeId)) return { error: "studentFeeId must be a valid UUID" };
  if (!isValidPaise(body.amount)) return { error: "amount must be a positive integer number of paise" };
  if (!METHODS.has(body.paymentMethod)) return { error: "paymentMethod must be CASH, UPI, BANK_TRANSFER, CARD, or OTHER" };
  const data = { studentFeeId: body.studentFeeId, amount: body.amount, paymentMethod: body.paymentMethod };
  if (Object.hasOwn(body, "transactionReference")) {
    if (body.transactionReference !== null && (typeof body.transactionReference !== "string" || !body.transactionReference.trim() || body.transactionReference.trim().length > 120)) {
      return { error: "transactionReference must be a non-empty string of at most 120 characters or null" };
    }
    data.transactionReference = body.transactionReference === null ? null : body.transactionReference.trim();
  }
  if (Object.hasOwn(body, "paymentDate")) {
    if (typeof body.paymentDate !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.paymentDate) || !isValidDate(body.paymentDate.slice(0, 10)) || Number.isNaN(new Date(body.paymentDate).getTime())) {
      return { error: "paymentDate must be a valid ISO date-time" };
    }
    data.paymentDate = new Date(body.paymentDate);
  }
  return { data };
};
const paymentError = (res, error) => {
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "transactionReference has already been used in this tenant" });
  if (error?.code === "P2003") return res.status(404).json({ success: false, message: "Student fee not found in this tenant" });
  return handleError(res, error);
};

const recordPayment = async (req, res) => {
  const validated = validatePayment(req.body);
  if (validated.error) return res.status(400).json({ success: false, message: validated.error });
  const data = validated.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const fee = await tx.studentFee.findFirst({
        where: { id: data.studentFeeId, tenantId: req.user.tenantId },
        select: { id: true, totalAmount: true, amountPaid: true, dueDate: true },
      });
      if (!fee) return { status: 404, message: "Student fee not found in this tenant" };
      if (data.amount > fee.totalAmount - fee.amountPaid) return { status: 409, message: "Payment exceeds the outstanding fee balance" };

      // A conditional atomic update serializes concurrent payments on this fee row.
      // Its predicate is rechecked by PostgreSQL after waiting for a concurrent writer.
      const updated = await tx.studentFee.updateMany({
        where: {
          id: fee.id, tenantId: req.user.tenantId,
          amountPaid: { lte: fee.totalAmount - data.amount },
        },
        data: { amountPaid: { increment: data.amount }, updatedAt: new Date() },
      });
      if (!updated.count) return { status: 409, message: "Payment exceeds the outstanding fee balance" };
      const refreshed = await tx.studentFee.findFirst({ where: { id: fee.id, tenantId: req.user.tenantId } });
      const status = effectiveStatus(refreshed);
      await tx.studentFee.updateMany({ where: { id: fee.id, tenantId: req.user.tenantId }, data: { status, updatedAt: new Date() } });
      const payment = await tx.payment.create({
        data: {
          tenantId: req.user.tenantId, studentFeeId: fee.id, amount: data.amount,
          paymentMethod: data.paymentMethod, transactionReference: data.transactionReference,
          ...(data.paymentDate ? { paymentDate: data.paymentDate } : {}), receivedById: req.user.userId,
        }, include: paymentInclude,
      });
      return { payment, studentFee: refreshed };
    });
    if (result.status) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(201).json({
      success: true, payment: serializePayment(result.payment),
      studentFee: serializeStudentFee({ ...result.studentFee, amountPaid: result.studentFee.amountPaid, status: effectiveStatus(result.studentFee) }),
    });
  } catch (error) { return paymentError(res, error); }
};

const getPayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: paymentInclude });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    return res.status(200).json({ success: true, payment: serializePayment(payment) });
  } catch (error) { return paymentError(res, error); }
};

const getStudentPayments = async (req, res) => {
  try {
    const student = await prisma.student.findFirst({ where: { id: req.params.studentId, tenantId: req.user.tenantId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const payments = await prisma.payment.findMany({
      where: { tenantId: req.user.tenantId, studentFee: { studentId: student.id, tenantId: req.user.tenantId } },
      include: paymentInclude, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    });
    return res.status(200).json({ success: true, payments: payments.map(serializePayment) });
  } catch (error) { return paymentError(res, error); }
};

const getFeePayments = async (req, res) => {
  try {
    const fee = await prisma.studentFee.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true } });
    if (!fee) return res.status(404).json({ success: false, message: "Student fee not found" });
    const payments = await prisma.payment.findMany({
      where: { tenantId: req.user.tenantId, studentFeeId: fee.id }, include: paymentInclude,
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
    });
    return res.status(200).json({ success: true, studentFeeId: fee.id, payments: payments.map(serializePayment) });
  } catch (error) { return paymentError(res, error); }
};

const getCollectionReport = async (req, res) => {
  try {
    const [paymentTotals, byMethod, fees] = await Promise.all([
      prisma.payment.aggregate({ where: { tenantId: req.user.tenantId }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.groupBy({ by: ["paymentMethod"], where: { tenantId: req.user.tenantId }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.studentFee.findMany({ where: { tenantId: req.user.tenantId }, select: { totalAmount: true, amountPaid: true, dueDate: true } }),
    ]);
    const feeSummary = fees.reduce((sum, fee) => ({
      totalAssigned: sum.totalAssigned + fee.totalAmount,
      outstanding: sum.outstanding + Math.max(0, fee.totalAmount - fee.amountPaid),
      statuses: { ...sum.statuses, [effectiveStatus(fee)]: sum.statuses[effectiveStatus(fee)] + 1 },
    }), { totalAssigned: 0, outstanding: 0, statuses: { PENDING: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0 } });
    return res.status(200).json({
      success: true,
      totalCollected: paymentTotals._sum.amount || 0,
      paymentCount: paymentTotals._count._all,
      totalAssigned: feeSummary.totalAssigned,
      outstanding: feeSummary.outstanding,
      feeStatuses: feeSummary.statuses,
      byPaymentMethod: byMethod.map((row) => ({ paymentMethod: row.paymentMethod, amount: row._sum.amount || 0, count: row._count._all })),
      currencyUnit: "paise",
    });
  } catch (error) { return paymentError(res, error); }
};

module.exports = { recordPayment, getPayment, getStudentPayments, getFeePayments, getCollectionReport };
