const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createEnrollment, listEnrollments, getEnrollment, updateEnrollment, deleteEnrollment,
  listStudentEnrollments, listCourseEnrollments,
} = require("../controllers/enrollmentController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Enroll a student in a course
 *     description: SCHOOL_ADMIN and ADMIN only. Tenant is taken from the verified JWT; course year must match academicYear.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateEnrollmentRequest' }
 *     responses:
 *       201: { description: Enrollment created., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentResponse' } } } }
 *       400: { description: Invalid request fields. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Student or course not found in this tenant. }
 *       409: { description: Duplicate enrollment. }
 *   get:
 *     tags: [Enrollments]
 *     summary: List enrollments visible to caller
 *     description: Managers see all tenant enrollments; teachers see enrollments for their assigned courses.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Enrollment list., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 */
router.post("/", managers, createEnrollment);
router.get("/", readers, listEnrollments);

/**
 * @openapi
 * /api/enrollments/student/{studentId}:
 *   get:
 *     tags: [Enrollments]
 *     summary: List a student's enrollments
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Tenant-scoped enrollment history., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentListResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Student not found in this tenant. }
 * /api/enrollments/course/{courseId}:
 *   get:
 *     tags: [Enrollments]
 *     summary: List students enrolled in a course
 *     description: Teachers may see enrollments only in courses linked to their subject assignments.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Course enrollment list., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentListResponse' } } } }
 *       400: { description: Invalid course UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Course not found or not visible to this teacher. }
 */
router.get("/student/:studentId", readers, validateUuidParam("studentId"), listStudentEnrollments);
router.get("/course/:courseId", readers, validateUuidParam("courseId"), listCourseEnrollments);

/**
 * @openapi
 * /api/enrollments/{id}:
 *   get:
 *     tags: [Enrollments]
 *     summary: Get an enrollment
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Enrollment details., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Enrollment not found in this tenant or teacher scope. }
 *   put:
 *     tags: [Enrollments]
 *     summary: Update enrollment status or date
 *     description: SCHOOL_ADMIN and ADMIN only. Student, course, and year are immutable after enrollment.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateEnrollmentRequest' }
 *     responses:
 *       200: { description: Enrollment updated., content: { application/json: { schema: { $ref: '#/components/schemas/EnrollmentResponse' } } } }
 *       400: { description: Invalid request. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Enrollment not found in this tenant. }
 *   delete:
 *     tags: [Enrollments]
 *     summary: Delete an enrollment
 *     description: Deletion is restricted while grades reference the enrollment.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Enrollment deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Enrollment not found in this tenant. }
 *       409: { description: Enrollment is referenced by grades. }
 */
router.get("/:id", readers, validateUuidParam("id"), getEnrollment);
router.put("/:id", managers, validateUuidParam("id"), updateEnrollment);
router.delete("/:id", managers, validateUuidParam("id"), deleteEnrollment);

module.exports = router;
