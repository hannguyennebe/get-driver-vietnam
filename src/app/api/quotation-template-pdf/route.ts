import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const runtime = "nodejs";

type Body = {
  fileName: string; // ASCII
  updatedDate: string; // dd/mm/yyyy
  columns: string[]; // vehicle type names, left-to-right
  rows: Array<{
    itinerary: string;
    prices: Record<string, string | number>; // key = column label
  }>;
};

let fontCache: null | { regular: ArrayBuffer; bold: ArrayBuffer } = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const regularAbs = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
  const boldAbs = path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf");
  const [regular, bold] = await Promise.all([
    fs.readFile(regularAbs).then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)),
    fs.readFile(boldAbs).then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

function clampText(s: unknown, max = 200) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function asMoneyVnd(v: unknown) {
  const raw = String(v ?? "").replace(/[^\d]/g, "");
  const n = raw ? Number(raw) : Number(v ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n).toLocaleString("vi-VN")} VNĐ`;
}

function drawWrapped(opts: {
  page: any;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: any;
  size: number;
  color: any;
}) {
  const words = String(opts.text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    const width = opts.font.widthOfTextAtSize(next, opts.size);
    if (width <= opts.maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  for (const ln of lines) {
    opts.page.drawText(ln, { x: opts.x, y: opts.y, size: opts.size, font: opts.font, color: opts.color });
    opts.y -= opts.lineHeight;
  }
  return opts.y;
}

function sanitizePdfFilenameAscii(s: string) {
  return String(s || "bang-bao-gia")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\-_. ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "bang-bao-gia";
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
    const font = await pdfDoc.embedFont(fonts.regular, { subset: false });
    const fontBold = await pdfDoc.embedFont(fonts.bold, { subset: false });

    const black = rgb(0.1, 0.1, 0.1);
    const gray = rgb(0.35, 0.35, 0.35);

    // -------- Page 1 --------
    const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page1.getSize();
    const marginX = 48;
    let y = height - 56;

    // Header
    page1.drawText("Get Driver Vietnam", { x: marginX, y, size: 14, font: fontBold, color: black });
    y -= 16;
    page1.drawText(
      "Hotline: 0912197421 - Operator: 0773376222 Email: info@getdrivervietnam.com",
      { x: marginX, y, size: 9.5, font, color: black },
    );
    y -= 12;
    page1.drawText("Website: www.getdrivervietnam.com", { x: marginX, y, size: 9.5, font, color: black });
    y -= 18;

    // Title
    const title1 = "BẢNG GIÁ DỊCH VỤ (KHÔNG BAO GỒM HOÁ ĐƠN BÁN HÀNG)";
    const tw1 = fontBold.widthOfTextAtSize(title1, 12.5);
    page1.drawText(title1, { x: (width - tw1) / 2, y, size: 12.5, font: fontBold, color: black });
    y -= 14;
    const updated = `(Cập nhật: ${String(body.updatedDate || "").trim()})`;
    const tw2 = font.widthOfTextAtSize(updated, 10);
    page1.drawText(updated, { x: (width - tw2) / 2, y, size: 10, font, color: gray });
    y -= 18;

    page1.drawText("Kính Gửi: Quý Công Ty / Quý Khách", { x: marginX, y, size: 10.5, font: fontBold, color: black });
    y -= 14;
    y = drawWrapped({
      page: page1,
      text:
        "Trân trọng cám ơn sự quan tâm của quý công ty/ anh chị tới sản phẩm dịch vụ vận tải của Get Driver Vietnam.",
      x: marginX,
      y,
      maxWidth: width - marginX * 2,
      lineHeight: 12,
      font,
      size: 10,
      color: black,
    });
    y -= 2;
    y = drawWrapped({
      page: page1,
      text:
        "Chúng tôi gửi Bảng Báo Giá dưới đây rất mong nhận được sự quan tâm và ủng hộ của quý khách!",
      x: marginX,
      y,
      maxWidth: width - marginX * 2,
      lineHeight: 12,
      font,
      size: 10,
      color: black,
    });
    y -= 2;
    y = drawWrapped({
      page: page1,
      text:
        "Nếu có gì thắc mắc vui lòng liên hệ hotline: 0912197421 hoặc gửi Email về: info@getdrivervietnam.com",
      x: marginX,
      y,
      maxWidth: width - marginX * 2,
      lineHeight: 12,
      font,
      size: 10,
      color: black,
    });
    y -= 14;

    // Table
    const colsRaw = Array.isArray(body.columns) ? body.columns : [];
    const columns = colsRaw.map((c) => clampText(c, 24)).filter(Boolean);
    const safeColumns = columns.length ? columns.slice(0, 6) : ["—"];
    const rows = Array.isArray(body.rows) ? body.rows : [];

    const tableX = marginX;
    const tableW = width - marginX * 2;
    const idxW = 18;
    const itinW = Math.min(250, Math.max(220, tableW - idxW - safeColumns.length * 80));
    const priceW = (tableW - idxW - itinW) / safeColumns.length;
    const rowH = 18;
    const headerH = 20;
    const lineColor = rgb(0.85, 0.85, 0.85);

    // header row background
    page1.drawRectangle({ x: tableX, y: y - headerH, width: tableW, height: headerH, color: rgb(0.96, 0.96, 0.96) });
    page1.drawRectangle({ x: tableX, y: y - headerH, width: tableW, height: headerH, borderColor: lineColor, borderWidth: 1 });

    page1.drawText("DỊCH VỤ", { x: tableX + idxW + 6, y: y - 14, size: 9.5, font: fontBold, color: black });
    for (let i = 0; i < safeColumns.length; i++) {
      const cx = tableX + idxW + itinW + i * priceW;
      const label = safeColumns[i];
      const lw = fontBold.widthOfTextAtSize(label, 9.5);
      page1.drawText(label, { x: cx + Math.max(0, (priceW - lw) / 2), y: y - 14, size: 9.5, font: fontBold, color: black });
    }
    y -= headerH;

    const maxRows = Math.floor((y - 70) / rowH);
    const slice = rows.slice(0, Math.max(0, maxRows));
    for (let ri = 0; ri < slice.length; ri++) {
      const r = slice[ri];
      const rowY = y - rowH;
      page1.drawRectangle({ x: tableX, y: rowY, width: tableW, height: rowH, borderColor: lineColor, borderWidth: 1 });
      const idx = String(ri + 1);
      page1.drawText(idx, { x: tableX + 4, y: rowY + 5.5, size: 9.5, font, color: black });

      const itin = clampText(r?.itinerary, 60);
      page1.drawText(itin, { x: tableX + idxW + 6, y: rowY + 5.5, size: 9.5, font, color: black });

      const prices = (r?.prices && typeof r.prices === "object") ? (r.prices as Record<string, any>) : {};
      for (let ci = 0; ci < safeColumns.length; ci++) {
        const label = safeColumns[ci];
        const cell = asMoneyVnd(prices[label]);
        const cx = tableX + idxW + itinW + ci * priceW;
        const cw = font.widthOfTextAtSize(cell, 9.5);
        page1.drawText(cell, { x: cx + Math.max(0, (priceW - cw) / 2), y: rowY + 5.5, size: 9.5, font, color: black });
      }
      y -= rowH;
    }

    if (rows.length > slice.length) {
      page1.drawText(`… còn ${rows.length - slice.length} dòng`, { x: tableX, y: 62, size: 9, font, color: gray });
    }

    // -------- Page 2 --------
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    const { width: w2, height: h2 } = page2.getSize();
    let y2 = h2 - 56;

    page2.drawText("Get Driver Vietnam", { x: marginX, y: y2, size: 14, font: fontBold, color: black });
    y2 -= 16;
    page2.drawText(
      "Hotline: 0912197421 - Operator: 0773376222 Email: info@getdrivervietnam.com",
      { x: marginX, y: y2, size: 9.5, font, color: black },
    );
    y2 -= 12;
    page2.drawText("Website: www.getdrivervietnam.com", { x: marginX, y: y2, size: 9.5, font, color: black });
    y2 -= 22;

    const noteTitle = "LƯU Ý: CÁC TUYẾN ĐƯỜNG hoặc LOẠI XE KHÁC VUI LÒNG LIÊN HỆ";
    page2.drawText(noteTitle, { x: marginX, y: y2, size: 11, font: fontBold, color: black });
    y2 -= 16;
    page2.drawText("(Những gì khách nhận được)", { x: marginX, y: y2, size: 10, font: fontBold, color: black });
    y2 -= 14;

    const bullets = [
      'Xe đời mới: "Xe đời mới (dưới 5 năm), nội thất sang trọng, luôn được vệ sinh khử khuẩn sạch sẽ trước mỗi chuyến đi."',
      'Tài xế: "Bác tài kinh nghiệm, am hiểu cung đường phía Bắc, thái độ phục vụ chuyên nghiệp, tận tâm"',
      'Chi phí vận hành: "Phí xăng dầu, phí cầu đường (bao gồm cả cao tốc mới nhất), phí sân bay/bến bãi."',
      'Tiện ích đi kèm: "Nước suối đóng chai"',
      'Sự an tâm: "Bảo hiểm hành khách mức cao nhất, hỗ trợ 24/7 từ đội ngũ điều hành GetDriverVietnam."',
    ];
    for (const b of bullets) {
      y2 = drawWrapped({ page: page2, text: b, x: marginX, y: y2, maxWidth: w2 - marginX * 2, lineHeight: 12, font, size: 10, color: black });
      y2 -= 4;
    }

    y2 -= 6;
    page2.drawText('"Báo giá không bao gồm"', { x: marginX, y: y2, size: 10, font: fontBold, color: black });
    y2 -= 14;
    const excludes = [
      'Chi phí cá nhân: "Vé tham quan các điểm du lịch, chi phí ăn uống, lưu trú cá nhân của quý khách."',
      'Phí ngoài giờ/ngoài lịch trình: "Phí phát sinh ngoài lịch trình cam kết hoặc sử dụng xe quá giờ quy định"',
      "Tip cho tài xế",
      "Hoá Đơn Bán Hàng hoặc VAT",
    ];
    for (const b of excludes) {
      y2 = drawWrapped({ page: page2, text: b, x: marginX, y: y2, maxWidth: w2 - marginX * 2, lineHeight: 12, font, size: 10, color: black });
      y2 -= 4;
    }

    const bytes = await pdfDoc.save();
    const outName = `${sanitizePdfFilenameAscii(body.fileName)}.pdf`;
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${outName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "failed_to_generate_pdf", message: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

