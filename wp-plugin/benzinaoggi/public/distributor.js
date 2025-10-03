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
    // Ensure externalId is available before any server syncs
    function getExternalId(){
      var gen = function(){ return 'bo_'+Math.random().toString(36).slice(2)+'_'+Date.now().toString(36); };
      try {
        var k='bo_ext_id'; var v=localStorage.getItem(k);
        if (!v) { v = gen(); try { localStorage.setItem(k, v); } catch(_s){} }
        return v || gen();
      } catch(_) {
        if (!window.__bo_ext_ephemeral) { window.__bo_ext_ephemeral = gen(); }
        return window.__bo_ext_ephemeral;
      }
    }
    var externalId = getExternalId();
    var header = createEl('div');
    header.innerHTML = '<div class="bo-container">'
      +'<h1 class="bo-title" style="margin:0 0 6px 0">'+(d.bandiera||'Distributore')+' – '+(d.comune||'')+'</h1>'
      +'<p class="bo-subtitle" style="margin:0 0 14px 0;color:#444">Informazioni e prezzi aggiornati</p>'
      +'<a class="bo-back" href="/benzinaoggi-risultati/" onclick="if(document.referrer){event.preventDefault(); window.history.back();}">← Torna ai risultati</a>'
      +'</div>'
      +'<div class="bo-container" style="padding-bottom:0">'
      +'<div class="bo-grid">'
      +'<div><div class="bo-label">Indirizzo</div><div class="bo-value">'+(d.indirizzo||'')+'</div></div>'
      +'<div><div class="bo-label">Provincia</div><div class="bo-value">'+(d.provincia||'')+'</div></div>'
      +'<div><div class="bo-label">Gestore</div><div class="bo-value">'+(d.gestore||'')+'</div></div>'
      +'<div><div class="bo-label">Impianto ID</div><div class="bo-value">'+(d.impiantoId||'')+'</div></div>'
      +'</div>'
      +'</div>';

    var actions = createEl('div','bo-actions');
    // Rimuoviamo la mappa/azioni per rispecchiare la home: nessuna mappa nel dettaglio

    // Per-distributor notification opt-in
    // (removed per-distributor checkbox UI)

    var pricesCard = createEl('div','bo-card');
    var updatedTs = data.lastUpdatedAt || data.day || null;
    var updatedTxt = updatedTs ? new Date(updatedTs).toLocaleString() : '';
    var subtitle = updatedTxt ? ('<div style="margin-top:-6px; color:#666; font-size:0.9em;">Aggiornato al ' + updatedTxt + '</div>') : '';
    pricesCard.innerHTML = '<h3 class="bo-section-title">⛽ Prezzi Carburanti</h3>' + subtitle + '<p class="bo-hint">💡 <strong>Notifiche:</strong> Abilita le notifiche per ricevere avvisi quando i prezzi scendono. Clicca su "quando scende" per ogni carburante.</p>';
    var table = createEl('table','bo-table');
    table.innerHTML = '<thead><tr><th>Carburante</th><th>Prezzo</th><th>Servizio</th><th>Variazione</th><th>Notifica</th></tr></thead><tbody></tbody>';
    var tbody = table.querySelector('tbody');
    (data.prices||[]).forEach(function(p){
      var tr = createEl('tr');
      var fuelKey = (p.fuelType || '') + ' ' + (p.isSelfService ? 'Self' : 'Servito');
      var id='notif_'+fuelKey.replace(/[^a-z0-9]/gi,'_');
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
        '<td><label><input type="checkbox" id="'+id+'" data-fuel="'+fuelKey+'"/> <span class="notif-label">quando scende</span> <span class="notif-status" style="display:none; color: #28a745; font-size: 0.9em;">✓ Attivato</span></label></td>';
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(header);
    wrap.appendChild(actions);
    wrap.appendChild(pricesCard);
    pricesCard.appendChild(table);

    // Note: call /api/subscriptions only when user selects a specific fuel (on checkbox toggle)

    // Always sync checkbox state from server regardless of OneSignal availability
    (function syncFromServerAlways(){
      try {
        var apiBaseInitA = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
        if (!apiBaseInitA || !(d && d.impiantoId) || !externalId) return;
        qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
          var fuelA = cb.getAttribute('data-fuel') || '';
          var normA = fuelA.toLowerCase().replace(/\s+/g, '_');
          var listUrlA = apiBaseInitA + '/api/subscriptions?impiantoId=' + encodeURIComponent(String(d.impiantoId)) + '&fuelType=' + encodeURIComponent(String(fuelA)) + '&externalId=' + encodeURIComponent(String(externalId||''));
          fetch(listUrlA, { credentials: 'omit' }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
            var stA = cb.parentNode.querySelector('.notif-status');
            var isSubA = false;
            try {
              if (res && Array.isArray(res.externalIds) && res.externalIds.indexOf(externalId) !== -1) isSubA = true;
              if (!isSubA && (res && (res.subscribed === true || res.isSubscribed === true || res.exists === true))) isSubA = true;
              if (!isSubA && res && res.ids && Array.isArray(res.ids) && res.ids.indexOf(externalId) !== -1) isSubA = true;
            } catch(_chkA){}
            if (isSubA) {
              cb.checked = true;
              try { localStorage.setItem('bo_notify_'+String(d.impiantoId)+'_'+normA, '1'); } catch(_lsA){}
              if (stA) { stA.textContent = '✓ Attivato per ' + fuelA; stA.style.display='inline'; stA.style.color = '#28a745'; }
            }
          }).catch(function(){ /* ignore */ });
        });
      } catch(_syncA){}
    })();

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

    // Notifications banner disabled on detail page per requirements

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
    // Force-init v16 if SDK present but appId missing (temporary safety net)
    try {
      if (!useOneSignal && window.OneSignal && typeof OneSignal.init === 'function') {
        var forcedAppId = (window.BenzinaOggi && BenzinaOggi.onesignalAppId) 
          || (window.__BO_FORCE_APP_ID) 
          || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) 
          || 'fbcac040-1f81-466f-bf58-238a594af041';
        // avoid double init
        var alreadyV16 = !!(OneSignal && OneSignal.Notifications);
        var alreadyInitialized = !!(OneSignal && OneSignal.initialized);
        if (!alreadyV16 && !alreadyInitialized && forcedAppId) {
          try {
            OneSignal.init({ appId: forcedAppId });
            // mark as usable for this session
            useOneSignal = true;
          } catch(_oi){}
        }
      }
    } catch(_fi){}

    // After v16 is ready, auto-login and upsert subscription to attach externalId server-side
    try {
      if (window.OneSignal) {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OS){
          try {
            if (!OS) return;
            try { await OS.initialized; } catch(_ign){}
            var extNow = externalId;
            if (OS.login && extNow) {
              try { await OS.login(extNow); } catch(_l){}
            }
            if (OS.Notifications && OS.Notifications.requestPermission) {
              try { await OS.Notifications.requestPermission(); } catch(_p){}
            }
            var sidNow = null;
            try { sidNow = await (OS.User && OS.User.PushSubscription && OS.User.PushSubscription.getId ? OS.User.PushSubscription.getId() : null); } catch(_sid){}
            if (sidNow && (window.BenzinaOggi && BenzinaOggi.apiBase)) {
              try {
                var u = BenzinaOggi.apiBase + '/api/onesignal/update-subscription';
                var body = { externalId: extNow, subscriptionId: sidNow, body: { enabled: true } };
                fetch(u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                  .catch(function(){});
              } catch(_f){}
            }
          } catch(_e){}
        });
      }
    } catch(_afe){}

  // externalId already initialized above
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
          
          // Silent check; do not show banner on detail page
          try {
            osIsEnabled().then(function(isEnabled) {
              console.log('Push notifications enabled:', isEnabled);
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
                    var k1 = 'bo_notify_'+String(d && d.impiantoId)+'_'+norm;
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

    // After render, verify server state for each fuel (to persist across refresh)
    try {
      var apiBaseInit = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
      if (apiBaseInit && d && d.impiantoId && externalId) {
        qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
          var fuel = cb.getAttribute('data-fuel') || '';
          var norm = fuel.toLowerCase().replace(/\s+/g, '_');
          var listUrl = apiBaseInit + '/api/subscriptions?impiantoId=' + encodeURIComponent(String(d.impiantoId)) + '&fuelType=' + encodeURIComponent(String(fuel)) + '&externalId=' + encodeURIComponent(String(externalId||''));
          fetch(listUrl, { credentials: 'omit' }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
            var st = cb.parentNode.querySelector('.notif-status');
            var isSub = false;
            try {
              if (res && Array.isArray(res.externalIds) && res.externalIds.indexOf(externalId) !== -1) isSub = true;
              if (!isSub && (res && (res.subscribed === true || res.isSubscribed === true || res.exists === true))) isSub = true;
              if (!isSub && res && res.ids && Array.isArray(res.ids) && res.ids.indexOf(externalId) !== -1) isSub = true;
            } catch(_chk){}
            if (isSub) {
              cb.checked = true;
              try { localStorage.setItem('bo_notify_'+String(d.impiantoId)+'_'+norm, '1'); } catch(_ls){}
              if (st) { st.textContent = '✓ Attivato per ' + fuel; st.style.display='inline'; st.style.color = '#28a745'; }
            } else {
              // Fallbacks: impianto-scoped key, then generic key
              var lsScoped = false, lsGeneric = false;
              try { lsScoped = (localStorage.getItem('bo_notify_'+String(d.impiantoId)+'_'+norm) === '1'); } catch(_e1){}
              try { lsGeneric = (localStorage.getItem('bo_notify_'+norm) === '1'); } catch(_e2){}
              cb.checked = !!(lsScoped || lsGeneric);
              if (!cb.checked && st) st.style.display='none';
            }
          }).catch(function(){ /* ignore */ });
        });
      }
    } catch(_pref){}

    qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var tagKey = 'price_drop_'+fuel;
          var statusEl = this.parentNode.querySelector('.notif-status');
          var labelEl = this.parentNode.querySelector('.notif-label');
        try { if (!externalId) { externalId = getExternalId(); } } catch(_eid){}
        var apiBaseNow = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
        console.log('Checkbox toggle:', { fuel: fuel, checked: this.checked, impiantoId: (d&&d.impiantoId), apiBase: apiBaseNow, externalId: externalId });
          
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
                    var subIdEarly = null;
                    try { 
              subIdEarly = await (OneSignal && OneSignal.User && OneSignal.User.PushSubscription && OneSignal.User.PushSubscription.getId ? OneSignal.User.PushSubscription.getId() : null); 
              console.log('OneSignal subscription ID retrieved:', subIdEarly);
            } catch(_sidE){
              console.warn('Error getting OneSignal subscription ID:', _sidE);
            }
                    var payloadEarly = { externalId: externalId, impiantoId: d.impiantoId, fuelType: fuel };
                    if (subIdEarly) payloadEarly.subscriptionId = subIdEarly;
                    console.log('POST /api/subscriptions (subscribe)', subUrlEarly, payloadEarly);
                    fetch(subUrlEarly, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payloadEarly)
                    }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
                      console.log('POST /api/subscriptions subscribe response:', res);
                      if (res && res.ok) {
                        try {
                          if (statusEl) { statusEl.textContent = '✓ Attivato per ' + fuel; statusEl.style.display = 'inline'; statusEl.style.color = '#28a745'; }
                        } catch(_sx){}
                        try { localStorage.setItem('bo_notify_'+String(d.impiantoId)+'_'+normKeyInit, '1'); } catch(_lsx){}
                        // If OneSignal is available, ensure login and tag after backend save
                        try {
                          if (window.OneSignal && OneSignal.User) {
                            osExec(async function(){
                              try {
                                if (OneSignal.login && externalId) { try { await OneSignal.login(externalId); } catch(_l){} }
                                var tg = { };
                                // Tag specifico per distributore e carburante (unico canale di targeting)
                                var distributorFuelTag = 'notify_' + d.impiantoId + '_' + fuel.toLowerCase().replace(/\s+/g, '_');
                                tg[distributorFuelTag] = '1';
                                tg['price_drop_notifications'] = '1';
                                // Non impostare più il tag generico per carburante per evitare cross-activation
                                tg['fuel_type'] = fuel.trim();
                                try { await osSetTags(tg); } catch(_t){}
                                console.log('OneSignal tags set for distributor', d.impiantoId, ':', tg);
                              } catch(_eos){}
                            });
                          }
                        } catch(_on){ }
                      }
                    }).catch(function(err){ console.warn('Persist subscription (early) failed', err); });
                  }
                }
              } catch(_ce){}

              // If OneSignal is not ready, stop here (we already persisted preference and updated UI)
              if (!(window.OneSignal && (window.OneSignal.sendTags || window.OneSignal.sendTag))) {
                return;
              }
              
              // Ensure OneSignal user is logged-in with externalId (saves external_id server-side)
              try {
                osExec(async function(){
                  try { if (OneSignal && OneSignal.login && externalId) { await OneSignal.login(externalId); } } catch(_eL){}
                });
              } catch(_elog){}

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
                  // Add per-distributor+fuel tag
                  try {
                    var impIdForTag = (d && d.impiantoId) ? String(d.impiantoId) : '';
                    if (impIdForTag) {
                      var fuelNormForTag = fuel.toLowerCase().replace(/\s+/g, '_');
                      var impFuelTag = 'notify_imp_' + impIdForTag + '_' + fuelNormForTag;
                      tags[impFuelTag] = '1';
                    }
                  } catch(_c){}
                  
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
                // Delete only distributor-specific fuel notification tags
                var distributorTagToDelete = 'notify_' + d.impiantoId + '_' + fuel.toLowerCase().replace(/\s+/g, '_');
                
                // Inform backend remove FIRST (this stops notifications for this specific impianto+fuel)
                try {
                  if (externalId) {
                    var apiBaseR = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
                    var subUrlR = (apiBaseR || '') + '/api/subscriptions';
                    var payloadR = { action: 'remove', externalId: externalId, impiantoId: (d && d.impiantoId) ? String(d.impiantoId) : undefined, fuelType: fuel };
                    console.log('POST /api/subscriptions REMOVE', subUrlR, payloadR);
                    fetch(subUrlR, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payloadR)
                    }).then(function(r){ return r.json().catch(function(){ return {}; }); }).then(function(res){
                      console.log('POST /api/subscriptions REMOVE response:', res);
                      if (res && res.ok) {
                        console.log('Backend subscription removed for', d.impiantoId, fuel);
                      }
                    }).catch(function(err){ console.warn('Backend remove failed', err); });
                  }
                } catch(_cr){}
                
                // Delete OneSignal tags (general fuel tag and specific distributor+fuel tag)
                var deletePromises = [];
                if (distributorTagToDelete) {
                  deletePromises.push(osDeleteTag(distributorTagToDelete));
                }
                try {
                  var impIdDel = (d && d.impiantoId) ? String(d.impiantoId) : '';
                  if (impIdDel) {
                    var fuelNormDel = fuel.toLowerCase().replace(/\s+/g, '_');
                    var delCombo = 'notify_imp_' + impIdDel + '_' + fuelNormDel;
                    deletePromises.push(osDeleteTag(delCombo));
                  }
                } catch(_del){}
                
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
                  localStorage.removeItem('bo_notify_'+String(d && d.impiantoId)+'_'+normKeyR);
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
          var apiBase = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
          var impId = (d && d.impiantoId) ? String(d.impiantoId) : undefined;
          try { if (!externalId) { externalId = getExternalId(); } } catch(_e){}
          
          if(this.checked){ 
            if (Notification.permission === 'granted') {
              if(statusEl) {
                statusEl.textContent = '✓ Attivato (Browser)';
                statusEl.style.display = 'inline';
                statusEl.style.color = '#28a745';
              }
              // Store preference in localStorage (use same keys as OS path)
              try {
                var normB = (fuel||'').toLowerCase().replace(/\s+/g, '_');
                localStorage.setItem('notify_' + fuel, '1'); // legacy
                localStorage.setItem('bo_notify_'+String(impId)+'_'+normB, '1');
                localStorage.setItem('bo_notify_'+normB, '1');
              } catch(_ls){}
              // Persist to backend like OneSignal path
              try {
                if (apiBase && externalId && impId) {
                  var url = apiBase + '/api/subscriptions';
                  var body = { externalId: externalId, impiantoId: impId, fuelType: fuel };
                  console.log('POST /api/subscriptions (browser subscribe)', url, body);
                  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    .then(function(r){ return r.json().catch(function(){ return {}; }); })
                    .then(function(res){ console.log('subscriptions subscribe response (browser):', res); })
                    .catch(function(err){ console.warn('subscriptions subscribe failed (browser)', err); });
                }
              } catch(_p){}
            } else {
              this.checked = false;
              alert('Abilita prima le notifiche del browser');
            }
          } else { 
            if(statusEl) statusEl.style.display = 'none';
            try {
              localStorage.removeItem('notify_' + fuel);
              var normBR = (fuel||'').toLowerCase().replace(/\s+/g, '_');
              localStorage.removeItem('bo_notify_'+String(impId)+'_'+normBR);
              localStorage.removeItem('bo_notify_'+normBR);
            } catch(_rm){}
            // Inform backend removal
            try {
              if (apiBase && externalId && impId) {
                var urlR = apiBase + '/api/subscriptions';
                var bodyR = { action: 'remove', externalId: externalId, impiantoId: impId, fuelType: fuel };
                console.log('POST /api/subscriptions (browser remove)', urlR, bodyR);
                fetch(urlR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyR) })
                  .then(function(r){ return r.json().catch(function(){ return {}; }); })
                  .then(function(res){ console.log('subscriptions remove response (browser):', res); })
                  .catch(function(err){ console.warn('subscriptions remove failed (browser)', err); });
              }
            } catch(_pr){}
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

