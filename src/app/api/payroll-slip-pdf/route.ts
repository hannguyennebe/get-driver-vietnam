import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

type Body = {
  companyName: string;
  createdDate: string; // dd/mm/yyyy
  driverName: string;
  driverPhone?: string;
  fromDate: string; // dd/mm/yyyy
  toDate: string; // dd/mm/yyyy
  part1: {
    salary20PctVnd: number;
    allowanceVnd: number;
    totalVnd: number;
  };
  part2: {
    advancesTotalVnd: number;
    advances: Array<{ date: string; amountVnd: number }>;
  };
  wallet: {
    walletName: string;
    balances: Record<string, number>; // multi-currency
  };
  part4: {
    receiveVnd: number;
  };
};

const REGULAR_TTF =
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const BOLD_TTF =
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

let fontCache: null | { regular: ArrayBuffer; bold: ArrayBuffer } = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch(REGULAR_TTF).then((r) => r.arrayBuffer()),
    fetch(BOLD_TTF).then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

function fmtVnd(n: number) {
  return `${Math.round(Number(n ?? 0) || 0).toLocaleString("vi-VN")} VND`;
}

function fmtCur(n: number, cur: string) {
  const c = String(cur || "VND").trim().toUpperCase() || "VND";
  const v = Math.round(Number(n ?? 0) || 0);
  return c === "VND" ? `${v.toLocaleString("vi-VN")} VND` : `${v.toLocaleString("en-US")} ${c}`;
}

function walletLines(balances: Record<string, number>) {
  const b = balances ?? {};
  const rows: Array<{ cur: string; amt: number }> = [];
  for (const [k, v] of Object.entries(b)) {
    const cur = String(k || "").trim().toUpperCase();
    if (!cur) continue;
    const amt = Number(v ?? 0) || 0;
    if (amt === 0) continue;
    rows.push({ cur, amt });
  }
  rows.sort((a, b) => (a.cur === "VND" ? -1 : 0) - (b.cur === "VND" ? -1 : 0) || a.cur.localeCompare(b.cur));
  if (rows.length === 0) rows.push({ cur: "VND", amt: 0 });
  return rows;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  try {
    const fonts = await loadFonts();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(fonts.regular, { subset: false });
    const fontBold = await pdfDoc.embedFont(fonts.bold, { subset: false });

    const margin = 40;
    const w = 595.28;
    let y = 805;

    const draw = (t: string, x: number, size: number, bold?: boolean) => {
      page.drawText(String(t ?? ""), { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      y -= size + 4;
    };
    const drawRight = (t: string, xRight: number, size: number, bold?: boolean) => {
      const txt = String(t ?? "");
      const f = bold ? fontBold : font;
      const tw = f.widthOfTextAtSize(txt, size);
      page.drawText(txt, { x: xRight - tw, y, size, font: f, color: rgb(0, 0, 0) });
    };

    // Header
    page.drawText(body.companyName || "Get Driver in Vietnam", {
      x: margin,
      y,
      size: 12,
      font: fontBold,
    });
    y -= 18;
    draw(`Ngày lập bảng: ${body.createdDate}`, margin, 9);
    y -= 6;

    // Title
    const title = "PHIẾU LƯƠNG";
    const tw = fontBold.widthOfTextAtSize(title, 18);
    page.drawText(title, { x: (w - tw) / 2, y, size: 18, font: fontBold });
    y -= 26;

    // Info block
    draw(`Họ tên lái xe: ${body.driverName || "—"}`, margin, 10, true);
    draw(`Số điện thoại: ${body.driverPhone || "—"}`, margin, 10, true);
    draw(`Khoảng thời gian: ${body.fromDate} — ${body.toDate}`, margin, 10);
    y -= 8;

    // Part 1
    draw("Phần 1: Lương theo doanh thu và phụ cấp", margin, 11, true);
    y -= 2;
    page.drawText("Tổng số tiền:", { x: margin, y, size: 10, font });
    drawRight(fmtVnd(body.part1.totalVnd), w - margin, 10, true);
    y -= 14;
    page.drawText("Tiền doanh thu (lương 20%):", { x: margin, y, size: 10, font });
    drawRight(fmtVnd(body.part1.salary20PctVnd), w - margin, 10);
    y -= 14;
    page.drawText("Tiền phụ cấp:", { x: margin, y, size: 10, font });
    drawRight(fmtVnd(body.part1.allowanceVnd), w - margin, 10);
    y -= 18;

    // Part 2
    draw("Phần 2: Tạm ứng", margin, 11, true);
    y -= 2;
    page.drawText("Tổng số tiền tạm ứng:", { x: margin, y, size: 10, font });
    drawRight(fmtVnd(body.part2.advancesTotalVnd), w - margin, 10, true);
    y -= 16;
    page.drawText("Chi tiết số lần tạm ứng:", { x: margin, y, size: 10, font: fontBold });
    y -= 12;

    if ((body.part2.advances ?? []).length === 0) {
      page.drawText("—", { x: margin, y, size: 10, font });
      y -= 16;
    } else {
      for (const a of body.part2.advances.slice(0, 5)) {
        page.drawText(`- ${a.date}`, { x: margin, y, size: 10, font });
        drawRight(fmtVnd(a.amountVnd), w - margin, 10);
        y -= 14;
      }
      y -= 6;
    }

    // Part 3: wallet balance
    draw("Phần 3: Số dư ví tài xế", margin, 11, true);
    y -= 6;
    page.drawText(`Tên ví: ${body.wallet.walletName || "—"}`, { x: margin, y, size: 10, font });
    y -= 14;
    const lines = walletLines(body.wallet.balances ?? {});
    for (const ln of lines.slice(0, 6)) {
      page.drawText(`- ${ln.cur}`, { x: margin, y, size: 10, font });
      drawRight(fmtCur(ln.amt, ln.cur), w - margin, 10, true);
      y -= 14;
    }
    y -= 10;

    // Part 4
    draw("Phần 4: Thanh toán / Hoàn trả", margin, 11, true);
    y -= 2;
    page.drawText("Tổng số tiền lái xe được nhận:", { x: margin, y, size: 10, font });
    drawRight(fmtVnd(body.part4.receiveVnd), w - margin, 10, true);
    y -= 26;

    // Signatures
    page.drawLine({ start: { x: margin, y }, end: { x: w - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 24;
    const colW = (w - margin * 2) / 3;
    const sigY = y;
    page.drawText("Người nhận / nộp tiền", { x: margin + colW * 0 + 10, y: sigY, size: 10, font: fontBold });
    page.drawText("Kế toán", { x: margin + colW * 1 + 10, y: sigY, size: 10, font: fontBold });
    page.drawText("Người lập bảng", { x: margin + colW * 2 + 10, y: sigY, size: 10, font: fontBold });

    const bytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "pdf_failed", message: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

