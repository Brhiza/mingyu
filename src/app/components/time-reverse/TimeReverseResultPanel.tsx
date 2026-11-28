import * as React from 'react';
import { Bot, Check, Copy, Send, Square } from 'lucide-react';
import type { AiMessage } from '../../../ai';
import { Button, Card, SegmentedTabs } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { BIRTH_TIME_OPTIONS } from '../../../v2-ui/cases-store';
import type {
  TimeReverseCandidatesResult,
  TimeReverseKnownInfo,
} from '../../../v2-ui/time-reverse';
import { ExternalAiShareButtons } from '../shared/ExternalAiShareButtons';
import { MarkdownMessage } from './TimeReverseClozeParts';

export interface TimeReverseResultPanelProps {
  outputSectionRef: React.RefObject<HTMLDivElement | null>;
  generatedPrompt: string;
  webAiEnabled: boolean;
  outputTab: 'ai' | 'prompt';
  onChangeOutputTab: (next: 'ai' | 'prompt') => void;
  copiedPrompt: boolean;
  onCopyPrompt: () => void;
  aiConfigured: boolean;
  aiModelName: string;
  isStreaming: boolean;
  isComputing: boolean;
  aiStatus: string;
  visibleMessages: AiMessage[];
  streamingContent: string;
  copiedMsgIdx: number | null;
  followupDraft: string;
  onChangeFollowupDraft: (next: string) => void;
  onStopStreaming: () => void;
  onStartAiFromPrompt: () => void;
  onCopyAssistant: (idx: number, content: string) => void;
  onSendFollowup: () => void;
  candidatesResult: TimeReverseCandidatesResult | null;
  draftKnown: TimeReverseKnownInfo;
  onApplyShichen: (
    shichenIndex: number,
    known: TimeReverseKnownInfo,
    openResultDirectly: boolean,
  ) => void;
}

export function TimeReverseResultPanel({
  outputSectionRef,
  generatedPrompt,
  webAiEnabled,
  outputTab,
  onChangeOutputTab,
  copiedPrompt,
  onCopyPrompt,
  aiConfigured,
  aiModelName,
  isStreaming,
  isComputing,
  aiStatus,
  visibleMessages,
  streamingContent,
  copiedMsgIdx,
  followupDraft,
  onChangeFollowupDraft,
  onStopStreaming,
  onStartAiFromPrompt,
  onCopyAssistant,
  onSendFollowup,
  candidatesResult,
  draftKnown,
  onApplyShichen,
}: TimeReverseResultPanelProps) {
  return (
    <div ref={outputSectionRef} className="grid gap-3">
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-soft)] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {webAiEnabled ? (
              <SegmentedTabs
                value={outputTab}
                onValueChange={onChangeOutputTab}
                ariaLabel="逆推输出方式切换"
                options={[
                  { id: 'ai', label: 'AI 解读' },
                  { id: 'prompt', label: '提示词' },
                ]}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[14px] text-[var(--text-strong)]">
                  时辰逆推提示词已就绪
                </strong>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('mingyu:navigate-connect'))}
                  className="workspace-assistant-ai-link"
                >
                  开启站内 AI →
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              约 {generatedPrompt.length} 字
            </span>
            <Button variant="secondary" size="sm" onClick={onCopyPrompt}>
              {copiedPrompt ? (
                <Check className="h-3.5 w-3.5 text-[var(--success-text)]" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
            </Button>
            <ExternalAiShareButtons promptText={generatedPrompt} size="sm" />
          </div>
        </div>

        {/* Tab 1: AI 解读面板 */}
        {webAiEnabled && outputTab === 'ai' ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    aiConfigured ? 'bg-[var(--success-text)]' : 'bg-[var(--accent-strong)]',
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-xs font-bold text-[var(--text-strong)]">
                  {aiConfigured
                    ? `当前模型：${aiModelName}`
                    : '尚未填写接口地址或模型'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('mingyu:navigate-connect'))
                  }
                >
                  配置 AI
                </Button>
                {isStreaming ? (
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={onStopStreaming}
                  >
                    <Square className="h-3 w-3" aria-hidden="true" />
                    <span>停止</span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="xs"
                    disabled={!aiConfigured || isComputing}
                    onClick={onStartAiFromPrompt}
                  >
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{visibleMessages.length > 0 ? '重新逆推' : 'AI 逆推'}</span>
                  </Button>
                )}
              </div>
            </div>

            {aiStatus ? (
              <p role="status" className="m-0 text-xs text-[var(--text-muted)]">
                {aiStatus}
              </p>
            ) : null}

            {visibleMessages.length > 0 || streamingContent ? (
              <div className="grid gap-3">
                {visibleMessages.map((msg, idx) => (
                  <article
                    key={idx}
                    className={cn(
                      'rounded-xl border p-3.5',
                      msg.role === 'user'
                        ? 'ml-auto max-w-[88%] border-[color-mix(in_srgb,var(--accent-strong)_24%,var(--border-soft))] bg-[var(--state-selected-surface)]'
                        : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-bold text-[var(--text-strong)]">
                        {msg.role === 'assistant' ? 'AI 时辰逆推' : '补充回答'}
                      </span>
                      {msg.role === 'assistant' ? (
                        <button
                          type="button"
                          onClick={() => onCopyAssistant(idx, msg.content)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-strong)] cursor-pointer"
                        >
                          {copiedMsgIdx === idx ? '已复制' : '复制'}
                        </button>
                      ) : null}
                    </div>
                    {msg.role === 'assistant' ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-strong)]">
                        {msg.content}
                      </p>
                    )}
                  </article>
                ))}

                {streamingContent ? (
                  <article className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-bold text-[var(--text-strong)]">AI 时辰逆推</span>
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-strong)]">
                        推演中…
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-primary)]">
                      {streamingContent}
                    </div>
                  </article>
                ) : null}
              </div>
            ) : null}

            {/* 追问框：方便回答 AI 提出的定盘校验问题 */}
            {visibleMessages.length > 0 && !isStreaming ? (
              <div className="grid gap-2 border-t border-[var(--border-soft)] pt-3">
                <textarea
                  rows={2}
                  value={followupDraft}
                  onChange={(e) => onChangeFollowupDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      onSendFollowup();
                    }
                  }}
                  placeholder="回答 AI 的验证问题，或继续补充某个年份发生的事（Enter 发送，Shift+Enter 换行）…"
                  className="workspace-ui-control w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-[13.5px] text-[var(--text-primary)]"
                />
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!followupDraft.trim() || isStreaming}
                    onClick={onSendFollowup}
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>继续核对</span>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Tab 2: 提示词原文预览 */}
        {!webAiEnabled || outputTab === 'prompt' ? (
          <div className="grid gap-2">
            <pre className="m-0 max-h-[420px] overflow-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 font-sans text-[13px] leading-[1.65] whitespace-pre-wrap break-words text-[var(--text-primary)]">
              {generatedPrompt}
            </pre>
          </div>
        ) : null}
      </Card>

      {/* 六、十二时辰候选速览与一键回填排盘 */}
      <Card className="grid gap-3 p-4 sm:p-5">
        <h3 className="m-0 text-[14.5px] font-bold text-[var(--text-strong)]">
          选择候选时辰回填排盘
        </h3>

        {candidatesResult && candidatesResult.candidates.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {candidatesResult.candidates.map((cand, idx) => (
              <div
                key={`${cand.shichenIndex}_${idx}`}
                className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3"
              >
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13.5px] text-[var(--text-strong)]">
                      {cand.shichenLabel}（{cand.timeWindow}）
                    </strong>
                    <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--accent-strong)]">
                      {cand.hourPillar}时
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {cand.baziNote}
                  </div>
                  {cand.ziweiNote ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      紫微：{cand.ziweiNote}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onApplyShichen(cand.shichenIndex, draftKnown, false)}
                  >
                    回填时辰
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onApplyShichen(cand.shichenIndex, draftKnown, true)}
                  >
                    直接排盘 →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {BIRTH_TIME_OPTIONS.map((opt) => (
              <button
                key={opt.index}
                type="button"
                onClick={() => onApplyShichen(opt.index, draftKnown, false)}
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] transition-colors cursor-pointer"
              >
                {opt.label}（{opt.range}）
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
