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
    
    // Add notification button
    var notifyBtn = createEl('button');
    notifyBtn.id = 'bo-enable-notifications';
    notifyBtn.textContent = '🔔 Abilita Notifiche';
    notifyBtn.style.cssText = 'background: #007cba; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 8px 0;';
    actions.appendChild(notifyBtn);

    // Per-distributor notification opt-in
    var distNotifWrap = createEl('div');
    distNotifWrap.style.marginTop = '8px';
    var distChkId = 'bo_notify_distributor_'+(d.impiantoId||'');
    distNotifWrap.innerHTML = '<label><input type="checkbox" id="'+distChkId+'" /> Notifiche variazione prezzi per questo impianto</label>';
    actions.appendChild(distNotifWrap);

    var pricesCard = createEl('div','bo-card');
    var dayTxt = data.day ? new Date(data.day).toLocaleDateString() : '';
    var prevTxt = data.previousDay ? new Date(data.previousDay).toLocaleDateString() : null;
    var subtitle = dayTxt ? ('<div style="margin-top:-6px; color:#666; font-size:0.9em;">Aggiornato al ' + dayTxt + (prevTxt ? ' (confronto con ' + prevTxt + ')' : '') + '</div>') : '';
    pricesCard.innerHTML = '<h3>Prezzi</h3>' + subtitle + '<p style="font-size: 0.9em; color: #666; margin-bottom: 1em;">💡 <strong>Notifiche:</strong> Abilita le notifiche del browser per ricevere avvisi quando i prezzi scendono. Clicca su "quando scende" per ogni carburante.</p>';
    var table = createEl('table','bo-table');
    table.innerHTML = '<thead><tr><th>Carburante</th><th>Prezzo</th><th>Servizio</th><th>Variazione</th><th>Notifica</th></tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');
    (data.prices||[]).forEach(function(p){
      var tr = createEl('tr');
      var id='notif_'+p.fuelType.replace(/[^a-z0-9]/gi,'_');
      var arrow = '';
      var deltaTxt = '';
      if (typeof p.delta === 'number' && p.variation) {
        if (p.variation === 'down') { arrow = '⬇️'; }
        else if (p.variation === 'up') { arrow = '⬆️'; }
        else { arrow = '⟷'; }
        deltaTxt = (p.delta > 0 ? '+' : '') + fmt(Math.abs(p.delta));
      }
      tr.innerHTML = '<td><span class="bo-badge">'+p.fuelType+'</span></td>'+
        '<td>'+fmt(p.price)+'</td>'+
        '<td>'+(p.isSelfService ? 'Self' : 'Servito')+'</td>'+
        '<td>'+(arrow ? (arrow+' '+deltaTxt) : '-')+'</td>'+
        '<td><label><input type="checkbox" id="'+id+'" data-fuel="'+p.fuelType+'"/> <span class="notif-label">quando scende</span> <span class="notif-status" style="display:none; color: #28a745; font-size: 0.9em;">✓ Attivato</span></label></td>';
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(header);
    wrap.appendChild(actions);
    wrap.appendChild(pricesCard);
    pricesCard.appendChild(table);

    // Simple notification system using browser notifications + localStorage
    var hasNotificationSupport = 'Notification' in window;
    var permission = hasNotificationSupport ? Notification.permission : 'denied';
    
    console.log('Notification support:', hasNotificationSupport, 'Permission:', permission);
    
    // Handle notification button
    var enableBtn = document.getElementById('bo-enable-notifications');
    if (enableBtn) {
      enableBtn.addEventListener('click', function() {
        if (!hasNotificationSupport) {
          alert('Il tuo browser non supporta le notifiche');
          return;
        }
        
        if (permission === 'granted') {
          alert('Le notifiche sono già abilitate!');
          return;
        }
        
        Notification.requestPermission().then(function(perm) {
          permission = perm;
          if (perm === 'granted') {
            enableBtn.textContent = '✅ Notifiche Abilitate';
            enableBtn.style.background = '#28a745';
            console.log('Notifications enabled');
            
            // Initialize FCM if available
            initializeFCM();
          } else {
            alert('Notifiche negate. Puoi abilitarle dalle impostazioni del browser.');
          }
        });
      });
    }
    
    // Handle distributor checkbox
    var distCb = document.getElementById(distChkId);
    if (distCb && d.impiantoId) {
      // Check localStorage for distributor preference
      var distKey = 'notify_distributor_' + String(d.impiantoId);
      var isDistEnabled = localStorage.getItem(distKey) === '1';
      if (isDistEnabled) {
        distCb.checked = true;
      }
      
      distCb.addEventListener('change', function() {
        var distKey = 'notify_distributor_' + String(d.impiantoId);
        if (this.checked) {
          if (permission !== 'granted') {
            alert('Abilita prima le notifiche del browser cliccando il pulsante sopra');
            this.checked = false;
            return;
          }
          localStorage.setItem(distKey, '1');
          console.log('Distributor notifications enabled for:', d.impiantoId);
          
          // Save preference to server
          saveNotificationPreference('distributor', d.impiantoId, true);
        } else {
          localStorage.removeItem(distKey);
          console.log('Distributor notifications disabled for:', d.impiantoId);
          
          // Remove preference from server
          saveNotificationPreference('distributor', d.impiantoId, false);
        }
      });
    }
    
    // Pre-sync fuel checkboxes from localStorage
    qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cbSync){
      var fSync = cbSync.getAttribute('data-fuel') || '';
      var storageKey = 'notify_' + fSync.toLowerCase().replace(/\s+/g, '_');
      var isEnabled = localStorage.getItem(storageKey) === '1';
      console.log('Checking localStorage for:', fSync, 'key:', storageKey, 'value:', isEnabled);
      if (isEnabled) {
        cbSync.checked = true;
        var stSync = cbSync.parentNode.querySelector('.notif-status');
        if (stSync) { 
          stSync.textContent = '✓ Attivato per ' + fSync; 
          stSync.style.display='inline'; 
          stSync.style.color = '#28a745'; 
        }
      }
    });

    // Handle fuel checkboxes
    qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
      cb.addEventListener('change', function(){
        var fuel = this.getAttribute('data-fuel');
        var statusEl = this.parentNode.querySelector('.notif-status');
        
        console.log('Checkbox changed for fuel:', fuel);
        
        if(this.checked){ 
          if (permission !== 'granted') {
            alert('Abilita prima le notifiche del browser cliccando il pulsante sopra');
            this.checked = false;
            return;
          }
          
          var storageKey = 'notify_' + fuel.toLowerCase().replace(/\s+/g, '_');
          localStorage.setItem(storageKey, '1');
          console.log('Fuel notifications enabled for:', fuel);
          
          // Save preference to server
          saveNotificationPreference('fuel', fuel, true);
          
          if(statusEl) {
            statusEl.textContent = '✓ Attivato per ' + fuel;
            statusEl.style.display = 'inline';
            statusEl.style.color = '#28a745';
          }
        } else { 
          var storageKey = 'notify_' + fuel.toLowerCase().replace(/\s+/g, '_');
          localStorage.removeItem(storageKey);
          console.log('Fuel notifications disabled for:', fuel);
          
          // Remove preference from server
          saveNotificationPreference('fuel', fuel, false);
          
          if(statusEl) {
            statusEl.style.display = 'none';
          }
        }
      });
    });
  }

  function saveNotificationPreference(type, identifier, enabled) {
    var base = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
    if (!base) {
      console.warn('API base not configured, cannot save preference');
      return;
    }
    
    var userId = 'user_' + Date.now(); // Simple user ID for demo
    var preferences = {
      userId: userId,
      preferences: {
        enabled: enabled,
        type: type,
        identifier: identifier,
        timestamp: new Date().toISOString()
      },
      fcmToken: getFCMTokenFromStorage() // Get FCM token if available
    };
    
    fetch(base + '/api/notifications/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    }).then(function(response) {
      return response.json();
    }).then(function(data) {
      console.log('Preference saved:', data);
    }).catch(function(error) {
      console.error('Error saving preference:', error);
    });
  }

  function getFCMTokenFromStorage() {
    return localStorage.getItem('fcm_token') || null;
  }

  function saveFCMToken(token) {
    localStorage.setItem('fcm_token', token);
  }

  function initializeFCM() {
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
      console.log('Firebase not loaded, using browser notifications only');
      return;
    }

    try {
      // Initialize Firebase Messaging
      var messaging = firebase.messaging();
      
      // Get FCM token
      messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY' }).then(function(currentToken) {
        if (currentToken) {
          console.log('FCM Token:', currentToken);
          saveFCMToken(currentToken);
          
          // Subscribe to price drops topic
          subscribeToTopic(currentToken, 'price_drops');
        } else {
          console.log('No FCM token available');
        }
      }).catch(function(err) {
        console.log('Error getting FCM token:', err);
      });

      // Handle foreground messages
      messaging.onMessage(function(payload) {
        console.log('Message received in foreground:', payload);
        
        // Show notification
        if (payload.notification) {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: payload.notification.icon || '/favicon.ico',
            data: payload.data
          });
        }
      });

    } catch (error) {
      console.error('Error initializing FCM:', error);
    }
  }

  function subscribeToTopic(token, topic) {
    var base = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
    if (!base) {
      console.warn('API base not configured, cannot subscribe to topic');
      return;
    }

    fetch(base + '/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        topic: topic
      })
    }).then(function(response) {
      return response.json();
    }).then(function(data) {
      console.log('Subscribed to topic:', topic, data);
    }).catch(function(error) {
      console.error('Error subscribing to topic:', error);
    });
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