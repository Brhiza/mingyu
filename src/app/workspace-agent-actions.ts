import type * as React from 'react';
import type { Method } from '../method-meta';
import type { SynastryRelationship } from '../systems/focus-presets';
import {
  getPersonalCaseById,
  saveTemporaryCase,
  setActiveCaseId,
  upsertCompatibilityRecord,
  type PersonalCase,
} from '../v2-ui/cases-store';
import {
  isCompatibilityChartMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type PersonalChartTabId,
} from '../v2-ui/chart-tabs';
import type { ResultPageController } from '../v2-ui/result-page';
import type { AgentToolTrace } from '../web-agent-storage';
import type { LocalAgentApplyPayload } from './components/AgentChatPanel';
import type { TopDomainId, WorkspaceRouteId } from './workspace-catalog';
import type { WorkspaceResultRef } from './workspace-router';

export interface AgentActionDeps {
  seededPerson: PersonalCase;
  partnerSeed?: Partial<PersonalCase>;
  compatRelationship: SynastryRelationship;
  pendingChartQuestionRef: React.MutableRefObject<string>;
  setPartnerSeed: (partner: Partial<PersonalCase> | undefined) => void;
  setCompatRelationship: (rel: SynastryRelationship) => void;
  setCompatibilityMethod: (method: CompatibilityChartTabId) => void;
  setPreferredPersonalChartTab: (tab: PersonalChartTabId) => void;
  openHomeTileWorkbench: (itemId: string) => void;
  executeDivination: (method: Method, rawPayload: Record<string, unknown>) => Promise<void>;
  quickExecuteHomeTile: (
    itemId: string,
    customQuestion?: string,
    castNumbers?: number[],
  ) => Promise<void>;
  navigateToRoute: (
    route: WorkspaceRouteId,
    params?: {
      featureId?: string;
      method?: Method;
      domain?: TopDomainId;
      resultRef?: WorkspaceResultRef;
    },
  ) => void;
  openResult: (ctx: Parameters<ResultPageController['openWithContext']>[0]) => Promise<void>;
}

export async function applyLocalAgentRecommendationAction(
  deps: AgentActionDeps,
  payload: LocalAgentApplyPayload,
): Promise<void> {
  const qText = payload.query.trim();
  deps.pendingChartQuestionRef.current = qText;
  const toPersonalCasePatch = (
    profile: LocalAgentApplyPayload['profiles'][number],
    base: Partial<PersonalCase>,
    defaultName: string,
  ): PersonalCase => {
    const nowIso = new Date().toISOString();
    return {
      ...deps.seededPerson,
      ...base,
      id: base.id || `temp-${Date.now()}`,
      isTemporary: true,
      name: profile.name || defaultName,
      gender: profile.gender ?? base.gender ?? 'male',
      calendar: profile.calendarType,
      dateType: profile.calendarType,
      isLeapMonth: Boolean(profile.isLeapMonth),
      year: String(profile.year),
      month: String(profile.month),
      day: String(profile.day),
      timeIndex: profile.timeIndex,
      birthHour: profile.hour !== undefined ? String(profile.hour) : '',
      birthMinute: profile.hour !== undefined ? String(profile.minute ?? 0) : '',
      birthSecond: profile.hour !== undefined ? String(profile.second ?? 0) : '',
      ...(profile.birthPlace
        ? {
            birthPlace: profile.birthPlace,
            latitude: profile.latitude ?? base.latitude,
            longitude: profile.longitude ?? base.longitude,
            ...(profile.timezone !== undefined ? { timezone: profile.timezone } : {}),
            ...(profile.timeZoneId ? { timeZoneId: profile.timeZoneId } : {}),
            useTrueSolarTime: true,
          }
        : {}),
      updatedAt: nowIso,
    };
  };

  let firstCase: PersonalCase | null = null;
  let secondCase: PersonalCase | null = null;
  const attachedCase = payload.attachedCaseId ? getPersonalCaseById(payload.attachedCaseId) : null;
  if (payload.profiles.length >= 2) {
    setActiveCaseId(null);
    firstCase = toPersonalCasePatch(payload.profiles[0]!, deps.seededPerson, '命主一');
    saveTemporaryCase(firstCase);
    secondCase = toPersonalCasePatch(
      payload.profiles[1]!,
      deps.partnerSeed ?? deps.seededPerson,
      '命主二',
    );
    deps.setPartnerSeed(secondCase);
  } else if (payload.profiles.length === 1) {
    if (attachedCase && isCompatibilityChartMethod(payload.method)) {
      firstCase = attachedCase;
      secondCase = toPersonalCasePatch(
        payload.profiles[0]!,
        deps.partnerSeed ?? deps.seededPerson,
        '命主二',
      );
      deps.setPartnerSeed(secondCase);
    } else {
      setActiveCaseId(null);
      firstCase = toPersonalCasePatch(payload.profiles[0]!, deps.seededPerson, '命主一');
      saveTemporaryCase(firstCase);
    }
  } else if (attachedCase) {
    firstCase = attachedCase;
  }
  const rel = payload.relationship ?? deps.compatRelationship;
  if (payload.relationship) {
    deps.setCompatRelationship(payload.relationship);
  }

  const method = payload.method;

  if (isCompatibilityChartMethod(method) || payload.profiles.length >= 2) {
    const targetCompatMethod: CompatibilityChartTabId = isCompatibilityChartMethod(method)
      ? method
      : 'bazi-synastry';
    deps.setCompatibilityMethod(targetCompatMethod);
    const needsExactTime = targetCompatMethod === 'astrolabe-synastry';
    const canDirectRun =
      Boolean(firstCase && secondCase) &&
      (!needsExactTime ||
        (firstCase!.timeIndex !== 'unknown' && secondCase!.timeIndex !== 'unknown'));

    if (canDirectRun && firstCase && secondCase) {
      deps.pendingChartQuestionRef.current = '';
      const { buildCompatibilityChartPayload } = await import('../v2-ui/chart-payloads');
      const compatPayload = buildCompatibilityChartPayload(
        firstCase,
        secondCase,
        targetCompatMethod,
        qText,
        { relationship: rel },
      );
      const savedCompat = upsertCompatibilityRecord(firstCase, secondCase, {
        method: targetCompatMethod,
        question: qText,
        inputJson: JSON.stringify(compatPayload),
      });
      deps.navigateToRoute('result', {
        featureId: 'compatibility',
        method: targetCompatMethod,
        domain: 'personal-chart',
        resultRef: {
          mode: 'compatibility',
          recordId: savedCompat.id,
        },
      });
      await deps.openResult({
        mode: 'compatibility',
        activeMethod: targetCompatMethod,
        person: firstCase,
        partner: secondCase,
        compatibilityRelationship: rel,
        ...(qText ? { question: qText } : {}),
      });
      return;
    }

    deps.navigateToRoute('chart-input', {
      featureId: 'compatibility',
      method: targetCompatMethod,
      domain: 'personal-chart',
    });
    return;
  }

  if (isPersonalChartMethod(method)) {
    deps.setPreferredPersonalChartTab(method);
    const needsExactTime = method === 'astrolabe' || method === 'qizheng' || method === 'minglu';
    const canDirectRun =
      Boolean(firstCase) && (!needsExactTime || firstCase!.timeIndex !== 'unknown');

    if (canDirectRun && firstCase) {
      deps.pendingChartQuestionRef.current = '';
      deps.navigateToRoute('result', {
        featureId: method,
        method,
        domain: 'personal-chart',
        resultRef: { mode: 'personal' },
      });
      await deps.openResult({
        mode: 'personal',
        activeMethod: method,
        person: firstCase,
        ...(qText ? { question: qText } : {}),
      });
      return;
    }

    deps.navigateToRoute('chart-input', {
      featureId: method,
      method,
      domain: 'personal-chart',
    });
    return;
  }

  if (method === 'number-energy' && payload.structured.numberEnergy) {
    const val = payload.structured.numberEnergy;
    const purpose = /^1[3-9]\d{9}$/.test(val)
      ? 'phone'
      : /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]/.test(val)
        ? 'plate'
        : 'general';
    await deps.executeDivination('number-energy', {
      value: val,
      purpose,
      question: qText || '请分析这组号码的八星磁场分布与数理吉凶。',
    });
    return;
  }

  if (method === 'chinese-name' && payload.structured.targetName) {
    await deps.executeDivination('chinese-name', {
      fullName: payload.structured.targetName,
      question: qText || `请综合评测姓名「${payload.structured.targetName}」的音形义与数理吉凶。`,
    });
    return;
  }

  const directDivinationMethods = new Set<string>([
    'liuyao',
    'meihua',
    'qimen',
    'liuren',
    'jinkoujue',
    'xiaoliuren',
    'tarot',
    'lenormand',
    'ssgw',
    'zhuge',
    'taiyi',
    'random-divination',
  ]);
  if (directDivinationMethods.has(method)) {
    await deps.quickExecuteHomeTile(method, qText, payload.structured.castNumbers);
    return;
  }

  deps.openHomeTileWorkbench(method);

  if (qText && typeof window !== 'undefined') {
    window.setTimeout(() => {
      const input = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
        '.workspace-divination-page textarea.workspace-ui-control, .workspace-divination-page input[placeholder*="问"], .workspace-divination-page textarea[placeholder*="问"]',
      );
      if (input && !input.value.trim()) {
        input.value = qText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 60);
  }
}

export async function openVisualResultFromAgentAction(
  deps: Pick<AgentActionDeps, 'navigateToRoute' | 'openResult'>,
  trace: AgentToolTrace,
): Promise<void> {
  const { restoreToolTraceResult } = await import('../web-agent');
  const restored = await restoreToolTraceResult(trace);
  if (!restored) return;
  const targetMethod = restored.method;
  const domain: TopDomainId = isPersonalChartMethod(targetMethod)
    ? 'personal-chart'
    : 'divination';
  deps.navigateToRoute('result', {
    featureId: targetMethod,
    method: targetMethod,
    domain,
  });
  await deps.openResult({
    mode: 'divination',
    activeMethod: targetMethod,
    question: trace.question,
    initialPayload: restored.payload,
    initialResult: restored.result,
  });
}
