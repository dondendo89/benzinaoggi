(function(){
  function qs(id){ return document.getElementById(id); }
  function createEl(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function render(){
    var mapEl = qs('bo_map'); if(!mapEl) return;
    var map = L.map('bo_map').setView([41.8719, 12.5674], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var markers = [];
    function clearMarkers(){ markers.forEach(function(m){ map.removeLayer(m); }); markers = []; }

    function slugify(text){
      return String(text||'').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g,'')
        .replace(/\s+/g,'-')
        .replace(/-+/g,'-');
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

    function fetchData(){
      var api = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
      if(!api){ return; }
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
        data.distributors.forEach(function(d){
          if(d.latitudine && d.longitudine){
            var m = L.marker([d.latitudine, d.longitudine]).addTo(map);
            markers.push(m);
            var prices = (d.prices || []).map(function(p){ return p.fuelType + ': ' + p.price.toFixed(3); }).join('<br/>');
            m.bindPopup('<strong>' + (d.bandiera || '') + '</strong><br/>' + (d.indirizzo || '') + '<br/>' + prices);
            m.on('click', function(){ openDetail(api, d); });
          }
          var li = createEl('li');
          var pricesText = (d.prices || []).map(function(p){ return p.fuelType + ' ' + p.price.toFixed(3); }).join(' · ');
          li.innerHTML = '<button data-impianto="'+d.impiantoId+'" class="bo_item"><strong>' + (d.bandiera || '') + '</strong> — ' + (d.comune || '') + ' — ' + pricesText + '</button>';
          if(list) list.appendChild(li);
        });
        // bind click for details
        list && list.querySelectorAll('button.bo_item').forEach(function(btn){
          btn.addEventListener('click', function(){
            var imp = this.getAttribute('data-impianto'); if(!imp) return;
            var d = data.distributors.find(function(x){ return String(x.impiantoId) === String(imp); }) || { impiantoId: imp };
            openDetail(api, d);
          });
        });
      }).catch(function(err){ console.error(err); });
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
      panel.innerHTML = '<h3>Distributore '+(d.impiantoId||'')+'</h3>'+
        '<div>'+(d.bandiera||'')+' — '+(d.indirizzo||'')+', '+(d.comune||'')+'</div>'+
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

    // OneSignal web SDK bootstrap (optional)
    if(window.BenzinaOggi && BenzinaOggi.onesignalAppId){
      window.OneSignal = window.OneSignal || [];
      OneSignal.push(function() { OneSignal.init({ appId: BenzinaOggi.onesignalAppId }); });
      var btn = createEl('button'); btn.textContent = 'Attiva notifiche price-change';
      btn.onclick = function(){ OneSignal.push(function(){ OneSignal.registerForPushNotifications(); }); };
      var sub = qs('bo_subscribe'); if(sub){ sub.appendChild(btn); }
    }
  }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
    // Geolocate button
    document.addEventListener('click', function(e){
      if(e.target && e.target.id === 'bo_geo'){ e.preventDefault();
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(pos){
            window._bo_lat = pos.coords.latitude; window._bo_lon = pos.coords.longitude;
            fetchData();
          });
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


