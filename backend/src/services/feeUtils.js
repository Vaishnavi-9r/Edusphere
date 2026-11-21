const { isValidUuid } = require("../middleware/validateUuidParam");

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const toDate = (value) => new Date(`${value}T00:00:00.000Z`);
const dateString = (value) => value.toISOString().slice(0, 10);
const isValidPaise = (value, { allowZero = false } = {}) =>
  Number.isSafeInteger(value) && value <= 2_147_483_647 && (allowZero ? value >= 0 : value > 0);
const todayString = () => new Date().toISOString().slice(0, 10);
const effectiveStatus = (studentFee) => {
  const balance = studentFee.totalAmount - studentFee.amountPaid;
  if (balance <= 0) return "PAID";
  if (dateString(studentFee.dueDate) < todayString()) return "OVERDUE";
  return studentFee.amountPaid > 0 ? "PARTIALLY_PAID" : "PENDING";
};
const serializeStudentFee = (studentFee) => ({
  ...studentFee,
  dueDate: dateString(studentFee.dueDate),
  totalAmount: studentFee.totalAmount,
  amountPaid: studentFee.amountPaid,
  outstandingAmount: studentFee.totalAmount - studentFee.amountPaid,
  status: effectiveStatus(studentFee),
  ...(studentFee.payments ? { payments: studentFee.payments.map((payment) => ({ ...payment, amount: payment.amount })) } : {}),
});
const serializePayment = (payment) => ({
  ...payment,
  amount: payment.amount,
  paymentDate: payment.paymentDate.toISOString(),
});

module.exports = { isValidUuid, isValidDate, toDate, dateString, isValidPaise, effectiveStatus, serializeStudentFee, serializePayment };
