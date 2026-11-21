const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createExamination, listExaminations, getExamination, updateExamination, deleteExamination,
  listCourseExaminations, listStudentExaminations,
} = require("../controllers/examinationController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/examinations:
 *   post:
 *     tags: [Examinations]
 *     summary: Create an examination
 *     description: SCHOOL_ADMIN and ADMIN only. Tenant comes from the verified JWT. The subject must be assigned to the course; overlapping course or subject exams and matching timetable periods are rejected.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateExaminationRequest' }
 *     responses:
 *       201: { description: Examination created., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationResponse' } } } }
 *       400: { description: Invalid fields, dates, times, marks, course, or subject assignment. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks examination management permission. }
 *       409: { description: Course, subject, or timetable schedule conflict. }
 *       500: { description: Unexpected server or database error. }
 *   get:
 *     tags: [Examinations]
 *     summary: List examinations visible to the caller
 *     description: Managers see tenant examinations; teachers see examinations for subjects assigned to their teacher profile.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Examination list., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Teacher profile not found. }
 *       500: { description: Unexpected server or database error. }
 */
router.post("/", managers, createExamination);
router.get("/", readers, listExaminations);

/**
 * @openapi
 * /api/examinations/course/{courseId}:
 *   get:
 *     tags: [Examinations]
 *     summary: List examinations for a course
 *     description: Tenant-scoped. Teachers see only exams for subjects assigned to them.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: courseId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Course examinations., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationListResponse' } } } }
 *       400: { description: Invalid course UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Course not found in this tenant. }
 *       500: { description: Unexpected server or database error. }
 */
router.get("/course/:courseId", readers, validateUuidParam("courseId"), listCourseExaminations);

/**
 * @openapi
 * /api/examinations/student/{studentId}:
 *   get:
 *     tags: [Examinations]
 *     summary: List examinations relevant to a student
 *     description: Returns tenant examinations for every course and academic year in which the student is enrolled. Teachers see only their assigned subjects.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Student examinations, or an empty list when the student has no enrollments., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationListResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Student not found in this tenant. }
 */
router.get("/student/:studentId", readers, validateUuidParam("studentId"), listStudentExaminations);

/**
 * @openapi
 * /api/examinations/{id}:
 *   get:
 *     tags: [Examinations]
 *     summary: Get examination details
 *     description: Tenant-scoped; teachers can retrieve exams only for their assigned subjects.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Examination details., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Examination not found in this tenant or visible subject scope. }
 *   put:
 *     tags: [Examinations]
 *     summary: Update examination details
 *     description: SCHOOL_ADMIN and ADMIN only; accepts a partial update and revalidates assignments, time, marks, and timetable conflicts.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateExaminationRequest' }
 *     responses:
 *       200: { description: Examination updated., content: { application/json: { schema: { $ref: '#/components/schemas/ExaminationResponse' } } } }
 *       400: { description: Invalid request fields or assignments. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Examination not found in this tenant. }
 *       409: { description: Examination or timetable schedule conflict. }
 *   delete:
 *     tags: [Examinations]
 *     summary: Delete an examination
 *     description: SCHOOL_ADMIN and ADMIN only. Deletion is rejected by database foreign keys if a future dependent grade/result record references it.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Examination deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Examination not found in this tenant. }
 *       409: { description: Examination is referenced by another record. }
 */
router.get("/:id", readers, validateUuidParam("id"), getExamination);
router.put("/:id", managers, validateUuidParam("id"), updateExamination);
router.delete("/:id", managers, validateUuidParam("id"), deleteExamination);

module.exports = router;
