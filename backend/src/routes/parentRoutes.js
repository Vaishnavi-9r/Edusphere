const express = require("express");
const auth = require("../middleware/authMiddleware");
const roles = require("../middleware/roleMiddleware");
const validateUuid = require("../middleware/validateUuidParam");
const c = require("../controllers/parentController");
const router = express.Router();
router.use(auth, roles("SCHOOL_ADMIN", "ADMIN"));

/**
 * @openapi
 * /api/parents:
 *   post:
 *     tags: [Parents]
 *     summary: Create a parent login and profile
 *     description: SCHOOL_ADMIN or ADMIN. Creates a PARENT User with bcrypt password hash and a profile in the authenticated tenant. tenantId is never accepted from the client.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateParentRequest' }
 *     responses:
 *       201: { description: Parent created, content: { application/json: { schema: { $ref: '#/components/schemas/ParentResponse' } } } }
 *       400: { description: Invalid fields or password. }
 *       401: { description: Missing, invalid, expired, or inactive account token. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       409: { description: Email already exists. }
 *       500: { description: Database error. }
 *   get:
 *     tags: [Parents]
 *     summary: List parent profiles in the authenticated tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Parent profiles with linked student summaries., content: { application/json: { schema: { $ref: '#/components/schemas/ParentListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 */
router.post("/", c.createParent);
router.get("/", c.listParents);
/**
 * @openapi
 * /api/parents/{id}:
 *   get:
 *     tags: [Parents]
 *     summary: Get a parent profile
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Parent details and linked student summaries., content: { application/json: { schema: { $ref: '#/components/schemas/ParentResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Parent not found in tenant. }
 *   put:
 *     tags: [Parents]
 *     summary: Update parent details
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateParentRequest' }
 *     responses:
 *       200: { description: Updated parent profile., content: { application/json: { schema: { $ref: '#/components/schemas/ParentResponse' } } } }
 *       400: { description: Invalid fields or UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Parent not found in tenant. }
 *       409: { description: Email already exists. }
 *   delete:
 *     tags: [Parents]
 *     summary: Deactivate a parent account
 *     description: Preserves the profile and links; authentication rejects the account immediately after deactivation.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Parent account deactivated., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteAcademicResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Parent not found in tenant. }
 */
router.get("/:id", validateUuid("id"), c.getParent);
router.put("/:id", validateUuid("id"), c.updateParent);
router.delete("/:id", validateUuid("id"), c.deactivateParent);
/**
 * @openapi
 * /api/parents/{id}/students:
 *   post:
 *     tags: [Parents]
 *     summary: Link a student to a parent
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ParentStudentLinkRequest' }
 *     responses:
 *       201: { description: Parent-student relationship created., content: { application/json: { schema: { $ref: '#/components/schemas/ParentRelationshipResponse' } } } }
 *       400: { description: Invalid relationship or UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Parent or student not found in tenant. }
 *       409: { description: Link already exists. }
 *   get:
 *     tags: [Parents]
 *     summary: List a parent's linked students
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Linked student summaries., content: { application/json: { schema: { $ref: '#/components/schemas/ParentStudentListResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Parent not found in tenant. }
 * /api/parents/{id}/students/{studentId}:
 *   delete:
 *     tags: [Parents]
 *     summary: Unlink a student from a parent
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: studentId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Relationship removed., content: { application/json: { schema: { $ref: '#/components/schemas/DeleteAcademicResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       404: { description: Relationship not found in tenant. }
 */
router.post("/:id/students", validateUuid("id"), c.linkStudent);
router.get("/:id/students", validateUuid("id"), c.listLinkedStudents);
router.delete("/:id/students/:studentId", validateUuid("id"), validateUuid("studentId"), c.unlinkStudent);
module.exports = router;
