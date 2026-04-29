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
    return parsed?.projectId ? String(parsed.projectId) : null;
  } catch {
    return null;
  }
}

function readServiceAccountFromEnv():
  | { projectId?: string; clientEmail?: string; privateKey?: string }
  | null {
  // Option A: individual env vars (recommended for Vercel)
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = privateKeyRaw?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return { projectId: projectId || undefined, clientEmail, privateKey };
  }

  // Option B: single JSON env var (raw JSON or base64 JSON)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const jsonText =
      raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(jsonText) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed?.client_email || !parsed?.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key?.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function getAdminServices() {
  if (admin.apps.length === 0) {
    const projectId = resolveProjectId();
    const gcpProject =
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? null;

    // Prefer ADC on Google Cloud (Cloud Run / App Hosting)
    if (gcpProject) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(projectId ? { projectId } : {}),
      } as any);
    } else {
      // Vercel / local: use service account env if provided, else fallback to ADC.
      const sa = readServiceAccountFromEnv();
      admin.initializeApp({
        credential: sa
          ? admin.credential.cert({
              projectId: sa.projectId ?? projectId ?? undefined,
              clientEmail: sa.clientEmail,
              privateKey: sa.privateKey,
            } as any)
          : admin.credential.applicationDefault(),
        ...(sa?.projectId || projectId ? { projectId: sa?.projectId ?? projectId } : {}),
      } as any);
    }
  }
  return { auth: admin.auth(), db: admin.firestore() };
}

export async function verifyAdminFromAuthHeader(authHeader: string | null) {
  const match = (authHeader ?? "").match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1];
  if (!idToken) throw new Error("unauthorized");

  const { auth } = getAdminServices();
  const decoded = await auth.verifyIdToken(idToken);
  if (decoded.role !== "Admin") {
    throw new Error("forbidden");
  }
  return decoded;
}

