// Fix per OneSignal Service Worker 404
// Questo file deve essere caricato su WordPress

// 1. Verifica se OneSignal è configurato correttamente
if (typeof OneSignal !== 'undefined') {
  console.log('OneSignal SDK caricato correttamente');
  
  // 2. Configura OneSignal con il Service Worker corretto
  OneSignal.init({
    appId: "fbcac040-1f81-466f-bf58-238a594af041",
    // Usa il Service Worker di OneSignal CDN invece di quello locale
    serviceWorkerPath: "https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js",
    // Oppure disabilita temporaneamente
    // autoRegister: false
  });
} else {
  console.error('OneSignal SDK non trovato');
}

// 3. Alternativa: Carica OneSignal da CDN con configurazione corretta
function loadOneSignalCorrectly() {
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
  script.async = true;
  script.onload = function() {
    OneSignal.init({
      appId: "fbcac040-1f81-466f-bf58-238a594af041",
      // Usa il Service Worker di OneSignal CDN
      serviceWorkerPath: "https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js",
      // Configurazione per evitare errori 404
      allowLocalhostAsSecureOrigin: true,
      autoRegister: true,
      notifyButton: {
        enable: true,
        showCredit: false
      }
    });
  };
  document.head.appendChild(script);
}

// 4. Soluzione temporanea: Disabilita OneSignal completamente
function disableOneSignal() {
  // Rimuovi tutti i listener OneSignal
  if (typeof OneSignal !== 'undefined') {
    OneSignal.clearEventListeners();
  }
  
  // Rimuovi il Service Worker se registrato
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        if (registration.scope.includes('OneSignal')) {
          registration.unregister();
        }
      }
    });
  }
}

// 5. Debug: Verifica lo stato del Service Worker
function debugServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      console.log('Service Workers registrati:', registrations.length);
      registrations.forEach(function(registration) {
        console.log('Scope:', registration.scope);
        console.log('Script URL:', registration.active?.scriptURL);
      });
    });
  }
}

// Esegui il debug
debugServiceWorker();
