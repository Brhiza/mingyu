import * as React from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { WorkspaceApp, type WorkspaceAppBridge } from './WorkspaceApp';
import {
  SingleChartAiPanel,
  type SingleChartAiHandle,
  type SingleChartFollowUpItem,
} from './components/SingleChartAiPanel';
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary';

let mountedRoot: Root | null = null;

function WorkspaceRootHost() {
  const aiPanelRef = React.useRef<SingleChartAiHandle | null>(null);
  const pendingPromptRef = React.useRef<{
    text: string;
    followUps?: SingleChartFollowUpItem[];
  } | null>(null);

  const aiHostEl = React.useMemo(() => {
    const el = document.createElement('div');
    el.style.display = 'contents';
    return el;
  }, []);

  const handlePanelRef = React.useCallback((instance: SingleChartAiHandle | null) => {
    aiPanelRef.current = instance;
    if (instance && pendingPromptRef.current) {
      const pending = pendingPromptRef.current;
      pendingPromptRef.current = null;
      instance.setAiPrompt(pending);
    }
  }, []);

  const bridge = React.useMemo<WorkspaceAppBridge>(
    () => ({
      setAiPrompt: (prompt) => {
        if (aiPanelRef.current) {
          aiPanelRef.current.setAiPrompt(prompt);
        } else {
          pendingPromptRef.current = prompt;
        }
      },
      clearReading: () => {
        pendingPromptRef.current = null;
        aiPanelRef.current?.clearReading();
      },
    }),
    [],
  );

  return (
    <>
      <WorkspaceApp bridge={bridge} sharedAiPane={aiHostEl} />
      {createPortal(<SingleChartAiPanel ref={handlePanelRef} />, aiHostEl)}
    </>
  );
}

export function mountWorkspaceReactApp(): void {
  const mountRoot = document.querySelector<HTMLElement>('#v2-workspace-root');
  if (!mountRoot) return;

  if (mountedRoot) {
    mountedRoot.unmount();
    mountedRoot = null;
  }

  mountRoot.replaceChildren();
  mountedRoot = createRoot(mountRoot);
  mountedRoot.render(
    <React.StrictMode>
      <WorkspaceErrorBoundary>
        <WorkspaceRootHost />
      </WorkspaceErrorBoundary>
    </React.StrictMode>,
  );
}
