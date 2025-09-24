'use client';

import { useState } from 'react';
import OneSignalNotification from '@/components/OneSignalNotification';
import { useOneSignal } from '@/hooks/useOneSignal';

export default function NotificationsPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState(false);
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "fbcac040-1f81-466f-bf58-238a594af041";
  
  const { user, isLoading, error, subscribe, unsubscribe } = useOneSignal(appId);

  const handleSubscriptionChange = (isSubscribed: boolean) => {
    setSubscriptionStatus(isSubscribed);
  };

  const testNotification = async () => {
    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {})
        },
        body: JSON.stringify({
          fuelType: 'Benzina',
          distributorId: '1001',
          oldPrice: 1.500,
          newPrice: 1.450,
          distributorName: 'Test Distributore'
        })
      });

      const result = await response.json();
      console.log('Test notification result:', result);
    } catch (error) {
      console.error('Errore test notifica:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🔔 Notifiche Prezzi Carburante
          </h1>
          <p className="text-gray-600">
            Gestisci le tue notifiche per i cali prezzi carburante
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Componente OneSignal */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Stato Notifiche</h2>
            <OneSignalNotification 
              appId={appId}
              onSubscriptionChange={handleSubscriptionChange}
            />
          </div>

          {/* Hook OneSignal */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Controlli Avanzati</h2>
            <div className="bg-white rounded-lg shadow-md p-6">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Caricamento...</span>
                </div>
              ) : error ? (
                <div className="text-red-600">
                  ❌ Errore: {error}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Stato Sottoscrizione:</span>
                    <span className={`font-medium ${user.isSubscribed ? 'text-green-600' : 'text-red-600'}`}>
                      {user.isSubscribed ? '✅ Attiva' : '❌ Disattiva'}
                    </span>
                  </div>
                  
                  {user.userId && (
                    <div className="text-sm text-gray-600">
                      User ID: {user.userId}
                    </div>
                  )}

                  <div className="space-y-2">
                    {!user.isSubscribed ? (
                      <button
                        onClick={subscribe}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        🔔 Attiva Notifiche
                      </button>
                    ) : (
                      <button
                        onClick={unsubscribe}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        🚫 Disattiva Notifiche
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Test Notifiche */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Test Notifiche</h2>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-600 mb-4">
              Invia una notifica di test per verificare il funzionamento
            </p>
            <button
              onClick={testNotification}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              📤 Invia Notifica Test
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
          <div className="bg-gray-100 rounded-lg p-4">
            <pre className="text-sm text-gray-700">
              {JSON.stringify({
                appId,
                user,
                subscriptionStatus,
                isLoading,
                error
              }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
