(function(){
  function qs(id){ return document.getElementById(id); }
  function createEl(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function render(){
    var mapEl = qs('bo_map'); if(!mapEl) return;
    
    // Controlla se la mappa è già stata inizializzata
    if (mapEl._leaflet_id) {
      console.log('Mappa già inizializzata in app.js, skip');
      return;
    }
    
    // Wrap container for loader overlay
    var wrap = document.querySelector('.benzinaoggi-wrap');
    if(wrap && !wrap.classList.contains('bo-loader')){ wrap.classList.add('bo-loader'); }

    // Prefer device location first on mobile for better UX
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    var startCenter = [41.8719, 12.5674], startZoom = 6;
    
    try {
      var map = L.map('bo_map', { zoomControl: !isMobile }).setView(startCenter, startZoom);
    } catch (error) {
      console.warn('Errore nell\'inizializzazione della mappa in app.js:', error);
      return;
    }
    if (isMobile) { L.control.zoom({ position: 'bottomright' }).addTo(map); }
    // expose for any legacy handlers
    try { window.__bo_map = map; } catch(_){}
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var markers = [];
    var userMarker = null;
    var drawnLayer = null; // current circle/polygon selection
    function clearMarkers(){ markers.forEach(function(m){ map.removeLayer(m); }); markers = []; }

    function slugify(text){
      return String(text||'').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g,'')
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-');
    }

    function buildPageUrl(d){
      var bandiera = (d.bandiera || 'Distributore');
      var comune = (d.comune || '');
      var slug = slugify(bandiera + '-' + comune + '-' + (d.impiantoId||''));
      return (window.location.origin || '') + '/' + slug + '/';
    }

    function openDetail(api, d){
      fetch(api + '/api/distributor/' + d.impiantoId).then(function(r){ return r.json(); }).then(function(det){
        if(!det || !det.ok) return;
        renderDetail(det);
        var slug = slugify((d.bandiera||d.gestore||'distributore') + '-' + (d.comune||''));
        if(history && history.pushState){
          var url = location.pathname + '?impiantoId=' + encodeURIComponent(String(d.impiantoId)) + '&distributore=' + encodeURIComponent(slug);
          history.pushState({ impiantoId: d.impiantoId, slug: slug }, '', url);
        }
      });
    }

    function setLoading(active){
      var w = document.querySelector('.benzinaoggi-wrap');
      if(!w) return;
      if(active){
        w.classList.add('active');
        // simple spinner element if not present
        if(!w.querySelector('.bo-spinner')){
          var sp = createEl('div','bo-spinner'); sp.setAttribute('aria-label','Loading');
          // place spinner near map/list area
          var list = qs('bo_list');
          if(list && list.parentNode){ list.parentNode.insertBefore(sp, list); }
          else { w.appendChild(sp); }
        }
      } else {
        w.classList.remove('active');
        var spn = w.querySelector('.bo-spinner'); if(spn && spn.parentNode) spn.parentNode.removeChild(spn);
      }
    }

    function pointInPolygon(pt, poly){
      // ray-casting algorithm for polygons
      var x = pt[1], y = pt[0];
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i][1], yi = poly[i][0];
        var xj = poly[j][1], yj = poly[j][0];
        var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function fetchData(){
      var api = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
      if(!api){ return; }
      setLoading(true);
      var city = (qs('bo_city') && qs('bo_city').value) || '';
      var fuel = (qs('bo_fuel') && qs('bo_fuel').value) || '';
      var brand = (qs('bo_brand') && qs('bo_brand').value) || '';
      var sort = (qs('bo_sort') && qs('bo_sort').value) || '';
      var lat = window._bo_lat, lon = window._bo_lon;
      var rad = (function(){ var r=qs('bo_radius_km'); return r? parseFloat(r.value)||undefined : undefined; })();
      var url = api + '/api/distributors?limit=1000'
        + (city ? ('&city=' + encodeURIComponent(city)) : '')
        + (fuel ? ('&fuel=' + encodeURIComponent(fuel)) : '')
        + (brand ? ('&brand=' + encodeURIComponent(brand)) : '')
        + (sort ? ('&sort=' + encodeURIComponent(sort)) : '')
        + ((lat!=null && lon!=null) ? ('&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon)) : '')
        + ((lat!=null && lon!=null && rad!=null) ? ('&radiusKm=' + encodeURIComponent(rad)) : '');
      fetch(url).then(function(r){ return r.json(); }).then(function(data){
        clearMarkers();
        if(!data || !data.distributors){ return; }
        var list = qs('bo_list'); if(list) list.innerHTML = '';
        var bounds = L.latLngBounds([]);
        // optional spatial filtering by drawn shape
        var useCircle = drawnLayer && drawnLayer instanceof L.Circle;
        var usePolygon = drawnLayer && drawnLayer instanceof L.Polygon && !(drawnLayer instanceof L.Circle);
        var center = useCircle ? drawnLayer.getLatLng() : null;
        var radius = useCircle ? drawnLayer.getRadius() : null; // meters
        var polygonLatLngs = usePolygon ? drawnLayer.getLatLngs()[0] || [] : [];

        data.distributors.forEach(function(d){
          if(d.latitudine && d.longitudine){
            // spatial filter
            if (useCircle) {
              var dist = map.distance([d.latitudine, d.longitudine], center);
              if (dist > radius) { return; }
            } else if (usePolygon) {
              var poly = polygonLatLngs.map(function(ll){ return [ll.lat, ll.lng]; });
              if (!pointInPolygon([d.latitudine, d.longitudine], poly)) { return; }
            }
            var m = L.marker([d.latitudine, d.longitudine]).addTo(map);
            markers.push(m);
            var prices = (d.prices || []).map(function(p){ return p.fuelType + ': ' + p.price.toFixed(3); }).join('<br/>');
            m.bindPopup('<strong>' + (d.bandiera || '') + '</strong><br/>' + (d.indirizzo || '') + '<br/>' + prices);
            m.on('click', function(){
              var url = buildPageUrl(d);
              window.location.href = url;
            });
            bounds.extend([d.latitudine, d.longitudine]);
          }
          var li = createEl('li');
          var pricesText = (d.prices || []).map(function(p){ return p.fuelType + ' ' + p.price.toFixed(3); }).join(' · ');
          li.innerHTML = '<button data-impianto="'+d.impiantoId+'" class="bo_item"><strong>' + (d.bandiera || '') + '</strong> — ' + (d.comune || '') + ' — ' + pricesText + '</button>';
          if(list) list.appendChild(li);
        });
        // Fit map to markers (and user position if set)
        if (useCircle && center) { bounds.extend(center); }
        else if (window._bo_lat != null && window._bo_lon != null) { bounds.extend([window._bo_lat, window._bo_lon]); }
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.2));
        }
        // bind click for details
        list && list.querySelectorAll('button.bo_item').forEach(function(btn){
          btn.addEventListener('click', function(){
            var imp = this.getAttribute('data-impianto'); if(!imp) return;
            var d = data.distributors.find(function(x){ return String(x.impiantoId) === String(imp); }) || { impiantoId: imp };
            var url = buildPageUrl(d);
            window.location.href = url;
          });
        });
      }).catch(function(err){ console.error(err); })
      .finally(function(){ setLoading(false); });
    }

    function renderDetail(data){
      var wrap = document.querySelector('.benzinaoggi-wrap'); if(!wrap) return;
      var panel = document.getElementById('bo_detail');
      if(!panel){ panel = createEl('div'); panel.id = 'bo_detail'; panel.className = 'bo-detail'; wrap.appendChild(panel); }
      var d = data.distributor || {};
      var prices = (data.prices || []).map(function(p){
        var id = 'fuel_'+p.fuelType.replace(/[^a-z0-9]/gi,'_');
        return '<li>'+p.fuelType+': <strong>'+p.price.toFixed(3)+'</strong> '+(p.isSelfService?'(Self)':'')+
          ' <label style="margin-left:8px"><input type="checkbox" data-fuel="'+p.fuelType+'" id="'+id+'"/> Notifiche</label></li>';
      }).join('');
      var pageUrl = (function(){
        var title = ((d.bandiera||'Distributore') + ' ' + (d.comune||'')).trim();
        var slug = slugify(title + '-' + (d.impiantoId||''));
        return (window.location.origin || '') + '/' + slug + '/';
      })();
      panel.innerHTML = '<h3>Distributore '+(d.impiantoId||'')+'</h3>'+
        '<div>'+(d.bandiera||'')+' — '+(d.indirizzo||'')+', '+(d.comune||'')+'</div>'+
        '<div style="margin:8px 0"><a href="'+pageUrl+'" target="_blank" rel="noopener">Apri pagina dettaglio</a></div>'+
        '<ul>'+prices+'</ul>';

      // OneSignal per-fuel opt-in via tags
      if(window.BenzinaOggi && BenzinaOggi.onesignalAppId && window.OneSignal){
        panel.querySelectorAll('input[type=checkbox][data-fuel]').forEach(function(cb){
          cb.addEventListener('change', function(){
            var fuel = this.getAttribute('data-fuel');
            var tagKey = 'fuel_'+fuel;
            window.OneSignal = window.OneSignal || [];
            if(this.checked){
              OneSignal.push(function(){ OneSignal.sendTag(tagKey, '1'); });
            } else {
              OneSignal.push(function(){ OneSignal.deleteTag(tagKey); });
            }
          });
        });
      }
    }

    qs('bo_search') && qs('bo_search').addEventListener('click', function(){ fetchData(); });
    // Toggle filters visibility (mobile)
    var toggleBtn = document.getElementById('bo_filters_toggle');
    if (toggleBtn) {
      var visible = true;
      toggleBtn.addEventListener('click', function(){
        var filters = document.querySelector('.benzinaoggi-wrap .filters');
        if (!filters) return;
        visible = !visible;
        filters.style.display = visible ? 'flex' : 'none';
        toggleBtn.textContent = visible ? 'Nascondi filtri' : 'Mostra filtri';
      });
    }
    // Auto-center by geolocation on first load for mobile
    if (isMobile && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos){
        window._bo_lat = pos.coords.latitude; window._bo_lon = pos.coords.longitude;
        var km = parseFloat((radiusInput && radiusInput.value) || '9.5') || 9.5;
        if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch(_){} }
        drawnLayer = L.circle([window._bo_lat, window._bo_lon], { radius: km * 1000, color: '#0ea5e9' }).addTo(map);
        map.setView([window._bo_lat, window._bo_lon], 13);
        fetchData();
      }, function(){}, { enableHighAccuracy: true, timeout: 7000 });
    }
    // radius slider label
    var radiusInput = qs('bo_radius_km');
    var radiusLabel = qs('bo_radius_km_label');
    if (radiusInput && radiusLabel) {
      var updateRadius = function(){
        radiusLabel.textContent = String(radiusInput.value);
        if(drawnLayer && drawnLayer instanceof L.Circle){
          drawnLayer.setRadius(parseFloat(radiusInput.value) * 1000);
          fetchData();
        }
      };
      radiusInput.addEventListener('input', updateRadius);
    }

    // Leaflet Draw controls: circle/polygon
    var drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
        circle: { shapeOptions: { color: '#0ea5e9' } },
        polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#0ea5e9' } }
      },
      edit: false
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (e) {
      if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch(_){} }
      drawnLayer = e.layer;
      map.addLayer(drawnLayer);
      if (drawnLayer instanceof L.Circle && radiusInput) {
        var rkm = parseFloat(radiusInput.value) || 9.5;
        drawnLayer.setRadius(rkm * 1000);
      }
      fetchData();
    });

    // Geocoder search box bound to bo_city input
    if (L.Control && L.Control.Geocoder) {
      var geocoder = L.Control.geocoder({ defaultMarkGeocode: false }).addTo(map);
      var input = qs('bo_city');
      if (input) {
        input.addEventListener('keydown', function(ev){ if(ev.key === 'Enter'){ ev.preventDefault(); geocodeNow(); }});
      }
      function geocodeNow(){
        var q = (input && input.value) || '';
        if (!q) return;
        L.Control.Geocoder.nominatim().geocode(q, function(results){
          if(results && results[0]){
            var b = results[0].bbox; var c = results[0].center;
            map.fitBounds([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]);
            if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch(_){} }
            var km = parseFloat((radiusInput && radiusInput.value) || '9.5') || 9.5;
            drawnLayer = L.circle([c.lat, c.lng], { radius: km * 1000, color: '#0ea5e9' }).addTo(map);
            fetchData();
          }
        });
      }
    }

    // Geolocate button inside render, bind circle with current radius
    var geoBtn = qs('bo_geo');
    if (geoBtn) {
      geoBtn.addEventListener('click', function(e){
        e.preventDefault();
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(pos){
            window._bo_lat = pos.coords.latitude; window._bo_lon = pos.coords.longitude;
            // replace selection with a circle at user position
            if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch(_){} }
            var km = parseFloat((radiusInput && radiusInput.value) || '9.5') || 9.5;
            drawnLayer = L.circle([window._bo_lat, window._bo_lon], { radius: km * 1000, color: '#0ea5e9' }).addTo(map);
            map.setView([window._bo_lat, window._bo_lon], 13);
            fetchData();
          }, function(){ fetchData(); }, { enableHighAccuracy: true, timeout: 8000 });
        }
      });
    }
    fetchData();

    // OneSignal: add a single unified subscribe button in plugin UI (use global v16 init from PHP)
    // Removed home notify button to avoid prompting on homepage
  }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();

    // Deep-link handling: load detail if query contains impiantoId
    try {
      var params = new URLSearchParams(location.search);
      var impQ = params.get('impiantoId');
      if(impQ && window.BenzinaOggi && BenzinaOggi.apiBase){
        fetch(BenzinaOggi.apiBase + '/api/distributor/' + encodeURIComponent(impQ)).then(function(r){ return r.json(); }).then(function(det){
          if(det && det.ok) renderDetail(det);
        });
      }
    } catch(e) {}
})();

