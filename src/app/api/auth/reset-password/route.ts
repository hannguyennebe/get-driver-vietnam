import { NextResponse } from "next/server";
import admin from "firebase-admin";

function resolveProjectId(): string | null {
  const direct =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT;
  if (direct) return direct;

  const cfg = process.env.FIREBASE_CONFIG;
  if (!cfg) return null;
  try {
    const parsed = JSON.parse(cfg) as { projectId?: string };
    const pid = String(parsed?.projectId ?? "").trim();
    return pid || null;
  } catch {
    return null;
  }
}

function getAdminAuth() {
  if (admin.apps.length === 0) {
    const projectId = resolveProjectId();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    // Preferred on Google Cloud (Cloud Run / App Hosting SSR): ADC via attached service account.
    // This avoids needing FIREBASE_PRIVATE_KEY in env at runtime.
    if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
      if (!projectId) {
        const err = new Error(
          "Missing Firebase project id (set FIREBASE_PROJECT_ID or FIREBASE_CONFIG).",
        ) as Error & { code?: string };
        err.code = "missing_project_id";
        throw err;
      }

      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      } as any);
      return admin.auth();
    }

    // Local/dev / explicit service account env vars
    if (!projectId || !clientEmail || !privateKey) {
      const missing = [
        !projectId ? "FIREBASE_PROJECT_ID" : null,
        !clientEmail ? "FIREBASE_CLIENT_EMAIL" : null,
        !privateKey ? "FIREBASE_PRIVATE_KEY" : null,
      ].filter(Boolean);
      const err = new Error(
        `Missing Firebase Admin credentials. On Cloud Run use ADC; locally set ${missing.join(", ")}.`,
      ) as Error & { code?: string };
      err.code = "missing_admin_env";
      throw err;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      } as any),
    } as any);
  }

  return admin.auth();
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = match?.[1];
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { phone?: string; newPassword?: string };
    const phone = body.phone?.trim();
    const newPassword = body.newPassword;
    if (!phone || !newPassword) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken);

    const user = await adminAuth.getUserByPhoneNumber(phone);
    await adminAuth.updateUser(user.uid, { password: newPassword });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const anyErr = e as any;
    const code = String(anyErr?.code ?? anyErr?.errorInfo?.code ?? "unknown");
    const message = String(
      anyErr?.message ?? anyErr?.errorInfo?.message ?? "Unknown error",
    );

    // Ensure the real error shows up in Cloud Run logs for debugging.
    console.error("[reset-password] failed", { code, message, raw: anyErr });

    const status =
      code === "missing_admin_env" || code === "missing_project_id"
        ? 500
        : code === "auth/id-token-expired" || code === "auth/argument-error"
          ? 401
          : 400;
    return NextResponse.json({ error: code, message }, { status });
  }
}

