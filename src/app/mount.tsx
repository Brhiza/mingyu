import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkspaceApp, type WorkspaceAppBridge } from './WorkspaceApp';
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary';

let mountedRoot: Root | null = null;

export function mountWorkspaceReactApp(
  bridge: WorkspaceAppBridge & { sharedAiPane?: HTMLElement | null },
): void {
  const mountRoot = document.querySelector<HTMLElement>('#v2-workspace-root');
  if (!mountRoot) return;

  const sharedAiPane =
    bridge.sharedAiPane ?? document.querySelector<HTMLElement>('.workspace-pane-ai');
  const hostOverlay = document.createElement('div');
  hostOverlay.hidden = true;
  if (sharedAiPane && mountRoot.contains(sharedAiPane)) {
    hostOverlay.appendChild(sharedAiPane);
  }

  if (mountedRoot) {
    mountedRoot.unmount();
    mountedRoot = null;
  }

  mountRoot.replaceChildren();
  mountedRoot = createRoot(mountRoot);
  mountedRoot.render(
    <React.StrictMode>
      <WorkspaceErrorBoundary>
        <WorkspaceApp bridge={bridge} sharedAiPane={sharedAiPane} />
      </WorkspaceErrorBoundary>
    </React.StrictMode>,
  );
}
