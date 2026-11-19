import * as React from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  Eye,
  Loader2,
  MessageSquarePlus,
  Settings2,
  Square,
  UserCheck,
} from 'lucide-react';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type { AgentChatSession, AgentToolTrace } from '../../web-agent';
import { isWebAiConfigured, readWebAiConfig } from '../../web-ai';
import { Button } from '../../components/ui';
import { cn } from '../../lib/utils';
import { AgentMarkdown } from './AgentMarkdown';

export interface AgentChatPanelProps {
  variant: 'home-hero' | 'full-page';
  session: AgentChatSession;
  cases: readonly PersonalCase[];
  isRunning: boolean;
  statusText: string;
  onSendMessage: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onSelectAttachedCase: (caseId: string | null) => void;
  onOpenConnect: () => void;
  onOpenFullChat?: () => void;
  onOpenVisualResult: (trace: AgentToolTrace) => void;
}

function ToolTraceCard({
  trace,
  onOpenVisualResult,
}: {
  trace: AgentToolTrace;
  onOpenVisualResult: (trace: AgentToolTrace) => void;
}) {
  const canOpenBoard =
    trace.status === 'success' &&
    Boolean(trace.method && (trace.fullResult || trace.repromptToken || trace.payload));

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 text-xs transition-colors',
        trace.status === 'running'
          ? 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border-soft))] bg-[var(--state-selected-surface)]'
          : trace.status === 'error'
            ? 'border-[color-mix(in_srgb,var(--danger-text)_35%,var(--border-soft))] bg-[var(--surface-soft)]'
            : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {trace.status === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent-strong)]" />
          ) : trace.status === 'error' ? (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--danger-text)] text-[10px] font-bold text-white">
              !
            </span>
          ) : (
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-bold text-white">
              ✓
            </span>
          )}
          <span className="truncate font-semibold text-[var(--text-strong)]">
            {trace.summary?.title || trace.label}
          </span>
        </div>

        {canOpenBoard ? (
          <Button
            variant="secondary"
            size="xs"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => onOpenVisualResult(trace)}
          >
            <Eye className="h-3 w-3" />
            <span>查看盘面</span>
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        ) : null}
      </div>

      {trace.errorMessage ? (
        <div className="mt-1 text-[11px] text-[var(--danger-text)]">{trace.errorMessage}</div>
      ) : null}
    </div>
  );
}

export function AgentChatPanel({
  variant,
  session,
  cases,
  isRunning,
  statusText,
  onSendMessage,
  onStop,
  onNewChat,
  onSelectAttachedCase,
  onOpenConnect,
  onOpenFullChat,
  onOpenVisualResult,
}: AgentChatPanelProps) {
  const [draft, setDraft] = React.useState('');
  const [copiedMsgId, setCopiedMsgId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const aiConfig = readWebAiConfig();
  const configured = isWebAiConfigured(aiConfig);

  React.useEffect(() => {
    setDraft('');
  }, [session.id]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session.messages, statusText]);

  const handleSubmit = (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content || isRunning || !configured) return;
    if (!textOverride) setDraft('');
    onSendMessage(content);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      window.setTimeout(() => {
        setCopiedMsgId((cur) => (cur === id ? null : cur));
      }, 1800);
    } catch {}
  };

  const isHomeHero = variant === 'home-hero';
  const hasMessages = session.messages.length > 0;
  const prevMsgCountRef = React.useRef(session.messages.length);

  React.useEffect(() => {
    const prevCount = prevMsgCountRef.current;
    prevMsgCountRef.current = session.messages.length;
    if (!isHomeHero || window.innerWidth >= 680) return;
    if (session.messages.length > prevCount) {
      const container = scrollRef.current;
      container?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [isHomeHero, session.messages.length]);

  return (
    <section
      aria-label={isHomeHero ? 'AI 对话' : '对话详情'}
      className={cn(
        'mx-auto flex w-full max-w-[780px] flex-col',
        isHomeHero
          ? hasMessages
            ? 'gap-3 py-1 min-[680px]:py-3'
            : 'gap-3.5 pt-4 pb-2 min-[680px]:gap-5 min-[680px]:pt-9 min-[680px]:pb-4'
          : 'h-full min-h-0 flex-1 gap-2',
      )}
    >
      {/* 会话顶部轻量条：空态居中问候，对话中或全屏态居左标题 */}
      {isHomeHero && !hasMessages ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-white shadow-[0_6px_18px_rgba(184,59,43,0.18)]">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="m-0 font-sans text-[21px] min-[680px]:text-[26px] font-extrabold tracking-[-0.02em] text-[var(--text-strong)]">
            今天想问什么？
          </h1>
        </div>
      ) : hasMessages ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-strong)] text-white">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <strong className="truncate text-[14px] font-extrabold text-[var(--text-strong)]">
              {hasMessages && session.title ? session.title : '新对话'}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasMessages ? (
              <Button
                variant="ghost"
                size="xs"
                disabled={isRunning}
                onClick={onNewChat}
                title="开启新对话"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                <span>新对话</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 消息流区域（开放式网页版 AI 排版：桌面端内置滚动，移动端随页自然流式滚动） */}
      {hasMessages || !isHomeHero ? (
        <div
          ref={scrollRef}
          className={cn(
            'flex flex-col gap-5 px-1 py-2',
            isHomeHero
              ? 'min-[680px]:max-h-[460px] min-[680px]:min-h-[120px] min-[680px]:overflow-y-auto scroll-mb-40'
              : 'min-h-0 flex-1 overflow-y-auto',
          )}
        >
          {!hasMessages && !isHomeHero ? (
            <div className="my-auto flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="m-0 text-sm font-bold text-[var(--text-strong)]">今天想问什么？</p>
            </div>
          ) : (
            session.messages.map((msg) => {
              const isUser = msg.role === 'user';
              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl bg-[var(--state-selected-surface)] px-4 py-2.5 text-[14px] leading-relaxed text-[var(--text-strong)] shadow-[0_1px_4px_rgba(32,24,16,0.03)]">
                      <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              return (
                <article key={msg.id} className="flex w-full min-w-0 flex-col gap-2">
                  {msg.toolTraces && msg.toolTraces.length > 0 ? (
                    <div className="grid gap-1.5">
                      {msg.toolTraces.map((trace) => (
                        <ToolTraceCard
                          key={trace.id}
                          trace={trace}
                          onOpenVisualResult={onOpenVisualResult}
                        />
                      ))}
                    </div>
                  ) : null}

                  {msg.content ? (
                    <AgentMarkdown
                      content={msg.content}
                      className="!max-h-none !border-0 !bg-transparent !p-0 text-[14px] leading-relaxed"
                    />
                  ) : msg.status === 'streaming' ? (
                    <div className="flex items-center gap-2 py-1 text-xs text-[var(--text-muted)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-strong)]" />
                      <span>{statusText || '正在思考…'}</span>
                    </div>
                  ) : null}

                  {msg.errorMessage ? (
                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger-text)_30%,transparent)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--danger-text)]">
                      {msg.errorMessage}
                    </div>
                  ) : null}

                  {(() => {
                    const canCopy = Boolean(msg.content && msg.status !== 'streaming');
                    if (!canCopy && msg.status !== 'stopped' && msg.status !== 'error') {
                      return null;
                    }
                    return (
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        {canCopy ? (
                          <button
                            type="button"
                            onClick={() => void handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] cursor-pointer hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)]"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>已复制</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>复制</span>
                              </>
                            )}
                          </button>
                        ) : null}
                        {msg.status === 'stopped' ? <span>已停止</span> : null}
                        {msg.status === 'error' ? (
                          <span className="text-[var(--danger-text)]">请求失败</span>
                        ) : null}
                      </div>
                    );
                  })()}
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {/* 输入卡片：桌面端居中流式排布，移动端首页贴靠底部导航栏上方便于单手输入 */}
      <div
        data-testid={isHomeHero ? 'home-ai-composer-dock' : 'full-ai-composer-dock'}
        className={cn(
          isHomeHero &&
            'fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom,0px))] z-40 px-2.5 pt-2.5 pb-2 bg-gradient-to-t from-[var(--surface-base)] via-[var(--surface-base)]/95 to-transparent min-[680px]:static min-[680px]:inset-auto min-[680px]:z-auto min-[680px]:bg-none min-[680px]:p-0',
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-[780px] rounded-2xl min-[680px]:rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-2.5 min-[680px]:p-4 transition-colors focus-within:border-[var(--accent)]',
            isHomeHero
              ? 'shadow-[0_8px_28px_rgba(32,24,16,0.10)] min-[680px]:shadow-[0_6px_26px_rgba(32,24,16,0.06)]'
              : 'shadow-[0_6px_26px_rgba(32,24,16,0.06)]',
          )}
        >
          <textarea
            rows={2}
            value={draft}
            disabled={!configured}
            placeholder={configured ? '输入想问的事…' : '请先在「接入 AI」配置模型后使用'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className={cn(
              'w-full resize-none border-0 bg-transparent px-1 text-[14.5px] leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
              isHomeHero && !hasMessages ? 'min-h-[44px] min-[680px]:min-h-[78px]' : 'min-h-[40px]',
            )}
          />

          <div className="mt-1 min-[680px]:mt-2 flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {cases.length > 0 ? (
                <label className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-secondary)]">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--accent-strong)]" aria-hidden="true" />
                  <select
                    aria-label="关联命造档案"
                    value={session.attachedCaseId ?? ''}
                    onChange={(e) => onSelectAttachedCase(e.target.value || null)}
                    className="max-w-[96px] min-[680px]:max-w-[116px] cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold text-[var(--text-strong)] outline-none"
                  >
                    <option value="">不限档案</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!configured ? (
                <Button variant="secondary" size="xs" className="rounded-full" onClick={onOpenConnect}>
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>配置模型</span>
                </Button>
              ) : null}

              {isRunning && statusText ? (
                <span className="ml-1 truncate text-[11.5px] text-[var(--text-muted)]">
                  {statusText}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isRunning ? (
                <Button variant="secondary" size="sm" className="rounded-full" onClick={onStop}>
                  <Square className="h-3.5 w-3.5" />
                  <span>停止</span>
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                className="rounded-full px-3.5"
                aria-label="发送"
                disabled={!configured || isRunning || !draft.trim()}
                onClick={() => handleSubmit()}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
                <span>发送</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
