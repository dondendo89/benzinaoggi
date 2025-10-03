'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOneSignal } from '@/hooks/useOneSignal';

export default function NotificationsPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState(false);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ impiantoId: number; fuelType: string }>>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "fbcac040-1f81-466f-bf58-238a594af041";
  
  const { user, isLoading, error, subscribe, unsubscribe } = useOneSignal(appId);

  const [derivedSubscribed, setDerivedSubscribed] = useState<boolean>(false);
  const effectiveSubscribed = useMemo(() => {
    return Boolean(user?.isSubscribed || derivedSubscribed);
  }, [user?.isSubscribed, derivedSubscribed]);

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
      // 1) URL param ha priorità
      const url = new URL(window.location.href);
      const qp = url.searchParams.get('externalId') || url.searchParams.get('ext') || '';
      const v = (qp && qp.trim()) || localStorage.getItem('bo_ext_id');
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

  // Aggiorna stato sottoscrizione utilizzando OneSignal v16 quando disponibile
  useEffect(() => {
    const check = async () => {
      try {
        const w = window as any;
        if (!w.OneSignal) { setDerivedSubscribed(false); return; }
        // v16: permission + subscription id
        let perm: any = w.OneSignal?.Notifications?.permission;
        if (typeof perm === 'function') {
          try { perm = await w.OneSignal.Notifications.permission(); } catch {}
        }
        if (perm !== 'granted') { setDerivedSubscribed(false); return; }
        const sid = await (w.OneSignal?.User?.PushSubscription?.getId?.());
        setDerivedSubscribed(Boolean(sid));
      } catch {
        setDerivedSubscribed(false);
      }
    };
    check();
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, []);

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
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">Stato Sottoscrizione</div>
                    <div className={`px-2.5 py-1 rounded text-xs font-semibold ${effectiveSubscribed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {effectiveSubscribed ? '✅ Attive' : '❌ Disattive'}
                    </div>
                  </div>

                  {user.userId && (
                    <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1">User ID: {user.userId}</div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {!effectiveSubscribed ? (
                      <button
                        onClick={subscribe}
                        className="col-span-2 md:col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        🔔 Attiva Notifiche
                      </button>
                    ) : (
                      <button
                        onClick={unsubscribe}
                        className="col-span-2 md:col-span-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        🚫 Disattiva Notifiche
                      </button>
                    )}
                    <button
                      onClick={testNotification}
                      className="col-span-2 md:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      📤 Invia Notifica Test
                    </button>
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
          <div className="text-sm text-gray-700 mb-3 flex items-center justify-between">
            <span>External ID: <code>{externalId || '—'}</code></span>
            {externalId && (
              <button
                onClick={() => { try { navigator.clipboard.writeText(externalId); } catch {} }}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border border-gray-200"
              >Copia</button>
            )}
          </div>
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

