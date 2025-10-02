import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Aumenta a 5 minuti

// Timeout per evitare function timeout
const FUNCTION_TIMEOUT = 270; // 4.5 minuti
const startTime = Date.now();

// Group an array of items by a key selector
function groupBy<T, K extends string | number>(items: T[], keyFn: (t: T) => K): Record<K, T[]> {
  return items.reduce((acc, it) => {
    const k = keyFn(it);
    (acc as any)[k] = (acc as any)[k] || [];
    (acc as any)[k].push(it);
    return acc;
  }, {} as Record<K, T[]>);
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    // Invia SOLO ribassi creati oggi (UTC). Permetti override del giorno via createdDay=YYYY-MM-DD
    const createdDayParam = searchParams.get('createdDay');
    const todayIso = (createdDayParam || new Date().toISOString().slice(0,10));
    const startOfDay = new Date(`${todayIso}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayIso}T23:59:59.999Z`);

    let variations: any[] = [];
    try {
      // Leggi SOLO ribassi creati oggi (UTC) da PriceVariation
      variations = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "distributorId","fuelType","isSelfService","oldPrice","newPrice","direction","delta","percentage","day"
         FROM "PriceVariation"
         WHERE "direction"='down' AND "createdAt" >= $1 AND "createdAt" < $2`,
        startOfDay,
        endOfDay
      );
    } catch (_) {
      // Nessun fallback su Price: se PriceVariation non è disponibile, non inviare
      variations = [];
    }
    if (variations.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, createdDay: todayIso, note: 'No down variations created today' });
    }
    
    // Limite massimo per evitare timeout
    const MAX_VARIATIONS = parseInt(searchParams.get('maxVariations') || '1000');
    if (variations.length > MAX_VARIATIONS) {
      console.log(`⚠️ Too many variations (${variations.length}), limiting to ${MAX_VARIATIONS}`);
      variations = variations.slice(0, MAX_VARIATIONS);
    }

    // Mappa distributorId -> impiantoId e nome/descrizione
    const distributorIds = Array.from(new Set((variations as any[]).map((v: any) => v.distributorId)));
    const distributors = await prisma.distributor.findMany({
      where: { id: { in: distributorIds } },
      select: { id: true, impiantoId: true, gestore: true, bandiera: true, comune: true }
    });
    const byDistributorId = new Map(distributors.map(d => [d.id, d] as const));

    // Raggruppa variazioni per (impiantoId, fuelType) - costruendo il fuelType completo per matching con Subscription
    type Key = string;
    const keyedItems: Array<{
      key: Key;
      impiantoId: number;
      distributorId: number;
      distributor: any;
      fuelType: string;
      baseFuelType: string;
      isSelfService: boolean;
      oldPrice: number;
      newPrice: number;
    }> = [];
    
    for (const v of variations as any[]) {
      const d = byDistributorId.get(v.distributorId as number);
      const impiantoId = d?.impiantoId as number | undefined;
      if (!impiantoId) continue;
      
      const baseFuelType = String(v.fuelType);
      const isSelfService = Boolean(v.isSelfService);
      
      // Per Self Service: sempre "Benzina Self", "Gasolio Premium Self"
      if (isSelfService) {
        const fullFuelType = `${baseFuelType} Self`;
        keyedItems.push({
          key: `${impiantoId}|${fullFuelType}` as Key,
          impiantoId,
          distributorId: v.distributorId as number,
          distributor: d,
          fuelType: fullFuelType,
          baseFuelType,
          isSelfService,
          oldPrice: Number(v.oldPrice),
          newPrice: Number(v.newPrice),
        });
      } else {
        // Per Servito: proviamo entrambe le varianti
        // 1. Senza "Servito": "Benzina", "Gasolio Premium"
        keyedItems.push({
          key: `${impiantoId}|${baseFuelType}` as Key,
          impiantoId,
          distributorId: v.distributorId as number,
          distributor: d,
          fuelType: baseFuelType,
          baseFuelType,
          isSelfService,
          oldPrice: Number(v.oldPrice),
          newPrice: Number(v.newPrice),
        });
        
        // 2. Con "Servito": "Benzina Servito", "Gasolio Premium Servito"
        const fullFuelTypeServito = `${baseFuelType} Servito`;
        keyedItems.push({
          key: `${impiantoId}|${fullFuelTypeServito}` as Key,
          impiantoId,
          distributorId: v.distributorId as number,
          distributor: d,
          fuelType: fullFuelTypeServito,
          baseFuelType,
          isSelfService,
          oldPrice: Number(v.oldPrice),
          newPrice: Number(v.newPrice),
        });
      }
    }

    const grouped = groupBy(keyedItems, x => x.key);

    // Precarica subscriptions SOLO per le coppie (impiantoId,fuelType) presenti oggi nelle variazioni
    const uniquePairs = Array.from(new Set(Object.values(grouped).map(items => `${items[0]!.impiantoId}|${items[0]!.fuelType}`)));
    type Pair = { impiantoId: number; fuelType: string };
    const pairs: Pair[] = uniquePairs.map(k => ({ impiantoId: Number(k.split('|')[0]), fuelType: k.split('|')[1]! }));

    let subsAll: { externalId: string; impiantoId: number; fuelType: string }[] = [];
    if (pairs.length > 0) {
      // Costruisci OR dinamico per coppie specifiche
      const or = pairs.map(p => ({ impiantoId: p.impiantoId, fuelType: p.fuelType }));
      subsAll = await prisma.subscription.findMany({
        where: { OR: or },
        select: { externalId: true, impiantoId: true, fuelType: true },
      });
    }
    const subsByKey = new Map<string, string[]>();
    for (const s of subsAll) {
      const k = `${s.impiantoId}|${s.fuelType}`;
      if (!subsByKey.has(k)) subsByKey.set(k, []);
      if (s.externalId) subsByKey.get(k)!.push(s.externalId);
    }

    // Per ogni gruppo, recupera gli externalId iscritti e invia notifica in batch
    let sent = 0;
    const failures: Array<{ key: string; error: string }> = [];
    const messages: Array<{ key: string; title: string; body: string; externalIds: string[]; url?: string; oneSignalResponse?: any }> = [];

    let processedCount = 0;
    let skippedDueToTimeout = 0;
    
    for (const [key, items] of Object.entries(grouped)) {
      // Controllo timeout - se mancano meno di 30 secondi, fermati
      const elapsed = Date.now() - startTime;
      if (elapsed > FUNCTION_TIMEOUT * 1000) {
        skippedDueToTimeout = Object.keys(grouped).length - processedCount;
        console.log(`⏱️ Timeout approaching, skipping ${skippedDueToTimeout} remaining notifications`);
        break;
      }
      
      const sample = items[0];
      const impiantoId = sample!.impiantoId as number;
      const fuelType = sample!.fuelType; // fuelType completo per matching
      const baseFuelType = sample!.baseFuelType; // fuelType base per display
      
      processedCount++;

      const externalIds = subsByKey.get(`${impiantoId}|${fuelType}`) || [];
      if (externalIds.length === 0) continue; // Salta se non ci sono subscription per questa variante

      // Scegli prezzi old/new dall'item con delta maggiore assoluto
      const best = items.reduce((a, b) => {
        const da = Math.abs((a.oldPrice ?? 0) - (a.newPrice ?? 0));
        const db = Math.abs((b.oldPrice ?? 0) - (b.newPrice ?? 0));
        return db > da ? b : a;
      }, items[0]!);

      // Invio diretto a OneSignal in batch per evitare timeout
      try {
        const appId = process.env.ONESIGNAL_APP_ID 
          || process.env.ONE_SIGNAL_APP_ID 
          || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
        const apiKey = process.env.ONESIGNAL_API_KEY 
          || process.env.ONE_SIGNAL_REST_API_KEY 
          || process.env.ONESIGNAL_REST_API_KEY 
          || process.env.ONE_SIGNAL_API_KEY;
        if (!appId || !apiKey) {
          failures.push({ key, error: 'ONESIGNAL_APP_ID or ONESIGNAL_API_KEY missing' });
          continue;
        }
        const chunkSize = 200;
        for (let i = 0; i < externalIds.length; i += chunkSize) {
          const chunk = externalIds.slice(i, i + chunkSize);
          try {
            const title = `Prezzo ${baseFuelType} ⬇️`; // Usa baseFuelType per display (senza "Self")
            const name = sample!.distributor?.gestore || sample!.distributor?.bandiera || sample!.distributor?.comune || `Impianto ${impiantoId}`;
            const deltaAbs = Math.abs((best.newPrice ?? 0) - (best.oldPrice ?? 0)).toFixed(3);
            const body = `${name}: ${Number(best.oldPrice).toFixed(3)} → ${Number(best.newPrice).toFixed(3)} (Δ ${deltaAbs})`;
            
            // Costruisci URL della pagina distributore: bandiera-comune-idImpianto
            const bandiera = sample!.distributor?.bandiera || 'distributore';
            const comune = sample!.distributor?.comune || 'italia';
            const slug = `${bandiera.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${comune.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${impiantoId}`;
            const distributorUrl = `${process.env.WORDPRESS_URL || 'https://www.benzinaoggi.it'}/distributore/${slug}`;
            
            // Salva il messaggio per il debug
            if (i === 0) { // Solo per il primo chunk per evitare duplicati
              messages.push({ key, title, body, externalIds: externalIds, url: distributorUrl });
            }
            
            const r = await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Basic ${apiKey}`,
              },
              body: JSON.stringify({
                app_id: appId,
                include_external_user_ids: chunk,
                headings: { it: title, en: title },
                contents: { it: body, en: body },
                url: distributorUrl,
                data: {
                  impiantoId,
                  distributorId: impiantoId,
                  fuelType,
                  oldPrice: best.oldPrice,
                  newPrice: best.newPrice,
                  createdDay: new Date().toISOString().slice(0,10),
                  url: distributorUrl,
                },
              })
            });
            if (!r.ok) {
              let msg = `OneSignal HTTP ${r.status}`;
              try { const j = await r.json(); msg += ` ${JSON.stringify(j)}`; } catch {}
              failures.push({ key, error: msg });
            }
            else {
              // Log della risposta OneSignal per debug
              try {
                const responseData = await r.json();
                console.log(`OneSignal success for ${key}:`, JSON.stringify(responseData));
                
                // Controlla se ci sono external ID invalidi
                const invalidExternals = responseData.errors?.invalid_aliases?.external_id || [];
                const actualSent = chunk.length - invalidExternals.length;
                sent += actualSent;
                
                if (invalidExternals.length > 0) {
                  console.log(`Found ${invalidExternals.length} invalid external IDs for ${key}:`, invalidExternals);
                }
                
                if (i === 0) { // Solo per il primo chunk
                  messages[messages.length - 1].oneSignalResponse = responseData;
                }
              } catch (e) {
                console.log(`OneSignal success for ${key} but couldn't parse response`);
                sent += chunk.length; // Fallback se non riusciamo a parsare
              }
            }
          } catch (e: any) {
            failures.push({ key, error: e?.message || 'OneSignal error' });
          }
        }
      } catch (e: any) {
        failures.push({ key, error: e?.message || 'send error' });
      }
    }

    // Invia anche notifiche Telegram
    let telegramSent = 0;
    let telegramErrors = 0;
    
    try {
      const telegramNotifications = Object.values(grouped).map(items => {
        const sample = items[0];
        const best = items.reduce((min, item) => 
          !min || (item.newPrice ?? 0) < (min.newPrice ?? 0) ? item : min
        );
        
        return {
          distributorId: sample.distributorId,
          impiantoId: sample.impiantoId,
          distributor: sample.distributor,
          fuelType: sample.fuelType,
          baseFuelType: sample.baseFuelType,
          isSelfService: sample.isSelfService,
          oldPrice: best.oldPrice ?? 0,
          newPrice: best.newPrice ?? 0,
          direction: 'down' as const,
          delta: (best.newPrice ?? 0) - (best.oldPrice ?? 0),
          percentage: best.oldPrice ? (((best.newPrice ?? 0) - (best.oldPrice ?? 0)) / (best.oldPrice ?? 0)) * 100 : 0
        };
      });
      
      if (telegramNotifications.length > 0) {
        const telegramResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://benzinaoggi.vercel.app'}/api/telegram/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_SECRET}`
          },
          body: JSON.stringify({
            type: 'price_drop',
            data: {
              notifications: telegramNotifications
            }
          })
        });
        
        if (telegramResponse.ok) {
          const telegramResult = await telegramResponse.json();
          telegramSent = telegramResult.sent || 0;
          telegramErrors = telegramResult.errors || 0;
          console.log(`Telegram notifications: sent=${telegramSent}, errors=${telegramErrors}`);
        } else {
          console.error('Failed to send Telegram notifications:', telegramResponse.status);
          telegramErrors = 1;
        }
      }
    } catch (error) {
      console.error('Error sending Telegram notifications:', error);
      telegramErrors = 1;
    }

    const totalElapsed = Date.now() - startTime;
    
    return NextResponse.json({ 
      ok: true, 
      createdDay: todayIso, 
      groups: Object.keys(grouped).length,
      processed: processedCount,
      skippedDueToTimeout: skippedDueToTimeout > 0 ? skippedDueToTimeout : undefined,
      sent, 
      failures, 
      messages,
      telegram: {
        sent: telegramSent,
        errors: telegramErrors
      },
      performance: {
        executionTimeMs: totalElapsed,
        executionTimeSeconds: Math.round(totalElapsed / 1000),
        variationsProcessed: variations.length,
        avgTimePerGroup: processedCount > 0 ? Math.round(totalElapsed / processedCount) : 0
      }
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


