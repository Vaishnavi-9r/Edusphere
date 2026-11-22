const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const prisma = require("../src/config/prisma");

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
const envFile = path.join(backendRoot, ".env");
dotenv.config({ path: envFile, quiet: true });

const roleConfig = [
  { role: "ADMIN", emailKey: "E2E_SYSTEM_ADMIN_EMAIL", passwordKey: "E2E_SYSTEM_ADMIN_PASSWORD", fullName: "EduSphere E2E System Admin" },
  { role: "TEACHER", emailKey: "E2E_TEACHER_EMAIL", passwordKey: "E2E_TEACHER_PASSWORD", fullName: "EduSphere E2E Teacher" },
  { role: "PARENT", emailKey: "E2E_PARENT_EMAIL", passwordKey: "E2E_PARENT_PASSWORD", fullName: "EduSphere E2E Parent" },
  { role: "STUDENT", emailKey: "E2E_STUDENT_EMAIL", passwordKey: "E2E_STUDENT_PASSWORD", fullName: "EduSphere E2E Student" },
];

const randomPassword = () => crypto.randomBytes(32).toString("base64url");
const randomEmail = (role) =>
  `edusphere.e2e.${role.toLowerCase()}-${crypto.randomBytes(8).toString("hex")}@example.test`;

function verifyLocalEnvFileIsIgnored() {
  const ignored = spawnSync("git", ["-C", repoRoot, "check-ignore", "-q", "backend/.env"], {
    windowsHide: true,
  });
  const tracked = spawnSync("git", ["-C", repoRoot, "ls-files", "--error-unmatch", "backend/.env"], {
    windowsHide: true,
    stdio: "ignore",
  });
  if (ignored.status !== 0 || tracked.status === 0) {
    throw new Error("Refusing to store generated E2E credentials because backend/.env is not safely gitignored.");
  }
}

function prepareRoleCredentials() {
  const updates = {};
  for (const config of roleConfig) {
    let email = process.env[config.emailKey];
    let password = process.env[config.passwordKey];
    if (Boolean(email) !== Boolean(password)) {
      throw new Error(`${config.emailKey} and ${config.passwordKey} must either both be set or both be absent.`);
    }
    if (!email) {
      email = randomEmail(config.role);
      password = randomPassword();
    }
    if (!/^\S+@example\.test$/i.test(email)) {
      throw new Error(`${config.emailKey} must use the reserved example.test domain for test-only accounts.`);
    }
    if (typeof password !== "string" || /[\r\n]/.test(password) || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      throw new Error(`${config.passwordKey} must be 8 to 72 UTF-8 bytes.`);
    }
    process.env[config.emailKey] = email;
    process.env[config.passwordKey] = password;
    updates[config.emailKey] = email;
    updates[config.passwordKey] = password;
  }
  return updates;
}

function persistEnvValues(updates) {
  verifyLocalEnvFileIsIgnored();
  const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const newline = current.includes("\r\n") ? "\r\n" : "\n";
  const lines = current.split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`^\\s*(?:export\\s+)?${escaped}\\s*=`);
    const line = `${key}=${value}`;
    const index = lines.findIndex((existing) => matcher.test(existing));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  fs.writeFileSync(envFile, lines.join(newline), "utf8");
}

function exportGithubActionsEnv(updates) {
  const githubEnvFile = process.env.GITHUB_ENV;
  if (!githubEnvFile) return;
  for (const value of Object.values(updates)) {
    if (/[\r\n]/.test(value)) throw new Error("E2E account values cannot contain line breaks.");
  }
  const entries = Object.entries(updates).map(([key, value]) => `${key}=${value}`).join("\n");
  fs.appendFileSync(githubEnvFile, `${entries}\n`, { encoding: "utf8" });
}

function requireE2EDatabase() {
  const e2eUrl = process.env.E2E_DATABASE_URL;
  const jwtSecret = process.env.E2E_JWT_SECRET;
  if (!e2eUrl || !jwtSecret) {
    throw new Error("E2E_DATABASE_URL and E2E_JWT_SECRET are required; no fallback database is allowed.");
  }
  let parsed;
  try {
    parsed = new URL(e2eUrl);
  } catch {
    throw new Error("E2E_DATABASE_URL is invalid.");
  }
  if (!parsed.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("E2E_DATABASE_URL must point to the isolated Supabase Session Pooler.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("E2E account setup is disabled when NODE_ENV is production.");
  }
  process.env.DATABASE_URL = e2eUrl;
  process.env.JWT_SECRET = jwtSecret;
}

async function findOrCreateUser(tx, { role, email, password, fullName, tenantId }) {
  let user = await tx.user.findUnique({ where: { email } });
  if (user) {
    if (user.role !== role || user.tenantId !== tenantId) {
      throw new Error(`Configured ${role} test account is already assigned to a different role or tenant.`);
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error(`Configured ${role} test account password does not match its stored hash.`);
    }
    if (!user.isActive) {
      user = await tx.user.update({ where: { id: user.id }, data: { isActive: true } });
    }
    return { user, created: false };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  user = await tx.user.create({
    data: { fullName, email, passwordHash, role, tenantId, isActive: true },
  });
  return { user, created: true };
}

async function ensureRoleProfile(tx, role, user, tenantId) {
  if (role === "ADMIN") return { created: false };

  if (role === "TEACHER") {
    const existing = await tx.teacher.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (existing) return { created: false };
    await tx.teacher.create({
      data: {
        tenantId,
        userId: user.id,
        employeeId: `E2E-${user.id.replace(/-/g, "").slice(0, 20).toUpperCase()}`,
      },
    });
    return { created: true };
  }

  if (role === "PARENT") {
    const existing = await tx.parent.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (existing) return { created: false };
    await tx.parent.create({ data: { tenantId, userId: user.id } });
    return { created: true };
  }

  if (role === "STUDENT") {
    const linked = await tx.student.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    if (linked) return { created: false, studentProfileCreated: false };

    let student = await tx.student.findFirst({
      where: { tenantId, userId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    let studentProfileCreated = false;
    if (!student) {
      student = await tx.student.create({
        data: {
          tenantId,
          userId: null,
          name: user.fullName,
          rollNumber: `E2E-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
          grade: "E2E",
        },
        select: { id: true },
      });
      studentProfileCreated = true;
    }
    const linkedStudent = await tx.student.updateMany({
      where: { id: student.id, tenantId, userId: null },
      data: { userId: user.id },
    });
    if (linkedStudent.count !== 1) throw new Error("Could not link the STUDENT test account to a tenant student profile.");
    return { created: true, studentProfileCreated };
  }

  throw new Error("Unsupported E2E role setup.");
}

async function main() {
  requireE2EDatabase();
  const roleCredentials = prepareRoleCredentials();

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const schoolBEmail = process.env.E2E_SCHOOL_B_EMAIL;
  const schoolBPassword = process.env.E2E_SCHOOL_B_PASSWORD;
  if (!adminEmail || !adminPassword || !schoolBEmail || !schoolBPassword) {
    throw new Error("School A and School B E2E admin credentials are required to preserve tenant-isolation coverage.");
  }

  const [schoolA, schoolB] = await Promise.all([
    prisma.user.findUnique({ where: { email: adminEmail } }),
    prisma.user.findUnique({ where: { email: schoolBEmail } }),
  ]);
  if (!schoolA || schoolA.role !== "SCHOOL_ADMIN") throw new Error("School A test account must exist as a SCHOOL_ADMIN in the E2E database.");
  if (!schoolA.isActive) throw new Error("School A E2E test account is inactive.");
  if (!(await bcrypt.compare(adminPassword, schoolA.passwordHash))) throw new Error("E2E_ADMIN_PASSWORD does not match the stored School A test account password.");
  if (!schoolB || schoolB.role !== "SCHOOL_ADMIN") throw new Error("School B test account must exist as a SCHOOL_ADMIN in the E2E database.");
  if (!schoolB.isActive) throw new Error("School B E2E test account is inactive.");
  if (!(await bcrypt.compare(schoolBPassword, schoolB.passwordHash))) throw new Error("E2E_SCHOOL_B_PASSWORD does not match the stored School B test account password.");
  if (schoolA.tenantId === schoolB.tenantId) {
    throw new Error("School A and School B test admins must belong to distinct tenants.");
  }
  const [schoolAStudents, schoolBStudents] = await Promise.all([
    prisma.student.count({ where: { tenantId: schoolA.tenantId } }),
    prisma.student.count({ where: { tenantId: schoolB.tenantId } }),
  ]);
  if (schoolAStudents === 0) throw new Error("School A E2E tenant has no existing student for tenant-isolation tests.");
  if (schoolBStudents === 0) throw new Error("School B E2E tenant has no existing student for tenant-isolation tests.");

  const emailValues = [adminEmail, schoolBEmail, ...roleConfig.map((item) => process.env[item.emailKey].toLowerCase())];
  if (new Set(emailValues).size !== emailValues.length) throw new Error("E2E account emails must be unique.");

  persistEnvValues({
    E2E_ADMIN_EMAIL: adminEmail,
    E2E_ADMIN_PASSWORD: adminPassword,
    E2E_SCHOOL_B_EMAIL: schoolBEmail,
    E2E_SCHOOL_B_PASSWORD: schoolBPassword,
    ...roleCredentials,
  });
  exportGithubActionsEnv({
    ...roleCredentials,
  });

  const outcomes = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const config of roleConfig) {
      const credentials = {
        role: config.role,
        email: process.env[config.emailKey],
        password: process.env[config.passwordKey],
        fullName: config.fullName,
        tenantId: schoolA.tenantId,
      };
      const account = await findOrCreateUser(tx, credentials);
      const profile = await ensureRoleProfile(tx, config.role, account.user, schoolA.tenantId);
      results.push({ role: config.role, accountCreated: account.created, profileCreated: profile.created, studentProfileCreated: profile.studentProfileCreated ?? false });
    }
    return results;
  });

  for (const result of outcomes) {
    const accountState = result.accountCreated ? "created" : "reused";
    const profileState = result.role === "ADMIN" ? "not applicable" : result.profileCreated ? "created" : "reused";
    const studentNote = result.role === "STUDENT" ? `; student profile ${result.studentProfileCreated ? "created" : "reused"}` : "";
    console.log(`${result.role}: account ${accountState}; profile ${profileState}${studentNote}`);
  }
}

main()
  .catch((error) => {
    if (error?.code === "P1001" || error?.code === "P1002") {
      console.error("E2E RBAC setup failed: could not connect to the configured E2E database.");
    } else {
      console.error(`E2E RBAC setup failed: ${error.message}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
