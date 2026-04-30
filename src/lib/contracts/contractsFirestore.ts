import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export type NtTemplateDoc = {
  block1: string;
  block2: string;
  block3: string;
  block4: string;
  block5: string;
  block6: string;
  block7: string;
  block8: string;
  block9: string;
  block10: string;
  updatedAt: number;
};

export type NtContractDoc = {
  id: string;
  fileName: string;
  createdAt: number;
  blocks: any;
  quotationId?: string;
  quotationTitle?: string;
};

const COL_TEMPL = "contracts_nt_templates";
const TEMPL_DOC = "singleton";
const COL_LIST = "contracts_nt_list";

export function subscribeNtTemplate(onDoc: (doc: NtTemplateDoc | null) => void): Unsubscribe {
  const db = getFirebaseDb();
  const ref = doc(db, COL_TEMPL, TEMPL_DOC);
  return onSnapshot(
    ref,
    (snap) => {
      onDoc(snap.exists() ? (snap.data() as NtTemplateDoc) : null);
    },
    () => onDoc(null),
  );
}

export async function upsertNtTemplate(patch: Partial<NtTemplateDoc>) {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, COL_TEMPL, TEMPL_DOC),
    { ...patch, updatedAt: Date.now() } as any,
    { merge: true },
  );
}

export function subscribeNtContracts(onRows: (rows: NtContractDoc[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_LIST), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: NtContractDoc[] = [];
      snap.forEach((d) => rows.push(d.data() as NtContractDoc));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertNtContract(next: NtContractDoc) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL_LIST, id), next, { merge: false });
}

export async function deleteNtContract(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL_LIST, String(id)));
}

