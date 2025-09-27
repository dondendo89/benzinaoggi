# 🧠 Sistema Cron Job Intelligente - BenzinaOggi

## 🎯 **Panoramica**

Il sistema di cron job WordPress è stato potenziato per essere **intelligente** e **automatico**:

- ✅ **Aggiorna prezzi** ogni giorno alle 6:00
- ✅ **Rileva variazioni** ogni 10 minuti
- ✅ **Invia notifiche** automaticamente per cali di prezzo
- ✅ **Usa endpoint smart** per rilevamento ottimale

## 🔄 **Flusso di Lavoro**

### **1. Cron Job Giornaliero (6:00 AM)**
```php
// Hook: benzinaoggi_daily_price_update
// Endpoint: /api/update-and-check-variations
// Scopo: Aggiorna prezzi + rileva variazioni + invia notifiche
```

**Processo:**
1. **Aggiorna prezzi** usando API MISE diretta
2. **Rileva variazioni** con endpoint smart
3. **Raggruppa variazioni** per distributore
4. **Invia notifiche** per ogni distributore con cali

### **2. Cron Job Variazioni (Ogni 10 minuti)**
```php
// Hook: benzinaoggi_check_variations
// Endpoint: /api/check-variations-smart
// Scopo: Rileva variazioni intelligenti e invia notifiche
```

**Processo:**
1. **Controlla variazioni** con endpoint smart
2. **Se trova cali**, invia notifiche immediatamente
3. **Logga statistiche** per monitoraggio

## 🧠 **Endpoint Smart**

### **`/api/check-variations-smart`**
- 🎯 **Intelligente**: Sceglie automaticamente il metodo migliore
- 🔄 **Fallback**: Se standard trova pochi risultati, prova MISE
- 📊 **Completo**: Combina entrambi i metodi
- 🎯 **Raccomandato**: Per analisi approfondite

### **`/api/update-and-check-variations`**
- ⚡ **Completo**: Aggiorna prezzi + rileva variazioni
- 🔍 **Preciso**: Usa API MISE per confronto real-time
- 🚀 **Automatico**: Processo completo in un endpoint

## 📊 **Logging Intelligente**

### **Cron Job Giornaliero**
```
[2025-01-15 06:00:00] Avvio aggiornamento prezzi giornaliero con rilevamento variazioni...
[2025-01-15 06:00:05] STEP 1: Aggiornamento prezzi e rilevamento variazioni...
[2025-01-15 06:00:15] Aggiornamento completato: 1000 processati, 45 aggiornati, 12 variazioni rilevate
[2025-01-15 06:00:16] STEP 2: Invio notifiche per 12 variazioni...
[2025-01-15 06:00:20] Notifiche inviate per 8 distributori
```

### **Cron Job Variazioni**
```
[2025-01-15 06:10:00] Controllo variazioni ogni 10 minuti con endpoint smart...
[2025-01-15 06:10:05] Controllo variazioni completato (metodo: mise): 3 variazioni rilevate
[2025-01-15 06:10:06] Invio notifiche per 3 variazioni...
```

## 🎯 **Vantaggi del Sistema Smart**

### **1. Rilevamento Ottimale**
- ✅ **Standard**: Veloce per dati storici completi
- ✅ **MISE**: Preciso per confronto real-time
- ✅ **Smart**: Sceglie automaticamente il migliore

### **2. Notifiche Automatiche**
- ✅ **Immediate**: Ogni 10 minuti per variazioni
- ✅ **Giornaliere**: Aggiornamento completo alle 6:00
- ✅ **Intelligenti**: Solo per cali di prezzo

### **3. Monitoraggio Completo**
- ✅ **Log dettagliati**: Ogni operazione tracciata
- ✅ **Statistiche**: Conteggi e performance
- ✅ **Debug**: Informazioni per troubleshooting

## 🔧 **Configurazione**

### **WordPress Admin**
1. **Impostazioni** → **BenzinaOggi**
2. **Tab "Notifiche"** → Configura OneSignal
3. **Tab "Cron Jobs"** → Monitora esecuzioni
4. **Log** → Visualizza dettagli esecuzioni

### **Test Manuale**
```bash
# Test cron job giornaliero
POST /wp-admin/admin-post.php
Action: benzinaoggi_run_daily_update

# Test cron job variazioni  
POST /wp-admin/admin-post.php
Action: benzinaoggi_run_variations
```

## 📈 **Risultati Attesi**

### **Prima del Sistema Smart**
- ❌ Variazioni non rilevate (dati storici insufficienti)
- ❌ Notifiche mancanti
- ❌ Aggiornamenti incompleti

### **Dopo il Sistema Smart**
- ✅ **Variazioni rilevate**: Endpoint smart trova sempre variazioni
- ✅ **Notifiche automatiche**: Inviate per ogni calo di prezzo
- ✅ **Aggiornamenti completi**: Prezzi sempre aggiornati
- ✅ **Monitoraggio**: Log dettagliati per ogni operazione

## 🚀 **Prossimi Passi**

1. **Attiva i cron job** nel WordPress admin
2. **Monitora i log** per verificare funzionamento
3. **Testa le notifiche** con utenti reali
4. **Ottimizza i parametri** se necessario

**Il sistema smart garantisce rilevamento variazioni e notifiche automatiche!** 🎯
