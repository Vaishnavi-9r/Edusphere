const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/test/admin:
 *   get:
 *     tags:
 *       - Authorization Tests
 *     summary: Test ADMIN role access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Caller has the ADMIN role.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Admin access granted
 *       401:
 *         description: Missing, invalid, expired, or malformed Bearer token.
 *       403:
 *         description: Authenticated caller does not have the ADMIN role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 'Forbidden: insufficient role'
 */
router.get("/admin", authMiddleware, roleMiddleware("ADMIN"), (req, res) => {
  res.json({ success: true, message: "Admin access granted" });
});

/**
 * @openapi
 * /api/test/teacher:
 *   get:
 *     tags:
 *       - Authorization Tests
 *     summary: Test TEACHER role access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Caller has the TEACHER role.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Teacher access granted
 *       401:
 *         description: Missing, invalid, expired, or malformed Bearer token.
 *       403:
 *         description: Authenticated caller does not have the TEACHER role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 'Forbidden: insufficient role'
 */
router.get("/teacher", authMiddleware, roleMiddleware("TEACHER"), (req, res) => {
  res.json({ success: true, message: "Teacher access granted" });
});

module.exports = router;
