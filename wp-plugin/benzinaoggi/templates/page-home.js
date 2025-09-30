(function(){
  'use strict';
  
  // Configurazione
  const config = {
    apiBase: window.BenzinaOggi?.apiBase || '',
    mapCenter: [41.8719, 12.5674],
    defaultZoom: 6
  };

  // Elementi DOM
  const elements = {
    locationInput: document.getElementById('bo-location'),
    fuelSelect: document.getElementById('bo-fuel'),
    radiusSelect: document.getElementById('bo-radius'),
    searchBtn: document.getElementById('bo-search-btn'),
    myLocationBtn: document.getElementById('bo-my-location'),
    map: null,
    resultsList: document.getElementById('bo-results'),
    resultsCount: document.getElementById('bo-results-count'),
    markers: []
  };

  // Stato applicazione
  let state = {
    userLocation: null,
    searchResults: [],
    currentFilters: {
      location: '',
      fuel: '',
      radius: 10
    },
    cityLocation: null, // Coordinate della città cercata
    page: 1,
    total: 0,
    pageSize: 20,
    allResults: [] // Tutti i risultati dall'API
  };

  // Funzione per ottenere le coordinate di una città
  async function getCityCoordinates(cityName) {
    try {
      // Usa Nominatim (OpenStreetMap) per il geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&countrycodes=it&limit=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error('Errore geocoding:', error);
      return null;
    }
  }

  // Inizializzazione
  function init() {
    if (!elements.map) {
      initMap();
    }
    bindEvents();
    loadInitialData();
  }

  // Inizializza mappa
  function initMap() {
    // Controlla se la mappa è già stata inizializzata
    if (elements.map || document.getElementById('bo_map')._leaflet_id) {
      console.log('Mappa già inizializzata, skip');
      return;
    }
    
    try {
      elements.map = L.map('bo_map').setView(config.mapCenter, config.defaultZoom);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(elements.map);

      // Controlli mappa
      L.control.zoom({ position: 'bottomright' }).addTo(elements.map);
    } catch (error) {
      console.warn('Errore nell\'inizializzazione della mappa:', error);
    }
  }

  // Eventi
  function bindEvents() {
    elements.searchBtn?.addEventListener('click', handleSearch);
    elements.myLocationBtn?.addEventListener('click', handleMyLocation);
    elements.locationInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
    elements.fuelSelect?.addEventListener('change', handleSearch);
    elements.radiusSelect?.addEventListener('change', handleSearch);
  }

  // Geolocalizzazione
  function handleMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal browser');
      return;
    }

    elements.myLocationBtn.disabled = true;
    elements.myLocationBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
      <span style="font-size: 12px;">Ricerca...</span>
    `;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log('Posizione ottenuta:', state.userLocation);
        
        // Centra la mappa sulla posizione dell'utente
        if (elements.map) {
          elements.map.setView([state.userLocation.lat, state.userLocation.lng], 13);
        }
        
        // Aggiorna i filtri
        state.currentFilters.location = `${state.userLocation.lat},${state.userLocation.lng}`;
        elements.locationInput.value = 'La mia posizione';
        
        // Cerca distributori vicini
        handleSearch();
      },
      (error) => {
        console.error('Errore geolocalizzazione:', error);
        let errorMessage = 'Impossibile ottenere la posizione.';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permesso di geolocalizzazione negato. Abilita la posizione nelle impostazioni del browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Posizione non disponibile.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Timeout nella richiesta di posizione.';
            break;
        }
        
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    ).finally(() => {
      elements.myLocationBtn.disabled = false;
      elements.myLocationBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `;
    });
  }

  // Ricerca
  function handleSearch() {
    const location = elements.locationInput?.value.trim() || '';
    const fuel = elements.fuelSelect?.value || '';
    const radius = parseInt(elements.radiusSelect?.value) || 10;

    state.currentFilters = { location, fuel, radius };

    if (!location && !state.userLocation) {
      alert('Inserisci una località o usa "La mia posizione"');
      return;
    }

    searchDistributors();
  }

  // Cerca distributori
  async function searchDistributors() {
    try {
      showLoading(true);
      
      const params = new URLSearchParams();
      // Non inviamo limit per ottenere tutti i risultati

      // Priorità: se l'utente ha inserito un nome di città, usa la ricerca per città
      if (state.currentFilters.location && !state.userLocation) {
        params.append('city', state.currentFilters.location);
        console.log('Ricerca per città:', state.currentFilters.location);
        
        // Ottieni le coordinate della città per applicare il raggio
        state.cityLocation = await getCityCoordinates(state.currentFilters.location);
        if (state.cityLocation) {
          params.append('lat', state.cityLocation.lat);
          params.append('lon', state.cityLocation.lng);
          params.append('radiusKm', state.currentFilters.radius);
          console.log('Coordinate città trovate:', state.cityLocation, 'raggio:', state.currentFilters.radius);
        }
      } else if (state.userLocation) {
        // Solo se l'utente ha usato la geolocalizzazione, usa le coordinate
        params.append('lat', state.userLocation.lat);
        params.append('lon', state.userLocation.lng);
        params.append('radiusKm', state.currentFilters.radius);
        console.log('Ricerca con coordinate:', state.userLocation, 'raggio:', state.currentFilters.radius);
      }

      if (state.currentFilters.fuel) {
        params.append('fuel', state.currentFilters.fuel);
      }

      const apiUrl = `${config.apiBase}/api/distributors?${params}`;
      console.log('Chiamata API:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log('Risposta API:', data);

      if (data.ok) {
        state.allResults = Array.isArray(data.distributors) ? data.distributors : [];
        state.total = state.allResults.length;
        state.page = 1; // Reset alla prima pagina
        console.log('Distributori trovati:', state.total);
        
        // Ordina per distanza se disponibile, altrimenti per ID
        state.allResults.sort((a, b) => {
          if (a.distance && b.distance) {
            return a.distance - b.distance;
          }
          return (a.impiantoId || 0) - (b.impiantoId || 0);
        });
        
        // Mostra tutti i risultati
        state.searchResults = state.allResults;
        updateResults();
        updateMap();
      } else {
        throw new Error(data.error || 'Errore nella ricerca');
      }
    } catch (error) {
      console.error('Errore ricerca:', error);
      alert('Errore durante la ricerca: ' + error.message);
    } finally {
      showLoading(false);
    }
  }

  // Aggiorna risultati
  function updateResults() {
    if (!elements.resultsList) return;

    const totalResults = state.total;
    const totalPages = Math.max(1, Math.ceil(totalResults / state.pageSize));

    // Calcola i risultati per la pagina corrente
    const startIndex = (state.page - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    state.searchResults = state.allResults.slice(startIndex, endIndex);

    const currentPageCount = state.searchResults.length;

    // Aggiorna il contatore
    elements.resultsCount.textContent = `${totalResults} risultati totali (pagina ${state.page}/${totalPages} - ${currentPageCount} mostrati)`;

    if (totalResults === 0) {
      elements.resultsList.innerHTML = `
        <div class="bo-no-results">
          <h3>Nessun distributore trovato</h3>
          <p>Prova a modificare i filtri di ricerca o ad ampliare il raggio</p>
        </div>
      `;
      return;
    }

    const itemsHtml = state.searchResults.map(distributor => {
      const prices = (distributor.prices || []).map(price => `
        <div class="bo-price-item">
          <div class="bo-price-label">${price.fuelType}</div>
          <div class="bo-price-value">€${price.price.toFixed(3)}</div>
          ${price.isSelfService ? '<div class="bo-price-service">Self</div>' : ''}
        </div>
      `).join('');

      const distance = distributor.distance ? 
        `<div class="bo-result-distance">${distributor.distance.toFixed(1)} km</div>` : '';

      return `
        <div class="bo-result-item" 
             data-impianto="${distributor.impiantoId}"
             data-bandiera="${distributor.bandiera || 'Distributore'}"
             data-comune="${distributor.comune || ''}">
          <div class="bo-result-header">
            <div class="bo-result-brand">${distributor.bandiera || 'Distributore'}</div>
            ${distance}
          </div>
          <div class="bo-result-address">${distributor.indirizzo || ''}, ${distributor.comune || ''}</div>
          <div class="bo-result-prices">${prices}</div>
        </div>
      `;
    }).join('');

    // Pagination controls
    const canPrev = state.page > 1;
    const canNext = state.page < totalPages;
    const pagerHtml = totalResults > state.pageSize ? `
      <div class="bo-pager" style="display:flex;gap:8px;align-items:center;justify-content:center;margin:16px 0;">
        <button onclick="prevPage()" ${!canPrev ? 'disabled' : ''} style="padding:8px 12px;border:1px solid #ddd;background:${!canPrev ? '#f5f5f5' : '#fff'};cursor:${!canPrev ? 'not-allowed' : 'pointer'};">‹ Precedente</button>
        <span style="font-size:12px;opacity:.8">Pagina ${state.page} di ${totalPages}</span>
        <button onclick="nextPage()" ${!canNext ? 'disabled' : ''} style="padding:8px 12px;border:1px solid #ddd;background:${!canNext ? '#f5f5f5' : '#fff'};cursor:${!canNext ? 'not-allowed' : 'pointer'};">Successiva ›</button>
      </div>
    ` : '';

    elements.resultsList.innerHTML = itemsHtml + pagerHtml;

    // Eventi click sui risultati
    elements.resultsList.querySelectorAll('.bo-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const impiantoId = item.dataset.impianto;
        const bandiera = item.dataset.bandiera || 'Distributore';
        const comune = item.dataset.comune || '';
        
        if (impiantoId) {
          // Crea lo slug nel formato {BANDIERA}-{COMUNE}-{IMPIANTO_ID}
          const pageSlug = `${bandiera}-${comune}-${impiantoId}`.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          
          // Usa il nuovo formato di URL
          window.location.href = `/${pageSlug}/`;
        }
      });
    });
  }

  // Aggiorna mappa
  function updateMap() {
    if (!elements.map) return;

    // Rimuovi marker esistenti
    elements.markers.forEach(marker => elements.map.removeLayer(marker));
    elements.markers = [];

    if (state.searchResults.length === 0) return;

    // Aggiungi marker per ogni distributore
    const bounds = L.latLngBounds();
    
    state.searchResults.forEach(distributor => {
      if (distributor.latitudine && distributor.longitudine) {
        const marker = L.marker([distributor.latitudine, distributor.longitudine])
          .addTo(elements.map);
        
        const prices = (distributor.prices || [])
          .map(p => `${p.fuelType}: €${p.price.toFixed(3)}`)
          .join('<br>');
        
        marker.bindPopup(`
          <strong>${distributor.bandiera || 'Distributore'}</strong><br>
          ${distributor.indirizzo || ''}<br>
          ${prices}
        `);
        
        marker.on('click', () => {
          const bandiera = (distributor.bandiera || 'Distributore');
          const comune = (distributor.comune || '').toString();
          const pageSlug = `${bandiera}-${comune}-${distributor.impiantoId}`
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          window.location.href = `/${pageSlug}/`;
        });
        
        elements.markers.push(marker);
        bounds.extend([distributor.latitudine, distributor.longitudine]);
      }
    });

    // Centra mappa sui risultati
    if (elements.markers.length > 0) {
      elements.map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Assicura spazio per footer: imposta padding-bottom dinamico in base alla lista
    try {
      const wrap = document.querySelector('.benzinaoggi-wrap');
      const listHeight = elements.resultsList ? elements.resultsList.scrollHeight : 0;
      if (wrap) {
        wrap.style.paddingBottom = Math.min(Math.max(listHeight * 0.05, 16), 64) + 'px';
      }
    } catch(_) {}
  }

  // Carica dati iniziali
  function loadInitialData() {
    // Mostra un messaggio per invitare l'utente a usare la geolocalizzazione
    console.log('Applicazione caricata. Clicca il pulsante di geolocalizzazione per trovare distributori vicini.');
    
    // Mostra un messaggio nella lista risultati
    if (elements.resultsList) {
      elements.resultsList.innerHTML = `
        <div class="bo-welcome-message">
          <h3>Benvenuto in BenzinaOggi!</h3>
          <p>Clicca il pulsante <strong>📍</strong> accanto al campo "Dove" per trovare i distributori più vicini a te.</p>
          <p>Oppure inserisci manualmente una città o indirizzo.</p>
        </div>
      `;
      // Mantiene spazio sotto la lista iniziale per non sovrapporre il footer
      try {
        const wrap = document.querySelector('.benzinaoggi-wrap');
        if (wrap) { wrap.style.paddingBottom = '48px'; }
      } catch(_) {}
    }
  }

  // Mostra/nascondi loading
  function showLoading(show) {
    const btn = elements.searchBtn;
    if (btn) {
      btn.disabled = show;
      btn.textContent = show ? 'Ricerca...' : 'Cerca';
    }
  }

  // Funzioni di paginazione (globali per essere accessibili dai button onclick)
  window.prevPage = function() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page > 1) {
      state.page -= 1;
      updateResults(); // Solo aggiorna i risultati, non richiama l'API
      updateMap();
    }
  };

  window.nextPage = function() {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page < totalPages) {
      state.page += 1;
      updateResults(); // Solo aggiorna i risultati, non richiama l'API
      updateMap();
    }
  };

  // Inizializza quando il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
