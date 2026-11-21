const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerMatch = typeof authHeader === "string"
    ? authHeader.match(/^Bearer ([^\s]+)$/)
    : null;

  if (!bearerMatch || !process.env.JWT_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(bearerMatch[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }

  if (
    !decoded ||
    typeof decoded.userId !== "string" || !decoded.userId.trim() ||
    typeof decoded.tenantId !== "string" || !decoded.tenantId.trim() ||
    typeof decoded.role !== "string" || !decoded.role.trim()
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: decoded.userId, tenantId: decoded.tenantId },
      select: { id: true, tenantId: true, role: true, isActive: true },
    });

    if (!user || !user.isActive || user.role !== decoded.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    req.user = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify user account"
    });
  }
};

module.exports = authMiddleware;
