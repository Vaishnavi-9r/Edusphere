const express = require("express");
const auth = require("../middleware/authMiddleware");
const roles = require("../middleware/roleMiddleware");
const validateUuid = require("../middleware/validateUuidParam");
const c = require("../controllers/parentPortalController");
const router = express.Router();
router.use(auth, roles("PARENT"));

/**
 * @openapi
 * /api/parent-portal/profile:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Get the authenticated parent's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Parent profile without credentials., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       401: { description: Missing, invalid, expired, or deactivated account token. }
 *       403: { description: PARENT role required. }
 *       404: { description: Parent profile not found. }
 * /api/parent-portal/students:
 *   get:
 *     tags: [Parent Portal]
 *     summary: List students linked to the authenticated parent
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Explicitly linked students only., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 * /api/parent-portal/students/{studentId}/attendance:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read linked student's attendance
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Attendance records for the linked student., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 * /api/parent-portal/students/{studentId}/grades:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read linked student's grades
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Grades with examination, course, and subject details; no staff account data., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 * /api/parent-portal/students/{studentId}/report-card:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read linked student's report card grouped by academic year
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Examination marks and enrollment weighted aggregate percentages using the configured grading scale., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 * /api/parent-portal/students/{studentId}/fees:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read linked student's fee assignments and balances
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Student fee assignments with computed outstanding amounts., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 * /api/parent-portal/students/{studentId}/payments:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read linked student's payment history
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Payment history; receiving staff credentials are omitted., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 * /api/parent-portal/students/{studentId}/timetable:
 *   get:
 *     tags: [Parent Portal]
 *     summary: Read timetable for the linked student's enrolled courses
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Timetables for the student's tenant-scoped course enrollments., content: { application/json: { schema: { $ref: '#/components/schemas/ParentPortalResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: PARENT role required. }
 *       404: { description: Student is not linked to this parent. }
 */
router.get("/profile", c.profile);
router.get("/students", c.students);
for (const [path, handler] of [["attendance", c.attendance], ["grades", c.grades], ["report-card", c.reportCard], ["fees", c.fees], ["payments", c.payments], ["timetable", c.timetable]]) {
  router.get(`/students/:studentId/${path}`, validateUuid("studentId"), handler);
}
module.exports = router;
