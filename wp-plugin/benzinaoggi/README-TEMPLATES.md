# Template BenzinaOggi per WordPress

## Panoramica

Questo plugin include template personalizzati per replicare il design del sito MISE (Ministero dello Sviluppo Economico) per la visualizzazione dei distributori di carburante.

## Template Inclusi

### 1. Home Page (`page-home.php`)
- **URL**: `/benzinaoggi-home/`
- **Funzionalità**:
  - Form di ricerca con geolocalizzazione
  - Mappa interattiva con Leaflet
  - Lista risultati in tempo reale
  - Design responsive per mobile
  - Statistiche del sito

### 2. Pagina Risultati (`page-risultati.php`)
- **URL**: `/benzinaoggi-risultati/`
- **Funzionalità**:
  - Vista lista e mappa
  - Filtri avanzati (carburante, bandiera, raggio)
  - Ordinamento per distanza/prezzo
  - Esportazione CSV
  - Paginazione

### 3. Dettaglio Distributore (`single-distributor.php`)
- **URL**: `/distributore-{ID}/`
- **Funzionalità**:
  - Informazioni complete del distributore
  - Prezzi attuali con variazioni
  - Sistema notifiche OneSignal
  - Mappa della posizione
  - Pulsanti azione (indicazioni, condivisione)

## Installazione e Configurazione

### 1. Attivazione Template
1. Vai in **Impostazioni > Benzina Oggi**
2. Clicca sul tab **"Pagine Template"**
3. Clicca **"Crea Pagine Template"**
4. Le pagine verranno create automaticamente

### 2. Configurazione URL
Il plugin configura automaticamente:
- Rewrite rules per `/distributore-{ID}/`
- Template loader per le pagine personalizzate
- Asset CSS/JS necessari

### 3. Personalizzazione
I template sono completamente personalizzabili:
- **CSS**: Modifica gli stili nei file template
- **JavaScript**: Personalizza la logica in `page-home.js`
- **Layout**: Modifica l'HTML nei file PHP

## Struttura File

```
wp-plugin/benzinaoggi/
├── templates/
│   ├── page-home.php          # Home page
│   ├── page-risultati.php     # Pagina risultati
│   ├── single-distributor.php # Dettaglio distributore
│   └── page-home.js           # JavaScript home
├── assets/
│   └── logo-benzinaoggi.svg   # Logo personalizzato
├── template-loader.php         # Caricatore template
└── benzinaoggi.php            # Plugin principale
```

## Funzionalità Avanzate

### Geolocalizzazione
- Rilevamento automatico posizione utente
- Ricerca per indirizzo/CAP
- Filtro per raggio personalizzabile

### Mappa Interattiva
- Marker per ogni distributore
- Popup con informazioni e prezzi
- Controlli zoom e navigazione
- Integrazione con Leaflet.js

### Sistema Notifiche
- Integrazione OneSignal
- Notifiche per cali prezzo
- Gestione preferenze utente
- Targeting per distributore specifico

### Design Responsive
- Ottimizzato per mobile
- Menu collassabile
- Layout adattivo
- Touch-friendly

## API Integration

I template si integrano con:
- **API Vercel**: Per dati distributori e prezzi
- **OneSignal**: Per notifiche push
- **WordPress REST API**: Per funzionalità native

## Troubleshooting

### Template non si caricano
1. Verifica che le pagine siano state create
2. Controlla i permalink (vai in Impostazioni > Permalink e salva)
3. Verifica i permessi file

### Mappa non funziona
1. Controlla che Leaflet.js sia caricato
2. Verifica la console per errori JavaScript
3. Assicurati che l'API base sia configurata

### Notifiche non arrivano
1. Verifica configurazione OneSignal
2. Controlla che l'utente abbia accettato le notifiche
3. Verifica i tag OneSignal

## Supporto

Per problemi o personalizzazioni:
1. Controlla i log WordPress
2. Verifica la console browser
3. Testa con plugin disabilitati
