const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createTimetable, listTimetables, getTimetable, updateTimetable, deleteTimetable,
  createEntry, updateEntry, deleteEntry,
} = require("../controllers/timetableController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
const readers = roleMiddleware("SCHOOL_ADMIN", "ADMIN", "TEACHER");
router.use(authMiddleware);

/**
 * @openapi
 * /api/timetables:
 *   post:
 *     tags: [Timetables]
 *     summary: Create a timetable for a tenant course
 *     description: SCHOOL_ADMIN and ADMIN only. Tenant ID comes from the verified JWT; academicYear must match the course.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateTimetableRequest' }
 *     responses:
 *       201: { description: Timetable created., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableResponse' } } } }
 *       400: { description: Invalid request or academic year mismatch. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Course not found in this tenant. }
 *       409: { description: Timetable already exists for the course, year, and term. }
 *       500: { description: Unexpected database error. }
 *   get:
 *     tags: [Timetables]
 *     summary: List visible tenant timetables
 *     description: Managers see tenant timetables; teachers see timetables containing periods assigned to their teacher profile.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Timetable list., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Teacher profile not found. }
 *       500: { description: Unexpected database error. }
 */
router.post("/", managers, createTimetable);
router.get("/", readers, listTimetables);

/**
 * @openapi
 * /api/timetables/{id}:
 *   get:
 *     tags: [Timetables]
 *     summary: Get a timetable and its periods
 *     description: Teachers receive only periods assigned to them; all results are tenant-scoped.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Timetable details., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Timetable not found in this tenant or not visible to the teacher. }
 *   put:
 *     tags: [Timetables]
 *     summary: Update timetable name or term
 *     description: SCHOOL_ADMIN and ADMIN only. Academic year and course remain tied to the existing course.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateTimetableRequest' }
 *     responses:
 *       200: { description: Timetable updated., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableResponse' } } } }
 *       400: { description: Invalid request body. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Timetable not found in this tenant. }
 *       409: { description: Updated term duplicates a timetable. }
 *   delete:
 *     tags: [Timetables]
 *     summary: Delete a timetable and its periods
 *     description: SCHOOL_ADMIN and ADMIN only. Entries are explicitly deleted with the timetable in one transaction.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Timetable and entries deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Timetable not found in this tenant. }
 *       500: { description: Unexpected database error. }
 */
router.get("/:id", readers, validateUuidParam("id"), getTimetable);
router.put("/:id", managers, validateUuidParam("id"), updateTimetable);
router.delete("/:id", managers, validateUuidParam("id"), deleteTimetable);

/**
 * @openapi
 * /api/timetables/{id}/entries:
 *   post:
 *     tags: [Timetables]
 *     summary: Add a period to a timetable
 *     description: SCHOOL_ADMIN and ADMIN only. Subject/course and teacher/subject assignments must exist in this tenant. PostgreSQL exclusion constraints reject concurrent teacher, course, or classroom overlaps.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimetableEntryRequest' }
 *     responses:
 *       201: { description: Period created., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableEntryResponse' } } } }
 *       400: { description: Invalid fields, time, day, or missing assignment. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Timetable not found in this tenant. }
 *       409: { description: Teacher, course, or classroom schedule conflict. }
 *       500: { description: Unexpected database error. }
 */
router.post("/:id/entries", managers, validateUuidParam("id"), createEntry);

/**
 * @openapi
 * /api/timetables/{id}/entries/{entryId}:
 *   put:
 *     tags: [Timetables]
 *     summary: Update a timetable period
 *     description: SCHOOL_ADMIN and ADMIN only. Revalidates assignments and lets database exclusions arbitrate schedule conflicts.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: entryId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimetableEntryRequest' }
 *     responses:
 *       200: { description: Period updated., content: { application/json: { schema: { $ref: '#/components/schemas/TimetableEntryResponse' } } } }
 *       400: { description: Invalid fields, time, day, or missing assignment. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Timetable or period not found in this tenant. }
 *       409: { description: Teacher, course, or classroom schedule conflict. }
 *   delete:
 *     tags: [Timetables]
 *     summary: Delete a timetable period
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: entryId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Period deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks permission. }
 *       404: { description: Period not found in this tenant or timetable. }
 */
router.put("/:id/entries/:entryId", managers, validateUuidParam("id"), validateUuidParam("entryId"), updateEntry);
router.delete("/:id/entries/:entryId", managers, validateUuidParam("id"), validateUuidParam("entryId"), deleteEntry);

module.exports = router;
