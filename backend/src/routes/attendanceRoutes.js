const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  markAttendance,
  markAttendanceBulk,
  getDailyAttendance,
  getStudentAttendance,
  updateAttendance,
  getStudentAttendanceSummary,
} = require("../controllers/attendanceController");

const router = express.Router();
const attendanceReaders = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
const attendanceMarkers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
const attendanceEditors = roleMiddleware("SCHOOL_ADMIN", "ADMIN");

router.use(authMiddleware);

/**
 * @openapi
 * /api/attendance:
 *   post:
 *     tags: [Attendance]
 *     summary: Mark attendance for one student
 *     description: Available to SCHOOL_ADMIN, ADMIN, and TEACHER. tenantId and markedById come from the verified JWT.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkAttendanceRequest'
 *     responses:
 *       201:
 *         description: Attendance recorded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceResponse'
 *       400:
 *         description: Invalid date, status, remarks, or request fields.
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to mark attendance.
 *       404:
 *         description: Student does not exist in the authenticated tenant.
 *       409:
 *         description: Attendance already exists for this student and date.
 *       500:
 *         description: Unexpected server or database error.
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance for a date
 *     description: Returns records only for the authenticated tenant. Requires date in YYYY-MM-DD format.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-11-21
 *     responses:
 *       200:
 *         description: Daily attendance records.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceListResponse'
 *       400:
 *         description: Missing or invalid date.
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to view attendance.
 *       500:
 *         description: Unexpected server or database error.
 */
router.post("/", attendanceMarkers, markAttendance);
router.get("/", attendanceReaders, getDailyAttendance);

/**
 * @openapi
 * /api/attendance/bulk:
 *   post:
 *     tags: [Attendance]
 *     summary: Mark attendance for multiple students
 *     description: The operation is transactional. Requires SCHOOL_ADMIN, ADMIN, or TEACHER. The date is shared by all records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkAttendanceRequest'
 *           example:
 *             date: 2026-11-21
 *             records:
 *               - studentId: 5ef13f2b-3902-4de2-bd29-89af07c6e6c8
 *                 status: PRESENT
 *               - studentId: 15fdb6c5-9516-47d1-8240-56a86214e87f
 *                 status: ABSENT
 *     responses:
 *       201:
 *         description: All attendance records were created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkAttendanceResponse'
 *       400:
 *         description: Invalid date, records, statuses, or duplicate student IDs in the request.
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to mark attendance.
 *       404:
 *         description: One or more students do not exist in the authenticated tenant.
 *       409:
 *         description: Attendance already exists for a student and date.
 *       500:
 *         description: Unexpected server or database error.
 */
router.post("/bulk", attendanceMarkers, markAttendanceBulk);

/**
 * @openapi
 * /api/attendance/student/{studentId}/summary:
 *   get:
 *     tags: [Attendance]
 *     summary: Get a student's attendance summary
 *     description: All-time percentage counts PRESENT and LATE as attended and excludes EXCUSED records from the denominator.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance counts and percentage.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceSummaryResponse'
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to view attendance.
 *       404:
 *         description: Student does not exist in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 * /api/attendance/student/{studentId}:
 *   get:
 *     tags: [Attendance]
 *     summary: Get a student's attendance history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance history for the student in the authenticated tenant.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceListResponse'
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to view attendance.
 *       404:
 *         description: Student does not exist in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 */
router.get("/student/:studentId/summary", attendanceReaders, getStudentAttendanceSummary);
router.get("/student/:studentId", attendanceReaders, getStudentAttendance);

/**
 * @openapi
 * /api/attendance/{id}:
 *   put:
 *     tags: [Attendance]
 *     summary: Update an attendance record
 *     description: Only SCHOOL_ADMIN and ADMIN may edit an existing record. Student, tenant, date, and marker cannot be changed.
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
 *             $ref: '#/components/schemas/UpdateAttendanceRequest'
 *     responses:
 *       200:
 *         description: Attendance record updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceResponse'
 *       400:
 *         description: Invalid status, remarks, or request fields.
 *       401:
 *         description: Missing, invalid, or expired JWT.
 *       403:
 *         description: Role is not permitted to edit attendance.
 *       404:
 *         description: Attendance record does not exist in the authenticated tenant.
 *       500:
 *         description: Unexpected server or database error.
 */
router.put("/:id", attendanceEditors, updateAttendance);

module.exports = router;
