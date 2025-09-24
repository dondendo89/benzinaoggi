# 🔥 FCM Semplificato - Solo Notifiche Push

Sistema semplificato per notifiche push usando solo l'API REST di Firebase (compatibile con Vercel).

## ✅ Cosa è incluso

- **API REST FCM** - Invia notifiche usando l'API REST di Firebase
- **Service Worker** - Gestisce notifiche in background
- **Hook React** - `useFCM` per gestire FCM nel frontend
- **Integrazione WordPress** - Plugin aggiornato per FCM
- **Compatibile Vercel** - Funziona senza Firebase CLI

## ❌ Cosa è stato rimosso

- ~~Firebase CLI~~ - Non necessario per solo notifiche
- ~~Firebase Hosting~~ - Usa Vercel per hosting
- ~~Script di deploy~~ - Deploy automatico da GitHub
- ~~Configurazioni complesse~~ - Solo variabili d'ambiente

## 🚀 Setup Rapido

### 1. Configura Firebase
```bash
# Vai su https://console.firebase.google.com/
# Crea progetto > Abilita Cloud Messaging
# Aggiungi app Web > Copia configurazione
```

### 2. Variabili d'Ambiente
```env
# Solo queste variabili sono necessarie
FIREBASE_SERVER_KEY=AAAA...your-server-key
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

### 3. Test
```bash
npm run dev
# Vai su http://localhost:3000/test-notifications
```

## 📁 File Principali

```
├── src/
│   ├── lib/firebase.ts          # Configurazione Firebase
│   └── hooks/useFCM.ts          # Hook React per FCM
├── app/api/notifications/
│   ├── send/route.ts            # API invio notifiche FCM
│   ├── preferences/route.ts     # API preferenze utente
│   └── subscribe/route.ts       # API sottoscrizione topic
├── public/
│   └── firebase-messaging-sw.js # Service Worker FCM
└── wp-plugin/benzinaoggi/
    └── public/distributor.js    # JavaScript FCM integrato
```

## 🎯 Funzionalità

### API Notifiche
- **POST** `/api/notifications/send` - Invia notifiche FCM
- **POST** `/api/notifications/preferences` - Salva preferenze utente
- **POST** `/api/notifications/subscribe` - Sottoscrizione topic

### Targeting Avanzato
- **Topic FCM**: `price_drops`, `fuel_benzina`, `distributor_12345`
- **Notifiche specifiche** per distributore + carburante
- **Sottoscrizione automatica** basata su preferenze

### Integrazione WordPress
- Plugin aggiornato per caricare Firebase
- JavaScript FCM integrato
- Cron automatico per variazioni prezzo

## 🧪 Test

```bash
# Test API notifiche
curl -X POST "http://localhost:3000/api/notifications/send" \
  -H "Content-Type: application/json" \
  -d '{"impiantoId": 12345, "distributorId": 1, "fuelType": "Benzina", "distributorName": "Test", "oldPrice": 1.850, "newPrice": 1.750, "direction": "down"}'

# Test API preferenze
curl -X POST "http://localhost:3000/api/notifications/preferences" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "preferences": {"enabled": true, "type": "fuel", "identifier": "Benzina"}}'
```

## 🚨 Troubleshooting

### Errore "FIREBASE_SERVER_KEY not configured"
- Configura la variabile d'ambiente `FIREBASE_SERVER_KEY`

### Errore "FCM API error: 404"
- Verifica che la Server Key sia corretta
- Controlla che il progetto Firebase sia attivo

### Token FCM non disponibile
- Verifica supporto browser notifiche
- Controlla permessi utente
- Verifica configurazione VAPID

## 🎉 Vantaggi

- ✅ **Semplice** - Solo API REST, niente CLI
- ✅ **Vercel Ready** - Funziona perfettamente su Vercel
- ✅ **Leggero** - Meno dipendenze e configurazioni
- ✅ **Affidabile** - Usa l'infrastruttura Google
- ✅ **Gratuito** - Fino a 100M messaggi/mese

## 📚 Documentazione Completa

Per setup dettagliato, vedi [FCM_SETUP.md](./FCM_SETUP.md)
