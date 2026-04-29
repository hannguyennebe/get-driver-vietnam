import { NextResponse } from "next/server";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const runtime = "nodejs";

export type Body = {
  fileName: string;
  createdDate: string; // dd/mm/yyyy
  blocks: {
    block1: string;
    block2: string;
    block3: string;
    block4: string;
    block5: string;
    block6: string;
    block7: string;
    block8_terms: string;
    block8_paymentInfo: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
    block9: string;
    block10: string;
    signAName: string;
    signBName: string;
  };
};

let fontCache: null | { regular: ArrayBuffer; bold: ArrayBuffer } = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  // Use public/ so fonts are guaranteed to be present in production bundles.
  const regularAbs = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
  const boldAbs = path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf");
  let regularBuf: ArrayBuffer;
  let boldBuf: ArrayBuffer;
  try {
    const b = await fs.readFile(regularAbs);
    regularBuf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`missing_font_regular: ${regularAbs} (${msg})`);
  }
  try {
    const b = await fs.readFile(boldAbs);
    boldBuf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`missing_font_bold: ${boldAbs} (${msg})`);
  }
  const regular = regularBuf;
  const bold = boldBuf;
  fontCache = { regular, bold };
  return fontCache;
}

function splitLines(s: string) {
  return String(s || "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
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
    if (width <= opts.maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  for (const ln of lines) {
    opts.page.drawText(ln, {
      x: opts.x,
      y: opts.y,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    opts.y -= opts.lineHeight;
  }
  return opts.y;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const fonts = await loadFonts();

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontRegular = await pdfDoc.embedFont(fonts.regular, { subset: false });
    const fontBold = await pdfDoc.embedFont(fonts.bold, { subset: false });

    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
    const { width, height } = page.getSize();
    const marginX = 52;
    let y = height - 56;

    const black = rgb(0.1, 0.1, 0.1);
    const gray = rgb(0.35, 0.35, 0.35);

    const drawCentered = (text: string, size: number, bold = false) => {
      const f = bold ? fontBold : fontRegular;
      const w = f.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (width - w) / 2, y, size, font: f, color: black });
      y -= Math.round(size * 1.5);
    };

    // Block 1 (header)
    for (const ln of splitLines(body.blocks.block1)) {
      drawCentered(ln, 12, true);
    }
    y -= 6;

    // Block 2 (title)
    const b2 = splitLines(body.blocks.block2);
    if (b2[0]) drawCentered(b2[0], 16, true);
    for (const ln of b2.slice(1)) {
      drawCentered(ln, 11, false);
    }
    y -= 10;

    // Meta line
    page.drawText(`Ngày tạo: ${body.createdDate}`, {
      x: marginX,
      y,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    const fnRaw = String(body.fileName ?? "");
    // Ensure meta filename is ASCII-only (avoid any runtime encoding quirks).
    const fn = fnRaw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9\-_. ]/g, "")
      .trim()
      .slice(0, 80);
    page.drawText(fn, {
      x: width - marginX - fontRegular.widthOfTextAtSize(fn, 10),
      y,
      size: 10,
      font: fontRegular,
      color: gray,
    });
    y -= 18;

    const sectionTitle = (t: string) => {
      page.drawText(t, { x: marginX, y, size: 11, font: fontBold, color: black });
      y -= 14;
    };

    const sectionText = (text: string) => {
      const lines = splitLines(text);
      for (const ln of lines) {
        y = drawWrapped({
          page,
          text: ln,
          x: marginX,
          y,
          maxWidth: width - marginX * 2,
          lineHeight: 14,
          font: fontRegular,
          size: 11,
          color: black,
        });
      }
      y -= 6;
    };

    sectionTitle("Căn cứ pháp lý");
    sectionText(body.blocks.block3);

    sectionTitle("Thời gian & địa điểm");
    sectionText(body.blocks.block4);

    sectionTitle("Bên A");
    sectionText(body.blocks.block5);

    sectionTitle("Bên B");
    sectionText(body.blocks.block6);

    sectionTitle("Điều khoản");
    sectionText(body.blocks.block7);

    sectionTitle("Điều khoản & phương thức thanh toán");
    sectionText(body.blocks.block8_terms);

    sectionTitle("Thông tin thanh toán (VAT)");
    sectionText(
      `Ngân hàng: ${body.blocks.block8_paymentInfo.bankName}\n` +
        `Số tài khoản: ${body.blocks.block8_paymentInfo.accountNumber}\n` +
        `Chủ tài khoản: ${body.blocks.block8_paymentInfo.accountHolder}`,
    );

    sectionTitle("Gia hạn");
    sectionText(body.blocks.block9);

    sectionTitle("Tranh chấp");
    sectionText(body.blocks.block10);

    // Signature (Block 11)
    y -= 6;
    const colGap = 40;
    const colW = (width - marginX * 2 - colGap) / 2;
    const leftX = marginX;
    const rightX = marginX + colW + colGap;

    page.drawText("ĐẠI DIỆN BÊN A", {
      x: leftX + (colW - fontBold.widthOfTextAtSize("ĐẠI DIỆN BÊN A", 11)) / 2,
      y,
      size: 11,
      font: fontBold,
      color: black,
    });
    page.drawText("ĐẠI DIỆN BÊN B", {
      x: rightX + (colW - fontBold.widthOfTextAtSize("ĐẠI DIỆN BÊN B", 11)) / 2,
      y,
      size: 11,
      font: fontBold,
      color: black,
    });
    y -= 70; // signing space

    page.drawText(body.blocks.signAName || "—", {
      x: leftX + (colW - fontRegular.widthOfTextAtSize(body.blocks.signAName || "—", 11)) / 2,
      y,
      size: 11,
      font: fontRegular,
      color: black,
    });
    page.drawText(body.blocks.signBName || "—", {
      x: rightX + (colW - fontRegular.widthOfTextAtSize(body.blocks.signBName || "—", 11)) / 2,
      y,
      size: 11,
      font: fontRegular,
      color: black,
    });

    const bytes = await pdfDoc.save();
    const outName = (fn || "hop-dong-nguyen-tac") + ".pdf";
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${outName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? `${e.message}${e.stack ? `\n${e.stack}` : ""}`
        : typeof e === "string"
          ? e
          : "unknown";
    return NextResponse.json(
      { error: "failed_to_generate_pdf", message: msg },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

