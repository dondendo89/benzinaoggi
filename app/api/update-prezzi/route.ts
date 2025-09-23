import { NextResponse } from "next/server";
import { updatePrezzi } from "@/src/services/mimit";

export async function GET() {
  try {
    const result = await updatePrezzi();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


