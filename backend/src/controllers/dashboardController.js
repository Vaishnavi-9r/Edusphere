const prisma = require("../config/prisma");

const utcDate = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const round2 = value => Math.round(Number(value || 0) * 100) / 100;
const paiseValue = value => {
  const parsed = Number(value || 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Dashboard money aggregate exceeds the safe integer range");
  return parsed;
};
const fail = (res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, message: "Unable to calculate dashboard analytics" });
};

const overview = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const [totalStudents, totalTeachers, totalParents, totalCourses, activeEnrollments, activeStudentRows] = await Promise.all([
      prisma.student.count({ where: { tenantId } }),
      prisma.teacher.count({ where: { tenantId } }),
      prisma.parent.count({ where: { tenantId } }),
      prisma.course.count({ where: { tenantId } }),
      prisma.studentEnrollment.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.$queryRaw`SELECT COUNT(DISTINCT "studentId")::int AS "count" FROM "StudentEnrollment" WHERE "tenantId" = ${tenantId} AND "status" = 'ACTIVE'`,
    ]);
    return res.json({
      success: true,
      overview: {
        totalStudents,
        activeStudents: activeStudentRows[0]?.count || 0,
        totalTeachers,
        totalParents,
        totalCourses,
        activeEnrollments,
        activeStudentsRule: "Distinct students with at least one ACTIVE enrollment; Student has no separate active flag.",
      },
    });
  } catch (error) { return fail(res, error); }
};

const attendance = async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = utcDate();
  const date = today.toISOString().slice(0, 10);
  try {
    const grouped = await prisma.attendance.groupBy({
      by: ["status"], where: { tenantId, date: today }, _count: { _all: true },
    });
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const eligible = total - counts.EXCUSED;
    const attendancePercentage = eligible ? round2(((counts.PRESENT + counts.LATE) / eligible) * 100) : 0;
    return res.json({ success: true, date, todayAttendance: total, counts, attendancePercentage, percentageRule: "(PRESENT + LATE) / (total - EXCUSED) * 100; EXCUSED records are excluded" });
  } catch (error) { return fail(res, error); }
};

const academics = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const [examinationCount, performanceRows, courseRows] = await Promise.all([
      prisma.examination.count({ where: { tenantId } }),
      prisma.$queryRaw`
        SELECT COUNT(g."id")::int AS "gradeCount",
          COALESCE(AVG(g."percentage"), 0)::double precision AS "averagePerformance",
          COUNT(g."id") FILTER (WHERE g."marksObtained" >= e."passingMarks")::int AS "passed",
          COUNT(g."id") FILTER (WHERE g."marksObtained" < e."passingMarks")::int AS "failed"
        FROM "Grade" g
        INNER JOIN "Examination" e ON e."tenantId" = g."tenantId" AND e."id" = g."examinationId"
        WHERE g."tenantId" = ${tenantId}`,
      prisma.$queryRaw`
        SELECT c."id", c."name", c."code", COUNT(g."id")::int AS "gradeCount",
          COALESCE(AVG(g."percentage"), 0)::double precision AS "averagePerformance",
          COUNT(g."id") FILTER (WHERE g."marksObtained" >= e."passingMarks")::int AS "passed",
          COUNT(g."id") FILTER (WHERE g."marksObtained" < e."passingMarks")::int AS "failed"
        FROM "Course" c
        LEFT JOIN "Grade" g ON g."tenantId" = c."tenantId" AND g."courseId" = c."id" AND g."academicYear" = c."academicYear"
        LEFT JOIN "Examination" e ON e."tenantId" = g."tenantId" AND e."id" = g."examinationId"
        WHERE c."tenantId" = ${tenantId}
        GROUP BY c."id", c."name", c."code"
        ORDER BY c."name" ASC`,
    ]);
    const summary = performanceRows[0] || { gradeCount: 0, averagePerformance: 0, passed: 0, failed: 0 };
    return res.json({
      success: true,
      examinationCount,
      averageExaminationPerformance: round2(summary.averagePerformance),
      gradeCount: summary.gradeCount,
      passFail: { passed: summary.passed, failed: summary.failed, total: summary.passed + summary.failed, passRate: summary.passed + summary.failed ? round2(summary.passed / (summary.passed + summary.failed) * 100) : 0, rule: "Pass when marksObtained is greater than or equal to the examination passingMarks." },
      coursePerformance: courseRows.map(row => ({ courseId: row.id, courseName: row.name, courseCode: row.code, gradeCount: row.gradeCount, averagePerformance: round2(row.averagePerformance), passed: row.passed, failed: row.failed })),
    });
  } catch (error) { return fail(res, error); }
};

const fees = async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = utcDate();
  try {
    const [rows] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(sf."totalAmount"), 0)::text AS "totalAssigned",
        COALESCE((SELECT SUM(p."amount") FROM "Payment" p WHERE p."tenantId" = ${tenantId}), 0)::text AS "totalCollected",
        COALESCE(SUM(GREATEST(sf."totalAmount" - sf."amountPaid", 0)), 0)::text AS "outstandingBalance",
        COALESCE(SUM(GREATEST(sf."totalAmount" - sf."amountPaid", 0)) FILTER (WHERE sf."dueDate" < ${today}), 0)::text AS "overdueBalance"
      FROM "StudentFee" sf WHERE sf."tenantId" = ${tenantId}`;
    const totalAssignedPaise = paiseValue(rows?.totalAssigned);
    const totalCollectedPaise = paiseValue(rows?.totalCollected);
    const outstandingBalancePaise = paiseValue(rows?.outstandingBalance);
    const overdueBalancePaise = paiseValue(rows?.overdueBalance);
    return res.json({
      success: true,
      fees: {
        totalAssignedPaise, totalCollectedPaise, outstandingBalancePaise, overdueBalancePaise,
        collectionPercentage: totalAssignedPaise ? round2(totalCollectedPaise / totalAssignedPaise * 100) : 0,
        currencyUnit: "paise",
        calculationRules: { collected: "Sum of Payment.amount", outstanding: "Sum of max(totalAmount - amountPaid, 0) across StudentFee", overdue: "Outstanding amount for StudentFee records with dueDate before the current UTC date" },
      },
    });
  } catch (error) { return fail(res, error); }
};

const enrollments = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const [courses, grouped] = await Promise.all([
      prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true, code: true, academicYear: true }, orderBy: { name: "asc" } }),
      prisma.studentEnrollment.groupBy({ by: ["courseId", "academicYear", "status"], where: { tenantId }, _count: { _all: true } }),
    ]);
    const groups = new Map();
    for (const row of grouped) {
      const key = `${row.courseId}:${row.academicYear}`;
      const counts = groups.get(key) || { active: 0, completed: 0, withdrawn: 0, total: 0 };
      counts[row.status.toLowerCase()] = row._count._all;
      counts.total += row._count._all;
      groups.set(key, counts);
    }
    return res.json({
      success: true,
      enrollments: courses.map(course => ({ courseId: course.id, courseName: course.name, courseCode: course.code, academicYear: course.academicYear, ...(groups.get(`${course.id}:${course.academicYear}`) || { active: 0, completed: 0, withdrawn: 0, total: 0 }) })),
      totals: grouped.reduce((sum, row) => ({ ...sum, [row.status.toLowerCase()]: sum[row.status.toLowerCase()] + row._count._all, total: sum.total + row._count._all }), { active: 0, completed: 0, withdrawn: 0, total: 0 }),
    });
  } catch (error) { return fail(res, error); }
};

const recentActivity = async (req, res) => {
  const tenantId = req.user.tenantId;
  const take = 10;
  try {
    const [students, teachers, parents, courses, examinations, enrollments, attendanceRows, grades, payments, feeStructures] = await Promise.all([
      prisma.student.findMany({ where: { tenantId }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.teacher.findMany({ where: { tenantId }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.parent.findMany({ where: { tenantId }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.course.findMany({ where: { tenantId }, select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.examination.findMany({ where: { tenantId }, select: { id: true, name: true, examType: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.studentEnrollment.findMany({ where: { tenantId }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.attendance.findMany({ where: { tenantId }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.grade.findMany({ where: { tenantId }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.payment.findMany({ where: { tenantId }, select: { id: true, amount: true, paymentMethod: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
      prisma.feeStructure.findMany({ where: { tenantId }, select: { id: true, name: true, category: true, createdAt: true }, orderBy: { createdAt: "desc" }, take }),
    ]);
    const activities = [
      ...students.map(row => ({ id: row.id, type: "STUDENT_CREATED", summary: "Student profile created", createdAt: row.createdAt })),
      ...teachers.map(row => ({ id: row.id, type: "TEACHER_CREATED", summary: "Teacher profile created", createdAt: row.createdAt })),
      ...parents.map(row => ({ id: row.id, type: "PARENT_CREATED", summary: "Parent profile created", createdAt: row.createdAt })),
      ...courses.map(row => ({ id: row.id, type: "COURSE_CREATED", summary: `Course created: ${row.name}`, createdAt: row.createdAt })),
      ...examinations.map(row => ({ id: row.id, type: "EXAMINATION_CREATED", summary: `Examination created: ${row.name}`, createdAt: row.createdAt })),
      ...enrollments.map(row => ({ id: row.id, type: "ENROLLMENT_CREATED", summary: `Student enrollment created (${row.status})`, createdAt: row.createdAt })),
      ...attendanceRows.map(row => ({ id: row.id, type: "ATTENDANCE_MARKED", summary: `Attendance recorded (${row.status})`, createdAt: row.createdAt })),
      ...grades.map(row => ({ id: row.id, type: "GRADE_RECORDED", summary: "Grade recorded", createdAt: row.createdAt })),
      ...payments.map(row => ({ id: row.id, type: "PAYMENT_RECORDED", summary: `Payment recorded (${row.paymentMethod})`, amountPaise: row.amount, createdAt: row.createdAt })),
      ...feeStructures.map(row => ({ id: row.id, type: "FEE_STRUCTURE_CREATED", summary: `Fee structure created: ${row.name}`, createdAt: row.createdAt })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 20);
    return res.json({ success: true, activities, limit: 20, activityBasis: "Creation or recording timestamps stored on existing records; updates and deletions are not tracked because no audit log exists." });
  } catch (error) { return fail(res, error); }
};

module.exports = { overview, attendance, academics, fees, enrollments, recentActivity };
