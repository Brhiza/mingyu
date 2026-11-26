import * as React from 'react';
import {
  Bot,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  FileText,
  FolderOpen,
  Loader2,
  Send,
  Square,
  X,
} from 'lucide-react';
import { streamChat, type AiMessage } from '../../ai';
import { calculate } from '../../core';
import type { FortuneScope } from '../../systems/fortune/types';
import { toV2BirthPayload, type PersonalCase } from '../../v2-ui/cases-store';
import { distillPromptForUser, splitPromptIntoSystemAndUser } from '../../prompt-profile';
import { isWebAiConfigured, isWebAiEnabled, readWebAiConfig } from '../../web-ai';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../../web-settings';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  PageHeader,
  SegmentedTabs,
  Select,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { AgentMarkdown } from './AgentMarkdown';
import type { CaseFillTarget } from './CasesDrawer';

export interface FortunePageProps {
  cases: readonly PersonalCase[];
  initialCaseId?: string | null;
  scope?: FortuneScope;
  onScopeChange?: (scope: FortuneScope) => void;
  onNewCase?: () => void;
  onEditCase?: (record: PersonalCase) => void;
  onOpenConnect?: () => void;
  onBackHome: () => void;
}

interface FortuneCalculatedData {
  scope: FortuneScope;
  scopeLabel: string;
  targetLabel: string;
  mode: 'personalized' | 'general';
  caseName: string | null;
  calendar: {
    targetDate: string;
    year: number;
    month: number;
    day: number;
    weekday: string;
    lunarDate: string;
    solarTerm: string;
    ganzhi: { year: string; month: string; day: string };
    nayin: { year: string; month: string; day: string };
    dayOfficer: string;
    twelveStar: string;
    twentyEightStar: string;
    nineStar: string;
    clash: string;
    recommends: string[];
    avoids: string[];
    dailyDirections: {
      joy: string;
      wealth: string;
      mascot: string;
      yangGui: string;
      yinGui: string;
    };
  };
  wuyunSummary: string | null;
  baziSummary: {
    dayMaster: string;
    dayMasterElement: string;
    strengthStatus: string;
    pattern: string;
    useful: string;
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    natalPillars: { year: string; month: string; day: string; hour: string };
    dayunGanZhi: string | null;
    flowYearGanZhi: string;
    flowMonthGanZhi: string;
    flowDayGanZhi: string;
    flowTenGods: { dayun?: string; year: string; month: string; day: string };
    interactions: string[];
    shenshaHits: string[];
    precisionNote?: string;
  } | null;
  ziweiSummary: {
    yearlyPalace?: string;
    yearlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
    monthlyPalace?: string;
    monthlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
    dailyPalace?: string;
    dailyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
  } | null;
  astrolabeSummary: {
    sunSign: string;
    moonSign: string;
    ascSign: string;
    topAspects: Array<{
      movingName: string;
      aspectLabel: string;
      natalName: string;
      strength: number;
    }>;
  } | null;
  omitted: Array<{ system: string; reason: string }>;
  markdown?: string;
  overview: {
    overallScore: number;
    overallTier: string;
    headline: string;
    keywords: string[];
    scoreFactors: Array<{
      label: string;
      category: string;
      impact: number;
      sentiment: 'positive' | 'neutral' | 'caution';
      detail: string;
    }>;
    dimensions: Array<{
      id: string;
      label: string;
      score: number;
      trend: '旺' | '平' | '谨';
      summary: string;
    }>;
    actionGuide: {
      suitable: string[];
      caution: string[];
      luckyElements: {
        wuxing: string[];
        colors: string[];
        directions: string[];
        numbers: number[];
        hours?: string[];
        focusTip: string;
      };
    };
  };
  timeline: {
    hours?: Array<{
      name: string;
      range: string;
      ganzhi: string;
      twelveStar: string;
      tenGod?: string;
      rating: '吉' | '平' | '慎';
      note: string;
    }>;
    solarTerms?: Array<{ name: string; date: string; time: string }>;
    days?: Array<{
      date: string;
      day: number;
      weekday: string;
      weekdayIndex?: number;
      lunarDate: string;
      dayGanZhi: string;
      dayOfficer: string;
      twelveStar: string;
      tenGod?: string;
      score: number;
      rating: '优选' | '平稳' | '慎用';
      tag: string;
    }>;
    months?: Array<{
      monthIndex: number;
      jieName: string;
      startDate: string;
      endDate: string;
      monthGanZhi: string;
      tenGod?: string;
      ziweiPalace?: string;
      ziweiMutagens?: string[];
      score: number;
      trend: '旺' | '平' | '谨';
      note: string;
    }>;
  };
}

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const;

const FORTUNE_REPORT_STORAGE_KEY = 'mingyu.v2.fortune.reports';
const MAX_SAVED_FORTUNE_REPORTS = 15;

interface SavedFortuneReportEntry {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  status: string;
  updatedAt: number;
}

function buildFortuneReportKey(
  scope: FortuneScope,
  year: number,
  month: number,
  day: number,
  caseId: string | null,
): string {
  const target =
    scope === 'daily'
      ? `${year}-${pad2(month)}-${pad2(day)}`
      : scope === 'monthly'
        ? `${year}-${pad2(month)}`
        : String(year);
  return `${scope}:${target}:${caseId ?? 'general'}`;
}

function readSavedFortuneReports(): Record<string, SavedFortuneReportEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FORTUNE_REPORT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedFortuneReportEntry>) : {};
  } catch {
    return {};
  }
}

function writeSavedFortuneReport(
  key: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  status: string,
): void {
  if (typeof window === 'undefined' || messages.length === 0) return;
  try {
    const store = readSavedFortuneReports();
    store[key] = { messages, status, updatedAt: Date.now() };
    const entries = Object.entries(store)
      .sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0))
      .slice(0, MAX_SAVED_FORTUNE_REPORTS);
    window.localStorage.setItem(FORTUNE_REPORT_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function removeSavedFortuneReport(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const store = readSavedFortuneReports();
    if (!(key in store)) return;
    delete store[key];
    window.localStorage.setItem(FORTUNE_REPORT_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getTodayYmd(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function toIsoRangeEndpoint(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(trimmed);
  return match ? `${match[1]}T${match[2]}+08:00` : trimmed;
}

function buildFortunePayload(params: {
  scope: FortuneScope;
  year: number;
  month: number;
  day: number;
  selectedCase: PersonalCase | null;
}): Record<string, unknown> {
  const { scope, year, month, day, selectedCase } = params;
  const target =
    scope === 'daily'
      ? { year, month, day }
      : scope === 'monthly'
        ? { year, month }
        : { year };

  const raw: Record<string, unknown> = {
    question: '请综合梳理这段时间的整体运势基调、重点机遇与注意事项。',
    scope,
    target,
    prompt: {
      topic: 'general',
      detailMode: 'compact',
      includeClassics: false,
    },
  };

  if (selectedCase) {
    if (selectedCase.reverseSource) {
      raw.birthRange = {
        start: toIsoRangeEndpoint(selectedCase.reverseSource.intervalStart),
        end: toIsoRangeEndpoint(selectedCase.reverseSource.intervalEnd),
        timezone: 8,
        pillars: selectedCase.reverseSource.pillars,
      };
    } else {
      const hasKnownTime = selectedCase.timeIndex !== 'unknown';
      raw.birth = toV2BirthPayload(selectedCase, {
        method: 'bazi',
        forcePreciseBirthPlace: hasKnownTime,
      });
    }
    raw.gender = selectedCase.gender;
    if (selectedCase.name?.trim()) {
      raw.caseName = selectedCase.name.trim();
    }
    if (selectedCase.latitude !== undefined && selectedCase.longitude !== undefined) {
      raw.location = {
        latitude: selectedCase.latitude,
        longitude: selectedCase.longitude,
        ...(selectedCase.birthPlace?.trim()
          ? { locationName: selectedCase.birthPlace.trim() }
          : {}),
      };
    }
  }

  return applyGlobalRulesToPayload('fortune', raw, true) as Record<string, unknown>;
}

function trendBadgeCls(trend: '旺' | '平' | '谨' | '吉' | '慎' | '优选' | '平稳' | '慎用'): string {
  if (trend === '旺' || trend === '吉' || trend === '优选') {
    return 'border-[color-mix(in_srgb,var(--success-text)_26%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_10%,var(--surface-base))] text-[var(--success-text)]';
  }
  if (trend === '谨' || trend === '慎' || trend === '慎用') {
    return 'border-[color-mix(in_srgb,var(--secondary)_34%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_12%,var(--surface-base))] text-[var(--secondary-strong)]';
  }
  return 'border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-secondary)]';
}

function trendBadgeVariant(
  trend: '旺' | '平' | '谨' | '吉' | '慎' | '优选' | '平稳' | '慎用',
): 'good' | 'outline' | 'default' {
  if (trend === '旺' || trend === '吉' || trend === '优选') return 'good';
  if (trend === '谨' || trend === '慎' || trend === '慎用') return 'outline';
  return 'default';
}

export function FortunePage({
  cases,
  initialCaseId = null,
  scope: controlledScope,
  onScopeChange,
  onOpenConnect,
  onBackHome,
}: FortunePageProps) {
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
    if (initialCaseId && cases.some((c) => c.id === initialCaseId)) return initialCaseId;
    return cases[0]?.id ?? null;
  });
  const prevInitialCaseIdRef = React.useRef(initialCaseId);
  React.useEffect(() => {
    if (initialCaseId && initialCaseId !== prevInitialCaseIdRef.current && cases.some((c) => c.id === initialCaseId)) {
      setSelectedCaseId(initialCaseId);
    }
    prevInitialCaseIdRef.current = initialCaseId;
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

  const [computing, setComputing] = React.useState(false);
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [fortuneData, setFortuneData] = React.useState<FortuneCalculatedData | null>(null);
  const [promptText, setPromptText] = React.useState('');

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
    setComputing(true);
    setCalcError(null);
    try {
      const payload = buildFortunePayload({
        scope,
        year: targetYear,
        month: targetMonth,
        day: targetDay,
        selectedCase,
      });
      const res = (await calculate('fortune', payload)) as {
        data: FortuneCalculatedData;
        prompt?: { text: string };
      };
      if (token !== calcTokenRef.current) return;
      setFortuneData(res.data);
      const includeClassics = loadGlobalRules().prompt.includeClassics;
      const cleanPrompt = distillPromptForUser(res.prompt?.text ?? '', { includeClassics });
      setPromptText(cleanPrompt || res.prompt?.text || '');
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
            setSelectedCaseId(person?.id || null);
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

  return (
    <div className="workspace-ui-screen workspace-focused-page grid gap-3.5 pb-10">
      <PageHeader
        title="流运运势"
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
            className="ws-desktop-only-action"
            onClick={onBackHome}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>返回首页</span>
          </Button>
        }
      />

      {/* 顶部控制条：时间定位 + 通用案例选择 + 焦点切换 */}
      <Card className="grid gap-2.5 bg-[var(--surface-base)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* 时间步进器 */}
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
          </div>

          {/* 从档案调取（复用全站档案面板） */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCase ? (
              <span className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--accent-strong)] bg-[var(--state-selected-surface)] pl-2.5 pr-1 text-xs font-bold text-[var(--state-selected-text)]">
                <span>{selectedCase.name || '未命名'}</span>
                <button
                  type="button"
                  aria-label="切换为通用"
                  title="切换为通用"
                  onClick={() => setSelectedCaseId(null)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent text-[var(--state-selected-text)] cursor-pointer hover:bg-[var(--state-selected-surface-strong)]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ) : (
              <Badge variant="outline">通用</Badge>
            )}
            <Button variant="secondary" size="xs" onClick={handleOpenCasePicker}>
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>从档案调取</span>
            </Button>
          </div>
        </div>
      </Card>

      {calcError ? (
        <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--danger-text)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger-text)_8%,var(--surface-base))] px-4 py-3 text-xs font-medium text-[var(--danger-text)]">
          {calcError}
        </div>
      ) : null}

      {/* 1. 综合趋势总览卡 */}
      <Card className="grid gap-3.5 bg-[var(--surface-base)] p-4 sm:p-5">
        {computing && !fortuneData ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-strong)]" />
            <span>推演中…</span>
          </div>
        ) : fortuneData && ov && cal ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 flex-1 gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="accent">
                    {fortuneData.targetLabel}{fortuneData.scopeLabel}
                  </Badge>
                  <Badge variant="outline">
                    {fortuneData.mode === 'personalized'
                      ? fortuneData.caseName || '已选案例'
                      : '通用流时'}
                  </Badge>
                  <span className="text-[11.5px] text-[var(--text-muted)]">
                    {scope === 'daily'
                      ? `${cal.lunarDate} · ${cal.weekday} · ${cal.solarTerm}`
                      : scope === 'monthly'
                        ? `${cal.ganzhi.year}年 · ${cal.ganzhi.month}月`
                        : `${cal.ganzhi.year}年${fortuneData.wuyunSummary ? ` · ${fortuneData.wuyunSummary}` : ''}`}
                  </span>
                  {computing ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                      <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-strong)]" />
                    </span>
                  ) : null}
                </div>

                <p className="m-0 text-[15px] font-bold leading-relaxed text-[var(--text-strong)]">
                  {ov.headline}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {ov.keywords.map((kw) => (
                    <Badge key={kw} variant="default">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 朱砂印风格趋势分值徽章 */}
              <div className="flex shrink-0 flex-col items-center justify-center rounded-[12px] border border-[var(--border-contrast)] bg-[var(--accent-surface)] px-4 py-2 text-center">
                <strong className="font-mono text-[26px] font-black leading-tight text-[var(--accent-strong)]">
                  {ov.overallScore}
                </strong>
                <span className="font-serif text-[12px] font-bold tracking-wider text-[var(--accent-deep)]">
                  {ov.overallTier}
                </span>
              </div>
            </div>

            {/* 干支历法四格条 */}
            {scope === 'daily' ? (
              <div className="grid grid-cols-2 divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">流时干支</span>
                  <strong className="font-serif text-[13px] tracking-wide text-[var(--text-strong)]">
                    {cal.ganzhi.year} · {cal.ganzhi.month} · {cal.ganzhi.day}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">建除 / 值神</span>
                  <strong className="text-[var(--text-strong)]">
                    {cal.dayOfficer}日 · {cal.twelveStar}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">冲煞 / 星宿</span>
                  <strong className="text-[var(--text-strong)]">
                    {cal.clash} · {cal.twentyEightStar}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">
                    {fortuneData.baziSummary ? '日主喜用' : '财喜方位'}
                  </span>
                  <strong className="text-[var(--text-strong)]">
                    {fortuneData.baziSummary
                      ? `${fortuneData.baziSummary.dayMaster}${fortuneData.baziSummary.dayMasterElement} · 喜${fortuneData.baziSummary.favorableWuxing.join('、') || '调候'}`
                      : `财${cal.dailyDirections.wealth} · 喜${cal.dailyDirections.joy}`}
                  </strong>
                </div>
              </div>
            ) : scope === 'monthly' ? (
              <div className="grid grid-cols-2 divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">流月干支</span>
                  <strong className="font-serif text-[13px] tracking-wide text-[var(--text-strong)]">
                    {cal.ganzhi.year}年 · {cal.ganzhi.month}月
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">当月节气</span>
                  <strong className="text-[var(--text-strong)]">
                    {fortuneData.timeline.solarTerms?.length
                      ? fortuneData.timeline.solarTerms.map((s) => `${s.name} ${s.date.slice(5)}`).join(' · ')
                      : cal.solarTerm}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">吉日 / 慎日</span>
                  <strong className="text-[var(--text-strong)]">
                    优选 {fortuneData.timeline.days?.filter((d) => d.rating === '优选').length ?? 0} 天 · 慎用{' '}
                    {fortuneData.timeline.days?.filter((d) => d.rating === '慎用').length ?? 0} 天
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">
                    {fortuneData.baziSummary ? '日主喜用' : '纳音五行'}
                  </span>
                  <strong className="text-[var(--text-strong)]">
                    {fortuneData.baziSummary
                      ? `${fortuneData.baziSummary.dayMaster}${fortuneData.baziSummary.dayMasterElement} · 喜${fortuneData.baziSummary.favorableWuxing.join('、') || '调候'}`
                      : `${cal.nayin.month}（${cal.nineStar}）`}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 divide-y divide-[var(--border-soft)] rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[12px] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">流年干支</span>
                  <strong className="font-serif text-[13px] tracking-wide text-[var(--text-strong)]">
                    {cal.ganzhi.year}年 · {cal.nineStar}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">岁运五运</span>
                  <strong className="text-[var(--text-strong)]">
                    {fortuneData.wuyunSummary || cal.nayin.year}
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">十二月分布</span>
                  <strong className="text-[var(--text-strong)]">
                    旺 {fortuneData.timeline.months?.filter((m) => m.trend === '旺').length ?? 0} 月 · 谨{' '}
                    {fortuneData.timeline.months?.filter((m) => m.trend === '谨').length ?? 0} 月
                  </strong>
                </div>
                <div className="px-3 py-2">
                  <span className="block text-[10.5px] text-[var(--text-muted)]">
                    {fortuneData.baziSummary ? '日主喜用' : '全年流月'}
                  </span>
                  <strong className="text-[var(--text-strong)]">
                    {fortuneData.baziSummary
                      ? `${fortuneData.baziSummary.dayMaster}${fortuneData.baziSummary.dayMasterElement} · 喜${fortuneData.baziSummary.favorableWuxing.join('、') || '调候'}`
                      : '十二节气月'}
                  </strong>
                </div>
              </div>
            )}
          </>
        ) : null}
      </Card>

      {/* 2. 中部双栏：左五维趋势 + 右宜忌开运 */}
      {ov ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-start">
          {/* 五维本地算法趋势 */}
          <Card className="grid gap-3 bg-[var(--surface-base)] p-4 sm:p-5 lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-[var(--accent-strong)]" />
                <h2 className="m-0 font-sans text-[14.5px] font-bold text-[var(--text-strong)]">
                  五维趋势
                </h2>
              </div>
              <button
                type="button"
                aria-label="查看详细原文与推演路径"
                title="查看详细原文与推演路径"
                onClick={() => setDetailsModalOpen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--border-contrast)] hover:text-[var(--accent-strong)]"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-2">
              {ov.dimensions.map((dim) => {
                const barColor =
                  dim.trend === '旺'
                    ? 'bg-[var(--success-text)]'
                    : dim.trend === '谨'
                      ? 'bg-[var(--secondary)]'
                      : 'bg-[var(--accent-strong)]';
                return (
                  <div
                    key={dim.id}
                    className="grid gap-1.5 rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-3 py-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-[13px] font-bold text-[var(--text-strong)]">
                          {dim.label}
                        </strong>
                        <Badge variant={trendBadgeVariant(dim.trend)}>{dim.trend}</Badge>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text-strong)]">
                        {dim.score}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', barColor)}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                    <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                      {dim.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 行动宜忌与开运参考 */}
          <Card className="grid gap-3 bg-[var(--surface-base)] p-4 sm:p-5 lg:col-span-5">
            <div className="grid gap-2.5">
              <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--success-text)_24%,transparent)] bg-[color-mix(in_srgb,var(--success-text)_6%,var(--surface-base))] p-3">
                <strong className="mb-1.5 block text-xs font-bold text-[var(--success-text)]">
                  宜
                </strong>
                <ul className="m-0 list-disc pl-4 text-xs leading-relaxed text-[var(--text-primary)]">
                  {ov.actionGuide.suitable.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--secondary)_28%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_7%,var(--surface-base))] p-3">
                <strong className="mb-1.5 block text-xs font-bold text-[var(--secondary-strong)]">
                  忌
                </strong>
                <ul className="m-0 list-disc pl-4 text-xs leading-relaxed text-[var(--text-primary)]">
                  {ov.actionGuide.caution.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5">
              <Badge variant="outline">
                开运色：{ov.actionGuide.luckyElements.colors.join(' / ')}
              </Badge>
              <Badge variant="outline">
                吉方位：{ov.actionGuide.luckyElements.directions.join(' / ')}
              </Badge>
              <Badge variant="outline">
                幸运数：{ov.actionGuide.luckyElements.numbers.join('、')}
              </Badge>
              {ov.actionGuide.luckyElements.hours?.length ? (
                <Badge variant="outline">
                  吉时：{ov.actionGuide.luckyElements.hours.join('、')}
                </Badge>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {/* 3. 全宽时间轴节律（日运时辰 / 月运日历 / 年运流月） */}
      {fortuneData ? (
        <Card className="grid gap-3 bg-[var(--surface-base)] p-4 sm:p-5">
          {scope === 'daily' && fortuneData.timeline.hours ? (
            <>
              <h2 className="m-0 font-sans text-[14.5px] font-bold text-[var(--text-strong)]">
                时辰节律
              </h2>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
                {fortuneData.timeline.hours.map((h) => (
                  <div
                    key={h.name}
                    className="grid gap-0.5 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <strong className="font-serif text-[12px] text-[var(--text-strong)]">
                        {h.name} · {h.ganzhi}
                      </strong>
                      <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none', trendBadgeCls(h.rating))}>
                        {h.rating}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{h.range}</span>
                    <span className="truncate text-[var(--text-secondary)]" title={h.note}>
                      {h.note}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

              {scope === 'monthly' && fortuneData.timeline.days ? (() => {
                const allDays = fortuneData.timeline.days;
                const filteredDays =
                  monthDayFilter === 'all' ? allDays : allDays.filter((d) => d.rating === monthDayFilter);
                const firstWeekdayIdx = allDays[0]?.weekdayIndex ?? 1;
                const leadingEmpty = monthDayFilter === 'all' ? (firstWeekdayIdx + 6) % 7 : 0;
                const goodCount = allDays.filter((d) => d.rating === '优选').length;
                const cautionCount = allDays.filter((d) => d.rating === '慎用').length;
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="m-0 font-sans text-[14.5px] font-bold text-[var(--text-strong)]">
                        本月逐日
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(['all', '优选', '慎用'] as const).map((filterOpt) => (
                          <button
                            key={filterOpt}
                            type="button"
                            onClick={() => setMonthDayFilter(filterOpt)}
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer',
                              monthDayFilter === filterOpt
                                ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)] font-bold'
                                : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-secondary)] hover:border-[var(--border-contrast)]',
                            )}
                          >
                            {filterOpt === 'all'
                              ? `全部(${allDays.length})`
                              : filterOpt === '优选'
                                ? `优选(${goodCount})`
                                : `慎用(${cautionCount})`}
                          </button>
                        ))}
                      </div>
                    </div>
                    {fortuneData.timeline.solarTerms?.length ? (
                      <div className="text-[11px] text-[var(--text-muted)]">
                        本月节气：{fortuneData.timeline.solarTerms.map((s) => `${s.name} ${s.date.slice(5)}`).join(' · ')}
                      </div>
                    ) : null}
                    {monthDayFilter === 'all' ? (
                      <div className="hidden md:grid md:grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[var(--text-muted)]">
                        {WEEKDAY_HEADERS.map((w) => (
                          <span key={w} className="py-0.5">
                            周{w}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {filteredDays.length === 0 ? (
                      <div className="rounded-[12px] border border-dashed border-[var(--border-soft)] py-6 text-center text-xs text-[var(--text-muted)]">
                        本月暂无标记为「{monthDayFilter}」的日期，可切回“全部”查看完整日历。
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'grid gap-1.5',
                          monthDayFilter === 'all'
                            ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-7'
                            : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5',
                        )}
                      >
                        {leadingEmpty > 0
                          ? Array.from({ length: leadingEmpty }, (_, idx) => (
                              <div key={`empty-${idx}`} className="hidden md:block" aria-hidden="true" />
                            ))
                          : null}
                        {filteredDays.map((d) => {
                          const isToday = d.date === todayStr;
                          return (
                            <button
                              key={d.date}
                              type="button"
                              onClick={() => {
                                setScope('daily');
                                setTargetYear(Number(d.date.slice(0, 4)));
                                setTargetMonth(Number(d.date.slice(5, 7)));
                                setTargetDay(d.day);
                              }}
                              className={cn(
                                'group grid gap-0.5 rounded-[10px] border p-2 text-left transition-colors cursor-pointer hover:border-[var(--accent-strong)] hover:bg-[var(--state-selected-surface)]',
                                isToday
                                  ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)]'
                                  : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="inline-flex items-center gap-1">
                                  <strong className="font-mono text-xs text-[var(--text-strong)]">{d.day}日</strong>
                                  {isToday ? (
                                    <span className="rounded bg-[var(--accent-strong)] px-1 text-[9px] font-bold text-[var(--accent-contrast)]">
                                      今
                                    </span>
                                  ) : null}
                                </span>
                                <span className={cn('rounded border px-1 py-0.5 text-[9.5px] font-bold leading-none', trendBadgeCls(d.rating))}>
                                  {d.rating}
                                </span>
                              </div>
                              <span className="text-[10.5px] font-semibold text-[var(--text-secondary)]">
                                {d.dayGanZhi} {d.tenGod ? `· ${d.tenGod}` : ''}
                              </span>
                              <span className="truncate text-[10px] text-[var(--text-muted)]">
                                {d.tag} · {d.score}分
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })() : null}

              {scope === 'yearly' && fortuneData.timeline.months ? (
                <>
                  <h2 className="m-0 font-sans text-[14.5px] font-bold text-[var(--text-strong)]">
                    十二流月
                  </h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {fortuneData.timeline.months.map((m) => {
                      const isCurrentSolarMonth = todayStr >= m.startDate && todayStr <= m.endDate;
                      return (
                        <button
                          key={m.monthIndex}
                          type="button"
                          onClick={() => {
                            const ym = /^(\d{4})-(\d{2})/.exec(m.startDate);
                            if (ym) {
                              setTargetYear(Number(ym[1]));
                              setTargetMonth(Number(ym[2]));
                            }
                            setScope('monthly');
                          }}
                          className={cn(
                            'group grid gap-1.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors cursor-pointer hover:border-[var(--accent-strong)] hover:bg-[var(--state-selected-surface)]',
                            isCurrentSolarMonth
                              ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)]'
                              : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5">
                              <strong className="font-serif text-[13px] font-bold text-[var(--text-strong)]">
                                {m.jieName} · {m.monthGanZhi}月
                              </strong>
                              {isCurrentSolarMonth ? (
                                <Badge variant="accent">当月</Badge>
                              ) : null}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-[var(--text-strong)]">
                                {m.score}分
                              </span>
                              <Badge variant={trendBadgeVariant(m.trend)}>{m.trend}</Badge>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent-strong)]"
                              style={{ width: `${m.score}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {m.startDate.slice(5)} ~ {m.endDate.slice(5)} · {m.note}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
        </Card>
      ) : null}

      {/* 4. 底部操作区：未启用 AI 时仅显示复制提示词；启用 AI 后再显示 AI 报告 */}
      {!aiReady ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={!promptText}
            onClick={() => void handleCopyPrompt()}
          >
            {copiedPrompt ? <Check className="h-3.5 w-3.5 text-[var(--success-text)]" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
          </Button>
        </div>
      ) : (
        <Card className="grid gap-3 bg-[var(--surface-base)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <strong className="text-[14px] font-bold text-[var(--text-strong)]">AI 定制报告</strong>
              {aiStatus ? (
                <span className="text-[11.5px] text-[var(--text-muted)]">{aiStatus}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                disabled={!promptText}
                onClick={() => void handleCopyPrompt()}
              >
                {copiedPrompt ? <Check className="h-3 w-3 text-[var(--success-text)]" /> : <Copy className="h-3 w-3" />}
                <span>{copiedPrompt ? '已复制' : '复制提示词'}</span>
              </Button>
              {aiStreaming ? (
                <Button variant="destructive" size="xs" onClick={() => aiAbortRef.current?.abort()}>
                  <Square className="h-3 w-3" />
                  <span>停止</span>
                </Button>
              ) : (
                <>
                  {aiMessages.length > 0 ? (
                    <Button variant="ghost" size="xs" onClick={handleClearAiReport}>
                      <span>清空</span>
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!promptText || computing}
                    onClick={handleGenerateAiReport}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>{aiMessages.length > 0 ? '重新生成报告' : 'AI 生成定制报告'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {aiMessages.length > 0 ? (
            <div className="grid max-h-[540px] gap-2.5 overflow-y-auto pr-1">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-[12px] border p-3 text-xs',
                    msg.role === 'user'
                      ? 'border-[var(--border-contrast)] bg-[var(--state-selected-surface)] text-[var(--text-strong)]'
                      : 'border-[var(--border-soft)] bg-[var(--surface-elevated-strong)]',
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <strong className="text-[11px] font-bold text-[var(--text-muted)]">
                      {msg.role === 'user' ? '我的追问' : '定制运势报告'}
                    </strong>
                    {msg.role === 'assistant' && msg.content ? (
                      <button
                        type="button"
                        onClick={() => void handleCopyReport(msg.content)}
                        className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
                      >
                        {copiedReport ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedReport ? '已复制' : '复制报告'}</span>
                      </button>
                    ) : null}
                  </div>
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <AgentMarkdown content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>正在生成…</span>
                      </div>
                    )
                  ) : (
                    <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {aiMessages.length > 0 ? (
            <div className="flex items-center gap-1.5 border-t border-[var(--border-soft)] pt-2.5">
              <Input
                type="text"
                value={followupDraft}
                onChange={(e) => setFollowupDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendFollowup();
                  }
                }}
                placeholder="继续追问…"
                className="h-8 flex-1 text-xs"
                disabled={aiStreaming}
              />
              <Button
                variant="primary"
                size="xs"
                disabled={!followupDraft.trim() || aiStreaming}
                onClick={handleSendFollowup}
              >
                <Send className="h-3 w-3" />
                <span>发送</span>
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      {/* 详细原文与推演路径弹窗 */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85dvh] flex flex-col gap-3 overflow-hidden">
          <DialogHeader>
            <DialogTitle>详细推演路径与完整原文</DialogTitle>
            <DialogDescription>
              {fortuneData
                ? `${fortuneData.targetLabel}${fortuneData.scopeLabel} · ${fortuneData.mode === 'personalized' ? `定制案例「${fortuneData.caseName || '已选档案'}」` : '通用流时模式'}`
                : '算法明细、原始盘面数据与提示词原文'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto grid gap-4 pr-1 text-xs">
            {ov && ov.scoreFactors.length > 0 ? (
              <section className="grid gap-1.5">
                <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                  一、本地算法推演路径与触发因子（{ov.scoreFactors.length} 项）
                </h4>
                <div className="grid gap-1.5">
                  {ov.scoreFactors.map((f, idx) => (
                    <div
                      key={`${f.label}-${idx}`}
                      className="flex items-start justify-between gap-2 rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2"
                    >
                      <div className="grid gap-0.5">
                        <strong className="text-[var(--text-strong)]">{f.label}</strong>
                        <span className="text-[var(--text-secondary)]">{f.detail}</span>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-[11px] font-bold',
                          f.impact > 0
                            ? 'text-[var(--success-text)]'
                            : f.impact < 0
                              ? 'text-[var(--secondary-strong)]'
                              : 'text-[var(--text-muted)]',
                        )}
                      >
                        {f.impact > 0 ? `+${f.impact}` : f.impact === 0 ? '背景' : f.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {fortuneData?.markdown ? (
              <section className="grid gap-1.5">
                <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                  二、完整排盘数据与历法摘要
                </h4>
                <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3">
                  <AgentMarkdown content={fortuneData.markdown} />
                </div>
              </section>
            ) : null}

            {fortuneData?.omitted && fortuneData.omitted.length > 0 ? (
              <section className="grid gap-1">
                <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                  三、未计算项目与说明
                </h4>
                <ul className="m-0 list-disc pl-4 text-[var(--text-secondary)]">
                  {fortuneData.omitted.map((o) => (
                    <li key={o.system}>
                      <strong>{o.system}：</strong>
                      {o.reason}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <h4 className="m-0 text-[12.5px] font-bold text-[var(--text-strong)]">
                  完整定制 AI 提示词原文（约 {promptText.length} 字）
                </h4>
                <Button
                  variant="secondary"
                  size="xs"
                  disabled={!promptText}
                  onClick={() => void handleCopyPrompt()}
                >
                  {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedPrompt ? '已复制' : '复制原文'}</span>
                </Button>
              </div>
              <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 font-sans text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                {promptText || '正在生成提示词…'}
              </pre>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
