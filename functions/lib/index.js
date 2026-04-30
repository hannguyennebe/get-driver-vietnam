"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreDailyBackup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const googleapis_1 = require("googleapis");
if (firebase_admin_1.default.apps.length === 0) {
    firebase_admin_1.default.initializeApp();
}
function ymd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function hm(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}-${m}`;
}
function resolveBucket(projectId) {
    const fromEnv = String(process.env.BACKUP_BUCKET ?? "").trim();
    if (fromEnv)
        return fromEnv;
    // Must exist and be globally unique; create this bucket once in GCS.
    return `${projectId}-firestore-backups`;
}
exports.firestoreDailyBackup = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1",
    retryCount: 0,
    timeoutSeconds: 540,
    memory: "256MiB",
}, async () => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
        throw new Error("missing_project_id");
    }
    const bucket = resolveBucket(projectId);
    const now = new Date();
    const outputUriPrefix = `gs://${bucket}/firestore/${ymd(now)}/${hm(now)}`;
    firebase_functions_1.logger.info("[backup] starting Firestore export", { projectId, outputUriPrefix });
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/datastore"],
    });
    const client = await auth.getClient();
    const firestore = googleapis_1.google.firestore({ version: "v1", auth: client });
    const name = `projects/${projectId}/databases/(default)`;
    const res = await firestore.projects.databases.exportDocuments({
        name,
        requestBody: {
            outputUriPrefix,
        },
    });
    firebase_functions_1.logger.info("[backup] export requested", {
        projectId,
        bucket,
        outputUriPrefix,
        operation: res.data?.name ?? null,
    });
});
