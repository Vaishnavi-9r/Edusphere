const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  registerSchool
} = require("../controllers/authController");
const {
  login
} = require("../controllers/authController");

const router = express.Router();

/**
 * @openapi
 * /api/auth/register-school:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a school and its administrator
 *     description: Creates a tenant and SCHOOL_ADMIN user, then returns a one-day JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterSchoolRequest'
 *           example:
 *             schoolName: Northview School
 *             adminName: Asha Sharma
 *             email: admin@northview.edu
 *             password: StrongPassword123
 *     responses:
 *       201:
 *         description: School and administrator registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterSchoolResponse'
 *       400:
 *         description: Email already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Email already exists
 *       500:
 *         description: Unexpected server or database error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Internal Server Error
 */
router.post("/register-school", registerSchool);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log in
 *     description: Verifies an email and password and returns a one-day JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: admin@northview.edu
 *             password: StrongPassword123
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Email or password is invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Invalid Email or Password
 *       500:
 *         description: Unexpected server or database error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Internal Server Error
 */
router.post("/login", login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get the authenticated user's identity
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user claims.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, user]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   required: [id, tenantId, role]
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 5ef13f2b-3902-4de2-bd29-89af07c6e6c8
 *                     tenantId:
 *                       type: string
 *                       example: 15fdb6c5-9516-47d1-8240-56a86214e87f
 *                     role:
 *                       type: string
 *                       example: SCHOOL_ADMIN
 *             example:
 *               success: true
 *               user:
 *                 id: 5ef13f2b-3902-4de2-bd29-89af07c6e6c8
 *                 tenantId: 15fdb6c5-9516-47d1-8240-56a86214e87f
 *                 role: SCHOOL_ADMIN
 *       401:
 *         description: Missing, invalid, expired, or malformed Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.userId,
      tenantId: req.user.tenantId,
      role: req.user.role,
    },
  });
});

module.exports = router;
