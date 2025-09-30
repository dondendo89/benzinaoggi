(function(){
  'use strict';
  
  // Configurazione
  const config = {
    apiBase: window.BenzinaOggi?.apiBase || '',
    mapCenter: [41.8719, 12.5674],
    defaultZoom: 6,
    pageSize: 20  // Risultati per pagina
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
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalResults: 0,
      pageSize: config.pageSize
    }
  };

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

    // Helper function to reset button state
    function resetButton() {
      elements.myLocationBtn.disabled = false;
      elements.myLocationBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `;
    }

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
        
        // Reset button state
        resetButton();
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
        
        // Reset button state
        resetButton();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }

  // Ricerca
  function handleSearch() {
    const location = elements.locationInput?.value.trim() || '';
    const fuel = elements.fuelSelect?.value || '';
    const radius = parseInt(elements.radiusSelect?.value) || 100;

    state.currentFilters = { location, fuel, radius };
    state.pagination.currentPage = 1; // Reset alla prima pagina

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
      
      const params = new URLSearchParams({
        limit: state.pagination.pageSize,
        page: state.pagination.currentPage
      });

      // Priorità: se l'utente ha inserito un nome di città, usa la ricerca per città
      if (state.currentFilters.location && !state.userLocation) {
        params.append('city', state.currentFilters.location);
        console.log('Ricerca per città:', state.currentFilters.location);
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
        let distributors = data.distributors || [];
        
        // Ordina per distanza se disponibile, altrimenti per ID
        distributors.sort((a, b) => {
          if (a.distance && b.distance) {
            return a.distance - b.distance;
          }
          return (a.impiantoId || 0) - (b.impiantoId || 0);
        });
        
        // Aggiorna stato paginazione
        state.searchResults = distributors;
        state.pagination.totalResults = data.total || distributors.length;
        state.pagination.totalPages = data.totalPages || Math.ceil(state.pagination.totalResults / state.pagination.pageSize);
        
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

    const count = state.searchResults.length;
    const totalResults = state.pagination.totalResults;
    const currentPage = state.pagination.currentPage;
    const totalPages = state.pagination.totalPages;
    
    elements.resultsCount.textContent = `${count} risultati (pagina ${currentPage}/${totalPages}) - Totale: ${totalResults}`;

    if (count === 0) {
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

    // Controlli paginazione
    const canPrev = currentPage > 1;
    const canNext = currentPage < totalPages;
    const pagerHtml = `
      <div class="bo-pager" style="display:flex;gap:8px;align-items:center;justify-content:center;margin:16px 0;">
        <button id="bo-prev" ${canPrev ? '' : 'disabled'} style="padding:6px 10px;">← Precedente</button>
        <span style="font-size:12px;opacity:.8">Pagina ${currentPage} di ${totalPages}</span>
        <button id="bo-next" ${canNext ? '' : 'disabled'} style="padding:6px 10px;">Successiva →</button>
      </div>`;

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

    // Eventi paginazione
    const prevBtn = document.getElementById('bo-prev');
    const nextBtn = document.getElementById('bo-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage -= 1;
        searchDistributors();
      }
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (state.pagination.currentPage < state.pagination.totalPages) {
        state.pagination.currentPage += 1;
        searchDistributors();
      }
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

  // Inizializza quando il DOM è pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
