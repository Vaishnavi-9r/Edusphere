const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register School + Admin
const registerSchool = async (req, res) => {
  try {
    const {
      schoolName,
      adminName,
      email,
      password
    } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Create Tenant
    const tenant = await prisma.tenant.create({
      data: {
        schoolName
      }
    });

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Admin User
    const user = await prisma.user.create({
      data: {
        fullName: adminName,
        email,
        passwordHash: hashedPassword,
        role: "SCHOOL_ADMIN",
        tenantId: tenant.id
      }
    });

    // Generate JWT Token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(201).json({
      success: true,
      message: "School registered successfully",
      token,
      tenant: {
        id: tenant.id,
        schoolName: tenant.schoolName
      },
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid Email or Password"
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid Email or Password"
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

module.exports = {
  registerSchool,
  login
};
