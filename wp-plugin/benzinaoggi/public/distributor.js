(function(){
  // Early SW registration to ensure root-scoped worker is available before OneSignal flows
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then(function(reg){
        if (!reg) { try { navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' }); } catch(e){} }
      });
    }
  } catch(_e){}
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

    // Per-distributor notification opt-in
    // (removed per-distributor checkbox UI)

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

    // Unified permission banner (shown until permission is granted)
    function showPermissionBanner(){
      try {
        var existing = document.getElementById('bo-perm-banner');
        if (existing) return existing;
        var perm = (window.OneSignal && OneSignal.Notifications && OneSignal.Notifications.permission) || (window.Notification && Notification.permission) || 'default';
        // if v16 returns a function for permission, do not block banner; click will resolve
        if (perm === 'granted') return null;
        var banner = createEl('div');
        banner.id = 'bo-perm-banner';
        banner.style.cssText = 'background:#fff3cd;border:1px solid #ffeaa7;padding:10px;border-radius:4px;margin:10px 0;color:#856404;display:flex;justify-content:space-between;align-items:center;gap:12px;';
        var msg = createEl('div');
        msg.innerHTML = '🔔 <strong>Abilita le notifiche</strong> per ricevere avvisi quando i prezzi scendono.';
        var btn = createEl('button');
        btn.textContent = 'Consenti notifiche';
        btn.style.cssText = 'background:#007cba;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;';
        btn.addEventListener('click', function(){
          // Try OneSignal prompt first, then browser fallback
          osPrompt().then(function(){
            try { banner.style.display = 'none'; } catch(_e){}
          }).catch(function(){
            if (window.Notification && Notification.requestPermission) {
              Notification.requestPermission().then(function(p){ if (p === 'granted') { try { banner.style.display = 'none'; } catch(_e){} } });
            }
          });
        });
        banner.appendChild(msg);
        banner.appendChild(btn);
        wrap.insertBefore(banner, wrap.firstChild);
        return banner;
      } catch(_e) { return null; }
    }

    // Try to show banner immediately after render
    showPermissionBanner();

    // Global guard map to avoid duplicate subscription POSTs per (impiantoId,fuel)
    try { window.__boSubSent = window.__boSubSent || {}; } catch(_g){}

    // OneSignal helpers (work with both v15 and v16)
    function canUseIndexedDB(){
      return new Promise(function(resolve){
        try {
          var req = indexedDB.open('bo_test_db');
          req.onerror = function(){ resolve(false); };
          req.onsuccess = function(){ try { req.result && req.result.close && req.result.close(); } catch(_){} resolve(true); };
        } catch(_) { resolve(false); }
      });
    }
    async function ensureServiceWorkerRegistered(){
      try {
        if (!('serviceWorker' in navigator)) return;
        var reg = await navigator.serviceWorker.getRegistration('/');
        if (!reg) {
          try {
            await navigator.serviceWorker.register('/?onesignal_worker=1', { scope: '/' });
          } catch(_e){}
        }
      } catch(_err){}
    }
    function osExec(cb){
      try {
        // Prefer v16 deferred queue if present
        if (Array.isArray(window.OneSignalDeferred)) {
          window.OneSignalDeferred.push(function(){ try { cb(window.OneSignal); } catch(_){} });
          return;
        }
        if (window.OneSignal && typeof window.OneSignal.push === 'function') {
          // v15 queue
          window.OneSignal.push(cb);
          return;
        }
        // If SDK not ready yet, retry shortly
        setTimeout(function(){ osExec(cb); }, 300);
      } catch(e){}
    }
    function osIsEnabled(){
      return new Promise(function(resolve){
        osExec(async function(){
          try {
            // v16 check
            if (OneSignal && OneSignal.Notifications) {
              var perm = OneSignal.Notifications.permission;
              if (typeof perm === 'function') { try { perm = await OneSignal.Notifications.permission(); } catch(_){} }
              if (perm === 'granted') { resolve(true); return; }
            }
            // v15 check
            if (OneSignal && typeof OneSignal.isPushNotificationsEnabled === 'function') {
              try {
                var v = await OneSignal.isPushNotificationsEnabled();
                resolve(!!v);
                return;
              } catch(_){}
            }
            resolve(false);
          } catch(_e){ resolve(false); }
        });
      });
    }
    function osSetTags(tags){
      return new Promise(function(resolve, reject){
        try {
          if (window.OneSignal && OneSignal.User && typeof OneSignal.User.addTags === 'function') {
            OneSignal.User.addTags(tags).then(resolve).catch(reject);
          } else if (window.OneSignal && typeof OneSignal.sendTags === 'function') {
            OneSignal.sendTags(tags).then(resolve).catch(reject);
          } else if (window.OneSignal && typeof OneSignal.sendTag === 'function') {
            var ps=[]; Object.keys(tags).forEach(function(k){ ps.push(OneSignal.sendTag(k, tags[k])); });
            Promise.all(ps).then(resolve).catch(reject);
          } else {
            reject(new Error('No tag API available'));
          }
        } catch(e){ reject(e); }
      });
    }
    function osDeleteTag(key){
      return new Promise(function(resolve, reject){
        try {
          if (window.OneSignal && OneSignal.User && typeof OneSignal.User.removeTag === 'function') {
            var p = OneSignal.User.removeTag(key);
            if (p && typeof p.then === 'function') {
              p.then(resolve).catch(reject);
            } else {
              resolve();
            }
          } else if (window.OneSignal && typeof OneSignal.deleteTag === 'function') {
            var p2 = OneSignal.deleteTag(key);
            if (p2 && typeof p2.then === 'function') {
              p2.then(resolve).catch(reject);
            } else {
              resolve();
            }
          } else { 
            resolve(); // Silently succeed if no API available
          }
        } catch(e){ 
          console.warn('osDeleteTag error:', e);
          resolve(); // Don't fail the UI flow
        }
      });
    }
    function osPrompt(){
      return new Promise(function(resolve, reject){
        osExec(async function(){
          try {
            var perm = (OneSignal && OneSignal.Notifications && OneSignal.Notifications.permission) || (window.Notification && Notification.permission) || 'default';
            if (typeof perm === 'function') { try { perm = await OneSignal.Notifications.permission(); } catch(_){} }
            if (perm === 'granted') { resolve('granted'); return; }
            if (perm === 'denied') { reject(new Error('permission-denied')); return; }

            if (OneSignal && OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
              try {
                const r = await OneSignal.Notifications.requestPermission();
                resolve(r);
                return;
              } catch (e) { reject(e); return; }
            }
            if (OneSignal && typeof OneSignal.showNativePrompt === 'function') {
              OneSignal.showNativePrompt().then(resolve).catch(reject);
              return;
            }
            if (OneSignal && typeof OneSignal.registerForPushNotifications === 'function') {
              OneSignal.registerForPushNotifications().then(resolve).catch(reject);
              return;
            }
            if (window.Notification && typeof Notification.requestPermission === 'function') {
              try {
                const r2 = await Notification.requestPermission();
                if (r2 === 'granted') { resolve(r2); } else { reject(new Error(r2)); }
                return;
              } catch (e2) { reject(e2); return; }
            }
            reject(new Error('Prompt not available'));
          } catch (e) { reject(e); }
        });
      });
    }

    // Check if OneSignal is available, otherwise use browser notifications
    var useOneSignal = window.BenzinaOggi && BenzinaOggi.onesignalAppId && window.OneSignal;

    // Generate/load persistent externalId for this browser
    function getExternalId(){
      try {
        var k='bo_ext_id'; var v=localStorage.getItem(k);
        if (!v) { v = 'bo_'+Math.random().toString(36).slice(2)+'_'+Date.now().toString(36); localStorage.setItem(k, v); }
        return v;
      } catch(_) { return null; }
    }
    var externalId = getExternalId();
    var useBrowserNotifications = !useOneSignal && 'Notification' in window;
    
    console.log('OneSignal check:', {
      hasBenzinaOggi: !!window.BenzinaOggi,
      hasAppId: !!(window.BenzinaOggi && BenzinaOggi.onesignalAppId),
      hasOneSignal: !!window.OneSignal,
      appId: window.BenzinaOggi ? BenzinaOggi.onesignalAppId : 'undefined',
      useOneSignal: useOneSignal,
      useBrowserNotifications: useBrowserNotifications
    });
    
    if(useOneSignal){
      var isV16 = !!(window.OneSignal && OneSignal.Notifications);
      var isV15 = false; // force v16-only path
      // Auto prompt once per session on page load (v15/v16)
      try {
        var promptKey = 'bo_prompt_shown_session';
        var alreadyPrompted = false;
        try { alreadyPrompted = sessionStorage.getItem(promptKey) === '1'; } catch(_s){}
        var tryAutoPrompt = function(){
          if (!isV16) { return; }
          try {
            osExec(async function(){
              try {
                var permVal = (OneSignal && OneSignal.Notifications && OneSignal.Notifications.permission) || (window.Notification && Notification.permission) || 'default';
                if (typeof permVal === 'function') { try { permVal = await OneSignal.Notifications.permission(); } catch(_){} }
                if (permVal === 'default' && !alreadyPrompted) {
                  try { sessionStorage.setItem(promptKey, '1'); } catch(_ss){}
                  try { await ensureServiceWorkerRegistered(); await osPrompt(); } catch(_pe){}
                }
              } catch(_e){}
            });
          } catch(_err){}
        };
        // slight delay to allow SDK to be ready
        setTimeout(tryAutoPrompt, 1200);
      } catch(_ap){}

      // Safe login flow after SDK initialized + IndexedDB available
      try {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OS){
          try {
            if (!OS || !OS.initialized) return;
            try { await OS.initialized; } catch(_i){}
            var okIDB = await canUseIndexedDB();
            if (okIDB && externalId && OS.login) {
              try { await OS.login(externalId); } catch(_lg){}
            }
            if (OS.Notifications && OS.Notifications.requestPermission) {
              try { await OS.Notifications.requestPermission(); } catch(_rp){}
            }
            // Ensure push subscription and wait for subscriptionId
            try {
              if (OS.User && OS.User.PushSubscription) {
                if (typeof OS.User.PushSubscription.optIn === 'function') {
                  try { await OS.User.PushSubscription.optIn(); } catch(_){}
                }
                var sid = null, tries = 0;
                while (!sid && tries < 20) {
                  try { sid = await OS.User.PushSubscription.getId(); } catch(_){}
                  if (!sid) { await new Promise(function(r){ setTimeout(r, 500); }); tries++; }
                }
                if (sid) { try { console.log('OneSignal subId acquired:', sid); } catch(_){} }
              }
            } catch(_sub){}
          } catch(_e){}
        });
      } catch(_l){}

      // Rely on global v16 init done in PHP header; do not re-initialize here
      
      // Wait for OneSignal to be completely ready
      var waitForOneSignal = function() {
        var readyV16 = !!(window.OneSignal && OneSignal.Notifications);
        if (readyV16) {
          console.log('OneSignal is ready ( v16 ), checking permissions...');
          
          // Use a more reliable method to check permissions
          try {
            osIsEnabled().then(function(isEnabled) {
              console.log('Push notifications enabled:', isEnabled);
              if (!isEnabled) {
                // Use unified banner and fallback to browser prompt if SDK not ready
                showPermissionBanner();
              }
            }).catch(function(err) {
              console.error('Error checking push notifications:', err);
            });
          } catch (err) {
            console.error('OneSignal permission check error:', err);
          }
        } else {
          // OneSignal not ready, try again
          setTimeout(waitForOneSignal, 1000);
        }
      };
      
      // Start checking shortly after page load
      setTimeout(waitForOneSignal, 1500);

      // Ensure subscribe helper for v16 before setting tags
      function osEnsureSubscribed(){
        return new Promise(function(resolve, reject){
          try {
            osExec(async function(){
              try {
                if (OneSignal && OneSignal.Notifications && OneSignal.User && OneSignal.User.PushSubscription) {
                  const perm = await OneSignal.Notifications.permission;
                  if (perm !== 'granted') {
                    await ensureServiceWorkerRegistered();
                    await OneSignal.Notifications.requestPermission();
                  }
                  if (OneSignal.User.PushSubscription && OneSignal.User.PushSubscription.optIn) {
                    try { await OneSignal.User.PushSubscription.optIn(); } catch(_e){}
                  }
                  // wait until we have a subscription id
                  var tries = 0;
                  while (tries < 10) { // ~5s max
                    try {
                      const sid = await (OneSignal.User.PushSubscription.getId ? OneSignal.User.PushSubscription.getId() : OneSignal.User.pushSubscriptionId);
                      if (sid) break;
                    } catch(_ee){}
                    await new Promise(r => setTimeout(r, 500));
                    tries++;
                  }
                  resolve(true);
                } else {
                  resolve(true);
                }
              } catch (e) { reject(e); }
            });
          } catch(e){ reject(e); }
        });
      }
      
      // Add manual notification button handler
      var manualBtn = wrap.querySelector('#bo-manual-notifications');
      if (manualBtn) {
        manualBtn.addEventListener('click', function() {
          console.log('Manual notification button clicked');
        if (window.OneSignal) {
            osPrompt().then(function() {
              console.log('Manual prompt shown');
              manualBtn.textContent = '✅ Notifiche Abilitate';
              manualBtn.style.background = '#28a745';
            }).catch(function(err) {
              console.error('Error showing manual prompt:', err);
              manualBtn.textContent = '❌ Errore';
              manualBtn.style.background = '#dc3545';
            });
          } else if ('Notification' in window) {
            Notification.requestPermission().then(function(permission) {
              if (permission === 'granted') {
                manualBtn.textContent = '✅ Notifiche Abilitate';
                manualBtn.style.background = '#28a745';
              } else {
                manualBtn.textContent = '❌ Negato';
                manualBtn.style.background = '#dc3545';
              }
            });
          } else {
            manualBtn.textContent = '❌ Non Supportato';
            manualBtn.style.background = '#dc3545';
          }
        });
      }
      
      // (removed per-distributor checkbox handling)

      // Pre-sync fuel checkboxes from existing tags (v16 or v15)
      try {
        osExec(async function(){
          try {
            var tagsInit2 = null;
            if (OneSignal && OneSignal.User && OneSignal.User.getTags) tagsInit2 = await OneSignal.User.getTags();
            else if (OneSignal && OneSignal.getTags) tagsInit2 = await OneSignal.getTags();
            if (tagsInit2) {
              qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cbSync){
                var fSync = cbSync.getAttribute('data-fuel') || '';
                var norm = fSync.toLowerCase().replace(/\s+/g, '_');
                var tagFuel = 'notify_' + norm;
                if ((tagsInit2[tagFuel] === '1' || tagsInit2[tagFuel] === 1)) {
                  cbSync.checked = true;
                  var stSync = cbSync.parentNode.querySelector('.notif-status');
                  if (stSync) { stSync.textContent = '✓ Attivato per ' + fSync; stSync.style.display='inline'; stSync.style.color = '#28a745'; }
                } else {
                  // Fallback to localStorage persistence
                  try {
                    var k1 = 'bo_notify_'+norm;
                    var v1 = localStorage.getItem(k1) === '1';
                    if (v1) {
                      cbSync.checked = true;
                      var stSync2 = cbSync.parentNode.querySelector('.notif-status');
                      if (stSync2) { stSync2.textContent = '✓ Attivato per ' + fSync; stSync2.style.display='inline'; stSync2.style.color = '#28a745'; }
                    }
                  } catch(_ls2){}
                }
              });
            }
          } catch (_ee) {}
        });
      } catch (_e) {}

      qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var tagKey = 'price_drop_'+fuel;
          var statusEl = this.parentNode.querySelector('.notif-status');
          var labelEl = this.parentNode.querySelector('.notif-label');
          
          console.log('Checkbox changed for fuel:', fuel, 'Element:', this);
          
          var setTag = function() {
            try {
              // Validate fuel type
              if (!fuel || fuel.trim() === '') {
                console.error('Invalid fuel type:', fuel);
                if(statusEl) {
                  statusEl.textContent = '✗ Errore: Tipo carburante non valido';
                  statusEl.style.display = 'inline';
                  statusEl.style.color = '#dc3545';
                }
                return;
              }
              // Optimistic UI: mark as enabled and persist locally immediately
              if(statusEl) {
                statusEl.textContent = '✓ Attivazione in corso…';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#28a745';
              }
              cb.checked = true;
              try {
                var normKeyInit = fuel.toLowerCase().replace(/\s+/g, '_');
                localStorage.setItem('bo_notify_'+normKeyInit, '1');
              } catch(_p0){}

              // Send subscription to backend immediately (optimistic), regardless of OneSignal readiness
              try {
                if (externalId) {
                  var keyOnce = 'add:'+String(d && d.impiantoId)+'|'+String(fuel);
                  var sentMap = (function(){ try { return window.__boSubSent; } catch(_e){ return {}; } })();
                  if (!sentMap[keyOnce]) {
                    sentMap[keyOnce] = true; try { window.__boSubSent = sentMap; } catch(_s){}
                    var apiBaseEarly = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
                    if (!apiBaseEarly) { console.warn('BenzinaOggi.apiBase non configurato: POST /api/subscriptions potrebbe fallire'); }
                    var subUrlEarly = (apiBaseEarly || '') + '/api/subscriptions';
                    fetch(subUrlEarly, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'add', externalId: externalId, impiantoId: d.impiantoId, fuelType: fuel })
                    }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
                      if (res && res.ok) {
                        try {
                          if (statusEl) { statusEl.textContent = '✓ Attivato per ' + fuel; statusEl.style.display = 'inline'; statusEl.style.color = '#28a745'; }
                        } catch(_sx){}
                      }
                    }).catch(function(err){ console.warn('Persist subscription (early) failed', err); });
                  }
                }
              } catch(_ce){}

              // If OneSignal is not ready, stop here (we already persisted preference and updated UI)
              if (!(window.OneSignal && (window.OneSignal.sendTags || window.OneSignal.sendTag))) {
                return;
              }
              
              // From here on, proceed with OneSignal permission + tag flow
              
            } catch(errInit) { console.error('setTag init error', errInit); }
            
            if (window.OneSignal && (window.OneSignal.sendTags || window.OneSignal.sendTag)) {
              try {

                // Check if notifications are enabled, if not request permission
                osIsEnabled().then(function(isEnabled) {
                  var p = isEnabled ? osEnsureSubscribed() : (osPrompt().then(osEnsureSubscribed));
                  return p.then(function(){ return osIsEnabled(); });
                }).then(function(enabledAfter){
                  if (!enabledAfter) { throw new Error('permission-denied'); }
                  return setTagsAfterPermission();
                }).catch(function(err) {
                  console.error('Error requesting notification permission:', err);
                  if(statusEl) {
                    statusEl.textContent = '✗ Errore: Autorizzazione negata';
                    statusEl.style.display = 'inline';
                    statusEl.style.color = '#dc3545';
                  }
                });
                
                function setTagsAfterPermission() {
                  // Set multiple tags for better targeting
                  var tags = {
                    'price_drop_notifications': '1',
                    'fuel_type': fuel.trim()
                  };
                  // Add dynamic tag for specific fuel type
                  var fuelTag = 'notify_' + fuel.toLowerCase().replace(/\s+/g, '_');
                  tags[fuelTag] = '1';
                  // no per-distributor combo tag
                  try {} catch(_c){}
                  
                  // Backend subscription has already been attempted optimistically above

                  console.log('Sending tags for fuel:', fuel, 'Tags:', tags);
                  osSetTags(tags).then(async function(){
                    console.log('Tags set successfully for fuel:', fuel, tags);
                    try {
                      if (OneSignal && OneSignal.User && OneSignal.User.getTags) {
                        var tg = await OneSignal.User.getTags();
                        var fuelNormV = fuel.toLowerCase().replace(/\s+/g, '_');
                        var needs = [ 'price_drop_notifications', 'fuel_type', 'notify_'+fuelNormV ];
                        var ok = needs.every(function(k){ return tg && (tg[k] === '1' || tg[k] === 1 || tg[k] === fuel || tg[k] === fuel.trim()); });
                        if (!ok) { await osSetTags(tags); }
                      }
                    } catch(_vr){}
                    if(statusEl) {
                      statusEl.textContent = '✓ Attivato per ' + fuel;
                      statusEl.style.display = 'inline';
                      statusEl.style.color = '#28a745';
                    }
                    // Already persisted locally optimistically
                  }).catch(function(err){
                    console.error('Error setting tags for fuel:', fuel, err);
                    // Do not uncheck; keep user preference and rely on externalId targeting
                    if(statusEl) {
                      statusEl.textContent = '✓ Attivato (senza tag)';
                      statusEl.style.display = 'inline';
                      statusEl.style.color = '#28a745';
                    }
                  });
                }
              } catch (err) {
                console.error('OneSignal sendTags error:', err);
                if(statusEl) {
                  statusEl.textContent = '✗ Errore';
                  statusEl.style.display = 'inline';
                  statusEl.style.color = '#dc3545';
                }
              }
            } else {
              // OneSignal not ready, try again
              setTimeout(setTag, 1000);
            }
          };
          
          var deleteTag = function() {
            if (window.OneSignal) {
              try {
                // Delete specific fuel notification tag
                var tagToDelete = 'notify_' + fuel.toLowerCase().replace(/\s+/g, '_');
                
                // Inform backend remove FIRST (this stops notifications for this specific impianto+fuel)
                try {
                  if (externalId) {
                    var apiBaseR = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
                    var subUrlR = (apiBaseR || '') + '/api/subscriptions';
                    fetch(subUrlR, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'remove', externalId: externalId, impiantoId: (d && d.impiantoId) ? String(d.impiantoId) : undefined, fuelType: fuel })
                    }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
                      if (res && res.ok) {
                        console.log('Backend subscription removed for', d.impiantoId, fuel);
                      }
                    }).catch(function(err){ console.warn('Backend remove failed', err); });
                  }
                } catch(_cr){}
                
                // Delete OneSignal tags (both general fuel tag and specific distributor+fuel tag)
                var deletePromises = [osDeleteTag(tagToDelete)];
                
                Promise.all(deletePromises).then(function(){
                  console.log('All tags deleted successfully for fuel:', fuel, 'distributor:', d.impiantoId);
                  if(statusEl) statusEl.style.display = 'none';
                }).catch(function(err){
                  console.warn('Error deleting some tags for fuel:', fuel, err);
                  if(statusEl) statusEl.style.display = 'none'; // Hide status anyway
                });
                
                // Remove local persistence
                try {
                  var normKeyR = fuel.toLowerCase().replace(/\s+/g, '_');
                  localStorage.removeItem('bo_notify_'+normKeyR);
                } catch(_rm){}
              } catch (err) {
                console.error('OneSignal deleteTag error:', err);
                if(statusEl) {
                  statusEl.textContent = '✗ Errore';
                  statusEl.style.display = 'inline';
                  statusEl.style.color = '#dc3545';
                }
              }
            } else {
              // OneSignal not ready, try again
              setTimeout(deleteTag, 1000);
            }
          };
          
          if(this.checked){ 
            setTag();
          } else { 
            deleteTag();
          }
        });
      });
    } else if (useBrowserNotifications) {
      // Fallback to browser notifications
      console.log('Using browser notifications as fallback');
      
      // Check notification permission
      if (Notification.permission === 'granted') {
        console.log('Browser notifications already granted');
      } else if (Notification.permission === 'default') {
        // Show message to enable notifications
        var notifMsg = createEl('div', 'bo-notif-warning');
        notifMsg.innerHTML = '<p style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; color: #856404;">🔔 <strong>Abilita le notifiche:</strong> Per ricevere avvisi sui prezzi, clicca su "Consenti" quando il browser te lo chiede.</p><button id="bo-enable-notifications" style="background: #007cba; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Abilita Notifiche</button>';
        wrap.insertBefore(notifMsg, wrap.firstChild);
        
        var enableBtn = notifMsg.querySelector('#bo-enable-notifications');
        if (enableBtn) {
          enableBtn.addEventListener('click', function() {
            Notification.requestPermission().then(function(permission) {
              if (permission === 'granted') {
                notifMsg.style.display = 'none';
                console.log('Browser notifications enabled');
              }
            });
          });
        }
      }
      
      // Handle checkbox changes for browser notifications
      qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var statusEl = this.parentNode.querySelector('.notif-status');
          
          if(this.checked){ 
            if (Notification.permission === 'granted') {
              if(statusEl) {
                statusEl.textContent = '✓ Attivato (Browser)';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#28a745';
              }
              // Store preference in localStorage
              localStorage.setItem('notify_' + fuel, '1');
            } else {
              this.checked = false;
              alert('Abilita prima le notifiche del browser');
            }
          } else { 
            if(statusEl) statusEl.style.display = 'none';
            localStorage.removeItem('notify_' + fuel);
          }
        });
      });
    } else {
      // No notification support
      console.log('No notification support available');
      var notifMsg = createEl('div', 'bo-notif-warning');
      notifMsg.innerHTML = '<p style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin: 10px 0; color: #721c24;">⚠️ <strong>Notifiche non supportate:</strong> Il tuo browser non supporta le notifiche push.</p>';
      wrap.insertBefore(notifMsg, wrap.firstChild);
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

