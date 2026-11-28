import * as React from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Eye,
  LayoutGrid,
  Loader2,
  MessageSquarePlus,
  Settings2,
  Sparkles,
  Square,
  UserCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type { AgentChatSession, AgentToolTrace } from '../../web-agent';
import {
  activateWebAiProfile,
  getActiveWebAiProfileId,
  isWebAiConfigured,
  loadWebAiProfiles,
  readWebAiConfig,
  type AiConfigProfile,
} from '../../web-ai';
import type {
  ExtractedBirthProfile,
  ExtractedStructuredInputs,
} from '../../router-model/birth-extractor';
import type { MethodId } from '../../router-model/index';
import type { SynastryRelationship } from '../../systems/focus-presets';
import { Button, Select } from '../../components/ui';
import { cn } from '../../lib/utils';
import { useMobileViewportKeyboard } from '../hooks/useMobileViewportKeyboard';
import { AgentMarkdown } from './AgentMarkdown';
import { AgentMiniBoard } from './AgentMiniBoard';

export interface LocalAgentApplyPayload {
  method: MethodId;
  query: string;
  profiles: ExtractedBirthProfile[];
  isTwoPerson: boolean;
  relationship?: SynastryRelationship;
  structured: ExtractedStructuredInputs;
  attachedCaseId?: string | null;
}

const COMPAT_METHODS = new Set<MethodId>([
  'bazi-synastry',
  'ziwei-synastry',
  'astrolabe-synastry',
]);

export interface AgentChatPanelProps {
  variant: 'home-hero' | 'full-page';
  session: AgentChatSession;
  cases: readonly PersonalCase[];
  isRunning: boolean;
  statusText: string;
  onlineAiActive?: boolean;
  brandSeal?: React.ReactNode;
  onSendMessage: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onSelectAttachedCase: (caseId: string | null) => void;
  onOpenConnect: () => void;
  onOpenFullChat?: () => void;
  onOpenVisualResult: (trace: AgentToolTrace) => void;
  onOpenMobileTools?: () => void;
  onApplyLocalAgentRecommendation?: (payload: LocalAgentApplyPayload) => void | Promise<void>;
  focusKey?: number;
}

function ToolTraceCard({
  trace,
  onOpenVisualResult,
}: {
  trace: AgentToolTrace;
  onOpenVisualResult: (trace: AgentToolTrace) => void;
}) {
  const [miniOpen, setMiniOpen] = React.useState(true);
  const canOpenBoard =
    trace.status === 'success' &&
    Boolean(trace.method && (trace.fullResult || trace.repromptToken || trace.payload));
  const hasMiniPreview =
    trace.status === 'success' &&
    Boolean(
      trace.fullResult ||
        (trace.summary?.tags && trace.summary.tags.length > 0) ||
        (trace.summary?.lines && trace.summary.lines.length > 0),
    );

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
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--danger-text)] text-white"
            >
              <X className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-white"
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
          <span className="truncate font-semibold text-[var(--text-strong)]">
            {trace.summary?.title || trace.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {hasMiniPreview ? (
            <button
              type="button"
              onClick={() => setMiniOpen((prev) => !prev)}
              className="whitespace-nowrap rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)] cursor-pointer"
            >
              {miniOpen ? '收起简盘' : '展开简盘'}
            </button>
          ) : null}
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
      </div>

      {hasMiniPreview && miniOpen ? <AgentMiniBoard trace={trace} /> : null}

      {trace.errorMessage ? (
        <div className="mt-1 text-[11px] text-[var(--danger-text)]">{trace.errorMessage}</div>
      ) : null}
    </div>
  );
}

function ComposerCasePicker({
  cases,
  attachedCaseId,
  onSelect,
}: {
  cases: readonly PersonalCase[];
  attachedCaseId: string | null | undefined;
  onSelect: (caseId: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [openUp, setOpenUp] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const activeCase = React.useMemo(
    () => (attachedCaseId ? cases.find((c) => c.id === attachedCaseId) ?? null : null),
    [attachedCaseId, cases],
  );

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current && typeof window !== 'undefined') {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      setOpenUp(viewportHeight - rect.bottom < 220 && rect.top > 180);
    }
    setOpen((prev) => !prev);
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="关联命造档案"
        onClick={handleToggle}
        className={cn(
          'inline-flex h-7 min-[680px]:h-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold leading-none transition-colors cursor-pointer active:scale-[0.98]',
          activeCase
            ? 'border-[color-mix(in_srgb,var(--accent)_32%,var(--border-soft))] bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
            : 'border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-strong)] hover:border-[var(--border-contrast)] hover:bg-[var(--state-hover-surface)]',
        )}
      >
        <UserCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
        <span className="max-w-[92px] min-[680px]:max-w-[120px] truncate leading-none">
          {activeCase ? activeCase.name : '不选档案'}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-[var(--text-muted)] transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="关联命造档案列表"
          className={cn(
            'ws-popover-in absolute left-0 z-[1100] w-[220px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-1.5 shadow-[0_14px_36px_rgba(28,22,38,0.16)]',
            openUp
              ? 'bottom-[calc(100%+6px)] origin-bottom-left'
              : 'top-[calc(100%+6px)] origin-top-left',
          )}
        >
          <div className="grid max-h-[220px] gap-0.5 overflow-y-auto">
            <button
              type="button"
              role="option"
              aria-selected={!activeCase}
              onClick={() => {
                setOpen(false);
                onSelect(null);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border-0 px-2.5 py-2 text-left cursor-pointer transition-colors',
                !activeCase
                  ? 'bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
                  : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
              )}
            >
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-soft)] text-[var(--text-muted)]"
              >
                <UserRoundX className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 grid gap-0.5">
                <strong className="truncate text-[12px] font-bold">不选档案</strong>
              </span>
              {!activeCase ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
              ) : null}
            </button>

            {cases.map((c) => {
              const selected = activeCase?.id === c.id;
              const displayName = c.name?.trim() || '未命名';
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    onSelect(c.id);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border-0 px-2.5 py-2 text-left cursor-pointer transition-colors',
                    selected
                      ? 'bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
                      : 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[11px] font-extrabold text-[var(--accent-strong)]"
                  >
                    {displayName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 grid gap-0.5">
                    <strong className="truncate text-[12px] font-bold">{displayName}</strong>
                    {c.birthText ? (
                      <small className="truncate text-[10.5px] font-normal text-[var(--text-muted)]">
                        {c.birthText}
                      </small>
                    ) : null}
                  </span>
                  {selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
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
  onlineAiActive = true,
  brandSeal,
  onSendMessage,
  onStop,
  onNewChat,
  onSelectAttachedCase,
  onOpenConnect,
  onOpenVisualResult,
  onOpenMobileTools,
  onApplyLocalAgentRecommendation,
  focusKey = 0,
}: AgentChatPanelProps) {
  const [draft, setDraft] = React.useState('');
  const [isLocalRouting, setIsLocalRouting] = React.useState(false);
  const [copiedMsgId, setCopiedMsgId] = React.useState<string | null>(null);
  const [profiles, setProfiles] = React.useState<AiConfigProfile[]>(() => loadWebAiProfiles());
  const [activeProfileId, setActiveProfileId] = React.useState<string | null>(() => getActiveWebAiProfileId());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [composerFocused, setComposerFocused] = React.useState(false);
  const { isMobileViewport, visualBottomY, keyboardOpen } =
    useMobileViewportKeyboard(composerFocused);

  React.useEffect(() => {
    const sync = () => {
      setProfiles(loadWebAiProfiles());
      setActiveProfileId(getActiveWebAiProfileId());
    };
    window.addEventListener('mingyu:web-ai-changed', sync);
    return () => window.removeEventListener('mingyu:web-ai-changed', sync);
  }, []);

  const aiConfig = readWebAiConfig();
  const configured = isWebAiConfigured(aiConfig);
  const isHomeHero = variant === 'home-hero';
  const useLocalRouter =
    isHomeHero && !onlineAiActive && Boolean(onApplyLocalAgentRecommendation);
  const hasMessages = (!isHomeHero || Boolean(onlineAiActive)) && session.messages.length > 0;
  const canInteract = useLocalRouter || configured;

  React.useEffect(() => {
    setDraft('');
  }, [session.id]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session.messages, statusText]);

  const handleSubmit = async (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content) return;
    if (useLocalRouter) {
      if (isLocalRouting || !onApplyLocalAgentRecommendation) return;
      setIsLocalRouting(true);
      try {
        const [{ runLocalAgentPlan }, { extractSubstantiveQuestion }] = await Promise.all([
          import('../../router-model/local-agent'),
          import('../../router-model/features'),
        ]);
        const plan = await runLocalAgentPlan(content);
        const extracted = plan.analysis.extractedBirth;
        const topMethod = plan.routing.recommendations[0]?.method ?? 'bazi';
        const resolvedMethod: MethodId =
          extracted.profiles.length >= 2 && !COMPAT_METHODS.has(topMethod)
            ? 'bazi-synastry'
            : topMethod;

        if (!textOverride) setDraft('');
        if (composerRef.current) {
          composerRef.current.style.height = '';
        }
        await onApplyLocalAgentRecommendation({
          method: resolvedMethod,
          query: extractSubstantiveQuestion(plan.query),
          profiles: extracted.profiles,
          isTwoPerson: extracted.isTwoPerson,
          relationship: extracted.relationship,
          structured: extracted.structured,
          attachedCaseId: session.attachedCaseId,
        });
      } finally {
        setIsLocalRouting(false);
      }
      return;
    }

    if (isRunning || !configured) return;
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

  const prevMsgCountRef = React.useRef(session.messages.length);
  const composerRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (isMobileViewport || !isHomeHero || !canInteract || isRunning || isLocalRouting) return;
    const id = window.requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isMobileViewport, isHomeHero, canInteract, isRunning, isLocalRouting, focusKey]);

  React.useEffect(() => {
    if (!isHomeHero || hasMessages || !isMobileViewport || !keyboardOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isHomeHero, hasMessages, isMobileViewport, keyboardOpen]);

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
        'mx-auto flex w-full min-w-0 max-w-[780px] flex-col',
        isHomeHero
          ? hasMessages
            ? 'gap-3 py-1 min-[680px]:h-full min-[680px]:min-h-0 min-[680px]:flex-1 min-[680px]:py-1'
            : 'gap-0 pt-2 pb-1 min-[680px]:gap-3 min-[680px]:pt-2 min-[680px]:pb-1'
          : 'h-full min-h-0 flex-1 gap-2',
      )}
    >
      {/* 会话顶部轻量条：空态居中问候，对话中或全屏态居左标题 */}
      {isHomeHero && !hasMessages ? (
        <div className="flex flex-col items-center gap-2 text-center">
          {brandSeal ?? (
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-[var(--accent-contrast)] shadow-[0_6px_18px_var(--accent-soft-strong)]">
              {useLocalRouter ? (
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Bot className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
          )}
          <h1 className="m-0 pl-[0.42em] font-sans text-[21px] min-[680px]:text-[26px] font-extrabold tracking-[-0.02em] text-[var(--text-strong)]">
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
            {profiles.length >= 2 ? (
              <Select
                aria-label="切换模型配置"
                size="sm"
                value={activeProfileId ?? ''}
                disabled={isRunning}
                onValueChange={(nextId) => {
                  const hit = activateWebAiProfile(nextId);
                  if (hit) setActiveProfileId(hit.id);
                }}
                className="w-auto max-w-[148px] text-[11px] font-semibold"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : null}
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
              ? 'min-[680px]:max-h-[460px] min-[680px]:min-h-[120px] min-[680px]:overflow-y-auto min-[820px]:max-h-none min-[820px]:min-h-0 min-[820px]:flex-1 min-[820px]:overscroll-contain scroll-mb-40'
              : 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          )}
        >
          {!hasMessages && !isHomeHero ? (
            <div className="my-auto flex flex-col items-center justify-center gap-2 py-8 text-center">
              {brandSeal ?? (
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  <Bot className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
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

                  {msg.reasoning ? (
                    <details
                      className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                      open={msg.status === 'streaming' && !msg.content}
                    >
                      <summary className="cursor-pointer select-none font-semibold text-[var(--text-secondary)]">
                        {msg.status === 'streaming' && !msg.content ? '思考中…' : '思考过程'}
                      </summary>
                      <div className="mt-1.5 whitespace-pre-wrap leading-relaxed text-[12px] text-[var(--text-muted)]">
                        {msg.reasoning}
                      </div>
                    </details>
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

      {/* 输入卡片：桌面端居中流式排布，移动端用 visualBottomY 紧贴软键盘顶部消除底端空隙 */}
      <div
        data-testid={isHomeHero ? 'home-ai-composer-dock' : 'full-ai-composer-dock'}
        style={
          isMobileViewport && isHomeHero
            ? keyboardOpen
              ? {
                  top: `${visualBottomY}px`,
                  bottom: 'auto',
                  transform: 'translate3d(0, -100%, 0)',
                }
              : {
                  bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
                }
            : undefined
        }
        className={cn(
          isHomeHero &&
            cn(
              'fixed inset-x-0 z-40 px-3 bg-gradient-to-t from-[var(--surface-base)] via-[var(--surface-base)]/95 to-transparent min-[680px]:static min-[680px]:inset-auto min-[680px]:z-auto min-[680px]:bg-none min-[680px]:p-0',
              isMobileViewport && keyboardOpen ? 'py-1.5' : 'pt-2 pb-2.5',
            ),
        )}
      >
        <div
          className={cn(
            'mx-auto w-full max-w-[780px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] transition-colors focus-within:border-[var(--accent)]',
            isHomeHero
              ? 'rounded-[24px] px-4 pt-3.5 pb-2.5 shadow-[0_6px_24px_rgba(32,24,16,0.09)] min-[680px]:rounded-3xl min-[680px]:p-4 min-[680px]:shadow-[0_6px_26px_rgba(32,24,16,0.06)]'
              : 'rounded-2xl min-[680px]:rounded-3xl p-2.5 min-[680px]:p-4 shadow-[0_6px_26px_rgba(32,24,16,0.06)]',
          )}
        >
          <textarea
            ref={composerRef}
            rows={2}
            value={draft}
            disabled={useLocalRouter ? isLocalRouting : !configured}
            placeholder={
              useLocalRouter
                ? '输入想问的事，或贴入生辰…'
                : configured
                  ? '输入想问的事…'
                  : '请先在「接入 AI」配置模型后使用'
            }
            aria-label="输入想问的事"
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            onChange={(e) => {
              setDraft(e.target.value);
              if (isHomeHero && typeof window !== 'undefined' && window.innerWidth < 680) {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 144)}px`;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (composerRef.current) composerRef.current.style.height = '';
                void handleSubmit();
              }
            }}
            className={cn(
              'w-full resize-none border-0 bg-transparent px-0 text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
              isHomeHero
                ? isMobileViewport && keyboardOpen
                  ? 'min-h-[44px] max-h-[144px] text-[16px] leading-[1.45] min-[680px]:min-h-[78px] min-[680px]:max-h-none min-[680px]:text-[14.5px] min-[680px]:leading-relaxed'
                  : !hasMessages
                    ? 'min-h-[56px] max-h-[144px] text-[16px] leading-[1.5] min-[680px]:min-h-[78px] min-[680px]:max-h-none min-[680px]:text-[14.5px] min-[680px]:leading-relaxed'
                    : 'min-h-[56px] max-h-[144px] text-[16px] leading-[1.5] min-[680px]:min-h-[40px] min-[680px]:max-h-none min-[680px]:text-[14.5px] min-[680px]:leading-relaxed'
                : 'min-h-[40px] text-[14.5px] leading-relaxed',
            )}
          />

          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-2',
              isHomeHero ? 'mt-2 pt-0.5' : 'mt-1 min-[680px]:mt-2 pt-1',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {cases.length > 0 ? (
                <ComposerCasePicker
                  cases={cases}
                  attachedCaseId={session.attachedCaseId}
                  onSelect={onSelectAttachedCase}
                />
              ) : null}

              {isHomeHero && onOpenMobileTools ? (
                <button
                  type="button"
                  onClick={onOpenMobileTools}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2.5 text-[12px] font-medium leading-none text-[var(--text-secondary)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                  <span>更多工具</span>
                </button>
              ) : null}

              {!configured && !useLocalRouter ? (
                <Button variant="secondary" size="xs" className="rounded-full" onClick={onOpenConnect}>
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>配置 AI</span>
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
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(
                    'rounded-full',
                    isHomeHero && 'size-8 p-0 min-[680px]:h-8 min-[680px]:w-auto min-[680px]:px-3',
                  )}
                  onClick={onStop}
                >
                  <Square className="h-3.5 w-3.5" />
                  <span className={cn(isHomeHero && 'hidden min-[680px]:inline')}>停止</span>
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                className={cn(
                  'rounded-full',
                  isHomeHero
                    ? 'size-8 shrink-0 p-0 min-[680px]:h-8 min-[680px]:w-auto min-[680px]:px-3.5'
                    : 'px-3.5',
                )}
                aria-label="发送"
                disabled={
                  useLocalRouter
                    ? isLocalRouting || !draft.trim()
                    : !configured || isRunning || !draft.trim()
                }
                onClick={() => {
                  if (composerRef.current) composerRef.current.style.height = '';
                  void handleSubmit();
                }}
              >
                {isLocalRouting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                )}
                <span className={cn(isHomeHero && 'hidden min-[680px]:inline')}>
                  {isLocalRouting ? '生成中' : '发送'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
