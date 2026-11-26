import { mountWorkspaceReactApp } from './app/mount';

mountWorkspaceReactApp();

const isProd = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD;

if (
  isProd &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
