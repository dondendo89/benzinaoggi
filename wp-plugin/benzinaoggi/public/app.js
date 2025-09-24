(function(){
  function qs(id){ return document.getElementById(id); }
  function createEl(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function render(){
    var mapEl = qs('bo_map'); if(!mapEl) return;
    // Wrap container for loader overlay
    var wrap = document.querySelector('.benzinaoggi-wrap');
    if(wrap && !wrap.classList.contains('bo-loader')){ wrap.classList.add('bo-loader'); }

    var map = L.map('bo_map').setView([41.8719, 12.5674], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var markers = [];
    var userMarker = null;
    function clearMarkers(){ markers.forEach(function(m){ map.removeLayer(m); }); markers = []; }

    function slugify(text){
      return String(text||'').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g,'')
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-');
    }

    function buildPageUrl(d){
      var title = ((d.bandiera||'Distributore') + ' ' + (d.comune||'')).trim();
      var slug = slugify(title + '-' + (d.impiantoId||''));
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

    function fetchData(){
      var api = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
      if(!api){ return; }
      setLoading(true);
      var city = (qs('bo_city') && qs('bo_city').value) || '';
      var fuel = (qs('bo_fuel') && qs('bo_fuel').value) || '';
      var brand = (qs('bo_brand') && qs('bo_brand').value) || '';
      var sort = (qs('bo_sort') && qs('bo_sort').value) || '';
      var lat = window._bo_lat, lon = window._bo_lon;
      var url = api + '/api/distributors?limit=300'
        + (city ? ('&city=' + encodeURIComponent(city)) : '')
        + (fuel ? ('&fuel=' + encodeURIComponent(fuel)) : '')
        + (brand ? ('&brand=' + encodeURIComponent(brand)) : '')
        + (sort ? ('&sort=' + encodeURIComponent(sort)) : '')
        + ((lat!=null && lon!=null) ? ('&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon)) : '');
      fetch(url).then(function(r){ return r.json(); }).then(function(data){
        clearMarkers();
        if(!data || !data.distributors){ return; }
        var list = qs('bo_list'); if(list) list.innerHTML = '';
        var bounds = L.latLngBounds([]);
        data.distributors.forEach(function(d){
          if(d.latitudine && d.longitudine){
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
        if (window._bo_lat != null && window._bo_lon != null) {
          bounds.extend([window._bo_lat, window._bo_lon]);
        }
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
    fetchData();

    // OneSignal: add a single unified subscribe button in plugin UI
    (function addNotifyButton(){
      // remove any pre-existing custom buttons
      var old = document.getElementById('bo_notify_btn'); if(old && old.parentNode) old.parentNode.removeChild(old);
      if(!(window.BenzinaOggi && BenzinaOggi.onesignalAppId)) return;
      // ensure OneSignal array exists; actual SDK inclusion is handled by WP/plugin
      window.OneSignal = window.OneSignal || [];
      var container = document.getElementById('bo_subscribe') || document.querySelector('.benzinaoggi-wrap');
      if(!container) return;
      var btn = createEl('button');
      btn.id = 'bo_notify_btn';
      btn.className = 'bo-notify-btn';
      btn.type = 'button';
      btn.textContent = '🔔 Attiva notifiche';
      btn.addEventListener('click', function(){
        try {
          OneSignal.push(function(){
            // Prefer native prompt; fallback to registerForPushNotifications
            if (OneSignal.showNativePrompt) {
              OneSignal.showNativePrompt();
            } else if (OneSignal.registerForPushNotifications) {
              OneSignal.registerForPushNotifications();
            }
          });
        } catch(e){ console.warn('OneSignal prompt error', e); }
      });
      container.appendChild(btn);
    })();
  }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
    // Geolocate button
    document.addEventListener('click', function(e){
      if(e.target && e.target.id === 'bo_geo'){ e.preventDefault();
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(pos){
            window._bo_lat = pos.coords.latitude; window._bo_lon = pos.coords.longitude;
            // show user position and center map immediately
            if (userMarker) { try { map.removeLayer(userMarker); } catch (e){} }
            userMarker = L.circle([window._bo_lat, window._bo_lon], { radius: 200, color: '#0ea5e9' }).addTo(map);
            map.setView([window._bo_lat, window._bo_lon], 12);
            fetchData();
          }, function(){ fetchData(); }, { enableHighAccuracy: true, timeout: 8000 });
        }
      }
    });

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


