const prisma = require("../config/prisma");
const { effectiveStatus, serializeStudentFee, serializePayment } = require("../services/feeUtils");
const { getGradeLabel } = require("../config/gradingScale");

const handleError = (res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};
const getStudent = req => prisma.student.findFirst({
  where: { tenantId: req.user.tenantId, userId: req.user.userId },
  select: { id: true, name: true, rollNumber: true, grade: true, tenantId: true, createdAt: true, user: { select: { id: true, email: true, role: true, isActive: true } } },
});
const withStudent = handler => async (req, res) => {
  try {
    const student = await getStudent(req);
    if (!student) return res.status(404).json({ success: false, message: "Student profile not found" });
    return await handler(req, res, student);
  } catch (error) { return handleError(res, error); }
};

const profile = withStudent(async (req, res, student) => res.json({ success: true, student }));

const attendance = withStudent(async (req, res, student) => {
  const rows = await prisma.attendance.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    orderBy: { date: "desc" },
    select: { id: true, date: true, status: true, remarks: true, createdAt: true },
  });
  return res.json({ success: true, attendance: rows });
});

const attendanceSummary = withStudent(async (req, res, student) => {
  const grouped = await prisma.attendance.groupBy({
    by: ["status"], where: { tenantId: req.user.tenantId, studentId: student.id }, _count: { _all: true },
  });
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const eligible = total - counts.EXCUSED;
  const attendancePercentage = eligible ? Math.round(((counts.PRESENT + counts.LATE) / eligible) * 10000) / 100 : 0;
  return res.json({ success: true, total, counts, attendancePercentage, percentageRule: "(PRESENT + LATE) / (total - EXCUSED) * 100; EXCUSED records are excluded" });
});

const enrollmentsFor = (tenantId, studentId) => prisma.studentEnrollment.findMany({
  where: { tenantId, studentId }, select: { courseId: true, academicYear: true },
});

const examinations = withStudent(async (req, res, student) => {
  const enrollments = await enrollmentsFor(req.user.tenantId, student.id);
  if (!enrollments.length) return res.json({ success: true, examinations: [] });
  const rows = await prisma.examination.findMany({
    where: { tenantId: req.user.tenantId, OR: enrollments.map(item => ({ courseId: item.courseId, academicYear: item.academicYear })) },
    include: { course: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true } } },
    orderBy: [{ examDate: "desc" }, { startTime: "asc" }],
  });
  return res.json({ success: true, examinations: rows.map(row => ({ ...row, examDate: row.examDate.toISOString().slice(0, 10), startTime: row.startTime.toISOString().slice(11, 19), endTime: row.endTime.toISOString().slice(11, 19), maximumMarks: Number(row.maximumMarks), passingMarks: Number(row.passingMarks) })) });
});

const grades = withStudent(async (req, res, student) => {
  const rows = await prisma.grade.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    select: { id: true, marksObtained: true, maximumMarks: true, percentage: true, grade: true, remarks: true, createdAt: true, examination: { select: { id: true, name: true, examType: true, examDate: true, academicYear: true, course: { select: { id: true, name: true, code: true } }, subject: { select: { id: true, name: true, code: true } } } } },
    orderBy: [{ examination: { examDate: "desc" } }],
  });
  return res.json({ success: true, grades: rows.map(row => ({ ...row, marksObtained: Number(row.marksObtained), maximumMarks: Number(row.maximumMarks), percentage: Number(row.percentage) })) });
});

const reportCard = withStudent(async (req, res, student) => {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    include: {
      course: { select: { id: true, name: true, code: true } },
      grades: { where: { tenantId: req.user.tenantId }, include: { examination: { include: { subject: { select: { id: true, name: true, code: true } } } } }, orderBy: { examination: { examDate: "asc" } } },
    },
    orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
  });
  const reportCards = enrollments.map(enrollment => {
    const gradeRows = enrollment.grades.map(item => ({ id: item.id, marksObtained: Number(item.marksObtained), maximumMarks: Number(item.maximumMarks), percentage: Number(item.percentage), grade: item.grade, remarks: item.remarks, examination: { id: item.examination.id, name: item.examination.name, examType: item.examination.examType, examDate: item.examination.examDate, academicYear: item.examination.academicYear, course: enrollment.course, subject: item.examination.subject } }));
    const totalMarksObtained = gradeRows.reduce((sum, item) => sum + item.marksObtained, 0);
    const totalMaximumMarks = gradeRows.reduce((sum, item) => sum + item.maximumMarks, 0);
    const percentage = totalMaximumMarks ? Math.round(totalMarksObtained / totalMaximumMarks * 10000) / 100 : 0;
    return { enrollmentId: enrollment.id, course: enrollment.course, academicYear: enrollment.academicYear, enrollmentStatus: enrollment.status, grades: gradeRows, totalMarksObtained, totalMaximumMarks, percentage, overallGrade: totalMaximumMarks ? getGradeLabel(percentage) : null };
  });
  return res.json({ success: true, student: { id: student.id, name: student.name, rollNumber: student.rollNumber, grade: student.grade }, gradingScaleRule: "Configured by EDUSPHERE_GRADING_SCALE; default: A >= 90, B >= 80, C >= 70, D >= 60, F >= 0", reportCards, calculationRule: "Enrollment percentage is total marks obtained divided by total examination maximum marks, multiplied by 100 and rounded to two decimal places." });
});

const timetable = withStudent(async (req, res, student) => {
  const enrollments = await enrollmentsFor(req.user.tenantId, student.id);
  if (!enrollments.length) return res.json({ success: true, timetables: [] });
  const rows = await prisma.timetable.findMany({
    where: { tenantId: req.user.tenantId, OR: enrollments.map(item => ({ courseId: item.courseId, academicYear: item.academicYear })) },
    include: { course: { select: { id: true, name: true, code: true } }, entries: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classroom: true, subject: { select: { id: true, name: true, code: true } }, teacher: { select: { id: true, employeeId: true, user: { select: { fullName: true } } } } } } },
    orderBy: [{ academicYear: "desc" }, { term: "asc" }],
  });
  return res.json({ success: true, timetables: rows });
});

const courses = withStudent(async (req, res, student) => {
  const rows = await prisma.studentEnrollment.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    include: { course: { select: { id: true, name: true, code: true, description: true, academicYear: true } } },
    orderBy: [{ academicYear: "desc" }, { enrollmentDate: "desc" }],
  });
  return res.json({ success: true, courses: rows.map(row => ({ enrollmentId: row.id, enrollmentDate: row.enrollmentDate, status: row.status, academicYear: row.academicYear, course: row.course })) });
});

const fees = withStudent(async (req, res, student) => {
  const rows = await prisma.studentFee.findMany({
    where: { tenantId: req.user.tenantId, studentId: student.id },
    include: { feeStructure: { select: { id: true, name: true, category: true, academicYear: true } } },
    orderBy: { dueDate: "asc" },
  });
  return res.json({ success: true, studentFees: rows.map(row => serializeStudentFee({ ...row, status: effectiveStatus(row) })) });
});

const payments = withStudent(async (req, res, student) => {
  const rows = await prisma.payment.findMany({
    where: { tenantId: req.user.tenantId, studentFee: { tenantId: req.user.tenantId, studentId: student.id } },
    select: { id: true, studentFeeId: true, amount: true, paymentMethod: true, transactionReference: true, paymentDate: true, createdAt: true },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  });
  return res.json({ success: true, payments: rows.map(serializePayment) });
});

module.exports = { profile, attendance, attendanceSummary, examinations, grades, reportCard, timetable, courses, fees, payments };
