import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const runtime = "nodejs";

type Body = {
  fileName: string; // ASCII
  createdDate: string; // dd/mm/yyyy
  title: string;
  lines: string[];
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

function splitLines(arr: unknown) {
  const xs = Array.isArray(arr) ? arr : [];
  return xs.map((x) => String(x ?? "").trim()).filter(Boolean);
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

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 52;
    let y = height - 56;
    const black = rgb(0.1, 0.1, 0.1);
    const gray = rgb(0.35, 0.35, 0.35);

    const title = String(body.title || "BÁO GIÁ");
    const tw = fontBold.widthOfTextAtSize(title, 18);
    page.drawText(title, { x: (width - tw) / 2, y, size: 18, font: fontBold, color: black });
    y -= 26;

    page.drawText(`Ngày tạo: ${String(body.createdDate || "")}`, { x: margin, y, size: 10, font, color: gray });
    y -= 18;

    const rows = splitLines(body.lines);
    if (rows.length === 0) rows.push("—");

    for (const ln of rows) {
      if (y < 70) break;
      y = drawWrapped({ page, text: `• ${ln}`, x: margin, y, maxWidth: width - margin * 2, lineHeight: 14, font, size: 11, color: black });
      y -= 2;
    }

    const bytes = await pdfDoc.save();
    const outName = `${String(body.fileName || "bao-gia").trim() || "bao-gia"}.pdf`;
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

