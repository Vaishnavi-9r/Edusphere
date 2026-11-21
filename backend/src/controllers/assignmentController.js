const prisma = require("../config/prisma");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  getTeacherIdForUser,
  getAssignedCourseIds,
} = require("../services/academicAccess");

const handleError = (res, error) => {
  if (error && error.code === "P2002") {
    return res.status(409).json({ success: false, message: "This assignment already exists" });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: "Internal Server Error" });
};

const getVisibleTeacherId = async (req) => {
  const { tenantId, userId, role } = req.user;
  if (role === "TEACHER") {
    const ownId = await getTeacherIdForUser(tenantId, userId);
    if (!ownId || ownId !== req.params.teacherId) return null;
    return ownId;
  }
  const teacher = await prisma.teacher.findFirst({
    where: { id: req.params.teacherId, tenantId },
    select: { id: true },
  });
  return teacher ? teacher.id : null;
};

const assignSubjectToTeacher = async (req, res) => {
  const { subjectId } = req.body || {};
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 || !validateUuidParam.isValidUuid(subjectId)) {
    return res.status(400).json({ success: false, message: "Request body must contain only subjectId" });
  }
  try {
    const [teacher, subject] = await Promise.all([
      prisma.teacher.findFirst({
        where: { id: req.params.teacherId, tenantId: req.user.tenantId, user: { isActive: true } },
        select: { id: true },
      }),
      prisma.subject.findFirst({
        where: { id: subjectId, tenantId: req.user.tenantId },
        select: { id: true },
      }),
    ]);
    if (!teacher || !subject) return res.status(404).json({ success: false, message: "Teacher or subject not found" });

    const assignment = await prisma.teacherSubject.create({
      data: { tenantId: req.user.tenantId, teacherId: teacher.id, subjectId: subject.id },
    });
    return res.status(201).json({ success: true, assignment });
  } catch (error) {
    return handleError(res, error);
  }
};

const removeSubjectFromTeacher = async (req, res) => {
  try {
    const result = await prisma.teacherSubject.deleteMany({
      where: {
        tenantId: req.user.tenantId,
        teacherId: req.params.teacherId,
        subjectId: req.params.subjectId,
      },
    });
    if (!result.count) return res.status(404).json({ success: false, message: "Assignment not found" });
    return res.status(200).json({ success: true, message: "Subject removed from teacher" });
  } catch (error) {
    return handleError(res, error);
  }
};

const listTeacherSubjects = async (req, res) => {
  try {
    const teacherId = await getVisibleTeacherId(req);
    if (!teacherId) return res.status(404).json({ success: false, message: "Teacher not found" });
    const assignments = await prisma.teacherSubject.findMany({
      where: { tenantId: req.user.tenantId, teacherId },
      include: { subject: true },
      orderBy: { assignedAt: "asc" },
    });
    return res.status(200).json({ success: true, subjects: assignments.map((item) => item.subject) });
  } catch (error) {
    return handleError(res, error);
  }
};

const listTeacherCourses = async (req, res) => {
  try {
    const teacherId = await getVisibleTeacherId(req);
    if (!teacherId) return res.status(404).json({ success: false, message: "Teacher not found" });
    const courseIds = await getAssignedCourseIds(req.user.tenantId, teacherId);
    const courses = await prisma.course.findMany({
      where: { tenantId: req.user.tenantId, id: { in: courseIds } },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ success: true, courses });
  } catch (error) {
    return handleError(res, error);
  }
};

const assignSubjectToCourse = async (req, res) => {
  const { subjectId } = req.body || {};
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 || !validateUuidParam.isValidUuid(subjectId)) {
    return res.status(400).json({ success: false, message: "Request body must contain only subjectId" });
  }
  try {
    const [course, subject] = await Promise.all([
      prisma.course.findFirst({ where: { id: req.params.courseId, tenantId: req.user.tenantId }, select: { id: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, tenantId: req.user.tenantId }, select: { id: true } }),
    ]);
    if (!course || !subject) return res.status(404).json({ success: false, message: "Course or subject not found" });

    const assignment = await prisma.courseSubject.create({
      data: { tenantId: req.user.tenantId, courseId: course.id, subjectId: subject.id },
    });
    return res.status(201).json({ success: true, assignment });
  } catch (error) {
    return handleError(res, error);
  }
};

const removeSubjectFromCourse = async (req, res) => {
  try {
    const result = await prisma.courseSubject.deleteMany({
      where: {
        tenantId: req.user.tenantId,
        courseId: req.params.courseId,
        subjectId: req.params.subjectId,
      },
    });
    if (!result.count) return res.status(404).json({ success: false, message: "Assignment not found" });
    return res.status(200).json({ success: true, message: "Subject removed from course" });
  } catch (error) {
    return handleError(res, error);
  }
};

const listCourseSubjects = async (req, res) => {
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.courseId, tenantId: req.user.tenantId },
      select: { id: true },
    });
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    if (req.user.role === "TEACHER") {
      const teacherId = await getTeacherIdForUser(req.user.tenantId, req.user.userId);
      const ids = teacherId && await getAssignedCourseIds(req.user.tenantId, teacherId);
      if (!ids || !ids.includes(course.id)) return res.status(404).json({ success: false, message: "Course not found" });
    }

    const assignments = await prisma.courseSubject.findMany({
      where: { tenantId: req.user.tenantId, courseId: course.id },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    });
    return res.status(200).json({ success: true, subjects: assignments.map((item) => item.subject) });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  assignSubjectToTeacher,
  removeSubjectFromTeacher,
  listTeacherSubjects,
  listTeacherCourses,
  assignSubjectToCourse,
  removeSubjectFromCourse,
  listCourseSubjects,
};
