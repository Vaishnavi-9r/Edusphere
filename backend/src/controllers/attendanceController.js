const prisma = require("../config/prisma");

const VALID_STATUSES = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const MAX_BULK_RECORDS = 500;

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const toDatabaseDate = (value) => new Date(`${value}T00:00:00.000Z`);

const validateRemarks = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.length <= 1000);

const validateRecord = (body, { update = false } = {}) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }

  const allowed = update ? new Set(["status", "remarks"]) : new Set(["studentId", "date", "status", "remarks"]);
  const unsupported = Object.keys(body).find((key) => !allowed.has(key));
  if (unsupported) return { error: `Unsupported field: ${unsupported}` };

  if (update) {
    if (!Object.hasOwn(body, "status") && !Object.hasOwn(body, "remarks")) {
      return { error: "At least one of status or remarks is required" };
    }
  } else {
    for (const field of ["studentId", "date", "status"]) {
      if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
    }
    if (typeof body.studentId !== "string" || !body.studentId.trim()) {
      return { error: "studentId must be a non-empty string" };
    }
    if (!isValidDate(body.date)) return { error: "date must be a valid YYYY-MM-DD date" };
  }

  if (Object.hasOwn(body, "status") && !VALID_STATUSES.has(body.status)) {
    return { error: "status must be PRESENT, ABSENT, LATE, or EXCUSED" };
  }
  if (!validateRemarks(body.remarks)) {
    return { error: "remarks must be a string of at most 1000 characters or null" };
  }

  const data = {};
  if (Object.hasOwn(body, "studentId")) data.studentId = body.studentId.trim();
  if (Object.hasOwn(body, "status")) data.status = body.status;
  if (Object.hasOwn(body, "remarks")) data.remarks = body.remarks === undefined ? undefined : body.remarks;
  if (Object.hasOwn(body, "date")) data.date = toDatabaseDate(body.date);
  return { data };
};

const ensureStudent = async (db, studentId, tenantId) => db.student.findFirst({
  where: { id: studentId, tenantId },
  select: { id: true },
});

const ensureMarker = async (db, userId, tenantId) => db.user.findFirst({
  where: { id: userId, tenantId },
  select: { id: true },
});

const errorResponse = (res, error) => {
  if (error && (error.code === "P2002" || error.code === "ATTENDANCE_DUPLICATE")) {
    return res.status(409).json({
      success: false,
      message: "Attendance has already been recorded for this student and date",
    });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const markAttendance = async (req, res) => {
  const { data, error } = validateRecord(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const [student, marker] = await Promise.all([
      ensureStudent(prisma, data.studentId, req.user.tenantId),
      ensureMarker(prisma, req.user.userId, req.user.tenantId),
    ]);
    if (!student || !marker) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const attendance = await prisma.attendance.create({
      data: {
        tenantId: req.user.tenantId,
        studentId: data.studentId,
        date: data.date,
        status: data.status,
        ...(Object.hasOwn(data, "remarks") ? { remarks: data.remarks } : {}),
        markedById: req.user.userId,
      },
      include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } },
    });
    return res.status(201).json({ success: true, attendance });
  } catch (error) {
    return errorResponse(res, error);
  }
};

const markAttendanceBulk = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ success: false, message: "Request body must be a JSON object" });
  }
  const unsupported = Object.keys(body).find((key) => !["date", "records"].includes(key));
  if (unsupported) return res.status(400).json({ success: false, message: `Unsupported field: ${unsupported}` });
  if (!isValidDate(body.date)) {
    return res.status(400).json({ success: false, message: "date must be a valid YYYY-MM-DD date" });
  }
  if (!Array.isArray(body.records) || body.records.length === 0 || body.records.length > MAX_BULK_RECORDS) {
    return res.status(400).json({
      success: false,
      message: `records must contain between 1 and ${MAX_BULK_RECORDS} attendance entries`,
    });
  }

  const records = [];
  const studentIds = new Set();
  for (const record of body.records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return res.status(400).json({ success: false, message: "Each record must be an object" });
    }
    const unsupportedRecordField = Object.keys(record).find(
      (field) => !["studentId", "status", "remarks"].includes(field),
    );
    if (unsupportedRecordField) {
      return res.status(400).json({ success: false, message: `Unsupported record field: ${unsupportedRecordField}` });
    }
    const recordBody = { ...record, date: body.date };
    const validated = validateRecord(recordBody);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    if (studentIds.has(validated.data.studentId)) {
      return res.status(400).json({ success: false, message: "Each student may appear only once in a bulk request" });
    }
    studentIds.add(validated.data.studentId);
    records.push(validated.data);
  }

  try {
    const attendance = await prisma.$transaction(async (tx) => {
      const [students, marker] = await Promise.all([
        tx.student.findMany({
          where: { id: { in: [...studentIds] }, tenantId: req.user.tenantId },
          select: { id: true },
        }),
        ensureMarker(tx, req.user.userId, req.user.tenantId),
      ]);
      if (students.length !== studentIds.size || !marker) {
        const missing = new Error("Student not found");
        missing.code = "STUDENT_NOT_FOUND";
        throw missing;
      }

      const date = toDatabaseDate(body.date);
      const alreadyMarked = await tx.attendance.findFirst({
        where: {
          tenantId: req.user.tenantId,
          date,
          studentId: { in: [...studentIds] },
        },
        select: { id: true },
      });
      if (alreadyMarked) {
        const duplicate = new Error("Attendance already exists");
        duplicate.code = "ATTENDANCE_DUPLICATE";
        throw duplicate;
      }

      await tx.attendance.createMany({
        data: records.map((record) => ({
          tenantId: req.user.tenantId,
          studentId: record.studentId,
          date,
          status: record.status,
          ...(Object.hasOwn(record, "remarks") ? { remarks: record.remarks } : {}),
          markedById: req.user.userId,
        })),
      });

      return tx.attendance.findMany({
        where: {
          tenantId: req.user.tenantId,
          date,
          studentId: { in: [...studentIds] },
        },
        include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } },
        orderBy: { studentId: "asc" },
      });
    });

    return res.status(201).json({ success: true, count: attendance.length, attendance });
  } catch (error) {
    if (error && error.code === "STUDENT_NOT_FOUND") {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    return errorResponse(res, error);
  }
};

const getDailyAttendance = async (req, res) => {
  const { date } = req.query;
  if (!isValidDate(date)) {
    return res.status(400).json({ success: false, message: "date query parameter must be a valid YYYY-MM-DD date" });
  }

  try {
    const attendance = await prisma.attendance.findMany({
      where: { tenantId: req.user.tenantId, date: toDatabaseDate(date) },
      include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } },
      orderBy: { studentId: "asc" },
    });
    return res.status(200).json({ success: true, date, count: attendance.length, attendance });
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getStudentAttendance = async (req, res) => {
  try {
    const student = await ensureStudent(prisma, req.params.studentId, req.user.tenantId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const attendance = await prisma.attendance.findMany({
      where: { tenantId: req.user.tenantId, studentId: req.params.studentId },
      orderBy: { date: "desc" },
      include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } },
    });
    return res.status(200).json({ success: true, studentId: req.params.studentId, attendance });
  } catch (error) {
    return errorResponse(res, error);
  }
};

const updateAttendance = async (req, res) => {
  const { data, error } = validateRecord(req.body, { update: true });
  if (error) return res.status(400).json({ success: false, message: error });

  try {
    const result = await prisma.attendance.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: { ...data, updatedAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ success: false, message: "Attendance record not found" });

    const attendance = await prisma.attendance.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { student: { select: { id: true, name: true, rollNumber: true, grade: true } } },
    });
    if (!attendance) return res.status(404).json({ success: false, message: "Attendance record not found" });
    return res.status(200).json({ success: true, attendance });
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getStudentAttendanceSummary = async (req, res) => {
  try {
    const student = await ensureStudent(prisma, req.params.studentId, req.user.tenantId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const grouped = await prisma.attendance.groupBy({
      by: ["status"],
      where: { tenantId: req.user.tenantId, studentId: req.params.studentId },
      _count: { _all: true },
    });
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of grouped) counts[row.status] = row._count._all;

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const attended = counts.PRESENT + counts.LATE;
    const eligible = total - counts.EXCUSED;
    const percentage = eligible === 0 ? 0 : Math.round((attended / eligible) * 10000) / 100;

    return res.status(200).json({
      success: true,
      studentId: req.params.studentId,
      total,
      counts,
      attendancePercentage: percentage,
      percentageRule: "(PRESENT + LATE) / (total - EXCUSED) * 100; EXCUSED records are excluded",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports = {
  markAttendance,
  markAttendanceBulk,
  getDailyAttendance,
  getStudentAttendance,
  updateAttendance,
  getStudentAttendanceSummary,
};
