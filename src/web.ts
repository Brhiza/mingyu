import { initAiChat } from './web-ai';
import { mountWorkspaceReactApp } from './app/mount';

const { paneElement, clearReading, setAiPrompt } = initAiChat();

mountWorkspaceReactApp({
  sharedAiPane: paneElement,
  setAiPrompt,
  clearReading,
});

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
