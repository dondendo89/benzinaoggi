'use client';

import { useState, useEffect } from 'react';
import { useFCM } from '@/src/hooks/useFCM';

export default function TestNotifications() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { token, permission, isSupported, requestPermission, getToken, onMessage } = useFCM();

  const testNotification = async () => {
    setLoading(true);
    setResult('');
    
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          impiantoId: 12345,
          distributorId: 1,
          fuelType: 'Benzina',
          distributorName: 'Test Distributore',
          oldPrice: 1.850,
          newPrice: 1.750,
          direction: 'down'
        })
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testPreferences = async () => {
    setLoading(true);
    setResult('');
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user-' + Date.now(),
          preferences: {
            enabled: true,
            type: 'fuel',
            identifier: 'Benzina',
            timestamp: new Date().toISOString()
          }
        })
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testBrowserNotification = () => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Test Notifica', {
          body: 'Questa è una notifica di test per il sistema BenzinaOggi',
          icon: '/favicon.ico'
        });
        setResult('Notifica inviata!');
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Test Notifica', {
              body: 'Questa è una notifica di test per il sistema BenzinaOggi',
              icon: '/favicon.ico'
            });
            setResult('Notifica inviata!');
          } else {
            setResult('Permessi notifiche negati');
          }
        });
      } else {
        setResult('Permessi notifiche negati');
      }
    } else {
      setResult('Browser non supporta le notifiche');
    }
  };

  const testFCM = async () => {
    setLoading(true);
    setResult('');
    
    try {
      if (!isSupported) {
        setResult('FCM non supportato in questo browser');
        return;
      }
      
      const granted = await requestPermission();
      if (!granted) {
        setResult('Permessi notifiche negati');
        return;
      }
      
      const fcmToken = await getToken();
      if (fcmToken) {
        setResult(`FCM Token ottenuto: ${fcmToken.substring(0, 50)}...`);
      } else {
        setResult('Errore nell\'ottenere il token FCM');
      }
    } catch (error) {
      setResult(`Errore FCM: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testFCMSubscription = async () => {
    setLoading(true);
    setResult('');
    
    try {
      const fcmToken = await getToken();
      if (!fcmToken) {
        setResult('Token FCM non disponibile');
        return;
      }
      
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: fcmToken,
          topic: 'price_drops'
        })
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Listen for FCM messages
  useEffect(() => {
    onMessage((payload) => {
      console.log('FCM message received:', payload);
      setResult(`FCM Message: ${JSON.stringify(payload, null, 2)}`);
    });
  }, [onMessage]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Test Sistema Notifiche BenzinaOggi</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Test API Notifiche</h2>
        <button 
          onClick={testNotification} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: '#007cba',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Caricamento...' : 'Test Notifica API'}
        </button>
        
        <button 
          onClick={testPreferences} 
          disabled={loading}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Caricamento...' : 'Test Preferenze API'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Notifiche Browser</h2>
        <button 
          onClick={testBrowserNotification}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Test Notifica Browser
        </button>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          Stato permessi: <strong>{typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'Non supportato'}</strong>
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Test Firebase Cloud Messaging (FCM)</h2>
        <button 
          onClick={testFCM}
          disabled={loading || !isSupported}
          style={{ 
            padding: '10px 20px',
            backgroundColor: isSupported ? '#dc3545' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSupported && !loading ? 'pointer' : 'not-allowed',
            marginRight: '10px'
          }}
        >
          {loading ? 'Caricamento...' : 'Test FCM Token'}
        </button>
        
        <button 
          onClick={testFCMSubscription}
          disabled={loading || !token}
          style={{ 
            padding: '10px 20px',
            backgroundColor: token ? '#17a2b8' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: token && !loading ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? 'Caricamento...' : 'Test Sottoscrizione Topic'}
        </button>
        
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <p><strong>FCM Supportato:</strong> {isSupported ? 'Sì' : 'No'}</p>
          <p><strong>Permessi:</strong> {permission}</p>
          <p><strong>Token FCM:</strong> {token ? `${token.substring(0, 30)}...` : 'Non disponibile'}</p>
        </div>
      </div>

      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}>
          <h3>Risultato:</h3>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            fontSize: '12px',
            backgroundColor: '#fff',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}>
            {result}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h3>Come funziona il sistema FCM:</h3>
        <ol>
          <li><strong>Firebase Cloud Messaging:</strong> Sistema di notifiche push professionale di Google</li>
          <li><strong>Service Worker:</strong> Gestisce notifiche in background anche quando l'app è chiusa</li>
          <li><strong>FCM Topics:</strong> Sottoscrizione a topic specifici (es. "price_drops", "fuel_benzina")</li>
          <li><strong>API REST FCM:</strong> Invia notifiche usando l'API REST di Firebase (compatibile con Vercel)</li>
          <li><strong>Targeting Avanzato:</strong> Notifiche specifiche per distributore e tipo di carburante</li>
          <li><strong>Cron WordPress:</strong> Controlla variazioni ogni ora e invia notifiche FCM</li>
        </ol>
        
        <h4 style={{ marginTop: '20px' }}>Vantaggi FCM:</h4>
        <ul>
          <li>✅ Funziona su Vercel (API REST)</li>
          <li>✅ Notifiche push reali anche con app chiusa</li>
          <li>✅ Targeting preciso per utenti</li>
          <li>✅ Gratuito fino a 100M messaggi/mese</li>
          <li>✅ Supporto Android, iOS, Web</li>
        </ul>
      </div>
    </div>
  );
}
