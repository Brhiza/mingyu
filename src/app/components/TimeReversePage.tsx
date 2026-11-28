import * as React from 'react';
import {
  ArrowLeft,
  Bot,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { streamChat, type AiMessage } from '../../ai';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  clampNumericField,
  type PersonalCase,
} from '../../v2-ui/cases-store';
import type { PersonRole } from './person/person-form-helpers';
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
import { Button, Card, Checkbox, PageHeader } from '../../components/ui';
import { cn } from '../../lib/utils';
import { ChipSuggestions, ClozeBlank } from './time-reverse/TimeReverseClozeParts';
import { TimeReverseMilestonesSection } from './time-reverse/TimeReverseMilestonesSection';
import { TimeReverseResultPanel } from './time-reverse/TimeReverseResultPanel';

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
        rightSlot={
          <Button
            variant="secondary"
            size="sm"
            className="ws-desktop-only-action hidden min-[680px]:inline-flex"
            onClick={onBackToChartInput}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>返回排盘</span>
          </Button>
        }
      />

      {/* 顶部线索统计条 */}
      <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[var(--surface-soft)]">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
          <span className="whitespace-nowrap">
            已填 <strong className="text-[var(--text-strong)]">{filledCount}</strong> 项线索
          </span>
          {hasDate ? (
            <span className="whitespace-nowrap rounded-full bg-[var(--state-selected-surface)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--state-selected-text)]">
              已附十二时辰对照
            </span>
          ) : null}
        </div>
        {filledCount > 0 ? (
          <Button variant="ghost" size="xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>清空</span>
          </Button>
        ) : null}
      </Card>

      {/* 一、已知出生线索（全部非必填） */}
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
          一、出生线索
        </h2>

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
              <Checkbox
                className="mx-1 align-middle"
                checked={draft.known.isLeapMonth}
                label="闰月"
                onChange={(e) => updateKnown({ isLeapMonth: e.target.checked })}
              />
            ) : null}
            <span className="whitespace-nowrap">出生在</span>
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
              <span>选择城市</span>
            </button>
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
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
          二、外貌、体质与性格
        </h2>

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
      <TimeReverseMilestonesSection
        draft={draft}
        onUpdateMilestones={updateMilestones}
        onAddCustomMilestone={handleAddCustomMilestone}
        onUpdateCustomMilestone={handleUpdateCustomMilestone}
        onRemoveCustomMilestone={handleRemoveCustomMilestone}
      />

      {/* 四、补充问题 & 生成按钮 */}
      <Card className="grid gap-3.5 p-4 sm:p-5">
        <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
          <span>四、补充说明</span>
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
                    ? '推演中…'
                    : 'AI 逆推时辰'}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={isComputing}
                onClick={() => void handleGenerateOnly()}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>生成提示词</span>
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
                  ? '生成中…'
                  : '生成提示词'}
              </span>
            </Button>
          )}
        </div>
      </Card>

      {/* 五、输出结果：提示词 / AI 解读 + 候选时辰回填 */}
      {generatedPrompt ? (
        <TimeReverseResultPanel
          outputSectionRef={outputSectionRef}
          generatedPrompt={generatedPrompt}
          webAiEnabled={webAiEnabled}
          outputTab={outputTab}
          onChangeOutputTab={(next) => setOutputTab(next)}
          copiedPrompt={copiedPrompt}
          onCopyPrompt={() => void handleCopyPrompt()}
          aiConfigured={aiConfigured}
          aiModelName={aiConfig.model.trim()}
          isStreaming={isStreaming}
          isComputing={isComputing}
          aiStatus={aiStatus}
          visibleMessages={visibleMessages}
          streamingContent={streamingContent}
          copiedMsgIdx={copiedMsgIdx}
          followupDraft={followupDraft}
          onChangeFollowupDraft={setFollowupDraft}
          onStopStreaming={() => abortRef.current?.abort()}
          onStartAiFromPrompt={() => void handleStartAiFromPrompt()}
          onCopyAssistant={(idx, content) => void handleCopyAssistant(idx, content)}
          onSendFollowup={() => void handleSendFollowup()}
          candidatesResult={candidatesResult}
          draftKnown={draft.known}
          onApplyShichen={onApplyShichen}
        />
      ) : null}
    </div>
  );
}
