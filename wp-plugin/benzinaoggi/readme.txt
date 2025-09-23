=== Benzina Oggi ===
Contributors: dev
Stable tag: 1.0.0
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
License: GPLv2 or later

Plugin per mostrare mappa e lista dei distributori con prezzi carburanti, usando API su Vercel. Include notifiche push via OneSignal.

Installazione:
1. Carica la cartella `benzinaoggi` in `wp-content/plugins/`.
2. Attiva il plugin.
3. Vai su Impostazioni → Benzina Oggi e imposta:
   - API Base URL (es: https://tuo-progetto.vercel.app)
   - OneSignal App ID e REST API Key (opzionali per notifiche)
4. Inserisci lo shortcode [carburanti_map] in una pagina.

Note:
- Le API Vercel espongono: /api/update-anagrafica, /api/update-prezzi, /api/check-variation
- Il cron del plugin interroga periodicamente /api/check-variation e invia una notifica OneSignal generica se ci sono variazioni.


