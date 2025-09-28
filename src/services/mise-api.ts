/**
 * Servizio per interagire con l'API MISE diretta
 */

export interface MiseFuel {
  id: number;
  price: number;
  name: string;
  fuelId: number;
  isSelf: boolean;
  serviceAreaId: number;
  insertDate: string;
  validityDate: string;
}

export interface MiseServiceArea {
  id: number;
  name: string;
  nomeImpianto: string;
  address: string;
  brand: string;
  fuels: MiseFuel[];
  phoneNumber: string;
  email: string;
  website: string;
  company: string;
  services: any[];
  orariapertura: any[];
}

/**
 * Ottiene i dati di un distributore dall'API MISE
 */
export async function getMiseServiceArea(serviceAreaId: number): Promise<MiseServiceArea | null> {
  try {
    const response = await fetch(`https://carburanti.mise.gov.it/ospzApi/registry/servicearea/${serviceAreaId}`, {
      headers: {
        'User-Agent': 'BenzinaOggi/1.0',
        'Accept': 'application/json',
      },
      // Timeout di 10 secondi
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn(`MISE API error for ${serviceAreaId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as MiseServiceArea;
  } catch (error) {
    console.warn(`Failed to fetch MISE data for ${serviceAreaId}:`, error);
    return null;
  }
}

/**
 * Ottiene i prezzi aggiornati per un distributore
 */
export async function getMisePrices(serviceAreaId: number): Promise<MiseFuel[]> {
  const serviceArea = await getMiseServiceArea(serviceAreaId);
  return serviceArea?.fuels || [];
}

/**
 * Confronta i prezzi tra database locale e API MISE
 */
export function comparePrices(
  localPrices: Array<{ fuelType: string; price: number; isSelfService: boolean }>,
  misePrices: MiseFuel[]
): Array<{
  fuelType: string;
  isSelfService: boolean;
  localPrice: number;
  misePrice: number;
  hasChanged: boolean;
  difference: number;
}> {
  const results: Array<{
    fuelType: string;
    isSelfService: boolean;
    localPrice: number;
    misePrice: number;
    hasChanged: boolean;
    difference: number;
  }> = [];

  // Mappa dei prezzi MISE per confronto
  const miseMap = new Map<string, MiseFuel>();
  for (const fuel of misePrices) {
    const key = `${fuel.name}|${fuel.isSelf ? 'self' : 'served'}`;
    miseMap.set(key, fuel);
  }

  // Confronta ogni prezzo locale
  for (const local of localPrices) {
    const key = `${local.fuelType}|${local.isSelfService ? 'self' : 'served'}`;
    const mise = miseMap.get(key);
    
    if (mise) {
      const hasChanged = Math.abs(local.price - mise.price) > 0.001; // Tolleranza 0.001
      const difference = mise.price - local.price;
      
      results.push({
        fuelType: local.fuelType,
        isSelfService: local.isSelfService,
        localPrice: local.price,
        misePrice: mise.price,
        hasChanged,
        difference
      });
    }
  }

  return results;
}

/**
 * Normalizza il nome del carburante per il confronto
 */
export function normalizeFuelName(miseName: string): string {
  const fuelMap: Record<string, string> = {
    'Benzina': 'Benzina',
    'Gasolio': 'Gasolio',
    'GPL': 'GPL',
    'Metano': 'Metano',
    'HiQ Perform+': 'HiQ Perform+', // Mantieni come tipo separato
    'HVO': 'HVO', // Mantieni come tipo separato
  };
  
  return fuelMap[miseName] || miseName;
}
