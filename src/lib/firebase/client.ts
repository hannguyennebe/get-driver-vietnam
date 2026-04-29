import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  // During `next build`, modules can be evaluated on the server as part of route analysis.
  // Avoid throwing at build-time; we validate at runtime on the client.
  if (apiKey && authDomain && projectId && appId) {
    return { apiKey, authDomain, projectId, appId } satisfies FirebaseWebConfig;
  }

  // Firebase Hosting "framework-aware" deployments can inject default Firebase config
  // without NEXT_PUBLIC_* env vars.
  try {
    const injected =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (typeof globalThis !== "undefined" && (globalThis as any).__FIREBASE_DEFAULTS__) ||
      process.env.__FIREBASE_DEFAULTS__;
    if (!injected) return null;
    const raw = typeof injected === "string" ? injected : JSON.stringify(injected);
    const parsed = JSON.parse(raw) as any;
    const cfg = parsed?.config?.firebase ?? parsed?.firebase ?? null;
    const a = String(cfg?.apiKey ?? "").trim();
    const d = String(cfg?.authDomain ?? "").trim();
    const p = String(cfg?.projectId ?? "").trim();
    const id = String(cfg?.appId ?? "").trim();
    if (!a || !d || !p || !id) return null;
    return { apiKey: a, authDomain: d, projectId: p, appId: id } satisfies FirebaseWebConfig;
  } catch {
    return null;
  }

}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

async function fetchHostingWebConfig(): Promise<FirebaseWebConfig | null> {
  if (typeof window === "undefined") return null;
  try {
    // Firebase Hosting standard endpoint that returns web config for the current site.
    const res = await fetch("/__/firebase/init.json", { cache: "no-store" });
    if (!res.ok) return null;
    const cfg = (await res.json()) as any;
    const a = String(cfg?.apiKey ?? "").trim();
    const d = String(cfg?.authDomain ?? "").trim();
    const p = String(cfg?.projectId ?? "").trim();
    const id = String(cfg?.appId ?? "").trim();
    if (!a || !d || !p || !id) return null;
    return { apiKey: a, authDomain: d, projectId: p, appId: id };
  } catch {
    return null;
  }
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is only available in the browser.");
  }

  const cfg = getFirebaseConfig();
  if (!cfg) {
    throw new Error(
      "Missing Firebase env vars. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID.",
    );
  }

  cachedApp = getApps().length > 0 ? getApps()[0]! : initializeApp(cfg);
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

export function getFirebaseDb(): Firestore {
  if (cachedDb) return cachedDb;
  // Ensure app is initialized (and thus config exists)
  const auth = getFirebaseAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void auth;
  if (!cachedApp) throw new Error("Firebase app not initialized");
  cachedDb = getFirestore(cachedApp);
  return cachedDb;
}

export async function initFirebaseDb(): Promise<Firestore | null> {
  if (cachedDb) return cachedDb;
  if (typeof window === "undefined") return null;
  const auth = await initFirebaseAuth();
  if (!auth) return null;
  if (!cachedApp) return null;
  cachedDb = getFirestore(cachedApp);
  return cachedDb;
}

export function tryGetFirebaseAuth(): Auth | null {
  try {
    return getFirebaseAuth();
  } catch {
    return null;
  }
}

export async function initFirebaseAuth(): Promise<Auth | null> {
  if (cachedAuth) return cachedAuth;
  if (typeof window === "undefined") return null;

  const cfg = getFirebaseConfig() ?? (await fetchHostingWebConfig());
  if (!cfg) return null;

  cachedApp = getApps().length > 0 ? getApps()[0]! : initializeApp(cfg);
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

