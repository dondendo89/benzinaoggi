import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Verifica autorizzazione Bearer token
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.API_SECRET;
    
    if (!expectedToken || !authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Leggi parametri dalla richiesta
    const body = await req.json().catch(() => ({}));
    const { date } = body;
    
    // Se non specificata, usa ieri come default
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // Costruisci range di date per il giorno target
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);
    
    console.log(`Cleaning up PriceVariation records for date: ${targetDate}`);
    console.log(`Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    
    // Conta i record prima della pulizia
    const countBefore = await prisma.priceVariation.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    console.log(`Found ${countBefore} PriceVariation records to delete`);
    
    // Elimina i record del giorno specificato
    const deleteResult = await prisma.priceVariation.deleteMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    const deleted = deleteResult.count;
    
    console.log(`Successfully deleted ${deleted} PriceVariation records for ${targetDate}`);
    
    return NextResponse.json({
      ok: true,
      deleted,
      date: targetDate,
      dateRange: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString()
      },
      message: `Deleted ${deleted} PriceVariation records for ${targetDate}`
    });
    
  } catch (error) {
    console.error('Error cleaning up PriceVariation records:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Supporta anche GET per test/debug
export async function GET(req: NextRequest) {
  try {
    // Verifica autorizzazione Bearer token
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.API_SECRET;
    
    if (!expectedToken || !authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // Costruisci range di date per il giorno target
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    
    // Conta i record senza eliminarli
    const count = await prisma.priceVariation.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    // Mostra alcuni esempi
    const samples = await prisma.priceVariation.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      take: 5,
      select: {
        id: true,
        distributorId: true,
        fuelType: true,
        direction: true,
        oldPrice: true,
        newPrice: true,
        createdAt: true
      }
    });
    
    return NextResponse.json({
      ok: true,
      count,
      date,
      dateRange: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString()
      },
      samples,
      message: `Found ${count} PriceVariation records for ${date} (use POST to delete)`
    });
    
  } catch (error) {
    console.error('Error checking PriceVariation records:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
