# 🔧 FCM Troubleshooting

## ❌ Errore 404 - Server Key non valida

**Problema:** L'API FCM restituisce errore 404 con la chiave attuale.

**Causa:** La chiave in `FIREBASE_SERVER_KEY` non è una Server Key valida per FCM.

### 🔍 Diagnosi

```bash
# Testa la configurazione FCM
curl -s "http://localhost:3000/api/test-fcm"
```

**Output attuale:**
```json
{
  "ok": true,
  "config": {
    "hasServerKey": true,
    "serverKeyPrefix": "BFOVq3KYg1",  // ❌ Non è una Server Key
    "fcmTest": {
      "status": 404,
      "success": false
    }
  }
}
```

### ✅ Soluzioni

#### **Opzione 1: Ottenere Server Key corretta**

1. **Vai su Firebase Console:**
   - https://console.firebase.google.com/
   - Seleziona progetto `benzinaoggi`

2. **Ottieni Server Key:**
   - Project Settings > Cloud Messaging
   - Copia **Server Key** (dovrebbe iniziare con `AAAA...`)

3. **Aggiorna .env.local:**
   ```env
   FIREBASE_SERVER_KEY=AAAA...your-real-server-key
   ```

#### **Opzione 2: Usare endpoint semplificato (attuale)**

Il sistema funziona già con l'endpoint semplificato:

```bash
# Test endpoint semplificato
curl -X POST "http://localhost:3000/api/notifications/simple" \
  -H "Content-Type: application/json" \
  -d '{"impiantoId": 12345, "distributorId": 1, "fuelType": "Benzina", "distributorName": "Test", "oldPrice": 1.850, "newPrice": 1.750, "direction": "down"}'
```

**Output:**
```json
{
  "ok": true,
  "message": "Notification logged (FCM not configured)",
  "notification": {
    "title": "💰 Prezzo Benzina sceso!",
    "message": "Test: Benzina da €1.850 a €1.750 (-5.4%)",
    "target": {"impiantoId": 12345, "distributorId": 1, "fuelType": "Benzina"},
    "timestamp": "2025-09-24T22:24:05.890Z"
  }
}
```

### 🔄 Switch tra endpoint

**Plugin WordPress attualmente usa:**
```php
$url = $base . '/api/notifications/simple';  // ✅ Funziona
```

**Per usare FCM (quando configurato):**
```php
$url = $base . '/api/notifications/send';    // ❌ Richiede Server Key
```

### 📱 Notifiche attuali

**Sistema attuale:**
- ✅ **Log notifiche** - Registra nel console del server
- ✅ **API funzionante** - WordPress può inviare notifiche
- ✅ **Dati completi** - Tutte le informazioni necessarie
- ❌ **Push real-time** - Non invia notifiche push agli utenti

**Per abilitare push real-time:**
1. Configura Server Key corretta
2. Cambia endpoint da `/simple` a `/send`
3. Testa con endpoint FCM

### 🧪 Test completo

```bash
# 1. Test configurazione
curl -s "http://localhost:3000/api/test-fcm"

# 2. Test endpoint semplificato
curl -X POST "http://localhost:3000/api/notifications/simple" \
  -H "Content-Type: application/json" \
  -d '{"impiantoId": 12345, "distributorId": 1, "fuelType": "Benzina", "distributorName": "Test", "oldPrice": 1.850, "newPrice": 1.750, "direction": "down"}'

# 3. Test endpoint FCM (quando configurato)
curl -X POST "http://localhost:3000/api/notifications/send" \
  -H "Content-Type: application/json" \
  -d '{"impiantoId": 12345, "distributorId": 1, "fuelType": "Benzina", "distributorName": "Test", "oldPrice": 1.850, "newPrice": 1.750, "direction": "down"}'
```

### 🎯 Prossimi passi

1. **Immediato:** Sistema funziona con endpoint semplificato
2. **Futuro:** Configura Server Key per push real-time
3. **Opzionale:** Implementa WebSocket per notifiche real-time
