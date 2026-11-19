import * as React from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  MapPin,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { streamChat, type AiMessage } from '../../ai';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  BIRTH_TIME_OPTIONS,
  clampNumericField,
  type PersonalCase,
} from '../../v2-ui/cases-store';
import type { PersonRole } from '../../v2-ui/person-form';
import {
  buildTimeReversePrompt,
  computeTimeReverseCandidates,
  countFilledTimeReverseClues,
  createEmptyTimeReverseDraft,
  FUZZY_TIME_SLOTS,
  hasValidBirthDateForCandidates,
  TIME_REVERSE_CHIPS,
  type TimeReverseCandidatesResult,
  type TimeReverseDraft,
  type TimeReverseKnownInfo,
  type TimeReverseMilestones,
  type TimeReverseProfileInfo,
} from '../../v2-ui/time-reverse';
import { isWebAiEnabled, readWebAiConfig } from '../../web-ai';
import { renderMarkdownContent } from '../../web-report';
import { Button, Card, PageHeader, SegmentedTabs } from '../../components/ui';
import { cn } from '../../lib/utils';

export interface TimeReversePageProps {
  initialPerson: Partial<PersonalCase>;
  role: PersonRole;
  birthPlaceModal: BirthPlaceModalController;
  onBackToChartInput: () => void;
  onApplyShichen: (
    shichenIndex: number,
    known: TimeReverseKnownInfo,
    openResultDirectly: boolean,
  ) => void;
}

function toggleChipIntoText(current: string, chip: string): string {
  const trimmed = current.trim();
  if (!trimmed) return chip;
  const parts = trimmed.split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.includes(chip)) {
    return parts.filter((p) => p !== chip).join('、');
  }
  return `${trimmed}、${chip}`;
}

function MarkdownMessage({ content }: { content: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    renderMarkdownContent(el, content);
  }, [content]);
  return <div ref={ref} className="ai-message-body markdown-body" />;
}

interface ClozeBlankProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  widthClass?: string;
  ariaLabel: string;
  inputMode?: 'text' | 'numeric';
}

function ClozeBlank({
  value,
  onChange,
  placeholder,
  widthClass = 'min-w-[140px] sm:min-w-[180px]',
  ariaLabel,
  inputMode = 'text',
}: ClozeBlankProps) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(
        'time-reverse-blank mx-1 my-0.5 inline-block h-8 max-w-full rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated-strong)] px-2.5 text-[13.5px] font-semibold text-[var(--text-strong)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:border-solid focus:border-[var(--accent-strong)] focus:bg-[var(--surface-base)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-surface)] transition-colors',
        widthClass,
      )}
    />
  );
}

function ChipSuggestions({
  chips,
  value,
  onSelect,
  mode = 'toggle',
}: {
  chips: readonly string[];
  value: string;
  onSelect: (nextValue: string) => void;
  mode?: 'toggle' | 'replace';
}) {
  const activeParts = React.useMemo(
    () =>
      value
        .split(/[、，,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] font-medium text-[var(--text-muted)]">快捷填入：</span>
      {chips.map((chip) => {
        const isActive =
          mode === 'replace' ? value.trim() === chip : activeParts.includes(chip);
        return (
          <button
            key={chip}
            type="button"
            onClick={() => {
              if (mode === 'replace') {
                onSelect(isActive ? '' : chip);
              } else {
                onSelect(toggleChipIntoText(value, chip));
              }
            }}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[12px] transition-colors cursor-pointer',
              isActive
                ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)]'
                : 'border-[var(--border-soft)] bg-[var(--surface-soft)] font-medium text-[var(--text-secondary)] hover:border-[var(--border-contrast)] hover:text-[var(--text-strong)]',
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

export function TimeReversePage({
  initialPerson,
  role,
  birthPlaceModal,
  onBackToChartInput,
  onApplyShichen,
}: TimeReversePageProps) {
  const [draft, setDraft] = React.useState<TimeReverseDraft>(() =>
    createEmptyTimeReverseDraft(initialPerson),
  );
  const [candidatesResult, setCandidatesResult] =
    React.useState<TimeReverseCandidatesResult | null>(null);
  const [isComputing, setIsComputing] = React.useState(false);

  const [generatedPrompt, setGeneratedPrompt] = React.useState('');
  const [isDirtySinceGenerate, setIsDirtySinceGenerate] = React.useState(false);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);

  // AI 解读状态
  const [webAiEnabled, setWebAiEnabledState] = React.useState(() => isWebAiEnabled());
  const [aiConfig, setAiConfig] = React.useState(() => readWebAiConfig());
  const [outputTab, setOutputTab] = React.useState<'ai' | 'prompt'>(() =>
    isWebAiEnabled() ? 'ai' : 'prompt',
  );
  const [conversation, setConversation] = React.useState<AiMessage[]>([]);
  const [streamingContent, setStreamingContent] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState('');
  const [followupDraft, setFollowupDraft] = React.useState('');
  const [copiedMsgIdx, setCopiedMsgIdx] = React.useState<number | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const outputSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sync = () => {
      const enabled = isWebAiEnabled();
      setWebAiEnabledState(enabled);
      setAiConfig(readWebAiConfig());
      if (!enabled) setOutputTab('prompt');
    };
    window.addEventListener('mingyu:web-ai-changed', sync);
    return () => window.removeEventListener('mingyu:web-ai-changed', sync);
  }, []);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const updateKnown = (patch: Partial<TimeReverseKnownInfo>) => {
    setDraft((prev) => ({ ...prev, known: { ...prev.known, ...patch } }));
    if (generatedPrompt) setIsDirtySinceGenerate(true);
  };

  const updateProfile = (patch: Partial<TimeReverseProfileInfo>) => {
    setDraft((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
    if (generatedPrompt) setIsDirtySinceGenerate(true);
  };

  const updateMilestones = (patch: Partial<TimeReverseMilestones>) => {
    setDraft((prev) => ({ ...prev, milestones: { ...prev.milestones, ...patch } }));
    if (generatedPrompt) setIsDirtySinceGenerate(true);
  };

  const filledCount = React.useMemo(() => countFilledTimeReverseClues(draft), [draft]);
  const hasDate = React.useMemo(() => hasValidBirthDateForCandidates(draft.known), [draft.known]);
  const aiConfigured = Boolean(
    webAiEnabled && aiConfig.baseUrl.trim() && aiConfig.model.trim(),
  );

  const handleOpenPlaceModal = () => {
    birthPlaceModal.open({
      purpose: 'birth',
      initialPlace: draft.known.birthPlace,
      onConfirm: (sel) => {
        updateKnown({
          birthPlace: sel.displayName,
          longitude: sel.longitude,
          latitude: sel.latitude,
          ...(sel.timezone !== undefined ? { timezone: sel.timezone } : {}),
          ...(sel.timeZoneId ? { timeZoneId: sel.timeZoneId } : { timeZoneId: undefined }),
        });
      },
    });
  };

  const handleAddCustomMilestone = () => {
    const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    updateMilestones({
      customMilestones: [
        ...draft.milestones.customMilestones,
        { id, when: '', event: '', impact: '' },
      ],
    });
  };

  const handleUpdateCustomMilestone = (
    id: string,
    patch: Partial<{ when: string; event: string; impact: string }>,
  ) => {
    updateMilestones({
      customMilestones: draft.milestones.customMilestones.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  const handleRemoveCustomMilestone = (id: string) => {
    updateMilestones({
      customMilestones: draft.milestones.customMilestones.filter((item) => item.id !== id),
    });
  };

  const handleReset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setDraft(createEmptyTimeReverseDraft(initialPerson));
    setCandidatesResult(null);
    setGeneratedPrompt('');
    setIsDirtySinceGenerate(false);
    setConversation([]);
    setStreamingContent('');
    setIsStreaming(false);
    setAiStatus('');
  };

  const runGenerate = async (autoStartAi: boolean): Promise<string> => {
    setIsComputing(true);
    let computed: TimeReverseCandidatesResult | null = null;
    try {
      if (hasValidBirthDateForCandidates(draft.known)) {
        computed = await computeTimeReverseCandidates(draft.known);
      }
      setCandidatesResult(computed);
      const nextPrompt = buildTimeReversePrompt(draft, computed);
      setGeneratedPrompt(nextPrompt);
      setIsDirtySinceGenerate(false);
      if (autoStartAi && aiConfigured) {
        setOutputTab('ai');
      }
      window.setTimeout(() => {
        outputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return nextPrompt;
    } finally {
      setIsComputing(false);
    }
  };

  const startAiStream = async (messagesToSend: AiMessage[], isFollowup: boolean) => {
    if (isStreaming) return;
    if (!aiConfigured) {
      setAiStatus('尚未配置或开启网页 AI 模型，请先到「接入 AI」填写接口地址与模型。');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsStreaming(true);
    setStreamingContent('');
    setAiStatus('正在连接模型推演最可能的出生时辰…');

    const baseMessages = isFollowup
      ? messagesToSend
      : [
          {
            role: 'user' as const,
            content: messagesToSend[0]!.content,
            submittedAt: new Date().toISOString(),
          },
        ];

    let accumulated = '';
    try {
      const res = await streamChat(
        aiConfig,
        baseMessages,
        (chunk) => {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          setStreamingContent(accumulated);
          setAiStatus('正在生成逆推分析…');
        },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) {
        setAiStatus('已停止生成，已收到的内容保留在下方。');
        if (accumulated) {
          setConversation([
            ...baseMessages,
            { role: 'assistant', content: accumulated },
          ]);
          setStreamingContent('');
        }
        return;
      }
      setConversation([...baseMessages, { role: 'assistant', content: res.content }]);
      setStreamingContent('');
      if (isFollowup) setFollowupDraft('');
      setAiStatus(
        res.finishReason === 'stop'
          ? '逆推分析完成，可继续在下方补充细节或回答校验问题。'
          : `回答未完整结束（${res.finishReason}），已保留本次内容，可重试或继续追问。`,
      );
    } catch (err) {
      if (ctrl.signal.aborted) {
        setAiStatus('已停止生成。');
        if (accumulated) {
          setConversation([...baseMessages, { role: 'assistant', content: accumulated }]);
          setStreamingContent('');
        }
      } else {
        setAiStatus(
          err instanceof TypeError
            ? '无法连接模型服务，请检查接口地址、网络及跨域设置。'
            : err instanceof Error
              ? err.message
              : '模型请求失败。',
        );
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleGenerateOnly = async () => {
    const prompt = await runGenerate(false);
    if (!aiConfigured) {
      setOutputTab('prompt');
    }
    void prompt;
  };

  const handleGenerateAndAnalyze = async () => {
    const prompt = await runGenerate(true);
    setConversation([]);
    await startAiStream([{ role: 'user', content: prompt }], false);
  };

  const handleStartAiFromPrompt = async () => {
    const prompt = isDirtySinceGenerate || !generatedPrompt ? await runGenerate(true) : generatedPrompt;
    setOutputTab('ai');
    setConversation([]);
    await startAiStream([{ role: 'user', content: prompt }], false);
  };

  const handleSendFollowup = async () => {
    const text = followupDraft.trim();
    if (!text || isStreaming) return;
    if (!conversation.length) return;
    const nextHistory: AiMessage[] = [
      ...conversation,
      { role: 'user', content: text, submittedAt: new Date().toISOString() },
    ];
    setConversation(nextHistory);
    setFollowupDraft('');
    await startAiStream(nextHistory, true);
  };

  const handleCopyPrompt = async () => {
    const text = generatedPrompt || (await runGenerate(false));
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyAssistant = async (idx: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgIdx(idx);
      window.setTimeout(() => setCopiedMsgIdx(null), 1600);
    } catch {
      // ignore
    }
  };

  const visibleMessages = conversation.slice(1);

  return (
    <div className="workspace-ui-screen workspace-focused-page is-narrow time-reverse-page">
      <PageHeader
        title="时辰逆推"
        badgeText={role === 'partner' ? '命主二' : '生时校正'}
        subtitle="所有选项都非必填，像做填空题一样挑记得住的填，填完即可生成逆推提示词或让 AI 直接帮你推算。"
        rightSlot={
          <Button variant="secondary" size="sm" onClick={onBackToChartInput}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>返回排盘输入</span>
          </Button>
        }
      />

      {/* 顶部线索统计条 */}
      <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[var(--surface-soft)]">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
          <span>
            当前已填写 <strong className="text-[var(--text-strong)]">{filledCount}</strong> 项线索
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            · 全程非必填，想不起的空着就好
          </span>
          {hasDate ? (
            <span className="rounded-full bg-[var(--state-selected-surface)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--state-selected-text)]">
              已识别出生日期，将自动附上十二时辰盘面对照
            </span>
          ) : null}
        </div>
        {filledCount > 0 ? (
          <Button variant="ghost" size="xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>清空重写</span>
          </Button>
        ) : null}
      </Card>

      {/* 一、已知出生线索（全部非必填） */}
      <Card className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
            一、已知出生线索（有模糊印象也能填）
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            只知道大概年份、大概天亮还是天黑，或者完全没日期只填性格事件，都可以正常推算。
          </p>
        </div>

        {/* 填空 1：基本资料 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我是</span>
            <span className="mx-1.5 inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-0.5 align-middle">
              {(
                [
                  { id: '', label: '不填性别' },
                  { id: 'male', label: '男' },
                  { id: 'female', label: '女' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id || 'none'}
                  type="button"
                  onClick={() => updateKnown({ gender: g.id })}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer',
                    draft.known.gender === g.id
                      ? 'bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-strong)]',
                  )}
                >
                  {g.label}
                </button>
              ))}
            </span>
            <span>，</span>
            <span className="mx-1 inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-0.5 align-middle">
              {(
                [
                  { id: 'solar', label: '公历' },
                  { id: 'lunar', label: '农历' },
                ] as const
              ).map((cal) => (
                <button
                  key={cal.id}
                  type="button"
                  onClick={() =>
                    updateKnown({
                      calendar: cal.id,
                      ...(cal.id === 'solar' ? { isLeapMonth: false } : {}),
                    })
                  }
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs transition-colors cursor-pointer',
                    draft.known.calendar === cal.id
                      ? 'bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-strong)]',
                  )}
                >
                  {cal.label}
                </button>
              ))}
            </span>
            {draft.known.calendar === 'lunar' ? (
              <label className="mx-1 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] cursor-pointer align-middle">
                <input
                  type="checkbox"
                  checked={draft.known.isLeapMonth}
                  onChange={(e) => updateKnown({ isLeapMonth: e.target.checked })}
                />
                <span>闰月</span>
              </label>
            ) : null}
            <span>出生在</span>
            <ClozeBlank
              value={draft.known.year}
              onChange={(v) => updateKnown({ year: clampNumericField('year', v) })}
              placeholder="如 1995"
              widthClass="w-[88px] text-center"
              ariaLabel="出生年份"
              inputMode="numeric"
            />
            <span>年</span>
            <ClozeBlank
              value={draft.known.month}
              onChange={(v) => updateKnown({ month: clampNumericField('month', v) })}
              placeholder="月"
              widthClass="w-[60px] text-center"
              ariaLabel="出生月份"
              inputMode="numeric"
            />
            <span>月</span>
            <ClozeBlank
              value={draft.known.day}
              onChange={(v) => updateKnown({ day: clampNumericField('day', v) })}
              placeholder="日"
              widthClass="w-[60px] text-center"
              ariaLabel="出生日期"
              inputMode="numeric"
            />
            <span>日，出生地大概在</span>
            <ClozeBlank
              value={draft.known.birthPlace}
              onChange={(v) => updateKnown({ birthPlace: v })}
              placeholder="如 四川成都 / 不填"
              widthClass="min-w-[150px]"
              ariaLabel="出生地点"
            />
            <button
              type="button"
              onClick={handleOpenPlaceModal}
              className="mx-1 inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-contrast)] hover:text-[var(--text-strong)] cursor-pointer align-middle"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span>选城市</span>
            </button>
            <span>。</span>
          </div>
        </div>

        {/* 填空 2：模糊时段印象 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>家里人隐约记得我大约是在</span>
            <ClozeBlank
              value={draft.known.fuzzyTimeSlot}
              onChange={(v) => updateKnown({ fuzzyTimeSlot: v })}
              placeholder="如：上午 / 天快亮 / 饭点前后"
              widthClass="min-w-[200px]"
              ariaLabel="模糊出生时段"
            />
            <span>出生的；如果记得大概钟点，大约在</span>
            <ClozeBlank
              value={draft.known.fuzzyHourFrom}
              onChange={(v) => updateKnown({ fuzzyHourFrom: v })}
              placeholder="几"
              widthClass="w-[56px] text-center"
              ariaLabel="大约几点起"
              inputMode="numeric"
            />
            <span>点到</span>
            <ClozeBlank
              value={draft.known.fuzzyHourTo}
              onChange={(v) => updateKnown({ fuzzyHourTo: v })}
              placeholder="几"
              widthClass="w-[56px] text-center"
              ariaLabel="大约几点止"
              inputMode="numeric"
            />
            <span>点之间。</span>
          </div>
          <ChipSuggestions
            chips={FUZZY_TIME_SLOTS}
            value={draft.known.fuzzyTimeSlot}
            onSelect={(v) => updateKnown({ fuzzyTimeSlot: v })}
            mode="replace"
          />
        </div>

        {/* 填空 3：出生当天细节 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>关于出生当天，家人还常提起的一个小细节是：</span>
            <ClozeBlank
              value={draft.known.birthMemory}
              onChange={(v) => updateKnown({ birthMemory: v })}
              placeholder="比如：刚吃完午饭、外面在下雨、剖腹产选的时间"
              widthClass="min-w-[240px] sm:min-w-[320px]"
              ariaLabel="出生当天细节"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.birthMemory}
            value={draft.known.birthMemory}
            onSelect={(v) => updateKnown({ birthMemory: v })}
          />
        </div>
      </Card>

      {/* 二、外貌体貌、体质与性格底色 */}
      <Card className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
            二、外貌特征、体质与性格底色（填空题）
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            不同时辰对应的命宫主星与时柱十神，会在外貌气质、体质强弱和内外性格反差上留下很明显的线索。
          </p>
        </div>

        {/* 体型与外貌 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我的身高体态偏</span>
            <ClozeBlank
              value={draft.profile.bodyBuild}
              onChange={(v) => updateProfile({ bodyBuild: v })}
              placeholder="高挑偏瘦 / 匀称 / 微胖"
              widthClass="min-w-[160px]"
              ariaLabel="身高体态"
            />
            <span>，五官或外貌上比较容易被记住的特点是</span>
            <ClozeBlank
              value={draft.profile.appearanceFeature}
              onChange={(v) => updateProfile({ appearanceFeature: v })}
              placeholder="圆脸、眉眼有神、皮肤白等"
              widthClass="min-w-[200px]"
              ariaLabel="外貌特征"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.bodyBuild}
            value={draft.profile.bodyBuild}
            onSelect={(v) => updateProfile({ bodyBuild: v })}
            mode="replace"
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.appearanceFeature}
            value={draft.profile.appearanceFeature}
            onSelect={(v) => updateProfile({ appearanceFeature: v })}
          />
        </div>

        {/* 性格反差 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>不熟的人对我第一印象通常是</span>
            <ClozeBlank
              value={draft.profile.firstImpression}
              onChange={(v) => updateProfile({ firstImpression: v })}
              placeholder="温和稳重 / 高冷慢热 / 热情"
              widthClass="min-w-[180px]"
              ariaLabel="外在第一印象"
            />
            <span>，但熟了之后或我私下真正的内心其实更偏向</span>
            <ClozeBlank
              value={draft.profile.innerSelf}
              onChange={(v) => updateProfile({ innerSelf: v })}
              placeholder="主意很硬 / 容易内耗 / 急性子"
              widthClass="min-w-[200px]"
              ariaLabel="私下真实性格"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.firstImpression}
            value={draft.profile.firstImpression}
            onSelect={(v) => updateProfile({ firstImpression: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.innerSelf}
            value={draft.profile.innerSelf}
            onSelect={(v) => updateProfile({ innerSelf: v })}
          />
        </div>

        {/* 体质与小毛病 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>从小到大，我最容易反复不舒服或感觉偏弱的身体部位是</span>
            <ClozeBlank
              value={draft.profile.healthWeakness}
              onChange={(v) => updateProfile({ healthWeakness: v })}
              placeholder="如：肠胃消化、鼻炎、睡眠、眼睛"
              widthClass="min-w-[220px]"
              ariaLabel="偏弱身体部位"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.healthWeakness}
            value={draft.profile.healthWeakness}
            onSelect={(v) => updateProfile({ healthWeakness: v })}
          />
        </div>

        {/* 家庭排行与六亲 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我在家里排行</span>
            <ClozeBlank
              value={draft.profile.siblingRank}
              onChange={(v) => updateProfile({ siblingRank: v })}
              placeholder="独生子女 / 老大 / 老幺"
              widthClass="min-w-[140px]"
              ariaLabel="家中排行"
            />
            <span>，童年和父母的相处整体偏</span>
            <ClozeBlank
              value={draft.profile.parentsRelation}
              onChange={(v) => updateProfile({ parentsRelation: v })}
              placeholder="亲近疼爱 / 管教严格 / 聚少离多"
              widthClass="min-w-[190px]"
              ariaLabel="父母相处关系"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.siblingRank}
            value={draft.profile.siblingRank}
            onSelect={(v) => updateProfile({ siblingRank: v })}
            mode="replace"
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.parentsRelation}
            value={draft.profile.parentsRelation}
            onSelect={(v) => updateProfile({ parentsRelation: v })}
          />
        </div>
      </Card>

      {/* 三、已经发生的事情 · 人生重大节点 */}
      <Card className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-1">
          <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
            三、已经发生的事情 · 人生重大节点（核心校验线索）
          </h2>
          <p className="m-0 text-xs text-[var(--text-muted)]">
            重大事件发生的「年份或大概年龄」最容易对上大运流年，挑你印象最深的几道题填即可，不记得年份写“十几岁 / 二十多岁”也可以。
          </p>
        </div>

        {/* 1. 学业与考学 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">1. 学业与考学转折</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我大约在</span>
            <ClozeBlank
              value={draft.milestones.studyWhen}
              onChange={(v) => updateMilestones({ studyWhen: v })}
              placeholder="如 2016年 或 18岁"
              widthClass="min-w-[130px]"
              ariaLabel="学业转折年份"
            />
            <span>经历过一次印象很深的学业/考试转折，结果是</span>
            <ClozeBlank
              value={draft.milestones.studyResult}
              onChange={(v) => updateMilestones({ studyResult: v })}
              placeholder="超常发挥 / 失常 / 考研上岸"
              widthClass="min-w-[175px]"
              ariaLabel="学业转折结果"
            />
            <span>；我最高学历或擅长方向偏向</span>
            <ClozeBlank
              value={draft.milestones.studyMajor}
              onChange={(v) => updateMilestones({ studyMajor: v })}
              placeholder="理工 / 文史 / 经管 / 艺术"
              widthClass="min-w-[160px]"
              ariaLabel="专业方向"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.studyResult}
            value={draft.milestones.studyResult}
            onSelect={(v) => updateMilestones({ studyResult: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.studyMajor}
            value={draft.milestones.studyMajor}
            onSelect={(v) => updateMilestones({ studyMajor: v })}
          />
        </div>

        {/* 2. 职业与事业变动 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">2. 职业起步与重大变动</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我大概在</span>
            <ClozeBlank
              value={draft.milestones.careerStartWhen}
              onChange={(v) => updateMilestones({ careerStartWhen: v })}
              placeholder="如 2019年"
              widthClass="min-w-[110px]"
              ariaLabel="开始工作年份"
            />
            <span>开始正式工作；在</span>
            <ClozeBlank
              value={draft.milestones.careerChangeWhen}
              onChange={(v) => updateMilestones({ careerChangeWhen: v })}
              placeholder="如 2023年"
              widthClass="min-w-[110px]"
              ariaLabel="职场变动年份"
            />
            <span>经历过一次明显变动：</span>
            <ClozeBlank
              value={draft.milestones.careerChangeEvent}
              onChange={(v) => updateMilestones({ careerChangeEvent: v })}
              placeholder="升职 / 跳槽 / 创业 / 被裁"
              widthClass="min-w-[165px]"
              ariaLabel="职场变动事件"
            />
            <span>，目前或做得最久的行业偏向</span>
            <ClozeBlank
              value={draft.milestones.careerField}
              onChange={(v) => updateMilestones({ careerField: v })}
              placeholder="体制内 / 互联网 / 销售 / 自由职业"
              widthClass="min-w-[180px]"
              ariaLabel="从事行业"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.careerChangeEvent}
            value={draft.milestones.careerChangeEvent}
            onSelect={(v) => updateMilestones({ careerChangeEvent: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.careerField}
            value={draft.milestones.careerField}
            onSelect={(v) => updateMilestones({ careerField: v })}
          />
        </div>

        {/* 3. 感情与婚姻 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">3. 感情经历与婚姻状态</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我大约在</span>
            <ClozeBlank
              value={draft.milestones.loveWhen}
              onChange={(v) => updateMilestones({ loveWhen: v })}
              placeholder="如 2018年 或 22岁"
              widthClass="min-w-[130px]"
              ariaLabel="重要恋情年份"
            />
            <span>遇到过印象很深的一段感情；在</span>
            <ClozeBlank
              value={draft.milestones.marriageWhen}
              onChange={(v) => updateMilestones({ marriageWhen: v })}
              placeholder="年份（单身可不填）"
              widthClass="min-w-[130px]"
              ariaLabel="婚恋节点年份"
            />
            <span>经历了</span>
            <ClozeBlank
              value={draft.milestones.marriageStatus}
              onChange={(v) => updateMilestones({ marriageStatus: v })}
              placeholder="领证结婚 / 重大分手 / 至今单身"
              widthClass="min-w-[180px]"
              ariaLabel="婚恋状态"
            />
            <span>。另一半给我的感觉通常是</span>
            <ClozeBlank
              value={draft.milestones.partnerTraits}
              onChange={(v) => updateMilestones({ partnerTraits: v })}
              placeholder="脾气较急 / 很照顾人 / 聚少离多"
              widthClass="min-w-[180px]"
              ariaLabel="伴侣特征"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.marriageStatus}
            value={draft.milestones.marriageStatus}
            onSelect={(v) => updateMilestones({ marriageStatus: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.partnerTraits}
            value={draft.milestones.partnerTraits}
            onSelect={(v) => updateMilestones({ partnerTraits: v })}
          />
        </div>

        {/* 4. 财运起伏与买房置业 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">4. 财运起伏与买房置业</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>进账最顺的一年大概在</span>
            <ClozeBlank
              value={draft.milestones.wealthGoodWhen}
              onChange={(v) => updateMilestones({ wealthGoodWhen: v })}
              placeholder="如 2021年"
              widthClass="min-w-[100px]"
              ariaLabel="顺财年份"
            />
            <span>，因为</span>
            <ClozeBlank
              value={draft.milestones.wealthGoodReason}
              onChange={(v) => updateMilestones({ wealthGoodReason: v })}
              placeholder="奖金大涨 / 副业爆单 / 投资赚钱"
              widthClass="min-w-[180px]"
              ariaLabel="顺财原因"
            />
            <span>；而明显破财或经济压力最大的一年是</span>
            <ClozeBlank
              value={draft.milestones.wealthBadWhen}
              onChange={(v) => updateMilestones({ wealthBadWhen: v })}
              placeholder="如 2024年"
              widthClass="min-w-[100px]"
              ariaLabel="破财年份"
            />
            <span>，原因是</span>
            <ClozeBlank
              value={draft.milestones.wealthBadReason}
              onChange={(v) => updateMilestones({ wealthBadReason: v })}
              placeholder="投资被套 / 被骗 / 生意亏损"
              widthClass="min-w-[180px]"
              ariaLabel="破财原因"
            />
            <span>。另外我在</span>
            <ClozeBlank
              value={draft.milestones.propertyWhen}
              onChange={(v) => updateMilestones({ propertyWhen: v })}
              placeholder="年份"
              widthClass="min-w-[90px]"
              ariaLabel="置业年份"
            />
            <span>有过</span>
            <ClozeBlank
              value={draft.milestones.propertyEvent}
              onChange={(v) => updateMilestones({ propertyEvent: v })}
              placeholder="买房 / 买车 / 长途搬家"
              widthClass="min-w-[150px]"
              ariaLabel="置业事件"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.wealthGoodReason}
            value={draft.milestones.wealthGoodReason}
            onSelect={(v) => updateMilestones({ wealthGoodReason: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.wealthBadReason}
            value={draft.milestones.wealthBadReason}
            onSelect={(v) => updateMilestones({ wealthBadReason: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.propertyEvent}
            value={draft.milestones.propertyEvent}
            onSelect={(v) => updateMilestones({ propertyEvent: v })}
          />
        </div>

        {/* 5. 健康、伤病与突发意外 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">5. 健康、伤病或至亲变故</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我自己或至亲在</span>
            <ClozeBlank
              value={draft.milestones.healthWhen}
              onChange={(v) => updateMilestones({ healthWhen: v })}
              placeholder="年份或年龄"
              widthClass="min-w-[115px]"
              ariaLabel="健康意外年份"
            />
            <span>遇到过一次较担心的状况（</span>
            <ClozeBlank
              value={draft.milestones.healthType}
              onChange={(v) => updateMilestones({ healthType: v })}
              placeholder="住院手术 / 骨折 / 车祸 / 至亲变故"
              widthClass="min-w-[180px]"
              ariaLabel="健康意外类型"
            />
            <span>），大概情况是</span>
            <ClozeBlank
              value={draft.milestones.healthDetail}
              onChange={(v) => updateMilestones({ healthDetail: v })}
              placeholder="简述部位或经过（可选）"
              widthClass="min-w-[180px]"
              ariaLabel="健康意外详情"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.healthType}
            value={draft.milestones.healthType}
            onSelect={(v) => updateMilestones({ healthType: v })}
          />
        </div>

        {/* 6. 离乡变动、贵人与是非 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">6. 离乡方向、贵人或是非纠纷</div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>我大约在</span>
            <ClozeBlank
              value={draft.milestones.moveWhen}
              onChange={(v) => updateMilestones({ moveWhen: v })}
              placeholder="年份"
              widthClass="min-w-[95px]"
              ariaLabel="离乡年份"
            />
            <span>离开老家去外地求学/工作，前往的方向大致在老家的</span>
            <ClozeBlank
              value={draft.milestones.moveDirection}
              onChange={(v) => updateMilestones({ moveDirection: v })}
              placeholder="南方 / 北方 / 沿海 / 海外"
              widthClass="min-w-[155px]"
              ariaLabel="离乡方向"
            />
            <span>；我在</span>
            <ClozeBlank
              value={draft.milestones.helperWhen}
              onChange={(v) => updateMilestones({ helperWhen: v })}
              placeholder="年份"
              widthClass="min-w-[90px]"
              ariaLabel="遇贵人年份"
            />
            <span>遇到过特别拉我一把的贵人；在</span>
            <ClozeBlank
              value={draft.milestones.disputeWhen}
              onChange={(v) => updateMilestones({ disputeWhen: v })}
              placeholder="年份"
              widthClass="min-w-[90px]"
              ariaLabel="遇是非年份"
            />
            <span>遭遇过</span>
            <ClozeBlank
              value={draft.milestones.disputeType}
              onChange={(v) => updateMilestones({ disputeType: v })}
              placeholder="合同纠纷 / 口舌是非 / 被背刺"
              widthClass="min-w-[175px]"
              ariaLabel="是非纠纷类型"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.moveDirection}
            value={draft.milestones.moveDirection}
            onSelect={(v) => updateMilestones({ moveDirection: v })}
          />
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.disputeType}
            value={draft.milestones.disputeType}
            onSelect={(v) => updateMilestones({ disputeType: v })}
          />
        </div>

        {/* 7. 近两三年真实体感 */}
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
          <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">
            7. 近两三年真实体感（流年最容易精准校准）
          </div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>回想最近两三年（如 2024–2026 年），我整体感受最深的变化主要是</span>
            <ClozeBlank
              value={draft.milestones.recentTrend}
              onChange={(v) => updateMilestones({ recentTrend: v })}
              placeholder="事业卡顿 / 感情波动 / 财运起伏"
              widthClass="min-w-[190px]"
              ariaLabel="近两三年主线感受"
            />
            <span>，具体发生的一件典型事是：</span>
            <ClozeBlank
              value={draft.milestones.recentEvent}
              onChange={(v) => updateMilestones({ recentEvent: v })}
              placeholder="用一句话写件记得住的事"
              widthClass="min-w-[210px] sm:min-w-[260px]"
              ariaLabel="近两三年典型事件"
            />
            <span>。</span>
          </div>
          <ChipSuggestions
            chips={TIME_REVERSE_CHIPS.recentTrend}
            value={draft.milestones.recentTrend}
            onSelect={(v) => updateMilestones({ recentTrend: v })}
          />
        </div>

        {/* 8. 自由追加大事记 */}
        {draft.milestones.customMilestones.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)]">
                补充大事记 #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCustomMilestone(item.id)}
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger-text)] cursor-pointer bg-transparent border-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>删除</span>
              </button>
            </div>
            <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
              <span>大约在</span>
              <ClozeBlank
                value={item.when}
                onChange={(v) => handleUpdateCustomMilestone(item.id, { when: v })}
                placeholder="年份或年龄"
                widthClass="min-w-[110px]"
                ariaLabel={`补充大事记${idx + 1}时间`}
              />
              <span>，发生了</span>
              <ClozeBlank
                value={item.event}
                onChange={(v) => handleUpdateCustomMilestone(item.id, { event: v })}
                placeholder="具体事情"
                widthClass="min-w-[180px]"
                ariaLabel={`补充大事记${idx + 1}事件`}
              />
              <span>，对我的影响是</span>
              <ClozeBlank
                value={item.impact}
                onChange={(v) => handleUpdateCustomMilestone(item.id, { impact: v })}
                placeholder="结果或感受（可选）"
                widthClass="min-w-[170px]"
                ariaLabel={`补充大事记${idx + 1}影响`}
              />
              <span>。</span>
            </div>
          </div>
        ))}

        <div>
          <Button variant="outline" size="sm" onClick={handleAddCustomMilestone}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>再加一条记忆深刻的大事</span>
          </Button>
        </div>
      </Card>

      {/* 四、补充问题 & 生成按钮 */}
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>四、还有想补充给 AI 的话（非必填）</span>
          <textarea
            rows={2}
            value={draft.extraNote}
            onChange={(e) => {
              setDraft((prev) => ({ ...prev, extraNote: e.target.value }));
              if (generatedPrompt) setIsDirtySinceGenerate(true);
            }}
            placeholder="例如：长辈一直争执我是早上七点多还是九点多生的；或者想顺便看看定完时辰后今年运势重点…"
            className="workspace-ui-control w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-[13.5px] font-normal text-[var(--text-primary)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2.5">
          {aiConfigured ? (
            <>
              <Button
                variant="primary"
                size="lg"
                disabled={isComputing || isStreaming}
                onClick={() => void handleGenerateAndAnalyze()}
                className="flex-1 sm:flex-none"
              >
                <Bot className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isComputing
                    ? '正在准备十二时辰对照…'
                    : '生成线索并开始 AI 逆推分析'}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={isComputing}
                onClick={() => void handleGenerateOnly()}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>仅生成逆推提示词</span>
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={isComputing}
              onClick={() => void handleGenerateOnly()}
              className="flex-1 sm:flex-none"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>
                {isComputing
                  ? '正在匹配十二时辰盘面…'
                  : hasDate
                    ? '生成逆推提示词（含十二时辰对照）'
                    : '生成时辰逆推提示词'}
              </span>
            </Button>
          )}
        </div>
      </Card>

      {/* 五、输出结果：提示词 / AI 解读 + 候选时辰回填 */}
      {generatedPrompt ? (
        <div ref={outputSectionRef} className="grid gap-3">
          <Card className="grid gap-3.5 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-soft)] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {webAiEnabled ? (
                  <SegmentedTabs
                    value={outputTab}
                    onValueChange={(next) => setOutputTab(next)}
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
                      去开启网页 AI 直连解读 →
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  约 {generatedPrompt.length} 字
                </span>
                <Button variant="secondary" size="sm" onClick={() => void handleCopyPrompt()}>
                  {copiedPrompt ? (
                    <Check className="h-3.5 w-3.5 text-[var(--success-text)]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedPrompt ? '已复制提示词' : '复制提示词'}</span>
                </Button>
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
                        ? `当前模型：${aiConfig.model.trim()}`
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
                      配置接口
                    </Button>
                    {isStreaming ? (
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => abortRef.current?.abort()}
                      >
                        <Square className="h-3 w-3" aria-hidden="true" />
                        <span>停止生成</span>
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="xs"
                        disabled={!aiConfigured || isComputing}
                        onClick={() => void handleStartAiFromPrompt()}
                      >
                        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{visibleMessages.length > 0 ? '重新逆推' : '开始 AI 逆推'}</span>
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
                  <div className="grid gap-3 max-h-[560px] overflow-y-auto pr-1">
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
                              onClick={() => void handleCopyAssistant(idx, msg.content)}
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
                      onChange={(e) => setFollowupDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void handleSendFollowup();
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
                        onClick={() => void handleSendFollowup()}
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
                <p className="m-0 text-xs text-[var(--text-muted)]">
                  复制下方完整提示词，可直接粘贴到你常用的 AI 助手（如 DeepSeek、豆包、Kimi、ChatGPT、Claude）中继续对话定盘。
                </p>
                <pre className="m-0 max-h-[420px] overflow-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 font-sans text-[13px] leading-[1.65] whitespace-pre-wrap break-words text-[var(--text-primary)]">
                  {generatedPrompt}
                </pre>
              </div>
            ) : null}
          </Card>

          {/* 六、十二时辰候选速览与一键回填排盘 */}
          <Card className="grid gap-3 p-4 sm:p-5">
            <div className="grid gap-1">
              <h3 className="m-0 text-[14.5px] font-bold text-[var(--text-strong)]">
                推算出可能时辰后，点这里直接回填去排盘
              </h3>
              <p className="m-0 text-xs text-[var(--text-muted)]">
                {candidatesResult && candidatesResult.candidates.length > 0
                  ? `已为你算出 ${candidatesResult.calendarNote} 各候选时辰对应命盘；点任意一项即可带回排盘页。`
                  : '选定一个最符合的时辰，将自动回填到出生资料中。'}
              </p>
            </div>

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
                        onClick={() => onApplyShichen(cand.shichenIndex, draft.known, false)}
                      >
                        回填到排盘页
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onApplyShichen(cand.shichenIndex, draft.known, true)}
                      >
                        直接看此命盘 →
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
                    onClick={() => onApplyShichen(opt.index, draft.known, false)}
                    className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] transition-colors cursor-pointer"
                  >
                    {opt.label}（{opt.range}）
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
