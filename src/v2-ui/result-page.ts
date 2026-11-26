import { calculate, reprompt, type Method } from '../core';
import { NON_CLASSICS_METHODS } from '../method-registry';
import { methodLabels } from '../schema';
import { isWebAiEnabled } from '../web-ai';
import { clearVisualBoard, renderVisualBoard } from '../web-boards';
import { clearReportView, extractReportSections, renderReportView } from '../web-report';
import { mountains, mountainTrigram } from '../systems/compass';
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
  PROMPT_FRAMEWORKS,
  resolveAutoFrameworkForPrompt,
  type FrameworkId,
} from '../router-model/frameworks';
import { mergeFrameworkIntoPrompt } from '../prompt-guidance';
import {
  analyzeUserQuery,
  formatFrameworkPromptBlock,
  generateChartFollowUps,
  inspectQuestionQuality,
} from '../router-model/local-agent';
import {
  formatCaseSummary,
  type PersonalCase,
} from './cases-store';
import { downloadChartShareImage } from './chart-share';
import {
  countSupplementaryTextFields,
  DEFAULT_SUPPLEMENTARY_VALUES,
  formatSupplementaryAppendix,
  openQuestionInspirationModal,
  openSupplementaryInfoModal,
  type SupplementaryInfoValues,
} from './inspiration-modals';
import { distillPromptForAgent, distillPromptForUser } from '../prompt-profile';

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
  refreshForActiveCase: (person: PersonalCase) => Promise<void>;
  setMobileAssistantOpen: (open: boolean) => void;
  isMobileAssistantOpen: () => boolean;
}

function createCopyIconSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>';
  return svg;
}

/**
 * 创建 100% 对齐 V1 `ResultPage/index.tsx` 与 `DivinationResult.tsx` 的双栏结果页工作台控制器。
 */
export function createResultPageController(options: ResultPageOptions): ResultPageController {
  const {
    container,
    sharedAiPane,
    onBackToForm,
    onOpenSwitchPerson,
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

  // 确保 container 在 .workspace-main.is-result > .workspace-page 内可占满高度，同时不破坏 [hidden]
  container.style.height = '100%';
  container.style.minHeight = '0';

  let mobileAssistantOpen = false;
  const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 819;
  const isPhoneAppViewport = () => typeof window !== 'undefined' && window.innerWidth <= 679;

  function syncParentMainClass() {
    const mainEl = container.closest('.workspace-main');
    if (!mainEl) return;
    const isVisible = !container.hidden;
    const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
    const isAssistantImmersive =
      isVisible && isMobileViewport() && mobileAssistantOpen && !isMinglu;
    mainEl.classList.toggle('is-result', isVisible);
    mainEl.classList.toggle('is-result-assistant', isAssistantImmersive);
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

  const chartModuleSwitcher = document.createElement('div');
  chartModuleSwitcher.className = 'v2-chart-module-switcher';
  chartModuleSwitcher.setAttribute('role', 'tablist');
  chartModuleSwitcher.setAttribute('aria-label', '八字排盘与个人命录切换');

  const baziTabBtn = document.createElement('button');
  baziTabBtn.type = 'button';
  baziTabBtn.role = 'tab';
  baziTabBtn.className = 'v2-chart-module-pill is-active';
  baziTabBtn.textContent = '四柱专业排盘';
  baziTabBtn.addEventListener('click', () => {
    if (!currentCtx || currentCtx.activeMethod === 'bazi') return;
    currentCtx.activeMethod = 'bazi';
    lastTechnicalTab = 'bazi';
    renderTabsBar();
    syncLayoutAndMode();
    void loadAndRenderActiveTab();
  });

  const mingluSubTabBtn = document.createElement('button');
  mingluSubTabBtn.type = 'button';
  mingluSubTabBtn.role = 'tab';
  mingluSubTabBtn.className = 'v2-chart-module-pill';
  mingluSubTabBtn.textContent = '个人命录';
  mingluSubTabBtn.addEventListener('click', () => {
    if (!currentCtx || currentCtx.activeMethod === 'minglu') return;
    currentCtx.activeMethod = 'minglu';
    renderTabsBar();
    syncLayoutAndMode();
    void loadAndRenderActiveTab();
  });

  chartModuleSwitcher.append(baziTabBtn, mingluSubTabBtn);

  const v2BoardStack = document.createElement('div');
  v2BoardStack.className = 'v2-board-stack-body';

  const loadingBanner = document.createElement('div');
  loadingBanner.className = 'workspace-ui-surface workspace-result-skeleton';
  loadingBanner.hidden = true;
  loadingBanner.setAttribute('role', 'status');
  loadingBanner.setAttribute('aria-label', '正在排盘');

  function showLoadingSkeleton(labelText = '正在排盘计算…') {
    loadingBanner.className = 'workspace-ui-surface workspace-result-skeleton';
    loadingBanner.innerHTML = `
      <div class="skeleton-head">
        <span class="skeleton-block is-title"></span>
        <span class="skeleton-label">${labelText}</span>
      </div>
      <div class="skeleton-grid">
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
        <span class="skeleton-card"></span>
      </div>
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

  let bazhaiSitMountain = '子';
  let selectedFlowYear: number | null = null;
  let selectedSyncYearsPreset: SyncYearsPreset = 'none';
  const flowCurrentYear = new Date().getFullYear();

  const chartInteractiveBar = document.createElement('div');
  chartInteractiveBar.className = 'workspace-ui-inline-controls v2-chart-interactive-bar';
  chartInteractiveBar.hidden = true;

  function renderFlowYearControls(labelText: string, defaultLabel: string) {
    const wrap = document.createElement('div');
    wrap.className = 'workspace-ui-inline-field';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;

    const select = document.createElement('select');
    select.className = 'workspace-ui-control is-compact';
    select.setAttribute('aria-label', '选择推运年份');

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = defaultLabel;
    if (selectedFlowYear === null) defaultOpt.selected = true;
    select.appendChild(defaultOpt);

    const minY = Math.min(flowCurrentYear - 10, selectedFlowYear ?? flowCurrentYear);
    const maxY = Math.max(flowCurrentYear + 15, selectedFlowYear ?? flowCurrentYear);
    for (let y = minY; y <= maxY; y += 1) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = `${y} 年`;
      if (selectedFlowYear === y) opt.selected = true;
      select.appendChild(opt);
    }

    const stepYear = (delta: number) => {
      const base = selectedFlowYear ?? flowCurrentYear;
      const next = Math.min(2100, Math.max(1900, base + delta));
      selectedFlowYear = next;
      void loadAndRenderActiveTab();
    };

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'workspace-ui-button is-secondary is-small';
    prevBtn.textContent = '← 上一年';
    prevBtn.addEventListener('click', () => stepYear(-1));

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'workspace-ui-button is-secondary is-small';
    nextBtn.textContent = '下一年 →';
    nextBtn.addEventListener('click', () => stepYear(1));

    select.addEventListener('change', () => {
      selectedFlowYear = select.value ? Number(select.value) : null;
      void loadAndRenderActiveTab();
    });

    wrap.append(labelSpan, prevBtn, select, nextBtn);
    chartInteractiveBar.appendChild(wrap);
  }

  function renderSyncYearsControls(method: Method) {
    const baseYear = selectedFlowYear ?? flowCurrentYear;
    const fmt = (preset: SyncYearsPreset, title: string) => {
      const r = resolveSyncYearsRange(preset, baseYear);
      return r ? `${title}（${r.startYear}–${r.endYear}）` : title;
    };
    const wrap = document.createElement('label');
    wrap.className = 'workspace-ui-inline-field';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = method === 'astrolabe-synastry' ? '多年行运同步' : '多年流年同步';

    const select = document.createElement('select');
    select.className = 'workspace-ui-control is-compact';
    select.setAttribute('aria-label', '选择多年流年同步范围');

    const presets: Array<{ value: SyncYearsPreset; label: string }> = [
      { value: 'none', label: '不开启' },
      { value: 'next3', label: fmt('next3', '未来 3 年') },
      { value: 'next5', label: fmt('next5', '未来 5 年') },
      { value: 'around5', label: fmt('around5', '前后 5 年') },
      { value: 'next10', label: fmt('next10', '未来 10 年') },
    ];
    for (const p of presets) {
      const opt = document.createElement('option');
      opt.value = p.value;
      opt.textContent = p.label;
      if (selectedSyncYearsPreset === p.value) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      selectedSyncYearsPreset = (select.value || 'none') as SyncYearsPreset;
      void loadAndRenderActiveTab();
    });

    wrap.append(labelSpan, select);
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

    if (method === 'bazhai') {
      const label = document.createElement('label');
      label.className = 'workspace-ui-inline-field';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = '宅屋坐山（二十四山）';
      const select = document.createElement('select');
      select.className = 'workspace-ui-control is-compact';
      select.setAttribute('aria-label', '选择宅屋坐山');
      for (const m of mountains) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m}山 · ${mountainTrigram(m)}宅`;
        if (m === bazhaiSitMountain) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        bazhaiSitMountain = select.value || '子';
        void loadAndRenderActiveTab();
      });
      label.append(titleSpan, select);
      chartInteractiveBar.appendChild(label);
      chartInteractiveBar.hidden = false;
      return;
    }

    const canSwitchFlow =
      method === 'ziwei' ||
      method === 'astrolabe' ||
      method === 'qizheng' ||
      ((method === 'bazi' || method === 'bazi-ziwei') &&
        person.timeIndex !== 'unknown' &&
        !person.reverseSource);

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

  function applyChartViewMode(method: Method) {
    const isPersonalMode = currentCtx?.mode === 'personal';
    const isBaziOrMinglu = isPersonalMode && (method === 'bazi' || method === 'minglu');
    const isMinglu = method === 'minglu';

    chartModuleSwitcher.hidden = !isBaziOrMinglu;
    baziTabBtn.classList.toggle('is-active', method === 'bazi');
    baziTabBtn.setAttribute('aria-selected', String(method === 'bazi'));
    mingluSubTabBtn.classList.toggle('is-active', isMinglu);
    mingluSubTabBtn.setAttribute('aria-selected', String(isMinglu));

    syncInteractiveControlsBar(method);
    boardContainer.hidden = !lastHasBoard;
    reportDetails.hidden = isMinglu || !lastHasReport;
  }

  v2BoardStack.append(loadingBanner, boardContainer, reportDetails);
  chartGridSingle.append(chartModuleSwitcher, chartInteractiveBar, v2BoardStack);

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
    const wrap = document.createElement('label');
    wrap.className = 'context-inline-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    const select = document.createElement('select');
    select.className = 'context-inline-select';
    select.setAttribute('aria-label', labelText);
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    }
    select.value = getValue();
    select.addEventListener('change', () => {
      const shouldRegenerate = onChangeVal(select.value as T);
      syncSupplementaryBtnLabel();
      if (shouldRegenerate !== false) {
        void regeneratePromptForQuestion();
      }
    });
    wrap.append(span, select);
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
          syncSupplementaryBtnLabel();
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
            syncSupplementaryBtnLabel();
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

  const supplementaryBtn = document.createElement('button');
  supplementaryBtn.type = 'button';
  supplementaryBtn.className =
    'workspace-ui-button is-secondary is-small workspace-supplementary-trigger';
  function syncSupplementaryBtnLabel() {
    const cnt = countSupplementaryTextFields(supplementary);
    supplementaryBtn.textContent = cnt > 0 ? `详细背景 · ${cnt}项` : '＋ 详细背景';
    supplementaryBtn.classList.toggle('is-active', cnt > 0);
  }
  syncSupplementaryBtnLabel();
  supplementaryBtn.addEventListener('click', () => {
    openSupplementaryInfoModal({
      values: { ...supplementary },
      description: '选填，留空不写入',
      onSave: (next) => {
        supplementary = {
          ...supplementary,
          ...next,
        };
        syncSupplementaryBtnLabel();
        void regeneratePromptForQuestion();
      },
    });
  });

  const classicsToggleLabel = document.createElement('label');
  classicsToggleLabel.className = 'workspace-ui-checkbox';
  const classicsCheckbox = document.createElement('input');
  classicsCheckbox.type = 'checkbox';
  classicsCheckbox.checked = includeClassics;
  const classicsText = document.createElement('span');
  classicsText.textContent = '附经典依据';
  classicsToggleLabel.append(classicsCheckbox, classicsText);

  function handleClassicsToggle(nextChecked: boolean) {
    includeClassics = nextChecked;
    classicsCheckbox.checked = nextChecked;
    void regeneratePromptForQuestion();
  }

  classicsCheckbox.addEventListener('change', () => {
    handleClassicsToggle(classicsCheckbox.checked);
  });

  composerToolbar.append(inspirationBtn, supplementaryBtn, classicsToggleLabel);

  // 提示词复制辅助函数（全页唯一复制按钮）
  async function copyActivePrompt(triggerBtn?: HTMLButtonElement, labelEl?: HTMLElement) {
    const text =
      latestResult?.prompt?.text ??
      deliveryPreviewPre.textContent ??
      promptWorkbenchPre.textContent ??
      '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (labelEl) {
        labelEl.textContent = '✓ 已复制';
        triggerBtn?.classList.add('is-copied');
        setTimeout(() => {
          labelEl.textContent = '复制提示词';
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

  let selectedFrameworkId: FrameworkId | 'auto' | 'none' = 'auto';
  let latestBasePromptText = '';

  function parseCaseYear(raw: string | number | undefined): number | undefined {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1900 && n <= 2100 ? Math.trunc(n) : undefined;
  }

  function resolveEffectiveFrameworkId(method: Method): FrameworkId | null {
    if (selectedFrameworkId === 'none') return null;
    if (selectedFrameworkId !== 'auto') return selectedFrameworkId;
    const activeQ = questionDraft || currentCtx?.question || '';
    const analysis = analyzeUserQuery(activeQ, {
      method,
      referenceYear: flowCurrentYear,
      birthYear: parseCaseYear(currentCtx?.person?.year),
      partnerBirthYear: parseCaseYear(currentCtx?.partner?.year),
    });
    return resolveAutoFrameworkForPrompt(method, activeQ, analysis.recommendedFramework.id);
  }

  function applyLocalFrameworkToPrompt(rawPromptText: string, method: Method): string {
    if (!rawPromptText.trim()) return rawPromptText;
    const fwId = resolveEffectiveFrameworkId(method);
    if (!fwId) return rawPromptText;
    if (rawPromptText.includes('【指定解读框架：')) return rawPromptText;
    const block = formatFrameworkPromptBlock(fwId);
    return block ? mergeFrameworkIntoPrompt(rawPromptText, block) : rawPromptText;
  }

  const localAgentBar = document.createElement('div');
  localAgentBar.className = 'workspace-local-agent-bar';

  const frameworkRow = document.createElement('label');
  frameworkRow.className = 'workspace-local-agent-framework-row';
  const frameworkLabel = document.createElement('span');
  frameworkLabel.textContent = '解读框架';
  const frameworkSelect = document.createElement('select');
  frameworkSelect.className = 'workspace-ui-control is-compact';
  frameworkSelect.setAttribute('aria-label', '选择本地推荐解读框架');
  const autoFwOpt = document.createElement('option');
  autoFwOpt.value = 'auto';
  autoFwOpt.textContent = '自动匹配最佳框架';
  const noneFwOpt = document.createElement('option');
  noneFwOpt.value = 'none';
  noneFwOpt.textContent = '不附加结构框架';
  frameworkSelect.append(autoFwOpt, noneFwOpt);
  for (const fw of Object.values(PROMPT_FRAMEWORKS)) {
    const opt = document.createElement('option');
    opt.value = fw.id;
    opt.textContent = fw.name;
    frameworkSelect.appendChild(opt);
  }
  frameworkRow.append(frameworkLabel, frameworkSelect);

  const qualityHintBox = document.createElement('div');
  qualityHintBox.className = 'workspace-local-agent-quality';
  qualityHintBox.hidden = true;

  const followUpsBox = document.createElement('div');
  followUpsBox.className = 'workspace-local-agent-followups';
  followUpsBox.hidden = true;

  localAgentBar.append(frameworkRow, qualityHintBox, followUpsBox);

  function refreshLocalAgentQualityAndFramework() {
    const method = currentCtx?.activeMethod ?? 'bazi';
    const activeQ = questionDraft || currentCtx?.question || '';
    const rawAutoId = analyzeUserQuery(activeQ, {
      method,
      referenceYear: flowCurrentYear,
      birthYear: parseCaseYear(currentCtx?.person?.year),
      partnerBirthYear: parseCaseYear(currentCtx?.partner?.year),
    }).recommendedFramework.id;
    const autoId = resolveAutoFrameworkForPrompt(method, activeQ, rawAutoId);
    const autoName = autoId ? (PROMPT_FRAMEWORKS[autoId]?.name ?? '综合框架') : '精准聚焦（免冗余框架）';
    autoFwOpt.textContent = `自动匹配（${autoName}）`;
    frameworkSelect.value = selectedFrameworkId;

    const quality = inspectQuestionQuality(questionDraft, {
      mode: currentCtx?.mode ?? 'personal',
      relationship: compatRelationship,
      hasLifeStage: Boolean(supplementary.lifeStageContext),
      hasTimeHorizon: Boolean(supplementary.timeHorizon),
    });
    qualityHintBox.replaceChildren();
    if (quality.quickFixes.length === 0) {
      qualityHintBox.hidden = true;
      return;
    }
    const hintEl = document.createElement('div');
    hintEl.className = 'workspace-local-agent-hint';
    hintEl.textContent = '追加内容';
    qualityHintBox.appendChild(hintEl);
    const pills = document.createElement('div');
    pills.className = 'workspace-prompt-focus-pills';
    for (const fix of quality.quickFixes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'workspace-prompt-focus-pill';
      btn.textContent = fix.label;
      btn.addEventListener('click', () => {
        const cur = questionDraft.trim();
        questionDraft = cur ? `${cur}；${fix.appendText}` : fix.appendText;
        questionTextarea.value = questionDraft;
        if (fix.patch?.lifeStageContext) {
          supplementary = { ...supplementary, lifeStageContext: fix.patch.lifeStageContext };
        }
        if (fix.patch?.timeHorizon) {
          supplementary = { ...supplementary, timeHorizon: fix.patch.timeHorizon };
        }
        syncSupplementaryBtnLabel();
        syncContextExtractBar();
        refreshLocalAgentQualityAndFramework();
        void applyCustomQuestionFromInput();
      });
      pills.appendChild(btn);
    }
    qualityHintBox.appendChild(pills);
    qualityHintBox.hidden = false;
  }

  function refreshLocalAgentFollowUps(
    method: Method,
    result: { data?: unknown; summary?: unknown } | null,
  ) {
    followUpsBox.replaceChildren();
    followUpsBox.hidden = true;
    const suggestions = generateChartFollowUps(method, result, {
      relationship: compatRelationship,
      currentYear: flowCurrentYear,
    });
    // 本地模式不展示「推荐追问」（仅保留上方「追加内容」补全提示词）；
    // 追问胶囊仅透传给在线 AI 解读面板，在首轮 AI 解读完成后展示。
    latestFollowUps = isWebAiEnabled()
      ? suggestions.map((item) => ({
          label: item.label,
          question: item.question,
          reason: item.reason,
        }))
      : [];
  }

  frameworkSelect.addEventListener('change', () => {
    selectedFrameworkId = (frameworkSelect.value || 'auto') as FrameworkId | 'auto' | 'none';
    const method = currentCtx?.activeMethod ?? 'bazi';
    if (latestBasePromptText) {
      const nextText = applyLocalFrameworkToPrompt(latestBasePromptText, method);
      promptWorkbenchPre.textContent = nextText;
      deliveryPreviewPre.textContent = nextText;
      syncPromptPreviewMeta(nextText);
      if (latestResult) {
        latestResult = { ...latestResult, prompt: { text: nextText } };
        onActiveResultChange?.(method, latestPayload, latestResult);
      }
    }
  });

  questionTextarea.addEventListener('input', () => {
    refreshLocalAgentQualityAndFramework();
  });

  async function applyCustomQuestionFromInput() {
    const trimmed = questionDraft.trim();
    lastAppliedQuestion = trimmed;
    divinationCurrentQuestionStrong.textContent =
      trimmed || (methodLabels[currentCtx?.activeMethod ?? 'bazi'] ?? '综合排盘分析');
    refreshLocalAgentQualityAndFramework();
    await regeneratePromptForQuestion();
  }

  const questionComposerBox = document.createElement('div');
  questionComposerBox.className = 'workspace-question-composer-box';
  questionComposerBox.append(divinationCurrentQuestion, questionFieldLabel, localAgentBar);

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
    { id: 'brief', label: '精简', hint: '压缩次要细节，约省 35% token' },
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
    if (tier === 'brief') return distillPromptForAgent(rawText);
    return distillPromptForUser(rawText, { includeClassics: tier === 'deep' });
  }

  function syncPromptTierButtons() {
    const hasClassics = supportsClassicalReferences(currentCtx?.activeMethod ?? 'bazi');
    for (const [id, btn] of promptTierBtns.entries()) {
      btn.classList.toggle('is-active', promptDensityTier === id);
      btn.setAttribute('aria-pressed', promptDensityTier === id ? 'true' : 'false');
      if (id === 'deep') {
        btn.textContent = hasClassics ? '含古籍' : '全量';
      }
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
      const hasClassics = supportsClassicalReferences(method);
      const wantClassics = item.id === 'deep' && hasClassics;
      promptDensityTier = item.id;
      syncPromptTierButtons();
      if (wantClassics && !includeClassics) {
        includeClassics = true;
        classicsCheckbox.checked = true;
        void regeneratePromptForQuestion();
        return;
      }
      if (!wantClassics && includeClassics && item.id !== 'deep') {
        includeClassics = false;
        classicsCheckbox.checked = false;
      }
      if (latestRawPromptText) {
        const base = formatPromptForTier(latestRawPromptText, promptDensityTier);
        latestBasePromptText = base;
        const nextText = applyLocalFrameworkToPrompt(base, method);
        promptWorkbenchPre.textContent = nextText;
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

  // 保留隐藏的旧引用节点以兼容内部状态更新
  const promptWorkbenchLayout = document.createElement('div');
  promptWorkbenchLayout.className = 'workspace-prompt-layout is-workbench';
  const promptWorkbenchPreview = document.createElement('div');
  promptWorkbenchPreview.className = 'workspace-prompt-workbench-preview';
  promptWorkbenchPreview.hidden = true;
  const promptWorkbenchPre = document.createElement('pre');
  const workbenchCopyBtn = document.createElement('button');
  workbenchCopyBtn.type = 'button';

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

  let lastTechnicalTab: PersonalChartTabId = 'bazi';

  const mingluDossierBtn = document.createElement('button');
  mingluDossierBtn.type = 'button';
  mingluDossierBtn.className = 'workspace-result-minglu-btn';
  mingluDossierBtn.hidden = true;
  mingluDossierBtn.addEventListener('click', () => {
    if (!currentCtx || currentCtx.mode !== 'personal') return;
    if (currentCtx.activeMethod === 'minglu') {
      currentCtx.activeMethod = lastTechnicalTab;
    } else {
      if (isPersonalChartMethod(currentCtx.activeMethod)) {
        lastTechnicalTab = currentCtx.activeMethod;
      }
      currentCtx.activeMethod = 'minglu';
    }
    renderTabsBar();
    syncLayoutAndMode();
    void loadAndRenderActiveTab();
  });

  const returnToChartBtn = document.createElement('button');
  returnToChartBtn.type = 'button';
  returnToChartBtn.className =
    'workspace-ui-button is-secondary is-small workspace-result-return-chart-btn';
  returnToChartBtn.textContent = '返回专业盘面';
  returnToChartBtn.hidden = true;
  returnToChartBtn.addEventListener('click', () => {
    if (!currentCtx || currentCtx.mode !== 'personal') return;
    currentCtx.activeMethod = lastTechnicalTab;
    renderTabsBar();
    syncLayoutAndMode();
    void loadAndRenderActiveTab();
  });

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

  async function handleExportShareImage(triggerBtn: HTMLButtonElement, redactPrivacy = false) {
    if (!currentCtx || !latestResult) return;
    const prevText = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.textContent = '生成中…';
    try {
      const method = currentCtx.activeMethod;
      const summaryObj =
        latestResult.summary && typeof latestResult.summary === 'object'
          ? (latestResult.summary as { title?: string; lines?: unknown[] })
          : undefined;
      const lines = Array.isArray(summaryObj?.lines)
        ? summaryObj.lines.filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
        : [];
      const cleanMethodLabel = (methodLabels[method] ?? method)
        .replace(/（(?:基础)?预览）/g, '')
        .replace('住宅风水', '阳宅风水');
      const title =
        currentCtx.person?.name?.trim() ||
        summaryObj?.title?.trim() ||
        cleanMethodLabel;
      const personRecord = currentCtx.person;
      const partnerRecord = currentCtx.partner;
      const subtitle =
        personRecord && partnerRecord
          ? `${personRecord.name || '命主一'} & ${partnerRecord.name || '命主二'}`
          : personRecord
            ? formatCaseSummary(personRecord)
            : undefined;
      await downloadChartShareImage({
        title,
        subtitle,
        methodLabel: cleanMethodLabel,
        question:
          questionDraft.trim() ||
          (typeof latestPayload.question === 'string' ? latestPayload.question.trim() : undefined),
        tags: [
          selectedFlowYear ? `${selectedFlowYear} 流年` : '',
          method === 'bazhai' ? `${bazhaiSitMountain}山${mountainTrigram(bazhaiSitMountain)}宅` : '',
        ].filter(Boolean),
        lines: lines.length ? lines : ['排盘结果已在右侧面板生成，欢迎结合提示词深入解读。'],
        excerptText: latestResult.prompt?.text,
        redactPrivacy,
      });
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.textContent = prevText || (redactPrivacy ? '脱敏长图' : '导出长图');
    }
  }

  const chartShareBtn = document.createElement('button');
  chartShareBtn.type = 'button';
  chartShareBtn.className = 'workspace-ui-button is-secondary is-small workspace-result-share-btn';
  chartShareBtn.textContent = '导出长图';
  chartShareBtn.addEventListener('click', () => {
    void handleExportShareImage(chartShareBtn, false);
  });

  const chartRedactedShareBtn = document.createElement('button');
  chartRedactedShareBtn.type = 'button';
  chartRedactedShareBtn.className = 'workspace-ui-button is-ghost is-small workspace-result-share-redacted-btn';
  chartRedactedShareBtn.textContent = '脱敏长图';
  chartRedactedShareBtn.title = '隐藏真实生辰、姓名和出生地点后导出长图，方便安全分享';
  chartRedactedShareBtn.addEventListener('click', () => {
    void handleExportShareImage(chartRedactedShareBtn, true);
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
    mingluDossierBtn,
    returnToChartBtn,
    personSummaryBadge,
    switchCaseBtn,
    chartShareBtn,
    chartRedactedShareBtn,
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
  const divinationShareBtn = document.createElement('button');
  divinationShareBtn.type = 'button';
  divinationShareBtn.className = 'workspace-ui-button is-ghost is-small';
  divinationShareBtn.textContent = '导出长图';
  divinationShareBtn.addEventListener('click', () => {
    void handleExportShareImage(divinationShareBtn);
  });
  const divinationRestartBtn = document.createElement('button');
  divinationRestartBtn.type = 'button';
  divinationRestartBtn.className = 'workspace-ui-button is-secondary is-small';
  divinationRestartBtn.textContent = '重新起卦';
  divinationRestartBtn.addEventListener('click', () => {
    onBackToForm(currentCtx?.activeMethod ?? 'liuyao');
  });
  divinationHeadActions.append(divinationShareBtn, divinationRestartBtn);
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

  container.replaceChildren(chartShell, divinationPageWrap, mobileAiFabBtn);

  // =========================================================================
  // 6. 布局、模式与共享组件挂载同步
  // =========================================================================
  function syncLayoutAndMode() {
    const isDivination = currentCtx?.mode === 'divination';
    const activeMethod = currentCtx?.activeMethod ?? 'bazi';
    const hasClassicsOption = supportsClassicalReferences(activeMethod);
    const mobileMode = isMobileViewport();
    const phoneMode = isPhoneAppViewport();
    const isAi = isWebAiEnabled();
    const isMinglu = !isDivination && currentCtx?.activeMethod === 'minglu';
    const showAssistantOnlyMobile = mobileMode && mobileAssistantOpen && !isMinglu;
    foldableAssistantBackBar.hidden = !(showAssistantOnlyMobile && !phoneMode);

    classicsToggleLabel.hidden = !hasClassicsOption;
    composerToolbar.classList.toggle('is-single', !hasClassicsOption);
    syncContextExtractBar();

    // 单一「复制提示词」按钮与共享编辑组件按当前模式无缝挂载，无需切换子页
    if (isAi) {
      deliveryCopyBtn.className =
        'workspace-ui-button is-secondary is-small workspace-assistant-copy-btn';
      if (!aiHeaderCopyHost.contains(deliveryCopyBtn)) {
        aiHeaderCopyHost.appendChild(deliveryCopyBtn);
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
      promptWorkbenchPreview.hidden = true;
      promptWorkbenchLayout.hidden = isAi;
      aiAnswerWorkbench.hidden = !isAi;

      chartShell.classList.toggle('is-mobile-ai-immersive', showAssistantOnlyMobile && isAi);
      chartNavBar.hidden = showAssistantOnlyMobile;
      chartStage.className = showAssistantOnlyMobile
        ? 'result-tab-stage workspace-result-split workspace-result-assistant-stage'
        : 'result-tab-stage workspace-result-split';
      chartStage.classList.toggle('is-minglu-stage', Boolean(isMinglu));

      chartLeftPane.className = showAssistantOnlyMobile
        ? 'result-tab-pane workspace-result-chart-pane is-inactive'
        : 'result-tab-pane workspace-result-chart-pane is-active';
      chartLeftPane.setAttribute('aria-hidden', String(showAssistantOnlyMobile));
      chartLeftPane.hidden = false;

      if (!chartRightPane.contains(foldableAssistantBackBar)) {
        chartRightPane.prepend(foldableAssistantBackBar);
      }
      const rightInactiveOnMobile = mobileMode ? !showAssistantOnlyMobile || Boolean(isMinglu) : false;
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
      promptWorkbenchPreview.hidden = true;
      promptWorkbenchLayout.hidden = isAi;
      divinationAiCard.hidden = !isAi;
      aiAnswerWorkbench.hidden = !isAi;

      divinationPageWrap.classList.toggle('is-mobile-ai-immersive', showAssistantOnlyMobile && isAi);
      divinationStage.className = showAssistantOnlyMobile
        ? 'divination-result-stage workspace-result-assistant-stage'
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

    mobileAiFabSpan.textContent = isAi ? 'AI' : '提示词';
    mobileAiFabSpan.className = isAi ? '' : 'is-prompt';
    mobileAiFabBtn.setAttribute('aria-label', isAi ? '打开 AI 解读' : '打开专属 AI 提示词');
    mobileAiFabBtn.title = isAi ? 'AI 解读' : 'AI 提示词';
    mobileAiFabBtn.hidden = !mobileMode || showAssistantOnlyMobile || Boolean(isMinglu);

    syncParentMainClass();
  }

  function setMobileAssistantOpen(open: boolean) {
    const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
    const nextOpen = Boolean(open && isMobileViewport() && !isMinglu);
    mobileAssistantOpen = nextOpen;
    syncLayoutAndMode();
    if (nextOpen && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    onMobileAssistantToggle?.(nextOpen);
  }

  function renderTabsBar() {
    chartTabsHost.replaceChildren();
    if (!currentCtx) return;

    if (currentCtx.mode === 'personal') {
      if (
        currentCtx.activeMethod !== 'minglu' &&
        isPersonalChartMethod(currentCtx.activeMethod)
      ) {
        lastTechnicalTab = currentCtx.activeMethod;
      }
      mingluDossierBtn.hidden = true;
      returnToChartBtn.hidden = true;

      chartBackBtn.textContent = '← 修改生辰';
      switchCaseBtn.hidden = !onOpenSwitchPerson;
      if (currentCtx.person) {
        personSummaryBadge.hidden = false;
        personSummaryBadge.textContent = `👤 ${currentCtx.person.name || '临时排盘'} · ${formatCaseSummary(currentCtx.person)} ▾`;
        switchCaseBtn.classList.add('is-redundant-with-badge');
      } else {
        personSummaryBadge.hidden = true;
        switchCaseBtn.classList.remove('is-redundant-with-badge');
      }
      for (const tab of PERSONAL_CHART_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active =
          currentCtx.activeMethod === tab.id ||
          (currentCtx.activeMethod === 'minglu' && tab.id === 'bazi');
        btn.className = `workspace-ui-tab ${active ? 'is-active' : ''}`.trim();
        btn.textContent = tab.shortLabel;
        btn.addEventListener('click', () => {
          if (!currentCtx || currentCtx.activeMethod === tab.id) return;
          lastTechnicalTab = tab.id;
          currentCtx.activeMethod = tab.id;
          renderTabsBar();
          syncLayoutAndMode();
          syncContextExtractBar();
          rebuildQuickFocusPills();
          void loadAndRenderActiveTab();
        });
        chartTabsHost.appendChild(btn);
      }
      return;
    }

    if (currentCtx.mode === 'compatibility') {
      mingluDossierBtn.hidden = true;
      returnToChartBtn.hidden = true;
      chartBackBtn.textContent = '← 修改合盘资料';
      switchCaseBtn.hidden = true;
      personSummaryBadge.hidden = false;
      personSummaryBadge.textContent = `👥 ${currentCtx.person?.name || '命主一'} & ${currentCtx.partner?.name || '命主二'}`;
      for (const tab of COMPATIBILITY_CHART_TABS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = currentCtx.activeMethod === tab.id;
        btn.className = `workspace-ui-tab ${active ? 'is-active' : ''}`.trim();
        btn.textContent = tab.shortLabel;
        btn.addEventListener('click', () => {
          if (!currentCtx || currentCtx.activeMethod === tab.id) return;
          currentCtx.activeMethod = tab.id;
          renderTabsBar();
          syncLayoutAndMode();
          syncContextExtractBar();
          rebuildQuickFocusPills();
          void loadAndRenderActiveTab();
        });
        chartTabsHost.appendChild(btn);
      }
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
    const base =
      questionDraft.trim() ||
      stripAppendixFromQuestion(currentCtx?.question ?? '') ||
      (methodLabels[method] ?? '综合排盘分析');
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

  async function regeneratePromptForQuestion() {
    if (!currentCtx) return;
    const method = currentCtx.activeMethod;
    const baseQ = questionDraft.trim();
    const q = buildComposedQuestion(method);
    if (baseQ) {
      currentCtx.question = q;
    }
    divinationCurrentQuestionStrong.textContent =
      baseQ || (methodLabels[method] ?? '综合排盘分析');

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
        const repromptRes = await reprompt(repromptReq);
        if (token !== computeToken) return;
        const rawPrompt = repromptRes.prompt?.text ?? '';
        latestRawPromptText = rawPrompt;
        const cleanPromptText = formatPromptForTier(rawPrompt, promptDensityTier);
        latestBasePromptText = cleanPromptText;
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
        promptWorkbenchPre.textContent = updatedResult.prompt?.text ?? '';
        deliveryPreviewPre.textContent = updatedResult.prompt?.text ?? '';
        syncPromptTierButtons();
        syncPromptPreviewMeta(updatedResult.prompt?.text ?? '');
        refreshLocalAgentQualityAndFramework();
        if (lastHasReport) {
          renderReportView(reportContainer, updatedResult, { method, question: q });
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
    latestPayload = payload;

    const rawPrompt = (result.prompt?.text ?? '').replace(
      /\n*【问题】\n未指定具体问题\s*$/u,
      '',
    );
    latestRawPromptText = rawPrompt;
    const basePromptText = formatPromptForTier(rawPrompt, promptDensityTier);
    latestBasePromptText = basePromptText;
    const promptText = applyLocalFrameworkToPrompt(basePromptText, method);
    const displayResult =
      result.prompt && promptText !== result.prompt.text
        ? { ...result, prompt: { text: promptText } }
        : result;
    latestResult = displayResult;
    promptWorkbenchPre.textContent = promptText;
    deliveryPreviewPre.textContent = promptText;
    syncPromptTierButtons();
    syncPromptPreviewMeta(promptText);
    refreshLocalAgentQualityAndFramework();
    refreshLocalAgentFollowUps(method, result);
    workbenchCopyBtn.disabled = !promptText;
    deliveryCopyBtn.disabled = !promptText;

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
    const resolvedQuestion =
      questionDraft.trim() ||
      (payloadQ && !defaultBoilerplateQuestions.has(payloadQ) ? payloadQ : '') ||
      (ctxQ && !defaultBoilerplateQuestions.has(ctxQ) ? ctxQ : '') ||
      (currentCtx?.person
        ? `${currentCtx.person.name || '当前命盘'} · ${formatCaseSummary(currentCtx.person)}`
        : `${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '').replace('住宅风水', '阳宅风水')}综合解析`);
    divinationCurrentQuestionStrong.textContent = resolvedQuestion;

    // 渲染新盘前先隐藏上下容器并保留骨架屏，避免底部报告先于顶部排盘露面
    boardContainer.hidden = true;
    reportDetails.hidden = true;
    if (loadingBanner.hidden) {
      showLoadingSkeleton(`正在排盘「${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '')}」…`);
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

    if (hasMeaningfulReport && renderReportView(reportContainer, result, { method, question: composedQ })) {
      lastHasReport = true;
      const isCompactMobile = typeof window !== 'undefined' && window.innerWidth <= 819;
      reportDetails.open = !renderedBoard || !isCompactMobile;
    } else {
      clearReportView(reportContainer);
      lastHasReport = false;
    }

    loadingBanner.hidden = true;
    applyChartViewMode(method);
    onActiveResultChange?.(method, payload, { ...displayResult, followUps: latestFollowUps });
  }

  async function loadAndRenderActiveTab() {
    if (!currentCtx) return;
    const token = ++computeToken;
    const method = currentCtx.activeMethod;
    chartModuleSwitcher.hidden =
      currentCtx.mode !== 'personal' || (method !== 'bazi' && method !== 'minglu');
    const rulesSig = JSON.stringify(loadGlobalRules());
    const sig = `${getCaseSignature(
      currentCtx.person,
      currentCtx.partner,
      currentCtx.question,
    )}::${method}::${rulesSig}::cls:${includeClassics ? 1 : 0}::mount:${bazhaiSitMountain}::flow:${selectedFlowYear ?? 'default'}::sync:${selectedSyncYearsPreset}::rel:${compatRelationship}`;

    const cached = resultCache.get(sig);
    if (cached) {
      await renderResultToPanes(method, cached.payload, cached.result, token);
      return;
    }

    boardContainer.hidden = true;
    reportDetails.hidden = true;
    showLoadingSkeleton(`正在排盘计算「${(methodLabels[method] ?? method).replace(/（(?:基础)?预览）/g, '')}」…`);
    clearVisualBoard(boardContainer);
    clearReportView(reportContainer);
    lastHasBoard = false;
    lastHasReport = false;

    try {
      const activeQuestion = buildComposedQuestion(method);
      let rawPayload: Record<string, unknown>;
      if (currentCtx.mode === 'personal' && currentCtx.person && isPersonalChartMethod(method)) {
        rawPayload = buildPersonalChartPayload(currentCtx.person, method, activeQuestion, {
          bazhaiSitMountain,
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

      const res = (await calculate(method, payload)) as {
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
    currentCtx = { ...ctx };
    selectedFlowYear = null;
    selectedSyncYearsPreset = 'none';
    selectedFrameworkId = 'auto';
    latestBasePromptText = '';
    followUpsBox.hidden = true;
    mobileAssistantOpen = false;
    onMobileAssistantToggle?.(false);
    supplementary = { ...DEFAULT_SUPPLEMENTARY_VALUES };
    syncSupplementaryBtnLabel();
    const initialPromptOpts = ctx.initialPayload?.prompt as
      | { includeClassics?: boolean; liuyaoTemplate?: string; liurenTemplate?: string }
      | undefined;
    includeClassics =
      typeof initialPromptOpts?.includeClassics === 'boolean'
        ? initialPromptOpts.includeClassics
        : loadGlobalRules().prompt.includeClassics;
    classicsCheckbox.checked = includeClassics;
    syncContextExtractBar();
    promptWorkbenchPre.textContent = '';
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
      syncSupplementaryBtnLabel();
    }
    syncContextExtractBar();
    const cleanRawCtxQ = stripAppendixFromQuestion(rawCtxQ);
    questionDraft = cleanRawCtxQ && !autoDefaultQuestions.has(cleanRawCtxQ) ? cleanRawCtxQ : '';
    lastAppliedQuestion = questionDraft;
    questionTextarea.value = questionDraft;
    rebuildQuickFocusPills();
    refreshLocalAgentQualityAndFramework();

    renderTabsBar();
    syncLayoutAndMode();

    if (ctx.initialResult && ctx.initialPayload) {
      const rulesSig = JSON.stringify(loadGlobalRules());
      const sig = `${getCaseSignature(
        ctx.person,
        ctx.partner,
        ctx.question,
      )}::${ctx.activeMethod}::${rulesSig}::cls:${includeClassics ? 1 : 0}::mount:${bazhaiSitMountain}::flow:${selectedFlowYear ?? 'default'}::sync:${selectedSyncYearsPreset}::rel:${compatRelationship}`;
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
      if (currentCtx && (currentCtx.mode === 'personal' || currentCtx.mode === 'compatibility')) {
        void loadAndRenderActiveTab();
      }
    });
    window.addEventListener('mingyu:web-ai-changed', () => {
      syncLayoutAndMode();
    });
    if (typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 819px)');
      const phoneMql = window.matchMedia('(max-width: 679px)');
      const handleViewportChange = () => {
        syncLayoutAndMode();
        const isMinglu = currentCtx?.mode !== 'divination' && currentCtx?.activeMethod === 'minglu';
        onMobileAssistantToggle?.(mobileAssistantOpen && isMobileViewport() && !isMinglu);
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
    refreshForActiveCase,
    setMobileAssistantOpen,
    isMobileAssistantOpen: () => mobileAssistantOpen,
  };
}
