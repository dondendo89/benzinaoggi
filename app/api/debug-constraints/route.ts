import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Verificando i constraint del database...');
    
    // Query per verificare i constraint esistenti sulla tabella Price
    const constraints = await prisma.$queryRaw`
        SELECT 
            conname as constraint_name,
            contype as constraint_type,
            pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint 
        WHERE conrelid = (
            SELECT oid 
            FROM pg_class 
            WHERE relname = 'Price'
        )
        ORDER BY conname;
    `;
    
    // Verifica anche gli indici
    const indexes = await prisma.$queryRaw`
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE tablename = 'Price'
        ORDER BY indexname;
    `;
    
    return NextResponse.json({ 
      ok: true, 
      constraints,
      indexes
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}