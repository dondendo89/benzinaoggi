# 🚀 Istruzioni Rapide - Template BenzinaOggi

## ✅ Come Abilitare i Template

### 1. Vai nell'Admin WordPress
- **Impostazioni > Benzina Oggi**
- Clicca sul tab **"Pagine Template"**

### 2. Crea le Pagine
- Clicca **"Crea Pagine Template"**
- Il plugin creerà automaticamente:
  - `/benzinaoggi-home/` - Home page con mappa
  - `/benzinaoggi-risultati/` - Pagina risultati
  - Regole per `/distributore-{ID}/` - Dettagli distributori

### 3. Configura i Permalink
- Vai in **Impostazioni > Permalink**
- Clicca **"Salva modifiche"** (anche senza cambiare nulla)

## 🎯 URL delle Pagine

Dopo la creazione avrai:
- **Home**: `https://tuosito.com/benzinaoggi-home/`
- **Risultati**: `https://tuosito.com/benzinaoggi-risultati/`
- **Distributore**: `https://tuosito.com/distributore-123/`

## 🔧 Configurazione Necessaria

### 1. API Vercel
- Vai in **Impostazioni > Benzina Oggi**
- Inserisci l'URL base delle API (es: `https://benzinaoggi.vercel.app`)

### 2. OneSignal (per notifiche)
- Inserisci **App ID** e **REST API Key**
- Configura il Service Worker

## 🎨 Personalizzazione

### Logo
- Sostituisci `/assets/logo-benzinaoggi.svg` con il tuo logo
- Mantieni le dimensioni: 200x60px

### Colori
- Modifica i CSS nei file template
- Colore principale: `#2c5aa0`
- Colore secondario: `#1e3a5f`

### Testo
- Modifica i testi direttamente nei file PHP
- Personalizza i messaggi e le etichette

## 🚨 Risoluzione Problemi

### Template non si carica
```bash
# 1. Vai in Impostazioni > Permalink e salva
# 2. Controlla che le pagine siano state create
# 3. Verifica i permessi file
```

### Mappa non funziona
```bash
# 1. Apri la console browser (F12)
# 2. Controlla errori JavaScript
# 3. Verifica che l'API sia configurata
```

### Notifiche non arrivano
```bash
# 1. Verifica configurazione OneSignal
# 2. Controlla che l'utente abbia accettato le notifiche
# 3. Testa con un distributore specifico
```

## 📱 Test Mobile

1. Apri la home page su mobile
2. Testa la geolocalizzazione
3. Verifica che i filtri siano accessibili
4. Controlla che la mappa sia touch-friendly

## 🔗 Integrazione con il Sito

### Menu di Navigazione
Aggiungi al menu principale:
- **Home BenzinaOggi** → `/benzinaoggi-home/`
- **Trova Distributori** → `/benzinaoggi-risultati/`

### Shortcode
Puoi ancora usare il shortcode `[carburanti_map]` in qualsiasi pagina.

## ✨ Funzionalità Incluse

- ✅ **Design responsive** per tutti i dispositivi
- ✅ **Geolocalizzazione** automatica
- ✅ **Mappa interattiva** con Leaflet
- ✅ **Sistema notifiche** OneSignal
- ✅ **Filtri avanzati** per la ricerca
- ✅ **Esportazione dati** in CSV
- ✅ **Template personalizzabili**

## 🆘 Supporto

Se hai problemi:
1. Controlla i log WordPress
2. Verifica la console browser
3. Testa con plugin disabilitati
4. Controlla la configurazione API

---

**🎉 Fatto!** I tuoi template sono pronti e funzionanti!
