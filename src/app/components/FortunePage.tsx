import * as React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react';
import { streamChat, type AiMessage } from '../../ai';
import type { FortuneScope } from '../../systems/fortune/types';
import { buildFortuneDecisionFlow } from '../../systems/fortune/reading-flow';
import type { PersonalCase } from '../../v2-ui/cases-store';
import { splitPromptIntoSystemAndUser } from '../../prompt-profile';
import { isWebAiConfigured, isWebAiEnabled, readWebAiConfig } from '../../web-ai';
import {
  buildFortuneCacheKey,
  ensureFortunePrompt,
  getCachedFortuneResult,
  loadFortuneDataOnly,
  type FortuneCalculatedData,
} from '../hooks/fortune-cache';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Select,
  toast,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import type { CaseFillTarget } from './CasesDrawer';
import { WorkspaceSkeleton } from './WorkspaceSkeleton';
import { DailyHexagramCard } from './fortune/DailyHexagramCard';
import { FortuneAiReportSection } from './fortune/FortuneAiReportSection';
import { FortuneDecisionFlowCard } from './fortune/FortuneDecisionFlowCard';
import { FortuneDetailsDialog } from './fortune/FortuneDetailsDialog';
import { FortuneDimensionsCard } from './fortune/FortuneDimensionsCard';
import { FortuneTimelineSection } from './fortune/FortuneTimelineSection';
import {
  buildFortuneReportKey,
  getTodayYmd,
  pad2,
  readSavedFortuneReports,
  removeSavedFortuneReport,
  trendBadgeCls,
  writeSavedFortuneReport,
} from './fortune/fortune-storage';

export interface FortunePageProps {
  cases: readonly PersonalCase[];
  initialCaseId?: string | null;
  scope?: FortuneScope;
  onScopeChange?: (scope: FortuneScope) => void;
  onSelectCase?: (caseId: string | null) => void;
  onNewCase?: () => void;
  onEditCase?: (record: PersonalCase) => void;
  onOpenConnect?: () => void;
  onBackHome: () => void;
}

type FortuneMobileSection = 'overview' | 'timeline' | 'dimensions' | 'almanac';

export function FortunePage({
  cases,
  initialCaseId,
  scope: controlledScope,
  onScopeChange,
  onSelectCase,
  onOpenConnect,
  onBackHome,
}: FortunePageProps) {
  const [mobileSection, setMobileSection] = React.useState<FortuneMobileSection>('overview');
  const today = React.useMemo(() => getTodayYmd(), []);
  const [localScope, setLocalScope] = React.useState<FortuneScope>(controlledScope ?? 'daily');
  React.useEffect(() => {
    if (controlledScope) {
      setLocalScope(controlledScope);
    }
  }, [controlledScope]);
  const scope = controlledScope ?? localScope;
  const setScope = React.useCallback(
    (next: FortuneScope) => {
      setLocalScope(next);
      onScopeChange?.(next);
    },
    [onScopeChange],
  );
  const [targetYear, setTargetYear] = React.useState(today.year);
  const [targetMonth, setTargetMonth] = React.useState(today.month);
  const [targetDay, setTargetDay] = React.useState(today.day);

  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(() => {
    if (initialCaseId !== undefined) {
      return initialCaseId && cases.some((c) => c.id === initialCaseId) ? initialCaseId : null;
    }
    return cases[0]?.id ?? null;
  });
  const prevInitialCaseIdRef = React.useRef(initialCaseId);
  React.useEffect(() => {
    if (initialCaseId !== prevInitialCaseIdRef.current) {
      prevInitialCaseIdRef.current = initialCaseId;
      setSelectedCaseId(
        initialCaseId && cases.some((c) => c.id === initialCaseId) ? initialCaseId : null,
      );
    }
  }, [initialCaseId, cases]);
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const [monthDayFilter, setMonthDayFilter] = React.useState<'all' | '优选' | '慎用'>('all');

  const selectedCase = React.useMemo(
    () => (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) ?? null : null),
    [cases, selectedCaseId],
  );

  // Sync when a new case is added or deleted
  React.useEffect(() => {
    if (selectedCaseId && !cases.some((c) => c.id === selectedCaseId)) {
      setSelectedCaseId(cases[0]?.id ?? null);
    }
  }, [cases, selectedCaseId]);

  const initialCacheKey = buildFortuneCacheKey({
    scope,
    year: targetYear,
    month: targetMonth,
    day: targetDay,
    selectedCase,
  });
  const initialCached = getCachedFortuneResult(initialCacheKey);

  const [computing, setComputing] = React.useState(false);
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [fortuneData, setFortuneData] = React.useState<FortuneCalculatedData | null>(
    () => initialCached?.data ?? null,
  );
  const [promptText, setPromptText] = React.useState(() => initialCached?.promptText ?? '');

  // AI Report state
  const [aiReady, setAiReady] = React.useState(() => isWebAiEnabled() && isWebAiConfigured());
  React.useEffect(() => {
    const sync = () => setAiReady(isWebAiEnabled() && isWebAiConfigured());
    window.addEventListener('mingyu:web-ai-changed', sync);
    window.addEventListener('storage', sync);
  return () => {
      window.removeEventListener('mingyu:web-ai-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const [aiMessages, setAiMessages] = React.useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiStreaming, setAiStreaming] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState('');
  const [followupDraft, setFollowupDraft] = React.useState('');
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedReport, setCopiedReport] = React.useState(false);
  const aiAbortRef = React.useRef<AbortController | null>(null);

  const calcTokenRef = React.useRef(0);

  const runCompute = React.useCallback(async () => {
    const token = ++calcTokenRef.current;
    const params = {
      scope,
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      selectedCase,
    };
    const cacheKey = buildFortuneCacheKey(params);
    const cached = getCachedFortuneResult(cacheKey);
    if (cached) {
      setCalcError(null);
      setComputing(false);
      setFortuneData(cached.data);
      setPromptText(cached.promptText);
      if (!cached.promptText) {
        void ensureFortunePrompt(params)
          .then((fullEntry) => {
            if (token !== calcTokenRef.current) return;
            setFortuneData(fullEntry.data);
            setPromptText(fullEntry.promptText);
          })
          .catch(() => {});
      }
      return;
    }

    setComputing(true);
    setCalcError(null);
    try {
      const promptTask = ensureFortunePrompt(params);
      const fastEntry = await loadFortuneDataOnly(params);
      if (token !== calcTokenRef.current) return;
      setFortuneData(fastEntry.data);
      setPromptText(fastEntry.promptText);
      setComputing(false);
      if (!fastEntry.promptText) {
        const fullEntry = await promptTask;
        if (token !== calcTokenRef.current) return;
        setFortuneData(fullEntry.data);
        setPromptText(fullEntry.promptText);
      }
    } catch (err) {
      if (token !== calcTokenRef.current) return;
      setCalcError(err instanceof Error ? err.message : '运势计算失败，请检查日期或档案信息。');
    } finally {
      if (token === calcTokenRef.current) {
        setComputing(false);
      }
    }
  }, [scope, targetYear, targetMonth, targetDay, selectedCase]);

  const handleOpenCasePicker = () => {
    window.dispatchEvent(
      new CustomEvent<CaseFillTarget>('mingyu:open-case-picker', {
        detail: {
          role: 'self',
          applyCase: (person) => {
            const nextId = person?.id || null;
            setSelectedCaseId(nextId);
            onSelectCase?.(nextId);
          },
        },
      }),
    );
  };

  React.useEffect(() => {
    void runCompute();
  }, [runCompute]);

  const reportKey = React.useMemo(
    () => buildFortuneReportKey(scope, targetYear, targetMonth, targetDay, selectedCaseId),
    [scope, targetYear, targetMonth, targetDay, selectedCaseId],
  );

  // Restore cached AI conversation (or clear) when switching scope, date, or case
  React.useEffect(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiStreaming(false);
    setMonthDayFilter('all');
    const saved = readSavedFortuneReports()[reportKey];
    if (saved?.messages?.length) {
      setAiMessages(saved.messages);
      setAiStatus(saved.status && saved.status.includes('停止') ? `已恢复上次部分报告（${saved.status}）` : '已恢复上次保存的报告');
    } else {
      setAiMessages([]);
      setAiStatus('');
    }
  }, [reportKey]);

  const handleCopyPrompt = async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      toast.success('已复制提示词');
      window.setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {}
  };

  const handleCopyReport = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 1800);
    } catch {}
  };

  const runAiStream = async (messagesForApi: AiMessage[], visibleHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    if (aiStreaming) return;
    const cfg = readWebAiConfig();
    if (!isWebAiEnabled() || !isWebAiConfigured(cfg)) {
      onOpenConnect?.();
      return;
    }

    const targetReportKey = reportKey;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiStreaming(true);
    setAiStatus('正在生成定制运势报告…');

    setAiMessages([...visibleHistory, { role: 'assistant', content: '' }]);
    let collected = '';

    try {
      const result = await streamChat(
        cfg,
        messagesForApi,
        (chunk) => {
          if (controller.signal.aborted) return;
          collected += chunk;
          setAiMessages([...visibleHistory, { role: 'assistant', content: collected }]);
        },
        controller.signal,
      );
      if (controller.signal.aborted) {
        const stoppedStatus = '已停止生成，已收到内容保留在页面中。';
        setAiStatus(stoppedStatus);
        if (collected.trim()) {
          writeSavedFortuneReport(
            targetReportKey,
            [...visibleHistory, { role: 'assistant', content: collected }],
            stoppedStatus,
          );
        }
        return;
      }
      const finalMessages = [...visibleHistory, { role: 'assistant' as const, content: result.content }];
      const doneStatus = result.finishReason === 'stop' ? '报告生成完成' : `生成未完整结束（${result.finishReason}）`;
      setAiMessages(finalMessages);
      setAiStatus(doneStatus);
      writeSavedFortuneReport(targetReportKey, finalMessages, doneStatus);
    } catch (err) {
      if (controller.signal.aborted) {
        setAiStatus('已停止生成');
      } else {
        setAiStatus(
          err instanceof TypeError
            ? '无法连接 AI 服务，请检查接口地址或网络。'
            : err instanceof Error
              ? err.message
              : 'AI 生成失败',
        );
      }
    } finally {
      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setAiStreaming(false);
      }
    }
  };

  const handleClearAiReport = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiStreaming(false);
    setAiMessages([]);
    setAiStatus('');
    removeSavedFortuneReport(reportKey);
  };

  const buildInitialFortuneMessages = (withTimestamp: boolean): AiMessage[] => {
    const split = splitPromptIntoSystemAndUser(promptText);
    const msgs: AiMessage[] = [];
    if (split.system) msgs.push({ role: 'system', content: split.system });
    msgs.push({
      role: 'user',
      content: split.user,
      ...(withTimestamp ? { submittedAt: new Date().toISOString() } : {}),
    });
    return msgs;
  };

  const handleGenerateAiReport = () => {
    if (!promptText) return;
    void runAiStream(buildInitialFortuneMessages(true), []);
  };

  const handleSendFollowup = () => {
    const q = followupDraft.trim();
    if (!q || !promptText || aiMessages.length === 0 || aiStreaming) return;
    setFollowupDraft('');
    const nextVisible = [...aiMessages, { role: 'user' as const, content: q }];
    const apiMessages: AiMessage[] = [
      ...buildInitialFortuneMessages(false),
      ...aiMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: q, submittedAt: new Date().toISOString() },
    ];
    void runAiStream(apiMessages, nextVisible);
  };

  const stepTarget = (delta: number) => {
    if (scope === 'daily') {
      const dt = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + delta));
      const y = dt.getUTCFullYear();
      if (y < 1900 || y > 2100) return;
      setTargetYear(y);
      setTargetMonth(dt.getUTCMonth() + 1);
      setTargetDay(dt.getUTCDate());
    } else if (scope === 'monthly') {
      const raw = targetYear * 12 + (targetMonth - 1) + delta;
      const y = Math.floor(raw / 12);
      if (y < 1900 || y > 2100) return;
      setTargetYear(y);
      setTargetMonth((raw % 12) + 1);
    } else {
      const y = targetYear + delta;
      if (y < 1900 || y > 2100) return;
      setTargetYear(y);
    }
  };

  const jumpToToday = () => {
    const t = getTodayYmd();
    setTargetYear(t.year);
    setTargetMonth(t.month);
    setTargetDay(t.day);
  };

  const dateInputVal = `${targetYear}-${pad2(targetMonth)}-${pad2(targetDay)}`;
  const monthInputVal = `${targetYear}-${pad2(targetMonth)}`;

  const ov = fortuneData?.overview;
  const cal = fortuneData?.calendar;
  const todayStr = `${today.year}-${pad2(today.month)}-${pad2(today.day)}`;
  const isCurrentTarget =
    scope === 'daily'
      ? targetYear === today.year && targetMonth === today.month && targetDay === today.day
      : scope === 'monthly'
        ? targetYear === today.year && targetMonth === today.month
        : targetYear === today.year;

  const decisionFlow = React.useMemo(() => {
    if (!fortuneData) return null;
    return buildFortuneDecisionFlow(fortuneData, { isCurrentTarget });
  }, [fortuneData, isCurrentTarget]);
  const goodDaysCount = fortuneData?.timeline.days?.filter((d) => d.rating === '优选').length ?? 0;
  const cautionDaysCount = fortuneData?.timeline.days?.filter((d) => d.rating === '慎用').length ?? 0;
  const strongMonthsCount = fortuneData?.timeline.months?.filter((m) => m.trend === '旺').length ?? 0;
  const cautionMonthsCount = fortuneData?.timeline.months?.filter((m) => m.trend === '谨').length ?? 0;

  const mobileTabs: Array<{ id: FortuneMobileSection; label: string }> = [
    { id: 'overview', label: '行动节奏' },
    { id: 'timeline', label: scope === 'daily' ? '十二时辰' : scope === 'monthly' ? '本月逐日' : '十二流月' },
    { id: 'dimensions', label: '五维趋势' },
    { id: 'almanac', label: '黄历详查' },
  ];

  const renderGanzhiBlock = () => {
    if (!fortuneData || !cal) return null;
    if (scope === 'daily') {
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] sm:text-[17px] font-black tracking-wide text-[var(--accent-deep)]">
              {cal.lunarDate}
            </span>
            <Badge variant="accent">{cal.solarTerm}</Badge>
          </div>
          <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">岁次干支</span>
              <strong className="min-w-0 text-right text-[13px] text-[var(--text-strong)]">
                {cal.ganzhi.year}年 · {cal.nayin.year}
              </strong>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">建月干支</span>
              <strong className="min-w-0 text-right text-[13px] text-[var(--text-strong)]">
                {cal.ganzhi.month}月 · {cal.nayin.month}
              </strong>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">当日干支</span>
              <strong className="min-w-0 text-right text-[13px] text-[var(--text-strong)]">
                {cal.ganzhi.day}日 · {cal.nayin.day}
              </strong>
            </div>
          </div>
        </>
      );
    }
    if (scope === 'monthly') {
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] sm:text-[17px] font-black tracking-wide text-[var(--accent-deep)]">
              {cal.ganzhi.month}月 · 节气律令
            </span>
          </div>
          <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">流年流月</span>
              <strong className="min-w-0 text-right text-[13px] text-[var(--text-strong)]">
                {cal.ganzhi.year}年 · {cal.ganzhi.month}月
              </strong>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">当月节气</span>
              <strong className="min-w-0 text-right leading-snug text-[12px] text-[var(--text-strong)]">
                {fortuneData.timeline.solarTerms?.length
                  ? fortuneData.timeline.solarTerms.map((s) => `${s.name} ${s.date.slice(5)}`).join(' · ')
                  : cal.solarTerm}
              </strong>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">月度纳音</span>
              <strong className="min-w-0 text-right text-[12px] text-[var(--text-strong)]">{cal.nayin.month}</strong>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] sm:text-[17px] font-black tracking-wide text-[var(--accent-deep)]">
            {cal.ganzhi.year}年 · 岁运历纲
          </span>
        </div>
        <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">流年太岁</span>
            <strong className="min-w-0 text-right text-[13px] text-[var(--text-strong)]">
              {cal.ganzhi.year} · {cal.nayin.year}
            </strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">五运六气</span>
            <strong className="min-w-0 text-right leading-snug text-[12px] text-[var(--text-strong)]">
              {fortuneData.wuyunSummary || cal.nayin.year}
            </strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">流年紫白</span>
            <strong className="min-w-0 text-right text-[12px] text-[var(--text-strong)]">{cal.nineStar}</strong>
          </div>
        </div>
      </>
    );
  };

  const renderStarOfficerBlock = () => {
    if (!cal) return null;
    if (scope === 'daily') {
      return (
        <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">建除 / 值神</span>
            <strong className="min-w-0 text-right text-[var(--text-strong)]">
              {cal.dayOfficer}日 · {cal.twelveStar}
            </strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">二十八宿</span>
            <strong className="min-w-0 text-right text-[var(--text-strong)]">{cal.twentyEightStar}</strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">日九星</span>
            <strong className="min-w-0 text-right text-[var(--text-strong)]">{cal.nineStar}</strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">冲煞生肖</span>
            <strong className="min-w-0 text-right text-[var(--accent-deep)]">{cal.clash}</strong>
          </div>
        </div>
      );
    }
    if (scope === 'monthly') {
      return (
        <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">优选吉日</span>
            <strong className="min-w-0 text-right text-[var(--success-text)]">{goodDaysCount} 天</strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">慎用时日</span>
            <strong className="min-w-0 text-right text-[var(--secondary-strong)]">{cautionDaysCount} 天</strong>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">月飞九星</span>
            <strong className="min-w-0 text-right text-[var(--text-strong)]">{cal.nineStar}</strong>
          </div>
        </div>
      );
    }
    return (
      <div className="grid divide-y divide-[var(--border-soft)] rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px]">
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">上扬旺月</span>
          <strong className="min-w-0 text-right text-[var(--success-text)]">{strongMonthsCount} 个月</strong>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">需慎月份</span>
          <strong className="min-w-0 text-right text-[var(--secondary-strong)]">{cautionMonthsCount} 个月</strong>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <span className="shrink-0 whitespace-nowrap text-[11px] text-[var(--text-muted)]">岁序节律</span>
          <strong className="min-w-0 text-right text-[var(--text-strong)]">十二节气月</strong>
        </div>
      </div>
    );
  };

  const renderSuitableCaution = (limit?: number, compact = false) => {
    if (!ov) return null;
    const suitableList = limit ? ov.actionGuide.suitable.slice(0, limit) : ov.actionGuide.suitable;
    const cautionList = limit ? ov.actionGuide.caution.slice(0, limit) : ov.actionGuide.caution;
    return (
      <div
        className={cn(
          'grid grid-cols-1 divide-y divide-[var(--border-soft)] border-t',
          compact
            ? 'border-[var(--border-soft)]'
            : 'border-[var(--border-contrast)] sm:grid-cols-2 sm:divide-x sm:divide-y-0',
        )}
      >
        <div className={cn('flex items-start gap-2.5', compact ? 'px-3 py-2.5' : 'gap-3 px-3 py-3 sm:px-5 sm:py-3.5')}>
          <span
            aria-label="宜"
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--success-text)] bg-[color-mix(in_srgb,var(--success-text)_10%,var(--surface-base))] font-black text-[var(--success-text)]',
              compact ? 'size-6 text-[12px]' : 'size-8 text-[15px]',
            )}
          >
            宜
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {suitableList.map((item) => (
              <span
                key={item}
                className={cn(
                  'rounded-lg border border-[color-mix(in_srgb,var(--success-text)_24%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_6%,var(--surface-base))] font-semibold text-[var(--text-strong)]',
                  compact ? 'px-2 py-0.5 text-[11.5px]' : 'px-2.5 py-1 text-[12px]',
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className={cn('flex items-start gap-2.5', compact ? 'px-3 py-2.5' : 'gap-3 px-3 py-3 sm:px-5 sm:py-3.5')}>
          <span
            aria-label="忌"
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--accent-strong)] bg-[var(--accent-surface)] font-black text-[var(--accent-strong)]',
              compact ? 'size-6 text-[12px]' : 'size-8 text-[15px]',
            )}
          >
            忌
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {cautionList.map((item) => (
              <span
                key={item}
                className={cn(
                  'rounded-lg border border-[var(--border-contrast)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface-base))] font-semibold text-[var(--text-strong)]',
                  compact ? 'px-2 py-0.5 text-[11.5px]' : 'px-2.5 py-1 text-[12px]',
                )}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDirectionsBar = (roundedBottom = false) => {
    if (!fortuneData || !ov || !cal) return null;
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-[12px] sm:px-5 sm:py-2.5',
          roundedBottom && 'rounded-xl border',
        )}
      >
        {scope === 'daily' ? (
          <>
            <span className="text-[var(--text-secondary)]">
              财神 <strong className="text-[var(--text-strong)]">{cal.dailyDirections.wealth}</strong>
            </span>
            <span className="text-[var(--text-secondary)]">
              喜神 <strong className="text-[var(--text-strong)]">{cal.dailyDirections.joy}</strong>
            </span>
            <span className="text-[var(--text-secondary)]">
              福神 <strong className="text-[var(--text-strong)]">{cal.dailyDirections.mascot}</strong>
            </span>
          </>
        ) : null}
        <span className="text-[var(--text-secondary)]">
          开运色 <strong className="text-[var(--text-strong)]">{ov.actionGuide.luckyElements.colors.join(' / ')}</strong>
        </span>
        <span className="text-[var(--text-secondary)]">
          吉方位 <strong className="text-[var(--text-strong)]">{ov.actionGuide.luckyElements.directions.join(' / ')}</strong>
        </span>
        <span className="text-[var(--text-secondary)]">
          幸运数 <strong className="text-[var(--text-strong)]">{ov.actionGuide.luckyElements.numbers.join('、')}</strong>
        </span>
        {ov.actionGuide.luckyElements.hours?.length ? (
          <span className="text-[var(--text-secondary)]">
            吉时 <strong className="text-[var(--text-strong)]">{ov.actionGuide.luckyElements.hours.join('、')}</strong>
          </span>
        ) : null}
        {fortuneData.baziSummary ? (
          <span className="text-[var(--accent-deep)]">
            日主喜用{' '}
            <strong>
              {fortuneData.baziSummary.dayMaster}
              {fortuneData.baziSummary.dayMasterElement} · 喜
              {fortuneData.baziSummary.favorableWuxing.join('、') || '调候'}
            </strong>
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="workspace-ui-screen workspace-focused-page grid gap-2.5 sm:gap-3.5 pb-6 sm:pb-10">
      <PageHeader
        title="黄历运势"
        badgeText={fortuneData?.targetLabel}
        activeTab={scope}
        tabs={[
          { id: 'daily', label: '日运' },
          { id: 'monthly', label: '月运' },
          { id: 'yearly', label: '年运' },
        ]}
        tabsAriaLabel="运势周期切换"
        onTabChange={setScope}
        rightSlot={
          <Button
            variant="secondary"
            size="sm"
            className="ws-desktop-only-action hidden min-[680px]:inline-flex"
            onClick={onBackHome}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>返回首页</span>
          </Button>
        }
      />

      {calcError ? (
        <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--danger-text)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger-text)_8%,var(--surface-base))] px-4 py-3 text-xs font-medium text-[var(--danger-text)]">
          {calcError}
        </div>
      ) : null}

      {computing && !fortuneData ? (
        <WorkspaceSkeleton variant="almanac" />
      ) : (
        <>
          {/* 1. 现代东方黄历主书页 */}
          <section
            data-testid="fortune-almanac-folio"
            aria-label="黄历总览"
            className="almanac-folio rounded-2xl bg-[var(--surface-base)] overflow-hidden"
          >
            {/* 黄历书眉：日期翻页 + 档案切换 + 推演明细 */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--border-contrast)] bg-[var(--accent-surface)] px-2.5 py-2 sm:gap-2 sm:px-5 sm:py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  aria-label="上一周期"
                  onClick={() => stepTarget(-1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {scope === 'daily' ? (
                  <input
                    type="date"
                    aria-label="选择日运日期"
                    value={dateInputVal}
                    min="1900-01-01"
                    max="2100-12-31"
                    onChange={(e) => {
                      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.target.value);
                      if (!m) return;
                      setTargetYear(Number(m[1]));
                      setTargetMonth(Number(m[2]));
                      setTargetDay(Number(m[3]));
                    }}
                    className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 text-xs font-semibold text-[var(--text-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                ) : scope === 'monthly' ? (
                  <input
                    type="month"
                    aria-label="选择月运月份"
                    value={monthInputVal}
                    min="1900-01"
                    max="2100-12"
                    onChange={(e) => {
                      const m = /^(\d{4})-(\d{2})$/.exec(e.target.value);
                      if (!m) return;
                      setTargetYear(Number(m[1]));
                      setTargetMonth(Number(m[2]));
                    }}
                    className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 text-xs font-semibold text-[var(--text-strong)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                ) : (
                  <Select
                    aria-label="选择年运年份"
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    className="h-8 w-auto min-w-[96px] text-xs font-semibold"
                  >
                    {Array.from({ length: 41 }, (_, i) => today.year - 10 + i).map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </Select>
                )}

                <Button
                  variant="secondary"
                  size="xs"
                  aria-label="下一周期"
                  onClick={() => stepTarget(1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                <Button variant="ghost" size="xs" onClick={jumpToToday}>
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{scope === 'daily' ? '今天' : scope === 'monthly' ? '本月' : '今年'}</span>
                </Button>

                {computing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-strong)]" aria-label="推演中" />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {selectedCase ? (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--accent-strong)] bg-[var(--state-selected-surface)] pl-2.5 pr-1 text-xs font-bold text-[var(--state-selected-text)]">
                    <span>{selectedCase.name || '未命名'}</span>
                    <button
                      type="button"
                      aria-label="取消档案"
                      title="取消档案"
                      onClick={() => {
                        setSelectedCaseId(null);
                        onSelectCase?.(null);
                      }}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent text-[var(--state-selected-text)] cursor-pointer hover:bg-[var(--state-selected-surface-strong)]"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ) : null}
                <Button variant="secondary" size="xs" onClick={handleOpenCasePicker}>
                  <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>选择档案</span>
                </Button>
                {ov ? (
                  <button
                    type="button"
                    aria-label="查看详细原文与推演路径"
                    title="查看详细原文与推演路径"
                    onClick={() => setDetailsModalOpen(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--border-contrast)] hover:text-[var(--accent-strong)]"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            {fortuneData && ov && cal ? (
              <>
                {/* 手机与折叠屏首屏精简判决卡片 */}
                <div className="grid gap-2.5 px-3 py-3 lg:hidden" data-testid="fortune-mobile-hero">
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="font-bold text-[var(--accent-deep)]">
                      {scope === 'daily'
                        ? cal.lunarDate
                        : scope === 'monthly'
                          ? `${cal.ganzhi.year}年 · ${cal.ganzhi.month}月`
                          : `${cal.ganzhi.year}年 · ${cal.nayin.year}`}
                    </span>
                    {scope === 'daily' ? <Badge variant="accent">{cal.solarTerm}</Badge> : null}
                    <span className="text-[var(--text-muted)]">
                      {scope === 'daily'
                        ? `${cal.ganzhi.day}日 · ${cal.dayOfficer}日`
                        : scope === 'monthly'
                          ? cal.solarTerm
                          : cal.nineStar}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                      <div className="shrink-0 text-[44px] font-black leading-none tracking-tight text-[var(--accent-strong)]">
                        {scope === 'daily'
                          ? cal.day
                          : scope === 'monthly'
                            ? `${cal.month}月`
                            : cal.year}
                      </div>
                      <div className="grid min-w-0 gap-0.5">
                        <span className="truncate text-[11.5px] font-semibold text-[var(--text-secondary)]">
                          {scope === 'daily'
                            ? `${cal.year}年${pad2(cal.month)}月 · ${cal.weekday}`
                            : scope === 'monthly'
                              ? `${cal.year}年 · 流月黄历`
                              : `${cal.ganzhi.year}岁次 · 流年黄历`}
                        </span>
                        <p className="m-0 text-[13px] font-bold leading-snug text-[var(--text-strong)]">
                          {ov.headline}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[var(--accent-strong)] bg-[var(--accent-surface)] px-2.5 py-1 text-center">
                      <span className="text-[9px] font-bold tracking-widest text-[var(--accent-deep)]">
                        运势分
                      </span>
                      <strong className="font-mono text-[20px] font-black leading-tight text-[var(--accent-strong)]">
                        {ov.overallScore}
                      </strong>
                      <span className="text-[10.5px] font-bold tracking-wider text-[var(--accent-deep)]">
                        {ov.overallTier}
                      </span>
                    </div>
                  </div>

                  {ov.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {ov.keywords.slice(0, 4).map((kw) => (
                        <Badge key={kw} variant="default">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="-mx-3 -mb-3">
                    {renderSuitableCaution(5, true)}
                  </div>
                </div>

                {/* 桌面宽屏完整黄历三栏主视觉 (>=1024px) */}
                <div className="hidden divide-x divide-[var(--border-soft)] lg:grid lg:grid-cols-12">
                  {/* 左栏：岁时干支与纳音 */}
                  <div className="flex flex-col justify-center gap-2.5 p-5 lg:col-span-4">
                    {renderGanzhiBlock()}
                  </div>

                  {/* 中栏：老黄历大号核心历日 + 朱砂评分方印 + 断语 */}
                  <div className="flex flex-col items-center justify-center gap-2.5 px-5 py-5 text-center lg:col-span-4">
                    <span className="text-[12px] font-bold tracking-[0.12em] text-[var(--text-secondary)]">
                      {scope === 'daily'
                        ? `${cal.year}年${pad2(cal.month)}月 · ${cal.weekday}`
                        : scope === 'monthly'
                          ? `${cal.year}年 · 流月黄历`
                          : `${cal.ganzhi.year}岁次 · 流年黄历`}
                    </span>

                    <div className="flex items-center justify-center gap-3.5">
                      <div className="text-[78px] font-black leading-none tracking-tight text-[var(--accent-strong)]">
                        {scope === 'daily'
                          ? cal.day
                          : scope === 'monthly'
                            ? `${cal.month}月`
                            : cal.year}
                      </div>

                      {/* 评分方印 */}
                      <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border-2 border-[var(--accent-strong)] bg-[var(--accent-surface)] px-3 py-1.5 text-center">
                        <span className="text-[9.5px] font-bold tracking-widest text-[var(--accent-deep)]">
                          运势分
                        </span>
                        <strong className="font-mono text-[22px] font-black leading-tight text-[var(--accent-strong)]">
                          {ov.overallScore}
                        </strong>
                        <span className="text-[11px] font-bold tracking-wider text-[var(--accent-deep)]">
                          {ov.overallTier}
                        </span>
                      </div>
                    </div>

                    <p className="m-0 max-w-[320px] text-[13.5px] font-bold leading-relaxed text-[var(--text-strong)]">
                      {ov.headline}
                    </p>

                    <div className="flex flex-wrap justify-center gap-1">
                      {ov.keywords.map((kw) => (
                        <Badge key={kw} variant="default">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* 右栏：建除值神 / 节气分布表 */}
                  <div className="flex flex-col justify-center gap-2 p-5 lg:col-span-4">
                    {renderStarOfficerBlock()}
                  </div>
                </div>

                {/* 桌面宽屏完整「宜 / 忌」+ 诸神方位底栏 */}
                <div className="hidden lg:block">
                  {renderSuitableCaution()}
                  {renderDirectionsBar()}
                </div>
              </>
            ) : null}
          </section>

          {/* 手机与折叠屏 4 分区切换栏：首屏精简，按需直达 */}
          {fortuneData && ov && cal ? (
            <div
              role="tablist"
              aria-label="运势详情切换"
              data-testid="fortune-mobile-tabs"
              className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-1 lg:hidden"
            >
              {mobileTabs.map((tab) => {
                const active = mobileSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMobileSection(tab.id)}
                    className={cn(
                      'min-h-[36px] rounded-lg border px-1 text-[11.5px] whitespace-nowrap transition-colors cursor-pointer',
                      active
                        ? 'border-[var(--border-contrast)] bg-[var(--surface-elevated-strong)] font-bold text-[var(--accent-strong)] shadow-xs'
                        : 'border-transparent bg-transparent font-medium text-[var(--text-secondary)]',
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* 手机与折叠屏专属「黄历详查」分页 */}
          {fortuneData && ov && cal && mobileSection === 'almanac' ? (
            <Card
              data-testid="fortune-mobile-almanac"
              className="grid gap-3 bg-[var(--surface-base)] p-3 lg:hidden"
            >
              <div className="grid gap-2.5">{renderGanzhiBlock()}</div>
              {renderStarOfficerBlock()}
              <div className="-mx-3 overflow-hidden">{renderSuitableCaution()}</div>
              {renderDirectionsBar(true)}
            </Card>
          ) : null}

          {/* 1.5 现代决策阅读流：先做什么 · 关键窗口 · 后续节奏 · 判断依据 */}
          {fortuneData && decisionFlow ? (
            <FortuneDecisionFlowCard
              scope={scope}
              mode={fortuneData.mode}
              decisionFlow={decisionFlow}
              mobileSection={mobileSection}
              onSelectRhythmDate={(y, m, d) => {
                setTargetYear(y);
                setTargetMonth(m);
                setTargetDay(d);
              }}
            />
          ) : null}

          {/* 2. 时辰吉凶表 / 本月逐日黄历 / 十二节气流月 */}
          {fortuneData ? (
            <FortuneTimelineSection
              scope={scope}
              fortuneData={fortuneData}
              todayStr={todayStr}
              hiddenOnMobile={mobileSection !== 'timeline'}
              monthDayFilter={monthDayFilter}
              onChangeMonthDayFilter={setMonthDayFilter}
              onSelectDay={(y, m, d) => {
                setScope('daily');
                setTargetYear(y);
                setTargetMonth(m);
                setTargetDay(d);
              }}
              onSelectMonth={(y, m) => {
                setTargetYear(y);
                setTargetMonth(m);
                setScope('monthly');
              }}
            />
          ) : null}

          {/* 3. 五维运势分栏横卷 */}
          {ov ? (
            <FortuneDimensionsCard
              dimensions={ov.dimensions}
              hiddenOnMobile={mobileSection !== 'dimensions'}
              onOpenDetails={() => setDetailsModalOpen(true)}
            />
          ) : null}
        </>
      )}

      {/* 4. 每日一卦轻指引 */}
      <div className={cn(mobileSection !== 'overview' && 'hidden lg:block')}>
        <DailyHexagramCard />
      </div>

      {/* 5. 底部操作区：未启用 AI 时仅显示复制提示词；启用 AI 后再显示 AI 报告 */}
      <FortuneAiReportSection
        aiReady={aiReady}
        promptText={promptText}
        computing={computing}
        copiedPrompt={copiedPrompt}
        copiedReport={copiedReport}
        aiStatus={aiStatus}
        aiStreaming={aiStreaming}
        aiMessages={aiMessages}
        followupDraft={followupDraft}
        onChangeFollowupDraft={setFollowupDraft}
        onCopyPrompt={() => void handleCopyPrompt()}
        onCopyReport={(text) => void handleCopyReport(text)}
        onGenerateReport={handleGenerateAiReport}
        onStopStreaming={() => aiAbortRef.current?.abort()}
        onClearReport={handleClearAiReport}
        onSendFollowup={handleSendFollowup}
      />

      {/* 详细原文与推演路径弹窗 */}
      <FortuneDetailsDialog
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        fortuneData={fortuneData}
        promptText={promptText}
        copiedPrompt={copiedPrompt}
        onCopyPrompt={() => void handleCopyPrompt()}
      />
    </div>
  );
}
