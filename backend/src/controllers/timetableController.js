const prisma = require("../config/prisma");
const { getTeacherIdForUser } = require("../services/academicAccess");
const { isValidUuid } = require("../middleware/validateUuidParam");

const VALID_FIELDS = {
  timetableCreate: new Set(["courseId", "name", "academicYear", "term"]),
  timetableUpdate: new Set(["name", "term"]),
  entry: new Set(["courseId", "teacherId", "subjectId", "dayOfWeek", "startTime", "endTime", "classroom"]),
};

const validateObject = (body) => body && typeof body === "object" && !Array.isArray(body);
const validateFields = (body, allowed) => Object.keys(body).find((field) => !allowed.has(field));

const validateTimetable = (body, update = false) => {
  if (!validateObject(body)) return { error: "Request body must be a JSON object" };
  const allowed = update ? VALID_FIELDS.timetableUpdate : VALID_FIELDS.timetableCreate;
  const unknown = validateFields(body, allowed);
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  const required = update ? [] : ["courseId", "name", "academicYear", "term"];
  for (const field of required) if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
  if (update && Object.keys(body).length === 0) return { error: "At least one timetable field is required" };
  const data = {};
  for (const [field, max] of [["courseId", 36], ["name", 120], ["academicYear", 20], ["term", 50]]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== "string" || !body[field].trim()) return { error: `${field} must be a non-empty string` };
    if (body[field].trim().length > max) return { error: `${field} must be at most ${max} characters` };
    data[field] = body[field].trim();
  }
  if (data.courseId && !isValidUuid(data.courseId)) return { error: "courseId must be a valid UUID" };
  return { data };
};

const validTime = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return false;
  return true;
};
const timeSeconds = (value) => {
  const [hours, minutes, seconds = "00"] = value.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};
const toTime = (value) => new Date(`1970-01-01T${value.length === 5 ? `${value}:00` : value}.000Z`);
const timeString = (value) => value.toISOString().slice(11, 19);

const validateEntry = (body) => {
  if (!validateObject(body)) return { error: "Request body must be a JSON object" };
  const unknown = validateFields(body, VALID_FIELDS.entry);
  if (unknown) return { error: `Unsupported field: ${unknown}` };
  for (const field of ["courseId", "teacherId", "subjectId", "dayOfWeek", "startTime", "endTime"]) {
    if (!Object.hasOwn(body, field)) return { error: `${field} is required` };
  }
  for (const field of ["courseId", "teacherId", "subjectId"]) {
    if (typeof body[field] !== "string" || !body[field].trim()) return { error: `${field} must be a non-empty string` };
    if (!isValidUuid(body[field].trim())) return { error: `${field} must be a valid UUID` };
  }
  if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6) {
    return { error: "dayOfWeek must be an integer from 0 (Sunday) to 6 (Saturday)" };
  }
  if (!validTime(body.startTime) || !validTime(body.endTime)) return { error: "startTime and endTime must use HH:mm or HH:mm:ss 24-hour format" };
  if (timeSeconds(body.startTime) >= timeSeconds(body.endTime)) return { error: "startTime must be before endTime" };
  if (body.classroom !== undefined && body.classroom !== null && (typeof body.classroom !== "string" || body.classroom.trim().length > 120)) {
    return { error: "classroom must be a string of at most 120 characters or null" };
  }
  return { data: {
    courseId: body.courseId.trim(), teacherId: body.teacherId.trim(), subjectId: body.subjectId.trim(),
    dayOfWeek: body.dayOfWeek, startTime: toTime(body.startTime), endTime: toTime(body.endTime),
    classroom: body.classroom == null ? null : (body.classroom.trim() || null),
  } };
};

const serializeEntry = (entry) => ({ ...entry, startTime: timeString(entry.startTime), endTime: timeString(entry.endTime) });
const serializeTimetable = (timetable) => ({
  ...timetable,
  entries: timetable.entries?.map(serializeEntry),
});
const entryInclude = {
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, employeeId: true, user: { select: { fullName: true } } } },
};
const timetableInclude = { course: { select: { id: true, name: true, code: true, academicYear: true } } };

const isScheduleConstraintError = (error) => {
  const databaseCode = error?.meta?.code || error?.meta?.database_error_code || error?.cause?.code;
  const details = [error?.message, error?.meta?.database_error, error?.meta?.message].filter(Boolean).join(" ");
  return error?.code === "P2004" || databaseCode === "23P01" || /23P01|exclusion constraint|TimetableEntry_no_(teacher|course|classroom)_overlap/i.test(details);
};

const handleError = (res, error) => {
  // Prisma versions expose PostgreSQL exclusion failures as P2004 or include SQLSTATE 23P01.
  if (isScheduleConstraintError(error)) {
    return res.status(409).json({ success: false, message: "The timetable entry conflicts with an existing teacher, course, or classroom schedule, or violates a database constraint" });
  }
  if (error?.code === "P2002") return res.status(409).json({ success: false, message: "A timetable already exists for this course, academic year, and term" });
  if (error?.code === "P2003") return res.status(409).json({ success: false, message: "The timetable entry references an unassigned or unavailable course, subject, or teacher" });
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const teacherFilter = async (req) => {
  if (req.user.role !== "TEACHER") return {};
  const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
  return teacherId ? { entries: { some: { tenantId: req.user.tenantId, teacherId } } } : null;
};

const createTimetable = async (req, res) => {
  const { data, error } = validateTimetable(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const course = await prisma.course.findFirst({ where: { id: data.courseId, tenantId: req.user.tenantId }, select: { id: true, academicYear: true } });
    if (!course) return res.status(404).json({ success: false, message: "Course not found in this tenant" });
    if (course.academicYear !== data.academicYear) return res.status(400).json({ success: false, message: "academicYear must match the course academic year" });
    const timetable = await prisma.timetable.create({ data: { ...data, tenantId: req.user.tenantId }, include: timetableInclude });
    return res.status(201).json({ success: true, timetable: serializeTimetable(timetable) });
  } catch (error) { return handleError(res, error); }
};

const listTimetables = async (req, res) => {
  try {
    const visibility = await teacherFilter(req);
    if (!visibility) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const timetables = await prisma.timetable.findMany({
      where: { tenantId: req.user.tenantId, ...visibility }, include: timetableInclude,
      orderBy: [{ academicYear: "desc" }, { term: "asc" }, { name: "asc" }],
    });
    return res.status(200).json({ success: true, timetables: timetables.map(serializeTimetable) });
  } catch (error) { return handleError(res, error); }
};

const getTimetable = async (req, res) => {
  try {
    const visibility = await teacherFilter(req);
    if (!visibility) return res.status(404).json({ success: false, message: "Teacher profile not found" });
    const timetable = await prisma.timetable.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, ...visibility },
      include: { ...timetableInclude, entries: { where: req.user.role === "TEACHER" ? { tenantId: req.user.tenantId, teacher: { userId: req.user.userId } } : undefined, include: entryInclude, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
    });
    if (!timetable) return res.status(404).json({ success: false, message: "Timetable not found" });
    return res.status(200).json({ success: true, timetable: serializeTimetable(timetable) });
  } catch (error) { return handleError(res, error); }
};

const updateTimetable = async (req, res) => {
  const { data, error } = validateTimetable(req.body, true);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const changed = await prisma.timetable.updateMany({ where: { id: req.params.id, tenantId: req.user.tenantId }, data: { ...data, updatedAt: new Date() } });
    if (!changed.count) return res.status(404).json({ success: false, message: "Timetable not found" });
    const timetable = await prisma.timetable.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, include: timetableInclude });
    return res.status(200).json({ success: true, timetable: serializeTimetable(timetable) });
  } catch (error) { return handleError(res, error); }
};

const deleteTimetable = async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const timetable = await tx.timetable.findFirst({ where: { id: req.params.id, tenantId: req.user.tenantId }, select: { id: true } });
      if (!timetable) return { missing: true };
      await tx.timetableEntry.deleteMany({ where: { timetableId: timetable.id, tenantId: req.user.tenantId } });
      await tx.timetable.deleteMany({ where: { id: timetable.id, tenantId: req.user.tenantId } });
      return { deleted: true };
    });
    if (result.missing) return res.status(404).json({ success: false, message: "Timetable not found" });
    return res.status(200).json({ success: true, message: "Timetable and its entries deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

const ensureTimetable = (tenantId, timetableId) => prisma.timetable.findFirst({
  where: { id: timetableId, tenantId }, select: { id: true, courseId: true, academicYear: true, term: true },
});

const validateAssignments = async (tx, tenantId, timetable, data) => {
  if (timetable.courseId !== data.courseId) return "courseId must match the timetable course";
  const [courseSubject, teacherSubject] = await Promise.all([
    tx.courseSubject.findFirst({ where: { tenantId, courseId: timetable.courseId, subjectId: data.subjectId }, select: { subjectId: true } }),
    tx.teacherSubject.findFirst({ where: { tenantId, teacherId: data.teacherId, subjectId: data.subjectId }, select: { teacherId: true } }),
  ]);
  if (!courseSubject) return "Subject is not assigned to this course";
  if (!teacherSubject) return "Teacher is not assigned to this subject";
  return null;
};

const createEntry = async (req, res) => {
  const { data, error } = validateEntry(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const timetable = await ensureTimetable(req.user.tenantId, req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: "Timetable not found" });
    const assignmentError = await validateAssignments(prisma, req.user.tenantId, timetable, data);
    if (assignmentError) return res.status(400).json({ success: false, message: assignmentError });
    const entry = await prisma.timetableEntry.create({
      data: { ...data, tenantId: req.user.tenantId, timetableId: timetable.id, academicYear: timetable.academicYear, term: timetable.term }, include: entryInclude,
    });
    return res.status(201).json({ success: true, entry: serializeEntry(entry) });
  } catch (error) { return handleError(res, error); }
};

const updateEntry = async (req, res) => {
  const { data, error } = validateEntry(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const timetable = await ensureTimetable(req.user.tenantId, req.params.id);
    if (!timetable) return res.status(404).json({ success: false, message: "Timetable not found" });
    const existing = await prisma.timetableEntry.findFirst({ where: { id: req.params.entryId, timetableId: timetable.id, tenantId: req.user.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Timetable entry not found" });
    const assignmentError = await validateAssignments(prisma, req.user.tenantId, timetable, data);
    if (assignmentError) return res.status(400).json({ success: false, message: assignmentError });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.timetableEntry.updateMany({
        where: { id: existing.id, timetableId: timetable.id, tenantId: req.user.tenantId },
        data: { ...data, updatedAt: new Date() },
      });
      return tx.timetableEntry.findFirst({ where: { id: existing.id, timetableId: timetable.id, tenantId: req.user.tenantId }, include: entryInclude });
    });
    if (!updated) return res.status(404).json({ success: false, message: "Timetable entry not found" });
    return res.status(200).json({ success: true, entry: serializeEntry(updated) });
  } catch (error) { return handleError(res, error); }
};

const deleteEntry = async (req, res) => {
  try {
    const result = await prisma.timetableEntry.deleteMany({ where: { id: req.params.entryId, timetableId: req.params.id, tenantId: req.user.tenantId } });
    if (!result.count) return res.status(404).json({ success: false, message: "Timetable entry not found" });
    return res.status(200).json({ success: true, message: "Timetable entry deleted successfully" });
  } catch (error) { return handleError(res, error); }
};

module.exports = { createTimetable, listTimetables, getTimetable, updateTimetable, deleteTimetable, createEntry, updateEntry, deleteEntry };
