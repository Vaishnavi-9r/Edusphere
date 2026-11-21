const express = require("express");
const auth = require("../middleware/authMiddleware");
const roles = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentPortalController");

const router = express.Router();
router.use(auth, roles("STUDENT"));

/**
 * @openapi
 * /api/student-portal/profile:
 *   get:
 *     tags: [Student Portal]
 *     summary: Get the authenticated student's own profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Student and safe login identity details., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing, invalid, expired, or deactivated account token. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/attendance:
 *   get:
 *     tags: [Student Portal]
 *     summary: Get the authenticated student's attendance history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Attendance records for this student only., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/attendance/summary:
 *   get:
 *     tags: [Student Portal]
 *     summary: Get attendance counts and percentage
 *     description: Percentage is (PRESENT + LATE) / (total - EXCUSED) * 100; EXCUSED records are excluded.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Attendance totals and percentage., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/examinations:
 *   get:
 *     tags: [Student Portal]
 *     summary: List examinations for the student's enrolled courses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tenant-scoped examinations matching this student's course enrollments., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/grades:
 *   get:
 *     tags: [Student Portal]
 *     summary: List the authenticated student's grades
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Grades with examination details; staff account information is omitted., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/report-card:
 *   get:
 *     tags: [Student Portal]
 *     summary: Get the student's report card grouped by enrollment
 *     description: Uses the configured EDUSPHERE_GRADING_SCALE and existing enrollment-weighted calculation.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Enrollment report cards and aggregate grades., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/timetable:
 *   get:
 *     tags: [Student Portal]
 *     summary: Get timetable for the student's enrolled courses
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Schedules for tenant-scoped course and academic-year enrollments., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/courses:
 *   get:
 *     tags: [Student Portal]
 *     summary: List the student's course enrollments
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Enrollment status and course details., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/fees:
 *   get:
 *     tags: [Student Portal]
 *     summary: List the student's fee assignments and outstanding balances
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fee assignments with backend-calculated balances and statuses., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 * /api/student-portal/payments:
 *   get:
 *     tags: [Student Portal]
 *     summary: List payments recorded against the student's fees
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Payment history without receiving staff account information., content: { application/json: { schema: { $ref: '#/components/schemas/StudentPortalResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: STUDENT role required. }
 *       404: { description: Student profile is not linked to this account. }
 */
router.get("/profile", controller.profile);
router.get("/attendance", controller.attendance);
router.get("/attendance/summary", controller.attendanceSummary);
router.get("/examinations", controller.examinations);
router.get("/grades", controller.grades);
router.get("/report-card", controller.reportCard);
router.get("/timetable", controller.timetable);
router.get("/courses", controller.courses);
router.get("/fees", controller.fees);
router.get("/payments", controller.payments);

module.exports = router;
