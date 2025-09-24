'use client';

import { useEffect, useState } from 'react';

interface OneSignalNotificationProps {
  appId: string;
  onSubscriptionChange?: (isSubscribed: boolean) => void;
}

export default function OneSignalNotification({ 
  appId, 
  onSubscriptionChange 
}: OneSignalNotificationProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Carica OneSignal SDK
    const loadOneSignal = async () => {
      try {
        // Carica lo script OneSignal
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
          // Inizializza OneSignal
          window.OneSignal = window.OneSignal || [];
          window.OneSignal.push(function() {
            window.OneSignal.init({
              appId: appId,
              autoRegister: false, // Controllo manuale
              notifyButton: {
                enable: true,
                showCredit: false
              },
              promptOptions: {
                slidedown: {
                  enabled: true,
                  autoPrompt: false, // Controllo manuale
                  timeDelay: 0,
                  pageViews: 0,
                  actionMessage: "⛽ Ricevi notifiche sui prezzi carburante più bassi!",
                  acceptButtonText: "Consenti",
                  cancelButtonText: "Non ora"
                }
              }
            });

            // Verifica stato sottoscrizione
            window.OneSignal.getUserId().then((userId: string) => {
              setIsSubscribed(!!userId);
              setIsLoading(false);
              onSubscriptionChange?.(!!userId);
            });

            // Listener per cambiamenti sottoscrizione
            window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
              setIsSubscribed(isSubscribed);
              onSubscriptionChange?.(isSubscribed);
            });
          });
        };
      } catch (error) {
        console.error('Errore caricamento OneSignal:', error);
        setIsLoading(false);
      }
    };

    loadOneSignal();
  }, [appId, onSubscriptionChange]);

  const handleSubscribe = async () => {
    try {
      if (window.OneSignal) {
        await window.OneSignal.showNativePrompt();
      }
    } catch (error) {
      console.error('Errore sottoscrizione:', error);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      if (window.OneSignal) {
        await window.OneSignal.setSubscription(false);
      }
    } catch (error) {
      console.error('Errore disiscrizione:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Caricamento notifiche...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <div className="text-center">
        <div className="text-4xl mb-4">⛽</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Notifiche Prezzi Carburante
        </h3>
        <p className="text-gray-600 mb-4">
          {isSubscribed 
            ? "✅ Sei iscritto alle notifiche sui prezzi carburante"
            : "Ricevi notifiche quando i prezzi scendono nella tua zona"
          }
        </p>
        
        {!isSubscribed ? (
          <button
            onClick={handleSubscribe}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            🔔 Attiva Notifiche
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-green-600 font-medium">
              ✅ Notifiche Attive
            </div>
            <button
              onClick={handleUnsubscribe}
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Disattiva Notifiche
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Estendi il tipo Window per TypeScript
declare global {
  interface Window {
    OneSignal: any;
  }
}
