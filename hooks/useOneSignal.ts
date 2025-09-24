'use client';

import { useEffect, useState } from 'react';

interface OneSignalUser {
  userId: string | null;
  isSubscribed: boolean;
}

export function useOneSignal(appId: string) {
  const [user, setUser] = useState<OneSignalUser>({
    userId: null,
    isSubscribed: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeOneSignal = async () => {
      try {
        // Carica OneSignal SDK se non già presente
        if (!window.OneSignal) {
          const script = document.createElement('script');
          script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
          script.async = true;
          document.head.appendChild(script);

          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        // Inizializza OneSignal
        window.OneSignal = window.OneSignal || [];
        window.OneSignal.push(function() {
          window.OneSignal.init({
            appId: appId,
            autoRegister: false,
            notifyButton: {
              enable: true,
              showCredit: false
            }
          });

          // Verifica stato utente
          window.OneSignal.getUserId().then((userId: string) => {
            setUser({
              userId: userId,
              isSubscribed: !!userId
            });
            setIsLoading(false);
          });

          // Listener per cambiamenti
          window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
            window.OneSignal.getUserId().then((userId: string) => {
              setUser({
                userId: userId,
                isSubscribed: isSubscribed
              });
            });
          });
        });

      } catch (err) {
        console.error('Errore inizializzazione OneSignal:', err);
        setError('Errore caricamento OneSignal');
        setIsLoading(false);
      }
    };

    initializeOneSignal();
  }, [appId]);

  const subscribe = async () => {
    try {
      if (window.OneSignal) {
        await window.OneSignal.showNativePrompt();
      }
    } catch (err) {
      console.error('Errore sottoscrizione:', err);
      setError('Errore sottoscrizione');
    }
  };

  const unsubscribe = async () => {
    try {
      if (window.OneSignal) {
        await window.OneSignal.setSubscription(false);
      }
    } catch (err) {
      console.error('Errore disiscrizione:', err);
      setError('Errore disiscrizione');
    }
  };

  const sendTestNotification = async () => {
    try {
      // Invia notifica di test
      if (window.OneSignal) {
        await window.OneSignal.showNativePrompt();
      }
    } catch (err) {
      console.error('Errore invio test:', err);
      setError('Errore invio test');
    }
  };

  const sendTags = async (
    tags: Record<string, string | number | boolean>
  ) => {
    try {
      if (window.OneSignal) {
        await window.OneSignal.sendTags(tags);
      }
    } catch (err) {
      console.error('Errore invio tags:', err);
      setError('Errore invio tags');
    }
  };

  const sendTag = async (key: string, value: string | number | boolean) => {
    return sendTags({ [key]: value });
  };

  return {
    user,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    sendTags,
    sendTag
  };
}

declare global {
  interface Window {
    OneSignal: any;
  }
}

