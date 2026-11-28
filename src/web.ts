import { mountWorkspaceReactApp } from './app/mount';
import { triggerSafeChunkReload } from './app/components/WorkspaceSkeleton';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerSafeChunkReload();
  });
}

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
