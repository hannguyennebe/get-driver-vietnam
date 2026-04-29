import { NextResponse } from "next/server";

export async function GET() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY ?? "";

  // Do NOT return secrets. Only return shape/health signals.
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const starts = privateKey.trimStart().startsWith("-----BEGIN PRIVATE KEY-----");
  const ends = privateKey.trimEnd().endsWith("-----END PRIVATE KEY-----");

  const envKeys = Object.keys(process.env)
    .filter((k) => k.startsWith("FIREBASE_") || k.startsWith("NEXT_PUBLIC_FIREBASE_"))
    .sort();

  const gcpProject =
    process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? null;
  const hasFirebaseConfig = Boolean(process.env.FIREBASE_CONFIG);
  const likelyUsesAdc = Boolean(gcpProject);

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV ?? null,
    kService: process.env.K_SERVICE ?? null,
    kRevision: process.env.K_REVISION ?? null,
    kConfiguration: process.env.K_CONFIGURATION ?? null,
    port: process.env.PORT ?? null,
    gcpProject,
    hasFirebaseConfig,
    likelyUsesAdc,
    envKeySample: envKeys,
    hasProjectId: Boolean(projectId),
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(privateKeyRaw),
    privateKeyLength: privateKeyRaw.length,
    privateKeyHasEscapedNewlines: privateKeyRaw.includes("\\n"),
    privateKeyLooksLikePem: starts && ends,
    privateKeyStartsWithBegin: starts,
    privateKeyEndsWithEnd: ends,
  });
}

