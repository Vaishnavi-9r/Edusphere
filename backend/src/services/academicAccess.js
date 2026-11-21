const prisma = require("../config/prisma");

const getTeacherIdForUser = async (tenantId, userId) => {
  const teacher = await prisma.teacher.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
  return teacher ? teacher.id : null;
};

const getAssignedSubjectIds = async (tenantId, teacherId) => {
  const assignments = await prisma.teacherSubject.findMany({
    where: { tenantId, teacherId },
    select: { subjectId: true },
  });
  return assignments.map((assignment) => assignment.subjectId);
};

const getAssignedCourseIds = async (tenantId, teacherId) => {
  const subjectIds = await getAssignedSubjectIds(tenantId, teacherId);
  if (subjectIds.length === 0) return [];

  const assignments = await prisma.courseSubject.findMany({
    where: { tenantId, subjectId: { in: subjectIds } },
    select: { courseId: true },
  });
  return [...new Set(assignments.map((assignment) => assignment.courseId))];
};

module.exports = { getTeacherIdForUser, getAssignedSubjectIds, getAssignedCourseIds };
