# Template BenzinaOggi

Questa directory contiene i template personalizzati per il plugin BenzinaOggi.

## Struttura

- `page-distributor.php` - Template per le pagine dei distributori di carburante

## Come Usare

### 1. Copia nel Tema Attivo

Per personalizzare i template, copiali nella directory del tuo tema attivo:

```bash
# Copia nella directory del tema attivo
cp -r wp-content/themes/benzinaoggi-templates/* wp-content/themes/[nome-tema]/
```

### 2. Personalizzazione

Puoi modificare liberamente i template per adattarli al design del tuo sito:

- **CSS**: Modifica gli stili nel tag `<style>`
- **HTML**: Cambia la struttura della pagina
- **JavaScript**: Personalizza il caricamento dei dati

### 3. Fallback

Se i template non sono presenti nella directory del tema, il plugin userà automaticamente i template di default.

## Template Disponibili

### page-distributor.php
Template per le pagine dei distributori che include:
- Informazioni del distributore (bandiera, comune, indirizzo)
- Prezzi carburanti aggiornati
- Design responsive
- Integrazione con API BenzinaOggi

## Note Tecniche

- I template sono compatibili con WordPress 5.0+
- Supportano tutti i browser moderni
- Sono ottimizzati per dispositivi mobili
- Utilizzano le API del plugin BenzinaOggi
