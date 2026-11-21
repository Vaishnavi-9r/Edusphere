const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  createFeeStructure, listFeeStructures, getFeeStructure, updateFeeStructure, deleteFeeStructure,
} = require("../controllers/feeStructureController");
const { assignStudentFee, getStudentFee, getStudentFees, getStudentFeeSummary } = require("../controllers/studentFeeController");
const { recordPayment, getPayment, getStudentPayments, getFeePayments, getCollectionReport } = require("../controllers/paymentController");

const router = express.Router();
const managers = roleMiddleware("SCHOOL_ADMIN", "ADMIN");
router.use(authMiddleware, managers);

/**
 * @openapi
 * /api/fees/structures:
 *   post:
 *     tags: [Fees]
 *     summary: Create a fee structure
 *     description: SCHOOL_ADMIN and ADMIN only. Amount is a positive integer count of paise. Optional courseId must belong to the tenant and academic year.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateFeeStructureRequest' }
 *     responses:
 *       201: { description: Fee structure created., content: { application/json: { schema: { $ref: '#/components/schemas/FeeStructureResponse' } } } }
 *       400: { description: Invalid request data. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance management permission. }
 *       404: { description: Course not found in this tenant and academic year. }
 *   get:
 *     tags: [Fees]
 *     summary: List fee structures for this tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tenant fee structures., content: { application/json: { schema: { $ref: '#/components/schemas/FeeStructureListResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 */
router.post("/structures", createFeeStructure);
router.get("/structures", listFeeStructures);

/**
 * @openapi
 * /api/fees/structures/{id}:
 *   get:
 *     tags: [Fees]
 *     summary: Get a fee structure
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Fee structure., content: { application/json: { schema: { $ref: '#/components/schemas/FeeStructureResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Fee structure not found in this tenant. }
 *   put:
 *     tags: [Fees]
 *     summary: Update a fee structure
 *     description: Amounts remain in paise. Existing student fee assignments retain their original amount and due-date snapshot.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateFeeStructureRequest' }
 *     responses:
 *       200: { description: Fee structure updated., content: { application/json: { schema: { $ref: '#/components/schemas/FeeStructureResponse' } } } }
 *       400: { description: Invalid request data. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Fee structure not found. }
 *   delete:
 *     tags: [Fees]
 *     summary: Delete an unassigned fee structure
 *     description: Deletion is rejected while any student fee assignment references it.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Fee structure deleted. }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Fee structure not found. }
 *       409: { description: Fee structure has student assignments. }
 */
router.get("/structures/:id", validateUuidParam("id"), getFeeStructure);
router.put("/structures/:id", validateUuidParam("id"), updateFeeStructure);
router.delete("/structures/:id", validateUuidParam("id"), deleteFeeStructure);

/**
 * @openapi
 * /api/fees/assign:
 *   post:
 *     tags: [Fees]
 *     summary: Assign a fee structure to a student
 *     description: Amount and due date are copied from the active fee structure. A matching enrollment is required for course-specific fees; an optional matching enrollment may be linked for other fees.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignStudentFeeRequest' }
 *     responses:
 *       201: { description: Student fee assigned., content: { application/json: { schema: { $ref: '#/components/schemas/StudentFeeResponse' } } } }
 *       400: { description: Invalid assignment or enrollment mismatch. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance permission. }
 *       404: { description: Student or active fee structure not found. }
 *       409: { description: Student already has this fee assignment. }
 */
router.post("/assign", assignStudentFee);

/**
 * @openapi
 * /api/fees/student/{studentId}/summary:
 *   get:
 *     tags: [Fees]
 *     summary: Get a student's fee summary
 *     description: Reports totals in paise and derives overdue state from current date and outstanding balance.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Student fee balances and statuses., content: { application/json: { schema: { $ref: '#/components/schemas/StudentFeeSummaryResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Student not found in this tenant. }
 * /api/fees/student/{studentId}:
 *   get:
 *     tags: [Fees]
 *     summary: List a student's fee assignments
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Student fees., content: { application/json: { schema: { $ref: '#/components/schemas/StudentFeeListResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Student not found in this tenant. }
 */
router.get("/student/:studentId/summary", validateUuidParam("studentId"), getStudentFeeSummary);
router.get("/student/:studentId", validateUuidParam("studentId"), getStudentFees);

/**
 * @openapi
 * /api/fees/payments:
 *   post:
 *     tags: [Payments]
 *     summary: Record a payment against an assigned fee
 *     description: SCHOOL_ADMIN and ADMIN only. amount is integer paise. Multiple and partial payments are supported. A conditional transactional balance update prevents concurrent overpayment. Payment records are immutable through this API.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreatePaymentRequest' }
 *     responses:
 *       201: { description: Payment recorded and fee balance updated., content: { application/json: { schema: { $ref: '#/components/schemas/PaymentResponse' } } } }
 *       400: { description: Invalid payment fields. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks payment recording permission. }
 *       404: { description: Student fee not found in this tenant. }
 *       409: { description: Overpayment or duplicate transaction reference. }
 */
router.post("/payments", recordPayment);

/**
 * @openapi
 * /api/fees/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get a payment
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Payment details., content: { application/json: { schema: { $ref: '#/components/schemas/PaymentResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Payment not found in this tenant. }
 * /api/fees/student/{studentId}/payments:
 *   get:
 *     tags: [Payments]
 *     summary: List payment history for a student
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: studentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Payment history., content: { application/json: { schema: { $ref: '#/components/schemas/PaymentListResponse' } } } }
 *       400: { description: Invalid student UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Student not found in this tenant. }
 * /api/fees/{id}/payments:
 *   get:
 *     tags: [Payments]
 *     summary: List payments for an assigned fee
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Student fee payment history., content: { application/json: { schema: { $ref: '#/components/schemas/PaymentListResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Student fee not found in this tenant. }
 */
router.get("/payments/:id", validateUuidParam("id"), getPayment);
router.get("/student/:studentId/payments", validateUuidParam("studentId"), getStudentPayments);
router.get("/:id/payments", validateUuidParam("id"), getFeePayments);

/**
 * @openapi
 * /api/fees/reports/collection:
 *   get:
 *     tags: [Payments]
 *     summary: Get tenant collection totals
 *     description: Returns all-time collections, outstanding amounts, status counts, and method totals; every amount is integer paise.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tenant collection summary., content: { application/json: { schema: { $ref: '#/components/schemas/FeeCollectionReportResponse' } } } }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 */
router.get("/reports/collection", getCollectionReport);

/**
 * @openapi
 * /api/fees/{id}:
 *   get:
 *     tags: [Fees]
 *     summary: Get a student fee assignment
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Fee assignment and outstanding balance., content: { application/json: { schema: { $ref: '#/components/schemas/StudentFeeResponse' } } } }
 *       400: { description: Invalid UUID. }
 *       401: { description: Missing or invalid JWT. }
 *       403: { description: Caller lacks finance access. }
 *       404: { description: Student fee not found in this tenant. }
 */
router.get("/:id", validateUuidParam("id"), getStudentFee);

module.exports = router;
