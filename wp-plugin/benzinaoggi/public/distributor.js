(function(){
  function qs(sel, el){ return (el||document).querySelector(sel); }
  function qsa(sel, el){ return Array.prototype.slice.call((el||document).querySelectorAll(sel)); }
  function createEl(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function fmt(n){ return (typeof n==='number' ? n.toFixed(3) : n); }
  function mapsUrl(lat, lon){ return 'https://www.google.com/maps?q='+encodeURIComponent(lat+','+lon); }

  function render(data){
    var wrap = qs('#bo_distributor_detail'); if(!wrap) return;
    if(!data || !data.ok){ wrap.textContent = 'Errore nel caricamento.'; return; }
    var d = data.distributor || {};
    var header = createEl('div', 'bo-h');
    header.innerHTML = '<h2>'+(d.bandiera||'Distributore')+' – '+(d.comune||'')+'</h2>'+
      '<div class="bo-grid">'
      +'<div><div class="bo-label">Indirizzo</div><div class="bo-value">'+(d.indirizzo||'')+'</div></div>'
      +'<div><div class="bo-label">Provincia</div><div class="bo-value">'+(d.provincia||'')+'</div></div>'
      +'<div><div class="bo-label">Gestore</div><div class="bo-value">'+(d.gestore||'')+'</div></div>'
      +'<div><div class="bo-label">Impianto ID</div><div class="bo-value">'+(d.impiantoId||'')+'</div></div>'
      +'</div>';

    var actions = createEl('div','bo-actions');
    if(d.latitudine && d.longitudine){
      var a = createEl('a'); a.href = mapsUrl(d.latitudine, d.longitudine); a.target='_blank'; a.rel='noopener'; a.textContent='Apri in Google Maps'; actions.appendChild(a);
    }

    var pricesCard = createEl('div','bo-card');
    pricesCard.innerHTML = '<h3>Prezzi</h3>';
    var table = createEl('table','bo-table');
    table.innerHTML = '<thead><tr><th>Carburante</th><th>Prezzo</th><th>Servizio</th><th>Notifica</th></tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');
    (data.prices||[]).forEach(function(p){
      var tr = createEl('tr');
      var id='notif_'+p.fuelType.replace(/[^a-z0-9]/gi,'_');
      tr.innerHTML = '<td><span class="bo-badge">'+p.fuelType+'</span></td>'+
        '<td>'+fmt(p.price)+'</td>'+
        '<td>'+(p.isSelfService ? 'Self' : 'Servito')+'</td>'+
        '<td><label><input type="checkbox" id="'+id+'" data-fuel="'+p.fuelType+'"/> quando scende</label></td>';
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(header);
    wrap.appendChild(actions);
    wrap.appendChild(pricesCard);
    pricesCard.appendChild(table);

    if(window.BenzinaOggi && BenzinaOggi.onesignalAppId){
      var OneSignal = window.OneSignal = window.OneSignal || [];
      OneSignal.push(function(){ OneSignal.init({ appId: BenzinaOggi.onesignalAppId }); });
      qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var tagKey = 'price_drop_'+fuel;
          if(this.checked){ OneSignal.push(function(){ OneSignal.sendTag(tagKey, '1'); }); }
          else { OneSignal.push(function(){ OneSignal.deleteTag(tagKey); }); }
        });
      });
    }
  }

  function load(){
    var root = qs('.bo-distributor'); if(!root) return;
    var imp = root.getAttribute('data-impianto');
    var base = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
    if(!imp || !base){ qs('#bo_distributor_detail').textContent='Configurazione mancante.'; return; }
    fetch(base + '/api/distributor/' + encodeURIComponent(imp)).then(function(r){ return r.json(); }).then(render).catch(function(){
      qs('#bo_distributor_detail').textContent='Errore nel caricamento.';
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', load); else load();
})();


