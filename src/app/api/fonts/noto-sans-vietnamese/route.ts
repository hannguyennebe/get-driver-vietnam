import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Served from node_modules to support client-side PDF generation with Vietnamese text.
function relPath(weight: "400" | "700") {
  // Use .woff (not .woff2) for better fontkit browser compatibility.
  return `node_modules/@openfonts/noto-sans_vietnamese/files/noto-sans-vietnamese-${weight}.woff`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const w = (url.searchParams.get("w") ?? "400") as "400" | "700";
    const weight: "400" | "700" = w === "700" ? "700" : "400";
    const abs = path.join(process.cwd(), relPath(weight));
    const buf = await fs.readFile(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "font/woff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "font_not_found" }, { status: 404 });
  }
}

