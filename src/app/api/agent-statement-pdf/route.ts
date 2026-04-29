import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

type Body = {
  companyName: string;
  createdDate: string; // dd/mm/yyyy
  agentName: string;
  month: number;
  year: number;
  rows: Array<{
    stt: number;
    date: string; // dd/mm/yyyy
    customerName: string;
    itinerary: string;
    qty: number;
    unitPrice: number;
    amount: number;
    thuHo: number;
    thuHoCurrency: string;
  }>;
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

function truncateFast(text: string, colIdx: number) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const limit =
    colIdx === 0 ? 4 :
    colIdx === 1 ? 10 :
    colIdx === 2 ? 18 :
    colIdx === 3 ? 48 :
    colIdx === 4 ? 4 :
    colIdx === 5 ? 14 :
    colIdx === 6 ? 14 :
    14;
  if (t.length <= limit) return t;
  return t.slice(0, Math.max(1, limit - 1)) + "…";
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
    let y = 800;
    const drawText = (t: string, x: number, size: number, bold?: boolean) => {
      page.drawText(t, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
      y -= size + 4;
    };

    drawText(body.companyName || "Get Driver in Vietnam", margin, 14, true);
    drawText(`Ngày lập: ${body.createdDate}`, margin, 10);
    y -= 4;
    drawText("ĐỀ NGHỊ THANH TOÁN", margin, 12, true);
    drawText(`Kính gửi: ${body.agentName}`, margin, 10);
    drawText(`Kỳ công nợ: Tháng ${body.month}/${body.year}`, margin, 10);
    y -= 8;

    const headers = ["STT", "Ngày đi", "Tên khách", "Hành trình", "SL", "Đơn giá", "Thành tiền", "Thu hộ"];
    const cols = [28, 60, 95, 180, 26, 55, 60, 55];
    const startX = margin;
    const headerY = y;
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i]!, { x, y: headerY, size: 9, font: fontBold });
      x += cols[i]!;
    }
    y -= 14;
    page.drawLine({
      start: { x: margin, y },
      end: { x: 595.28 - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 8;

    const fmtVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} VND`;
    const rowSize = 8.5;

    for (const r of body.rows ?? []) {
      if (y < 70) break;
      const cells = [
        String(r.stt),
        r.date,
        r.customerName || "—",
        r.itinerary || "—",
        String(r.qty || 0),
        fmtVnd(r.unitPrice),
        fmtVnd(r.amount),
        r.thuHo > 0 ? `${Math.round(r.thuHo).toLocaleString("vi-VN")} ${String(r.thuHoCurrency || "VND")}` : "—",
      ];
      x = startX;
      for (let i = 0; i < cells.length; i++) {
        page.drawText(truncateFast(cells[i]!, i), { x, y, size: rowSize, font });
        x += cols[i]!;
      }
      y -= 14;
    }

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

