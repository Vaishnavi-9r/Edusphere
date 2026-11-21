const prisma = require("../config/prisma");
const { effectiveStatus, serializeStudentFee, serializePayment } = require("../services/feeUtils");
const { getGradeLabel } = require("../config/gradingScale");

const handle = (res, error) => { console.error(error); return res.status(500).json({ success: false, message: "Internal Server Error" }); };
const currentParent = (req) => prisma.parent.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.userId }, include: { user: { select: { id: true, fullName: true, email: true, role: true } } } });
const linkedStudent = async (req, studentId) => {
  const parent = await prisma.parent.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.userId }, select: { id: true } });
  if (!parent) return null;
  return prisma.parentStudent.findFirst({ where: { tenantId: req.user.tenantId, parentId: parent.id, studentId }, include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } } });
};
const profile = async (req, res) => { try { const p = await currentParent(req); if (!p) return res.status(404).json({ success: false, message: "Parent profile not found" }); return res.json({ success: true, parent: { id: p.id, tenantId: p.tenantId, phoneNumber: p.phoneNumber, address: p.address, user: p.user } }); } catch (e) { return handle(res, e); } };
const students = async (req, res) => { try { const p = await prisma.parent.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.userId }, select: { id: true } }); if (!p) return res.status(404).json({ success: false, message: "Parent profile not found" }); const links = await prisma.parentStudent.findMany({ where: { tenantId: req.user.tenantId, parentId: p.id }, include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } } }); return res.json({ success: true, students: links.map(l => ({ ...l.student, relationshipType: l.relationshipType, isPrimaryContact: l.isPrimaryContact })) }); } catch (e) { return handle(res, e); } };
const withStudent = (fn) => async (req, res) => { try { const link = await linkedStudent(req, req.params.studentId); if (!link) return res.status(404).json({ success: false, message: "Linked student not found" }); return await fn(req, res, link.student); } catch (e) { return handle(res, e); } };
const attendance = withStudent(async (req, res, student) => { const rows = await prisma.attendance.findMany({ where: { tenantId: req.user.tenantId, studentId: student.id }, orderBy: { date: "desc" }, select: { id: true, date: true, status: true, remarks: true, createdAt: true } }); return res.json({ success: true, student, attendance: rows }); });
const grades = withStudent(async (req, res, student) => { const rows = await prisma.grade.findMany({ where: { tenantId: req.user.tenantId, studentId: student.id }, orderBy: [{ examination: { examDate: "desc" } }], select: { id: true, marksObtained: true, maximumMarks: true, percentage: true, grade: true, remarks: true, createdAt: true, examination: { select: { id: true, name: true, examType: true, examDate: true, academicYear: true, course: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true } } } } } }); return res.json({ success: true, student, grades: rows.map(g => ({ ...g, marksObtained: Number(g.marksObtained), maximumMarks: Number(g.maximumMarks), percentage: Number(g.percentage) })) }); });
const reportCard = withStudent(async (req, res, student) => {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    include: {
      course: { select: { id: true, name: true, code: true } },
      grades: {
        where: { tenantId: req.user.tenantId },
        include: { examination: { include: { subject: { select: { id: true, name: true, code: true } } } } },
        orderBy: { examination: { examDate: "asc" } },
      },
    },
    orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
  });
  const reportCards = enrollments.map(enrollment => {
    const items = enrollment.grades.map(g => ({
      id: g.id, marksObtained: Number(g.marksObtained), maximumMarks: Number(g.maximumMarks), percentage: Number(g.percentage), grade: g.grade, remarks: g.remarks,
      examination: { id: g.examination.id, name: g.examination.name, examType: g.examination.examType, examDate: g.examination.examDate, academicYear: g.examination.academicYear, course: enrollment.course, subject: g.examination.subject },
    }));
    const totalMarksObtained = items.reduce((sum, item) => sum + item.marksObtained, 0);
    const totalMaximumMarks = items.reduce((sum, item) => sum + item.maximumMarks, 0);
    const percentage = totalMaximumMarks ? Math.round(totalMarksObtained / totalMaximumMarks * 10000) / 100 : 0;
    return { enrollmentId: enrollment.id, course: enrollment.course, academicYear: enrollment.academicYear, enrollmentStatus: enrollment.status, grades: items, totalMarksObtained, totalMaximumMarks, percentage, overallGrade: totalMaximumMarks ? getGradeLabel(percentage) : null };
  });
  return res.json({ success: true, student, gradingScaleRule: "Configured by EDUSPHERE_GRADING_SCALE; default: A >= 90, B >= 80, C >= 70, D >= 60, F >= 0", reportCards, calculationRule: "Enrollment percentage is total marks obtained divided by total examination maximum marks, multiplied by 100 and rounded to two decimal places." });
});
const fees = withStudent(async (req, res, student) => { const rows = await prisma.studentFee.findMany({ where: { tenantId: req.user.tenantId, studentId: student.id }, include: { feeStructure: { select: { id: true, name: true, category: true, academicYear: true } } }, orderBy: { dueDate: "asc" } }); return res.json({ success: true, student, studentFees: rows.map(f => serializeStudentFee({ ...f, status: effectiveStatus(f) })) }); });
const payments = withStudent(async (req, res, student) => { const rows = await prisma.payment.findMany({ where: { tenantId: req.user.tenantId, studentFee: { tenantId: req.user.tenantId, studentId: student.id } }, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }], select: { id: true, studentFeeId: true, amount: true, paymentMethod: true, transactionReference: true, paymentDate: true, createdAt: true } }); return res.json({ success: true, student, payments: rows.map(serializePayment) }); });
const timetable = withStudent(async (req, res, student) => { const enrollments = await prisma.studentEnrollment.findMany({ where: { tenantId: req.user.tenantId, studentId: student.id }, select: { courseId: true, academicYear: true } }); if (!enrollments.length) return res.json({ success: true, student, timetables: [] }); const timetables = await prisma.timetable.findMany({ where: { tenantId: req.user.tenantId, OR: enrollments.map(e => ({ courseId: e.courseId, academicYear: e.academicYear })) }, include: { course: { select: { id: true, name: true, code: true } }, entries: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classroom: true, subject: { select: { id: true, name: true, code: true } }, teacher: { select: { id: true, employeeId: true, user: { select: { fullName: true } } } } } } }, orderBy: [{ academicYear: "desc" }, { term: "asc" }] }); return res.json({ success: true, student, timetables }); });
module.exports = { profile, students, attendance, grades, reportCard, fees, payments, timetable };
