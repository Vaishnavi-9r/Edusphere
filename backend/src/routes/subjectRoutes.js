const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createSubject,
  listSubjects,
  getSubject,
  updateSubject,
  deleteSubject,
  listSubjectTeachers,
} = require("../controllers/subjectController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/subjects:
 *   post:
 *     tags: [Subjects]
 *     summary: Create a subject
 *     description: SCHOOL_ADMIN and ADMIN only. Tenant ID is derived from the JWT.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateSubjectRequest' }
 *     responses:
 *       201:
 *         description: Subject created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectResponse' }
 *       400: { description: Invalid body or unsupported field. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       409: { description: Subject code already exists in this tenant. }
 *       500: { description: Unexpected server or database error. }
 *   get:
 *     tags: [Subjects]
 *     summary: List subjects visible to the caller
 *     description: Managers see tenant subjects; teachers see only subjects assigned to their teacher profile.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Subject list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectListResponse' }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       500: { description: Unexpected server or database error. }
 */
router.post("/", managers, createSubject);
router.get("/", readers, listSubjects);

/**
 * @openapi
 * /api/subjects/{id}/teachers:
 *   get:
 *     tags: [Subjects]
 *     summary: List teachers assigned to a subject
 *     description: SCHOOL_ADMIN and ADMIN only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assigned teacher profiles without authentication secrets.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectTeachersResponse' }
 *       400: { description: Invalid subject UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Subject not found in this tenant. }
 */
router.get("/:id/teachers", managers, validateUuidParam("id"), listSubjectTeachers);

/**
 * @openapi
 * /api/subjects/{id}:
 *   get:
 *     tags: [Subjects]
 *     summary: Get a subject
 *     description: Teachers can retrieve only their own assigned subjects.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Subject details.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectResponse' }
 *       400: { description: Invalid subject UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Subject not found or not assigned to this teacher. }
 *   put:
 *     tags: [Subjects]
 *     summary: Update a subject
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
 *           schema: { $ref: '#/components/schemas/UpdateSubjectRequest' }
 *     responses:
 *       200:
 *         description: Subject updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SubjectResponse' }
 *       400: { description: Invalid body or UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Subject not found in this tenant. }
 *       409: { description: Subject code already exists in this tenant. }
 *   delete:
 *     tags: [Subjects]
 *     summary: Delete a subject
 *     description: Deletion is rejected while teacher or course assignments exist.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Subject deleted. }
 *       400: { description: Invalid subject UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks academic management permission. }
 *       404: { description: Subject not found in this tenant. }
 *       409: { description: Remove assignments before deleting. }
 */
router.get("/:id", readers, validateUuidParam("id"), getSubject);
router.put("/:id", managers, validateUuidParam("id"), updateSubject);
router.delete("/:id", managers, validateUuidParam("id"), deleteSubject);

module.exports = router;
