import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as fs from "node:fs";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function readServiceAccountJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  const j = JSON.parse(raw);
  if (!j.project_id || !j.client_email || !j.private_key) {
    throw new Error("Invalid service account JSON (missing project_id/client_email/private_key).");
  }
  return {
    projectId: String(j.project_id),
    clientEmail: String(j.client_email),
    privateKey: String(j.private_key),
  };
}

function normalizePhone(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  // Expect E.164 for Firebase phone auth.
  if (!s.startsWith("+")) return s;
  return s;
}

function phoneToSyntheticEmail(phone) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `${digits}@phone.getdriver.local`;
}

function initAdmin(opts) {
  if (getApps().length) return;
  const projectId = opts?.projectId ?? requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = opts?.clientEmail ?? requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = (opts?.privateKey ?? requireEnv("FIREBASE_PRIVATE_KEY")).replace(/\\n/g, "\n");
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const jsonIdx = argv.indexOf("--json");
  let svc = null;
  if (jsonIdx >= 0) {
    const p = argv[jsonIdx + 1];
    if (!p) throw new Error("Usage: --json /path/to/serviceAccountKey.json");
    svc = readServiceAccountJson(p);
    argv.splice(jsonIdx, 2);
  }

  const [phoneArg, passwordArg] = argv;
  const phone = normalizePhone(phoneArg);
  const password = String(passwordArg || "");

  if (!phone || phone.length < 8) {
    throw new Error("Usage: node scripts/create-admin.mjs [--json serviceAccountKey.json] +84901234567 YourPassword");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  initAdmin(svc ?? undefined);
  const auth = getAuth();

  const email = phoneToSyntheticEmail(phone);
  let user;
  try {
    user = await auth.getUserByPhoneNumber(phone);
  } catch {
    user = null;
  }

  if (!user) {
    user = await auth.createUser({
      phoneNumber: phone,
      email,
      emailVerified: true,
      password,
    });
  } else {
    // Ensure email + password exist on the phone user so the app can login using email/password.
    await auth.updateUser(user.uid, {
      email,
      emailVerified: true,
      password,
    });
  }

  await auth.setCustomUserClaims(user.uid, { role: "Admin" });

  console.log("Admin user ready:");
  console.log("- uid:", user.uid);
  console.log("- phone:", phone);
  console.log("- email:", email);
}

main().catch((e) => {
  // Print rich error to diagnose project/auth config issues.
  console.error("Failed to create admin user.");
  if (e?.errorInfo) console.error("code:", e.errorInfo.code);
  console.error(e);
  process.exit(1);
});

