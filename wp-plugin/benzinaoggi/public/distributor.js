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

    // OneSignal helpers (work with official plugin too)
    function osExec(cb){ try { if (window.OneSignal && window.OneSignal.push) { window.OneSignal.push(cb); } } catch(e){} }
    function osIsEnabled(){
      return new Promise(function(resolve){
        osExec(function(){
          if (OneSignal && typeof OneSignal.isPushNotificationsEnabled === 'function') {
            OneSignal.isPushNotificationsEnabled().then(function(v){ resolve(!!v); }).catch(function(){ resolve(false); });
          } else { resolve(false); }
        });
      });
    }
    function osPrompt(){
      return new Promise(function(resolve, reject){
        osExec(function(){
          if (OneSignal && typeof OneSignal.showNativePrompt === 'function') {
            OneSignal.showNativePrompt().then(resolve).catch(reject);
          } else if (OneSignal && typeof OneSignal.registerForPushNotifications === 'function') {
            OneSignal.registerForPushNotifications().then(resolve).catch(reject);
          } else { reject(new Error('Prompt not available')); }
        });
      });
    }

    // Check if OneSignal is available, otherwise use browser notifications
    var useOneSignal = window.BenzinaOggi && BenzinaOggi.onesignalAppId && window.OneSignal;
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
      // Initialize OneSignal with better error handling
      var initOneSignal = function() {
        // If official plugin manages OS, or already initialized, skip
        if (window.BenzinaOggi && BenzinaOggi.onesignalOfficial) { return; }
        if (window.OneSignal && (window.OneSignal.initialized || window.OneSignal._initialized)) { return; }
        if (window.OneSignal && window.OneSignal.init && !window.OneSignal.initialized) {
          try {
            // Pre-register SW at /wp-content to avoid root 404s
            if ('serviceWorker' in navigator) {
              try {
                var swPlugin = (window.BenzinaOggi && BenzinaOggi.workerPath) || '/wp-content/plugins/benzinaoggi/public/OneSignalSDKWorker.js';
                var scopePlugin = '/wp-content/plugins/benzinaoggi/public/';
                navigator.serviceWorker.register(swPlugin, { scope: scopePlugin })
                  .then(function(reg){
                    console.log('Manual SW registered:', reg && reg.scope);
                    try { window.OneSignal = window.OneSignal || []; window.OneSignal.SERVICE_WORKER_REGISTRATION = reg; } catch(e){}
                  })
                .catch(function(err){ console.warn('Manual SW registration failed:', err); });
              } catch (e) { console.warn('Manual SW registration threw:', e); }
            }
            window.OneSignal.init({ 
              appId: BenzinaOggi.onesignalAppId,
              allowLocalhostAsSecureOrigin: true,
              autoRegister: true,
              notifyButton: {
                enable: false
              },
              // Prefer query route (root scope) for SW paths
              serviceWorkerPath: '/?onesignal_worker=1',
              serviceWorkerUpdaterPath: '/?onesignal_worker=1',
              serviceWorkerScope: '/',
              serviceWorkerParam: { scope: '/' },
              promptOptions: {
                slidedown: {
                  enabled: true,
                  autoPrompt: true,
                  timeDelay: 0,
                  pageViews: 1,
                  actionMessage: "Ricevi notifiche sui prezzi carburanti",
                  acceptButtonText: "Consenti",
                  cancelButtonText: "Non ora"
                }
              }
            });
            
            // Do NOT auto-prompt: prompt must be triggered by a user gesture
            window.OneSignal.initialized = true;
            console.log('OneSignal initialized successfully');
          } catch (err) {
            console.error('OneSignal initialization error:', err);
            return;
          }
        } else if (!window.OneSignal) {
          // OneSignal not loaded yet, try again
          setTimeout(initOneSignal, 500);
        }
      };
      
      // Start initialization
      initOneSignal();
      
      // Wait for OneSignal to be completely ready
      var waitForOneSignal = function() {
        if (window.OneSignal && window.OneSignal.isPushNotificationsEnabled && window.OneSignal.getNotificationPermission) {
          console.log('OneSignal is ready, checking permissions...');
          
          // Use a more reliable method to check permissions
          try {
            osIsEnabled().then(function(isEnabled) {
              console.log('Push notifications enabled:', isEnabled);
              if (!isEnabled) {
                // Show message to enable notifications
                var notifMsg = createEl('div', 'bo-notif-warning');
                notifMsg.innerHTML = '<p style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 10px 0; color: #856404;">🔔 <strong>Abilita le notifiche:</strong> Per ricevere avvisi sui prezzi, clicca su "Consenti" quando il browser te lo chiede.</p><button id="bo-enable-notifications" style="background: #007cba; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 5px;">Abilita Notifiche</button>';
                wrap.insertBefore(notifMsg, wrap.firstChild);
                
                var enableBtn = notifMsg.querySelector('#bo-enable-notifications');
                if (enableBtn) {
                  enableBtn.addEventListener('click', function() {
                    try {
                      osPrompt().then(function() {
                        console.log('Notification prompt shown');
                        notifMsg.style.display = 'none';
                      }).catch(function(err) {
                        console.error('Error showing notification prompt:', err);
                      });
                    } catch (err) {
                      console.error('Error requesting notifications:', err);
                    }
                  });
                }
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
      
      // Start checking after OneSignal is initialized
      setTimeout(waitForOneSignal, 2000);
      
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
      
      // Handle per-distributor checkbox (notify_distributor_<impiantoId>)
      try {
        var distCb = document.getElementById(distChkId);
        if (distCb && d.impiantoId) {
          distCb.addEventListener('change', function(){
            var tagName = 'notify_distributor_' + String(d.impiantoId);
            if (this.checked) {
              var self = this;
              osIsEnabled().then(function(isEnabled){
                if (!isEnabled) {
                  console.warn('Notifications not enabled; prompt handled by official plugin.');
                  self.checked = false;
                  alert('Abilita prima le notifiche dal pulsante OneSignal, poi riattiva questa opzione.');
                  return Promise.reject(new Error('not-enabled'));
                }
                if (window.OneSignal && window.OneSignal.sendTag) {
                  window.OneSignal.sendTag(tagName, '1');
                }
              }).catch(function(err){ console.warn('Distributor tag opt-in error', err); });
            } else {
              if (window.OneSignal && window.OneSignal.deleteTag) {
                window.OneSignal.deleteTag(tagName).catch(function(err){ console.warn('Distributor tag delete error', err); });
              }
            }
          });
        }
      } catch(e) { console.warn('Distributor checkbox setup error', e); }

      qsa('input[type=checkbox][data-fuel]', wrap).forEach(function(cb){
        cb.addEventListener('change', function(){
          var fuel = this.getAttribute('data-fuel');
          var tagKey = 'price_drop_'+fuel;
          var statusEl = this.parentNode.querySelector('.notif-status');
          var labelEl = this.parentNode.querySelector('.notif-label');
          
          console.log('Checkbox changed for fuel:', fuel, 'Element:', this);
          
          var setTag = function() {
            if (window.OneSignal && (window.OneSignal.sendTags || window.OneSignal.sendTag)) {
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
                
                // Check if notifications are enabled, if not request permission
                osIsEnabled().then(function(isEnabled) {
                  if (!isEnabled) {
                    alert('Abilita prima le notifiche dal pulsante OneSignal.');
                    throw new Error('not-enabled');
                  }
                }).then(function() {
                  // Proceed with setting tags
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
                  // Add combined distributor+fuel tag so we can target that exact pair
                  try {
                    if (d && d.impiantoId) {
                      var fuelNorm = fuel.toLowerCase().replace(/\s+/g, '_');
                      var combo = 'notify_distributor_' + String(d.impiantoId) + '_' + fuelNorm;
                      tags[combo] = '1';
                    }
                  } catch(_){}
                  
                  console.log('Sending tags for fuel:', fuel, 'Tags:', tags);
                  
                  // Use sendTags if available, otherwise fallback to individual sendTag calls
                  if (window.OneSignal.sendTags) {
                    window.OneSignal.sendTags(tags).then(function() {
                      console.log('Tags set successfully for fuel:', fuel);
                      if(statusEl) {
                        statusEl.textContent = '✓ Attivato per ' + fuel;
                        statusEl.style.display = 'inline';
                        statusEl.style.color = '#28a745';
                      }
                    }).catch(function(err) {
                      console.error('Error setting tags for fuel:', fuel, err);
                      if(statusEl) {
                        statusEl.textContent = '✗ Errore: ' + (err.message || 'Unknown error');
                        statusEl.style.display = 'inline';
                        statusEl.style.color = '#dc3545';
                      }
                    });
                  } else {
                    // Fallback to individual sendTag calls
                    var promises = [];
                    for (var key in tags) {
                      if (tags.hasOwnProperty(key)) {
                        promises.push(window.OneSignal.sendTag(key, tags[key]));
                      }
                    }
                    Promise.all(promises).then(function() {
                      console.log('Tags set successfully for fuel:', fuel);
                      if(statusEl) {
                        statusEl.textContent = '✓ Attivato per ' + fuel;
                        statusEl.style.display = 'inline';
                        statusEl.style.color = '#28a745';
                      }
                    }).catch(function(err) {
                      console.error('Error setting tags for fuel:', fuel, err);
                      if(statusEl) {
                        statusEl.textContent = '✗ Errore: ' + (err.message || 'Unknown error');
                        statusEl.style.display = 'inline';
                        statusEl.style.color = '#dc3545';
                      }
                    });
                  }
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
            if (window.OneSignal && window.OneSignal.deleteTag) {
              try {
                // Delete specific fuel notification tag
                var tagToDelete = 'notify_' + fuel.toLowerCase().replace(/\s+/g, '_');
                window.OneSignal.deleteTag(tagToDelete).then(function() {
                  console.log('Tag deleted successfully for fuel:', fuel);
                  if(statusEl) statusEl.style.display = 'none';
                }).catch(function(err) {
                  console.error('Error deleting tag for fuel:', fuel, err);
                  if(statusEl) {
                    statusEl.textContent = '✗ Errore';
                    statusEl.style.display = 'inline';
                    statusEl.style.color = '#dc3545';
                  }
                });
                // Delete combined distributor+fuel tag too
                try {
                  if (d && d.impiantoId) {
                    var fuelNorm2 = fuel.toLowerCase().replace(/\s+/g, '_');
                    var comboDel = 'notify_distributor_' + String(d.impiantoId) + '_' + fuelNorm2;
                    window.OneSignal.deleteTag(comboDel).catch(function(e){ console.warn('Delete combo tag error', e); });
                  }
                } catch(__){}
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


