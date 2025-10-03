'use client';

import { useEffect, useState } from 'react';
import { useOneSignal } from '@/hooks/useOneSignal';

export default function NotificationsPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState(false);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ impiantoId: number; fuelType: string }>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
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

  // Deriva externalId dal localStorage usato nel frontend WordPress
  useEffect(() => {
    try {
      const v = localStorage.getItem('bo_ext_id');
      if (v) setExternalId(v);
    } catch {}
  }, []);

  // Carica sottoscrizioni attive per externalId
  useEffect(() => {
    const load = async () => {
      if (!externalId) return;
      setLoadingList(true);
      try {
        const url = `/api/subscriptions?externalId=${encodeURIComponent(externalId)}`;
        const r = await fetch(url);
        const j = await r.json();
        if (j && j.ok && Array.isArray(j.items)) setItems(j.items);
      } catch {}
      setLoadingList(false);
    };
    load();
  }, [externalId]);

  const removeSubscription = async (impiantoId: number, fuelType: string) => {
    if (!externalId) return;
    const key = `${impiantoId}|${fuelType}`;
    setRemovingKey(key);
    try {
      const r = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', externalId, impiantoId, fuelType })
      });
      const j = await r.json().catch(() => ({}));
      if (j && j.ok) {
        setItems(prev => prev.filter(it => !(it.impiantoId === impiantoId && it.fuelType === fuelType)));
      }
    } catch {}
    setRemovingKey(null);
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

        <div className="grid md:grid-cols-1 gap-8">
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

      {/* Elenco sottoscrizioni attive per externalId */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Le tue sottoscrizioni</h2>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-700 mb-2">External ID: <code>{externalId || '—'}</code></div>
          {loadingList ? (
            <div className="text-gray-500">Caricamento…</div>
          ) : items.length === 0 ? (
            <div className="text-gray-500">Nessuna sottoscrizione attiva.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((it, idx) => {
                const key = `${it.impiantoId}|${it.fuelType}`;
                const isRemoving = removingKey === key;
                return (
                  <li key={idx} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                    <div>
                      Impianto <strong>{it.impiantoId}</strong> · <span>{it.fuelType}</span>
                    </div>
                    <button
                      onClick={() => removeSubscription(it.impiantoId, it.fuelType)}
                      disabled={isRemoving}
                      className={`text-white px-3 py-1 rounded ${isRemoving ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {isRemoving ? 'Rimuovo…' : 'Disattiva'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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

