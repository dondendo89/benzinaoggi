# Firebase Cloud Messaging (FCM) Setup

Sistema semplificato per notifiche push usando solo l'API REST di Firebase (compatibile con Vercel).

## Configurazione Firebase

### 1. Crea un progetto Firebase

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita "Cloud Messaging" nelle funzionalità

### 2. Configura l'app Web

1. Nel progetto Firebase, vai su "Project Settings" > "General"
2. Nella sezione "Your apps", clicca su "Add app" > "Web"
3. Registra l'app con un nome (es. "BenzinaOggi")
4. Copia la configurazione Firebase

### 3. Ottieni le credenziali

#### Configurazione Firebase (per il frontend):
```json
{
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef..."
}
```

#### Server Key (per il backend):
1. Vai su "Project Settings" > "Cloud Messaging"
2. Copia la "Server key" (inizia con "AAAA...")

#### VAPID Key (per le notifiche web):
1. Vai su "Project Settings" > "Cloud Messaging"
2. Nella sezione "Web configuration", genera una coppia di chiavi VAPID
3. Copia la "Key pair" pubblica

### 4. Configura le variabili d'ambiente

Crea un file `.env.local` con:

```env
# Firebase Configuration
FIREBASE_SERVER_KEY=AAAA...your-server-key
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-key
```

### 5. Configura WordPress Plugin

Nel plugin WordPress, vai su "Impostazioni" > "BenzinaOggi" e incolla la configurazione Firebase nel campo "Firebase Config JSON".

## Test del Sistema

1. Vai su `http://localhost:3000/test-notifications`
2. Clicca su "Test FCM Token" per ottenere il token
3. Clicca su "Test Sottoscrizione Topic" per sottoscriversi
4. Testa l'invio di notifiche

## Funzionalità

- ✅ **Notifiche Push Reali**: Funzionano anche con l'app chiusa
- ✅ **Targeting Avanzato**: Per distributore e tipo di carburante
- ✅ **Compatibile con Vercel**: Usa API REST invece di Admin SDK
- ✅ **Gratuito**: Fino a 100M messaggi/mese
- ✅ **Cross-Platform**: Web, Android, iOS

## Troubleshooting

### Errore "FIREBASE_SERVER_KEY not configured"
- Assicurati di aver configurato la variabile d'ambiente `FIREBASE_SERVER_KEY`

### Errore "Firebase not loaded"
- Verifica che la configurazione Firebase sia corretta nel plugin WordPress
- Controlla che i file Firebase siano caricati correttamente

### Token FCM non disponibile
- Verifica che il browser supporti le notifiche
- Controlla che l'utente abbia concesso i permessi
- Verifica la configurazione VAPID

## Workflow Semplificato

1. **Sviluppo locale**: `npm run dev`
2. **Test**: `npm run test`
3. **Build**: `npm run build`
4. **Deploy su Vercel**: Push su GitHub (deploy automatico)

Il sistema è ottimizzato per:
- ✅ **Vercel** - Deploy automatico da GitHub
- ✅ **API REST FCM** - Funziona senza Firebase CLI
- ✅ **Configurazione semplice** - Solo variabili d'ambiente
