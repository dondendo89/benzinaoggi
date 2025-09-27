# 🔄 Integrazione API MISE Diretta

## Panoramica

Ho implementato l'integrazione con l'API MISE diretta per migliorare il rilevamento delle variazioni di prezzo. L'API MISE fornisce dati in tempo reale per ogni distributore.

## 🆕 Nuovi Endpoint

### 1. **Sync MISE Prices** - `POST /api/sync-mise-prices`
Sincronizza i prezzi locali con l'API MISE diretta.

**Parametri:**
- `limit` (int): Numero distributori da controllare (default: 10)
- `force` (boolean): Forza aggiornamento anche senza variazioni (default: false)
- `impiantoId` (int, opzionale): ID impianto specifico

**Esempio:**
```bash
POST {{baseUrl}}/api/sync-mise-prices?limit=50&force=false
```

### 2. **Check MISE Variations** - `GET /api/check-mise-variations`
Controlla variazioni confrontando prezzi locali con API MISE in tempo reale.

**Parametri:**
- `limit` (int): Numero distributori da controllare (default: 50)
- `onlyDown` (boolean): Solo cali prezzo (default: true)
- `impiantoId` (int, opzionale): ID impianto specifico

**Esempio:**
```bash
GET {{baseUrl}}/api/check-mise-variations?limit=100&onlyDown=true
```

### 3. **Update and Check Variations (Complete)** - `POST /api/update-and-check-variations`
Operazione completa che combina:
- Aggiornamento prezzi dal CSV
- Controllo variazioni standard
- Controllo con API MISE
- Combinazione risultati

**Parametri:**
- `debug` (boolean): Output debug dettagliato
- `useMiseApi` (boolean): Usa anche API MISE
- `limit` (int): Limite distributori per MISE API

**Esempio:**
```bash
POST {{baseUrl}}/api/update-and-check-variations?debug=true&useMiseApi=true&limit=50
```

## 🔍 Vantaggi dell'API MISE

### **Dati in Tempo Reale**
- L'API MISE fornisce prezzi aggiornati in tempo reale
- Non dipende dal CSV che potrebbe essere ritardato
- Rileva variazioni che potrebbero essere perse nel confronto tra giorni

### **Maggior Accuratezza**
- Confronto diretto tra prezzi locali e MISE
- Tolleranza di 0.001€ per differenze minime
- Normalizzazione automatica dei nomi carburanti

### **Informazioni Dettagliate**
- Percentuale di variazione
- Differenza assoluta in euro
- Timestamp di controllo
- Fonte dei dati (MISE API)

## 📊 Esempio di Risposta

```json
{
  "ok": true,
  "summary": {
    "totalChecked": 50,
    "totalVariations": 12,
    "totalErrors": 0,
    "variationsFound": 12
  },
  "variations": [
    {
      "distributorId": 1,
      "impiantoId": 59183,
      "fuelType": "Benzina",
      "isSelfService": false,
      "oldPrice": 1.899,
      "newPrice": 1.789,
      "direction": "down",
      "difference": -0.11,
      "percentageChange": "-5.79",
      "source": "mise_api",
      "checkedAt": "2025-01-27T10:30:00.000Z"
    }
  ]
}
```

## 🚀 Come Usare

### **1. Test Rapido**
```bash
# Controlla variazioni con API MISE
GET {{baseUrl}}/api/check-mise-variations?limit=10&onlyDown=true
```

### **2. Sincronizzazione Completa**
```bash
# Aggiorna tutto e controlla variazioni
POST {{baseUrl}}/api/update-and-check-variations?useMiseApi=true&limit=50
```

### **3. Distributore Specifico**
```bash
# Controlla un distributore specifico
GET {{baseUrl}}/api/check-mise-variations?impiantoId=59183&onlyDown=true
```

## ⚡ Performance

- **Timeout**: 10 secondi per chiamata API MISE
- **Rate Limiting**: Controlla 50 distributori alla volta
- **Caching**: I dati MISE vengono richiesti solo quando necessario
- **Error Handling**: Continua anche se alcune API falliscono

## 🔧 Configurazione

### **Variabili d'Ambiente**
```bash
API_SECRET=your-secret-key  # Per autenticazione endpoint
```

### **User-Agent**
Le chiamate all'API MISE includono:
```
User-Agent: BenzinaOggi/1.0
```

## 📈 Monitoraggio

### **Log Console**
```
Checking variations between 2025-01-26 and 2025-01-27
Found 1250 prices for today and 1180 for yesterday
Today has 1250 unique price combinations, yesterday has 1180
Processed 1250 today prices: 15 variations, 1235 no change, 0 no yesterday data, 0 no distributor
```

### **Statistiche Endpoint**
- `totalChecked`: Distributori controllati
- `totalVariations`: Variazioni trovate
- `totalErrors`: Errori durante il controllo
- `variationsFound`: Variazioni finali

## 🎯 Raccomandazioni

1. **Usa l'endpoint completo** per operazioni di routine
2. **Limita a 50 distributori** per performance ottimali
3. **Controlla solo cali** (`onlyDown=true`) per notifiche
4. **Monitora i log** per identificare problemi

## 🔄 Integrazione con WordPress

Il plugin WordPress può ora:
- Chiamare l'endpoint completo per aggiornamenti
- Ricevere più variazioni accurate
- Inviare notifiche basate su dati MISE real-time

---

**🎉 Risultato**: Ora rileverai molte più variazioni di prezzo utilizzando l'API MISE diretta!
