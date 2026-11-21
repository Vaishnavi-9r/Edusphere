const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createGrade, listGrades, getGrade, updateGrade, deleteGrade,
  listStudentGrades, listExaminationGrades, getStudentReportCard,
} = require("../controllers/gradeController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
const gradeWriters = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/grades:
 *   post:
 *     tags: [Grades]
 *     summary: Enter a student's examination marks
 *     description: SCHOOL_ADMIN, ADMIN, or a TEACHER assigned to the examination subject. maximumMarks, percentage, and grade are calculated by the server; client-supplied values for them are rejected. Default configurable grading scale is A >=90, B >=80, C >=70, D >=60, F >=0; set EDUSPHERE_GRADING_SCALE to override globally.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateGradeRequest' }
 *     responses:
 *       201: { description: Grade entered., content: { application/json: { schema: { $ref: '#/components/schemas/GradeResponse' } } } }
 *       400: { description: Invalid marks or enrollment does not match the examination. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Teacher is not assigned to the examination subject. }
 *       404: { description: Examination not found in this tenant. }
 *       409: { description: Duplicate grade record. }
 *   get:
 *     tags: [Grades]
 *     summary: List grades visible to caller
 *     description: Managers see tenant grades; teachers see grades for their assigned subjects.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Grade list., content: { application/json: { schema: { $ref: '#/components/schemas/GradeListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 */
router.post("/", gradeWriters, createGrade);
router.get("/", readers, listGrades);

/**
 * @openapi
 * /api/grades/student/{studentId}/report-card:
 *   get:
 *     tags: [Grades]
 *     summary: Get report card grouped by enrollment
 *     description: Overall percentage is total marks obtained divided by total examination maximum marks, times 100, rounded to two decimal places. Letter grade uses the configured grading scale.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Enrollment and grade summaries., content: { application/json: { schema: { $ref: '#/components/schemas/ReportCardResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Student not found in this tenant. }
 * /api/grades/student/{studentId}:
 *   get:
 *     tags: [Grades]
 *     summary: List grades for a student
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Tenant-scoped grade history., content: { application/json: { schema: { $ref: '#/components/schemas/GradeListResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Student not found in this tenant. }
 * /api/grades/examination/{examinationId}:
 *   get:
 *     tags: [Grades]
 *     summary: List grades for an examination
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: examinationId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Examination grade list., content: { application/json: { schema: { $ref: '#/components/schemas/GradeListResponse' } } } }
 *       400: { description: Invalid examination UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Examination not found or not visible to teacher. }
 */
router.get("/student/:studentId/report-card", readers, validateUuidParam("studentId"), getStudentReportCard);
router.get("/student/:studentId", readers, validateUuidParam("studentId"), listStudentGrades);
router.get("/examination/:examinationId", readers, validateUuidParam("examinationId"), listExaminationGrades);

/**
 * @openapi
 * /api/grades/{id}:
 *   get:
 *     tags: [Grades]
 *     summary: Get a grade record
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Grade details., content: { application/json: { schema: { $ref: '#/components/schemas/GradeResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Grade not found in this tenant or teacher scope. }
 *   put:
 *     tags: [Grades]
 *     summary: Update marks or remarks
 *     description: SCHOOL_ADMIN, ADMIN, or a TEACHER assigned to the examination subject. The server recalculates percentage and letter grade.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateGradeRequest' }
 *     responses:
 *       200: { description: Grade updated., content: { application/json: { schema: { $ref: '#/components/schemas/GradeResponse' } } } }
 *       400: { description: Invalid marks. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Grade not found in this tenant. }
 *   delete:
 *     tags: [Grades]
 *     summary: Delete a grade record
 *     description: SCHOOL_ADMIN and ADMIN only. Students have no write permission.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Grade deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Grade not found in this tenant. }
 */
router.get("/:id", readers, validateUuidParam("id"), getGrade);
router.put("/:id", gradeWriters, validateUuidParam("id"), updateGrade);
router.delete("/:id", managers, validateUuidParam("id"), deleteGrade);

module.exports = router;
