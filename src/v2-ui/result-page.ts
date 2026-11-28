import { methodLabels, type Method } from '../method-meta';
import {
  preloadCalculateEngine,
  runCalculateInBackground,
  runRepromptInBackground,
} from '../workers/calc-runner';
import {
  EXTERNAL_AI_JUMP_CHANGED_EVENT,
  getVisibleExternalAiClients,
  launchExternalAiClient,
  loadExternalAiQuickJumpSettings,
  sharePromptViaSystem,
} from '../external-ai-share';
import { NON_CLASSICS_METHODS } from '../method-registry';
import { isWebAiEnabled } from '../web-ai';
import {
  clearVisualBoard,
  preloadBoardCommonCss,
  preloadVisualBoardAssets,
  renderVisualBoard,
} from '../web-boards';
import { createBoardDetailBar, createBoardModalTrigger } from '../web-boards/dom';
import { clearReportView, extractReportSections, renderReportView } from '../web-report';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../web-settings';
import {
  getSynastryRelationshipOption,
  isSynastryRelationship,
  resolveFocusPresetsForContext,
  SYNASTRY_RELATIONSHIP_OPTIONS,
  type QuickFocusPreset,
  type SynastryRelationship,
} from '../systems/focus-presets';
import { parseQuestionContext } from '../systems/question-context';
import {
  resolveAutoFrameworkForPrompt,
  type FrameworkId,
} from '../router-model/frameworks';
import { mergeFrameworkIntoPrompt } from '../prompt-guidance';
import {
  formatFrameworkPromptBlock,
  generateChartFollowUps,
  recommendFrameworkForMethod,
} from '../router-model/chart-assistant';
import {
  formatCaseSummary,
  type PersonalCase,
} from './cases-store';
import { createCustomSelect } from './custom-select';
import {
  DEFAULT_SUPPLEMENTARY_VALUES,
  formatSupplementaryAppendix,
  openQuestionInspirationModal,
  type SupplementaryInfoValues,
} from './inspiration-modals';
import { distillPromptForBrief, distillPromptForUser } from '../prompt-profile';

import {
  COMPATIBILITY_CHART_TABS,
  PERSONAL_CHART_TABS,
  buildCompatibilityChartPayload,
  buildPersonalChartPayload,
  inferCompatibilityFlowFromQuestion,
  isCompatibilityChartMethod,
  isPersonalChartMethod,
  resolveSyncYearsRange,
  type CompatibilityChartTabId,
  type PersonalChartTabId,
  type SyncYearsPreset,
} from './chart-payloads';
import {
  DEFAULT_HECAN_SYSTEMS,
  HECAN_SYSTEMS,
  getAvailableHecanSystems,
  getHecanSystemAvailability,
  readSavedHecanSystems,
  saveHecanSystems,
  toggleHecanSystem,
  type HecanComputedEntry,
  type HecanOmittedEntry,
  type HecanSystemId,
  type MultiHecanData,
} from './multi-hecan-meta';

export {
  COMPATIBILITY_CHART_TABS,
  PERSONAL_CHART_TABS,
  buildCompatibilityChartPayload,
  buildPersonalChartPayload,
  inferCompatibilityFlowFromQuestion,
  isCompatibilityChartMethod,
  isPersonalChartMethod,
  resolveSyncYearsRange,
  type CompatibilityChartTabId,
  type PersonalChartTabId,
  type SyncYearsPreset,
};

function supportsClassicalReferences(method: Method): boolean {
  return !NON_CLASSICS_METHODS.has(method);
}

/** 仅对真正附带传统古籍摘录（而非 1 行来源/牌组声明）的术数开放「含古籍」第三档按钮。 */
const METHODS_WITHOUT_CLASSICS_TIER = new Set<Method>([
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
]);

function supportsUiClassicsTier(method: Method): boolean {
  return supportsClassicalReferences(method) && !METHODS_WITHOUT_CLASSICS_TIER.has(method);
}

export interface ResultPageContext {
  mode: 'personal' | 'compatibility' | 'divination';
  activeMethod: Method;
  person?: PersonalCase;
  partner?: PersonalCase;
  compatibilityRelationship?: SynastryRelationship;
  question?: string;
  initialPayload?: Record<string, unknown>;
  initialResult?: {
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
  };
}

export interface ResultPageOptions {
  container: HTMLElement;
  sharedAiPane: HTMLElement | null;
  onBackToForm: (method: Method) => void;
  onOpenSwitchPerson?: () => void;
  onActiveMethodChange?: (method: Method) => void;
  onActiveResultChange?: (
    method: Method,
    payload: Record<string, unknown>,
    result: {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
      followUps?: Array<{ label: string; question: string; reason?: string }>;
    },
  ) => void;
  onMobileAssistantToggle?: (isOpen: boolean) => void;
}

export interface ResultPageController {
  openWithContext: (ctx: ResultPageContext) => Promise<void>;
  prepareForTransition: (mode?: 'personal' | 'compatibility' | 'divination', method?: Method) => void;
  refreshForActiveCase: (person: PersonalCase) => Promise<void>;
  setMobileAssistantOpen: (open: boolean) => void;
  isMobileAssistantOpen: () => boolean;
}

function createCopyIconSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>';
  return svg;
}

let resultCssPromise: Promise<unknown> | null = null;
function ensureResultCssLoaded(): Promise<unknown> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!resultCssPromise) {
    resultCssPromise = Promise.all([
      import('../styles/result-workbench.css'),
      import('../styles/bazi-classics.css'),
    ]);
  }
  return resultCssPromise;
}

export function preloadResultPageStyles(): void {
  void ensureResultCssLoaded().catch(() => {});
}

export function preloadResultWorkspace(
  method?: Method,
  opts?: { skipCalculator?: boolean },
): void {
  preloadResultPageStyles();
  if (method) {
    if (!opts?.skipCalculator) {
      preloadCalculateEngine(method);
    }
    preloadVisualBoardAssets(method);
  } else {
    preloadBoardCommonCss();
  }
}

/**
 * 创建 100% 对齐 V1 `ResultPage/index.tsx` 与 `DivinationResult.tsx` 的双栏结果页工作台控制器。
 */
export function createResultPageController(options: ResultPageOptions): ResultPageController {
  void ensureResultCssLoaded();
  const {
    container,
    sharedAiPane,
    onBackToForm,
    onOpenSwitchPerson,
    onActiveMethodChange,
    onActiveResultChange,
    onMobileAssistantToggle,
  } = options;

  let currentCtx: ResultPageContext | null = null;
  let includeClassics = loadGlobalRules().prompt.includeClassics;
  type PromptDensityTier = 'brief' | 'standard' | 'deep';
  let promptDensityTier: PromptDensityTier = includeClassics ? 'deep' : 'standard';
  let latestRawPromptText = '';
  let latestFollowUps: Array<{ label: string; question: string; reason?: string }> = [];
  let compatRelationship: SynastryRelationship = 'marriage';
  let questionDraft = '';
  let lastAppliedQuestion = '';
  let computeToken = 0;

  let latestPayload: Record<string, unknown> = {};
  let latestResult: {
    currentTime?: string;
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
    promptOptions?: unknown;
  } | null = null;

  let selectedHecanSystems: HecanSystemId[] = readSavedHecanSystems();
  const hecanSystemCache = new Map<string, HecanComputedEntry>();
  let latestHecanComputedMap: Partial<Record<HecanSystemId, HecanComputedEntry>> = {};
  let latestHecanOmitted: HecanOmittedEntry[] = [];
  let latestHecanIncludeClassics = includeClassics;
  let hecanComputing = false;

  function isPersonalHecanMode(method = currentCtx?.activeMethod): boolean {
    return currentCtx?.mode === 'personal' && method === 'bazi-ziwei';
  }

  function getHecanDisplayLabel(): string {
    const names = selectedHecanSystems
      .map((id) => HECAN_SYSTEMS.find((s) => s.id === id)?.shortLabel)
      .filter((x): x is string => Boolean(x));
    if (names.length > 0 && names.length <= 3) {
      return `${names.join('·')}合参`;
    }
    return names.length > 3 ? `多术数合参（${names.length}项）` : '多术数合参';
  }

  const resultCache = new Map<
    string,
    {
      payload: Record<string, unknown>;
      result: { summary?: unknown; prompt?: { text: string }; data?: unknown };
    }
  >();

  function getCaseSignature(
    person?: PersonalCase,
    partner?: PersonalCase,
    question?: string,
  ): string {
    const classicsKey = includeClassics ? 'cls:1' : 'cls:0';
    if (!person) return `div:${question ?? ''}:${classicsKey}`;
    const p1 = `${person.id}:${person.gender}:${person.calendar}:${person.isLeapMonth}:${person.year}-${person.month}-${person.day}:${person.timeIndex}:${person.birthHour}:${person.birthMinute}:${person.useTrueSolarTime}:${person.birthPlace}:${person.longitude ?? ''}`;
    const p2 = partner
      ? `|${partner.id}:${partner.gender}:${partner.calendar}:${partner.year}-${partner.month}-${partner.day}:${partner.timeIndex}:${partner.birthHour}:${partner.birthMinute}`
      : '';
    return `${p1}${p2}|q:${question ?? ''}|${classicsKey}`;
  }

  let mobileAssistantOpen = false;
  const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 1023;

  function syncParentMainClass() {
    const mainEl = container.closest('.workspace-main');
    if (!mainEl) return;
    const isVisible = !container.hidden;
    const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
    const isHecan = isPersonalHecanMode();
    const isAssistantImmersive =
      isVisible && isMobileViewport() && mobileAssistantOpen && !isMinglu && !isHecan;
    const hasMobileDock = isVisible && isMobileViewport() && !isMinglu && !isHecan;
    mainEl.classList.toggle('is-result', isVisible);
    mainEl.classList.toggle('is-result-assistant', isAssistantImmersive);
    mainEl.classList.toggle('is-result-ai-stage', isAssistantImmersive && isWebAiEnabled());
    mainEl.classList.toggle('has-mobile-dock', hasMobileDock);
  }

  const visibilityObserver = new MutationObserver(() => {
    syncParentMainClass();
  });
  visibilityObserver.observe(container, { attributes: true, attributeFilter: ['hidden'] });

  // =========================================================================
  // 1. 共享盘面内容节点（挂载于命盘左栏或占卜左栏）
  // =========================================================================
  const chartGridSingle = document.createElement('div');
  chartGridSingle.className = 'v2-result-board-stack is-view-all';
  chartGridSingle.dataset.chartView = 'all';

  let lastHasBoard = false;
  let lastHasReport = false;
  let latestReportContext: { result: unknown; method: Method; question: string } | null = null;

  const v2BoardStack = document.createElement('div');
  v2BoardStack.className = 'v2-board-stack-body';

  const loadingBanner = document.createElement('div');
  loadingBanner.className = 'workspace-ui-surface workspace-result-skeleton';
  loadingBanner.hidden = true;
  loadingBanner.setAttribute('role', 'status');
  loadingBanner.setAttribute('aria-label', '正在排盘');

  function showLoadingSkeleton(labelText = '正在排盘计算') {
    loadingBanner.className = 'workspace-ui-surface workspace-result-skeleton';
    loadingBanner.setAttribute('aria-label', labelText);
    loadingBanner.setAttribute('aria-busy', 'true');
    loadingBanner.innerHTML = `
      <div class="skeleton-head">
        <span class="skeleton-block is-title"></span>
        <span class="skeleton-block is-pill"></span>
      </div>
      <div class="skeleton-grid">
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
      </div>
      <div class="skeleton-block is-board"></div>
      <div class="skeleton-lines">
        <span class="skeleton-block is-line"></span>
        <span class="skeleton-block is-line is-short"></span>
      </div>
    `;
    loadingBanner.hidden = false;
  }

  function showLoadingError(message: string) {
    loadingBanner.className = 'workspace-ui-surface workspace-result-skeleton is-error';
    loadingBanner.textContent = `排盘计算失败：${message}`;
    loadingBanner.hidden = false;
  }

  const boardContainer = document.createElement('div');
  boardContainer.className = 'board-view';

  const reportDetails = document.createElement('details');
  reportDetails.className = 'report-details workspace-ui-surface is-collapsible';
  reportDetails.open = true;
  const reportHeading = document.createElement('summary');
  reportHeading.className = 'v2-report-section-heading';
  reportHeading.textContent = '详细报告';
  const reportContainer = document.createElement('div');
  reportContainer.className = 'v2-report-section-body';
  reportDetails.append(reportHeading, reportContainer);

  let selectedFlowYear: number | null = null;
  let selectedSyncYearsPreset: SyncYearsPreset = 'none';
  const flowCurrentYear = new Date().getFullYear();

  const chartInteractiveBar = document.createElement('div');
  chartInteractiveBar.className = 'workspace-ui-inline-controls v2-chart-interactive-bar';
  chartInteractiveBar.hidden = true;

  function renderFlowYearControls(labelText: string, defaultLabel: string) {
    const wrap = document.createElement('div');
    wrap.className = 'workspace-ui-inline-field is-flow-year-field';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;

    const minY = Math.min(flowCurrentYear - 10, selectedFlowYear ?? flowCurrentYear);
    const maxY = Math.max(flowCurrentYear + 15, selectedFlowYear ?? flowCurrentYear);
    const flowYearOptions: Array<{ value: string; label: string }> = [
      { value: '', label: defaultLabel },
    ];
    for (let y = minY; y <= maxY; y += 1) {
      flowYearOptions.push({ value: String(y), label: `${y} 年` });
    }

    const stepYear = (delta: number) => {
      const base = selectedFlowYear ?? flowCurrentYear;
      const next = Math.min(2100, Math.max(1900, base + delta));
      selectedFlowYear = next;
      void loadAndRenderActiveTab();
    };

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'workspace-ui-button is-secondary is-small v2-flow-step-btn';
    prevBtn.setAttribute('aria-label', '上一年');
    prevBtn.innerHTML = '<span class="v2-flow-step-full">← 上一年</span><span class="v2-flow-step-short" aria-hidden="true">‹</span>';
    prevBtn.addEventListener('click', () => stepYear(-1));

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'workspace-ui-button is-secondary is-small v2-flow-step-btn';
    nextBtn.setAttribute('aria-label', '下一年');
    nextBtn.innerHTML = '<span class="v2-flow-step-full">下一年 →</span><span class="v2-flow-step-short" aria-hidden="true">›</span>';
    nextBtn.addEventListener('click', () => stepYear(1));

    const selectEl = createCustomSelect({
      ariaLabel: '选择推运年份',
      variant: 'compact',
      value: selectedFlowYear === null ? '' : String(selectedFlowYear),
      options: flowYearOptions,
      onChange: (val) => {
        selectedFlowYear = val ? Number(val) : null;
        void loadAndRenderActiveTab();
      },
    });

    wrap.append(labelSpan, prevBtn, selectEl, nextBtn);
    chartInteractiveBar.appendChild(wrap);
  }

  function renderSyncYearsControls(method: Method) {
    const baseYear = selectedFlowYear ?? flowCurrentYear;
    const fmt = (preset: SyncYearsPreset, title: string) => {
      const r = resolveSyncYearsRange(preset, baseYear);
      return r ? `${title}（${r.startYear}–${r.endYear}）` : title;
    };
    const wrap = document.createElement('div');
    wrap.className = 'workspace-ui-inline-field';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = method === 'astrolabe-synastry' ? '多年行运同步' : '多年流年同步';

    const presets: Array<{ value: SyncYearsPreset; label: string }> = [
      { value: 'none', label: '不开启' },
      { value: 'next3', label: fmt('next3', '未来 3 年') },
      { value: 'next5', label: fmt('next5', '未来 5 年') },
      { value: 'around5', label: fmt('around5', '前后 5 年') },
      { value: 'next10', label: fmt('next10', '未来 10 年') },
    ];

    const selectEl = createCustomSelect({
      ariaLabel: '选择多年流年同步范围',
      variant: 'compact',
      value: selectedSyncYearsPreset,
      options: presets,
      onChange: (val) => {
        selectedSyncYearsPreset = (val || 'none') as SyncYearsPreset;
        void loadAndRenderActiveTab();
      },
    });

    wrap.append(labelSpan, selectEl);
    chartInteractiveBar.appendChild(wrap);
  }

  function syncInteractiveControlsBar(method: Method) {
    chartInteractiveBar.replaceChildren();
    const person = currentCtx?.person;

    if (currentCtx?.mode === 'compatibility') {
      const partner = currentCtx.partner;
      if (!person || !partner || !isCompatibilityChartMethod(method)) {
        chartInteractiveBar.hidden = true;
        return;
      }
      const p1Exact = person.timeIndex !== 'unknown' && !person.reverseSource;
      const p2Exact = partner.timeIndex !== 'unknown' && !partner.reverseSource;

      if (method === 'bazi-synastry') {
        const canBaziFortune = p1Exact && p2Exact && Boolean(person.gender) && Boolean(partner.gender);
        if (!canBaziFortune) {
          const hint = document.createElement('span');
          hint.className = 'workspace-ui-inline-hint';
          hint.textContent = '需双方精确时辰与性别';
          chartInteractiveBar.appendChild(hint);
          chartInteractiveBar.hidden = false;
          return;
        }
        renderFlowYearControls('流年参考年份', `当前默认（${flowCurrentYear} 年）`);
        renderSyncYearsControls(method);
        chartInteractiveBar.hidden = false;
        return;
      }

      if (method === 'ziwei-synastry') {
        renderFlowYearControls('流年参考年份', `当前默认（${flowCurrentYear} 年）`);
        if (p1Exact && p2Exact) {
          renderSyncYearsControls(method);
        }
        chartInteractiveBar.hidden = false;
        return;
      }

      if (method === 'astrolabe-synastry') {
        renderFlowYearControls('流年行运切片', '仅看本命合盘');
        renderSyncYearsControls(method);
        chartInteractiveBar.hidden = false;
        return;
      }
    }

    if (currentCtx?.mode !== 'personal' || !person) {
      chartInteractiveBar.hidden = true;
      return;
    }

    if (method === 'bazi-ziwei') {
      const canHecanFlow =
        person.timeIndex !== 'unknown' &&
        !person.reverseSource &&
        selectedHecanSystems.some(
          (id) => id === 'bazi' || id === 'ziwei' || id === 'astrolabe' || id === 'qizheng',
        );
      if (canHecanFlow) {
        renderFlowYearControls('流年参考年份', `当前默认（${flowCurrentYear} 年）`);
      }
      chartInteractiveBar.hidden = chartInteractiveBar.childElementCount === 0;
      return;
    }

    const canSwitchFlow =
      method === 'ziwei' ||
      method === 'astrolabe' ||
      method === 'qizheng';

    if (!canSwitchFlow) {
      chartInteractiveBar.hidden = true;
      return;
    }

    const isSlice = method === 'astrolabe' || method === 'qizheng';
    renderFlowYearControls(
      isSlice ? '流年推运切片' : '流年参考年份',
      isSlice ? '仅看本命盘' : `当前默认（${flowCurrentYear} 年）`,
    );
    chartInteractiveBar.hidden = false;
  }

  function renderHecanConfigPanel(person: PersonalCase, data?: MultiHecanData | null) {
    const availableIds = getAvailableHecanSystems(person);
    const allAvailableSelected =
      availableIds.length > 0 && availableIds.every((id) => selectedHecanSystems.includes(id));

    const panel = document.createElement('section');
    panel.className = 'workspace-ui-surface hecan-config-panel';
    panel.setAttribute('aria-label', '合参术数选择');

    const head = document.createElement('div');
    head.className = 'hecan-config-head';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'hecan-config-title-group';
    const titleEl = document.createElement('h3');
    titleEl.textContent = '合参术数';
    const countPill = document.createElement('span');
    countPill.className = 'hecan-count-pill';
    const activeSelectedCount = selectedHecanSystems.filter((id) => availableIds.includes(id)).length;
    countPill.textContent = hecanComputing
      ? '计算中…'
      : `已选 ${activeSelectedCount}/${availableIds.length}`;
    titleGroup.append(titleEl, countPill);

    const headActions = document.createElement('div');
    headActions.className = 'hecan-config-actions';

    if (!allAvailableSelected && availableIds.length > 0) {
      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'workspace-ui-button is-secondary is-small hecan-select-all-btn';
      selectAllBtn.textContent = '全选';
      selectAllBtn.addEventListener('click', () => {
        selectedHecanSystems = saveHecanSystems(availableIds);
        syncInteractiveControlsBar('bazi-ziwei');
        void loadAndRenderActiveTab();
      });
      headActions.appendChild(selectAllBtn);
    } else if (availableIds.length > 2) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'workspace-ui-button is-secondary is-small hecan-select-all-btn';
      resetBtn.textContent = '恢复默认';
      resetBtn.addEventListener('click', () => {
        selectedHecanSystems = saveHecanSystems(DEFAULT_HECAN_SYSTEMS);
        syncInteractiveControlsBar('bazi-ziwei');
        void loadAndRenderActiveTab();
      });
      headActions.appendChild(resetBtn);
    }

    head.append(titleGroup, headActions);
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'hecan-system-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '选择参与合参的术数');

    for (const sys of HECAN_SYSTEMS) {
      const avail = getHecanSystemAvailability(person, sys.id);
      const isSelected = selectedHecanSystems.includes(sys.id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.setAttribute('role', 'checkbox');
      chip.setAttribute('aria-checked', String(isSelected && avail.available));
      chip.className = `hecan-system-chip${isSelected && avail.available ? ' is-selected' : ''}${
        !avail.available ? ' is-disabled' : ''
      }`;
      chip.disabled = !avail.available;
      if (!avail.available && avail.reason) {
        chip.title = avail.reason;
      }

      const checkBox = document.createElement('span');
      checkBox.className = 'hecan-system-check';
      checkBox.setAttribute('aria-hidden', 'true');
      if (isSelected && avail.available) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '11');
        svg.setAttribute('height', '11');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.8');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M20 6 9 17l-5-5');
        svg.appendChild(path);
        checkBox.appendChild(svg);
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = 'hecan-system-label';
      labelSpan.textContent = sys.label;

      chip.append(checkBox, labelSpan);

      if (!avail.available && avail.reason) {
        const tag = document.createElement('span');
        tag.className = 'hecan-system-unavail-tag';
        tag.textContent = avail.reason;
        chip.appendChild(tag);
      } else {
        chip.addEventListener('click', () => {
          const next = toggleHecanSystem(selectedHecanSystems, sys.id);
          if (
            next.length === selectedHecanSystems.length &&
            next.every((v, i) => v === selectedHecanSystems[i])
          ) {
            return;
          }
          selectedHecanSystems = saveHecanSystems(next);
          syncInteractiveControlsBar('bazi-ziwei');
          void loadAndRenderActiveTab();
        });
      }

      grid.appendChild(chip);
    }

    panel.appendChild(grid);

    const anchorsList = document.createElement('div');
    anchorsList.className = 'hecan-anchors-list';
    const omittedMap = new Map((data?.omitted ?? []).map((item) => [item.id, item.reason]));

    for (const sysId of selectedHecanSystems) {
      const meta = HECAN_SYSTEMS.find((s) => s.id === sysId);
      if (!meta) continue;
      const row = document.createElement('div');
      const omittedReason = omittedMap.get(sysId);
      const anchorText = data?.anchors?.[sysId];
      row.className = `hecan-anchor-row${omittedReason ? ' is-omitted' : ''}`;

      const lbl = document.createElement('span');
      lbl.className = 'hecan-anchor-label';
      lbl.textContent = meta.shortLabel;

      const val = document.createElement('span');
      val.className = 'hecan-anchor-text';
      if (omittedReason) {
        val.textContent = omittedReason;
      } else if (anchorText) {
        val.textContent = anchorText;
      } else if (hecanComputing) {
        val.textContent = '排盘计算中…';
      } else {
        val.textContent = '已就绪';
      }

      row.append(lbl, val);
      anchorsList.appendChild(row);
    }

    if (anchorsList.childElementCount > 0) {
      panel.appendChild(anchorsList);
    }

    const badgeItems: Array<{ text: string; tone: 'good' | 'warn' | 'neutral' }> = [];
    if (data?.corroboration) {
      if (data.corroboration.shaYao.isHarmonized) {
        badgeItems.push({ text: '煞刃相济', tone: 'good' });
      }
      if (data.corroboration.guiRen.isDoubleBlessed) {
        badgeItems.push({ text: '贵星并见', tone: 'good' });
      }
    }
    if (data?.crossResonance) {
      if (data.crossResonance.resonances.length > 0) {
        badgeItems.push({
          text: `强共振 ${data.crossResonance.resonances.length} 项`,
          tone: 'good',
        });
      }
      if (data.crossResonance.divergences.length > 0) {
        badgeItems.push({
          text: `张力核验 ${data.crossResonance.divergences.length} 项`,
          tone: 'warn',
        });
      }
    }

    if (badgeItems.length > 0) {
      const resBar = document.createElement('div');
      resBar.className = 'hecan-resonance-bar';
      for (const item of badgeItems) {
        const badge = document.createElement('span');
        badge.className = `hecan-resonance-chip is-${item.tone}`;
        badge.textContent = item.text;
        resBar.appendChild(badge);
      }
      panel.appendChild(resBar);
    }

    const resCount = (data?.crossResonance?.resonances.length ?? 0) + (data?.crossResonance?.divergences.length ?? 0);
    const balCount =
      (data?.corroboration?.crossSystemBalance.resonances.length ?? 0) +
      (data?.corroboration?.crossSystemBalance.tensions.length ?? 0);
    if (data?.corroboration || resCount > 0) {
      const hcBar = createBoardDetailBar([
        createBoardModalTrigger(
          '合参共振与互证详析',
          '跨体系共振、分歧与十维主题对照',
          () => {
            const frag = document.createDocumentFragment();
            if (data?.crossResonance && (data.crossResonance.resonances.length > 0 || data.crossResonance.divergences.length > 0)) {
              const sec = document.createElement('div');
              sec.className = 'lr-section';
              const h4 = document.createElement('h4');
              h4.className = 'lr-section-title';
              h4.textContent = `跨盘强共振与分歧核验（${resCount} 项）`;
              const list = document.createElement('div');
              list.className = 'wb-computed-list';
              for (const line of data.crossResonance.resonances) {
                const card = document.createElement('div');
                card.className = 'wb-computed-item is-good';
                const strong = document.createElement('strong');
                strong.className = 'wb-computed-title';
                strong.textContent = '强共振信号';
                const p = document.createElement('p');
                p.className = 'wb-computed-desc';
                p.textContent = line;
                card.append(strong, p);
                list.append(card);
              }
              for (const line of data.crossResonance.divergences) {
                const card = document.createElement('div');
                card.className = 'wb-computed-item is-bad';
                const strong = document.createElement('strong');
                strong.className = 'wb-computed-title';
                strong.textContent = '张力核验信号';
                const p = document.createElement('p');
                p.className = 'wb-computed-desc';
                p.textContent = line;
                card.append(strong, p);
                list.append(card);
              }
              sec.append(h4, list);
              frag.append(sec);
            }
            if (data?.corroboration) {
              const c = data.corroboration;
              const sumNote = document.createElement('p');
              sumNote.className = 'wb-note-box';
              sumNote.textContent = `煞曜互证：${c.shaYao.judgment}；贵人互证：${c.guiRen.judgment}`;
              frag.append(sumNote);
              if (balCount > 0) {
                const sec = document.createElement('div');
                sec.className = 'lr-section';
                const h4 = document.createElement('h4');
                h4.className = 'lr-section-title';
                h4.textContent = `八字 × 紫微互证细项（${balCount} 项）`;
                const list = document.createElement('div');
                list.className = 'wb-computed-list';
                for (const item of c.crossSystemBalance.resonances) {
                  const card = document.createElement('div');
                  card.className = 'wb-computed-item is-good';
                  const strong = document.createElement('strong');
                  strong.className = 'wb-computed-title';
                  strong.textContent = `同向 · ${item.topic}`;
                  const p = document.createElement('p');
                  p.className = 'wb-computed-desc';
                  p.textContent = `八字：${item.baziSignal} ｜ 紫微：${item.ziweiSignal}`;
                  card.append(strong, p);
                  list.append(card);
                }
                for (const item of c.crossSystemBalance.tensions) {
                  const card = document.createElement('div');
                  card.className = 'wb-computed-item is-bad';
                  const strong = document.createElement('strong');
                  strong.className = 'wb-computed-title';
                  strong.textContent = `张力 · ${item.topic}`;
                  const p = document.createElement('p');
                  p.className = 'wb-computed-desc';
                  p.textContent = `八字：${item.baziSignal} ｜ 紫微：${item.ziweiSignal}`;
                  card.append(strong, p);
                  list.append(card);
                }
                sec.append(h4, list);
                frag.append(sec);
              }
            }
            return frag;
          },
          resCount + balCount > 0 ? `${resCount + balCount}项` : undefined,
        ),
      ]);
      if (hcBar) panel.appendChild(hcBar);
    }

    boardContainer.replaceChildren(panel);
    boardContainer.hidden = false;
  }

  function attachReportModalTrigger() {
    for (const stale of Array.from(boardContainer.querySelectorAll<HTMLElement>('[data-report-modal-trigger="1"]'))) {
      const parentBar = stale.parentElement;
      stale.remove();
      if (parentBar?.classList.contains('wb-detail-actions-bar') && parentBar.childElementCount === 0) {
        parentBar.remove();
      }
    }
    const method = currentCtx?.activeMethod;
    if (!method || !lastHasBoard || !lastHasReport || method === 'minglu' || isPersonalHecanMode(method)) {
      return;
    }
    const ctx = latestReportContext;
    if (!ctx) return;
    const sections = extractReportSections(ctx.result);
    const btn = createBoardModalTrigger(
      '详细报告与依据',
      '详细报告与推演依据',
      () => {
        const host = document.createElement('div');
        host.className = 'wb-modal-report-host';
        if (latestReportContext) {
          renderReportView(host, latestReportContext.result, {
            method: latestReportContext.method,
            question: latestReportContext.question,
          });
        }
        return host;
      },
      sections && sections.length > 0 ? `${sections.length}节` : undefined,
    );
    btn.dataset.reportModalTrigger = '1';

    const bars = boardContainer.querySelectorAll<HTMLElement>('.wb-detail-actions-bar');
    const lastBar = bars.length > 0 ? bars[bars.length - 1] : undefined;
    if (lastBar) {
      lastBar.append(btn);
      return;
    }
    const bar = createBoardDetailBar([btn]);
    if (!bar) return;
    const singleChild =
      boardContainer.childElementCount === 1 && boardContainer.firstElementChild instanceof HTMLElement
        ? boardContainer.firstElementChild
        : undefined;
    if (singleChild && !singleChild.classList.contains('wb-classics-card')) {
      singleChild.append(bar);
    } else {
      boardContainer.append(bar);
    }
  }

  function applyChartViewMode(method: Method) {
    const isMinglu = method === 'minglu';
    const isHecan = isPersonalHecanMode(method);

    syncInteractiveControlsBar(method);
    boardContainer.hidden = !lastHasBoard;
    reportDetails.hidden = isMinglu || isHecan || !lastHasReport || lastHasBoard;
  }

  v2BoardStack.append(loadingBanner, boardContainer, reportDetails);
  chartGridSingle.append(chartInteractiveBar, v2BoardStack);

  // =========================================================================
  // 3. 共享右侧解读与提示词工作台节点（以解读为主，单一复制按钮，东方素宣卡片设计）
  // =========================================================================
  let supplementary: SupplementaryInfoValues = { ...DEFAULT_SUPPLEMENTARY_VALUES };

  const DIVINATION_CORE_METHODS = new Set<Method>([
    'liuyao',
    'meihua',
    'qimen',
    'liuren',
    'jinkoujue',
    'taiyi',
    'xiaoliuren',
  ]);
  const CARD_LOT_METHODS = new Set<Method>([
    'tarot',
    'lenormand',
    'ssgw',
    'zhuge',
    'random-divination',
  ]);
  const NATAL_CHART_METHODS = new Set<Method>([
    'bazi',
    'ziwei',
    'bazi-ziwei',
    'qimen-lifetime',
    'astrolabe',
    'qizheng',
    'bazi-synastry',
    'ziwei-synastry',
    'astrolabe-synastry',
  ]);

  function inferTemplateFromContext(
    method: Method,
    text: string,
    supp: SupplementaryInfoValues,
  ): 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' {
    const combined = `${text} ${supp.lifeStageContext} ${supp.subjectRole}`.trim();
    const topic = parseQuestionContext(combined).inferredTopic;
    if (topic === 'ganqing' || topic === 'shiye' || topic === 'caifu') return topic;
    if (method === 'liuyao' && (topic === 'guaishen' || topic === 'lost')) return 'guaishen';
    return 'general';
  }

  // 外露的高价值前提条（按当前算法动态展示：性别 / 出生年 / 所问对象 / 当前处境 / 关注周期）
  const contextExtractBar = document.createElement('div');
  contextExtractBar.className = 'workspace-prompt-context-strip';
  contextExtractBar.hidden = true;

  function makeInlineSelect<T extends string>(
    labelText: string,
    options: ReadonlyArray<{ value: T; label: string }>,
    getValue: () => T,
    onChangeVal: (next: T) => void | boolean,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'context-inline-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    const selectEl = createCustomSelect({
      ariaLabel: labelText,
      variant: 'inline',
      value: getValue(),
      options,
      onChange: (next) => {
        const shouldRegenerate = onChangeVal(next as T);
        if (shouldRegenerate !== false) {
          void regeneratePromptForQuestion();
        }
      },
    });
    wrap.append(span, selectEl);
    return wrap;
  }

  function syncContextExtractBar() {
    const method = currentCtx?.activeMethod;
    if (!method) {
      contextExtractBar.hidden = true;
      contextExtractBar.replaceChildren();
      return;
    }
    const showCoreDiv = DIVINATION_CORE_METHODS.has(method);
    const showCardLot = CARD_LOT_METHODS.has(method);
    const showNatal = NATAL_CHART_METHODS.has(method);
    const isCompat = currentCtx?.mode === 'compatibility';

    if (!showCoreDiv && !showCardLot && !showNatal && !isCompat) {
      contextExtractBar.hidden = true;
      contextExtractBar.replaceChildren();
      return;
    }

    contextExtractBar.hidden = false;
    contextExtractBar.replaceChildren();

    if (!isCompat && (showCoreDiv || showCardLot)) {
      const personRow = document.createElement('div');
      personRow.className = 'context-strip-row';

      const genderWrap = document.createElement('div');
      genderWrap.className = 'context-inline-field';
      const genderLbl = document.createElement('span');
      genderLbl.textContent = '性别';
      const genderSeg = document.createElement('div');
      genderSeg.className = 'context-gender-group';
      genderSeg.setAttribute('role', 'group');
      genderSeg.setAttribute('aria-label', '求测人性别');
      for (const opt of [
        { val: '' as const, text: '不填' },
        { val: '男' as const, text: '男' },
        { val: '女' as const, text: '女' },
      ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `context-gender-pill${supplementary.gender === opt.val ? ' is-active' : ''}`;
        btn.textContent = opt.text;
        btn.setAttribute('aria-pressed', String(supplementary.gender === opt.val));
        btn.addEventListener('click', () => {
          if (supplementary.gender === opt.val) return;
          supplementary = { ...supplementary, gender: opt.val };
          syncContextExtractBar();
          void regeneratePromptForQuestion();
        });
        genderSeg.appendChild(btn);
      }
      genderWrap.append(genderLbl, genderSeg);
      personRow.appendChild(genderWrap);

      if (showCoreDiv) {
        const yearWrap = document.createElement('label');
        yearWrap.className = 'context-inline-field';
        const yearLbl = document.createElement('span');
        yearLbl.textContent = '生年';
        const yearInput = document.createElement('input');
        yearInput.type = 'text';
        yearInput.inputMode = 'numeric';
        yearInput.maxLength = 4;
        yearInput.placeholder = '如1995';
        yearInput.className = 'context-year-input';
        yearInput.setAttribute('aria-label', '出生年份');
        yearInput.value = supplementary.birthYear;
        let lastSyncedYear = supplementary.birthYear;
        const commitYear = () => {
          const clean = yearInput.value.replace(/[^\d]/g, '').slice(0, 4);
          yearInput.value = clean;
          if (clean === lastSyncedYear) return;
          if (clean.length === 0 || clean.length === 4) {
            lastSyncedYear = clean;
            supplementary = { ...supplementary, birthYear: clean };
            void regeneratePromptForQuestion();
          }
        };
        yearInput.addEventListener('input', () => {
          const clean = yearInput.value.replace(/[^\d]/g, '').slice(0, 4);
          if (yearInput.value !== clean) yearInput.value = clean;
          if (clean.length === 4) commitYear();
        });
        yearInput.addEventListener('blur', commitYear);
        yearInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitYear();
          }
        });
        yearWrap.append(yearLbl, yearInput);
        personRow.appendChild(yearWrap);
      }

      contextExtractBar.appendChild(personRow);
    }

    const scopeRow = document.createElement('div');
    scopeRow.className = 'context-strip-row is-selects';

    if (isCompat) {
      scopeRow.appendChild(
        makeInlineSelect(
          '合盘关系',
          SYNASTRY_RELATIONSHIP_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
          () => compatRelationship,
          (next) => {
            if (!isSynastryRelationship(next) || compatRelationship === next) return;
            compatRelationship = next;
            const validStages = new Set(
              getSynastryRelationshipOption(next).stageOptions.map((s) => s.value),
            );
            if (!validStages.has(supplementary.lifeStageContext)) {
              supplementary = { ...supplementary, lifeStageContext: '' };
            }
            syncContextExtractBar();
            void loadAndRenderActiveTab();
            return false;
          },
        ),
      );
    } else if (showCoreDiv) {
      scopeRow.appendChild(
        makeInlineSelect(
          '问谁',
          [
            { value: '', label: '问自己' },
            { value: '伴侣对象', label: '伴侣对象' },
            { value: '家人长辈', label: '家人长辈' },
            { value: '子女晚辈', label: '子女晚辈' },
            { value: '职场合作方', label: '职场合作方' },
          ],
          () => supplementary.subjectRole,
          (next) => {
            supplementary = { ...supplementary, subjectRole: next };
          },
        ),
      );
    }

    const stageOpts = isCompat
      ? [...getSynastryRelationshipOption(compatRelationship).stageOptions]
      : [
          { value: '', label: '不限' },
          { value: '单身', label: '单身' },
          { value: '暧昧观察', label: '暧昧' },
          { value: '恋爱相处', label: '恋爱' },
          { value: '已婚', label: '已婚' },
          { value: '分手修复', label: '分手修复' },
          { value: '在职', label: '在职' },
          { value: '求职换工', label: '求职换工' },
          { value: '创业经营', label: '创业' },
        ];

    scopeRow.appendChild(
      makeInlineSelect(
        '处境',
        stageOpts,
        () => supplementary.lifeStageContext,
        (next) => {
          supplementary = { ...supplementary, lifeStageContext: next };
        },
      ),
    );

    scopeRow.appendChild(
      makeInlineSelect(
        '周期',
        [
          { value: '', label: '不限' },
          { value: '近期几天', label: '近期几天' },
          { value: '一三个月', label: '一三个月' },
          { value: '半年一年', label: '半年一年' },
          { value: '长期走向', label: '长期走向' },
        ],
        () => supplementary.timeHorizon,
        (next) => {
          supplementary = { ...supplementary, timeHorizon: next };
        },
      ),
    );

    contextExtractBar.appendChild(scopeRow);
  }

  const composerToolbar = document.createElement('div');
  composerToolbar.className = 'workspace-prompt-composer-toolbar';

  const inspirationBtn = document.createElement('button');
  inspirationBtn.type = 'button';
  inspirationBtn.className =
    'workspace-ui-button is-secondary is-small workspace-question-picker-trigger';
  inspirationBtn.textContent = '✦ 问题灵感';
  inspirationBtn.addEventListener('click', () => {
    openQuestionInspirationModal({
      method: currentCtx?.activeMethod,
      selectedQuestion: questionDraft.trim(),
      onSelect: (selected) => {
        questionDraft = selected;
        questionTextarea.value = selected;
        divinationCurrentQuestionStrong.textContent = selected;
        syncQuickFocusPills();
        void regeneratePromptForQuestion();
      },
    });
  });

  composerToolbar.append(inspirationBtn);

  // 提示词复制辅助函数（全页唯一复制按钮）
  async function copyActivePrompt(triggerBtn?: HTMLButtonElement, labelEl?: HTMLElement) {
    const text =
      latestResult?.prompt?.text ??
      deliveryPreviewPre.textContent ??
      '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('mingyu:toast', {
            detail: {
              id: `copy-${Date.now()}`,
              message: '已复制提示词',
              tone: 'success',
              durationMs: 2000,
            },
          }),
        );
      }
      if (labelEl) {
        const origLabel = labelEl.dataset.defaultText || '复制提示词';
        labelEl.textContent = '✓ 已复制';
        triggerBtn?.classList.add('is-copied');
        setTimeout(() => {
          labelEl.textContent = origLabel;
          triggerBtn?.classList.remove('is-copied');
        }, 2000);
      } else if (triggerBtn) {
        triggerBtn.title = '已复制';
      }
    } catch {
      if (labelEl) labelEl.textContent = '请展开原文复制';
    }
  }

  // 全页唯一「复制提示词」按钮：AI 模式下作为头部顺带辅助按钮；提示词模式下为主视觉高亮点按按钮
  const deliveryCopyBtn = document.createElement('button');
  deliveryCopyBtn.type = 'button';
  deliveryCopyBtn.className =
    'workspace-ui-button is-primary is-medium workspace-prompt-delivery-button is-hero-copy';
  const deliveryCopyBtnText = document.createElement('span');
  deliveryCopyBtnText.textContent = '复制提示词';
  deliveryCopyBtn.append(createCopyIconSvg(), deliveryCopyBtnText);
  deliveryCopyBtn.addEventListener('click', () =>
    copyActivePrompt(deliveryCopyBtn, deliveryCopyBtnText),
  );

  // 快捷唤起外部 AI（豆包 / DeepSeek / 系统分享）
  function createShareActionIcon(kind: 'send' | 'share'): SVGSVGElement {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (kind === 'send') {
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'm22 2-7 20-4-9-9-4Z');
      const p2 = document.createElementNS(svgNS, 'path');
      p2.setAttribute('d', 'M22 2 11 13');
      svg.append(p1, p2);
    } else {
      const c1 = document.createElementNS(svgNS, 'circle');
      c1.setAttribute('cx', '18');
      c1.setAttribute('cy', '5');
      c1.setAttribute('r', '3');
      const c2 = document.createElementNS(svgNS, 'circle');
      c2.setAttribute('cx', '6');
      c2.setAttribute('cy', '12');
      c2.setAttribute('r', '3');
      const c3 = document.createElementNS(svgNS, 'circle');
      c3.setAttribute('cx', '18');
      c3.setAttribute('cy', '19');
      c3.setAttribute('r', '3');
      const l1 = document.createElementNS(svgNS, 'line');
      l1.setAttribute('x1', '8.59');
      l1.setAttribute('y1', '13.51');
      l1.setAttribute('x2', '15.42');
      l1.setAttribute('y2', '17.49');
      const l2 = document.createElementNS(svgNS, 'line');
      l2.setAttribute('x1', '15.41');
      l2.setAttribute('y1', '6.51');
      l2.setAttribute('x2', '8.59');
      l2.setAttribute('y2', '10.49');
      svg.append(c1, c2, c3, l1, l2);
    }
    return svg;
  }

  const externalShareBar = document.createElement('div');
  externalShareBar.className = 'workspace-external-share-bar';
  const resolveShareText = () =>
    (latestResult?.prompt?.text ?? deliveryPreviewPre.textContent ?? '').trim();

  function renderExternalShareButtons() {
    externalShareBar.replaceChildren();
    const settings = loadExternalAiQuickJumpSettings();
    if (!settings.enabled) {
      externalShareBar.hidden = true;
      return;
    }
    const visibleClients = getVisibleExternalAiClients(settings);
    for (const client of visibleClients) {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'workspace-ui-button is-secondary is-small';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = client.label;
      shareBtn.append(createShareActionIcon('send'), labelSpan);
      shareBtn.addEventListener('click', async () => {
        const text = resolveShareText();
        if (!text) return;
        const { copied } = await launchExternalAiClient(client, text);
        if (copied) {
          labelSpan.textContent = '已复制';
          setTimeout(() => {
            labelSpan.textContent = client.label;
          }, 1800);
        }
      });
      externalShareBar.appendChild(shareBtn);
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const nativeShareBtn = document.createElement('button');
      nativeShareBtn.type = 'button';
      nativeShareBtn.className = 'workspace-ui-button is-secondary is-small';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = '分享';
      nativeShareBtn.append(createShareActionIcon('share'), labelSpan);
      nativeShareBtn.addEventListener('click', async () => {
        const text = resolveShareText();
        if (!text) return;
        await sharePromptViaSystem(text);
      });
      externalShareBar.appendChild(nativeShareBtn);
    }
    externalShareBar.hidden = externalShareBar.childElementCount === 0;
  }

  renderExternalShareButtons();
  if (typeof window !== 'undefined') {
    window.addEventListener(EXTERNAL_AI_JUMP_CHANGED_EVENT, renderExternalShareButtons);
  }

  // Quick Focus Presets（按板块与断事场景动态切换，AI 解读与提示词共用）
  let activeFocusPresets: ReadonlyArray<QuickFocusPreset> = resolveFocusPresetsForContext('personal', 'bazi');
  const focusContainers: HTMLDivElement[] = [];
  let focusPillButtons: Array<{ btn: HTMLButtonElement; prompt: string }> = [];

  function syncQuickFocusPills() {
    const trimmed = questionDraft.trim();
    const defaultPrompt = activeFocusPresets[0]?.prompt ?? '';
    focusPillButtons.forEach((item) => {
      const isMatch = trimmed ? item.prompt === trimmed : item.prompt === defaultPrompt;
      item.btn.classList.toggle('is-active', isMatch);
      item.btn.setAttribute('aria-pressed', String(isMatch));
    });
  }

  function renderQuickFocusIntoContainer(pillsWrap: HTMLDivElement) {
    pillsWrap.replaceChildren();
    for (const preset of activeFocusPresets) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'workspace-prompt-focus-pill';
      pill.textContent = preset.label;
      pill.addEventListener('click', () => {
        questionDraft = preset.prompt;
        questionTextarea.value = preset.prompt;
        divinationCurrentQuestionStrong.textContent = preset.prompt;
        if (
          currentCtx?.mode === 'compatibility'
          && preset.relationship
          && compatRelationship !== preset.relationship
        ) {
          compatRelationship = preset.relationship;
          const validStages = new Set(
            getSynastryRelationshipOption(compatRelationship).stageOptions.map((s) => s.value),
          );
          if (!validStages.has(supplementary.lifeStageContext)) {
            supplementary = { ...supplementary, lifeStageContext: '' };
          }
          syncContextExtractBar();
          syncQuickFocusPills();
          void loadAndRenderActiveTab();
          return;
        }
        syncQuickFocusPills();
        void regeneratePromptForQuestion();
      });
      focusPillButtons.push({ btn: pill, prompt: preset.prompt });
      pillsWrap.appendChild(pill);
    }
  }

  function rebuildQuickFocusPills() {
    activeFocusPresets = resolveFocusPresetsForContext(
      currentCtx?.mode ?? 'personal',
      currentCtx?.activeMethod ?? 'bazi',
    );
    focusPillButtons = [];
    for (const wrap of focusContainers) {
      renderQuickFocusIntoContainer(wrap);
    }
    syncQuickFocusPills();
  }

  function createQuickFocusPillsEl(): HTMLDivElement {
    const pillsWrap = document.createElement('div');
    pillsWrap.className = 'workspace-prompt-focus-pills';
    focusContainers.push(pillsWrap);
    renderQuickFocusIntoContainer(pillsWrap);
    return pillsWrap;
  }

  // 共用自定义提问输入模块（在 AI 模式与提示词模式内直接修改，无需来回切换子页）
  const divinationCurrentQuestion = document.createElement('div');
  divinationCurrentQuestion.className = 'workspace-prompt-current-question';
  const divinationCurrentQuestionSpan = document.createElement('span');
  divinationCurrentQuestionSpan.textContent = '当前方向';
  const divinationCurrentQuestionStrong = document.createElement('strong');
  divinationCurrentQuestionStrong.textContent = '综合解读当前格局与事体走向';
  divinationCurrentQuestion.append(divinationCurrentQuestionSpan, divinationCurrentQuestionStrong);

  const questionFieldLabel = document.createElement('label');
  questionFieldLabel.className = 'workspace-ui-field workspace-prompt-question-input';
  const questionFieldTitle = document.createElement('span');
  questionFieldTitle.textContent = '自定义具体问题';
  const questionTextarea = document.createElement('textarea');
  questionTextarea.className = 'workspace-ui-control';
  questionTextarea.rows = 2;
  questionTextarea.placeholder = '输入想问的具体问题…';
  questionTextarea.addEventListener('input', () => {
    questionDraft = questionTextarea.value;
    syncQuickFocusPills();
  });
  questionTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void applyCustomQuestionFromInput();
    }
  });
  questionTextarea.addEventListener('blur', () => {
    if (questionDraft.trim() !== lastAppliedQuestion) {
      void applyCustomQuestionFromInput();
    }
  });
  questionFieldLabel.append(questionFieldTitle, questionTextarea);

  function parseCaseYear(raw: string | number | undefined): number | undefined {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1900 && n <= 2100 ? Math.trunc(n) : undefined;
  }

  function resolveEffectiveFrameworkId(method: Method): FrameworkId | null {
    const activeQ = questionDraft || currentCtx?.question || '';
    const recommendedId = recommendFrameworkForMethod(activeQ, method);
    const resolved = resolveAutoFrameworkForPrompt(method, activeQ, recommendedId);
    if (isPersonalHecanMode(method) && resolved === 'natal-panorama') {
      return null;
    }
    return resolved;
  }

  function applyLocalFrameworkToPrompt(rawPromptText: string, method: Method): string {
    if (!rawPromptText.trim()) return rawPromptText;
    if (promptDensityTier === 'brief') return rawPromptText;
    const fwId = resolveEffectiveFrameworkId(method);
    if (!fwId) return rawPromptText;
    if (rawPromptText.includes('【指定解读框架：')) return rawPromptText;
    const block = formatFrameworkPromptBlock(fwId);
    return block ? mergeFrameworkIntoPrompt(rawPromptText, block) : rawPromptText;
  }

  function refreshLocalAgentFollowUps(
    method: Method,
    result: { data?: unknown; summary?: unknown } | null,
  ) {
    const suggestions = generateChartFollowUps(method, result, {
      relationship: compatRelationship,
      currentYear: flowCurrentYear,
    });
    // 追问胶囊仅透传给在线 AI 解读面板，在首轮 AI 解读完成后展示。
    latestFollowUps = isWebAiEnabled()
      ? suggestions.map((item) => ({
          label: item.label,
          question: item.question,
          reason: item.reason,
        }))
      : [];
  }

  async function applyCustomQuestionFromInput() {
    const trimmed = questionDraft.trim();
    lastAppliedQuestion = trimmed;
    divinationCurrentQuestionStrong.textContent =
      trimmed || (methodLabels[currentCtx?.activeMethod ?? 'bazi'] ?? '综合排盘分析');
    await regeneratePromptForQuestion();
  }

  const questionComposerBox = document.createElement('div');
  questionComposerBox.className = 'workspace-question-composer-box';
  questionComposerBox.append(divinationCurrentQuestion, questionFieldLabel);

  // 3A. 提示词模式面板
  const promptDeliverySection = document.createElement('section');
  promptDeliverySection.className = 'workspace-ui-surface workspace-prompt-delivery';

  const promptCardHead = document.createElement('div');
  promptCardHead.className = 'workspace-prompt-card-head';
  const promptCardCopy = document.createElement('div');
  promptCardCopy.className = 'workspace-prompt-card-copy';
  const promptCardTitle = document.createElement('h3');
  promptCardTitle.textContent = '专属 AI 提示词';
  promptCardCopy.append(promptCardTitle);

  const promptCardHeadRight = document.createElement('div');
  promptCardHeadRight.className = 'workspace-prompt-card-head-right';
  const promptCardMetaPill = document.createElement('span');
  promptCardMetaPill.className = 'workspace-prompt-meta-pill';
  promptCardHeadRight.append(promptCardMetaPill);
  promptCardHead.append(promptCardCopy, promptCardHeadRight);

  const promptHeroCopyHost = document.createElement('div');
  promptHeroCopyHost.className = 'workspace-prompt-hero-card';

  // 提示词详略三档快捷切换（精简 / 标准 / 含古籍），单行紧凑排布
  const promptTierBar = document.createElement('div');
  promptTierBar.className = 'workspace-prompt-quick-focus is-inline';
  const promptTierLabel = document.createElement('div');
  promptTierLabel.className = 'workspace-prompt-quick-focus-label';
  promptTierLabel.textContent = '详略';
  const promptTierPills = document.createElement('div');
  promptTierPills.className = 'workspace-prompt-focus-pills';
  const PROMPT_TIER_ITEMS: ReadonlyArray<{ id: PromptDensityTier; label: string; hint: string }> = [
    { id: 'brief', label: '精简', hint: '仅保留核心盘面事实，约省 45%~60% 字数' },
    { id: 'standard', label: '标准', hint: '平衡完整盘面与字数' },
    { id: 'deep', label: '含古籍', hint: '附带经典古籍原文依据' },
  ];
  const promptTierBtns = new Map<PromptDensityTier, HTMLButtonElement>();

  function estimatePromptTokens(text: string): number {
    if (!text) return 0;
    let cjk = 0;
    let other = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x4e00 && code <= 0x9fff) cjk += 1;
      else other += 1;
    }
    return Math.max(10, Math.round((cjk * 0.68 + other * 0.32) / 10) * 10);
  }

  function formatPromptForTier(rawText: string, tier: PromptDensityTier): string {
    if (!rawText) return '';
    if (tier === 'brief') return distillPromptForBrief(rawText);
    return distillPromptForUser(rawText, { includeClassics: tier === 'deep' });
  }

  function syncPromptTierButtons() {
    const hasClassics = supportsUiClassicsTier(currentCtx?.activeMethod ?? 'bazi');
    if (!hasClassics && promptDensityTier === 'deep') {
      promptDensityTier = 'standard';
    }
    for (const [id, btn] of promptTierBtns.entries()) {
      if (id === 'deep') {
        btn.hidden = !hasClassics;
        btn.textContent = '含古籍';
      }
      const isActive = promptDensityTier === id;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  for (const item of PROMPT_TIER_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'workspace-prompt-focus-pill';
    btn.textContent = item.label;
    btn.title = item.hint;
    btn.addEventListener('click', () => {
      if (promptDensityTier === item.id) return;
      const method = currentCtx?.activeMethod ?? 'bazi';
      const hasClassics = supportsUiClassicsTier(method);
      const wantClassics = item.id === 'deep' && hasClassics;
      promptDensityTier = item.id;
      syncPromptTierButtons();
      if (wantClassics && !includeClassics) {
        includeClassics = true;
        void regeneratePromptForQuestion();
        return;
      }
      if (!wantClassics && includeClassics && item.id !== 'deep') {
        includeClassics = false;
      }
      if (latestRawPromptText) {
        const base = formatPromptForTier(latestRawPromptText, promptDensityTier);
        const nextText = applyLocalFrameworkToPrompt(base, method);
        deliveryPreviewPre.textContent = nextText;
        syncPromptPreviewMeta(nextText);
        if (latestResult) {
          latestResult = { ...latestResult, prompt: { text: nextText } };
          onActiveResultChange?.(method, latestPayload, { ...latestResult, followUps: latestFollowUps });
        }
      }
    });
    promptTierBtns.set(item.id, btn);
    promptTierPills.appendChild(btn);
  }
  promptTierBar.append(promptTierLabel, promptTierPills);
  syncPromptTierButtons();

  const quickFocusWrap = document.createElement('div');
  quickFocusWrap.className = 'workspace-prompt-quick-focus';
  const quickFocusLabel = document.createElement('div');
  quickFocusLabel.className = 'workspace-prompt-quick-focus-label';
  quickFocusLabel.textContent = '分析侧重点';
  const quickFocusPills = createQuickFocusPillsEl();
  quickFocusWrap.append(quickFocusLabel, quickFocusPills);

  const contextExtractHostPrompt = document.createElement('div');
  const composerToolbarHostPrompt = document.createElement('div');
  const questionComposerHostPrompt = document.createElement('div');

  const customDrawerDetails = document.createElement('section');
  customDrawerDetails.className = 'workspace-prompt-custom-drawer';
  const customDrawerBody = document.createElement('div');
  customDrawerBody.className = 'workspace-prompt-custom-drawer-body';
  customDrawerBody.append(
    contextExtractHostPrompt,
    composerToolbarHostPrompt,
    questionComposerHostPrompt,
  );
  customDrawerDetails.append(customDrawerBody);

  // Collapsible Raw Prompt Preview (`<details class="workspace-prompt-preview">`)
  const deliveryPreviewDetails = document.createElement('details');
  deliveryPreviewDetails.className = 'workspace-prompt-preview';
  deliveryPreviewDetails.open = false;
  const deliveryPreviewSummary = document.createElement('summary');
  deliveryPreviewSummary.className = 'workspace-prompt-preview-summary';
  const deliveryPreviewTitle = document.createElement('span');
  deliveryPreviewTitle.textContent = '提示词原文';
  const deliveryPreviewMeta = document.createElement('small');
  deliveryPreviewSummary.append(deliveryPreviewTitle, deliveryPreviewMeta);
  function syncPromptPreviewMeta(text: string) {
    const len = text.length;
    const tokens = estimatePromptTokens(text);
    const metaLabel = len > 0 ? `${len} 字 · ~${tokens} tok` : '';
    deliveryPreviewMeta.textContent = metaLabel;
    promptCardMetaPill.textContent = metaLabel || '就绪';
  }
  const deliveryPreviewBody = document.createElement('div');
  deliveryPreviewBody.className = 'workspace-prompt-preview-body';
  deliveryPreviewBody.setAttribute('aria-live', 'polite');
  const deliveryPreviewPre = document.createElement('pre');
  deliveryPreviewBody.appendChild(deliveryPreviewPre);
  deliveryPreviewDetails.append(deliveryPreviewSummary, deliveryPreviewBody);

  promptDeliverySection.append(
    promptCardHead,
    promptHeroCopyHost,
    promptTierBar,
    quickFocusWrap,
    customDrawerDetails,
    deliveryPreviewDetails,
  );

  const promptWorkbenchLayout = document.createElement('div');
  promptWorkbenchLayout.className = 'workspace-prompt-layout is-workbench';
  promptWorkbenchLayout.append(promptDeliverySection);

  // 3C. AI 在线解读单一工作台（启用 AI 时展示：以解读为主，复制提示词顺带放置于顶栏）
  const aiAnswerWorkbench = document.createElement('div');
  aiAnswerWorkbench.className = 'workspace-ai-layout is-answer-workbench';

  const aiChatSurface = document.createElement('section');
  aiChatSurface.className = 'workspace-ui-surface panel-ai-chat is-workspace-chat';

  const aiWorkbenchHeader = document.createElement('div');
  aiWorkbenchHeader.className = 'ai-workbench-header';
  const aiWorkbenchHeading = document.createElement('div');
  aiWorkbenchHeading.className = 'ai-workbench-heading';
  const aiWorkbenchTitle = document.createElement('h3');
  aiWorkbenchTitle.textContent = 'AI 深度解读';
  aiWorkbenchHeading.append(aiWorkbenchTitle);
  const aiHeaderCopyHost = document.createElement('div');
  aiHeaderCopyHost.className = 'ai-workbench-header-actions';
  aiWorkbenchHeader.append(aiWorkbenchHeading, aiHeaderCopyHost);

  const aiContextBar = document.createElement('div');
  aiContextBar.className = 'ai-workbench-context-bar';
  const composerToolbarHostAi = document.createElement('div');
  const contextExtractHostAi = document.createElement('div');
  aiContextBar.append(composerToolbarHostAi, contextExtractHostAi);

  const aiQuickGuide = document.createElement('div');
  aiQuickGuide.className = 'ai-quick-guide';
  const aiQuickFocusLabel = document.createElement('div');
  aiQuickFocusLabel.className = 'workspace-prompt-quick-focus-label';
  aiQuickFocusLabel.textContent = '分析侧重点';
  const aiQuickFocusPills = createQuickFocusPillsEl();
  const questionComposerHostAi = document.createElement('div');

  aiQuickGuide.append(aiQuickFocusLabel, aiQuickFocusPills, questionComposerHostAi);
  syncQuickFocusPills();

  const sharedAiMountPoint = document.createElement('div');
  sharedAiMountPoint.className = 'ai-shared-mount';
  aiChatSurface.append(aiWorkbenchHeader, aiContextBar, aiQuickGuide, sharedAiMountPoint);
  aiAnswerWorkbench.appendChild(aiChatSurface);

  // 同步 .ai-panel 的对话/流式状态到 aiChatSurface
  const aiStateObserver = new MutationObserver(() => {
    const panel = sharedAiMountPoint.querySelector('.ai-panel');
    const isActive = Boolean(
      panel && (panel.classList.contains('has-ai-messages') || panel.classList.contains('is-ai-streaming')),
    );
    aiChatSurface.classList.toggle('is-chat-active', isActive);
  });
  aiStateObserver.observe(sharedAiMountPoint, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
  });

  // =========================================================================
  // 4. 命盘结果页 DOM 骨架（对齐 V1 `ResultPage/index.tsx` & `ResultChartTabPanes.tsx`）
  // =========================================================================
  const chartShell = document.createElement('div');
  chartShell.className = 'page-shell workspace-result-page-shell';

  const chartNavBar = document.createElement('div');
  chartNavBar.className = 'workspace-result-navigation';

  const chartTabsHost = document.createElement('div');
  chartTabsHost.className = 'workspace-ui-tabs';
  chartTabsHost.setAttribute('aria-label', '结果内容');

  const personSummaryBadge = document.createElement('button');
  personSummaryBadge.type = 'button';
  personSummaryBadge.className = 'workspace-result-person-badge';
  personSummaryBadge.title = '点击快速切换档案或修改出生资料';
  personSummaryBadge.hidden = true;
  personSummaryBadge.addEventListener('click', () => {
    if (onOpenSwitchPerson && currentCtx?.mode === 'personal') {
      onOpenSwitchPerson();
      return;
    }
    onBackToForm(currentCtx?.activeMethod ?? 'bazi');
  });

  const switchCaseBtn = document.createElement('button');
  switchCaseBtn.type = 'button';
  switchCaseBtn.className =
    'workspace-ui-button is-secondary is-small workspace-result-switch-case-btn';
  switchCaseBtn.textContent = '切换档案';
  switchCaseBtn.hidden = true;
  switchCaseBtn.addEventListener('click', () => {
    if (onOpenSwitchPerson) {
      onOpenSwitchPerson();
    } else {
      onBackToForm(currentCtx?.activeMethod ?? 'bazi');
    }
  });

  const chartBackBtn = document.createElement('button');
  chartBackBtn.type = 'button';
  chartBackBtn.className = 'workspace-ui-button is-ghost is-small workspace-result-back-btn';
  chartBackBtn.textContent = '← 修改生辰';
  chartBackBtn.addEventListener('click', () => {
    onBackToForm(currentCtx?.activeMethod ?? 'bazi');
  });

  const chartNavActions = document.createElement('div');
  chartNavActions.className = 'workspace-result-nav-actions';
  chartNavActions.append(
    personSummaryBadge,
    switchCaseBtn,
    chartBackBtn,
  );

  chartNavBar.append(chartTabsHost, chartNavActions);

  const chartStage = document.createElement('div');
  chartStage.className = 'result-tab-stage workspace-result-split';

  const chartLeftPane = document.createElement('div');
  chartLeftPane.className = 'result-tab-pane workspace-result-chart-pane is-active';
  const singlePanelShell = document.createElement('div');
  singlePanelShell.className = 'single-panel-shell';
  const chartResultSection = document.createElement('section');
  chartResultSection.className = 'workspace-ui-surface is-plain v2-result-chart-surface';
  singlePanelShell.appendChild(chartResultSection);
  chartLeftPane.appendChild(singlePanelShell);

  const chartRightPane = document.createElement('div');
  chartRightPane.className =
    'result-tab-pane workspace-result-assistant-pane is-ai-mode is-active';
  chartRightPane.setAttribute('aria-label', '解读与提示词工作台');

  chartStage.append(chartLeftPane, chartRightPane);
  chartShell.append(chartNavBar, chartStage);

  // =========================================================================
  // 5. 占卜结果页 DOM 骨架（对齐 V1 `DivinationResult.tsx`）
  // =========================================================================
  const divinationPageWrap = document.createElement('div');
  divinationPageWrap.className =
    'page-shell workspace-result-page-shell workspace-divination-result-page';
  divinationPageWrap.hidden = true;

  const divinationPanelShell = document.createElement('div');
  divinationPanelShell.className = 'divination-panel-shell';

  const divinationWorkspace = document.createElement('div');
  divinationWorkspace.className = 'divination-result-workspace is-split';

  const divinationStage = document.createElement('div');
  divinationStage.className = 'divination-result-stage';

  const divinationBoardPane = document.createElement('div');
  divinationBoardPane.className = 'divination-result-board-pane';

  const divinationResultPanel = document.createElement('section');
  divinationResultPanel.className = 'workspace-ui-surface is-plain divination-result-panel';

  const divinationPanelHead = document.createElement('div');
  divinationPanelHead.className = 'workspace-ui-panel-head divination-result-panel-head';
  const divinationPanelTitle = document.createElement('h2');
  divinationPanelTitle.textContent = '占卜排盘';

  const divinationHeadActions = document.createElement('div');
  divinationHeadActions.className = 'divination-result-actions';
  const divinationRestartBtn = document.createElement('button');
  divinationRestartBtn.type = 'button';
  divinationRestartBtn.className = 'workspace-ui-button is-secondary is-small';
  divinationRestartBtn.textContent = '重新起卦';
  divinationRestartBtn.addEventListener('click', () => {
    onBackToForm(currentCtx?.activeMethod ?? 'liuyao');
  });
  divinationHeadActions.append(divinationRestartBtn);
  divinationPanelHead.append(divinationPanelTitle, divinationHeadActions);

  const divinationBoardBodySlot = document.createElement('div');
  divinationResultPanel.append(divinationPanelHead, divinationBoardBodySlot);
  divinationBoardPane.appendChild(divinationResultPanel);

  const divinationAssistantPane = document.createElement('div');
  divinationAssistantPane.className =
    'divination-result-assistant-pane workspace-result-assistant-pane is-ai-mode';
  const divinationAiCard = document.createElement('div');
  divinationAiCard.className = 'divination-ai-card';
  divinationAssistantPane.appendChild(divinationAiCard);

  divinationStage.append(divinationBoardPane, divinationAssistantPane);
  divinationWorkspace.append(divinationStage);
  divinationPanelShell.appendChild(divinationWorkspace);
  divinationPageWrap.appendChild(divinationPanelShell);

  const mobileAiFabBtn = document.createElement('button');
  mobileAiFabBtn.type = 'button';
  mobileAiFabBtn.className = 'workspace-result-ai-fab';
  mobileAiFabBtn.hidden = true;
  const mobileAiFabSpan = document.createElement('span');
  mobileAiFabSpan.textContent = 'AI';
  mobileAiFabBtn.appendChild(mobileAiFabSpan);
  mobileAiFabBtn.addEventListener('click', () => {
    setMobileAssistantOpen(true);
  });

  // 手机端结果页专属底部快捷操作栏（替代原主导航栏与悬浮按钮：左切盘面/提示词，右一键复制提示词）
  const mobileResultDock = document.createElement('div');
  mobileResultDock.className = 'workspace-result-mobile-dock';
  mobileResultDock.hidden = true;

  const dockSeg = document.createElement('div');
  dockSeg.className = 'workspace-result-mobile-dock-seg';
  dockSeg.setAttribute('role', 'tablist');
  dockSeg.setAttribute('aria-label', '盘面与提示词切换');

  const dockBoardBtn = document.createElement('button');
  dockBoardBtn.type = 'button';
  dockBoardBtn.role = 'tab';
  dockBoardBtn.className = 'workspace-result-mobile-dock-tab is-active';
  dockBoardBtn.textContent = '盘面';
  dockBoardBtn.setAttribute('aria-selected', 'true');
  dockBoardBtn.addEventListener('click', () => setMobileAssistantOpen(false));

  const dockPromptBtn = document.createElement('button');
  dockPromptBtn.type = 'button';
  dockPromptBtn.role = 'tab';
  dockPromptBtn.className = 'workspace-result-mobile-dock-tab';
  dockPromptBtn.textContent = '提示词';
  dockPromptBtn.setAttribute('aria-selected', 'false');
  dockPromptBtn.addEventListener('click', () => setMobileAssistantOpen(true));

  dockSeg.append(dockBoardBtn, dockPromptBtn);

  const dockCopyBtn = document.createElement('button');
  dockCopyBtn.type = 'button';
  dockCopyBtn.className = 'workspace-result-mobile-dock-copy';
  const dockCopyLabel = document.createElement('span');
  dockCopyLabel.dataset.defaultText = '复制提示词';
  dockCopyLabel.textContent = '复制提示词';
  dockCopyBtn.append(createCopyIconSvg(), dockCopyLabel);
  dockCopyBtn.addEventListener('click', () => {
    void copyActivePrompt(dockCopyBtn, dockCopyLabel);
  });

  mobileResultDock.append(dockSeg, dockCopyBtn);

  const foldableAssistantBackBar = document.createElement('div');
  foldableAssistantBackBar.className = 'foldable-assistant-back-bar';
  foldableAssistantBackBar.hidden = true;
  const foldableAssistantBackBtn = document.createElement('button');
  foldableAssistantBackBtn.type = 'button';
  foldableAssistantBackBtn.className = 'workspace-ui-button is-secondary is-small';
  foldableAssistantBackBtn.textContent = '← 返回盘面';
  foldableAssistantBackBtn.addEventListener('click', () => {
    setMobileAssistantOpen(false);
  });
  foldableAssistantBackBar.appendChild(foldableAssistantBackBtn);

  container.replaceChildren(chartShell, divinationPageWrap, mobileAiFabBtn, mobileResultDock);

  // =========================================================================
  // 6. 布局、模式与共享组件挂载同步
  // =========================================================================
  function syncLayoutAndMode() {
    const isDivination = currentCtx?.mode === 'divination';
    const activeMethod = currentCtx?.activeMethod ?? 'bazi';
    const mobileMode = isMobileViewport();
    const phoneMode = mobileMode && window.innerWidth <= 679;
    const isAi = isWebAiEnabled();
    const isMinglu = !isDivination && currentCtx?.activeMethod === 'minglu';
    const isHecan = isPersonalHecanMode(activeMethod);
    const showAssistantOnlyMobile = mobileMode && mobileAssistantOpen && !isMinglu && !isHecan;
    foldableAssistantBackBar.hidden = true;

    syncContextExtractBar();

    // 单一「复制提示词」按钮与共享编辑组件按当前模式无缝挂载，无需切换子页
    externalShareBar.classList.toggle('is-inline', isAi);
    if (isAi) {
      deliveryCopyBtn.className =
        'workspace-ui-button is-secondary is-small workspace-assistant-copy-btn';
      if (!aiHeaderCopyHost.contains(deliveryCopyBtn)) {
        aiHeaderCopyHost.appendChild(deliveryCopyBtn);
      }
      if (!aiHeaderCopyHost.contains(externalShareBar)) {
        aiHeaderCopyHost.appendChild(externalShareBar);
      }
      if (!composerToolbarHostAi.contains(composerToolbar)) {
        composerToolbarHostAi.appendChild(composerToolbar);
      }
      if (!contextExtractHostAi.contains(contextExtractBar)) {
        contextExtractHostAi.appendChild(contextExtractBar);
      }
      if (!questionComposerHostAi.contains(questionComposerBox)) {
        questionComposerHostAi.appendChild(questionComposerBox);
      }
    } else {
      deliveryCopyBtn.className =
        'workspace-ui-button is-primary is-medium workspace-prompt-delivery-button is-hero-copy';
      if (!promptHeroCopyHost.contains(deliveryCopyBtn)) {
        promptHeroCopyHost.appendChild(deliveryCopyBtn);
      }
      if (!promptHeroCopyHost.contains(externalShareBar)) {
        promptHeroCopyHost.appendChild(externalShareBar);
      }
      if (!composerToolbarHostPrompt.contains(composerToolbar)) {
        composerToolbarHostPrompt.appendChild(composerToolbar);
      }
      if (!contextExtractHostPrompt.contains(contextExtractBar)) {
        contextExtractHostPrompt.appendChild(contextExtractBar);
      }
      if (!questionComposerHostPrompt.contains(questionComposerBox)) {
        questionComposerHostPrompt.appendChild(questionComposerBox);
      }
    }

    // 挂载 sharedAiPane
    if (sharedAiPane && !sharedAiMountPoint.contains(sharedAiPane)) {
      sharedAiMountPoint.appendChild(sharedAiPane);
      const details = sharedAiPane.querySelector<HTMLDetailsElement>('details.ai-panel');
      if (details) details.open = true;
    }

    if (!isDivination) {
      // 命盘模式（个人八大盘 / 合盘）
      chartShell.hidden = false;
      divinationPageWrap.hidden = true;

      if (!chartResultSection.contains(chartGridSingle)) {
        chartResultSection.appendChild(chartGridSingle);
      }
      if (!chartRightPane.contains(promptWorkbenchLayout)) {
        chartRightPane.appendChild(promptWorkbenchLayout);
      }
      if (!chartRightPane.contains(aiAnswerWorkbench)) {
        chartRightPane.appendChild(aiAnswerWorkbench);
      }

      promptDeliverySection.hidden = false;
      promptWorkbenchLayout.hidden = isAi;
      aiAnswerWorkbench.hidden = !isAi;

      chartShell.classList.toggle('is-mobile-ai-immersive', showAssistantOnlyMobile && isAi);
      chartNavBar.hidden = showAssistantOnlyMobile;
      chartStage.className = showAssistantOnlyMobile
        ? `result-tab-stage workspace-result-split workspace-result-assistant-stage ${isAi ? 'is-ai-stage' : 'is-prompt-stage'}`
        : 'result-tab-stage workspace-result-split';
      chartStage.classList.toggle('is-minglu-stage', Boolean(isMinglu));
      chartStage.classList.toggle('is-hecan-stage', Boolean(isHecan));

      chartLeftPane.className = showAssistantOnlyMobile
        ? 'result-tab-pane workspace-result-chart-pane is-inactive'
        : 'result-tab-pane workspace-result-chart-pane is-active';
      chartLeftPane.setAttribute('aria-hidden', String(showAssistantOnlyMobile));
      chartLeftPane.hidden = false;

      if (!chartRightPane.contains(foldableAssistantBackBar)) {
        chartRightPane.prepend(foldableAssistantBackBar);
      }
      const rightInactiveOnMobile = isHecan
        ? false
        : mobileMode
          ? !showAssistantOnlyMobile || Boolean(isMinglu)
          : false;
      chartRightPane.className = `result-tab-pane workspace-result-assistant-pane ${
        isAi ? 'is-ai-mode' : 'is-prompt-mode'
      } ${rightInactiveOnMobile ? 'is-inactive' : 'is-active'}`;
      chartRightPane.hidden = Boolean(isMinglu);
      chartRightPane.setAttribute('aria-hidden', String(Boolean(isMinglu) || rightInactiveOnMobile));
    } else {
      // 占卜结果模式（严格对齐 V1 `DivinationResult.tsx`）
      chartShell.hidden = true;
      divinationPageWrap.hidden = false;

      if (!divinationBoardBodySlot.contains(chartGridSingle)) {
        divinationBoardBodySlot.appendChild(chartGridSingle);
      }
      if (!divinationAssistantPane.contains(promptWorkbenchLayout)) {
        divinationAssistantPane.appendChild(promptWorkbenchLayout);
      }
      if (!divinationAiCard.contains(aiAnswerWorkbench)) {
        divinationAiCard.appendChild(aiAnswerWorkbench);
      }
      if (!divinationAssistantPane.contains(divinationAiCard)) {
        divinationAssistantPane.appendChild(divinationAiCard);
      }

      const isMajorTarot =
        activeMethod === 'tarot' &&
        (currentCtx?.initialPayload?.tarot as { deckScope?: string } | undefined)?.deckScope ===
          'major';
      divinationPanelTitle.textContent = isMajorTarot
        ? '大阿卡纳'
        : (methodLabels[activeMethod] ?? '占卜结果')
            .replace(/（(?:基础)?预览）/g, '')
            .replace('住宅风水', '阳宅风水');
      divinationPanelHead.hidden = phoneMode;
      divinationRestartBtn.hidden = phoneMode;
      if (!divinationAssistantPane.contains(foldableAssistantBackBar)) {
        divinationAssistantPane.prepend(foldableAssistantBackBar);
      }
      promptDeliverySection.hidden = false;
      promptWorkbenchLayout.hidden = isAi;
      divinationAiCard.hidden = !isAi;
      aiAnswerWorkbench.hidden = !isAi;

      divinationPageWrap.classList.toggle('is-mobile-ai-immersive', showAssistantOnlyMobile && isAi);
      divinationStage.className = showAssistantOnlyMobile
        ? `divination-result-stage workspace-result-assistant-stage ${isAi ? 'is-ai-stage' : 'is-prompt-stage'}`
        : 'divination-result-stage';
      divinationWorkspace.className = 'divination-result-workspace is-split';
      divinationBoardPane.className = showAssistantOnlyMobile
        ? 'divination-result-board-pane is-inactive'
        : 'divination-result-board-pane';
      divinationBoardPane.hidden = false;
      divinationBoardPane.setAttribute('aria-hidden', String(showAssistantOnlyMobile));

      const divRightInactive = mobileMode ? !showAssistantOnlyMobile : false;
      divinationAssistantPane.className = `divination-result-assistant-pane workspace-result-assistant-pane ${
        isAi ? 'is-ai-mode' : 'is-prompt-mode'
      }${divRightInactive ? ' is-inactive' : ''}`;
      divinationAssistantPane.setAttribute('aria-hidden', String(divRightInactive));
    }

    const showDock = mobileMode && !isMinglu && !isHecan;
    mobileResultDock.hidden = !showDock;
    if (showDock) {
      dockBoardBtn.classList.toggle('is-active', !showAssistantOnlyMobile);
      dockBoardBtn.setAttribute('aria-selected', String(!showAssistantOnlyMobile));
      dockPromptBtn.textContent = isAi ? 'AI 解读' : '提示词';
      dockPromptBtn.classList.toggle('is-active', showAssistantOnlyMobile);
      dockPromptBtn.setAttribute('aria-selected', String(showAssistantOnlyMobile));
    }

    mobileAiFabBtn.hidden = true;

    syncParentMainClass();
  }

  function setMobileAssistantOpen(open: boolean) {
    const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
    const isHecan = isPersonalHecanMode();
    const nextOpen = Boolean(open && isMobileViewport() && !isMinglu && !isHecan);
    mobileAssistantOpen = nextOpen;
    syncLayoutAndMode();
    if (nextOpen && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    onMobileAssistantToggle?.(nextOpen);
  }

  function setPersonSummaryBadgeContent(kind: 'user' | 'users', text: string) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.flexShrink = '0';

    const paths =
      kind === 'users'
        ? [
            'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
            'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8', // wait use circle/path cleanly below
          ]
        : [];
    if (kind === 'user') {
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2');
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', '12');
      c.setAttribute('cy', '7');
      c.setAttribute('r', '4');
      svg.append(p, c);
    } else {
      const p1 = document.createElementNS(svgNS, 'path');
      p1.setAttribute('d', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2');
      const c1 = document.createElementNS(svgNS, 'circle');
      c1.setAttribute('cx', '9');
      c1.setAttribute('cy', '7');
      c1.setAttribute('r', '4');
      const p2 = document.createElementNS(svgNS, 'path');
      p2.setAttribute('d', 'M22 21v-2a4 4 0 0 0-3-3.87');
      const p3 = document.createElementNS(svgNS, 'path');
      p3.setAttribute('d', 'M16 3.13a4 4 0 0 1 0 7.75');
      svg.append(p1, c1, p2, p3);
    }
    void paths;

    const label = document.createElement('span');
    label.textContent = text;
    personSummaryBadge.style.display = 'inline-flex';
    personSummaryBadge.style.alignItems = 'center';
    personSummaryBadge.style.gap = '5px';
    personSummaryBadge.replaceChildren(svg, label);
  }

  function scrollActiveResultTabIntoView() {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      const activeBtn = chartTabsHost.querySelector<HTMLElement>('.workspace-ui-tab.is-active');
      if (activeBtn && chartTabsHost.scrollWidth > chartTabsHost.clientWidth) {
        chartTabsHost.scrollLeft = Math.max(
          0,
          activeBtn.offsetLeft - chartTabsHost.clientWidth / 2 + activeBtn.clientWidth / 2,
        );
      }
    });
  }

  function renderTabsBar() {
    chartTabsHost.replaceChildren();
    if (!currentCtx) return;

    if (currentCtx.mode === 'personal') {
      chartBackBtn.textContent = '← 修改生辰';
      switchCaseBtn.hidden = !onOpenSwitchPerson;
      if (currentCtx.person) {
        personSummaryBadge.hidden = false;
        setPersonSummaryBadgeContent(
          'user',
          `${currentCtx.person.name || '临时排盘'} · ${formatCaseSummary(currentCtx.person)} ▾`,
        );
        switchCaseBtn.classList.add('is-redundant-with-badge');
      } else {
        personSummaryBadge.hidden = true;
        switchCaseBtn.classList.remove('is-redundant-with-badge');
      }
      const preloadTab = (tabId: Method) => {
        if (tabId === 'bazi-ziwei') {
          void import('./multi-hecan').catch(() => {});
        }
        preloadResultWorkspace(tabId);
      };
      for (const tab of PERSONAL_CHART_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = currentCtx.activeMethod === tab.id;
        btn.className = `workspace-ui-tab ${active ? 'is-active' : ''}`.trim();
        btn.textContent = tab.shortLabel;
        btn.addEventListener('pointerenter', () => preloadTab(tab.id));
        btn.addEventListener('pointerdown', () => preloadTab(tab.id));
        btn.addEventListener('click', () => {
          if (!currentCtx || currentCtx.activeMethod === tab.id) return;
          currentCtx.activeMethod = tab.id;
          onActiveMethodChange?.(tab.id);
          divinationCurrentQuestionStrong.textContent =
            questionDraft.trim() ||
            (isPersonalHecanMode(tab.id) ? getHecanDisplayLabel() : (methodLabels[tab.id] ?? '综合排盘分析'));
          renderTabsBar();
          syncLayoutAndMode();
          syncContextExtractBar();
          rebuildQuickFocusPills();
          void loadAndRenderActiveTab();
        });
        chartTabsHost.appendChild(btn);
      }
      scrollActiveResultTabIntoView();
      return;
    }

    if (currentCtx.mode === 'compatibility') {
      chartBackBtn.textContent = '← 修改合盘资料';
      switchCaseBtn.hidden = true;
      personSummaryBadge.hidden = false;
      setPersonSummaryBadgeContent(
        'users',
        `${currentCtx.person?.name || '命主一'} & ${currentCtx.partner?.name || '命主二'}`,
      );
      const preloadCompatTab = (tabId: Method) => {
        preloadResultWorkspace(tabId);
      };
      for (const tab of COMPATIBILITY_CHART_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = currentCtx.activeMethod === tab.id;
        btn.className = `workspace-ui-tab ${active ? 'is-active' : ''}`.trim();
        btn.textContent = tab.shortLabel;
        btn.addEventListener('pointerenter', () => preloadCompatTab(tab.id));
        btn.addEventListener('pointerdown', () => preloadCompatTab(tab.id));
        btn.addEventListener('click', () => {
          if (!currentCtx || currentCtx.activeMethod === tab.id) return;
          currentCtx.activeMethod = tab.id;
          onActiveMethodChange?.(tab.id);
          divinationCurrentQuestionStrong.textContent =
            questionDraft.trim() || (methodLabels[tab.id] ?? '合盘分析');
          renderTabsBar();
          syncLayoutAndMode();
          syncContextExtractBar();
          rebuildQuickFocusPills();
          void loadAndRenderActiveTab();
        });
        chartTabsHost.appendChild(btn);
      }
      scrollActiveResultTabIntoView();
      return;
    }
  }

  function applyExplicitClassicsOption(
    method: Method,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!supportsClassicalReferences(method)) return payload;
    const existingPrompt =
      payload.prompt && typeof payload.prompt === 'object' && !Array.isArray(payload.prompt)
        ? (payload.prompt as Record<string, unknown>)
        : {};
    return {
      ...payload,
      prompt: {
        ...existingPrompt,
        includeClassics,
      },
    };
  }

  function stripAppendixFromQuestion(raw: string): string {
    return parseQuestionContext(raw).cleanQuestion;
  }

  function hydrateSupplementaryFromQuestion(raw: string): Partial<SupplementaryInfoValues> {
    const parsed = parseQuestionContext(raw);
    const out: Partial<SupplementaryInfoValues> = {};
    if (parsed.gender === '男' || parsed.gender === '女') out.gender = parsed.gender;
    if (parsed.birthYear) out.birthYear = String(parsed.birthYear);
    if (
      parsed.subjectRole &&
      ['自己', '伴侣对象', '家人长辈', '子女晚辈', '职场合作方'].includes(parsed.subjectRole)
    ) {
      out.subjectRole = parsed.subjectRole as SupplementaryInfoValues['subjectRole'];
    }
    if (parsed.lifeStageContext) {
      out.lifeStageContext = parsed.lifeStageContext;
    }
    if (
      parsed.timeHorizon &&
      ['近期几天', '一三个月', '半年一年', '长期走向'].includes(parsed.timeHorizon)
    ) {
      out.timeHorizon = parsed.timeHorizon as SupplementaryInfoValues['timeHorizon'];
    }
    return out;
  }

  function buildComposedQuestion(method: Method): string {
    const fallbackQuestion = isPersonalHecanMode(method)
      ? '请综合已选术数，提炼跨体系共振主线、分歧要点与阶段建议。'
      : (methodLabels[method] ?? '综合排盘分析');
    const base =
      questionDraft.trim() ||
      stripAppendixFromQuestion(currentCtx?.question ?? '') ||
      fallbackQuestion;
    const suppValues =
      currentCtx?.mode === 'compatibility'
        ? {
            ...supplementary,
            compatRelationshipLabel: getSynastryRelationshipOption(compatRelationship).tagLabel,
          }
        : supplementary;
    const suppAppendix = formatSupplementaryAppendix(suppValues);
    return suppAppendix ? `${base}\n\n${suppAppendix}` : base;
  }

  function syncResultPromptDisplay(
    method: Method,
    payload: Record<string, unknown>,
    result: {
      currentTime?: string;
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
      promptOptions?: unknown;
    },
  ) {
    latestPayload = payload;
    const rawPrompt = (result.prompt?.text ?? '').replace(
      /\n*【问题】\n未指定具体问题\s*$/u,
      '',
    );
    latestRawPromptText = rawPrompt;
    const basePromptText = formatPromptForTier(rawPrompt, promptDensityTier);
    const promptText = applyLocalFrameworkToPrompt(basePromptText, method);
    const displayResult =
      result.prompt && promptText !== result.prompt.text
        ? { ...result, prompt: { text: promptText } }
        : result;
    latestResult = displayResult;
    deliveryPreviewPre.textContent = promptText;
    syncPromptTierButtons();
    syncPromptPreviewMeta(promptText);
    refreshLocalAgentFollowUps(method, result);
    deliveryCopyBtn.disabled = !promptText;
    dockCopyBtn.disabled = !promptText;

    const payloadQ =
      typeof payload.question === 'string' ? payload.question.trim() : '';
    const defaultBoilerplateQuestions = new Set([
      '未指定具体问题',
      '请综合解析当前盘面重点与应对建议。',
      '请解析当前时刻的即时盘象与重点提示。',
      '这件事接下来的走向如何，我当下该如何应对？',
      '请筛选近期适合办理此事的黄道吉日与吉时。',
      '这套住宅的坐向格局与居住人是否相合，布局上需要注意什么？',
      '这一年的五运六气气候节律与日常调养重点是什么？',
      '这一阶段的元会运世值年卦象与大势主线如何理解？',
      '请分析这组号码的八星磁场分布与数理吉凶。',
    ]);
    const ctxQ = currentCtx?.question?.trim() ?? '';
    const fallbackTitle = isPersonalHecanMode(method)
      ? getHecanDisplayLabel()
      : (methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '').replace('住宅风水', '阳宅风水');
    const resolvedQuestion =
      questionDraft.trim() ||
      (payloadQ && !defaultBoilerplateQuestions.has(payloadQ) ? payloadQ : '') ||
      (ctxQ && !defaultBoilerplateQuestions.has(ctxQ) ? ctxQ : '') ||
      (currentCtx?.person
        ? `${currentCtx.person.name || '当前命盘'} · ${formatCaseSummary(currentCtx.person)}`
        : `${fallbackTitle}综合解析`);
    divinationCurrentQuestionStrong.textContent = resolvedQuestion;
    return displayResult;
  }

  async function regeneratePromptForQuestion() {
    if (!currentCtx) return;
    const method = currentCtx.activeMethod;
    const baseQ = questionDraft.trim();
    const q = buildComposedQuestion(method);
    if (baseQ) {
      currentCtx.question = q;
    }
    divinationCurrentQuestionStrong.textContent =
      baseQ || (isPersonalHecanMode(method) ? getHecanDisplayLabel() : (methodLabels[method] ?? '综合排盘分析'));

    if (
      isPersonalHecanMode(method) &&
      currentCtx.person &&
      Object.keys(latestHecanComputedMap).length > 0
    ) {
      if (latestHecanIncludeClassics !== includeClassics) {
        await loadAndRenderActiveTab();
        return;
      }
      const { assembleMultiHecanResult } = await import('./multi-hecan');
      const assembled = assembleMultiHecanResult({
        person: currentCtx.person,
        selectedSystems: selectedHecanSystems,
        computedMap: latestHecanComputedMap,
        omitted: latestHecanOmitted,
        question: q,
        options: {
          flowYear: selectedFlowYear,
          includeClassics,
        },
      });
      const nextPayload = applyExplicitClassicsOption(method, {
        ...latestPayload,
        ...(q ? { question: q } : {}),
      });
      const displayResult = syncResultPromptDisplay(method, nextPayload, assembled);
      onActiveResultChange?.(method, nextPayload, { ...displayResult, followUps: latestFollowUps });
      return;
    }

    if (latestResult?.data && method !== 'minglu') {
      const token = ++computeToken;
      const hasClassics = supportsClassicalReferences(method);
      const resultCurrentTime = latestResult.currentTime ?? new Date().toISOString();
      try {
        const inferredTpl = inferTemplateFromContext(method, baseQ, supplementary);
        const existingPromptOpts =
          latestResult.promptOptions && typeof latestResult.promptOptions === 'object' && !Array.isArray(latestResult.promptOptions)
            ? (latestResult.promptOptions as Record<string, unknown>)
            : {};
        const promptObj: Record<string, unknown> = {
          ...existingPromptOpts,
          ...(hasClassics ? { includeClassics } : {}),
          ...(method === 'liuyao' ? { liuyaoTemplate: inferredTpl } : {}),
          ...(method === 'liuren'
            ? { liurenTemplate: inferredTpl === 'guaishen' ? 'general' : inferredTpl }
            : {}),
        };
        const repromptReq: Record<string, unknown> = {
          method,
          question: q || (methodLabels[method] ?? '请综合分析此排盘或卦象。'),
          result: {
            method,
            currentTime: resultCurrentTime,
            data: latestResult.data,
            ...(latestResult.promptOptions ? { promptOptions: latestResult.promptOptions } : {}),
          },
          ...(Object.keys(promptObj).length > 0 ? { prompt: promptObj } : {}),
        };
        const repromptRes = await runRepromptInBackground<{ prompt?: { text: string } }>(repromptReq);
        if (token !== computeToken) return;
        const rawPrompt = repromptRes.prompt?.text ?? '';
        latestRawPromptText = rawPrompt;
        const cleanPromptText = formatPromptForTier(rawPrompt, promptDensityTier);
        const enrichedPromptText = applyLocalFrameworkToPrompt(cleanPromptText, method);
        const updatedResult = {
          ...latestResult,
          currentTime: resultCurrentTime,
          prompt: enrichedPromptText ? { text: enrichedPromptText } : repromptRes.prompt,
        };
        const nextPayload = applyExplicitClassicsOption(method, {
          ...latestPayload,
          ...(q ? { question: q } : {}),
        });
        latestPayload = nextPayload;
        latestResult = updatedResult;
        deliveryPreviewPre.textContent = updatedResult.prompt?.text ?? '';
        syncPromptTierButtons();
        syncPromptPreviewMeta(updatedResult.prompt?.text ?? '');
        if (lastHasReport) {
          latestReportContext = { result: updatedResult, method, question: q };
          if (!lastHasBoard) {
            renderReportView(reportContainer, updatedResult, { method, question: q });
          }
          attachReportModalTrigger();
        }
        onActiveResultChange?.(method, nextPayload, { ...updatedResult, followUps: latestFollowUps });
        return;
      } catch {
        // 占卜盘禁止回退重算以免覆盖原本随机抽得的卦象/牌阵
        if (currentCtx.mode === 'divination') return;
      }
    }

    await loadAndRenderActiveTab();
  }

  async function renderResultToPanes(
    method: Method,
    payload: Record<string, unknown>,
    result: {
      currentTime?: string;
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
      promptOptions?: unknown;
    },
    token: number,
  ) {
    const displayResult = syncResultPromptDisplay(method, payload, result);

    // 渲染新盘前先隐藏上下容器并保留骨架屏，避免底部报告先于顶部排盘露面
    boardContainer.hidden = true;
    reportDetails.hidden = true;
    if (loadingBanner.hidden) {
      showLoadingSkeleton(`正在排盘「${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '')}」`);
    }

    const renderedBoard = await renderVisualBoard(boardContainer, method, result);
    if (token !== computeToken) return;
    lastHasBoard = renderedBoard;

    const realSections = extractReportSections(result);
    const hasDigestMethod = [
      'bazi',
      'bazi-ziwei',
      'bazi-synastry',
      'ziwei-synastry',
      'astrolabe-synastry',
      'qimen-lifetime',
      'liuyao',
      'meihua',
      'qimen',
      'liuren',
      'residential',
      'bazhai',
      'xuankong',
      'fortune',
      'tarot',
      'lenormand',
      'ssgw',
    ].includes(method);
    const hasMeaningfulReport =
      method !== 'minglu' &&
      (Boolean(realSections && realSections.length > 0) || hasDigestMethod || !renderedBoard);
    const composedQ = buildComposedQuestion(method);

    const probeReportHost = renderedBoard ? document.createElement('div') : reportContainer;
    if (hasMeaningfulReport && renderReportView(probeReportHost, result, { method, question: composedQ })) {
      lastHasReport = true;
      latestReportContext = { result, method, question: composedQ };
      if (renderedBoard) {
        clearReportView(reportContainer);
      } else {
        reportDetails.open = true;
      }
    } else {
      clearReportView(reportContainer);
      lastHasReport = false;
      latestReportContext = null;
    }
    attachReportModalTrigger();

    loadingBanner.hidden = true;
    loadingBanner.removeAttribute('aria-busy');
    applyChartViewMode(method);
    onActiveResultChange?.(method, payload, { ...displayResult, followUps: latestFollowUps });
  }

  function prepareForTransition(
    mode?: 'personal' | 'compatibility' | 'divination',
    method?: Method,
  ) {
    computeToken += 1;
    boardContainer.hidden = true;
    reportDetails.hidden = true;
    chartInteractiveBar.hidden = true;
    clearVisualBoard(boardContainer);
    clearReportView(reportContainer);
    lastHasBoard = false;
    lastHasReport = false;
    latestReportContext = null;

    if (mode === 'divination') {
      chartShell.hidden = true;
      divinationPageWrap.hidden = false;
      if (!divinationBoardBodySlot.contains(chartGridSingle)) {
        divinationBoardBodySlot.appendChild(chartGridSingle);
      }
      if (method) {
        divinationPanelTitle.textContent = (methodLabels[method] ?? '占卜结果')
          .replace(/（(?:基础)?预览）/g, '')
          .replace('住宅风水', '阳宅风水');
      }
    } else if (mode === 'personal' || mode === 'compatibility') {
      chartShell.hidden = false;
      divinationPageWrap.hidden = true;
      if (!chartResultSection.contains(chartGridSingle)) {
        chartResultSection.appendChild(chartGridSingle);
      }
    }

    const label = method
      ? `正在排盘「${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '')}」`
      : '正在排盘计算';
    showLoadingSkeleton(label);
  }

  async function loadAndRenderActiveTab() {
    if (!currentCtx) return;
    const token = ++computeToken;
    const method = currentCtx.activeMethod;
    const rulesSig = JSON.stringify(loadGlobalRules());

    if (isPersonalHecanMode(method) && currentCtx.person) {
      hecanComputing = true;
      clearReportView(reportContainer);
      reportDetails.hidden = true;
      loadingBanner.hidden = true;
      loadingBanner.removeAttribute('aria-busy');
      lastHasBoard = true;
      lastHasReport = false;
      latestReportContext = null;
      const prevHecanData =
        latestResult?.data &&
        typeof latestResult.data === 'object' &&
        (latestResult.data as { kind?: unknown }).kind === 'multi-hecan'
          ? (latestResult.data as MultiHecanData)
          : null;
      renderHecanConfigPanel(currentCtx.person, prevHecanData);
      applyChartViewMode(method);

      try {
        const activeQuestion = buildComposedQuestion(method);
        const { runMultiHecan } = await import('./multi-hecan');
        const { result: hecanRes, computedMap, omitted } = await runMultiHecan({
          person: currentCtx.person,
          selectedSystems: selectedHecanSystems,
          question: activeQuestion,
          options: {
            flowYear: selectedFlowYear,
            includeClassics,
            cache: hecanSystemCache,
            rulesSig,
            applyGlobalRules: true,
          },
        });
        if (token !== computeToken) return;
        hecanComputing = false;
        latestHecanComputedMap = computedMap;
        latestHecanOmitted = omitted;
        latestHecanIncludeClassics = includeClassics;

        const hecanPayload: Record<string, unknown> = {
          question: activeQuestion,
          selectedSystems: selectedHecanSystems,
          ...(selectedFlowYear ? { flowYear: selectedFlowYear } : {}),
          prompt: { includeClassics },
        };
        const displayResult = syncResultPromptDisplay(method, hecanPayload, hecanRes);
        renderHecanConfigPanel(currentCtx.person, hecanRes.data);
        lastHasBoard = true;
        lastHasReport = false;
        loadingBanner.hidden = true;
        loadingBanner.removeAttribute('aria-busy');
        applyChartViewMode(method);
        onActiveResultChange?.(method, hecanPayload, {
          ...displayResult,
          followUps: latestFollowUps,
        });
      } catch (err) {
        if (token !== computeToken) return;
        hecanComputing = false;
        showLoadingError(err instanceof Error ? err.message : '请检查出生资料是否完整');
      }
      return;
    }

    const sig = `${getCaseSignature(
      currentCtx.person,
      currentCtx.partner,
      currentCtx.question,
    )}::${method}::${rulesSig}::cls:${includeClassics ? 1 : 0}::flow:${selectedFlowYear ?? 'default'}::sync:${selectedSyncYearsPreset}::rel:${compatRelationship}`;

    boardContainer.hidden = true;
    reportDetails.hidden = true;
    chartInteractiveBar.hidden = true;
    clearVisualBoard(boardContainer);
    clearReportView(reportContainer);
    lastHasBoard = false;
    lastHasReport = false;
    latestReportContext = null;
    showLoadingSkeleton(`正在排盘计算「${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '')}」`);

    const cached = resultCache.get(sig);
    if (cached) {
      await renderResultToPanes(method, cached.payload, cached.result, token);
      return;
    }

    // 与后端/引擎计算并发预加载盘面渲染器、域 CSS 与经典卡片，减少等待链路
    preloadVisualBoardAssets(method);

    try {
      const activeQuestion = buildComposedQuestion(method);
      let rawPayload: Record<string, unknown>;
      if (currentCtx.mode === 'personal' && currentCtx.person && isPersonalChartMethod(method)) {
        rawPayload = buildPersonalChartPayload(currentCtx.person, method, activeQuestion, {
          flowYear: selectedFlowYear,
        });
      } else if (
        currentCtx.mode === 'compatibility' &&
        currentCtx.person &&
        currentCtx.partner &&
        isCompatibilityChartMethod(method)
      ) {
        rawPayload = buildCompatibilityChartPayload(
          currentCtx.person,
          currentCtx.partner,
          method,
          activeQuestion,
          {
            relationship: compatRelationship,
            flowYear: selectedFlowYear,
            syncYears: resolveSyncYearsRange(
              selectedSyncYearsPreset,
              selectedFlowYear ?? flowCurrentYear,
            ),
          },
        );
      } else {
        rawPayload = {
          ...(currentCtx.initialPayload ?? {}),
          ...(activeQuestion.trim() ? { question: activeQuestion.trim() } : {}),
        };
      }

      const supportsClassics = supportsClassicalReferences(method);
      const withGlobalRules = applyGlobalRulesToPayload(
        method,
        rawPayload,
        supportsClassics,
      ) as Record<string, unknown>;
      const payload = applyExplicitClassicsOption(method, withGlobalRules);

      const res = (await runCalculateInBackground(method, payload, {
        promptGuidance: loadGlobalRules().prompt,
      })) as {
        summary?: unknown;
        prompt?: { text: string };
        data?: unknown;
      };
      if (token !== computeToken) return;
      resultCache.set(sig, { payload, result: res });
      await renderResultToPanes(method, payload, res, token);
    } catch (err) {
      if (token !== computeToken) return;
      showLoadingError(err instanceof Error ? err.message : '请检查出生资料是否完整');
    }
  }

  async function openWithContext(ctx: ResultPageContext) {
    prepareForTransition(ctx.mode, ctx.activeMethod);
    currentCtx = { ...ctx };
    if (ctx.mode === 'personal' && ctx.activeMethod === 'bazi-ziwei') {
      selectedHecanSystems = readSavedHecanSystems();
    }
    selectedFlowYear = null;
    selectedSyncYearsPreset = 'none';
    mobileAssistantOpen = false;
    onMobileAssistantToggle?.(false);
    supplementary = { ...DEFAULT_SUPPLEMENTARY_VALUES };
    const initialPromptOpts = ctx.initialPayload?.prompt as
      | { includeClassics?: boolean; liuyaoTemplate?: string; liurenTemplate?: string }
      | undefined;
    includeClassics =
      typeof initialPromptOpts?.includeClassics === 'boolean'
        ? initialPromptOpts.includeClassics
        : loadGlobalRules().prompt.includeClassics;
    const activeTiMethod = currentCtx?.activeMethod ?? 'bazi';
    promptDensityTier = includeClassics && supportsUiClassicsTier(activeTiMethod) ? 'deep' : 'standard';
    syncPromptTierButtons();
    syncContextExtractBar();
    deliveryPreviewPre.textContent = '';
    syncPromptPreviewMeta('');
    const autoDefaultQuestions = new Set([
      '未指定具体问题',
      '请综合解析当前盘面重点与应对建议。',
      '请解析当前时刻的即时盘象与重点提示。',
      '这件事接下来的走向如何，我当下该如何应对？',
      '请筛选近期适合办理此事的黄道吉日与吉时。',
      '这套住宅的坐向格局与居住人是否相合，布局上需要注意什么？',
      '这一年的五运六气气候节律与日常调养重点是什么？',
      '这一阶段的元会运世值年卦象与大势主线如何理解？',
      '请分析这组号码的八星磁场分布与数理吉凶。',
    ]);
    const rawCtxQ =
      ctx.question?.trim() ||
      (typeof ctx.initialPayload?.question === 'string'
        ? ctx.initialPayload.question.trim()
        : '');
    const initialRelCandidate =
      ctx.compatibilityRelationship
      ?? (typeof ctx.initialPayload?.relationship === 'string'
        ? ctx.initialPayload.relationship
        : undefined)
      ?? parseQuestionContext(rawCtxQ).synastryRelationship;
    compatRelationship =
      initialRelCandidate && isSynastryRelationship(initialRelCandidate)
        ? initialRelCandidate
        : 'marriage';
    const hydrated = hydrateSupplementaryFromQuestion(rawCtxQ);
    if (Object.keys(hydrated).length > 0) {
      supplementary = { ...supplementary, ...hydrated };
    }
    syncContextExtractBar();
    const cleanRawCtxQ = stripAppendixFromQuestion(rawCtxQ);
    questionDraft = cleanRawCtxQ && !autoDefaultQuestions.has(cleanRawCtxQ) ? cleanRawCtxQ : '';
    lastAppliedQuestion = questionDraft;
    questionTextarea.value = questionDraft;
    rebuildQuickFocusPills();

    renderTabsBar();
    syncLayoutAndMode();

    const canUseInitialHecan =
      ctx.activeMethod !== 'bazi-ziwei' ||
      ctx.mode !== 'personal' ||
      Boolean(
        ctx.initialResult?.data &&
          typeof ctx.initialResult.data === 'object' &&
          (ctx.initialResult.data as { kind?: unknown }).kind === 'multi-hecan',
      );
    if (ctx.initialResult && ctx.initialPayload && canUseInitialHecan) {
      const rulesSig = JSON.stringify(loadGlobalRules());
      const sig = `${getCaseSignature(
        ctx.person,
        ctx.partner,
        ctx.question,
      )}::${ctx.activeMethod}::${rulesSig}::cls:${includeClassics ? 1 : 0}::flow:${selectedFlowYear ?? 'default'}::sync:${selectedSyncYearsPreset}::rel:${compatRelationship}`;
      resultCache.set(sig, { payload: ctx.initialPayload, result: ctx.initialResult });
      const token = ++computeToken;
      await renderResultToPanes(ctx.activeMethod, ctx.initialPayload, ctx.initialResult, token);
      return;
    }

    await loadAndRenderActiveTab();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('mingyu:global-rules-changed', () => {
      includeClassics = loadGlobalRules().prompt.includeClassics;
      promptDensityTier = includeClassics ? 'deep' : 'standard';
      syncPromptTierButtons();
      if (currentCtx && (currentCtx.mode === 'personal' || currentCtx.mode === 'compatibility')) {
        void loadAndRenderActiveTab();
      }
    });
    window.addEventListener('mingyu:web-ai-changed', () => {
      syncLayoutAndMode();
    });
    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 1023px)');
      const phoneMql = window.matchMedia('(max-width: 679px)');
      const handleViewportChange = () => {
        syncLayoutAndMode();
        const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
        const isHecan = isPersonalHecanMode();
        onMobileAssistantToggle?.(mobileAssistantOpen && isMobileViewport() && !isMinglu && !isHecan);
      };
      mql.addEventListener('change', handleViewportChange);
      phoneMql.addEventListener('change', handleViewportChange);
    }
  }

  async function refreshForActiveCase(person: PersonalCase) {
    if (!currentCtx || currentCtx.mode !== 'personal') return;
    currentCtx.person = { ...person };
    renderTabsBar();
    syncLayoutAndMode();
    await loadAndRenderActiveTab();
  }

  return {
    openWithContext,
    prepareForTransition,
    refreshForActiveCase,
    setMobileAssistantOpen,
    isMobileAssistantOpen: () => mobileAssistantOpen,
  };
}
