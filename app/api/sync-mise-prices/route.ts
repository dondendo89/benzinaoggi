import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoIdParam = searchParams.get('impiantoId');
    const limitParam = parseInt(searchParams.get('limit') || '100');
    const allParam = (searchParams.get('all') || '').toLowerCase() === 'true';
    const forceQuery = searchParams.get('force');
    let bodyForce = false;
    try {
      const json = await req.json().catch(() => null);
      if (json && typeof json.force === 'boolean') bodyForce = json.force;
    } catch {}
    const force = (forceQuery === 'true') || bodyForce || false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Selezione distributori
    let distributorsToCheck: Array<{ id: number; impiantoId: number }> = [];
    if (impiantoIdParam) {
      const distributor = await prisma.distributor.findUnique({
        where: { impiantoId: parseInt(impiantoIdParam) }
      });
      if (distributor) {
        distributorsToCheck = [{ id: distributor.id, impiantoId: distributor.impiantoId }];
      }
    } else if (allParam) {
      // Pagina tutti i distributori per evitare timeout
      const total = await prisma.distributor.count();
      const pageSize = Math.min(limitParam, 1000);
      for (let offset = 0; offset < total; offset += pageSize) {
        const page = await prisma.distributor.findMany({
          select: { id: true, impiantoId: true },
          orderBy: { id: 'asc' },
          skip: offset,
          take: pageSize
        });
        distributorsToCheck.push(...page);
        // Non caricare troppi in una singola esecuzione 60s
        if (distributorsToCheck.length >= 3000) break;
      }
    } else {
      distributorsToCheck = await prisma.distributor.findMany({
        select: { id: true, impiantoId: true },
        orderBy: { id: 'asc' },
        take: limitParam
      });
    }

    const results: Array<any> = [];
    let totalUpdated = 0;
    let totalCreated = 0;
    let totalChecked = 0;
    let totalErrors = 0;

    // Processa in piccoli batch per rispettare maxDuration
    const batchSize = 50;
    for (let i = 0; i < distributorsToCheck.length; i += batchSize) {
      const batch = distributorsToCheck.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (distributor) => {
        try {
          totalChecked++;
          const miseData = await getMiseServiceArea(distributor.impiantoId);
          if (!miseData) {
            return {
              impiantoId: distributor.impiantoId,
              status: 'no_mise_data',
              message: 'No data from MISE API'
            };
          }

          let updatedCount = 0;
          let createdCount = 0;
          let changesCount = 0;

          for (const fuel of miseData.fuels) {
            const normalizedFuel = normalizeFuelName(fuel.name);
            // Trova ultimo prezzo DB per questo fuel/self
            const existingLatest = await prisma.price.findFirst({
              where: {
                distributorId: distributor.id,
                fuelType: normalizedFuel,
                isSelfService: fuel.isSelf
              },
              orderBy: { day: 'desc' }
            });

            const hasChanged = !existingLatest || Math.abs(existingLatest.price - fuel.price) > 0.001;
            if (!hasChanged && !force) {
              continue;
            }

            await prisma.price.upsert({
              where: {
                Price_unique_day: {
                  distributorId: distributor.id,
                  fuelType: normalizedFuel,
                  day: today,
                  isSelfService: fuel.isSelf
                }
              },
              update: {
                price: fuel.price,
                communicatedAt: new Date()
              },
              create: {
                distributorId: distributor.id,
                fuelType: normalizedFuel,
                price: fuel.price,
                day: today,
                isSelfService: fuel.isSelf,
                communicatedAt: new Date()
              }
            });

            if (existingLatest) {
              if (Math.abs(existingLatest.price - fuel.price) > 0.001) {
                updatedCount++;
              }
            } else {
              createdCount++;
            }
            changesCount++;
          }

          totalUpdated += updatedCount;
          totalCreated += createdCount;

          return {
            impiantoId: distributor.impiantoId,
            status: 'updated',
            message: `Updated ${updatedCount} prices, created ${createdCount} prices`,
            updated: updatedCount,
            created: createdCount,
            changes: changesCount
          };

        } catch (error) {
          totalErrors++;
          return {
            impiantoId: distributor.impiantoId,
            status: 'error',
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }));
      results.push(...batchResults);
      // Piccola pausa tra batch per ridurre rate-limits MISE
      if (i + batchSize < distributorsToCheck.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalChecked,
        totalUpdated,
        totalCreated,
        totalErrors,
        processed: results.length
      },
      results
    });

  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      stack: e?.stack
    }, { status: 500 });
  }
}
