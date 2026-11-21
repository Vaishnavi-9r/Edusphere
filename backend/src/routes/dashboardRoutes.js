const express = require("express");
const auth = require("../middleware/authMiddleware");
const roles = require("../middleware/roleMiddleware");
const controller = require("../controllers/dashboardController");

const router = express.Router();
router.use(auth, roles("SCHOOL_ADMIN", "ADMIN"));

/**
 * @openapi
 * /api/dashboard/overview:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get tenant overview counts
 *     description: Active students are distinct students with at least one ACTIVE enrollment; total parents counts parent profiles, including deactivated accounts.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tenant overview metrics., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardOverviewResponse' } } } }
 *       401: { description: Missing, invalid, expired, or inactive account JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 * /api/dashboard/attendance:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get today's tenant attendance metrics
 *     description: Today is calculated using the current UTC date. Attendance percentage follows the established rule that excludes EXCUSED records.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current-date attendance counts and percentage., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardAttendanceResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 * /api/dashboard/academics:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get examination and course performance metrics
 *     description: Average is the mean of stored grade percentages. Pass/fail compares marksObtained with the examination's passingMarks.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Examination count, grade performance, pass/fail totals, and per-course results., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardAcademicsResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 * /api/dashboard/fees:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get fee collection and outstanding balances
 *     description: Monetary values are integer paise. Collection is summed from Payment.amount; outstanding balances use StudentFee amountPaid.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tenant financial totals and collection percentage., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardFeesResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 * /api/dashboard/enrollments:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get course-wise enrollment counts
 *     description: Includes active, completed, withdrawn, and total enrollments by course and academic year.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Course-level and tenant-level enrollment totals., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardEnrollmentsResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 * /api/dashboard/recent-activity:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get recent activity derived from existing records
 *     description: Returns up to 20 recent record creation/recording events. No update or delete events are inferred because the application has no audit log.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Recent tenant activity with limited non-credential details., content: { application/json: { schema: { $ref: '#/components/schemas/DashboardActivityResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: SCHOOL_ADMIN or ADMIN required. }
 *       500: { description: Analytics query failed. }
 */
router.get("/overview", controller.overview);
router.get("/attendance", controller.attendance);
router.get("/academics", controller.academics);
router.get("/fees", controller.fees);
router.get("/enrollments", controller.enrollments);
router.get("/recent-activity", controller.recentActivity);

module.exports = router;
