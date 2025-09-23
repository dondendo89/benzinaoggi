# Benzina Oggi - Backend (Next.js API) + WordPress Plugin

## Requisiti
- Node 18+
- Prisma CLI
- SQLite (file `prisma/dev.db` generato automaticamente)

## Setup locale
```bash
npm i
npx prisma migrate dev --name init
npm run dev
```

## Endpoints
- GET /api/update-anagrafica → importa/aggiorna anagrafica dal CSV MIMIT
- GET /api/update-prezzi → importa/aggiorna prezzi del giorno
- GET /api/check-variation → differenze prezzi tra ultimo giorno e precedente

## Cron (Vercel)
Configurato in `vercel.json` per esecuzione giornaliera.

## WordPress Plugin
Cartella `wp-plugin/benzinaoggi`.
- Impostazioni: API Base URL, OneSignal App ID/Key
- Shortcode: `[carburanti_map]`
- Notifiche: invio broadcast se ci sono variazioni giornaliere

## Note
- Il plugin mostra UI base. Per popolare mappa/lista con dati reali, aggiungi un endpoint di listing (es. `/api/distributors?city=...&fuel=...`) e consumalo nel JS del plugin.


