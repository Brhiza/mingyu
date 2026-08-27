import { Capacitor } from '@capacitor/core';

export function registerServiceWorker() {
  if (Capacitor.isNativePlatform() || !import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service Worker 注册失败', error);
    });
  });
}
