import { useState, useEffect } from 'react';
import { getFCMToken, onForegroundMessage } from '@/src/lib/firebase';

export const useFCM = () => {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
    // Check current permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        const fcmToken = await getFCMToken();
        setToken(fcmToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const getToken = async (): Promise<string | null> => {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return null;
    }
    
    const fcmToken = await getFCMToken();
    setToken(fcmToken);
    return fcmToken;
  };

  const onMessage = (callback: (payload: any) => void) => {
    onForegroundMessage(callback);
  };

  return {
    token,
    permission,
    isSupported,
    requestPermission,
    getToken,
    onMessage,
  };
};
