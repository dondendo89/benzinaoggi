import { NextRequest, NextResponse } from "next/server";
import { updatePrezzi } from "@/src/services/mimit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = !!searchParams.get('debug');
    const result = await updatePrezzi(debug);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


