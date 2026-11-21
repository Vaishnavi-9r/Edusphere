const express = require("express");
const cors = require("cors");
require("dotenv").config();
const authRoutes = require("./src/routes/authRoutes");
const testRoutes = require("./src/routes/testRoutes");
const studentRoutes = require("./src/routes/studentRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const teacherRoutes = require("./src/routes/teacherRoutes");
const subjectRoutes = require("./src/routes/subjectRoutes");
const courseRoutes = require("./src/routes/courseRoutes");
const timetableRoutes = require("./src/routes/timetableRoutes");
const examinationRoutes = require("./src/routes/examinationRoutes");
const enrollmentRoutes = require("./src/routes/enrollmentRoutes");
const gradeRoutes = require("./src/routes/gradeRoutes");
const feeRoutes = require("./src/routes/feeRoutes");
const parentRoutes = require("./src/routes/parentRoutes");
const parentPortalRoutes = require("./src/routes/parentPortalRoutes");
const studentPortalRoutes = require("./src/routes/studentPortalRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./src/config/swagger");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EduSphere API Running"
  });
});

const PORT = process.env.PORT || 5000;
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/examinations", examinationRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/parent-portal", parentPortalRoutes);
app.use("/api/student-portal", studentPortalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
