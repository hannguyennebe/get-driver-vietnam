import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import admin from "firebase-admin";
import { google } from "googleapis";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hm(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}-${m}`;
}

function resolveBucket(projectId: string) {
  const fromEnv = String(process.env.BACKUP_BUCKET ?? "").trim();
  if (fromEnv) return fromEnv;
  // Must exist and be globally unique; create this bucket once in GCS.
  return `${projectId}-firestore-backups`;
}

export const firestoreDailyBackup = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1",
    retryCount: 0,
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error("missing_project_id");
    }

    const bucket = resolveBucket(projectId);
    const now = new Date();
    const outputUriPrefix = `gs://${bucket}/firestore/${ymd(now)}/${hm(now)}`;

    logger.info("[backup] starting Firestore export", { projectId, outputUriPrefix });

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/datastore"],
    });
    const client = await auth.getClient();
    const firestore = google.firestore({ version: "v1", auth: client as any });

    const name = `projects/${projectId}/databases/(default)`;
    const res = await firestore.projects.databases.exportDocuments({
      name,
      requestBody: {
        outputUriPrefix,
      },
    });

    logger.info("[backup] export requested", {
      projectId,
      bucket,
      outputUriPrefix,
      operation: res.data?.name ?? null,
    });
  },
);

