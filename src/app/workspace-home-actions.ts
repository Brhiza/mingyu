import type { Method } from '../method-meta';
import type { SynastryRelationship } from '../systems/focus-presets';
import {
  getActiveCaseId,
  getActiveOrTemporaryCase,
  saveDivinationRecord,
  setActiveCaseId,
  sortPersonalCases,
  type PersonalCase,
} from '../v2-ui/cases-store';
import { isPersonalChartMethod, type PersonalChartTabId } from '../v2-ui/chart-tabs';
import type { ResultPageController } from '../v2-ui/result-page';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../web-settings';
import { runCalculateInBackground } from '../workers/calc-runner';
import {
  DEFAULT_HOME_INSTANT_CAST_IDS,
  HOME_INSTANT_CAST_CATALOG,
  buildInstantPayload,
  type DivinationCenterMethod,
  type TopDomainId,
  type WorkspaceRouteId,
} from './workspace-catalog';
import type { ResultMode, WorkspaceResultRef } from './workspace-router';

export interface HomeActionNavigate {
  (
    route: WorkspaceRouteId,
    params?: {
      featureId?: string;
      method?: Method;
      domain?: TopDomainId;
      resultRef?: WorkspaceResultRef;
    },
  ): void;
}

export interface HomeExecutionDeps {
  personalCases: PersonalCase[];
  homeInstantTimeStandard: 'beijing' | 'true-solar';
  homeInstantPlace: {
    displayName: string;
    longitude: number;
    latitude: number;
  };
  openHomeTileWorkbench: (itemId: string) => void;
  setPreferredPersonalChartTab: (tab: PersonalChartTabId) => void;
  setCurrentDivinationMethod: (id: DivinationCenterMethod) => void;
  navigateToRoute: HomeActionNavigate;
  openResult: (ctx: Parameters<ResultPageController['openWithContext']>[0]) => Promise<void>;
}

function pickRandomHomeCastId(): string | null {
  const candidates = DEFAULT_HOME_INSTANT_CAST_IDS.filter(
    (id) => id !== 'random-divination' && HOME_INSTANT_CAST_CATALOG.some((item) => item.id === id),
  );
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

export async function launchInstantFromHomeAction(
  deps: Pick<
    HomeExecutionDeps,
    'homeInstantTimeStandard' | 'homeInstantPlace' | 'navigateToRoute' | 'openResult'
  >,
  customQuestion?: string,
  overrideChoice?: 'bazi' | 'ziwei' | 'astrolabe' | 'qimen' | 'liuren' | 'qizheng',
): Promise<void> {
  const choice = overrideChoice ?? 'bazi';
  const userQ = customQuestion?.trim() ?? '';
  const q = userQ || '未指定具体问题';
  const { method, payload } = buildInstantPayload(
    choice,
    deps.homeInstantTimeStandard,
    deps.homeInstantPlace,
    q,
  );
  const res = (await runCalculateInBackground(
    method === 'qimen' || method === 'liuren' ? method : 'instant',
    payload,
    { promptGuidance: loadGlobalRules().prompt },
  )) as {
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
  };
  const isDirectInstant = method === 'qimen' || method === 'liuren';
  const finalMethod: Method = isDirectInstant ? method : 'instant';
  const savedInstant = saveDivinationRecord({
    type: 'instant',
    method: finalMethod,
    question: userQ,
    ...(isDirectInstant
      ? {}
      : { instantType: choice as 'bazi' | 'ziwei' | 'astrolabe' | 'qizheng' }),
    timeStandard: deps.homeInstantTimeStandard,
    inputJson: JSON.stringify(payload),
    result: res,
  });
  deps.navigateToRoute('result', {
    featureId: finalMethod,
    method: finalMethod,
    domain: 'divination',
    resultRef: {
      mode: 'divination',
      recordId: savedInstant.id,
    },
  });
  await deps.openResult({
    mode: 'divination',
    activeMethod: finalMethod,
    ...(userQ ? { question: userQ } : {}),
    initialPayload: payload,
    initialResult: res,
  });
}

export async function quickExecuteHomeTileAction(
  deps: HomeExecutionDeps,
  itemId: string,
  customQuestion?: string,
  castNumbers?: number[],
): Promise<void> {
  const targetId = itemId === 'random-divination' ? pickRandomHomeCastId() : itemId;
  if (!targetId) return;

  const instantChartMap = {
    'instant-bazi': 'bazi',
    'instant-ziwei': 'ziwei',
    'instant-astrolabe': 'astrolabe',
    'instant-qizheng': 'qizheng',
  } as const;
  if (targetId in instantChartMap) {
    await launchInstantFromHomeAction(
      deps,
      customQuestion,
      instantChartMap[targetId as keyof typeof instantChartMap],
    );
    return;
  }

  const activeId = getActiveCaseId();
  const sorted = sortPersonalCases(deps.personalCases, 'recent');
  const selectedHomeCase =
    (activeId && sorted.find((c) => c.id === activeId)) ||
    sorted[0] ||
    null;

  if (isPersonalChartMethod(targetId)) {
    const person = selectedHomeCase ?? getActiveOrTemporaryCase();
    if (selectedHomeCase) setActiveCaseId(selectedHomeCase.id);
    deps.setPreferredPersonalChartTab(targetId);
    deps.navigateToRoute('result', {
      featureId: targetId,
      method: targetId as Method,
      domain: 'personal-chart',
      resultRef: {
        mode: 'personal',
        ...(!person.isTemporary && person.id && person.id !== 'temporary'
          ? { caseId: person.id }
          : {}),
      },
    });
    await deps.openResult({
      mode: 'personal',
      activeMethod: targetId as Method,
      person,
    });
    return;
  }

  const userQ = customQuestion?.trim() ?? '';
  const q = userQ || '未指定具体问题';
  const { homeInstantTimeStandard, homeInstantPlace } = deps;
  let calcMethod: Method = 'liuren';
  let rawPayload: Record<string, unknown> = { question: q };

  if (targetId === 'liuren') {
    calcMethod = 'liuren';
    rawPayload = {
      question: q,
      liuren:
        homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' },
      prompt: { liurenTemplate: 'general' },
    };
  } else if (targetId === 'qimen') {
    calcMethod = 'qimen';
    rawPayload = {
      question: q,
      qimen: {
        method: '转盘',
        scope: 'hour',
        ...(homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' }),
      },
      prompt: { scope: 'hourly' },
    };
  } else if (targetId === 'tarot') {
    calcMethod = 'tarot';
    rawPayload = { question: q, tarot: { spread: 'three' } };
  } else if (targetId === 'lenormand') {
    calcMethod = 'lenormand';
    rawPayload = { question: q, lenormand: { spread: 'three' } };
  } else if (targetId === 'liuyao') {
    calcMethod = 'liuyao';
    rawPayload = {
      question: q,
      liuyao: {
        method: 'coins',
        ...(homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' }),
      },
      prompt: { liuyaoTemplate: 'general' },
    };
  } else if (targetId === 'meihua') {
    calcMethod = 'meihua';
    const positiveNums = (castNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
    const solarArgs =
      homeInstantTimeStandard === 'true-solar'
        ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
        : { timeStandard: 'beijing' };
    if (positiveNums.length >= 2) {
      const combined = Number.parseInt(positiveNums.map(String).join(''), 10);
      rawPayload = {
        question: q,
        meihua: {
          method: 'number',
          number: Number.isFinite(combined) && combined > 0 ? combined : positiveNums[0],
          ...solarArgs,
        },
      };
    } else {
      rawPayload = { question: q, meihua: { method: 'time', ...solarArgs } };
    }
  } else if (targetId === 'xiaoliuren') {
    calcMethod = 'xiaoliuren';
    const positiveNums = (castNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
    rawPayload = {
      question: q,
      xiaoliuren: {
        rule: 'common',
        ...(homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' }),
        ...(positiveNums.length >= 3
          ? { numbers: [positiveNums[0]!, positiveNums[1]!, positiveNums[2]!] }
          : {}),
      },
    };
  } else if (targetId === 'jinkoujue') {
    calcMethod = 'jinkoujue';
    rawPayload = {
      question: q,
      jinkoujue: {
        method: 'time',
        ...(homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' }),
      },
    };
  } else if (targetId === 'ssgw') {
    calcMethod = 'ssgw';
    rawPayload = { question: q, ssgw: {} };
  } else if (targetId === 'zhuge') {
    calcMethod = 'zhuge';
    rawPayload = { question: q, zhuge: { method: 'coins' } };
  } else if (targetId === 'taiyi') {
    calcMethod = 'taiyi';
    rawPayload = {
      question: q,
      taiyi: {
        scope: 'hour',
        ...(homeInstantTimeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
          : { timeStandard: 'beijing' }),
      },
    };
  } else {
    deps.openHomeTileWorkbench(targetId);
    return;
  }

  const payload = applyGlobalRulesToPayload(calcMethod, rawPayload, true) as Record<
    string,
    unknown
  >;
  const res = (await runCalculateInBackground(calcMethod, payload, {
    promptGuidance: loadGlobalRules().prompt,
  })) as {
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
  };
  const savedDiv = saveDivinationRecord({
    type: 'divination',
    method: calcMethod,
    question: userQ,
    caseId: null,
    inputJson: JSON.stringify(payload),
    result: res,
  });
  deps.setCurrentDivinationMethod(calcMethod as DivinationCenterMethod);
  deps.navigateToRoute('result', {
    featureId: calcMethod,
    method: calcMethod,
    domain: 'divination',
    resultRef: {
      mode: 'divination',
      recordId: savedDiv.id,
    },
  });
  await deps.openResult({
    mode: 'divination',
    activeMethod: calcMethod,
    ...(userQ ? { question: userQ } : {}),
    initialPayload: payload,
    initialResult: res,
  });
}

export type HomeExecuteCompatRelationship = SynastryRelationship;
export type HomeExecuteResultMode = ResultMode;
