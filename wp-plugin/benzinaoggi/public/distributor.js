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
    pricesCard.innerHTML = '<h3>Prezzi</h3><p style="font-size: 0.9em; color: #666; margin-bottom: 1em;">💡 <strong>Notifiche:</strong> Abilita le notifiche del browser per ricevere avvisi quando i prezzi scendono. Clicca su "quando scende" per ogni carburante.</p>';
    var table = createEl('table','bo-table');
    table.innerHTML = '<thead><tr><th>Carburante</th><th>Prezzo</th><th>Servizio</th><th>Notifica</th></tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');
    (data.prices||[]).forEach(function(p){
      var tr = createEl('tr');
      var id='notif_'+p.fuelType.replace(/[^a-z0-9]/gi,'_');
      tr.innerHTML = '<td><span class="bo-badge">'+p.fuelType+'</span></td>'+
        '<td>'+fmt(p.price)+'</td>'+
        '<td>'+(p.isSelfService ? 'Self' : 'Servito')+'</td>'+
        '<td><label><input type="checkbox" id="'+id+'" data-fuel="'+p.fuelType+'"/> <span class="notif-label">quando scende</span> <span class="notif-status" style="display:none; color: #28a745; font-size: 0.9em;">✓ Attivato</span></label></td>';
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(header);
    wrap.appendChild(actions);
    wrap.appendChild(pricesCard);
    pricesCard.appendChild(table);

    if(window.BenzinaOggi && BenzinaOggi.onesignalAppId && window.OneSignal){
      // Initialize OneSignal if not already done
      if (!window.OneSignal.initialized) {
        window.OneSignal.init({ appId: BenzinaOggi.onesignalAppId });
        window.OneSignal.initialized = true;
      }
      
      // Check if user has granted notification permission
      window.OneSignal.getNotificationPermission().then(function(permission) {
        if (permission === 'granted') {
          console.log('Notifications already granted');
        } else {
          console.log('Notifications not granted, permission:', permission);
          // Show a message to enable notifications
          var notifMsg = createEl('div', 'bo-notif-warning');
          notifMsg.innerHTML = '<p style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; color: #856404;">🔔 <strong>Abilita le notifiche:</strong> Per ricevere avvisi sui prezzi, clicca su "Consenti" quando il browser te lo chiede.</p><button id="bo-enable-notifications" style="background: #007cba; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Abilita Notifiche</button>';
          wrap.insertBefore(notifMsg, wrap.firstChild);
          
          // Add click handler for enable notifications button
          var enableBtn = notifMsg.querySelector('#bo-enable-notifications');
          if (enableBtn) {
            enableBtn.addEventListener('click', function() {
              window.OneSignal.showNativePrompt().then(function() {
                console.log('Notification prompt shown');
                notifMsg.style.display = 'none';
              }).catch(function(err) {
                console.error('Error showing notification prompt:', err);
              });
            });
          }
        }
      });
      
      qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var tagKey = 'price_drop_'+fuel;
          var statusEl = this.parentNode.querySelector('.notif-status');
          var labelEl = this.parentNode.querySelector('.notif-label');
          
          if(this.checked){ 
            window.OneSignal.sendTag(tagKey, '1').then(function() {
              console.log('Tag '+tagKey+' set successfully');
              if(statusEl) {
                statusEl.textContent = '✓ Attivato';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#28a745';
              }
            }).catch(function(err) {
              console.error('Error setting tag '+tagKey+':', err);
              if(statusEl) {
                statusEl.textContent = '✗ Errore';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#dc3545';
              }
            });
          } else { 
            window.OneSignal.deleteTag(tagKey).then(function() {
              console.log('Tag '+tagKey+' deleted successfully');
              if(statusEl) statusEl.style.display = 'none';
            }).catch(function(err) {
              console.error('Error deleting tag '+tagKey+':', err);
              if(statusEl) {
                statusEl.textContent = '✗ Errore';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#dc3545';
              }
            });
          }
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


