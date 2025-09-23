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

    function fetchData(){
      var api = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
      if(!api){ return; }
      var city = (qs('bo_city') && qs('bo_city').value) || '';
      var fuel = (qs('bo_fuel') && qs('bo_fuel').value) || '';
      var url = api + '/api/distributors?limit=300' + (city ? ('&city=' + encodeURIComponent(city)) : '') + (fuel ? ('&fuel=' + encodeURIComponent(fuel)) : '');
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
          }
          var li = createEl('li');
          var pricesText = (d.prices || []).map(function(p){ return p.fuelType + ' ' + p.price.toFixed(3); }).join(' · ');
          li.innerHTML = '<strong>' + (d.bandiera || '') + '</strong> — ' + (d.comune || '') + ' — ' + pricesText;
          if(list) list.appendChild(li);
        });
      }).catch(function(err){ console.error(err); });
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
})();


