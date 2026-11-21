const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");
const {
  assignSubjectToCourse,
  removeSubjectFromCourse,
  listCourseSubjects,
} = require("../controllers/assignmentController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create a course
 *     description: SCHOOL_ADMIN and ADMIN only. Tenant ID comes from the verified JWT.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateCourseRequest' }
 *     responses:
 *       201:
 *         description: Course created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CourseResponse' }
 *       400: { description: Invalid body or unsupported field. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       409: { description: Course code already exists in this tenant. }
 *       500: { description: Unexpected server or database error. }
 *   get:
 *     tags: [Courses]
 *     summary: List courses visible to the caller
 *     description: Managers see tenant courses; teachers see courses containing subjects assigned to them.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Course list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CourseListResponse' }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       500: { description: Unexpected server or database error. }
 */
router.post("/", managers, createCourse);
router.get("/", readers, listCourses);

/**
 * @openapi
 * /api/courses/{courseId}/subjects:
 *   post:
 *     tags: [Courses]
 *     summary: Assign a subject to a course
 *     description: SCHOOL_ADMIN and ADMIN only. Both records must belong to the authenticated tenant.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: courseId
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
 *       400: { description: Invalid course ID or request body. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Course or subject not found in this tenant. }
 *       409: { description: Assignment already exists. }
 *   get:
 *     tags: [Courses]
 *     summary: List subjects in a course
 *     description: Teachers can view a course only when one of their assigned subjects is included in it.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subjects assigned to the course.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectListResponse' }
 *       400: { description: Invalid course ID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Course not found or not assigned to this teacher. }
 */
router.post("/:courseId/subjects", managers, validateUuidParam("courseId"), assignSubjectToCourse);
router.get("/:courseId/subjects", readers, validateUuidParam("courseId"), listCourseSubjects);

/**
 * @openapi
 * /api/courses/{courseId}/subjects/{subjectId}:
 *   delete:
 *     tags: [Courses]
 *     summary: Remove a subject from a course
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment removed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/DeleteAcademicResponse' }
 *       400: { description: Invalid identifier. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Assignment not found in this tenant. }
 */
router.delete("/:courseId/subjects/:subjectId", managers, validateUuidParam("courseId"), validateUuidParam("subjectId"), removeSubjectFromCourse);

/**
 * @openapi
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a course
 *     description: Teachers can retrieve only courses containing a subject assigned to them.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Course details.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CourseResponse' }
 *       400: { description: Invalid course UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Course not found or not assigned to this teacher. }
 *   put:
 *     tags: [Courses]
 *     summary: Update a course
 *     description: SCHOOL_ADMIN and ADMIN only; partial updates are supported.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateCourseRequest' }
 *     responses:
 *       200:
 *         description: Course updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CourseResponse' }
 *       400: { description: Invalid body or UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Course not found in this tenant. }
 *       409: { description: Course code already exists in this tenant. }
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course
 *     description: Deletion is rejected while subject assignments exist.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Course deleted.
 *       400: { description: Invalid course UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Course not found in this tenant. }
 *       409: { description: Remove subject assignments before deleting. }
 */
router.get("/:id", readers, validateUuidParam("id"), getCourse);
router.put("/:id", managers, validateUuidParam("id"), updateCourse);
router.delete("/:id", managers, validateUuidParam("id"), deleteCourse);

module.exports = router;
