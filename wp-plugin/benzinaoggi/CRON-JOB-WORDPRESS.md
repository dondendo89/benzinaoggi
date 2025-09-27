# 🕐 Cron Job WordPress - Aggiornamento Prezzi Giornaliero

## Panoramica

Il plugin WordPress include un sistema di cron job intelligente che:
- **Aggiorna prezzi** ogni giorno alle **6:00** usando API MISE diretta
- **Rileva variazioni** ogni **10 minuti** con endpoint smart
- **Invia notifiche** automaticamente per cali di prezzo

## ⚙️ Configurazione Automatica

### **Cron Job Principale (Giornaliero)**
- **Quando**: Ogni giorno alle 6:00 (ora locale WordPress)
- **Hook**: `benzinaoggi_daily_price_update`
- **Endpoint**: `/api/update-and-check-variations` (Smart)
- **Scopo**: Aggiorna prezzi + rileva variazioni + invia notifiche

### **Cron Job Variazioni (Continuo)**
- **Quando**: Ogni 10 minuti
- **Hook**: `benzinaoggi_check_variations`
- **Endpoint**: `/api/check-variations-smart` (Smart)
- **Scopo**: Rileva variazioni intelligenti e invia notifiche

### **Configurazione Automatica**
Il cron job viene configurato automaticamente all'attivazione del plugin:

```php
// Hook per il job
add_action('benzinaoggi_daily_price_update', [$this, 'cron_daily_price_update']);

// Schedulazione automatica alle 6:00
add_action('init', function(){
    if (!wp_next_scheduled('benzinaoggi_daily_price_update')) {
        $next = $this->next_run_6am();
        wp_schedule_event($next, 'daily', 'benzinaoggi_daily_price_update');
    }
});
```

## 🔧 Funzionalità

### **1. Aggiornamento Prezzi con API MISE**
- Chiama l'endpoint Vercel `/api/cron/update-prices-daily`
- Processa fino a 1000 distributori
- Utilizza API MISE diretta per dati real-time
- Confronta prezzi locali vs MISE
- Aggiorna solo se ci sono differenze

### **2. Gestione Errori**
- Timeout di 5 minuti per la chiamata API
- Log dettagliati di tutti gli errori
- Continua anche se alcuni distributori falliscono
- Salva statistiche di esecuzione

### **3. Statistiche e Monitoraggio**
- Conta distributori processati
- Conta prezzi aggiornati e creati
- Conta errori API MISE
- Salva timestamp ultima esecuzione

## 🎛️ Controllo Manuale

### **Interfaccia Admin**
Vai in **Impostazioni > Benzina Oggi > Importa Dati**:

- **Pulsante**: "Esegui aggiornamento prezzi giornaliero"
- **Funzione**: Esegue immediatamente il job
- **Log**: Mostra risultati in tempo reale

### **Statistiche Visualizzate**
```
Ultimo aggiornamento prezzi: 2025-01-27 06:00:15
Statistiche: 1000 processati, 150 aggiornati, 25 creati, 5 errori
```

## 📊 Log e Monitoraggio

### **Log WordPress**
I log vengono salvati in `wp_options` con chiave `benzinaoggi_sync_log`:

```
[2025-01-27 06:00:00] Avvio aggiornamento prezzi giornaliero con API MISE...
[2025-01-27 06:02:30] Aggiornamento completato: 1000 processati, 150 aggiornati, 25 creati, 5 errori
```

### **Statistiche Salvate**
```php
update_option('benzinaoggi_last_price_update', [
    'when' => '2025-01-27 06:02:30',
    'processed' => 1000,
    'updated' => 150,
    'created' => 25,
    'errors' => 5
]);
```

## 🔄 Flusso di Esecuzione

### **1. Trigger Automatico (6:00)**
```
WordPress Cron → benzinaoggi_daily_price_update → cron_daily_price_update()
```

### **2. Chiamata API Vercel**
```php
$response = wp_remote_get($api_base . '/api/cron/update-prices-daily?limit=1000&force=false', [
    'timeout' => 300,
    'headers' => [
        'Authorization' => 'Bearer ' . $api_secret,
        'User-Agent' => 'BenzinaOggi-WordPress/1.0'
    ]
]);
```

### **3. Processamento Risultati**
- Verifica risposta API
- Estrae statistiche
- Salva log e statistiche
- Mostra notifica admin

## ⚡ Vantaggi

### **Dati in Tempo Reale**
- ✅ Utilizza API MISE diretta
- ✅ Prezzi sempre aggiornati
- ✅ Rileva variazioni immediate

### **Performance Ottimizzata**
- ✅ Processa 1000 distributori in batch
- ✅ Timeout di 5 minuti
- ✅ Gestione errori robusta

### **Monitoraggio Completo**
- ✅ Log dettagliati
- ✅ Statistiche salvate
- ✅ Controllo manuale disponibile

## 🚨 Troubleshooting

### **Cron Non Si Avvia**
1. Verifica che WordPress cron sia attivo
2. Controlla le impostazioni di `wp-cron.php`
3. Usa il pulsante manuale per testare

### **Errori API**
1. Verifica `API Base URL` nelle impostazioni
2. Controlla `API Secret` per autenticazione
3. Controlla i log per dettagli errori

### **Timeout**
1. Il job ha timeout di 5 minuti
2. Se necessario, riduci il limite distributori
3. Controlla la velocità di risposta API MISE

## 📈 Configurazione Avanzata

### **Modificare Orario**
Per cambiare l'orario, modifica in `benzinaoggi.php`:

```php
private function next_run_6am() {
    // Cambia '06:00' con l'orario desiderato
    $six = strtotime($date.' 06:00:00');
}
```

### **Modificare Limite Distributori**
Nella chiamata API, cambia il parametro `limit`:

```php
$response = wp_remote_get($api_base . '/api/cron/update-prices-daily?limit=500&force=false', [
```

---

**🎯 Risultato**: Prezzi sempre aggiornati ogni giorno alle 6:00 con dati MISE real-time!
