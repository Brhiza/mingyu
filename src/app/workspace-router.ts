import type { FortuneScope } from '../systems/fortune/types';
import { methodIds, methodLabels, type Method } from '../schema';
import { resolveLegacyWebRedirect } from '../v1-sunset';
import {
  isCompatibilityChartMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type PersonalChartTabId,
} from '../v2-ui/chart-payloads';
import {
  DIVINATION_FLAT_ITEMS,
  HOME_NICHE_DIVINATION_ITEMS,
  NAME_CHAR_SUB_TABS,
  type DivinationCenterMethod,
  type NameCharSubTabId,
  type TopDomainId,
  type UtilityMainTabId,
  type WorkspaceRouteId,
} from './workspace-catalog';

export const RESULT_SNAPSHOT_STORAGE_KEY = 'mingyu.v2.activeResultSnapshot';

export type ResultMode = 'personal' | 'compatibility' | 'divination';

export interface WorkspaceResultRef {
  mode?: ResultMode;
  caseId?: string;
  recordId?: string;
}

export interface ParsedWorkspaceLocation {
  route: WorkspaceRouteId;
  domainHint: TopDomainId;
  featureId: string;
  method: Method;
  fortuneScope?: FortuneScope;
  utilityMainTab?: UtilityMainTabId;
  nameCharSubTab?: NameCharSubTabId;
  divinationMethod?: DivinationCenterMethod;
  compatibilityMethod?: CompatibilityChartTabId;
  personalChartTab?: PersonalChartTabId;
  chatSessionId?: string;
  resultRef?: WorkspaceResultRef;
  canonicalPath: string;
}

export interface WorkspaceUrlBuildInput {
  route: WorkspaceRouteId;
  domainHint?: TopDomainId;
  featureId?: string;
  method?: Method;
  fortuneScope?: FortuneScope;
  utilityMainTab?: UtilityMainTabId;
  nameCharSubTab?: NameCharSubTabId;
  chatSessionId?: string;
  resultRef?: WorkspaceResultRef;
}

export interface WorkspaceRouterDefaults {
  defaultChartFeature: PersonalChartTabId;
  defaultDivinationFeature: string;
}

export interface StoredResultSnapshot {
  url: string;
  mode: ResultMode;
  activeMethod: Method;
  featureId: string;
  domainHint: TopDomainId;
  caseId?: string;
  recordId?: string;
  person?: unknown;
  partner?: unknown;
  question?: string;
  initialPayload?: Record<string, unknown>;
  initialResult?: {
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
  };
}

export const UTILITY_SINGLE_PAGE_TITLES: Record<UtilityMainTabId, string> = {
  almanac: '择吉万年历',
  calendar: '干支天文历',
  residential: '阳宅风水',
  'name-char': '汉字经籍',
  'number-energy': '数字能量',
};

export function isStandaloneHomeMethod(
  id: string,
): id is 'taiyi' | 'huangji-jingshi' | 'wuyun-liuqi' | 'zhuge' {
  return id === 'taiyi' || id === 'huangji-jingshi' || id === 'wuyun-liuqi' || id === 'zhuge';
}

const VALID_DIVINATION_METHODS = new Set<string>([
  ...DIVINATION_FLAT_ITEMS.map((item) => item.id),
  ...HOME_NICHE_DIVINATION_ITEMS.map((item) => item.id),
]);

const VALID_NAME_CHAR_TABS = new Set<string>(NAME_CHAR_SUB_TABS.map((item) => item.id));
const VALID_METHODS = new Set<string>(methodIds);
const VALID_DOMAINS = new Set<TopDomainId>([
  'home',
  'fortune',
  'chat',
  'personal-chart',
  'divination',
  'utilities',
  'history',
  'connect',
]);

function normalizePathname(pathname: string): string {
  const collapsed = pathname.replace(/\/+/g, '/');
  if (!collapsed || collapsed === '/') return '/';
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

function normalizeDivinationAlias(raw: string): string {
  if (raw === 'kongming') return 'zhuge';
  if (raw === 'tarot-major') return 'tarot';
  return raw;
}

function resolveDefaultDivinationMethod(preferred: string): DivinationCenterMethod {
  const normalized = normalizeDivinationAlias(preferred);
  return VALID_DIVINATION_METHODS.has(normalized)
    ? (normalized as DivinationCenterMethod)
    : 'liuyao';
}

export function buildWorkspaceUrl(input: WorkspaceUrlBuildInput): string {
  switch (input.route) {
    case 'home':
      return '/';

    case 'fortune':
      if (input.fortuneScope === 'monthly' || input.fortuneScope === 'yearly') {
        return `/fortune/${input.fortuneScope}`;
      }
      return '/fortune';

    case 'chart-input': {
      const method = input.method;
      if (
        input.featureId === 'compatibility' ||
        (method && isCompatibilityChartMethod(method))
      ) {
        return '/chart/compat';
      }
      if (
        input.featureId === 'range' ||
        method === 'astrolabe-range' ||
        method === 'qizheng-range'
      ) {
        return '/chart/range';
      }
      return '/chart';
    }

    case 'time-reverse':
      return '/chart/time-reverse';

    case 'divination-input': {
      const raw = normalizeDivinationAlias(String(input.method ?? input.featureId ?? 'liuyao'));
      if (raw === 'number-energy') return '/utilities/number-energy';
      if (raw === 'almanac') return '/utilities/almanac';
      if (raw === 'residential' || raw === 'bazhai' || raw === 'xuankong') {
        return '/utilities/residential';
      }
      const target = VALID_DIVINATION_METHODS.has(raw) ? raw : 'liuyao';
      return `/divination/${target}`;
    }

    case 'utilities': {
      const mainTab = input.utilityMainTab ?? 'almanac';
      if (mainTab === 'name-char') {
        const sub = input.nameCharSubTab ?? 'chinese-name';
        return `/utilities/${VALID_NAME_CHAR_TABS.has(sub) ? sub : 'chinese-name'}`;
      }
      return `/utilities/${mainTab}`;
    }

    case 'history':
      return '/history';

    case 'connect':
      return '/connect';

    case 'chat': {
      const params = new URLSearchParams();
      if (input.chatSessionId?.trim()) {
        params.set('session', input.chatSessionId.trim());
      }
      if (input.domainHint === 'history') {
        params.set('from', 'history');
      }
      const qs = params.toString();
      return qs ? `/chat?${qs}` : '/chat';
    }

    case 'result': {
      const method = input.method && VALID_METHODS.has(input.method) ? input.method : 'bazi';
      const params = new URLSearchParams();
      const mode = input.resultRef?.mode;

      if (
        mode === 'divination' &&
        ((isPersonalChartMethod(method) && input.domainHint !== 'utilities') ||
          input.featureId === 'instant')
      ) {
        params.set('mode', 'divination');
      } else if (mode === 'personal' && !isPersonalChartMethod(method)) {
        params.set('mode', 'personal');
      } else if (mode === 'compatibility' && !isCompatibilityChartMethod(method)) {
        params.set('mode', 'compatibility');
      }

      if (input.featureId === 'instant') {
        params.set('feature', 'instant');
      }
      if (input.domainHint === 'utilities' && method === 'bazhai') {
        params.set('domain', 'utilities');
      }
      if (input.resultRef?.caseId && input.resultRef.caseId !== 'temporary') {
        params.set('case', input.resultRef.caseId);
      }
      if (input.resultRef?.recordId) {
        params.set('record', input.resultRef.recordId);
      }

      const qs = params.toString();
      return qs ? `/result/${method}?${qs}` : `/result/${method}`;
    }
  }
}

export function parseWorkspaceLocation(
  pathname: string,
  search: string,
  defaults: WorkspaceRouterDefaults,
): ParsedWorkspaceLocation {
  const rawNormalized = normalizePathname(pathname);
  const legacyTarget = resolveLegacyWebRedirect(rawNormalized);
  const normalized = legacyTarget ?? rawNormalized;
  const segments = normalized === '/' ? [] : normalized.slice(1).split('/');
  const params = new URLSearchParams(search);
  const defaultChart = isPersonalChartMethod(defaults.defaultChartFeature)
    ? defaults.defaultChartFeature
    : 'bazi';

  if (segments.length === 0) {
    return {
      route: 'home',
      domainHint: 'home',
      featureId: 'home',
      method: defaultChart,
      canonicalPath: '/',
    };
  }

  const head = segments[0];

  if (head === 'fortune') {
    const sub = segments[1];
    const scope: FortuneScope =
      sub === 'monthly' || sub === 'yearly' ? sub : 'daily';
    return {
      route: 'fortune',
      domainHint: 'fortune',
      featureId: 'fortune',
      method: 'fortune',
      fortuneScope: scope,
      canonicalPath:
        scope === 'monthly' || scope === 'yearly' ? `/fortune/${scope}` : '/fortune',
    };
  }

  if (head === 'chart') {
    const sub = segments[1];
    if (sub === 'compat' || sub === 'compatibility') {
      return {
        route: 'chart-input',
        domainHint: 'personal-chart',
        featureId: 'compatibility',
        method: 'bazi-synastry',
        compatibilityMethod: 'bazi-synastry',
        canonicalPath: '/chart/compat',
      };
    }
    if (sub === 'range') {
      return {
        route: 'chart-input',
        domainHint: 'personal-chart',
        featureId: 'range',
        method: 'astrolabe-range',
        canonicalPath: '/chart/range',
      };
    }
    if (sub === 'time-reverse') {
      return {
        route: 'time-reverse',
        domainHint: 'personal-chart',
        featureId: defaultChart,
        method: defaultChart,
        canonicalPath: '/chart/time-reverse',
      };
    }
    return {
      route: 'chart-input',
      domainHint: 'personal-chart',
      featureId: defaultChart,
      method: defaultChart,
      personalChartTab: defaultChart,
      canonicalPath: '/chart',
    };
  }

  if (head === 'divination') {
    const rawSub = normalizeDivinationAlias(segments[1] ?? '');
    if (rawSub === 'number-energy') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'number-energy',
        method: 'number-energy',
        utilityMainTab: 'number-energy',
        canonicalPath: '/utilities/number-energy',
      };
    }
    if (rawSub === 'almanac') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'almanac',
        method: 'almanac',
        utilityMainTab: 'almanac',
        canonicalPath: '/utilities/almanac',
      };
    }
    if (rawSub === 'residential' || rawSub === 'bazhai' || rawSub === 'xuankong') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'residential',
        method: 'residential',
        utilityMainTab: 'residential',
        canonicalPath: '/utilities/residential',
      };
    }
    const divMethod: DivinationCenterMethod = VALID_DIVINATION_METHODS.has(rawSub)
      ? (rawSub as DivinationCenterMethod)
      : resolveDefaultDivinationMethod(defaults.defaultDivinationFeature);
    const domainHint: TopDomainId = isStandaloneHomeMethod(divMethod) ? 'home' : 'divination';
    return {
      route: 'divination-input',
      domainHint,
      featureId: divMethod,
      method: divMethod as Method,
      divinationMethod: divMethod,
      canonicalPath: `/divination/${divMethod}`,
    };
  }

  if (head === 'utilities') {
    const rawSub = segments[1] ?? 'almanac';
    if (rawSub === 'name-char') {
      const sub2 = segments[2] ?? 'chinese-name';
      const subTab: NameCharSubTabId = VALID_NAME_CHAR_TABS.has(sub2)
        ? (sub2 as NameCharSubTabId)
        : 'chinese-name';
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: subTab,
        method: subTab,
        utilityMainTab: 'name-char',
        nameCharSubTab: subTab,
        canonicalPath: `/utilities/${subTab}`,
      };
    }
    if (VALID_NAME_CHAR_TABS.has(rawSub)) {
      const subTab = rawSub as NameCharSubTabId;
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: subTab,
        method: subTab,
        utilityMainTab: 'name-char',
        nameCharSubTab: subTab,
        canonicalPath: `/utilities/${subTab}`,
      };
    }
    if (rawSub === 'calendar') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'calendar',
        method: 'calendar',
        utilityMainTab: 'calendar',
        canonicalPath: '/utilities/calendar',
      };
    }
    if (rawSub === 'number-energy') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'number-energy',
        method: 'number-energy',
        utilityMainTab: 'number-energy',
        canonicalPath: '/utilities/number-energy',
      };
    }
    if (rawSub === 'residential' || rawSub === 'bazhai' || rawSub === 'xuankong') {
      return {
        route: 'utilities',
        domainHint: 'utilities',
        featureId: 'residential',
        method: 'residential',
        utilityMainTab: 'residential',
        canonicalPath: '/utilities/residential',
      };
    }
    return {
      route: 'utilities',
      domainHint: 'utilities',
      featureId: 'almanac',
      method: 'almanac',
      utilityMainTab: 'almanac',
      canonicalPath: '/utilities/almanac',
    };
  }

  if (head === 'history') {
    return {
      route: 'history',
      domainHint: 'history',
      featureId: 'history',
      method: defaultChart,
      canonicalPath: '/history',
    };
  }

  if (head === 'connect') {
    return {
      route: 'connect',
      domainHint: 'connect',
      featureId: 'connect',
      method: defaultChart,
      canonicalPath: '/connect',
    };
  }

  if (head === 'chat') {
    const fromHistory = params.get('from') === 'history';
    const sessionId = params.get('session')?.trim() || undefined;
    const domainHint: TopDomainId = fromHistory ? 'history' : 'home';
    return {
      route: 'chat',
      domainHint,
      featureId: 'chat',
      method: defaultChart,
      ...(sessionId ? { chatSessionId: sessionId } : {}),
      canonicalPath: buildWorkspaceUrl({
        route: 'chat',
        domainHint,
        chatSessionId: sessionId,
      }),
    };
  }

  if (head === 'result') {
    const rawMethod = segments[1] ?? '';
    if (!VALID_METHODS.has(rawMethod)) {
      return {
        route: 'home',
        domainHint: 'home',
        featureId: 'home',
        method: defaultChart,
        canonicalPath: '/',
      };
    }
    const method = rawMethod as Method;
    const rawMode = params.get('mode');
    const rawDomain = params.get('domain');
    const rawFeature = params.get('feature')?.trim() || '';
    const caseId = params.get('case')?.trim() || undefined;
    const recordId = params.get('record')?.trim() || undefined;

    const domainParam =
      rawDomain && VALID_DOMAINS.has(rawDomain as TopDomainId)
        ? (rawDomain as TopDomainId)
        : undefined;

    let mode: ResultMode;
    if (rawMode === 'personal' || rawMode === 'compatibility' || rawMode === 'divination') {
      mode = rawMode;
    } else if (isCompatibilityChartMethod(method)) {
      mode = 'compatibility';
    } else if (
      isPersonalChartMethod(method) &&
      domainParam !== 'utilities' &&
      rawFeature !== 'instant'
    ) {
      mode = 'personal';
    } else {
      mode = 'divination';
    }

    let domainHint: TopDomainId;
    if (domainParam) {
      domainHint = domainParam;
    } else if (mode === 'compatibility' || isCompatibilityChartMethod(method) || mode === 'personal') {
      domainHint = 'personal-chart';
    } else if (
      method === 'zhouyi' ||
      method === 'number-energy' ||
      method === 'almanac' ||
      method === 'residential' ||
      method === 'xuankong' ||
      method === 'calendar'
    ) {
      domainHint = 'utilities';
    } else if (isStandaloneHomeMethod(method)) {
      domainHint = 'home';
    } else {
      domainHint = 'divination';
    }

    const featureId =
      rawFeature ||
      (mode === 'compatibility'
        ? 'compatibility'
        : method === 'astrolabe-range' || method === 'qizheng-range'
          ? 'range'
          : method);

    const resultRef: WorkspaceResultRef = {
      mode,
      ...(caseId ? { caseId } : {}),
      ...(recordId ? { recordId } : {}),
    };

    return {
      route: 'result',
      domainHint,
      featureId,
      method,
      ...(isCompatibilityChartMethod(method) ? { compatibilityMethod: method } : {}),
      ...(mode === 'personal' && isPersonalChartMethod(method) && method !== 'minglu'
        ? { personalChartTab: method }
        : {}),
      resultRef,
      canonicalPath: buildWorkspaceUrl({
        route: 'result',
        domainHint,
        featureId,
        method,
        resultRef,
      }),
    };
  }

  return {
    route: 'home',
    domainHint: 'home',
    featureId: 'home',
    method: defaultChart,
    canonicalPath: '/',
  };
}

export function resolveResultFallbackTarget(input: {
  method: Method;
  mode?: ResultMode;
  featureId?: string;
  domainHint?: TopDomainId;
}): {
  route: WorkspaceRouteId;
  featureId?: string;
  method?: Method;
  domain?: TopDomainId;
  utilityMainTab?: UtilityMainTabId;
  nameCharSubTab?: NameCharSubTabId;
} {
  const { method, mode, featureId, domainHint } = input;
  if (mode === 'compatibility' || isCompatibilityChartMethod(method)) {
    return {
      route: 'chart-input',
      featureId: 'compatibility',
      method: isCompatibilityChartMethod(method) ? method : 'bazi-synastry',
      domain: 'personal-chart',
    };
  }
  if (method === 'astrolabe-range' || method === 'qizheng-range' || featureId === 'range') {
    return {
      route: 'chart-input',
      featureId: 'range',
      method: 'astrolabe-range',
      domain: 'personal-chart',
    };
  }
  if (method === 'zhouyi') {
    return {
      route: 'utilities',
      featureId: 'zhouyi',
      method: 'zhouyi',
      domain: 'utilities',
      utilityMainTab: 'name-char',
      nameCharSubTab: 'zhouyi',
    };
  }
  if (method === 'calendar') {
    return {
      route: 'utilities',
      featureId: 'calendar',
      method: 'calendar',
      domain: 'utilities',
      utilityMainTab: 'calendar',
    };
  }
  if (method === 'almanac') {
    return {
      route: 'utilities',
      featureId: 'almanac',
      method: 'almanac',
      domain: 'utilities',
      utilityMainTab: 'almanac',
    };
  }
  if (
    method === 'residential' ||
    method === 'xuankong' ||
    (method === 'bazhai' && domainHint === 'utilities')
  ) {
    return {
      route: 'utilities',
      featureId: 'residential',
      method: 'residential',
      domain: 'utilities',
      utilityMainTab: 'residential',
    };
  }
  if (method === 'number-energy') {
    return {
      route: 'utilities',
      featureId: 'number-energy',
      method: 'number-energy',
      domain: 'utilities',
      utilityMainTab: 'number-energy',
    };
  }
  if (isPersonalChartMethod(method) && mode !== 'divination') {
    const tab = method === 'minglu' ? 'bazi' : method;
    return {
      route: 'chart-input',
      featureId: tab,
      method: tab,
      domain: 'personal-chart',
    };
  }
  if (mode === 'divination' && (featureId === 'instant' || isPersonalChartMethod(method))) {
    return { route: 'home', domain: 'home' };
  }
  if (VALID_DIVINATION_METHODS.has(method)) {
    return {
      route: 'divination-input',
      featureId: method,
      method,
      domain: isStandaloneHomeMethod(method) ? 'home' : 'divination',
    };
  }
  return { route: 'home', domain: 'home' };
}

export function resolveWorkspaceDocumentTitle(input: {
  route: WorkspaceRouteId;
  activeDomain: TopDomainId;
  activeFeatureId: string;
  activeMethod: Method;
  fortuneScope?: FortuneScope;
  currentUtilityMainTab: UtilityMainTabId;
  currentNameCharSubTab: NameCharSubTabId;
}): string {
  const brand = '命语';
  if (input.route === 'home') {
    return brand;
  }
  if (input.route === 'fortune') {
    const scopeTitle =
      input.fortuneScope === 'monthly'
        ? '月运'
        : input.fortuneScope === 'yearly'
          ? '年运'
          : '日运';
    return `${scopeTitle} · ${brand}`;
  }
  if (input.route === 'chat') return `AI 对话 · ${brand}`;
  if (input.route === 'history') return `历史记录 · ${brand}`;
  if (input.route === 'connect') return `接入 AI · ${brand}`;
  if (input.route === 'time-reverse') return `时辰逆推 · ${brand}`;
  if (input.route === 'chart-input') {
    if (
      input.activeFeatureId === 'range' ||
      input.activeMethod === 'astrolabe-range' ||
      input.activeMethod === 'qizheng-range'
    ) {
      return `出生范围扫描 · ${brand}`;
    }
    if (
      input.activeFeatureId === 'compatibility' ||
      isCompatibilityChartMethod(input.activeMethod)
    ) {
      return `双人合盘 · ${brand}`;
    }
    return `命盘排盘 · ${brand}`;
  }
  if (input.route === 'utilities') {
    if (input.currentUtilityMainTab === 'name-char') {
      const subLabel =
        NAME_CHAR_SUB_TABS.find((t) => t.id === input.currentNameCharSubTab)?.label ?? '汉字经籍';
      return `${subLabel} · ${brand}`;
    }
    return `${UTILITY_SINGLE_PAGE_TITLES[input.currentUtilityMainTab]} · ${brand}`;
  }
  if (input.route === 'divination-input') {
    const label = (methodLabels as Record<string, string>)[input.activeMethod] ?? '占卜起卦';
    return `${label} · ${brand}`;
  }
  if (input.route === 'result') {
    const label = (methodLabels as Record<string, string>)[input.activeMethod] ?? '排盘结果';
    return `${label} · ${brand}`;
  }
  if (input.activeDomain === 'personal-chart') return `命盘排盘 · ${brand}`;
  return brand;
}

export function saveResultSnapshot(snapshot: StoredResultSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESULT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    try {
      const compact: StoredResultSnapshot = { ...snapshot };
      delete compact.initialResult;
      window.sessionStorage.setItem(RESULT_SNAPSHOT_STORAGE_KEY, JSON.stringify(compact));
    } catch {}
  }
}

export function loadResultSnapshot(): StoredResultSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RESULT_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredResultSnapshot>;
    if (!parsed || typeof parsed.activeMethod !== 'string' || !VALID_METHODS.has(parsed.activeMethod)) {
      return null;
    }
    if (
      parsed.mode !== 'personal' &&
      parsed.mode !== 'compatibility' &&
      parsed.mode !== 'divination'
    ) {
      return null;
    }
    return parsed as StoredResultSnapshot;
  } catch {
    return null;
  }
}
