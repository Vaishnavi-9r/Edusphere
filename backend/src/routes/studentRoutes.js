const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const { createStudentAccount, deactivateStudentAccount } = require("../controllers/studentAccountController");
const {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
} = require("../controllers/studentController");

const router = express.Router();
router.use(authMiddleware);
const studentStaff = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");

/**
 * @openapi
 * /api/students/{id}/account:
 *   post:
 *     tags: [Student Accounts]
 *     summary: Create and link a STUDENT login account
 *     description: SCHOOL_ADMIN or ADMIN only. The account name is taken from the tenant-scoped student profile. The response never contains a password hash.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StudentAccountCreateRequest' }
 *     responses:
 *       201: { description: Student account created and linked., content: { application/json: { schema: { $ref: '#/components/schemas/StudentAccountResponse' } } } }
 *       400: { description: Invalid request fields or password. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Student not found in tenant. }
 *       409: { description: Student already linked or email already registered. }
 *   delete:
 *     tags: [Student Accounts]
 *     summary: Deactivate a student's login account
 *     description: Keeps the student profile and account link. Auth middleware checks account activity on every request, revoking existing tokens immediately.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Account deactivated. }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Student or linked account not found. }
 */
router.post("/:id/account", roleMiddleware("SCHOOL_ADMIN", "ADMIN"), validateUuidParam("id"), createStudentAccount);
router.delete("/:id/account", roleMiddleware("SCHOOL_ADMIN", "ADMIN"), validateUuidParam("id"), deactivateStudentAccount);

/**
 * @openapi
 * /api/students:
 *   post:
 *     tags: [Students]
 *     summary: Create a student in the authenticated user's school
 *     description: tenantId is derived from the verified JWT and must not be supplied in the request body.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStudentRequest'
 *           example:
 *             name: Ravi Kumar
 *             rollNumber: 2026-001
 *             grade: Grade 8
 *     responses:
 *       201:
 *         description: Student created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentResponse'
 *       400:
 *         description: Invalid request data or unsupported field.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *       409:
 *         description: Roll number already exists in this school.
 *       500:
 *         description: Unexpected server or database error.
 */
router.post("/", studentStaff, createStudent);

/**
 * @openapi
 * /api/students:
 *   get:
 *     tags: [Students]
 *     summary: List students in the authenticated user's school
 *     description: Any tenantId query parameter is ignored; the tenant comes from the verified JWT.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Students belonging to the authenticated tenant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentListResponse'
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *       500:
 *         description: Unexpected server or database error.
 */
router.get("/", studentStaff, listStudents);

/**
 * @openapi
 * /api/students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get a student in the authenticated user's school
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
 *         description: Student found in the authenticated tenant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentResponse'
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *       404:
 *         description: Student not found in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 *   put:
 *     tags: [Students]
 *     summary: Update a student in the authenticated user's school
 *     description: Partial updates are allowed. tenantId is not an accepted field.
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
 *             $ref: '#/components/schemas/UpdateStudentRequest'
 *     responses:
 *       200:
 *         description: Student updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentResponse'
 *       400:
 *         description: Invalid request data or unsupported field.
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *       404:
 *         description: Student not found in the authenticated tenant.
 *       409:
 *         description: Roll number already exists in this school.
 *       500:
 *         description: Unexpected server or database error.
 *   delete:
 *     tags: [Students]
 *     summary: Delete a student in the authenticated user's school
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
 *         description: Student deleted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteStudentResponse'
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *       404:
 *         description: Student not found in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 */
router.get("/:id", studentStaff, getStudent);
router.put("/:id", studentStaff, updateStudent);
router.delete("/:id", studentStaff, deleteStudent);

module.exports = router;
