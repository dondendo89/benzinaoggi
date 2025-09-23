import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/src/lib/db';
import { updateAnagrafica, updatePrezzi, checkVariation } from '@/src/services/mimit';
import fs from 'node:fs';
import path from 'node:path';

async function resetDb() {
  // Delete all data between tests
  await prisma.price.deleteMany();
  await prisma.distributor.deleteMany();
}

describe('MIMIT services', () => {
  beforeAll(async () => {
    // ensure db file exists (migrate was done earlier for dev; tests use separate file)
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('imports anagrafica and prezzi, then computes variations', async () => {
    await resetDb();

    // Mock fetch to return small CSV fixtures
    const globalAny = global as any;
    const originalFetch = globalAny.fetch;
    globalAny.fetch = async (url: string) => {
      if (url.includes('anagrafica_impianti_attivi.csv')) {
        const csv = 'idImpianto;Gestore;Bandiera;Comune;Provincia;Indirizzo;Latitudine;Longitudine\n' +
          '1001;Gestore A;BandieraX;Milano;MI;Via Uno;45,464;-9,190\n';
        return new Response(csv, { status: 200 });
      }
      if (url.includes('prezzo_alle_8.csv')) {
        const csv = 'idImpianto;descCarburante;prezzo;isSelf;dtComu\n' +
          '1001;Benzina;1,899;1;22/09/2025 08:00:00\n' +
          '1001;Gasolio;1,799;1;22/09/2025 08:00:00\n';
        return new Response(csv, { status: 200 });
      }
      throw new Error('Unexpected fetch url: ' + url);
    };

    const a = await updateAnagrafica();
    expect(a.updated).toBe(1);

    const p = await updatePrezzi();
    expect(p.inserted).toBe(2);

    const v0 = await checkVariation();
    expect(Array.isArray(v0.variations)).toBe(true);
    expect(v0.variations.length).toBe(0);

    // Change price next day
    globalAny.fetch = async (url: string) => {
      if (url.includes('prezzo_alle_8.csv')) {
        const csv = 'idImpianto;descCarburante;prezzo;isSelf;dtComu\n' +
          '1001;Benzina;1,999;1;23/09/2025 08:00:00\n' +
          '1001;Gasolio;1,699;1;23/09/2025 08:00:00\n';
        return new Response(csv, { status: 200 });
      }
      if (url.includes('anagrafica_impianti_attivi.csv')) {
        const csv = 'idImpianto;Gestore;Bandiera;Comune;Provincia;Indirizzo;Latitudine;Longitudine\n' +
          '1001;Gestore A;BandieraX;Milano;MI;Via Uno;45,464;-9,190\n';
        return new Response(csv, { status: 200 });
      }
      throw new Error('Unexpected fetch url: ' + url);
    };

    await updatePrezzi();
    const v = await checkVariation();
    expect(v.variations.length).toBe(2);
    const kinds = v.variations.map(x => x.direction).sort();
    expect(kinds).toEqual(['down','up']);

    // restore fetch
    globalAny.fetch = originalFetch;
  });
});


