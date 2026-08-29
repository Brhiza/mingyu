import { useEffect, useMemo, useRef } from 'react';
import type { DivinationDraft } from '@/lib/divination/engine';
import type { DivinationSession } from '@/lib/divination/engine';
import type { DivinationSummaryBlocks } from '@/lib/divination/summary';
import { AiChatPanel } from '@/components/AiChatPanel';
import { TraditionalDivinationBoard } from '@/components/DivinationPanel/TraditionalDivinationBoard';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';
import { PromptDeliveryPanel } from '@/components/PromptPreview';
import {
  ResultAssistantFab,
  ResultAssistantHeader,
  ResultShareFab,
} from '@/components/workspace/WorkspaceUI';
import { useViewportSize } from '@/hooks/useViewportWidth';

interface DivinationResultProps {
  isSubmitting: boolean;
  session: DivinationSession | null;
  summary: DivinationSummaryBlocks | null;
  methodLabelMap: Record<DivinationDraft['method'], string>;
  copyState: string;
  shareState: string;
  showHeading?: boolean;
  assistantOnly?: boolean;
  onCopy: () => void;
  onShare: () => void;
  onOpenAssistant?: () => void;
  onReturnToBoard?: () => void;
  onRestart?: () => void;
}

export function DivinationResult({
  isSubmitting,
  session,
  summary,
  methodLabelMap,
  copyState,
  shareState,
  showHeading = true,
  assistantOnly = false,
  onCopy,
  onShare,
  onOpenAssistant,
  onReturnToBoard,
  onRestart,
}: DivinationResultProps) {
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  const viewportSize = useViewportSize({ width: 0, height: 0 });
  const boardPaneRef = useRef<HTMLDivElement>(null);
  const isCompactResultLayout = viewportSize.width > 0 && viewportSize.width < 980;
  const showEmbeddedAssistant = !assistantOnly && !isCompactResultLayout;
  const showBoard = !assistantOnly;
  const showInterpretation = assistantOnly || showEmbeddedAssistant;

  useEffect(() => {
    const boardPane = boardPaneRef.current;
    if (!boardPane) return;
    boardPane.scrollTop = 0;
    boardPane.scrollLeft = 0;
  }, [assistantOnly, session?.prompt]);

  if (isSubmitting) {
    if (isAiEnabled) {
      return (
        <div className="divination-ai-card" aria-hidden="true">
          <section className="workspace-ui-surface divination-result-panel">
            <div className="divination-result-skeleton">
              <span className="skeleton-block divination-result-skeleton-title" />
              <div className="divination-result-skeleton-list">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    className="skeleton-block divination-result-skeleton-line"
                    key={`ai-line-${index}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="divination-skeleton-layout" aria-hidden="true">
        <section className="workspace-ui-surface divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-tags">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-tag"
                  key={`tag-${index}`}
                />
              ))}
            </div>
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-a-${index}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="workspace-ui-surface divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-b-${index}`}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!session || !summary) {
    return null;
  }

  const resultBlock = (
    <section className="workspace-ui-surface is-plain divination-result-panel">
      {showHeading ? (
        <div className="workspace-ui-panel-head">
          <h2>{summary.title}</h2>
        </div>
      ) : null}

      {session.requestedMethod === 'random' ? (
        <div className="divination-random-note">本次随机到：{methodLabelMap[session.method]}</div>
      ) : null}

      {session.timeContext?.standard === 'true-solar' ? (
        <div className="divination-result-time-context" aria-label="本次起局时间口径">
          <span>真太阳时</span>
          <strong>
            {session.timeContext.effectiveDateTime.replace('T', ' ').replace(/:00$/, '')}
          </strong>
          {session.timeContext.locationName ? (
            <small>{session.timeContext.locationName}</small>
          ) : null}
        </div>
      ) : null}

      <TraditionalDivinationBoard session={session} onRestart={onRestart} />
    </section>
  );

  return (
    <div
      className={`divination-result-workspace${
        assistantOnly ? ' is-assistant-page' : ''
      }${showEmbeddedAssistant ? ' is-split' : ''}`}
    >
      {assistantOnly ? (
        onReturnToBoard ? (
          <ResultAssistantHeader
            aiEnabled={isAiEnabled}
            subtitle={methodLabelMap[session.method]}
            onBack={onReturnToBoard}
          />
        ) : null
      ) : null}

      <div className="divination-result-stage">
        {showBoard ? (
          <div className="divination-result-board-pane" ref={boardPaneRef}>
            {resultBlock}
          </div>
        ) : null}

        {showInterpretation ? (
          <div
            className={`divination-result-assistant-pane ${
              isAiEnabled ? 'is-ai-mode' : 'is-prompt-mode'
            }`}
          >
            {isAiEnabled ? (
              <div className="divination-ai-card">
                <AiChatPanel
                  contextPrompt={session.prompt}
                  autoStart={session.prompt}
                  autoStartKey={session.prompt}
                  resetKey={session.prompt}
                  aiConfig={aiRequestConfig}
                />
              </div>
            ) : (
              <PromptDeliveryPanel
                promptText={session.prompt}
                copyState={copyState}
                shareState={shareState}
                onCopy={onCopy}
                onShare={onShare}
                question={session.question || methodLabelMap[session.method]}
                showShare={isCompactResultLayout}
                expandedByDefault
              />
            )}
          </div>
        ) : null}
      </div>

      {!assistantOnly && onOpenAssistant ? (
        <>
          <ResultShareFab disabled={!session.prompt} onShare={onShare} />
          <ResultAssistantFab aiEnabled={isAiEnabled} onOpen={onOpenAssistant} />
        </>
      ) : null}
    </div>
  );
}
