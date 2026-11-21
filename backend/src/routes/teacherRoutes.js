const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createTeacher,
  listTeachers,
  getTeacher,
  updateTeacher,
  deactivateTeacher,
} = require("../controllers/teacherController");
const {
  assignSubjectToTeacher,
  removeSubjectFromTeacher,
  listTeacherSubjects,
  listTeacherCourses,
} = require("../controllers/assignmentController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const teacherReaders = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/teachers:
 *   post:
 *     tags: [Teachers]
 *     summary: Create a teacher account and profile
 *     description: Available to SCHOOL_ADMIN and ADMIN. Creates a TEACHER user, hashes the password, and creates a linked profile. Tenant ID comes from the verified JWT.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTeacherRequest'
 *     responses:
 *       201:
 *         description: Teacher account and profile created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeacherResponse'
 *       400:
 *         description: Invalid teacher data or unsupported field.
 *       401:
 *         description: Missing, invalid, expired, or inactive account token.
 *       403:
 *         description: Caller is not a SCHOOL_ADMIN or ADMIN.
 *       409:
 *         description: Email or employee ID already exists.
 *       500:
 *         description: Unexpected server or database error.
 *   get:
 *     tags: [Teachers]
 *     summary: List teachers in the authenticated school
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Teacher profiles for the authenticated tenant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeacherListResponse'
 *       401:
 *         description: Missing, invalid, expired, or inactive account token.
 *       403:
 *         description: Caller is not a SCHOOL_ADMIN or ADMIN.
 *       500:
 *         description: Unexpected server or database error.
 */
router.post("/", managers, createTeacher);
router.get("/", managers, listTeachers);

/**
 * @openapi
 * /api/teachers/{teacherId}/subjects:
 *   post:
 *     tags: [Teacher Subject Assignments]
 *     summary: Assign a subject to a teacher
 *     description: SCHOOL_ADMIN and ADMIN only. The teacher and subject must belong to the caller's tenant.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SubjectAssignmentRequest' }
 *     responses:
 *       201:
 *         description: Assignment created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AssignmentResponse' }
 *       400: { description: Invalid teacher ID or request body. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Teacher or subject not found in this tenant. }
 *       409: { description: Assignment already exists. }
 *   get:
 *     tags: [Teacher Subject Assignments]
 *     summary: List a teacher's assigned subjects
 *     description: Teachers may view their own assignments; SCHOOL_ADMIN and ADMIN may view tenant teachers.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assigned subjects.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectListResponse' }
 *       400: { description: Invalid teacher ID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks read permission. }
 *       404: { description: Teacher not found or not the current teacher. }
 */
router.post("/:teacherId/subjects", managers, validateUuidParam("teacherId"), assignSubjectToTeacher);
router.get("/:teacherId/subjects", teacherReaders, validateUuidParam("teacherId"), listTeacherSubjects);

/**
 * @openapi
 * /api/teachers/{teacherId}/subjects/{subjectId}:
 *   delete:
 *     tags: [Teacher Subject Assignments]
 *     summary: Remove a subject assignment from a teacher
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Subject assignment removed. }
 *       400: { description: Invalid identifier. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Assignment not found in this tenant. }
 */
router.delete("/:teacherId/subjects/:subjectId", managers, validateUuidParam("teacherId"), validateUuidParam("subjectId"), removeSubjectFromTeacher);

/**
 * @openapi
 * /api/teachers/{teacherId}/courses:
 *   get:
 *     tags: [Teacher Subject Assignments]
 *     summary: List courses available to a teacher through assigned subjects
 *     description: Teachers may view their own courses; SCHOOL_ADMIN and ADMIN may view courses for tenant teachers.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Tenant courses containing one or more subjects assigned to the teacher.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CourseListResponse' }
 *       400: { description: Invalid teacher ID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks read permission. }
 *       404: { description: Teacher not found or not the current teacher. }
 */
router.get("/:teacherId/courses", teacherReaders, validateUuidParam("teacherId"), listTeacherCourses);

/**
 * @openapi
 * /api/teachers/{id}:
 *   get:
 *     tags: [Teachers]
 *     summary: Get teacher details in the authenticated school
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeacherResponse'
 *       401:
 *         description: Missing, invalid, expired, or inactive account token.
 *       403:
 *         description: Caller is not a SCHOOL_ADMIN or ADMIN.
 *       404:
 *         description: Teacher not found in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 *   put:
 *     tags: [Teachers]
 *     summary: Update teacher profile or account details
 *     description: Partial updates are allowed. Password changes and tenant/role changes are not supported here.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTeacherRequest'
 *     responses:
 *       200:
 *         description: Teacher updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeacherResponse'
 *       400:
 *         description: Invalid teacher data or unsupported field.
 *       401:
 *         description: Missing, invalid, expired, or inactive account token.
 *       403:
 *         description: Caller is not a SCHOOL_ADMIN or ADMIN.
 *       404:
 *         description: Teacher not found in the authenticated tenant.
 *       409:
 *         description: Email or employee ID already exists.
 *       500:
 *         description: Unexpected server or database error.
 *   delete:
 *     tags: [Teachers]
 *     summary: Deactivate a teacher
 *     description: Soft-deactivates the linked User account. Existing attendance records and the teacher profile are preserved; login and authenticated requests are denied.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher account deactivated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeacherResponse'
 *       401:
 *         description: Missing, invalid, expired, or inactive account token.
 *       403:
 *         description: Caller is not a SCHOOL_ADMIN or ADMIN.
 *       404:
 *         description: Teacher not found in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 */
router.get("/:id", managers, validateUuidParam("id"), getTeacher);
router.put("/:id", managers, validateUuidParam("id"), updateTeacher);
router.delete("/:id", managers, validateUuidParam("id"), deactivateTeacher);

module.exports = router;
