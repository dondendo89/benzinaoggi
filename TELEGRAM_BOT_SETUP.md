# 🤖 Configurazione Bot Telegram per BenzinaOggi

Guida completa per configurare e utilizzare il bot Telegram di BenzinaOggi.

## 📋 Prerequisiti

1. **Account Telegram** (ovviamente!)
2. **Accesso al server** dove gira l'applicazione
3. **Database PostgreSQL** con le tabelle create
4. **Token del bot** da BotFather

## 🔧 Setup Iniziale

### 1. Creazione del Bot con BotFather

1. Apri Telegram e cerca `@BotFather`
2. Invia `/start` per iniziare
3. Invia `/newbot` per creare un nuovo bot
4. Scegli un nome per il bot (es. "BenzinaOggi Bot")
5. Scegli un username per il bot (deve finire con "bot", es. "benzinaoggi_bot")
6. **Salva il token** che ti viene fornito (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Configurazione Environment Variables

Aggiungi queste variabili al tuo `.env` o `.env.local`:

```env
# Token del bot Telegram (obbligatorio)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Secret per webhook (opzionale ma consigliato)
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string

# URL base dell'API (per le chiamate interne)
NEXT_PUBLIC_API_URL=https://benzinaoggi.vercel.app

# Token API per autenticazione (già esistente)
API_SECRET=your-existing-api-secret
```

### 3. Creazione Tabelle Database

Esegui questo script SQL sul tuo database PostgreSQL:

```sql
-- Tabella per gli utenti Telegram
CREATE TABLE IF NOT EXISTS "TelegramUser" (
    "id" SERIAL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL UNIQUE,
    "chatId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tabella per le iscrizioni
CREATE TABLE IF NOT EXISTS "TelegramSubscription" (
    "id" SERIAL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "impiantoId" INTEGER,
    "fuelType" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "TelegramSubscription_telegramId_type_key" UNIQUE("telegramId", "type", "impiantoId", "fuelType", "city")
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS "TelegramUser_telegramId_idx" ON "TelegramUser"("telegramId");
CREATE INDEX IF NOT EXISTS "TelegramSubscription_telegramId_idx" ON "TelegramSubscription"("telegramId");
```

### 4. Configurazione Webhook

Una volta deployata l'applicazione, configura il webhook:

**Metodo 1: Via API**
```bash
curl -X POST https://your-domain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -d '{"action": "set"}'
```

**Metodo 2: Via Browser**
Vai su `https://your-domain.com/api/telegram/setup` per vedere lo status e configurare.

**Metodo 3: Manuale via Telegram API**
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
```

## 🎯 Funzionalità del Bot

### Comandi Disponibili

| Comando | Descrizione | Esempio |
|---------|-------------|---------|
| `/start` | Messaggio di benvenuto e menu principale | `/start` |
| `/subscribe` | Iscrizione alle notifiche | `/subscribe all` |
| `/unsubscribe` | Disiscrizione da tutte le notifiche | `/unsubscribe` |
| `/prezzi` | Mostra prezzi in una città | `/prezzi Roma` |
| `/cerca` | Cerca distributori per località | `/cerca Milano` |
| `/status` | Vedi le tue iscrizioni attive | `/status` |
| `/help` | Lista di tutti i comandi | `/help` |

### Tipi di Iscrizione

1. **Tutte le notifiche** (`/subscribe all`)
   - Ricevi notifiche per tutti i ribassi in Italia

2. **Per città** (`/subscribe Roma`)
   - Ricevi notifiche solo per una città specifica

3. **Distributore specifico** (`/subscribe 8284 Benzina`)
   - Ricevi notifiche per un distributore e carburante specifico

### Funzionalità Speciali

- **📍 Condivisione posizione**: Invia la tua posizione per trovare distributori vicini
- **🔔 Notifiche automatiche**: Ricevi notifiche sui ribassi in tempo reale
- **💰 Prezzi aggiornati**: Consulta i prezzi più recenti per qualsiasi città
- **🗺️ Mappe integrate**: Ricevi la posizione dei distributori direttamente in chat

## 🔧 Amministrazione

### Monitoraggio

Controlla statistiche e status del bot:
```bash
curl https://your-domain.com/api/telegram/notify
```

### Test Notifiche

Invia una notifica di test:
```bash
curl -X POST https://your-domain.com/api/telegram/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{
    "type": "price_drop",
    "data": {
      "notifications": [{
        "distributorId": 123,
        "impiantoId": 8284,
        "distributor": {"bandiera": "Test", "comune": "Roma"},
        "fuelType": "Benzina",
        "baseFuelType": "Benzina",
        "isSelfService": false,
        "oldPrice": 1.650,
        "newPrice": 1.640,
        "direction": "down",
        "delta": -0.010,
        "percentage": -0.6
      }]
    }
  }'
```

### Debug Webhook

Verifica che il webhook sia configurato correttamente:
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

## 🚀 Deploy

### Vercel

1. Aggiungi le variabili d'ambiente nel dashboard Vercel
2. Deploy l'applicazione
3. Configura il webhook usando l'URL di Vercel

### Server Proprio

1. Assicurati che l'applicazione sia raggiungibile via HTTPS
2. Configura le variabili d'ambiente
3. Avvia l'applicazione
4. Configura il webhook

## 📊 Integrazione con Sistema Esistente

Il bot si integra automaticamente con:

- **Sistema notifiche OneSignal**: Le notifiche vengono inviate sia via OneSignal che Telegram
- **API distributori esistenti**: Usa le stesse API per prezzi e ricerca
- **Database prezzi**: Accede agli stessi dati di prezzo del sito web
- **Sistema di iscrizioni**: Funziona in parallelo con le iscrizioni web

## 🔍 Troubleshooting

### Bot non risponde
1. Verifica che `TELEGRAM_BOT_TOKEN` sia configurato correttamente
2. Controlla che il webhook sia impostato: `GET /api/telegram/setup`
3. Verifica i logs dell'applicazione

### Notifiche non arrivano
1. Controlla che l'utente sia iscritto: usa `/status` nel bot
2. Verifica che `API_SECRET` sia configurato
3. Controlla i logs delle notifiche

### Errori di database
1. Assicurati che le tabelle Telegram siano create
2. Verifica le permissions del database
3. Controlla la connessione DATABASE_URL

## 📈 Statistiche

Il bot traccia automaticamente:
- Numero di utenti attivi
- Iscrizioni per tipo
- Messaggi inviati/ricevuti
- Errori e fallimenti

Accedi alle statistiche via: `GET /api/telegram/notify`

## 🔒 Sicurezza

- **Webhook protetto**: Usa `TELEGRAM_WEBHOOK_SECRET` per validare le richieste
- **API autenticata**: Tutte le chiamate interne usano `API_SECRET`
- **Rate limiting**: Implementato per evitare spam
- **Gestione errori**: Gli utenti che bloccano il bot vengono automaticamente disattivati

## 🎉 Pronto!

Una volta completata la configurazione, il tuo bot Telegram sarà operativo e integrato con il sistema BenzinaOggi!

Gli utenti potranno:
1. Cercare il bot su Telegram (es. @benzinaoggi_bot)
2. Avviarlo con `/start`
3. Iscriversi alle notifiche con `/subscribe all`
4. Ricevere notifiche automatiche sui ribassi di prezzo
5. Cercare prezzi e distributori direttamente in chat

🚗💨 Buona strada!
