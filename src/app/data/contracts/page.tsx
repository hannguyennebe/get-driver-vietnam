"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Pencil } from "lucide-react";
import { getCompanyInfo } from "@/lib/admin/companyStore";
import type { TravelAgent } from "@/lib/data/partnersStore";
import { subscribeTravelAgents } from "@/lib/data/partnersFirestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPaymentInfo } from "@/lib/admin/paymentStore";
import {
  groupQuotations,
  type Quotation,
} from "@/lib/data/quotationStore";
import { subscribeQuotations } from "@/lib/data/quotationsFirestore";
import {
  deleteNtContract,
  subscribeNtContracts,
  subscribeNtTemplate,
  upsertNtContract,
  upsertNtTemplate,
  type NtContractDoc,
} from "@/lib/contracts/contractsFirestore";
import { useDocLock } from "@/lib/firestore/useDocLock";

export default function DataContractsPage() {
  const EARTH_BTN =
    "h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]";

  const blocks = React.useMemo<Array<{ id: number; title: string; content: string[] }>>(
    () => [
        {
          id: 1,
          title: "Tiêu ngữ",
          content: ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc"],
        },
        { id: 2, title: "Tiêu đề", content: ["HỢP ĐỒNG NGUYÊN TẮC"] },
        {
          id: 3,
          title: "Căn cứ pháp lý",
          content: [
            "Căn cứ vào Bộ Luật Dân Sự Việt Nam",
            "Căn cứ vào nhu cầu và khả năng của các bên",
          ],
        },
        {
          id: 4,
          title: "Thời gian & địa điểm",
          content: ["Được ký kết tại TPHCM ngày 25/04/2026"],
        },
        { id: 5, title: "Thông tin Bên A", content: ["THÔNG TIN BÊN A"] },
        { id: 6, title: "Thông tin Bên B", content: ["THÔNG TIN BÊN B"] },
        { id: 7, title: "Điều khoản", content: ["ĐIỀU KHOẢN CHUNG"] },
        { id: 8, title: "Thanh toán", content: ["THANH TOÁN"] },
        { id: 9, title: "Gia hạn", content: ["GIA HẠN VÀ CHẤM DỨT"] },
        { id: 10, title: "Tranh chấp", content: ["GIẢI QUYẾT TRANH CHẤP"] },
        { id: 11, title: "Chữ ký", content: ["CHỮ KÝ ĐẠI DIỆN"] },
      ],
    [],
  );

  const [showBlocks, setShowBlocks] = React.useState(false);
  const [openAll, setOpenAll] = React.useState(true);
  const [editingBlock1, setEditingBlock1] = React.useState(false);
  const [editingBlock2, setEditingBlock2] = React.useState(false);
  const [editingBlock3, setEditingBlock3] = React.useState(false);
  const [editingBlock4, setEditingBlock4] = React.useState(false);
  const [editingBlock5, setEditingBlock5] = React.useState(false);
  const [editingBlock6, setEditingBlock6] = React.useState(false);
  const [editingBlock7, setEditingBlock7] = React.useState(false);
  const [editingBlock8, setEditingBlock8] = React.useState(false);
  const [editingBlock9, setEditingBlock9] = React.useState(false);
  const [editingBlock10, setEditingBlock10] = React.useState(false);
  const [editingBlock11] = React.useState(false); // reserved (no edit)
  const [block1Text, setBlock1Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block1.v1");
    if (raw) return String(raw);
    return "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc";
  });
  const [block1Draft, setBlock1Draft] = React.useState(block1Text);

  const [block2Text, setBlock2Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block2.v1");
    if (raw) return String(raw);
    return defaultBlock2Text(new Date());
  });
  const [block2Draft, setBlock2Draft] = React.useState(block2Text);

  const [block3Text, setBlock3Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block3.v1");
    if (raw) return String(raw);
    return (
      "Căn cứ vào Bộ Luật Dân Sự Việt Nam\n" +
      "Căn cứ vào nhu cầu và khả năng của các bên"
    );
  });
  const [block3Draft, setBlock3Draft] = React.useState(block3Text);

  const [block4Text, setBlock4Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block4.v1");
    if (raw) return String(raw);
    try {
      const c = getCompanyInfo();
      return defaultBlock4Text(new Date(), c.address);
    } catch {
      return defaultBlock4Text(new Date(), "");
    }
  });
  const [block4Draft, setBlock4Draft] = React.useState(block4Text);

  const [block5Text, setBlock5Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block5.v1");
    if (raw) return String(raw);
    try {
      const c = getCompanyInfo();
      return defaultBlock5Text(c);
    } catch {
      return defaultBlock5Text(null);
    }
  });
  const [block5Draft, setBlock5Draft] = React.useState(block5Text);

  const [block6Text, setBlock6Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block6.v1");
    if (raw) return String(raw);
    return defaultBlock6Text(null);
  });
  const [block6Draft, setBlock6Draft] = React.useState(block6Text);
  const [openPickTa, setOpenPickTa] = React.useState(false);
  const [travelAgents, setTravelAgents] = React.useState<TravelAgent[]>([]);
  const [vatPay, setVatPay] = React.useState<{
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }>({ bankName: "—", accountNumber: "—", accountHolder: "—" });

  const [block7Text, setBlock7Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block7.v1");
    if (raw) return String(raw);
    return "ĐIỀU KHOẢN CHUNG";
  });
  const [block7Draft, setBlock7Draft] = React.useState(block7Text);

  const [block8Text, setBlock8Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block8.v1");
    if (raw) return String(raw);
    return "ĐIỀU KHOẢN & PHƯƠNG THỨC THANH TOÁN:\n";
  });
  const [block8Draft, setBlock8Draft] = React.useState(block8Text);

  const [block9Text, setBlock9Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block9.v1");
    if (raw) return String(raw);
    return "GIA HẠN VÀ CHẤM DỨT";
  });
  const [block9Draft, setBlock9Draft] = React.useState(block9Text);

  const [block10Text, setBlock10Text] = React.useState<string>(() => {
    const raw = lsGet("getdriver.contracts.nt.block10.v1");
    if (raw) return String(raw);
    return "GIẢI QUYẾT TRANH CHẤP";
  });
  const [block10Draft, setBlock10Draft] = React.useState(block10Text);

  const [openCreate, setOpenCreate] = React.useState(false);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string>("");
  const [openPickQuote, setOpenPickQuote] = React.useState(false);
  const [pickQuoteForId, setPickQuoteForId] = React.useState<string>("");
  const [quoteQuery, setQuoteQuery] = React.useState("");
  const [allQuotes, setAllQuotes] = React.useState<Quotation[]>([]);
  const [quoteGroups, setQuoteGroups] = React.useState<Array<{ id: string; title: string; rows: Quotation[] }>>([]);
  const [shareBusyId, setShareBusyId] = React.useState<string>("");
  const [list, setList] = React.useState<
    Array<{
      id: string;
      fileName: string;
      createdAt: number;
      blocks: any;
      quotationId?: string;
      quotationTitle?: string;
    }>
  >(
    () => {
      const raw = lsGet("getdriver.contracts.nt.list.v1");
      if (!raw) return [];
      try {
        return JSON.parse(raw) as any[];
      } catch {
        return [];
      }
    },
  );

  const anyEditing =
    editingBlock1 ||
    editingBlock2 ||
    editingBlock3 ||
    editingBlock4 ||
    editingBlock5 ||
    editingBlock6 ||
    editingBlock7 ||
    editingBlock8 ||
    editingBlock9 ||
    editingBlock10;

  const lock = useDocLock({
    resource: "contractsNt",
    resourceId: anyEditing ? "nt_template:singleton" : null,
    enabled: true,
  });

  const saveList = React.useCallback(
    (next: NtContractDoc[]) => {
      const prevIds = new Set((list ?? []).map((x: any) => String(x?.id ?? "")));
      const nextIds = new Set((next ?? []).map((x: any) => String(x?.id ?? "")));
      setList(next as any);
      // Firestore is source of truth; we still mirror to localStorage for backward-compat.
      lsSet("getdriver.contracts.nt.list.v1", JSON.stringify(next));
      for (const row of next) void upsertNtContract(row);
      for (const id of prevIds) {
        if (id && !nextIds.has(id)) void deleteNtContract(id);
      }
    },
    [list],
  );

  async function readPdfError(res: Response) {
    const ct = res.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as any;
        const code = typeof j?.error === "string" ? j.error : "unknown_error";
        const msg = typeof j?.message === "string" ? j.message.trim() : "";
        return msg
          ? `Không thể tạo PDF (HTTP ${res.status}) • ${code} • ${msg}`
          : `Không thể tạo PDF (HTTP ${res.status}) • ${code}`;
      }
      const t = await res.text();
      const msg = t?.trim() ? t.trim().slice(0, 180) : "unknown_error";
      return `Không thể tạo PDF (HTTP ${res.status}) • ${msg}`;
    } catch {
      return `Không thể tạo PDF (HTTP ${res.status})`;
    }
  }

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.contracts.nt.list")) {
        const raw = lsGet("getdriver.contracts.nt.list.v1");
        try {
          setList(raw ? (JSON.parse(raw) as any[]) : []);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  React.useEffect(() => {
    setBlock1Draft(block1Text);
  }, [block1Text]);

  React.useEffect(() => {
    setBlock2Draft(block2Text);
  }, [block2Text]);

  React.useEffect(() => {
    setBlock3Draft(block3Text);
  }, [block3Text]);

  React.useEffect(() => {
    setBlock4Draft(block4Text);
  }, [block4Text]);

  React.useEffect(() => {
    setBlock5Draft(block5Text);
  }, [block5Text]);

  React.useEffect(() => {
    setBlock6Draft(block6Text);
  }, [block6Text]);

  React.useEffect(() => {
    const unsub = subscribeTravelAgents(setTravelAgents);
    return () => unsub();
  }, []);

  React.useEffect(() => {
    const unsub = subscribeQuotations((all) => {
      setAllQuotes(all);
      const q = quoteQuery.trim().toLowerCase();
      const filtered = !q
        ? all
        : all.filter((x) => `${x.title} ${x.groupTitle}`.toLowerCase().includes(q));
      setQuoteGroups(groupQuotations(filtered));
    });
    return () => unsub();
  }, [quoteQuery]);

  React.useEffect(() => {
    const unsubTempl = subscribeNtTemplate((t) => {
      if (!t) return;
      setBlock1Text(t.block1 ?? block1Text);
      setBlock2Text(t.block2 ?? block2Text);
      setBlock3Text(t.block3 ?? block3Text);
      setBlock4Text(t.block4 ?? block4Text);
      setBlock5Text(t.block5 ?? block5Text);
      setBlock6Text(t.block6 ?? block6Text);
      setBlock7Text(t.block7 ?? block7Text);
      setBlock8Text(t.block8 ?? block8Text);
      setBlock9Text(t.block9 ?? block9Text);
      setBlock10Text(t.block10 ?? block10Text);
    });
    const unsubList = subscribeNtContracts((rows) => setList(rows as any));
    return () => {
      unsubTempl();
      unsubList();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const loadPay = () => {
      try {
        const p = getPaymentInfo();
        setVatPay({
          bankName: p.vatVnd.bankName || "—",
          accountNumber: p.vatVnd.accountNumber || "—",
          accountHolder: p.vatVnd.accountHolder || "—",
        });
      } catch {
        setVatPay({ bankName: "—", accountNumber: "—", accountHolder: "—" });
      }
    };
    loadPay();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.payment.info")) loadPay();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => loadPay();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  React.useEffect(() => {
    setBlock7Draft(block7Text);
  }, [block7Text]);

  React.useEffect(() => {
    setBlock8Draft(block8Text);
  }, [block8Text]);

  React.useEffect(() => {
    setBlock9Draft(block9Text);
  }, [block9Text]);

  React.useEffect(() => {
    setBlock10Draft(block10Text);
  }, [block10Text]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Hợp Đồng Nguyên Tắc
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Click để ẩn/hiện các block trong hợp đồng (demo).
              </p>
            </div>
            <button
              type="button"
              className={EARTH_BTN + " mt-1 px-4"}
              onClick={() => {
                // Open create dialog with current template as draft.
                const now = new Date();
                const next2 = defaultBlock2Text(now);
                setBlock2Text(next2);
                lsSet("getdriver.contracts.nt.block2.v1", next2);
                try {
                  const c = getCompanyInfo();
                  const next4 = defaultBlock4Text(now, c.address);
                  setBlock4Text(next4);
                  lsSet("getdriver.contracts.nt.block4.v1", next4);
                } catch {}
                try {
                  const c = getCompanyInfo();
                  const next5 = defaultBlock5Text(c);
                  setBlock5Text(next5);
                  lsSet("getdriver.contracts.nt.block5.v1", next5);
                } catch {}
                setOpenAll(true);
                setPdfError(null);
                setPdfUrl("");
                setOpenCreate(true);
              }}
            >
              Tạo Hợp Đồng Mới
            </button>
          </div>
          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Hợp Đồng Nguyên Tắc
              </div>
              <button
                type="button"
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                onClick={() => {
                  if (!showBlocks) {
                    setShowBlocks(true);
                    setOpenAll(true);
                  } else {
                    setShowBlocks(false);
                  }
                }}
              >
                {showBlocks ? "Ẩn 11 Block" : "Hiện 11 Block"}
              </button>
            </div>

            {showBlocks ? (
              <div className="mt-4 space-y-2">
                {blocks.map((b) => (
                  <details
                    key={b.id}
                    open={openAll}
                    className="group overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-[#E9F4FF] px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#D7ECFF] px-2 py-1 text-[10px] font-semibold text-[#0B79B8]">
                          Block {b.id}
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {b.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.id === 1 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 1"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock1(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 2 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 2"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock2(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 3 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 3"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock3(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 4 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 4"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock4(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 5 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 5"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock5(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 6 ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " h-8 px-3 text-xs"}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenPickTa(true);
                              }}
                            >
                              Chọn Travel Agent
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                              aria-label="Sửa Block 6"
                              title="Sửa"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (lock.isReady && !lock.canEdit) return;
                                setEditingBlock6(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        ) : b.id === 7 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 7"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock7(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 8 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 8"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock8(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 9 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 9"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock9(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : b.id === 10 ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            aria-label="Sửa Block 10"
                            title="Sửa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (lock.isReady && !lock.canEdit) return;
                              setEditingBlock10(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        <span className="text-zinc-500 transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </div>
                    </summary>
                  {b.id === 1 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock1 ? (
                        <div className="space-y-1">
                          {block1Text
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[120px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block1Draft}
                            onChange={(e) => setBlock1Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock1(false);
                                setBlock1Draft(block1Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              disabled={Boolean(lock.isReady && !lock.canEdit)}
                              onClick={() => {
                                if (lock.isReady && !lock.canEdit) return;
                                const next = block1Draft.trim() || block1Text;
                                setBlock1Text(next);
                                lsSet("getdriver.contracts.nt.block1.v1", next);
                                setEditingBlock1(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 2 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock2 ? (
                        <div className="space-y-1">
                          {block2Text
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, idx) => (
                              <div key={idx} className={idx === 0 ? "font-semibold" : ""}>
                                {line}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[140px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block2Draft}
                            onChange={(e) => setBlock2Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock2(false);
                                setBlock2Draft(block2Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block2Draft.trim() || block2Text;
                                setBlock2Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block2.v1", next);
                                setEditingBlock2(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 3 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock3 ? (
                        <div className="space-y-1">
                          {block3Text
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[160px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block3Draft}
                            onChange={(e) => setBlock3Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock3(false);
                                setBlock3Draft(block3Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block3Draft.trim() || block3Text;
                                setBlock3Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block3.v1", next);
                                setEditingBlock3(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 4 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock4 ? (
                        <div className="space-y-1">
                          {block4Text
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[140px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block4Draft}
                            onChange={(e) => setBlock4Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock4(false);
                                setBlock4Draft(block4Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block4Draft.trim() || block4Text;
                                setBlock4Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block4.v1", next);
                                setEditingBlock4(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 5 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock5 ? (
                        <div className="space-y-1">
                          {block5Text
                            .split("\n")
                            .map((line) => line.trimEnd())
                            .filter((line) => line.trim().length > 0)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block5Draft}
                            onChange={(e) => setBlock5Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock5(false);
                                setBlock5Draft(block5Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block5Draft.trim() || block5Text;
                                setBlock5Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block5.v1", next);
                                setEditingBlock5(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 6 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock6 ? (
                        <div className="space-y-1">
                          {block6Text
                            .split("\n")
                            .map((line) => line.trimEnd())
                            .filter((line) => line.trim().length > 0)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block6Draft}
                            onChange={(e) => setBlock6Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock6(false);
                                setBlock6Draft(block6Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block6Draft.trim() || block6Text;
                                setBlock6Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block6.v1", next);
                                setEditingBlock6(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 7 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock7 ? (
                        <div className="space-y-1">
                          {block7Text
                            .split("\n")
                            .map((line) => line.trimEnd())
                            .filter((line) => line.trim().length > 0)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block7Draft}
                            onChange={(e) => setBlock7Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock7(false);
                                setBlock7Draft(block7Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block7Draft.trim() || block7Text;
                                setBlock7Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block7.v1", next);
                                setEditingBlock7(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 8 ? (
                    <div className="space-y-4 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                          ĐIỀU KHOẢN &amp; PHƯƠNG THỨC THANH TOÁN
                        </div>
                        {!editingBlock8 ? (
                          <div className="mt-2 space-y-1 text-sm">
                            {block8Text
                              .split("\n")
                              .map((line) => line.trimEnd())
                              .filter((line) => line.trim().length > 0)
                              .map((line, idx) => (
                                <div key={idx}>{line}</div>
                              ))}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-3">
                            <textarea
                              className="min-h-[180px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                              value={block8Draft}
                              onChange={(e) => setBlock8Draft(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className={EARTH_BTN + " px-4"}
                                onClick={() => {
                                  setEditingBlock8(false);
                                  setBlock8Draft(block8Text);
                                }}
                              >
                                Huỷ
                              </button>
                              <button
                                type="button"
                                className={EARTH_BTN + " px-4"}
                                onClick={() => {
                                  const next = block8Draft.trim() || block8Text;
                                  setBlock8Text(next);
                                  if (lock.isReady && !lock.canEdit) return;
                                  lsSet("getdriver.contracts.nt.block8.v1", next);
                                  setEditingBlock8(false);
                                }}
                              >
                                Lưu
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                          THÔNG TIN THANH TOÁN
                        </div>
                        <div className="mt-2 grid gap-2 text-sm">
                          <div>
                            <b>Ngân hàng:</b> {vatPay.bankName}
                          </div>
                          <div>
                            <b>Số tài khoản:</b> {vatPay.accountNumber}
                          </div>
                          <div>
                            <b>Chủ tài khoản:</b> {vatPay.accountHolder}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : b.id === 9 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock9 ? (
                        <div className="space-y-1">
                          {block9Text
                            .split("\n")
                            .map((line) => line.trimEnd())
                            .filter((line) => line.trim().length > 0)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block9Draft}
                            onChange={(e) => setBlock9Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock9(false);
                                setBlock9Draft(block9Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block9Draft.trim() || block9Text;
                                setBlock9Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block9.v1", next);
                                setEditingBlock9(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 10 ? (
                    <div className="space-y-3 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {!editingBlock10 ? (
                        <div className="space-y-1">
                          {block10Text
                            .split("\n")
                            .map((line) => line.trimEnd())
                            .filter((line) => line.trim().length > 0)
                            .map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                            value={block10Draft}
                            onChange={(e) => setBlock10Draft(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                setEditingBlock10(false);
                                setBlock10Draft(block10Text);
                              }}
                            >
                              Huỷ
                            </button>
                            <button
                              type="button"
                              className={EARTH_BTN + " px-4"}
                              onClick={() => {
                                const next = block10Draft.trim() || block10Text;
                                setBlock10Text(next);
                                if (lock.isReady && !lock.canEdit) return;
                                lsSet("getdriver.contracts.nt.block10.v1", next);
                                setEditingBlock10(false);
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : b.id === 11 ? (
                    <div className="px-4 py-6 text-sm text-zinc-700 dark:text-zinc-200">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="text-center">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            ĐẠI DIỆN BÊN A
                          </div>
                          <div className="mt-10 h-14" aria-hidden />
                          <div className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">
                            {extractAfterLabel(block5Text, ["Đại diện", "Đại diện :"]) ||
                              "—"}
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            ĐẠI DIỆN BÊN B
                          </div>
                          <div className="mt-10 h-14" aria-hidden />
                          <div className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">
                            {extractAfterLabel(block6Text, ["Ngừoi đại diện", "Người đại diện"]) ||
                              "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {b.content.map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  )}
                  </details>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Danh Sách Hợp Đồng
            </div>
            <div className="mt-3 space-y-3">
              {list.map((r, idx) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                        {r.fileName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>#{idx + 1}</span>
                        <span>•</span>
                        <span>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                        <span>•</span>
                        <span className={r.quotationId ? "text-emerald-700 dark:text-emerald-400" : ""}>
                          {r.quotationTitle ? `Báo giá: ${r.quotationTitle}` : "Chưa gắn báo giá"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(r.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      className={EARTH_BTN + " h-9 px-4"}
                      onClick={async () => {
                        setPdfBusy(true);
                        setPdfError(null);
                        try {
                          const res = await fetch("/api/contract-nt-pdf", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileName: r.fileName,
                              createdDate: new Date(r.createdAt).toLocaleDateString("vi-VN"),
                              blocks: r.blocks,
                            }),
                          });
                          if (!res.ok) {
                            setPdfError(await readPdfError(res));
                            throw new Error("pdf_failed");
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          setPdfUrl(url);
                          setOpenCreate(true);
                        } catch {
                          setPdfError((v) => v ?? "Không thể tạo PDF. Vui lòng thử lại.");
                        } finally {
                          setPdfBusy(false);
                        }
                      }}
                    >
                      Xem PDF
                    </button>

                    <button
                      type="button"
                      className={EARTH_BTN + " h-9 px-4"}
                      onClick={() => {
                        setPickQuoteForId(r.id);
                        setQuoteQuery("");
                        setOpenPickQuote(true);
                      }}
                    >
                      Gắn báo giá
                    </button>

                    <button
                      type="button"
                      disabled={shareBusyId === r.id}
                      className={EARTH_BTN + " h-9 px-4 disabled:opacity-60"}
                      onClick={async () => {
                        setShareBusyId(r.id);
                        setPdfError(null);
                        try {
                          const parts: File[] = [];

                          // Contract PDF
                          const resC = await fetch("/api/contract-nt-pdf", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              fileName: r.fileName,
                              createdDate: new Date(r.createdAt).toLocaleDateString("vi-VN"),
                              blocks: r.blocks,
                            }),
                          });
                          if (!resC.ok) {
                            setPdfError(await readPdfError(resC));
                            throw new Error("pdf_failed");
                          }
                          const blobC = await resC.blob();
                          parts.push(new File([blobC], `${r.fileName}.pdf`, { type: "application/pdf" }));

                          // Quotation PDF (optional)
                          if (r.quotationId) {
                            const qx = allQuotes.find((q) => q.id === r.quotationId) ?? null;
                            if (qx) {
                              const qFile = `BAO-GIA-${sanitizeFileName(qx.title) || qx.id}`;
                              const resQ = await fetch("/api/quotation-pdf", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  fileName: qFile,
                                  createdDate: new Date(r.createdAt).toLocaleDateString("vi-VN"),
                                  title: qx.title,
                                  lines: qx.lines,
                                }),
                              });
                              if (!resQ.ok) {
                                setPdfError(await readPdfError(resQ));
                                throw new Error("pdf_failed");
                              }
                              const blobQ = await resQ.blob();
                              parts.push(new File([blobQ], `${qFile}.pdf`, { type: "application/pdf" }));
                            }
                          }

                          const text =
                            `Bộ hợp đồng: ${r.fileName}\n` +
                            (r.quotationTitle ? `Báo giá: ${r.quotationTitle}\n` : "Chưa gắn báo giá\n") +
                            "Get Driver in Vietnam";

                          const canShareFiles =
                            typeof navigator !== "undefined" &&
                            "canShare" in navigator &&
                            (navigator as any).canShare?.({ files: parts });

                          if (typeof navigator !== "undefined" && "share" in navigator && canShareFiles) {
                            await (navigator as any).share({
                              title: "Bộ hợp đồng",
                              text,
                              files: parts,
                            });
                          } else if (typeof navigator !== "undefined" && "share" in navigator) {
                            await (navigator as any).share({ title: "Bộ hợp đồng", text });
                          } else {
                            const clip = (globalThis as any)?.navigator?.clipboard;
                            if (clip?.writeText) await clip.writeText(text);
                            setPdfError(
                              "Thiết bị không hỗ trợ chia sẻ file. Mình đã copy nội dung để bạn dán vào Email/Zalo/Whatsapp.",
                            );
                          }
                        } catch {
                          setPdfError((v) => v ?? "Không thể chia sẻ. Vui lòng thử lại.");
                        } finally {
                          setShareBusyId("");
                        }
                      }}
                    >
                      Chia sẻ
                    </button>
                  </div>
                </div>
              ))}

              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                  Chưa có hợp đồng nào.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openPickTa} onOpenChange={setOpenPickTa}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn Travel Agent</DialogTitle>
            <DialogDescription>Chọn 1 Travel Agent để tự điền thông tin Bên B.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[360px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            {travelAgents.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">Chưa có Travel Agent.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {travelAgents.map((ta) => (
                  <button
                    key={ta.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    onClick={() => {
                      const next = defaultBlock6Text(ta);
                      setBlock6Text(next);
                      lsSet("getdriver.contracts.nt.block6.v1", next);
                      setEditingBlock6(false);
                      setOpenPickTa(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {ta.name}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {ta.contactName ?? "—"} • {ta.phone ?? "—"} • {ta.email ?? "—"}
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {ta.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openPickQuote}
        onOpenChange={(v) => {
          setOpenPickQuote(v);
          if (!v) setPickQuoteForId("");
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Gắn báo giá</DialogTitle>
            <DialogDescription>Chọn 1 báo giá để gắn vào hợp đồng.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <input
              value={quoteQuery}
              onChange={(e) => setQuoteQuery(e.target.value)}
              placeholder="Tìm theo tên báo giá..."
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <div className="mt-3 max-h-[360px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            {quoteGroups.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">Chưa có báo giá.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {quoteGroups.map((g) => (
                  <div key={g.id}>
                    <div className="bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                      {g.title}
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                      {g.rows.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                          onClick={() => {
                            const next = list.map((it) =>
                              it.id === pickQuoteForId
                                ? { ...it, quotationId: q.id, quotationTitle: q.title }
                                : it,
                            );
                            saveList(next);
                            setOpenPickQuote(false);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {q.title}
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                              {q.lines.length} dòng • {q.id}
                            </div>
                          </div>
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            Chọn
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCreate}
        onOpenChange={(v) => {
          setOpenCreate(v);
          if (!v) {
            setPdfUrl("");
            setPdfError(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Hợp đồng nguyên tắc</DialogTitle>
            <DialogDescription>
              Xem trước 11 block. Bấm Tạo để xuất PDF và lưu vào danh sách.
            </DialogDescription>
          </DialogHeader>

          {pdfUrl ? (
            <div className="space-y-3">
              <iframe title="PDF preview" src={pdfUrl} className="h-[70vh] w-full rounded-lg border" />
              <div className="flex justify-end gap-2">
                <a
                  className={EARTH_BTN + " inline-flex h-10 items-center px-4"}
                  href={pdfUrl}
                  download={`${sanitizeFileName(block2Text)}.pdf`}
                >
                  Lưu
                </a>
                <button
                  type="button"
                  className={EARTH_BTN + " h-10 px-4"}
                  onClick={async () => {
                    try {
                      const res = await fetch(pdfUrl);
                      const blob = await res.blob();
                      const file = new File([blob], `${sanitizeFileName(block2Text)}.pdf`, { type: "application/pdf" });
                      // @ts-ignore
                      if (navigator.share) {
                        // @ts-ignore
                        await navigator.share({ files: [file], title: "Hợp đồng nguyên tắc" });
                      } else {
                        await navigator.clipboard.writeText(pdfUrl);
                      }
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Chia sẻ
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="p-4 space-y-2">
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 1</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block1Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 2</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block2Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 3</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block3Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 4</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block4Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 5</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block5Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 6</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block6Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 7</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block7Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 8</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block8Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 9</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block9Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 10</summary>
                    <pre className="whitespace-pre-wrap px-4 py-3 text-sm">{block10Text}</pre>
                  </details>
                  <details open className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <summary className="cursor-pointer bg-[#E9F4FF] px-4 py-2 text-sm font-medium">Block 11</summary>
                    <div className="px-4 py-3 text-sm">
                      {extractAfterLabel(block5Text, ["Đại diện", "Đại diện :"]) || "—"} •{" "}
                      {extractAfterLabel(block6Text, ["Ngừoi đại diện", "Người đại diện"]) || "—"}
                    </div>
                  </details>
                </div>
              </div>

              {pdfError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {pdfError}
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className={EARTH_BTN + " h-10 w-1/2"}
                  onClick={() => setOpenCreate(false)}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className={EARTH_BTN + " h-10 w-1/2 disabled:opacity-60"}
                  disabled={pdfBusy}
                  onClick={async () => {
                    setPdfBusy(true);
                    setPdfError(null);
                    try {
                      const companyB =
                        extractAfterLabel(block6Text, [
                          "Tên công ty",
                          "Tên công ty :",
                          "Tên Công Ty",
                          "Tên Công Ty :",
                        ]) || "BEN-B";
                      const fileName = `HOP-DONG-NGUYEN-TAC-${sanitizeFileName(companyB) || "BEN-B"}`;
                      const payload = {
                        fileName,
                        createdDate: new Date().toLocaleDateString("vi-VN"),
                        blocks: {
                          block1: block1Text,
                          block2: block2Text,
                          block3: block3Text,
                          block4: block4Text,
                          block5: block5Text,
                          block6: block6Text,
                          block7: block7Text,
                          block8_terms: block8Text,
                          block8_paymentInfo: {
                            bankName: vatPay.bankName,
                            accountNumber: vatPay.accountNumber,
                            accountHolder: vatPay.accountHolder,
                          },
                          block9: block9Text,
                          block10: block10Text,
                          signAName: extractAfterLabel(block5Text, ["Đại diện", "Đại diện :"]) || "—",
                          signBName: extractAfterLabel(block6Text, ["Ngừoi đại diện", "Người đại diện"]) || "—",
                        },
                      };
                      const res = await fetch("/api/contract-nt-pdf", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        setPdfError(await readPdfError(res));
                        throw new Error("pdf_failed");
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      setPdfUrl(url);
                      const entry = {
                        id: `CNT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        fileName,
                        createdAt: Date.now(),
                        blocks: payload.blocks,
                      };
                      saveList([entry, ...list]);
                    } catch {
                      setPdfError((v) => v ?? "Không thể tạo PDF. Vui lòng thử lại.");
                    } finally {
                      setPdfBusy(false);
                    }
                  }}
                >
                  Tạo
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function defaultBlock2Text(now: Date) {
  const year = now.getFullYear();
  const n = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return (
    "HỢP ĐỒNG NGUYÊN TẮC\n" +
    "(v/v: cung cấp dịch vụ vận chuyển hành khách )\n" +
    `(Số: ${n}.${year} / HĐNT )`
  );
}

function defaultBlock4Text(now: Date, companyAddress: string) {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const addr = companyAddress?.trim() ? companyAddress.trim() : "(địa chỉ công ty)";
  return `Hôm nay, ngày ${dd} tháng ${mm} năm ${yyyy}, tại địa chỉ: ${addr} - Chúng tôi gồm có:`;
}

function defaultBlock5Text(c: ReturnType<typeof getCompanyInfo> | null) {
  const name = c?.name ?? "";
  const rep = c?.representative ?? "";
  const tax = c?.taxCode ?? "";
  const addr = c?.address ?? "";
  const web = c?.website ?? "";
  const phone = c?.phone ?? "";
  const email = c?.email ?? "";
  return (
    "Bên cho thuê dịch vụ vận chuyển : ( Gọi tắt là bên A )\n" +
    `Tên Công Ty: ${name}\n` +
    `Đại diện : ${rep}\n` +
    `Mã Số Thuế: ${tax}\n` +
    `Địa Chỉ : ${addr}              Website: ${web}\n` +
    `ĐIện Thoại : ${phone}   Email: ${email}`
  );
}

function defaultBlock6Text(ta: TravelAgent | null) {
  const name = ta?.name ?? "";
  const rep = ta?.contactName ?? "";
  const tax = "—";
  const addr = ta?.address?.trim() ? ta.address.trim() : "—";
  const web = ta?.website?.trim() ? ta.website.trim() : "—";
  const phone = ta?.phone ?? "";
  const email = ta?.email ?? "";
  return (
    "Bên thuê dịch vụ vận chuyển : ( Gọi tắt là bên B ) :\n" +
    `Tên công ty: ${name}\n` +
    `Ngừoi đại diện: ${rep}\n` +
    `Mã Số Thuế: ${tax}\n` +
    `Địa Chỉ : ${addr}     Website: ${web}\n` +
    `Điện thoại: ${phone}    Email: ${email}`
  );
}

function extractAfterLabel(text: string, labels: string[]) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim());
  for (const line of lines) {
    for (const lb of labels) {
      const normLb = lb.replace(/\s+/g, " ").trim();
      const normLine = line.replace(/\s+/g, " ").trim();
      // Match patterns like: "Đại diện : xxx" or "Ngừoi đại diện: xxx"
      if (normLine.toLowerCase().startsWith(normLb.toLowerCase())) {
        const idx = normLine.indexOf(":");
        if (idx >= 0) return normLine.slice(idx + 1).trim();
        const parts = normLine.split(" ");
        return parts.slice(1).join(" ").trim();
      }
    }
  }
  // fallback: try regex
  for (const lb of labels) {
    const re = new RegExp(`${escapeRe(lb)}\\s*:?\\s*(.+)$`, "im");
    const m = String(text || "").match(re);
    if (m?.[1]) return String(m[1]).trim();
  }
  return "";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeFileName(s: string) {
  const first = String(s || "").split("\n")[0] || "";
  // Force ASCII-only filename to avoid PDF/header encoding issues in some runtimes.
  const ascii = first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return ascii
    .replace(/[^a-zA-Z0-9\-_. ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function lsGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
  const m = String(key || "").match(/^getdriver\.contracts\.nt\.block(\d+)\.v1$/);
  if (m?.[1]) {
    const n = Number(m[1]);
    const v = String(value || "");
    if (n === 1) void upsertNtTemplate({ block1: v });
    else if (n === 2) void upsertNtTemplate({ block2: v });
    else if (n === 3) void upsertNtTemplate({ block3: v });
    else if (n === 4) void upsertNtTemplate({ block4: v });
    else if (n === 5) void upsertNtTemplate({ block5: v });
    else if (n === 6) void upsertNtTemplate({ block6: v });
    else if (n === 7) void upsertNtTemplate({ block7: v });
    else if (n === 8) void upsertNtTemplate({ block8: v });
    else if (n === 9) void upsertNtTemplate({ block9: v });
    else if (n === 10) void upsertNtTemplate({ block10: v });
  }
}

