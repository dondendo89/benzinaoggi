(function(){
  'use strict';
  
  // Configurazione
  const config = {
    apiBase: window.BenzinaOggi?.apiBase || '',
    mapCenter: [41.8719, 12.5674],
    defaultZoom: 6,
    pageSize: 50  // Aumenta per mostrare più distributori sulla mappa
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
    // Pulisci geolocalizzazione quando l'utente inizia a digitare
    elements.locationInput?.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      if (value && value !== 'La mia posizione') {
        console.log('User is typing, clearing geolocation state');
        state.userLocation = null;
      }
    });
    elements.fuelSelect?.addEventListener('change', handleSearch);
    elements.radiusSelect?.addEventListener('change', handleSearch);

    // Autocomplete città (Nominatim)
    initCityAutocomplete();
  }

  // Debounce helper
  function debounce(fn, wait){
    let t; return function(){ const ctx=this, args=arguments; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx, args); }, wait||200); };
  }

  // Autocomplete con Nominatim (OSM)
  function initCityAutocomplete(){
    if (!elements.locationInput) return;
    // Crea dropdown
    let list = document.createElement('div');
    list.id = 'bo-ac-list';
    list.style.position = 'absolute';
    list.style.top = '100%';
    list.style.left = '0';
    list.style.right = '0';
    list.style.zIndex = '1000';
    list.style.background = '#fff';
    list.style.border = '1px solid #e1e5e9';
    list.style.borderTop = 'none';
    list.style.borderRadius = '0 0 8px 8px';
    list.style.boxShadow = '0 10px 20px rgba(0,0,0,0.08)';
    list.style.display = 'none';

    const parent = document.querySelector('.bo-location-input-group');
    if (parent) parent.appendChild(list);

    const updateList = (items) => {
      if (!items || items.length === 0) { list.style.display = 'none'; list.innerHTML=''; return; }
      list.innerHTML = '';
      items.slice(0, 8).forEach((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.background = 'white';
        btn.style.border = 'none';
        btn.style.padding = '10px 12px';
        btn.style.cursor = 'pointer';
        btn.style.borderTop = '1px solid #f1f5f9';
        btn.addEventListener('mouseover', function(){ this.style.background='#f8fafc'; });
        btn.addEventListener('mouseout', function(){ this.style.background='white'; });

        const name = it.address?.city || it.address?.town || it.address?.village || it.name || it.display_name;
        const label = name || it.display_name || '';
        btn.textContent = label;
        btn.addEventListener('click', function(){
          elements.locationInput.value = label;
          // Centra mappa usando le coordinate del suggerimento, ma la ricerca rimane per città (parametro city)
          var lat = parseFloat(it.lat), lon = parseFloat(it.lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            state.userLocation = { lat: lat, lng: lon };
            try { if (elements.map) { elements.map.setView([lat, lon], 12); } } catch(_e){}
          } else {
            state.userLocation = null;
          }
          // Salva scelta
          try {
            const saved = JSON.parse(localStorage.getItem('bo_last_search')||'{}');
            saved.location = label; saved.userLocation = state.userLocation; localStorage.setItem('bo_last_search', JSON.stringify(saved));
          } catch(_){ }
          list.style.display='none';
          handleSearch();
        });
        list.appendChild(btn);
      });
      list.style.display = 'block';
    };

    const fetchSuggestions = debounce(async function(){
      try {
        const q = elements.locationInput.value.trim();
        if (!q || q === 'La mia posizione' || q.length < 2) { list.style.display='none'; list.innerHTML=''; return; }
        const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&q=' + encodeURIComponent(q);
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        updateList(Array.isArray(data) ? data : []);
      } catch(_) {
        list.style.display='none';
      }
    }, 250);

    elements.locationInput.addEventListener('input', fetchSuggestions);
    document.addEventListener('click', function(e){
      if (!list.contains(e.target) && e.target !== elements.locationInput) { list.style.display='none'; }
    });
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

    // Se l'utente ha digitato qualcosa nel campo location, resetta la geolocalizzazione
    if (location && location !== 'La mia posizione') {
      console.log('User typed city name, clearing geolocation:', location);
      state.userLocation = null;
      // Rimuovi anche il flag di geolocalizzazione dai filtri correnti
      if (state.currentFilters.location === 'La mia posizione') {
        console.log('Clearing previous geolocation filter');
      }
    }

    state.currentFilters = { location, fuel, radius };
    state.pagination.currentPage = 1; // Reset alla prima pagina

    // Persisti l'ultima ricerca per poterla ripristinare con "Torna ai risultati"
    try {
      const payload = {
        location: state.currentFilters.location,
        fuel: state.currentFilters.fuel,
        radius: state.currentFilters.radius,
        userLocation: state.userLocation // {lat,lng} oppure null
      };
      localStorage.setItem('bo_last_search', JSON.stringify(payload));
    } catch(_) {}

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

      // Priorità: se l'utente ha inserito un nome di città diverso da "La mia posizione", usa la ricerca per città
      if (state.currentFilters.location && state.currentFilters.location !== 'La mia posizione') {
        params.append('city', state.currentFilters.location);
        console.log('Ricerca per città:', state.currentFilters.location);
      } else if (state.userLocation && (state.currentFilters.location === 'La mia posizione' || !state.currentFilters.location)) {
        // Solo se l'utente ha usato la geolocalizzazione e non ha digitato una città specifica
        params.append('lat', state.userLocation.lat);
        params.append('lon', state.userLocation.lng);
        params.append('radiusKm', state.currentFilters.radius);
        console.log('Ricerca con coordinate:', state.userLocation, 'raggio:', state.currentFilters.radius);
      }

      if (state.currentFilters.fuel) {
        params.append('fuel', state.currentFilters.fuel);
      }

      // Controlla se la cache è disabilitata nelle impostazioni del plugin
      if (window.BenzinaOggi && window.BenzinaOggi.disableApiCache) {
        params.append('nocache', '1');
        console.log('Cache API disabilitata nelle impostazioni');
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
      const latNum = distributor.latitudine != null ? parseFloat(distributor.latitudine) : NaN;
      const lonNum = distributor.longitudine != null ? parseFloat(distributor.longitudine) : NaN;
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        const marker = L.marker([latNum, lonNum])
          .addTo(elements.map);
        
        const prices = (distributor.prices || [])
          .map(p => `${p.fuelType}: €${p.price.toFixed(3)}${p.isSelfService ? ' (Self)' : ''}`)
          .join('<br>');
        const bandiera = (distributor.bandiera || 'Distributore');
        const comune = (distributor.comune || '').toString();
        const slug = `${bandiera}-${comune}-${distributor.impiantoId}`
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        const pageUrl = `/distributore/${slug}`;
        
        marker.bindPopup(`
          <div style="min-width:220px">
            <strong>${bandiera}</strong><br>
            ${distributor.indirizzo || ''}${comune ? ', ' + comune : ''}<br>
            ${prices ? ('<div style=\"margin-top:6px\">' + prices + '</div>') : ''}
            <div style="margin-top:8px">
              <a href="${pageUrl}" style="display:inline-block;background:#2c5aa0;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none">Vai al distributore</a>
            </div>
          </div>
        `);
        
        elements.markers.push(marker);
        bounds.extend([latNum, lonNum]);
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
    // Prova a ripristinare l'ultima ricerca (se arriviamo da "Torna ai risultati")
    try {
      const raw = localStorage.getItem('bo_last_search');
      if (raw) {
        const last = JSON.parse(raw);
        if (last && typeof last === 'object') {
          if (elements.locationInput && typeof last.location === 'string') {
            elements.locationInput.value = last.location;
          }
          if (elements.fuelSelect && typeof last.fuel === 'string') {
            elements.fuelSelect.value = last.fuel;
          }
          if (elements.radiusSelect && (typeof last.radius === 'number' || typeof last.radius === 'string')) {
            elements.radiusSelect.value = String(last.radius || 10);
          }
          state.userLocation = last.userLocation && typeof last.userLocation === 'object' ? last.userLocation : null;
          state.currentFilters = {
            location: elements.locationInput?.value.trim() || '',
            fuel: elements.fuelSelect?.value || '',
            radius: parseInt(elements.radiusSelect?.value) || 10
          };
          // Avvia subito la ricerca ripristinata
          searchDistributors();
          return;
        }
      }
    } catch(_) {}

    // Fallback: mostra messaggio e proponi geolocalizzazione
    console.log('Applicazione caricata. Clicca il pulsante di geolocalizzazione per trovare distributori vicini.');
    if (elements.resultsList) {
      elements.resultsList.innerHTML = `
        <div class="bo-welcome-message">
          <h3>Benvenuto in BenzinaOggi!</h3>
          <p>Clicca il pulsante <strong>📍</strong> accanto al campo "Dove" per trovare i distributori più vicini a te.</p>
          <p>Oppure inserisci manualmente una città o indirizzo.</p>
        </div>
      `;
      try { const wrap = document.querySelector('.benzinaoggi-wrap'); if (wrap) { wrap.style.paddingBottom = '48px'; } } catch(_) {}
    }
    setTimeout(requestLocationAndSearch, 1000);
  }

  // Richiesta automatica della geolocalizzazione
  function requestLocationAndSearch() {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported by this browser');
      return;
    }
    
    // Check if user previously denied location
    try {
      var locationDenied = localStorage.getItem('bo_location_denied');
      if (locationDenied === 'true') {
        console.log('User previously denied location access');
        return;
      }
    } catch(e) {
      // localStorage not available, continue
    }
    
    // Show location request message with skip option
    var locationMsg = document.createElement('div');
    locationMsg.className = 'bo-location-request';
    locationMsg.innerHTML = '<div class="bo-location-content">' +
      '<div class="bo-location-icon">📍</div>' +
      '<div class="bo-location-text">Richiesta posizione...</div>' +
      '<div class="bo-location-subtext">Trovare i distributori più vicini a te</div>' +
      '<button class="bo-location-skip" onclick="this.parentNode.parentNode.parentNode.style.display=\'none\'">Salta</button>' +
      '</div>';
    locationMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff;
      border: 2px solid #0ea5e9;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 280px;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add CSS animation
    if (!document.querySelector('#bo-location-styles')) {
      var style = document.createElement('style');
      style.id = 'bo-location-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .bo-location-content {
          text-align: center;
        }
        .bo-location-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .bo-location-text {
          font-weight: 600;
          color: #0ea5e9;
          margin-bottom: 4px;
        }
        .bo-location-subtext {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }
        .bo-location-skip {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 4px 12px;
          font-size: 11px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bo-location-skip:hover {
          background: #e5e7eb;
          color: #374151;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(locationMsg);
    
    navigator.geolocation.getCurrentPosition(function(pos){
      // Success: got location
      state.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      
      // Update message to success
      locationMsg.querySelector('.bo-location-icon').textContent = '✅';
      locationMsg.querySelector('.bo-location-text').textContent = 'Posizione trovata!';
      locationMsg.querySelector('.bo-location-subtext').textContent = 'Caricamento distributori vicini...';
      
      // Center map on user location
      if (elements.map) {
        elements.map.setView([state.userLocation.lat, state.userLocation.lng], 13);
      }
      
      // Update search filters
      state.currentFilters.location = `${state.userLocation.lat},${state.userLocation.lng}`;
      if (elements.locationInput) {
        elements.locationInput.value = 'La mia posizione';
      }
      
      // Start search automatically
      handleSearch();
      
      // Remove message after 2 seconds
      setTimeout(function() {
        if (locationMsg.parentNode) {
          locationMsg.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(function() {
            if (locationMsg.parentNode) locationMsg.parentNode.removeChild(locationMsg);
          }, 300);
        }
      }, 2000);
      
    }, function(error){
      // Error: couldn't get location
      console.log('Geolocation error:', error);
      
      // Save denial to localStorage if user explicitly denied
      if (error.code === error.PERMISSION_DENIED) {
        try {
          localStorage.setItem('bo_location_denied', 'true');
        } catch(e) {
          // localStorage not available
        }
      }
      
      locationMsg.querySelector('.bo-location-icon').textContent = '❌';
      locationMsg.querySelector('.bo-location-text').textContent = 'Posizione non disponibile';
      locationMsg.querySelector('.bo-location-subtext').textContent = 'Usa i filtri per cercare manualmente';
      locationMsg.style.borderColor = '#ef4444';
      
      // Remove message after 3 seconds
      setTimeout(function() {
        if (locationMsg.parentNode) {
          locationMsg.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(function() {
            if (locationMsg.parentNode) locationMsg.parentNode.removeChild(locationMsg);
          }, 300);
        }
      }, 3000);
      
    }, { 
      enableHighAccuracy: true, 
      timeout: 10000,
      maximumAge: 300000 // 5 minutes cache
    });
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
        }
        .bo-location-content {
          text-align: center;
        }
        .bo-location-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .bo-location-text {
          font-weight: 600;
          color: #0ea5e9;
          margin-bottom: 4px;
        }
        .bo-location-subtext {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }
        .bo-location-skip {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 4px 12px;
          font-size: 11px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bo-location-skip:hover {
          background: #e5e7eb;
          color: #374151;
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(locationMsg);
    
    navigator.geolocation.getCurrentPosition(function(pos){
      // Success: got location
      state.userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      
      // Update message to success
      locationMsg.querySelector('.bo-location-icon').textContent = '✅';
      locationMsg.querySelector('.bo-location-text').textContent = 'Posizione trovata!';
      locationMsg.querySelector('.bo-location-subtext').textContent = 'Caricamento distributori vicini...';
      
      // Center map on user location
      if (elements.map) {
        elements.map.setView([state.userLocation.lat, state.userLocation.lng], 13);
      }
      
      // Update search filters
      state.currentFilters.location = `${state.userLocation.lat},${state.userLocation.lng}`;
      if (elements.locationInput) {
        elements.locationInput.value = 'La mia posizione';
      }
      
      // Start search automatically
      handleSearch();
      
      // Remove message after 2 seconds
      setTimeout(function() {
        if (locationMsg.parentNode) {
          locationMsg.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(function() {
            if (locationMsg.parentNode) locationMsg.parentNode.removeChild(locationMsg);
          }, 300);
        }
      }, 2000);
      
    }, function(error){
      // Error: couldn't get location
      console.log('Geolocation error:', error);
      
      // Save denial to localStorage if user explicitly denied
      if (error.code === error.PERMISSION_DENIED) {
        try {
          localStorage.setItem('bo_location_denied', 'true');
        } catch(e) {
          // localStorage not available
        }
      }
      
      locationMsg.querySelector('.bo-location-icon').textContent = '❌';
      locationMsg.querySelector('.bo-location-text').textContent = 'Posizione non disponibile';
      locationMsg.querySelector('.bo-location-subtext').textContent = 'Usa i filtri per cercare manualmente';
      locationMsg.style.borderColor = '#ef4444';
      
      // Remove message after 3 seconds
      setTimeout(function() {
        if (locationMsg.parentNode) {
          locationMsg.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(function() {
            if (locationMsg.parentNode) locationMsg.parentNode.removeChild(locationMsg);
          }, 300);
        }
      }, 3000);
      
    }, { 
      enableHighAccuracy: true, 
      timeout: 10000,
      maximumAge: 300000 // 5 minutes cache
    });
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

