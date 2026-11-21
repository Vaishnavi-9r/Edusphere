
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "EduSphere API",
      version: "1.0.0",
      description: "API documentation for the EduSphere Multi-Tenant Student Information System",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT returned by school registration or login.",
        },
      },
      schemas: {
        DashboardOverviewResponse: {
          type: "object", required: ["success", "overview"],
          properties: { success: { type: "boolean" }, overview: { type: "object", properties: { totalStudents: { type: "integer" }, activeStudents: { type: "integer", description: "Distinct students with at least one ACTIVE enrollment." }, totalTeachers: { type: "integer" }, totalParents: { type: "integer", description: "Parent profiles, including deactivated accounts." }, totalCourses: { type: "integer" }, activeEnrollments: { type: "integer" }, activeStudentsRule: { type: "string" } } } },
        },
        DashboardAttendanceResponse: {
          type: "object", required: ["success", "date", "todayAttendance", "counts", "attendancePercentage"],
          properties: { success: { type: "boolean" }, date: { type: "string", format: "date" }, todayAttendance: { type: "integer" }, counts: { type: "object", properties: { PRESENT: { type: "integer" }, ABSENT: { type: "integer" }, LATE: { type: "integer" }, EXCUSED: { type: "integer" } } }, attendancePercentage: { type: "number", format: "float" }, percentageRule: { type: "string" } },
        },
        DashboardAcademicsResponse: {
          type: "object", required: ["success", "examinationCount", "averageExaminationPerformance", "gradeCount", "passFail", "coursePerformance"],
          properties: {
            success: { type: "boolean" }, examinationCount: { type: "integer" }, averageExaminationPerformance: { type: "number" }, gradeCount: { type: "integer" },
            passFail: { type: "object", properties: { passed: { type: "integer" }, failed: { type: "integer" }, total: { type: "integer" }, passRate: { type: "number" }, rule: { type: "string" } } },
            coursePerformance: { type: "array", items: { type: "object", properties: { courseId: { type: "string", format: "uuid" }, courseName: { type: "string" }, courseCode: { type: "string" }, gradeCount: { type: "integer" }, averagePerformance: { type: "number" }, passed: { type: "integer" }, failed: { type: "integer" } } } },
          },
        },
        DashboardFeesResponse: {
          type: "object", required: ["success", "fees"],
          properties: { success: { type: "boolean" }, fees: { type: "object", properties: { totalAssignedPaise: { type: "integer" }, totalCollectedPaise: { type: "integer" }, outstandingBalancePaise: { type: "integer" }, overdueBalancePaise: { type: "integer" }, collectionPercentage: { type: "number" }, currencyUnit: { type: "string", example: "paise" }, calculationRules: { type: "object", additionalProperties: { type: "string" } } } } },
        },
        DashboardEnrollmentsResponse: {
          type: "object", required: ["success", "enrollments", "totals"],
          properties: { success: { type: "boolean" }, enrollments: { type: "array", items: { type: "object", properties: { courseId: { type: "string", format: "uuid" }, courseName: { type: "string" }, courseCode: { type: "string" }, academicYear: { type: "string" }, active: { type: "integer" }, completed: { type: "integer" }, withdrawn: { type: "integer" }, total: { type: "integer" } } } }, totals: { type: "object", properties: { active: { type: "integer" }, completed: { type: "integer" }, withdrawn: { type: "integer" }, total: { type: "integer" } } } },
        },
        DashboardActivityResponse: {
          type: "object", required: ["success", "activities", "limit", "activityBasis"],
          properties: { success: { type: "boolean" }, limit: { type: "integer", example: 20 }, activityBasis: { type: "string" }, activities: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, type: { type: "string" }, summary: { type: "string" }, amountPaise: { type: "integer" }, createdAt: { type: "string", format: "date-time" } } } } },
        },
        StudentAccountCreateRequest: {
          type: "object", additionalProperties: false, required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", maxLength: 254, example: "student@example.edu" },
            password: { type: "string", format: "password", minLength: 8, maxLength: 72, description: "At most 72 UTF-8 bytes for bcrypt compatibility." },
          },
        },
        StudentAccountResponse: {
          type: "object", required: ["success", "student", "user"],
          properties: {
            success: { type: "boolean", example: true },
            student: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" } } },
            user: { type: "object", properties: { id: { type: "string", format: "uuid" }, email: { type: "string", format: "email" }, role: { type: "string", example: "STUDENT" }, isActive: { type: "boolean" } } },
          },
        },
        StudentPortalResponse: {
          type: "object", required: ["success"], properties: { success: { type: "boolean", example: true } },
          additionalProperties: true, example: { success: true },
        },
        CreateParentRequest: {
          type: "object", additionalProperties: false,
          required: ["fullName", "email", "password"],
          properties: {
            fullName: { type: "string", example: "Meera Sharma" },
            email: { type: "string", format: "email", example: "meera@example.com" },
            password: { type: "string", format: "password", minLength: 8 },
            phoneNumber: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
          },
        },
        UpdateParentRequest: {
          type: "object", additionalProperties: false,
          properties: {
            fullName: { type: "string" }, email: { type: "string", format: "email" },
            phoneNumber: { type: "string", nullable: true }, address: { type: "string", nullable: true },
          },
        },
        ParentStudentLinkRequest: {
          type: "object", additionalProperties: false, required: ["studentId", "relationshipType"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            relationshipType: { type: "string", enum: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] },
            isPrimaryContact: { type: "boolean", default: false },
          },
        },
        ParentResponse: {
          type: "object", required: ["success", "parent"],
          properties: {
            success: { type: "boolean", example: true },
            parent: { type: "object", properties: {
              id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" },
              phoneNumber: { type: "string", nullable: true }, address: { type: "string", nullable: true },
              user: { type: "object", properties: { id: { type: "string", format: "uuid" }, fullName: { type: "string" }, email: { type: "string", format: "email" }, role: { type: "string", example: "PARENT" }, isActive: { type: "boolean" } } },
              studentLinks: { type: "array", items: { type: "object", properties: { relationshipType: { type: "string", enum: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] }, isPrimaryContact: { type: "boolean" }, student: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" } } } } } },
            } },
          },
        },
        ParentListResponse: {
          type: "object", required: ["success", "parents"],
          properties: { success: { type: "boolean" }, parents: { type: "array", items: { $ref: "#/components/schemas/ParentResponse/properties/parent" } } },
        },
        ParentStudentListResponse: {
          type: "object", required: ["success", "students"],
          properties: { success: { type: "boolean" }, students: { type: "array", items: { type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" }, relationshipType: { type: "string", enum: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] }, isPrimaryContact: { type: "boolean" } } } } },
        },
        ParentRelationshipResponse: {
          type: "object", required: ["success", "relationship"],
          properties: {
            success: { type: "boolean" },
            relationship: { type: "object", properties: { tenantId: { type: "string", format: "uuid" }, parentId: { type: "string", format: "uuid" }, studentId: { type: "string", format: "uuid" }, relationshipType: { type: "string", enum: ["FATHER", "MOTHER", "GUARDIAN", "OTHER"] }, isPrimaryContact: { type: "boolean" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
          },
        },
        ParentPortalResponse: {
          type: "object", required: ["success"], properties: { success: { type: "boolean", example: true } },
          additionalProperties: true,
          example: { success: true },
        },
        RegisterSchoolRequest: {
          type: "object",
          required: ["schoolName", "adminName", "email", "password"],
          properties: {
            schoolName: { type: "string", example: "Northview School" },
            adminName: { type: "string", example: "Asha Sharma" },
            email: { type: "string", format: "email", example: "admin@northview.edu" },
            password: { type: "string", format: "password", example: "StrongPassword123" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@northview.edu" },
            password: { type: "string", format: "password", example: "StrongPassword123" },
          },
        },
        AuthUser: {
          type: "object",
          required: ["id", "fullName", "email", "role"],
          properties: {
            id: { type: "string", example: "5ef13f2b-3902-4de2-bd29-89af07c6e6c8" },
            fullName: { type: "string", example: "Asha Sharma" },
            email: { type: "string", format: "email", example: "admin@northview.edu" },
            role: { type: "string", example: "SCHOOL_ADMIN" },
          },
        },
        Tenant: {
          type: "object",
          required: ["id", "schoolName"],
          properties: {
            id: { type: "string", example: "15fdb6c5-9516-47d1-8240-56a86214e87f" },
            schoolName: { type: "string", example: "Northview School" },
          },
        },
        RegisterSchoolResponse: {
          type: "object",
          required: ["success", "message", "token", "tenant", "user"],
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "School registered successfully" },
            token: { type: "string", description: "JWT with a one-day expiration." },
            tenant: { $ref: "#/components/schemas/Tenant" },
            user: { $ref: "#/components/schemas/AuthUser" },
          },
        },
        LoginResponse: {
          type: "object",
          required: ["success", "message", "token", "user"],
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Login Successful" },
            token: { type: "string", description: "JWT with a one-day expiration." },
            user: { $ref: "#/components/schemas/AuthUser" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Internal Server Error" },
          },
        },
        Student: {
          type: "object",
          required: ["id", "name", "rollNumber", "grade", "tenantId", "createdAt"],
          properties: {
            id: { type: "string", example: "5ef13f2b-3902-4de2-bd29-89af07c6e6c8" },
            name: { type: "string", maxLength: 120, example: "Ravi Kumar" },
            rollNumber: { type: "string", maxLength: 50, example: "2026-001" },
            grade: { type: "string", maxLength: 50, example: "Grade 8" },
            tenantId: { type: "string", example: "15fdb6c5-9516-47d1-8240-56a86214e87f" },
            createdAt: { type: "string", format: "date-time", example: "2026-11-21T08:00:00.000Z" },
          },
        },
        CreateStudentRequest: {
          type: "object",
          additionalProperties: false,
          required: ["name", "rollNumber", "grade"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Ravi Kumar" },
            rollNumber: { type: "string", minLength: 1, maxLength: 50, example: "2026-001" },
            grade: { type: "string", minLength: 1, maxLength: 50, example: "Grade 8" },
          },
        },
        UpdateStudentRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Ravi Kumar" },
            rollNumber: { type: "string", minLength: 1, maxLength: 50, example: "2026-001" },
            grade: { type: "string", minLength: 1, maxLength: 50, example: "Grade 8" },
          },
        },
        StudentResponse: {
          type: "object",
          required: ["success", "student"],
          properties: {
            success: { type: "boolean", example: true },
            student: { $ref: "#/components/schemas/Student" },
          },
        },
        StudentListResponse: {
          type: "object",
          required: ["success", "students"],
          properties: {
            success: { type: "boolean", example: true },
            students: { type: "array", items: { $ref: "#/components/schemas/Student" } },
          },
        },
        DeleteStudentResponse: {
          type: "object",
          required: ["success", "message"],
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Student deleted successfully" },
          },
        },
        AttendanceStatus: {
          type: "string",
          enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
        },
        MarkAttendanceRequest: {
          type: "object",
          additionalProperties: false,
          required: ["studentId", "date", "status"],
          properties: {
            studentId: { type: "string", example: "5ef13f2b-3902-4de2-bd29-89af07c6e6c8" },
            date: { type: "string", format: "date", example: "2026-11-21" },
            status: { $ref: "#/components/schemas/AttendanceStatus" },
            remarks: { type: "string", nullable: true, maxLength: 1000, example: "Arrived after assembly" },
          },
        },
        BulkAttendanceRecord: {
          type: "object",
          additionalProperties: false,
          required: ["studentId", "status"],
          properties: {
            studentId: { type: "string", example: "5ef13f2b-3902-4de2-bd29-89af07c6e6c8" },
            status: { $ref: "#/components/schemas/AttendanceStatus" },
            remarks: { type: "string", nullable: true, maxLength: 1000 },
          },
        },
        BulkAttendanceRequest: {
          type: "object",
          additionalProperties: false,
          required: ["date", "records"],
          properties: {
            date: { type: "string", format: "date", example: "2026-11-21" },
            records: {
              type: "array",
              minItems: 1,
              maxItems: 500,
              items: { $ref: "#/components/schemas/BulkAttendanceRecord" },
            },
          },
        },
        UpdateAttendanceRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            status: { $ref: "#/components/schemas/AttendanceStatus" },
            remarks: { type: "string", nullable: true, maxLength: 1000 },
          },
        },
        Attendance: {
          type: "object",
          required: ["id", "tenantId", "studentId", "date", "status", "markedById", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            studentId: { type: "string" },
            date: { type: "string", format: "date", example: "2026-11-21" },
            status: { $ref: "#/components/schemas/AttendanceStatus" },
            remarks: { type: "string", nullable: true },
            markedById: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AttendanceStudent: {
          type: "object",
          required: ["id", "name", "rollNumber", "grade"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            rollNumber: { type: "string" },
            grade: { type: "string" },
          },
        },
        AttendanceWithStudent: {
          allOf: [
            { $ref: "#/components/schemas/Attendance" },
            {
              type: "object",
              required: ["student"],
              properties: { student: { $ref: "#/components/schemas/AttendanceStudent" } },
            },
          ],
        },
        AttendanceResponse: {
          type: "object",
          required: ["success", "attendance"],
          properties: {
            success: { type: "boolean", example: true },
            attendance: { $ref: "#/components/schemas/AttendanceWithStudent" },
          },
        },
        AttendanceListResponse: {
          type: "object",
          required: ["success", "attendance"],
          properties: {
            success: { type: "boolean", example: true },
            date: { type: "string", format: "date" },
            count: { type: "integer", example: 2 },
            studentId: { type: "string" },
            attendance: {
              type: "array",
              items: { $ref: "#/components/schemas/AttendanceWithStudent" },
            },
          },
        },
        BulkAttendanceResponse: {
          type: "object",
          required: ["success", "count", "attendance"],
          properties: {
            success: { type: "boolean", example: true },
            count: { type: "integer", example: 2 },
            attendance: {
              type: "array",
              items: { $ref: "#/components/schemas/AttendanceWithStudent" },
            },
          },
        },
        AttendanceSummaryResponse: {
          type: "object",
          required: ["success", "studentId", "total", "counts", "attendancePercentage", "percentageRule"],
          properties: {
            success: { type: "boolean", example: true },
            studentId: { type: "string" },
            total: { type: "integer", example: 20 },
            counts: {
              type: "object",
              required: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
              properties: {
                PRESENT: { type: "integer", example: 16 },
                ABSENT: { type: "integer", example: 2 },
                LATE: { type: "integer", example: 1 },
                EXCUSED: { type: "integer", example: 1 },
              },
            },
            attendancePercentage: { type: "number", format: "float", example: 89.47 },
            percentageRule: { type: "string" },
          },
        },
        EmploymentStatus: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE"],
        },
        CreateTeacherRequest: {
          type: "object",
          additionalProperties: false,
          required: ["employeeId", "fullName", "email", "password"],
          properties: {
            employeeId: { type: "string", minLength: 1, maxLength: 50, example: "EMP-104" },
            fullName: { type: "string", minLength: 1, maxLength: 120, example: "Meera Rao" },
            email: { type: "string", format: "email", example: "meera.rao@example.edu" },
            password: { type: "string", format: "password", minLength: 8, maxLength: 72 },
            phoneNumber: { type: "string", nullable: true, maxLength: 30, example: "+91-9876543210" },
            qualification: { type: "string", nullable: true, maxLength: 120, example: "M.Sc Mathematics" },
            specialization: { type: "string", nullable: true, maxLength: 120, example: "Mathematics" },
            joiningDate: { type: "string", format: "date", nullable: true, example: "2024-06-01" },
            employmentStatus: { $ref: "#/components/schemas/EmploymentStatus" },
          },
        },
        UpdateTeacherRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            employeeId: { type: "string", minLength: 1, maxLength: 50 },
            fullName: { type: "string", minLength: 1, maxLength: 120 },
            email: { type: "string", format: "email" },
            phoneNumber: { type: "string", nullable: true, maxLength: 30 },
            qualification: { type: "string", nullable: true, maxLength: 120 },
            specialization: { type: "string", nullable: true, maxLength: 120 },
            joiningDate: { type: "string", format: "date", nullable: true },
            employmentStatus: { $ref: "#/components/schemas/EmploymentStatus" },
          },
        },
        Teacher: {
          type: "object",
          required: ["id", "employeeId", "fullName", "email", "employmentStatus", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", example: "c1fbf1c0-d390-4744-9b3b-36c7d145c813" },
            employeeId: { type: "string", example: "EMP-104" },
            fullName: { type: "string", example: "Meera Rao" },
            email: { type: "string", format: "email", example: "meera.rao@example.edu" },
            phoneNumber: { type: "string", nullable: true },
            qualification: { type: "string", nullable: true },
            specialization: { type: "string", nullable: true },
            joiningDate: { type: "string", format: "date", nullable: true },
            employmentStatus: { $ref: "#/components/schemas/EmploymentStatus" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        TeacherResponse: {
          type: "object",
          required: ["success", "teacher"],
          properties: {
            success: { type: "boolean", example: true },
            teacher: { $ref: "#/components/schemas/Teacher" },
          },
        },
        TeacherListResponse: {
          type: "object",
          required: ["success", "teachers"],
          properties: {
            success: { type: "boolean", example: true },
            teachers: { type: "array", items: { $ref: "#/components/schemas/Teacher" } },
          },
        },
        CreateSubjectRequest: {
          type: "object",
          additionalProperties: false,
          required: ["name", "code"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Mathematics" },
            code: { type: "string", minLength: 1, maxLength: 32, example: "MATH-8" },
            description: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        UpdateSubjectRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            code: { type: "string", minLength: 1, maxLength: 32 },
            description: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        Subject: {
          type: "object",
          required: ["id", "tenantId", "name", "code", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            name: { type: "string" },
            code: { type: "string" },
            description: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCourseRequest: {
          type: "object",
          additionalProperties: false,
          required: ["name", "code", "academicYear"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Grade 8" },
            code: { type: "string", minLength: 1, maxLength: 32, example: "GR8-2026" },
            description: { type: "string", nullable: true, maxLength: 2000 },
            academicYear: { type: "string", minLength: 1, maxLength: 20, example: "2026-2027" },
          },
        },
        UpdateCourseRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            code: { type: "string", minLength: 1, maxLength: 32 },
            description: { type: "string", nullable: true, maxLength: 2000 },
            academicYear: { type: "string", minLength: 1, maxLength: 20 },
          },
        },
        Course: {
          type: "object",
          required: ["id", "tenantId", "name", "code", "academicYear", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string" },
            tenantId: { type: "string" },
            name: { type: "string" },
            code: { type: "string" },
            description: { type: "string", nullable: true },
            academicYear: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateTimetableRequest: {
          type: "object",
          additionalProperties: false,
          required: ["courseId", "name", "academicYear", "term"],
          properties: {
            courseId: { type: "string", format: "uuid" },
            name: { type: "string", minLength: 1, maxLength: 120, example: "Grade 8 Weekly Timetable" },
            academicYear: { type: "string", minLength: 1, maxLength: 20, example: "2026-2027" },
            term: { type: "string", minLength: 1, maxLength: 50, example: "Term 1" },
          },
        },
        UpdateTimetableRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            term: { type: "string", minLength: 1, maxLength: 50 },
          },
        },
        TimetableEntryRequest: {
          type: "object",
          additionalProperties: false,
          required: ["courseId", "teacherId", "subjectId", "dayOfWeek", "startTime", "endTime"],
          properties: {
            courseId: { type: "string", format: "uuid" },
            teacherId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            dayOfWeek: { type: "integer", minimum: 0, maximum: 6, description: "0 is Sunday and 6 is Saturday." },
            startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "09:00" },
            endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "09:45" },
            classroom: { type: "string", nullable: true, maxLength: 120, example: "Room 204" },
          },
        },
        TimetableEntry: {
          type: "object",
          required: ["id", "tenantId", "timetableId", "courseId", "academicYear", "term", "subjectId", "teacherId", "dayOfWeek", "startTime", "endTime", "classroom", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            tenantId: { type: "string", format: "uuid" },
            timetableId: { type: "string", format: "uuid" },
            courseId: { type: "string", format: "uuid" },
            academicYear: { type: "string" },
            term: { type: "string" },
            subjectId: { type: "string", format: "uuid" },
            teacherId: { type: "string", format: "uuid" },
            dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
            startTime: { type: "string", example: "09:00:00" },
            endTime: { type: "string", example: "09:45:00" },
            classroom: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            subject: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" } } },
            teacher: { type: "object", properties: { id: { type: "string" }, employeeId: { type: "string" }, user: { type: "object", properties: { fullName: { type: "string" } } } } },
          },
        },
        Timetable: {
          type: "object",
          required: ["id", "tenantId", "courseId", "name", "academicYear", "term", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" },
            courseId: { type: "string", format: "uuid" }, name: { type: "string" }, academicYear: { type: "string" }, term: { type: "string" },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            course: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, academicYear: { type: "string" } } },
            entries: { type: "array", items: { $ref: "#/components/schemas/TimetableEntry" } },
          },
        },
        TimetableResponse: {
          type: "object", required: ["success", "timetable"],
          properties: { success: { type: "boolean", example: true }, timetable: { $ref: "#/components/schemas/Timetable" } },
        },
        TimetableListResponse: {
          type: "object", required: ["success", "timetables"],
          properties: { success: { type: "boolean", example: true }, timetables: { type: "array", items: { $ref: "#/components/schemas/Timetable" } } },
        },
        TimetableEntryResponse: {
          type: "object", required: ["success", "entry"],
          properties: { success: { type: "boolean", example: true }, entry: { $ref: "#/components/schemas/TimetableEntry" } },
        },
        ExamType: { type: "string", enum: ["UNIT_TEST", "MID_TERM", "FINAL_EXAM", "PRACTICAL", "ASSIGNMENT"] },
        CreateExaminationRequest: {
          type: "object",
          additionalProperties: false,
          required: ["name", "examType", "courseId", "subjectId", "academicYear", "examDate", "startTime", "endTime", "maximumMarks", "passingMarks"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Mid Term Mathematics" },
            examType: { $ref: "#/components/schemas/ExamType" },
            courseId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            academicYear: { type: "string", minLength: 1, maxLength: 20, example: "2026-2027" },
            examDate: { type: "string", format: "date", example: "2026-12-10" },
            startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "09:00" },
            endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "10:30" },
            maximumMarks: { type: "number", exclusiveMinimum: 0, maximum: 999999.99, multipleOf: 0.01, example: 100 },
            passingMarks: { type: "number", minimum: 0, maximum: 999999.99, multipleOf: 0.01, example: 35 },
            description: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        UpdateExaminationRequest: {
          type: "object", additionalProperties: false, minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            examType: { $ref: "#/components/schemas/ExamType" },
            courseId: { type: "string", format: "uuid" },
            subjectId: { type: "string", format: "uuid" },
            academicYear: { type: "string", minLength: 1, maxLength: 20 },
            examDate: { type: "string", format: "date" },
            startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$" },
            endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$" },
            maximumMarks: { type: "number", exclusiveMinimum: 0, maximum: 999999.99, multipleOf: 0.01 },
            passingMarks: { type: "number", minimum: 0, maximum: 999999.99, multipleOf: 0.01 },
            description: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        Examination: {
          type: "object",
          required: ["id", "tenantId", "name", "examType", "courseId", "subjectId", "academicYear", "examDate", "startTime", "endTime", "maximumMarks", "passingMarks", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" },
            name: { type: "string" }, examType: { $ref: "#/components/schemas/ExamType" },
            courseId: { type: "string", format: "uuid" }, subjectId: { type: "string", format: "uuid" }, academicYear: { type: "string" },
            examDate: { type: "string", format: "date" }, startTime: { type: "string", example: "09:00:00" }, endTime: { type: "string", example: "10:30:00" },
            maximumMarks: { type: "number", example: 100 }, passingMarks: { type: "number", example: 35 }, description: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            course: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, academicYear: { type: "string" } } },
            subject: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" } } },
          },
        },
        ExaminationResponse: {
          type: "object", required: ["success", "examination"],
          properties: { success: { type: "boolean", example: true }, examination: { $ref: "#/components/schemas/Examination" } },
        },
        ExaminationListResponse: {
          type: "object", required: ["success", "examinations"],
          properties: { success: { type: "boolean", example: true }, examinations: { type: "array", items: { $ref: "#/components/schemas/Examination" } } },
        },
        EnrollmentStatus: { type: "string", enum: ["ACTIVE", "COMPLETED", "WITHDRAWN"] },
        CreateEnrollmentRequest: {
          type: "object", additionalProperties: false,
          required: ["studentId", "courseId", "academicYear", "enrollmentDate"],
          properties: {
            studentId: { type: "string", format: "uuid" }, courseId: { type: "string", format: "uuid" },
            academicYear: { type: "string", minLength: 1, maxLength: 20, example: "2026-2027" },
            enrollmentDate: { type: "string", format: "date", example: "2026-11-21" },
            status: { $ref: "#/components/schemas/EnrollmentStatus" },
          },
        },
        UpdateEnrollmentRequest: {
          type: "object", additionalProperties: false, minProperties: 1,
          properties: {
            enrollmentDate: { type: "string", format: "date" },
            status: { $ref: "#/components/schemas/EnrollmentStatus" },
          },
        },
        StudentEnrollment: {
          type: "object",
          required: ["id", "tenantId", "studentId", "courseId", "academicYear", "enrollmentDate", "status", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" }, courseId: { type: "string", format: "uuid" }, academicYear: { type: "string" },
            enrollmentDate: { type: "string", format: "date" }, status: { $ref: "#/components/schemas/EnrollmentStatus" },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            student: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" } } },
            course: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, academicYear: { type: "string" } } },
          },
        },
        EnrollmentResponse: {
          type: "object", required: ["success", "enrollment"],
          properties: { success: { type: "boolean", example: true }, enrollment: { $ref: "#/components/schemas/StudentEnrollment" } },
        },
        EnrollmentListResponse: {
          type: "object", required: ["success", "enrollments"],
          properties: { success: { type: "boolean", example: true }, enrollments: { type: "array", items: { $ref: "#/components/schemas/StudentEnrollment" } } },
        },
        CreateGradeRequest: {
          type: "object", additionalProperties: false,
          required: ["studentId", "examinationId", "enrollmentId", "marksObtained"],
          properties: {
            studentId: { type: "string", format: "uuid" }, examinationId: { type: "string", format: "uuid" }, enrollmentId: { type: "string", format: "uuid" },
            marksObtained: { type: "number", minimum: 0, maximum: 999999.99, multipleOf: 0.01, example: 87.5 },
            remarks: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        UpdateGradeRequest: {
          type: "object", additionalProperties: false, minProperties: 1,
          properties: {
            marksObtained: { type: "number", minimum: 0, maximum: 999999.99, multipleOf: 0.01 },
            remarks: { type: "string", nullable: true, maxLength: 2000 },
          },
        },
        Grade: {
          type: "object",
          required: ["id", "tenantId", "studentId", "examinationId", "enrollmentId", "courseId", "academicYear", "marksObtained", "maximumMarks", "percentage", "grade", "enteredById", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" }, studentId: { type: "string", format: "uuid" },
            examinationId: { type: "string", format: "uuid" }, enrollmentId: { type: "string", format: "uuid" }, courseId: { type: "string", format: "uuid" }, academicYear: { type: "string" },
            marksObtained: { type: "number", example: 87.5 }, maximumMarks: { type: "number", example: 100 }, percentage: { type: "number", example: 87.5 },
            grade: { type: "string", example: "B" }, remarks: { type: "string", nullable: true }, enteredById: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            student: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" } } },
            examination: { $ref: "#/components/schemas/Examination" },
            enrollment: { type: "object", properties: { id: { type: "string" }, status: { $ref: "#/components/schemas/EnrollmentStatus" }, academicYear: { type: "string" } } },
            enteredBy: { type: "object", properties: { id: { type: "string" }, fullName: { type: "string" }, role: { type: "string" } } },
          },
        },
        GradeResponse: {
          type: "object", required: ["success", "grade"],
          properties: { success: { type: "boolean", example: true }, grade: { $ref: "#/components/schemas/Grade" } },
        },
        GradeListResponse: {
          type: "object", required: ["success", "grades"],
          properties: { success: { type: "boolean", example: true }, grades: { type: "array", items: { $ref: "#/components/schemas/Grade" } } },
        },
        ReportCardResponse: {
          type: "object", required: ["success", "student", "reportCards", "calculationRule"],
          properties: {
            success: { type: "boolean", example: true }, student: { $ref: "#/components/schemas/Student" },
            gradingScaleRule: { type: "string" }, calculationRule: { type: "string" },
            reportCards: { type: "array", items: {
              type: "object", properties: {
                enrollmentId: { type: "string", format: "uuid" }, course: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" } } },
                academicYear: { type: "string" }, enrollmentStatus: { $ref: "#/components/schemas/EnrollmentStatus" },
                grades: { type: "array", items: { $ref: "#/components/schemas/Grade" } }, totalMarksObtained: { type: "number" }, totalMaximumMarks: { type: "number" },
                percentage: { type: "number" }, overallGrade: { type: "string", nullable: true },
              },
            } },
          },
        },
        FeeCategory: { type: "string", enum: ["TUITION", "EXAMINATION", "TRANSPORT", "LIBRARY", "OTHER"] },
        StudentFeeStatus: { type: "string", enum: ["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE"] },
        PaymentMethod: { type: "string", enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] },
        CreateFeeStructureRequest: {
          type: "object", additionalProperties: false,
          required: ["name", "category", "amount", "academicYear", "dueDate"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120, example: "Annual Tuition Fee" },
            description: { type: "string", nullable: true, maxLength: 2000 },
            category: { $ref: "#/components/schemas/FeeCategory" },
            amount: { type: "integer", minimum: 1, maximum: 2147483647, description: "Amount in paise (1 rupee = 100 paise).", example: 2500000 },
            academicYear: { type: "string", minLength: 1, maxLength: 20, example: "2026-2027" },
            courseId: { type: "string", format: "uuid", nullable: true },
            dueDate: { type: "string", format: "date", example: "2026-12-31" },
            isActive: { type: "boolean", default: true },
          },
        },
        UpdateFeeStructureRequest: {
          type: "object", additionalProperties: false, minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 }, description: { type: "string", nullable: true, maxLength: 2000 },
            category: { $ref: "#/components/schemas/FeeCategory" }, amount: { type: "integer", minimum: 1, maximum: 2147483647, description: "Integer paise." },
            dueDate: { type: "string", format: "date" }, isActive: { type: "boolean" },
          },
        },
        FeeStructure: {
          type: "object", required: ["id", "tenantId", "name", "category", "amount", "academicYear", "dueDate", "isActive", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" }, name: { type: "string" },
            description: { type: "string", nullable: true }, category: { $ref: "#/components/schemas/FeeCategory" },
            amount: { type: "integer", description: "Integer paise." }, academicYear: { type: "string" }, courseId: { type: "string", format: "uuid", nullable: true },
            dueDate: { type: "string", format: "date" }, isActive: { type: "boolean" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            course: { type: "object", nullable: true, properties: { id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, academicYear: { type: "string" } } },
          },
        },
        FeeStructureResponse: {
          type: "object", required: ["success", "feeStructure"],
          properties: { success: { type: "boolean", example: true }, feeStructure: { $ref: "#/components/schemas/FeeStructure" } },
        },
        FeeStructureListResponse: {
          type: "object", required: ["success", "feeStructures"],
          properties: { success: { type: "boolean", example: true }, feeStructures: { type: "array", items: { $ref: "#/components/schemas/FeeStructure" } } },
        },
        AssignStudentFeeRequest: {
          type: "object", additionalProperties: false, required: ["studentId", "feeStructureId"],
          properties: {
            studentId: { type: "string", format: "uuid" }, feeStructureId: { type: "string", format: "uuid" },
            enrollmentId: { type: "string", format: "uuid", nullable: true, description: "Required for course-specific fee structures." },
          },
        },
        StudentFee: {
          type: "object", required: ["id", "tenantId", "studentId", "feeStructureId", "academicYear", "totalAmount", "amountPaid", "outstandingAmount", "dueDate", "status", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" }, studentId: { type: "string", format: "uuid" },
            feeStructureId: { type: "string", format: "uuid" }, enrollmentId: { type: "string", format: "uuid", nullable: true }, academicYear: { type: "string" },
            totalAmount: { type: "integer", description: "Integer paise." }, amountPaid: { type: "integer", description: "Integer paise." }, outstandingAmount: { type: "integer", description: "Integer paise." },
            dueDate: { type: "string", format: "date" }, status: { $ref: "#/components/schemas/StudentFeeStatus" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
            student: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rollNumber: { type: "string" }, grade: { type: "string" } } },
            feeStructure: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, category: { $ref: "#/components/schemas/FeeCategory" }, academicYear: { type: "string" } } },
          },
        },
        StudentFeeResponse: {
          type: "object", required: ["success", "studentFee"],
          properties: { success: { type: "boolean", example: true }, studentFee: { $ref: "#/components/schemas/StudentFee" } },
        },
        StudentFeeListResponse: {
          type: "object", required: ["success", "studentFees"],
          properties: { success: { type: "boolean", example: true }, studentFees: { type: "array", items: { $ref: "#/components/schemas/StudentFee" } } },
        },
        StudentFeeSummaryResponse: {
          type: "object", required: ["success", "student", "feeCount", "totalAmount", "amountPaid", "outstandingAmount", "statuses", "currencyUnit"],
          properties: {
            success: { type: "boolean" }, student: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rollNumber: { type: "string" } } },
            feeCount: { type: "integer" }, totalAmount: { type: "integer", description: "Integer paise." }, amountPaid: { type: "integer", description: "Integer paise." }, outstandingAmount: { type: "integer", description: "Integer paise." },
            statuses: { type: "object", properties: { PENDING: { type: "integer" }, PARTIALLY_PAID: { type: "integer" }, PAID: { type: "integer" }, OVERDUE: { type: "integer" } } },
            studentFees: { type: "array", items: { $ref: "#/components/schemas/StudentFee" } }, currencyUnit: { type: "string", example: "paise" },
          },
        },
        CreatePaymentRequest: {
          type: "object", additionalProperties: false, required: ["studentFeeId", "amount", "paymentMethod"],
          properties: {
            studentFeeId: { type: "string", format: "uuid" }, amount: { type: "integer", minimum: 1, maximum: 2147483647, description: "Payment amount in integer paise." },
            paymentMethod: { $ref: "#/components/schemas/PaymentMethod" }, transactionReference: { type: "string", nullable: true, maxLength: 120 },
            paymentDate: { type: "string", format: "date-time" },
          },
        },
        Payment: {
          type: "object", required: ["id", "tenantId", "studentFeeId", "amount", "paymentMethod", "paymentDate", "receivedById", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" }, tenantId: { type: "string", format: "uuid" }, studentFeeId: { type: "string", format: "uuid" },
            amount: { type: "integer", description: "Integer paise." }, paymentMethod: { $ref: "#/components/schemas/PaymentMethod" }, transactionReference: { type: "string", nullable: true },
            paymentDate: { type: "string", format: "date-time" }, receivedById: { type: "string", format: "uuid" }, createdAt: { type: "string", format: "date-time" },
            studentFee: { type: "object", properties: { student: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, rollNumber: { type: "string" } } }, feeStructure: { type: "object", properties: { name: { type: "string" }, category: { $ref: "#/components/schemas/FeeCategory" } } } } },
            receivedBy: { type: "object", properties: { id: { type: "string" }, fullName: { type: "string" }, role: { type: "string" } } },
          },
        },
        PaymentResponse: {
          type: "object", required: ["success", "payment"],
          properties: { success: { type: "boolean", example: true }, payment: { $ref: "#/components/schemas/Payment" }, studentFee: { $ref: "#/components/schemas/StudentFee" } },
        },
        PaymentListResponse: {
          type: "object", required: ["success", "payments"],
          properties: { success: { type: "boolean", example: true }, studentFeeId: { type: "string", format: "uuid" }, payments: { type: "array", items: { $ref: "#/components/schemas/Payment" } } },
        },
        FeeCollectionReportResponse: {
          type: "object", required: ["success", "totalCollected", "paymentCount", "totalAssigned", "outstanding", "feeStatuses", "byPaymentMethod", "currencyUnit"],
          properties: {
            success: { type: "boolean" }, totalCollected: { type: "integer", description: "Integer paise." }, paymentCount: { type: "integer" },
            totalAssigned: { type: "integer", description: "Integer paise." }, outstanding: { type: "integer", description: "Integer paise." }, currencyUnit: { type: "string", example: "paise" },
            feeStatuses: { type: "object", additionalProperties: { type: "integer" } },
            byPaymentMethod: { type: "array", items: { type: "object", properties: { paymentMethod: { $ref: "#/components/schemas/PaymentMethod" }, amount: { type: "integer" }, count: { type: "integer" } } } },
          },
        },
        SubjectResponse: {
          type: "object",
          required: ["success", "subject"],
          properties: { success: { type: "boolean" }, subject: { $ref: "#/components/schemas/Subject" } },
        },
        DeleteAcademicResponse: {
          type: "object",
          required: ["success", "message"],
          properties: { success: { type: "boolean", example: true }, message: { type: "string" } },
        },
        SubjectListResponse: {
          type: "object",
          required: ["success", "subjects"],
          properties: { success: { type: "boolean" }, subjects: { type: "array", items: { $ref: "#/components/schemas/Subject" } } },
        },
        CourseResponse: {
          type: "object",
          required: ["success", "course"],
          properties: { success: { type: "boolean" }, course: { $ref: "#/components/schemas/Course" } },
        },
        CourseListResponse: {
          type: "object",
          required: ["success", "courses"],
          properties: { success: { type: "boolean" }, courses: { type: "array", items: { $ref: "#/components/schemas/Course" } } },
        },
        SubjectAssignmentRequest: {
          type: "object",
          additionalProperties: false,
          required: ["subjectId"],
          properties: { subjectId: { type: "string", format: "uuid" } },
        },
        Assignment: {
          type: "object",
          required: ["tenantId", "subjectId", "assignedAt"],
          properties: {
            tenantId: { type: "string" },
            teacherId: { type: "string" },
            courseId: { type: "string" },
            subjectId: { type: "string" },
            assignedAt: { type: "string", format: "date-time" },
          },
        },
        AssignmentResponse: {
          type: "object",
          required: ["success", "assignment"],
          properties: { success: { type: "boolean" }, assignment: { $ref: "#/components/schemas/Assignment" } },
        },
        SubjectTeachersResponse: {
          type: "object",
          required: ["success", "teachers"],
          properties: {
            success: { type: "boolean" },
            teachers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  employeeId: { type: "string" },
                  fullName: { type: "string" },
                  email: { type: "string", format: "email" },
                  employmentStatus: { $ref: "#/components/schemas/EmploymentStatus" },
                  assignedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],
  },
  apis: [path.resolve(__dirname, "../routes/*.js").replace(/\\/g, "/")],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
