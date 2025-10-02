(function(){
  'use strict';
  
  // Utility functions
  function qs(sel, el){ return (el||document).querySelector(sel); }
  function createEl(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
    return null;
  }
  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days*24*60*60*1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }
  
  // Check if user has already been prompted
  function hasBeenPrompted() {
    return getCookie('bo_notification_prompted') === '1' || localStorage.getItem('bo_notification_prompted') === '1';
  }
  
  // Mark user as prompted
  function markAsPrompted() {
    setCookie('bo_notification_prompted', '1', 30); // 30 days
    try { localStorage.setItem('bo_notification_prompted', '1'); } catch(e) {}
  }
  
  // Check if notifications are enabled
  function areNotificationsEnabled() {
    try {
      if (window.OneSignal && OneSignal.Notifications) {
        return OneSignal.Notifications.permission === 'granted';
      }
      return window.Notification && Notification.permission === 'granted';
    } catch(e) {
      return false;
    }
  }
  
  // Get external ID for subscriptions
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
  
  // Request notification permission
  function requestNotificationPermission() {
    return new Promise(function(resolve, reject) {
      try {
        if (window.OneSignal && OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
          OneSignal.Notifications.requestPermission().then(resolve).catch(reject);
        } else if (window.Notification && Notification.requestPermission) {
          Notification.requestPermission().then(resolve).catch(reject);
        } else {
          reject(new Error('Notifications not supported'));
        }
      } catch(e) {
        reject(e);
      }
    });
  }
  
  // Subscribe to fuel type notifications
  function subscribeToFuelType(fuelType, impiantoId) {
    var apiBase = (window.BenzinaOggi && BenzinaOggi.apiBase) || '';
    var externalId = getExternalId();
    
    if (!apiBase || !externalId) {
      console.warn('Cannot subscribe: missing API base or external ID');
      return Promise.reject(new Error('Configuration missing'));
    }
    
    var payload = {
      externalId: externalId,
      impiantoId: impiantoId,
      fuelType: fuelType
    };
    
    return fetch(apiBase + '/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); });
  }
  
  // Create Welcome Modal
  function createWelcomeModal() {
    if (hasBeenPrompted() || areNotificationsEnabled()) {
      return null;
    }
    
    var modal = createEl('div', 'bo-welcome-modal');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    var content = createEl('div', 'bo-modal-content');
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      text-align: center;
      position: relative;
    `;
    
    content.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">⛽🔔</div>
      <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 24px;">
        Non perdere mai un ribasso!
      </h2>
      <p style="margin: 0 0 24px 0; color: #666; font-size: 16px; line-height: 1.5;">
        Ricevi notifiche istantanee quando i prezzi dei carburanti scendono nei distributori che ti interessano.
      </p>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1a1a1a;">✨ Vantaggi:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #666;">
          <li style="margin-bottom: 8px;">🎯 Notifiche solo per i ribassi</li>
          <li style="margin-bottom: 8px;">⚡ Avvisi in tempo reale</li>
          <li style="margin-bottom: 8px;">🎛️ Scegli distributori e carburanti</li>
          <li>🔒 Privacy garantita</li>
        </ul>
      </div>
      
      <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
        <button id="bo-modal-enable" style="
          background: #007cba;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          flex: 1;
          min-width: 140px;
        ">
          🔔 Abilita Notifiche
        </button>
        <button id="bo-modal-later" style="
          background: #f1f3f4;
          color: #5f6368;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
          flex: 1;
          min-width: 140px;
        ">
          Più tardi
        </button>
      </div>
      
      <p style="margin: 20px 0 0 0; font-size: 12px; color: #999;">
        Puoi modificare le preferenze in qualsiasi momento
      </p>
    `;
    
    modal.appendChild(content);
    
    // Event handlers
    var enableBtn = content.querySelector('#bo-modal-enable');
    var laterBtn = content.querySelector('#bo-modal-later');
    
    enableBtn.addEventListener('click', function() {
      enableBtn.textContent = '⏳ Abilitazione...';
      enableBtn.disabled = true;
      
      requestNotificationPermission().then(function(permission) {
        if (permission === 'granted') {
          markAsPrompted();
          modal.style.display = 'none';
          showFloatingWidget();
          // Show success message
          showSuccessMessage('🎉 Notifiche abilitate! Ora puoi selezionare i distributori che ti interessano.');
        } else {
          enableBtn.textContent = '❌ Autorizzazione negata';
          enableBtn.style.background = '#dc3545';
          setTimeout(function() {
            modal.style.display = 'none';
            markAsPrompted();
          }, 2000);
        }
      }).catch(function(err) {
        console.error('Permission request failed:', err);
        enableBtn.textContent = '❌ Errore';
        enableBtn.style.background = '#dc3545';
        setTimeout(function() {
          modal.style.display = 'none';
          markAsPrompted();
        }, 2000);
      });
    });
    
    laterBtn.addEventListener('click', function() {
      modal.style.display = 'none';
      markAsPrompted();
      // Show floating widget as reminder
      setTimeout(showFloatingWidget, 5000);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
        markAsPrompted();
        setTimeout(showFloatingWidget, 5000);
      }
    });
    
    return modal;
  }
  
  // Create Floating Widget
  function createFloatingWidget() {
    if (areNotificationsEnabled()) {
      return null;
    }
    
    var widget = createEl('div', 'bo-floating-widget');
    widget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #007cba, #005a8b);
      color: white;
      padding: 16px 20px;
      border-radius: 50px;
      box-shadow: 0 4px 20px rgba(0,124,186,0.3);
      cursor: pointer;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
      max-width: 280px;
      animation: bo-float-in 0.5s ease-out;
    `;
    
    // Add animation keyframes
    if (!document.querySelector('#bo-float-styles')) {
      var styles = createEl('style');
      styles.id = 'bo-float-styles';
      styles.textContent = `
        @keyframes bo-float-in {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .bo-floating-widget:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(0,124,186,0.4);
        }
        @media (max-width: 768px) {
          .bo-floating-widget {
            bottom: 80px;
            right: 16px;
            left: 16px;
            max-width: none;
            border-radius: 12px;
            justify-content: center;
          }
        }
      `;
      document.head.appendChild(styles);
    }
    
    widget.innerHTML = `
      <span style="font-size: 18px;">🔔</span>
      <span>Abilita notifiche ribassi</span>
      <span style="font-size: 12px; opacity: 0.8; margin-left: 4px;">⚡</span>
    `;
    
    // Click handler
    widget.addEventListener('click', function() {
      widget.style.transform = 'scale(0.95)';
      setTimeout(function() {
        widget.style.transform = '';
      }, 150);
      
      requestNotificationPermission().then(function(permission) {
        if (permission === 'granted') {
          widget.style.display = 'none';
          showSuccessMessage('🎉 Notifiche abilitate! Seleziona i distributori nelle pagine dettaglio.');
        } else {
          widget.innerHTML = '<span>❌</span><span>Autorizzazione negata</span>';
          widget.style.background = '#dc3545';
          setTimeout(function() {
            widget.style.display = 'none';
          }, 3000);
        }
      }).catch(function(err) {
        console.error('Permission request failed:', err);
        widget.innerHTML = '<span>❌</span><span>Errore</span>';
        widget.style.background = '#dc3545';
        setTimeout(function() {
          widget.style.display = 'none';
        }, 3000);
      });
    });
    
    // Auto-hide after 30 seconds
    setTimeout(function() {
      if (widget.parentNode) {
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(100px)';
        setTimeout(function() {
          if (widget.parentNode) {
            widget.parentNode.removeChild(widget);
          }
        }, 300);
      }
    }, 30000);
    
    return widget;
  }
  
  // Show success message
  function showSuccessMessage(message) {
    var toast = createEl('div', 'bo-success-toast');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(40,167,69,0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 320px;
      animation: bo-toast-in 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }
  
  // Show floating widget
  function showFloatingWidget() {
    if (areNotificationsEnabled() || document.querySelector('.bo-floating-widget')) {
      return;
    }
    
    var widget = createFloatingWidget();
    if (widget) {
      document.body.appendChild(widget);
    }
  }
  
  // Enhanced distributor page integration
  function enhanceDistributorPage() {
    var distributorWrap = document.querySelector('#bo_distributor_detail');
    if (!distributorWrap) return;
    
    // Add contextual banner if notifications not enabled
    if (!areNotificationsEnabled()) {
      var banner = createEl('div', 'bo-distributor-banner');
      banner.style.cssText = `
        background: linear-gradient(135deg, #e3f2fd, #bbdefb);
        border: 1px solid #2196f3;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      banner.innerHTML = `
        <div style="font-size: 24px;">🔔</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #1565c0; margin-bottom: 4px;">
            Ricevi notifiche sui ribassi
          </div>
          <div style="color: #1976d2; font-size: 14px;">
            Abilita le notifiche per essere avvisato quando i prezzi scendono in questo distributore
          </div>
        </div>
        <button style="
          background: #2196f3;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        ">
          Abilita ora
        </button>
      `;
      
      var enableBtn = banner.querySelector('button');
      enableBtn.addEventListener('click', function() {
        enableBtn.textContent = 'Abilitazione...';
        enableBtn.disabled = true;
        
        requestNotificationPermission().then(function(permission) {
          if (permission === 'granted') {
            banner.style.display = 'none';
            showSuccessMessage('🎉 Perfetto! Ora seleziona i carburanti per cui ricevere notifiche.');
          } else {
            enableBtn.textContent = 'Autorizzazione negata';
            enableBtn.style.background = '#dc3545';
          }
        }).catch(function(err) {
          enableBtn.textContent = 'Errore';
          enableBtn.style.background = '#dc3545';
        });
      });
      
      // Insert banner at the top of distributor detail
      distributorWrap.insertBefore(banner, distributorWrap.firstChild);
    }
  }
  
  // Initialize engagement system
  function init() {
    // Wait for DOM and OneSignal to be ready
    setTimeout(function() {
      var isDistributorPage = !!document.querySelector('#bo_distributor_detail');
      var isHomePage = !!document.querySelector('#bo_map');
      
      // Show welcome modal on first visit (not on distributor pages)
      if (!isDistributorPage && !hasBeenPrompted() && !areNotificationsEnabled()) {
        setTimeout(function() {
          var modal = createWelcomeModal();
          if (modal) {
            document.body.appendChild(modal);
          }
        }, 2000); // Show after 2 seconds
      }
      
      // Show floating widget on subsequent visits or after modal dismissal
      if (!areNotificationsEnabled()) {
        setTimeout(function() {
          if (!document.querySelector('.bo-welcome-modal')) {
            showFloatingWidget();
          }
        }, hasBeenPrompted() ? 5000 : 15000);
      }
      
      // Enhance distributor pages
      if (isDistributorPage) {
        enhanceDistributorPage();
      }
      
    }, 1000);
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
