import { SolarDay, SolarTerm, SolarTime } from 'tyme4ts';
import { calculate, type Method } from '../core';
import { getAlmanacSolarDayGods } from '../systems/almanac/gods';
import { getSolarYmdHmsPillars } from '../systems/calendar';
import { stepSixtyCycle } from '../systems/ganzhi-foundation';
import {
  getDayBranchRelations,
  getDayDuty,
  getDayTaboos,
  getDayTwelveStar,
  getDayTwentyEightStar,
  getHourTwelveStar,
  getSolarDayNineStar,
} from '../systems/almanac/rules';
import { openPlacePickerModal } from './divination-forms';

function cEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

export type CultureToolTabId =
  | 'character-query'
  | 'chinese-name'
  | 'chinese-naming'
  | 'number-energy';

export type CalendarToolTabId =
  | 'solar-term'
  | 'moon-phase'
  | 'true-solar'
  | 'time-scales'
  | 'solar-illumination';

export const CULTURE_TOOL_METHODS: readonly CultureToolTabId[] = [
  'character-query',
  'chinese-name',
  'chinese-naming',
  'number-energy',
];

export function isCultureOrCalendarMethod(
  method: string,
): method is CultureToolTabId {
  return (CULTURE_TOOL_METHODS as readonly string[]).includes(method);
}

export interface CultureOrCalendarPageOptions {
  container: HTMLElement;
  initialMethod?: CultureToolTabId | 'calendar';
  hideHeader?: boolean;
  onChange?: (method: Method, payload: Record<string, unknown>) => void;
  onResult?: (method: Method, payload: Record<string, unknown>, result: unknown) => void;
}

const CALENDAR_TABS: ReadonlyArray<{
  id: CalendarToolTabId;
  mark: string;
  label: string;
  desc: string;
}> = [
  { id: 'solar-term', mark: '节', label: '节气交节', desc: '二十四节气精确交节时刻' },
  { id: 'moon-phase', mark: '月', label: '月相朔望', desc: '月龄、照明率与朔望弦月' },
  { id: 'true-solar', mark: '真', label: '真太阳时换算', desc: '经度与均时差太阳时修正' },
  { id: 'time-scales', mark: '时', label: '天文时间尺度', desc: '儒略日 JD 与 ΔT 地球力学时换算' },
  { id: 'solar-illumination', mark: '日', label: '太阳光照', desc: '日出日落、正午与曙暮光' },
];

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;
const HUANGDAO_STARS = new Set(['青龙', '明堂', '天德', '玉堂', '司命', '金匮']);
const JIE_TERM_NAMES = new Set([
  '立春',
  '惊蛰',
  '清明',
  '立夏',
  '芒种',
  '小暑',
  '立秋',
  '白露',
  '寒露',
  '立冬',
  '大雪',
  '小寒',
]);
const HOUR_RANGES = [
  '00:00-01:00',
  '01:00-03:00',
  '03:00-05:00',
  '05:00-07:00',
  '07:00-09:00',
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
  '21:00-23:00',
  '23:00-24:00',
] as const;

function getBeijingNowParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year || 2026);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = map.hour === '24' ? '00' : map.hour;
  const timeStr = `${hour}:${map.minute}`;
  return { year, dateStr, timeStr };
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map((n) => Number.parseInt(n, 10));
  return {
    year: y || 2026,
    month: m || 1,
    day: d || 1,
  };
}

function parseTimeParts(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map((n) => Number.parseInt(n, 10));
  return {
    hour: Number.isFinite(h) ? h! : 12,
    minute: Number.isFinite(m) ? m! : 0,
  };
}

function createSegmentedBar<T extends string>(
  currentValue: T,
  options: ReadonlyArray<{ id: T; label: string }>,
  onSelect: (next: T) => void,
): HTMLElement {
  const seg = document.createElement('div');
  seg.className = 'workspace-ui-segmented';
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.id === currentValue),
  );
  const indicator = document.createElement('div');
  indicator.className = 'workspace-ui-segmented-indicator';
  indicator.style.width = `${100 / Math.max(1, options.length)}%`;
  indicator.style.left = `${(100 / Math.max(1, options.length)) * activeIdx}%`;
  seg.appendChild(indicator);

  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `workspace-ui-segmented-item workspace-ui-segmented-option${
      currentValue === opt.id ? ' is-active' : ''
    }`;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      if (currentValue === opt.id) return;
      indicator.style.left = `${(100 / Math.max(1, options.length)) * idx}%`;
      onSelect(opt.id);
    });
    seg.appendChild(btn);
  });
  return seg;
}

function createSectionHeading(_step: string, title: string, _hint?: string): HTMLElement {
  const header = document.createElement('header');
  header.className = 'culture-tools-section-heading';
  const copy = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.textContent = title;
  copy.appendChild(h2);
  header.appendChild(copy);
  return header;
}

/**
 * 渲染复刻 V1 的「文字与数理页（CultureToolsPage）」：
 * 严格使用 `.workspace-focused-page.workspace-culture-page` > `.workspace-ui-page` >
 * `.culture-tools-tabbar`（`.workspace-ui-tabs` > `button.workspace-ui-tab.is-active`）+ `section.workspace-ui-form-surface`。
 */
export function renderCultureToolsPage(options: CultureOrCalendarPageOptions): void {
  const {
    container,
    initialMethod = 'character-query',
    hideHeader = false,
    onChange,
    onResult,
  } = options;

  let activeTab: CultureToolTabId = (CULTURE_TOOL_METHODS as readonly string[]).includes(
    initialMethod,
  )
    ? (initialMethod as CultureToolTabId)
    : 'character-query';

  // 1. 汉字字典状态
  let hanziMode: 'text' | 'search' = 'text';
  let hanziText = '';
  let hanziSearchStrokes = '';
  let hanziSearchWuxing: '' | '金' | '木' | '水' | '火' | '土' = '';
  let hanziSearchPinyin = '';

  // 2. 姓名五格分析状态
  let fullName = '';
  let surnameLength: 1 | 2 = 1;
  let nameQuestion = '';

  // 3. 起名方案生成状态
  let namingSurname = '';
  let namingGender: 'general' | 'male' | 'female' = 'general';
  let namingLength: 1 | 2 = 2;
  let namingPreferredChars = '';
  let namingForbiddenChars = '';
  let namingGenerationChar = '';
  let namingGenerationPos: 'first' | 'second' = 'first';
  let selectedCandidateIdx = 0;

  // 4. 数字能量状态
  let numberValue = '';
  let numberPurpose: 'phone' | 'plate' | 'general' = 'phone';
  let numberQuestion = '';

  const resultPanel = document.createElement('section');
  resultPanel.className = 'workspace-ui-form-surface culture-tools-result-panel';

  function validateBeforeRun(): string | null {
    if (activeTab === 'character-query' && hanziMode === 'text') {
      const cleanHan = [...hanziText.trim()].filter((c) => /\p{Script=Han}/u.test(c)).join('');
      if (!cleanHan) return '请先在左侧输入 1–20 个要解析的汉字。';
    }
    if (activeTab === 'chinese-name' && !fullName.trim()) {
      return '请先在左侧输入需要测算的完整姓名。';
    }
    if (activeTab === 'chinese-naming' && !namingSurname.trim()) {
      return '请先在左侧输入姓氏后再生成起名方案。';
    }
    if (activeTab === 'number-energy' && !numberValue.trim()) {
      return '请先在左侧输入手机号码、车牌或数字编号。';
    }
    return null;
  }

  function showIdleGuide(message?: string) {
    const empty = document.createElement('div');
    empty.className = 'culture-tools-empty';
    const guideText =
      message ||
      (activeTab === 'character-query'
        ? '请在左侧输入需要查询的汉字（1–20 字），或切换到「按条件筛选字库」直接按笔画五行选字。'
        : activeTab === 'chinese-name'
          ? '请在左侧输入完整姓名后点击「开始综合解析」，查看康熙五格、三才与字义分析。'
          : activeTab === 'chinese-naming'
            ? '请在左侧输入姓氏与用字偏好后点击「生成姓名候选」。'
            : '请在左侧输入手机号码、车牌或数字编号后点击「解析数字能量」。');
    empty.append(cEl('span', undefined, '字'), cEl('h3', undefined, '等待输入'), cEl('p', undefined, guideText));
    resultPanel.replaceChildren(empty);
  }

  function buildCurrentPayload(): Record<string, unknown> {
    switch (activeTab) {
      case 'character-query': {
        if (hanziMode === 'search') {
          return {
            question: '请根据筛选条件列出匹配的汉字与五行笔画。',
            query: {
              kind: 'search',
              ...(hanziSearchStrokes ? { strokes: Number(hanziSearchStrokes) } : {}),
              ...(hanziSearchWuxing ? { wuxing: hanziSearchWuxing } : {}),
              ...(hanziSearchPinyin.trim() ? { pinyin: hanziSearchPinyin.trim() } : {}),
              commonOnly: true,
              limit: 40,
            },
          };
        }
        const cleanHan = [...hanziText.trim()].filter((c) => /\p{Script=Han}/u.test(c)).join('');
        return {
          question: `请解析汉字「${cleanHan || '待输入'}」的康熙笔画、五行与字义。`,
          query: {
            kind: 'text',
            text: cleanHan,
            includeReferences: true,
          },
        };
      }
      case 'chinese-name':
        return {
          fullName: fullName.trim(),
          surnameLength,
          question: nameQuestion.trim() || '请解析这个名字的五格三才与字义。',
        };
      case 'chinese-naming':
        return {
          surname: namingSurname.trim(),
          gender: namingGender,
          givenNameLength: namingLength,
          ...(namingPreferredChars.trim()
            ? { preferredCharacters: namingPreferredChars.trim() }
            : {}),
          ...(namingForbiddenChars.trim()
            ? { forbiddenCharacters: namingForbiddenChars.trim() }
            : {}),
          ...(namingGenerationChar.trim()
            ? {
                generationCharacter: [...namingGenerationChar.trim()][0],
                generationPosition: namingGenerationPos,
              }
            : {}),
          limit: 12,
          question: `请为「${namingSurname.trim()}」姓比较并推荐合适的名字方案。`,
        };
      case 'number-energy':
        return {
          value: numberValue.trim(),
          purpose: numberPurpose,
          question: numberQuestion.trim() || '这个号码有哪些传统八星磁场取象？',
        };
    }
  }

  function emitChange() {
    onChange?.(activeTab, buildCurrentPayload());
  }

  async function executeAndRenderCard() {
    const missingErr = validateBeforeRun();
    if (missingErr) {
      showIdleGuide(missingErr);
      return;
    }
    const payload = buildCurrentPayload();
    emitChange();
    const loading = document.createElement('div');
    loading.className = 'workspace-ui-empty';
    loading.textContent = '正在计算并生成结果…';
  function formatFriendlyCultureError(err: unknown): string {
    const raw = err instanceof Error ? err.message.trim() : '';
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw) as Array<{
          code?: string;
          minimum?: number;
          maximum?: number;
          path?: unknown[];
          message?: string;
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const issue = parsed[0];
          const field = String(issue.path?.[0] ?? '');
          const fieldLabels: Record<string, string> = {
            fullName: '完整姓名',
            surname: '姓氏',
            characters: '汉字输入',
            number: '数字',
            year: '公历年份',
            hexagram: '卦象',
          };
          const fieldLabel = fieldLabels[field] ?? '输入内容';
          if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
            return `${fieldLabel}至少需要输入 ${issue.minimum} 个字符，请补充完整后再试。`;
          }
          if (issue.code === 'too_big' && typeof issue.maximum === 'number') {
            return `${fieldLabel}超出允许范围，请调整后再试。`;
          }
          return `${fieldLabel}填写有误，请检查后再试。`;
        }
      } catch {}
    }
    return raw && !/invalid input/i.test(raw) ? raw : '输入内容格式有误，请检查后重试。';
  }

    resultPanel.replaceChildren(loading);
    try {
      if (activeTab === 'chinese-name') {
        const nameVal = String((payload as Record<string, unknown>).fullName ?? '').trim();
        if (nameVal.length < 2) {
          throw new Error('请输入至少 2 个汉字的完整姓名。');
        }
      }
      const res = (await calculate(activeTab, payload)) as {
        data?: unknown;
        prompt?: { text?: string };
      };
      onResult?.(activeTab, payload, res);
      renderVisualCardForCulture(activeTab, res.data);
    } catch (err) {
      const errEl = document.createElement('div');
      errEl.className = 'culture-tools-error';
      errEl.setAttribute('role', 'alert');
      errEl.textContent = formatFriendlyCultureError(err);
      resultPanel.replaceChildren(errEl);
    }
  }

  function renderVisualCardForCulture(tab: CultureToolTabId, data: unknown) {
    if (!data || typeof data !== 'object') {
      const empty = document.createElement('div');
      empty.className = 'culture-tools-empty';
      empty.innerHTML = '<span>空</span><h3>暂无结果</h3><p>请检查输入条件后重新计算。</p>';
      resultPanel.replaceChildren(empty);
      return;
    }

    if (tab === 'character-query') {
      const d = data as {
        result?: {
          characters?: Array<{
            char: string;
            detail?: {
              pinyin?: string;
              kangxiStrokes?: number;
              simplifiedStrokes?: number;
              traditional?: string;
              traditionalStrokes?: number;
              wuxing?: string;
              radical?: string;
              structure?: string;
              definition?: string;
              kangxiText?: string;
            } | null;
          }>;
          items?: Array<{
            char: string;
            pinyin?: string;
            kangxiStrokes: number;
            wuxing?: string;
            definition?: string;
          }>;
        };
      };

      const frag = document.createDocumentFragment();
      frag.appendChild(createSectionHeading('02', '字典结果', '读音、康熙笔画、五行与字义'));

      if (d.result?.characters) {
        const list = document.createElement('div');
        list.className = 'culture-character-list is-analysis';
        for (const item of d.result.characters) {
          const card = document.createElement('div');
          const det = item.detail;
          if (det) {
            card.append(
              cEl('strong', undefined, item.char),
              cEl('span', undefined, det.pinyin ?? '读音待补'),
              cEl(
                'small',
                undefined,
                `简体 ${det.simplifiedStrokes ?? '—'} 画 · 部首 ${det.radical ?? '—'} · ${det.structure ?? '—'}`,
              ),
              cEl(
                'small',
                undefined,
                `姓名学康熙 ${det.kangxiStrokes ?? '—'} 画 · 五行属${det.wuxing ?? '待定'}`,
              ),
              cEl('p', undefined, det.definition ?? '暂无释义'),
            );
            if (det.kangxiText) {
              const details = document.createElement('details');
              details.className = 'culture-character-classic';
              details.append(
                cEl('summary', undefined, '康熙字典原文'),
                cEl('p', undefined, det.kangxiText),
              );
              card.appendChild(details);
            }
          } else {
            card.append(cEl('strong', undefined, item.char), cEl('p', undefined, '字典暂未收录这个字。'));
          }
          list.appendChild(card);
        }
        frag.appendChild(list);
      } else if (d.result?.items) {
        const pool = document.createElement('div');
        pool.className = 'culture-character-pool';
        const h3 = document.createElement('h3');
        h3.textContent = `符合条件的字（共 ${d.result.items.length} 字，点击查看详情）`;
        const grid = document.createElement('div');
        for (const item of d.result.items) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.title = item.definition ?? '';
          btn.append(
            cEl('strong', undefined, item.char),
            cEl('small', undefined, `${item.kangxiStrokes}画 · ${item.wuxing ?? '待定'}`),
          );
          btn.addEventListener('click', () => {
            hanziMode = 'text';
            hanziText = item.char;
            render();
            void executeAndRenderCard();
          });
          grid.appendChild(btn);
        }
        pool.append(h3, grid);
        frag.appendChild(pool);
      }
      resultPanel.replaceChildren(frag);
      return;
    }

    if (tab === 'chinese-name') {
      const d = data as {
        analysis?: {
          surname: string;
          given: string;
          chars: Array<{
            char: string;
            pinyin?: string;
            kangxiStrokes: number;
            wuxing?: string;
            definition?: string;
          }>;
          grids: Record<
            string,
            { num: number; wuxing: string; role: string; level: string; keywords: string }
          >;
          sancai: { combo: string; level: string; text: string };
        };
      };
      if (!d.analysis) return;
      const frag = document.createDocumentFragment();
      frag.appendChild(createSectionHeading('02', '综合结果', '查看姓名逐字康熙笔画与五格三才关系'));
      frag.appendChild(buildNameAnalysisCard(d.analysis));
      resultPanel.replaceChildren(frag);
      return;
    }

    if (tab === 'chinese-naming') {
      const d = data as {
        candidates?: Array<{
          fullName: string;
          analysis: {
            surname: string;
            given: string;
            chars: Array<{
              char: string;
              pinyin?: string;
              kangxiStrokes: number;
              wuxing?: string;
              definition?: string;
            }>;
            grids: Record<
              string,
              { num: number; wuxing: string; role: string; level: string; keywords: string }
            >;
            sancai: { combo: string; level: string; text: string };
          };
        }>;
      };
      const cands = d.candidates ?? [];
      const frag = document.createDocumentFragment();
      frag.appendChild(
        createSectionHeading(
          '02',
          '候选比较',
          cands.length ? `已生成 ${cands.length} 个可继续推敲的名字` : '生成后可逐个查看',
        ),
      );

      if (!cands.length) {
        const empty = document.createElement('div');
        empty.className = 'culture-tools-empty';
        empty.innerHTML = '<span>名</span><h3>暂无候选名字</h3><p>请放宽偏好用字或避讳字限制后重试。</p>';
        frag.appendChild(empty);
        resultPanel.replaceChildren(frag);
        return;
      }
      if (selectedCandidateIdx >= cands.length) selectedCandidateIdx = 0;

      const grid = document.createElement('div');
      grid.className = 'culture-name-grid';
      cands.forEach((cand, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = idx === selectedCandidateIdx ? 'is-selected' : '';
        const wuxings = cand.analysis.chars
          .slice(cand.analysis.surname.length)
          .map((c) => c.wuxing ?? '')
          .join('');
        const strongEl = document.createElement('strong');
        strongEl.textContent = cand.fullName;
        const smallEl = document.createElement('small');
        smallEl.textContent = `${cand.analysis.sancai.combo} · ${wuxings}`;
        btn.append(strongEl, smallEl);
        btn.addEventListener('click', () => {
          selectedCandidateIdx = idx;
          renderVisualCardForCulture('chinese-naming', data);
        });
        grid.appendChild(btn);
      });

      frag.append(grid, buildNameAnalysisCard(cands[selectedCandidateIdx]!.analysis));
      resultPanel.replaceChildren(frag);
      return;
    }

    if (tab === 'number-energy') {
      const d = data as {
        alphanumeric?: string;
        energySequence?: string;
        energyFormula?: string;
        dominantFields?: string[];
        primaryIndex?: number;
        primaryNumerology?: { poem: string; level: string; keywords: string };
        magneticSummary?: {
          pairCount: number;
          supportiveCount: number;
          steadyCount: number;
          challengingCount: number;
        };
        magneticDistribution?: Array<{ name: string; nature: string; count: number }>;
        energyPairs?: Array<{
          span: string;
          pair?: string;
          start?: number;
          end?: number;
          name: string;
          nature: string;
          keywords: string[];
          meaning: string;
        }>;
      };
      const frag = document.createDocumentFragment();
      frag.appendChild(createSectionHeading('02', '磁场结果', '按号码顺序查看八星磁场组合'));

      const article = document.createElement('article');
      article.className = 'culture-number-report';

      const main = document.createElement('div');
      main.className = 'culture-number-main';
      main.append(
        cEl('span', undefined, '能量序列'),
        cEl('strong', undefined, d.energySequence ?? ''),
        cEl(
          'p',
          undefined,
          `数字字母：${d.alphanumeric ?? numberValue} · 八十一数理 #${d.primaryIndex ?? ''}（${d.primaryNumerology?.level ?? ''}：${d.primaryNumerology?.poem ?? ''}）`,
        ),
        cEl(
          'h3',
          undefined,
          d.dominantFields?.length ? `高频磁场 · ${d.dominantFields.join('、')}` : '均衡分布磁场',
        ),
      );
      article.appendChild(main);

      if (d.magneticSummary) {
        const stats = document.createElement('div');
        stats.className = 'culture-number-stats';
        const statBox1 = document.createElement('div');
        statBox1.append(cEl('span', undefined, '磁场组合'), cEl('strong', undefined, String(d.magneticSummary.pairCount)));
        const statBox2 = document.createElement('div');
        statBox2.append(
          cEl('span', undefined, '助益 / 守成'),
          cEl('strong', undefined, `${d.magneticSummary.supportiveCount} / ${d.magneticSummary.steadyCount}`),
        );
        const statBox3 = document.createElement('div');
        statBox3.append(cEl('span', undefined, '考验组合'), cEl('strong', undefined, String(d.magneticSummary.challengingCount)));
        stats.append(statBox1, statBox2, statBox3);
        article.appendChild(stats);
      }

      if (d.magneticDistribution?.length) {
        const dist = document.createElement('section');
        dist.className = 'culture-number-distribution';
        const distTitle = document.createElement('h3');
        distTitle.textContent = '磁场分布';
        const distWrap = document.createElement('div');
        for (const item of d.magneticDistribution) {
          const chip = document.createElement('span');
          chip.dataset.nature = item.nature;
          chip.append(cEl('strong', undefined, item.name), cEl('small', undefined, `${item.count} 组`));
          distWrap.appendChild(chip);
        }
        dist.append(distTitle, distWrap);
        article.appendChild(dist);
      }

      if (d.energyPairs?.length) {
        const pairsSec = document.createElement('section');
        pairsSec.className = 'culture-number-pairs';
        const pTitle = document.createElement('h3');
        pTitle.textContent = '逐组磁场';
        const pList = document.createElement('div');
        d.energyPairs.forEach((p, idx) => {
          const item = document.createElement('article');
          const codeDiv = cEl('div', 'culture-number-pair-code');
          codeDiv.append(cEl('strong', undefined, p.span), cEl('small', undefined, p.nature));
          const copyDiv = cEl('div', 'culture-number-pair-copy');
          const hdr = document.createElement('header');
          hdr.append(cEl('strong', undefined, p.name), cEl('span', undefined, p.nature));
          copyDiv.append(hdr, cEl('p', undefined, p.keywords.join('、')), cEl('small', undefined, p.meaning));
          item.append(
            cEl('div', 'culture-number-pair-index', String(idx + 1).padStart(2, '0')),
            codeDiv,
            copyDiv,
          );
          pList.appendChild(item);
        });
        pairsSec.append(pTitle, pList);
        article.appendChild(pairsSec);
      }

      if (d.energyFormula) {
        const rule = document.createElement('div');
        rule.className = 'culture-number-rule';
        rule.append(cEl('strong', undefined, '换算规则'), cEl('span', undefined, d.energyFormula));
        article.appendChild(rule);
      }

      frag.appendChild(article);
      resultPanel.replaceChildren(frag);
      return;
    }
  }

  function buildNameAnalysisCard(analysis: {
    surname: string;
    given: string;
    chars: Array<{
      char: string;
      pinyin?: string;
      kangxiStrokes: number;
      wuxing?: string;
      definition?: string;
    }>;
    grids: Record<
      string,
      { num: number; wuxing: string; role: string; level: string; keywords: string }
    >;
    sancai: { combo: string; level: string; text: string };
  }): HTMLElement {
    const article = document.createElement('article');
    article.className = 'culture-name-report';

    const header = document.createElement('header');
    const hdrInner = document.createElement('div');
    hdrInner.append(
      cEl('h3', undefined, `${analysis.surname}${analysis.given}`),
      cEl('p', undefined, analysis.chars.map((c) => c.pinyin ?? '读音待补').join(' · ')),
    );
    header.appendChild(hdrInner);
    article.appendChild(header);

    const charList = document.createElement('div');
    charList.className = 'culture-character-list';
    for (const c of analysis.chars) {
      const item = document.createElement('div');
      item.append(
        cEl('strong', undefined, c.char),
        cEl('span', undefined, c.pinyin ?? ''),
        cEl('small', undefined, `康熙 ${c.kangxiStrokes} 画 · ${c.wuxing ?? '待定'}`),
      );
      if (c.definition) item.appendChild(cEl('p', undefined, c.definition));
      charList.appendChild(item);
    }
    article.appendChild(charList);

    const tradHead = document.createElement('div');
    tradHead.className = 'culture-tradition-heading';
    tradHead.append(
      cEl('strong', undefined, '五格与三才'),
      cEl('small', undefined, '按康熙笔画列示，作为传统数理资料参考'),
    );
    article.appendChild(tradHead);

    const gridLabels: Record<string, string> = {
      tian: '天格',
      ren: '人格',
      di: '地格',
      wai: '外格',
      zong: '总格',
    };
    const wugeRow = document.createElement('div');
    wugeRow.className = 'culture-grid-list';
    for (const [k, g] of Object.entries(analysis.grids)) {
      const cell = document.createElement('div');
      cell.append(
        cEl('span', undefined, `${gridLabels[k] ?? k}（${g.role}）`),
        cEl('strong', undefined, String(g.num)),
        cEl('small', undefined, `${g.wuxing} · ${g.level}`),
        cEl('p', undefined, g.keywords),
      );
      wugeRow.appendChild(cell);
    }
    article.appendChild(wugeRow);

    const sancaiBar = document.createElement('div');
    sancaiBar.className = 'culture-sancai';
    sancaiBar.append(
      cEl('strong', undefined, `三才配置 · ${analysis.sancai.combo}（${analysis.sancai.level}）`),
      cEl('span', undefined, analysis.sancai.text),
    );
    article.appendChild(sancaiBar);

    return article;
  }

  function render() {
    const outer = document.createElement('div');
    outer.className = 'workspace-focused-page workspace-culture-page';

    const page = document.createElement('div');
    page.className = 'workspace-ui-page workspace-ui-screen is-wide culture-tools-page';

    if (!hideHeader) {
      const tabLabelMap: Record<CultureToolTabId, string> = {
        'character-query': '汉字字典',
        'chinese-name': '姓名五格',
        'chinese-naming': '起名方案',
        'number-energy': '数字能量',
      };
      const header = document.createElement('header');
      header.className = 'workspace-ui-page-header';
      const titleWrap = document.createElement('div');
      const h1 = document.createElement('h1');
      h1.textContent = `择吉字理 · ${tabLabelMap[activeTab] ?? '综合工具'}`;
      titleWrap.appendChild(h1);
      header.appendChild(titleWrap);
      page.appendChild(header);
    }

    const workspace = document.createElement('div');
    workspace.className = 'culture-tools-workspace';

    const inputPanel = document.createElement('section');
    inputPanel.className = 'workspace-ui-form-surface culture-tools-input-panel';

    if (activeTab === 'character-query') {
      inputPanel.appendChild(
        createSectionHeading('01', '查字与选字', '支持按文字直接查询或按康熙笔画、五行筛选'),
      );
      inputPanel.appendChild(
        createSegmentedBar(
          hanziMode,
          [
            { id: 'text', label: '按汉字查笔画/五行' },
            { id: 'search', label: '按条件筛选字库' },
          ],
          (m) => {
            hanziMode = m;
            render();
          },
        ),
      );

      if (hanziMode === 'text') {
        inputPanel.appendChild(
          makeCultureField('汉字（1–20字）', hanziText, '输入待查询的汉字', (v) => {
            hanziText = v;
            emitChange();
          }),
        );
      } else {
        const row = document.createElement('div');
        row.className = 'culture-tools-fields is-three';
        row.append(
          makeCultureField('康熙笔画', hanziSearchStrokes, '输入笔画数（不限留空）', (v) => {
            hanziSearchStrokes = v.replace(/[^\d]/g, '');
            emitChange();
          }),
          makeCultureSelect(
            '五行',
            [
              { value: '', label: '不限' },
              { value: '金', label: '金' },
              { value: '木', label: '木' },
              { value: '水', label: '水' },
              { value: '火', label: '火' },
              { value: '土', label: '土' },
            ],
            hanziSearchWuxing,
            (v) => {
              hanziSearchWuxing = v as typeof hanziSearchWuxing;
              emitChange();
            },
          ),
          makeCultureField('拼音', hanziSearchPinyin, '输入拼音（不限留空）', (v) => {
            hanziSearchPinyin = v;
            emitChange();
          }),
        );
        inputPanel.appendChild(row);
      }
    } else if (activeTab === 'chinese-name') {
      inputPanel.appendChild(createSectionHeading('01', '姓名资料', '复姓请选择两个姓氏字'));
      const row = document.createElement('div');
      row.className = 'culture-tools-fields is-two';
      row.append(
        makeCultureField('完整姓名', fullName, '输入完整姓名', (v) => {
          fullName = v;
          emitChange();
        }),
        makeCultureSelect(
          '姓氏长度',
          [
            { value: '1', label: '单姓' },
            { value: '2', label: '复姓' },
          ],
          String(surnameLength),
          (v) => {
            surnameLength = Number(v) as 1 | 2;
            emitChange();
          },
        ),
      );
      inputPanel.append(
        row,
        makeCultureTextarea(
          '想重点了解什么',
          nameQuestion,
          '输入你想重点分析的使用场景或关注方向（可选）',
          (v) => {
            nameQuestion = v;
            emitChange();
          },
        ),
      );
    } else if (activeTab === 'chinese-naming') {
      inputPanel.appendChild(createSectionHeading('01', '基础偏好', '姓氏、名字气质与用字要求'));
      const row1 = document.createElement('div');
      row1.className = 'culture-tools-fields is-three';
      row1.append(
        makeCultureField('姓氏', namingSurname, '输入姓氏', (v) => {
          namingSurname = v;
          emitChange();
        }),
        makeCultureSelect(
          '名字气质',
          [
            { value: 'general', label: '自然通用' },
            { value: 'male', label: '偏阳刚' },
            { value: 'female', label: '偏柔和' },
          ],
          namingGender,
          (v) => {
            namingGender = v as typeof namingGender;
            emitChange();
          },
        ),
        makeCultureSelect(
          '名字字数',
          [
            { value: '2', label: '双字名' },
            { value: '1', label: '单字名' },
          ],
          String(namingLength),
          (v) => {
            namingLength = Number(v) as 1 | 2;
            emitChange();
          },
        ),
      );
      const row2 = document.createElement('div');
      row2.className = 'culture-tools-fields is-two';
      row2.append(
        makeCultureField('偏好字', namingPreferredChars, '如：明 朗（空格分隔）', (v) => {
          namingPreferredChars = v;
          emitChange();
        }),
        makeCultureField('忌用字', namingForbiddenChars, '如：尘 寒（可选）', (v) => {
          namingForbiddenChars = v;
          emitChange();
        }),
        makeCultureField('辈分字', namingGenerationChar, '单个汉字（可选）', (v) => {
          namingGenerationChar = v;
          emitChange();
        }),
        makeCultureSelect(
          '辈分字位置',
          [
            { value: 'first', label: '名字首字' },
            { value: 'second', label: '名字末字' },
          ],
          namingGenerationPos,
          (v) => {
            namingGenerationPos = v as 'first' | 'second';
            emitChange();
          },
        ),
      );
      inputPanel.append(row1, row2);
    } else if (activeTab === 'number-energy') {
      inputPanel.appendChild(
        createSectionHeading('01', '输入内容', '支持数字、英文字母和常见分隔符'),
      );
      inputPanel.append(
        createSegmentedBar(
          numberPurpose,
          [
            { id: 'phone', label: '手机号' },
            { id: 'plate', label: '车牌号' },
            { id: 'general', label: '其他编号' },
          ],
          (p) => {
            numberPurpose = p;
            render();
          },
        ),
        makeCultureField(
          '数字或字母',
          numberValue,
          numberPurpose === 'plate'
            ? '输入车牌号码'
            : numberPurpose === 'phone'
              ? '输入手机号码'
              : '输入数字或编号序列',
          (v) => {
            numberValue = v;
            emitChange();
          },
        ),
        makeCultureTextarea(
          '想重点了解什么',
          numberQuestion,
          '输入你想重点关注的使用场景或方面（可选）',
          (v) => {
            numberQuestion = v;
            emitChange();
          },
        ),
      );
    }

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'culture-tools-primary workspace-ui-button is-primary is-large is-block';
    runBtn.textContent =
      activeTab === 'character-query'
        ? hanziMode === 'text'
          ? '解析汉字'
          : '筛选可用字'
        : activeTab === 'chinese-name'
          ? '开始综合解析'
          : activeTab === 'chinese-naming'
            ? '生成姓名候选'
            : '解析数字能量';
    runBtn.addEventListener('click', () => {
      void executeAndRenderCard();
    });
    inputPanel.appendChild(runBtn);

    workspace.append(inputPanel, resultPanel);
    page.appendChild(workspace);
    outer.appendChild(page);
    container.replaceChildren(outer);
    emitChange();
  }

  render();
  if (validateBeforeRun()) {
    showIdleGuide();
  } else {
    void executeAndRenderCard();
  }
}

// ==================== 干支日历 (GanzhiCalendarPanel) 完整算法与 DOM ====================

interface CalendarTermItem {
  name: string;
  isJie: boolean;
  dateKey: string;
  chinaDateTime: string;
  beforeMonthPillar: string;
  afterMonthPillar: string;
}

interface CalendarCellModel {
  date: string;
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  weekday: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  lunarDate: string;
  lunarFull: string;
  yearGanzhi: string;
  monthGanzhi: string;
  dayGanzhi: string;
  noonHourGanzhi: string;
  valueGod: string;
  valueGodFortune: '黄道' | '黑道';
  dayOfficer: string;
  clashText: string;
  nineStar: string;
  twentyEightStar: string;
  recommends: string[];
  avoids: string[];
  luckyGods: string[];
  unluckyGods: string[];
  hours: Array<{
    name: string;
    range: string;
    ganzhi: string;
    twelveStar: string;
    fortune: '黄道' | '黑道';
  }>;
  solarTerms: CalendarTermItem[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDaysUtc(dateKey: string, delta: number): string {
  const { year, month, day } = parseDateParts(dateKey);
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return formatDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const dt = new Date(Date.UTC(Number(yStr) || 2026, (Number(mStr) || 1) - 1 + delta, 1));
  const y = Math.min(2100, Math.max(1900, dt.getUTCFullYear()));
  return `${y}-${pad2(dt.getUTCMonth() + 1)}`;
}

function collectYearSolarTerms(year: number): CalendarTermItem[] {
  const list: CalendarTermItem[] = [];
  for (const y of [year - 1, year, year + 1]) {
    if (y < 1900 || y > 2100) continue;
    for (let idx = 0; idx < 24; idx++) {
      try {
        const term = SolarTerm.fromIndex(y, idx);
        const st = term.getJulianDay().getSolarTime();
        const ty = st.getYear();
        const tm = st.getMonth();
        const td = st.getDay();
        const dateKey = formatDateKey(ty, tm, td);
        const timeText = `${pad2(st.getHour())}:${pad2(st.getMinute())}:${pad2(st.getSecond())}`;
        const name = term.getName();
        const isJie = JIE_TERM_NAMES.has(name);
        const beforePillars = getSolarYmdHmsPillars(ty, tm, td, 0, 0, 0);
        const afterPillars = getSolarYmdHmsPillars(ty, tm, td, 23, 59, 59);
        list.push({
          name,
          isJie,
          dateKey,
          chinaDateTime: `${dateKey} ${timeText}`,
          beforeMonthPillar: beforePillars.month,
          afterMonthPillar: afterPillars.month,
        });
      } catch {}
    }
  }
  return list;
}

function buildCalendarCellModel(
  dateKey: string,
  currentMonthKey: string,
  todayKey: string,
  termsByDate: Map<string, CalendarTermItem[]>,
): CalendarCellModel {
  const { year, month, day } = parseDateParts(dateKey);
  const solarDay = SolarDay.fromYmd(year, month, day);
  const lunar = solarDay.getLunarDay();
  const noon = SolarTime.fromYmdHms(year, month, day, 12, 0, 0);
  const noonPillars = getSolarYmdHmsPillars(year, month, day, 12, 0, 0);

  const dayGanzhi = noonPillars.day;
  const monthBranch = noonPillars.month[1];
  const dayBranch = dayGanzhi[1];
  const valueGod = getDayTwelveStar(monthBranch, dayBranch);
  const valueGodFortune: '黄道' | '黑道' = HUANGDAO_STARS.has(valueGod) ? '黄道' : '黑道';
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  const lunarStr = lunar.toString().replace(/^农历[^年]+年/u, '');
  const lunarDayName = lunar.getName();
  const lunarDate =
    lunar.getDay() === 1
      ? lunarStr.endsWith(lunarDayName)
        ? lunarStr.slice(0, -lunarDayName.length) || lunarDayName
        : lunarStr
      : lunarDayName;

  const branchRel = getDayBranchRelations(dayBranch);
  const clashText = `${branchRel.zodiac}日冲${branchRel.oppositeZodiac}（${dayBranch}${branchRel.oppositeBranch}相冲 · 煞${branchRel.ominous}）`;

  const { recommends, avoids } = getDayTaboos(monthBranch, dayGanzhi);

  let luckyGods: string[] = [];
  let unluckyGods: string[] = [];
  try {
    const gods = getAlmanacSolarDayGods(solarDay, noon);
    luckyGods = gods.filter((g) => g.luck === '吉').map((g) => g.name);
    unluckyGods = gods.filter((g) => g.luck !== '吉').map((g) => g.name);
  } catch {}

  const sourceHours = lunar.getHours();
  const hours = sourceHours.map((h, i) => {
    const gz = h.getSixtyCycle().getName();
    const expectedBranch = [...'子丑寅卯辰巳午未申酉戌亥子'][i] ?? '子';
    const effectiveDayBranch = i === 12 ? stepSixtyCycle(dayGanzhi, 1)[1] : dayBranch;
    const star = getHourTwelveStar(effectiveDayBranch, expectedBranch);
    return {
      name: i === 0 ? '早子时' : i === 12 ? '晚子时' : `${expectedBranch}时`,
      range: HOUR_RANGES[i] ?? '',
      ganzhi: gz,
      twelveStar: star,
      fortune: (HUANGDAO_STARS.has(star) ? '黄道' : '黑道') as '黄道' | '黑道',
    };
  });

  return {
    date: dateKey,
    year,
    month,
    day,
    weekdayIndex,
    weekday: `星期${WEEK_LABELS[weekdayIndex]}`,
    isCurrentMonth: dateKey.slice(0, 7) === currentMonthKey,
    isToday: dateKey === todayKey,
    lunarDate,
    lunarFull: lunar.toString(),
    yearGanzhi: noonPillars.year,
    monthGanzhi: noonPillars.month,
    dayGanzhi,
    noonHourGanzhi: noonPillars.hour,
    valueGod,
    valueGodFortune,
    dayOfficer: getDayDuty(monthBranch, dayBranch),
    clashText,
    nineStar: getSolarDayNineStar(solarDay).fullName,
    twentyEightStar: `${getDayTwentyEightStar(weekdayIndex, dayBranch).name}宿`,
    recommends,
    avoids,
    luckyGods,
    unluckyGods,
    hours,
    solarTerms: termsByDate.get(dateKey) ?? [],
  };
}

/**
 * 渲染 1:1 复刻 V1 `GanzhiCalendarPanel.tsx` 的干支黄历面板（支持独立页与择日内嵌）。
 */
export function renderGanzhiCalendarPanel(options: {
  container: HTMLElement;
  selectedDate?: string;
  embedded?: boolean;
  onSelectDate?: (dateKey: string) => void;
}): void {
  const { container, embedded = false, onSelectDate } = options;
  const nowParts = getBeijingNowParts();
  const todayKey = nowParts.dateStr;

  let selectedDate =
    options.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDate)
      ? options.selectedDate
      : todayKey;
  let monthKey = selectedDate.slice(0, 7);

  function renderPanel() {
    const [yNum, mNum] = monthKey.split('-').map(Number);
    const year = yNum || nowParts.year;
    const month = mNum || 1;

    const allTerms = collectYearSolarTerms(year);
    const termsByDate = new Map<string, CalendarTermItem[]>();
    for (const t of allTerms) {
      const arr = termsByDate.get(t.dateKey) ?? [];
      arr.push(t);
      termsByDate.set(t.dateKey, arr);
    }

    const firstDayKey = formatDateKey(year, month, 1);
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const gridStartKey = addDaysUtc(firstDayKey, -firstWeekday);

    const cells: CalendarCellModel[] = Array.from({ length: 42 }, (_, idx) => {
      const dateKey = addDaysUtc(gridStartKey, idx);
      return buildCalendarCellModel(dateKey, monthKey, todayKey, termsByDate);
    });

    const selectedDetail =
      cells.find((c) => c.date === selectedDate) ??
      buildCalendarCellModel(selectedDate, monthKey, todayKey, termsByDate);

    const jieTerms = allTerms.filter((t) => t.isJie);
    const beforeBoundary =
      [...jieTerms].reverse().find((t) => t.dateKey <= selectedDate) ?? null;
    const afterBoundary = jieTerms.find((t) => t.dateKey > selectedDate) ?? null;

    const pageWrap = document.createElement('div');
    pageWrap.className = `ganzhi-calendar-page ganzhi-calendar-panel${
      embedded ? ' is-embedded' : ''
    }`;

    const surface = document.createElement('section');
    surface.className = 'workspace-ui-surface ganzhi-calendar-surface';

    // Toolbar
    const toolbar = document.createElement('header');
    toolbar.className = 'ganzhi-calendar-toolbar';

    const monthCtrl = document.createElement('div');
    monthCtrl.className = 'ganzhi-calendar-month-control';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'workspace-ui-button is-secondary is-small ganzhi-calendar-nav-button';
    prevBtn.setAttribute('aria-label', '查看上个月');
    prevBtn.disabled = monthKey <= '1900-01';
    prevBtn.textContent = '‹';
    prevBtn.addEventListener('click', () => {
      monthKey = shiftMonthKey(monthKey, -1);
      const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
      selectedDate = `${monthKey}-${pad2(dayNum)}`;
      onSelectDate?.(selectedDate);
      renderPanel();
    });

    const pickerLabel = document.createElement('label');
    pickerLabel.className = 'ganzhi-calendar-month-picker';
    const pickerSpan = document.createElement('span');
    pickerSpan.textContent = `${year}年${month}月`;
    const pickerInput = document.createElement('input');
    pickerInput.type = 'month';
    pickerInput.min = '1900-01';
    pickerInput.max = '2100-12';
    pickerInput.value = monthKey;
    pickerInput.setAttribute('aria-label', '选择月份');
    pickerInput.addEventListener('change', () => {
      if (!pickerInput.value) return;
      monthKey = pickerInput.value;
      const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
      selectedDate = `${monthKey}-${pad2(dayNum)}`;
      onSelectDate?.(selectedDate);
      renderPanel();
    });
    pickerLabel.append(pickerSpan, pickerInput);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'workspace-ui-button is-secondary is-small ganzhi-calendar-nav-button';
    nextBtn.setAttribute('aria-label', '查看下个月');
    nextBtn.disabled = monthKey >= '2100-12';
    nextBtn.textContent = '›';
    nextBtn.addEventListener('click', () => {
      monthKey = shiftMonthKey(monthKey, 1);
      const dayNum = Math.min(28, Number(selectedDate.slice(8, 10)) || 1);
      selectedDate = `${monthKey}-${pad2(dayNum)}`;
      onSelectDate?.(selectedDate);
      renderPanel();
    });

    monthCtrl.append(prevBtn, pickerLabel, nextBtn);

    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'workspace-ui-button is-secondary is-small';
    todayBtn.textContent = '今天';
    todayBtn.addEventListener('click', () => {
      selectedDate = todayKey;
      monthKey = todayKey.slice(0, 7);
      onSelectDate?.(selectedDate);
      renderPanel();
    });

    toolbar.append(monthCtrl, todayBtn);
    surface.appendChild(toolbar);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'ganzhi-calendar-legend';
    legend.setAttribute('aria-label', '月历图例');
    legend.innerHTML = `<span><i class="is-huangdao"></i>黄道值神</span>
      <span><i class="is-heidao"></i>黑道值神</span>
      <span>节气标注· 节切月 / 中气不切月</span>`;
    surface.appendChild(legend);

    // Layout (Board + Detail)
    const layout = document.createElement('div');
    layout.className = 'ganzhi-calendar-layout';

    const board = document.createElement('section');
    board.className = 'ganzhi-calendar-board';
    board.setAttribute('aria-label', `${year}年${month}月干支月历`);

    const weekRow = document.createElement('div');
    weekRow.className = 'ganzhi-calendar-week-row';
    weekRow.setAttribute('aria-hidden', 'true');
    WEEK_LABELS.forEach((w, idx) => {
      const sp = document.createElement('span');
      if (idx === 0 || idx === 6) sp.className = 'is-weekend';
      sp.textContent = w;
      weekRow.appendChild(sp);
    });
    board.appendChild(weekRow);

    const grid = document.createElement('div');
    grid.className = 'ganzhi-calendar-grid';
    grid.setAttribute('role', 'group');
    for (const cell of cells) {
      const isSelected = cell.date === selectedDate;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ganzhi-calendar-cell${cell.isCurrentMonth ? '' : ' is-outside'}${
        cell.isToday ? ' is-today' : ''
      }${isSelected ? ' is-selected' : ''}`;
      btn.setAttribute('aria-pressed', String(isSelected));
      const fortuneCls = cell.valueGodFortune === '黄道' ? 'is-huangdao' : 'is-heidao';
      const termText = cell.solarTerms
        .map((t) => `${t.name}${t.isJie ? '·节' : ''}`)
        .join(' ');
      btn.innerHTML = `<span class="ganzhi-cell-topline"><strong>${cell.day}</strong>${
        cell.isToday ? '<em>今</em>' : ''
      }</span>
        <span class="ganzhi-cell-lunar">${cell.lunarDate}</span>
        <span class="ganzhi-cell-ganzhi">${cell.dayGanzhi}</span>
        <span class="ganzhi-cell-god ${fortuneCls}">${cell.valueGod}<span class="ganzhi-cell-fortune">${cell.valueGodFortune}</span></span>
        ${termText ? `<span class="ganzhi-cell-term">${termText}</span>` : ''}`;
      btn.addEventListener('click', () => {
        selectedDate = cell.date;
        if (cell.date.slice(0, 7) !== monthKey) {
          monthKey = cell.date.slice(0, 7);
        }
        onSelectDate?.(selectedDate);
        renderPanel();
      });
      grid.appendChild(btn);
    }
    board.appendChild(grid);

    const monthTermsBox = document.createElement('div');
    monthTermsBox.className = 'ganzhi-month-terms';
    monthTermsBox.setAttribute('aria-label', '本月节气交接');
    const currentMonthTerms = cells
      .filter((c) => c.isCurrentMonth)
      .flatMap((c) => c.solarTerms);
    for (const term of currentMonthTerms) {
      const p = document.createElement('p');
      p.innerHTML = `<strong>${term.name}</strong> ${term.chinaDateTime.slice(5)} <span>${
        term.isJie
          ? `月柱 ${term.beforeMonthPillar} → ${term.afterMonthPillar}`
          : '中气 · 不切月'
      }</span>`;
      monthTermsBox.appendChild(p);
    }
    board.appendChild(monthTermsBox);

    // Detail panel
    const detailEl = document.createElement('section');
    detailEl.className = 'ganzhi-calendar-detail';
    const dFortuneCls = selectedDetail.valueGodFortune === '黄道' ? 'is-huangdao' : 'is-heidao';

    const detailHeader = document.createElement('header');
    detailHeader.className = 'ganzhi-detail-header';
    detailHeader.innerHTML = `<div>
        <p class="ganzhi-detail-eyebrow">选中日期 · ${selectedDetail.weekday}</p>
        <h2>${selectedDetail.year}年${selectedDetail.month}月${selectedDetail.day}日</h2>
        <p>${selectedDetail.lunarFull} · <strong>${selectedDetail.dayGanzhi}日</strong></p>
      </div>
      <span class="ganzhi-detail-badge ${dFortuneCls}">${selectedDetail.valueGod} · ${selectedDetail.valueGodFortune}</span>`;
    detailEl.appendChild(detailHeader);

    const facts = document.createElement('div');
    facts.className = 'ganzhi-detail-facts';
    facts.innerHTML = `<div><span>年柱（正午）</span><strong>${selectedDetail.yearGanzhi}</strong></div>
      <div><span>月柱（正午）</span><strong>${selectedDetail.monthGanzhi}</strong></div>
      <div><span>日柱 / 正午时柱</span><strong>${selectedDetail.dayGanzhi} / ${selectedDetail.noonHourGanzhi}</strong></div>
      <div><span>建除十二神</span><strong>${selectedDetail.dayOfficer}日</strong></div>
      <div><span>冲煞</span><strong>${selectedDetail.clashText}</strong></div>
      <div><span>九星 / 廿八宿</span><strong>${selectedDetail.nineStar} · ${selectedDetail.twentyEightStar}</strong></div>`;
    detailEl.appendChild(facts);

    // 月令交节
    const boundarySec = document.createElement('section');
    boundarySec.className = 'ganzhi-detail-section';
    boundarySec.innerHTML = `<h3>月令交节</h3><p class="ganzhi-detail-note">只有十二节改变月柱；中气只作为节气资料展示。</p>`;
    const boundaryList = document.createElement('div');
    boundaryList.className = 'ganzhi-boundary-list';
    for (const [label, b] of [
      ['前一交节', beforeBoundary],
      ['后一交节', afterBoundary],
    ] as const) {
      if (!b) continue;
      const row = document.createElement('div');
      row.className = 'ganzhi-boundary-row';
      row.innerHTML = `<span>${label}</span><div><strong>${b.name}</strong><small>${b.chinaDateTime} 中国标准时间</small><p>${b.beforeMonthPillar} <b>→</b> ${b.afterMonthPillar}</p></div>`;
      boundaryList.appendChild(row);
    }
    boundarySec.appendChild(boundaryList);
    detailEl.appendChild(boundarySec);

    // 本日节气
    const dayTermSec = document.createElement('section');
    dayTermSec.className = 'ganzhi-detail-section';
    dayTermSec.innerHTML = '<h3>本日节气</h3>';
    if (selectedDetail.solarTerms.length) {
      const tList = document.createElement('div');
      tList.className = 'ganzhi-term-list';
      for (const t of selectedDetail.solarTerms) {
        const d = document.createElement('div');
        d.innerHTML = `<strong>${t.name}</strong><span>${t.chinaDateTime} 中国标准时间</span><small>${
          t.isJie ? '节 · 切月边界' : '中气 · 不切月'
        }</small>`;
        tList.appendChild(d);
      }
      dayTermSec.appendChild(tList);
    } else {
      const note = document.createElement('p');
      note.className = 'ganzhi-detail-note';
      note.textContent = '本日无节气交接。';
      dayTermSec.appendChild(note);
    }
    detailEl.appendChild(dayTermSec);

    // 传统宜忌
    const recSec = document.createElement('section');
    recSec.className = 'ganzhi-detail-section';
    recSec.innerHTML = `<h3>传统宜忌</h3>
      <div class="ganzhi-recommend-grid">
        <div class="is-recommend"><span>宜</span><p>${
          selectedDetail.recommends.length ? selectedDetail.recommends.join('、') : '诸事不宜'
        }</p></div>
        <div class="is-avoid"><span>忌</span><p>${
          selectedDetail.avoids.length ? selectedDetail.avoids.join('、') : '无特别忌项'
        }</p></div>
      </div>`;
    detailEl.appendChild(recSec);

    // 吉神凶煞
    const godsSec = document.createElement('section');
    godsSec.className = 'ganzhi-detail-section';
    godsSec.innerHTML = `<h3>吉神凶煞</h3>
      <div class="ganzhi-recommend-grid">
        <div class="is-recommend"><span>吉神</span><p>${
          selectedDetail.luckyGods.length ? selectedDetail.luckyGods.slice(0, 12).join('、') : '—'
        }</p></div>
        <div class="is-avoid"><span>凶煞</span><p>${
          selectedDetail.unluckyGods.length ? selectedDetail.unluckyGods.slice(0, 12).join('、') : '—'
        }</p></div>
      </div>`;
    detailEl.appendChild(godsSec);

    // 十二时辰
    const hourSec = document.createElement('section');
    hourSec.className = 'ganzhi-detail-section';
    hourSec.innerHTML = '<h3>十二时辰</h3>';
    const hourGrid = document.createElement('div');
    hourGrid.className = 'ganzhi-hour-grid';
    for (const h of selectedDetail.hours) {
      const item = document.createElement('div');
      item.className = 'ganzhi-hour-item';
      item.innerHTML = `<strong>${h.name}</strong><span>${h.range}</span><b>${h.ganzhi}</b><small>${h.twelveStar} · ${h.fortune}</small>`;
      hourGrid.appendChild(item);
    }
    hourSec.appendChild(hourGrid);
    detailEl.appendChild(hourSec);

    layout.append(board, detailEl);
    surface.appendChild(layout);
    pageWrap.appendChild(surface);
    container.replaceChildren(pageWrap);
  }

  renderPanel();
}

export interface AstroCalendarWidgetController {
  element: HTMLElement;
  syncDate: (nextDateKey: string) => void;
}

/**
 * 构建可独立嵌入「择吉万年历」或单独使用的「天文历法精密推算」面板（节气 / 月相 / 真太阳时 / 光照）。
 */
export function createAstroCalendarWidget(
  options: Omit<CultureOrCalendarPageOptions, 'container'> & { initialDate?: string } = {},
): AstroCalendarWidgetController {
  const { onChange, onResult, initialDate } = options;
  const nowParts = getBeijingNowParts();

  let activeKind: CalendarToolTabId = 'solar-term';
  let selectedDate =
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : nowParts.dateStr;
  let termYear = selectedDate.slice(0, 4);
  let selectedTime = nowParts.timeStr;
  let placeDisplay = '北京市 东城区';
  let placeLon = 116.416;
  let placeLat = 39.928;

  const astroSection = document.createElement('section');
  astroSection.className = 'almanac-astro-panel';
  const resultBox = document.createElement('div');

  function buildCalendarPayload(): Record<string, unknown> {
    const d = parseDateParts(selectedDate);
    const t = parseTimeParts(selectedTime);

    switch (activeKind) {
      case 'solar-term':
        return {
          question: `请列出 ${termYear} 年二十四节气精确交节时刻。`,
          calendar: {
            kind: 'solar-term',
            year: Math.min(2199, Math.max(1900, Number.parseInt(termYear, 10) || nowParts.year)),
          },
        };
      case 'moon-phase': {
        const hh = String(t.hour).padStart(2, '0');
        const mm = String(t.minute).padStart(2, '0');
        return {
          question: '请解释该时刻的月相、月龄与前后朔望交点。',
          calendar: {
            kind: 'moon-phase',
            at: `${selectedDate}T${hh}:${mm}:00+08:00`,
          },
        };
      }
      case 'true-solar':
        return {
          question: `请计算 ${placeDisplay}（经度 ${placeLon}°）在该钟表时刻的真太阳时修正。`,
          calendar: {
            kind: 'true-solar',
            birth: {
              year: d.year,
              month: d.month,
              day: d.day,
              hour: t.hour,
              minute: t.minute,
              second: 0,
              calendar: 'solar',
              timezone: 8,
            },
            longitude: placeLon,
          },
        };
      case 'time-scales':
        return {
          question: '请换算该时刻的儒略日 JD_UTC、ΔT 估算与近似地球力学时 JD_TT。',
          calendar: {
            kind: 'time-scales',
            time: {
              year: d.year,
              month: d.month,
              day: d.day,
              hour: t.hour,
              minute: t.minute,
              second: 0,
              timezone: 8,
            },
          },
        };
      case 'solar-illumination':
        return {
          question: `请计算 ${placeDisplay} 当日的日出日落、视太阳正午与光照高度。`,
          calendar: {
            kind: 'solar-illumination',
            time: {
              year: d.year,
              month: d.month,
              day: d.day,
              hour: t.hour,
              minute: t.minute,
              second: 0,
              timezone: 8,
            },
            latitude: placeLat,
            longitude: placeLon,
          },
        };
    }
  }

  function emitChange() {
    onChange?.('calendar', buildCalendarPayload());
  }

  async function runCalendarCalculation() {
    const payload = buildCalendarPayload();
    emitChange();
    const loading = document.createElement('p');
    loading.className = 'ganzhi-detail-note';
    loading.textContent = '正在推算天文历法数据…';
    resultBox.replaceChildren(loading);
    try {
      const res = (await calculate('calendar', payload)) as {
        data?: { result?: Record<string, unknown> };
      };
      onResult?.('calendar', payload, res);
      renderCalendarResultCard(res.data?.result);
    } catch (err) {
      const errEl = document.createElement('div');
      errEl.className = 'workspace-ui-form-error';
      const rawMsg = err instanceof Error ? err.message.trim() : '';
      errEl.textContent =
        rawMsg && !rawMsg.startsWith('[') ? rawMsg : '历法推算失败，请检查输入年份与地点。';
      resultBox.replaceChildren(errEl);
    }
  }

  function renderCalendarResultCard(res?: Record<string, unknown>) {
    if (!res) {
      resultBox.textContent = '暂无历法数据。';
      return;
    }

    if (res.kind === 'solar-term' && Array.isArray(res.terms)) {
      const grid = document.createElement('div');
      grid.className = 'culture-grid-list';
      for (const term of res.terms as Array<{
        name: string;
        isJie: boolean;
        utcDateTime: string;
        targetLongitudeDegrees: number;
      }>) {
        const item = document.createElement('div');
        const bjTime = new Date(term.utcDateTime).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        item.innerHTML = `<span>${term.isJie ? '十二节 · 换月令' : '十二中气'} · 黄经${term.targetLongitudeDegrees}°</span>
          <strong>${term.name}</strong>
          <p>北京时间 ${bjTime}</p>`;
        grid.appendChild(item);
      }
      resultBox.replaceChildren(grid);
      return;
    }

    if (res.kind === 'moon-phase') {
      const frac =
        typeof res.illuminationFraction === 'number'
          ? (res.illuminationFraction * 100).toFixed(1)
          : '—';
      const age =
        typeof res.approximateMoonAgeDays === 'number'
          ? res.approximateMoonAgeDays.toFixed(2)
          : '—';
      const prev = res.previousPrincipalPhase as { name?: string; utcDateTime?: string } | undefined;
      const next = res.nextPrincipalPhase as { name?: string; utcDateTime?: string } | undefined;
      const facts = document.createElement('div');
      facts.className = 'ganzhi-detail-facts';
      facts.innerHTML = `<div><span>当前八相月相</span><strong>${String(res.eightPhaseName ?? '')}（照明率 ${frac}%）</strong></div>
        <div><span>近似月龄</span><strong>${age} 天（距朔角 ${Number(res.elongationDegrees ?? 0).toFixed(1)}°）</strong></div>
        <div><span>上一朔望弦</span><strong>${prev?.name ?? '—'} · ${prev?.utcDateTime ?? ''}</strong></div>
        <div><span>下一朔望弦</span><strong>${next?.name ?? '—'} · ${next?.utcDateTime ?? ''}</strong></div>`;
      resultBox.replaceChildren(facts);
      return;
    }

    if (res.kind === 'true-solar') {
      const corr = res.correction as
        | {
            longitudeCorrectionMinutes?: number;
            equationOfTimeMinutes?: number;
            totalCorrectionMinutes?: number;
          }
        | undefined;
      const facts = document.createElement('div');
      facts.className = 'ganzhi-detail-facts';
      facts.innerHTML = `<div><span>钟表平太阳时间</span><strong>${String(res.localDateTime ?? '')}（东八区北京时间）</strong></div>
        <div><span>真太阳时结果</span><strong>${String(res.trueSolarDateTime ?? '')}（${placeDisplay}）</strong></div>
        <div><span>经度平太阳时差</span><strong>${(corr?.longitudeCorrectionMinutes ?? 0).toFixed(2)} 分钟（东经 ${placeLon.toFixed(2)}°）</strong></div>
        <div><span>均时差与总修正</span><strong>总修正 ${(corr?.totalCorrectionMinutes ?? 0).toFixed(2)} 分钟（均时差 ${(corr?.equationOfTimeMinutes ?? 0).toFixed(2)} 分钟）</strong></div>`;
      resultBox.replaceChildren(facts);
      return;
    }

    if (res.kind === 'time-scales') {
      const jdUtc =
        typeof res.julianDayUtc === 'number' ? res.julianDayUtc.toFixed(6) : '—';
      const jdTt =
        typeof res.approximateJulianDayTt === 'number'
          ? res.approximateJulianDayTt.toFixed(6)
          : '—';
      const deltaT =
        typeof res.deltaTSeconds === 'number' ? `${res.deltaTSeconds.toFixed(3)} 秒` : '—';
      const facts = document.createElement('div');
      facts.className = 'ganzhi-detail-facts';
      facts.innerHTML = `<div><span>当地民用时刻</span><strong>${String(res.localDateTime ?? '')}（UTC+8）</strong></div>
        <div><span>协调世界时（UTC）</span><strong>${String(res.utcDateTime ?? '')}</strong></div>
        <div><span>儒略日 JD_UTC / 近似 JD_UT1</span><strong>${jdUtc}</strong></div>
        <div><span>地球自转估算 ΔT</span><strong>${deltaT}</strong></div>
        <div><span>近似地球力学时 JD_TT</span><strong>${jdTt}</strong></div>`;
      resultBox.replaceChildren(facts);
      return;
    }

    if (res.kind === 'solar-illumination') {
      const inst = res.instant as
        | { altitudeDegrees?: number; azimuthDegrees?: number; phase?: string }
        | undefined;
      const noons = Array.isArray(res.apparentSolarNoons) ? res.apparentSolarNoons : [];
      const firstNoon = noons[0] as
        | { localDateTime?: string; altitudeDegrees?: number }
        | undefined;
      const facts = document.createElement('div');
      facts.className = 'ganzhi-detail-facts';
      facts.innerHTML = `<div><span>当前昼夜阶段</span><strong>${inst?.phase ?? '昼间'}（${placeDisplay}）</strong></div>
        <div><span>太阳高度角 / 方位角</span><strong>高度 ${(inst?.altitudeDegrees ?? 0).toFixed(2)}° · 方位 ${(inst?.azimuthDegrees ?? 0).toFixed(2)}°</strong></div>
        <div><span>当日视太阳正午（上中天）</span><strong>${firstNoon?.localDateTime ?? '—'}（中天高度 ${firstNoon?.altitudeDegrees !== undefined ? `${firstNoon.altitudeDegrees.toFixed(2)}°` : '—'}）</strong></div>`;
      resultBox.replaceChildren(facts);
    }
  }

  function renderAstroControls() {
    astroSection.replaceChildren();

    const tabbar = document.createElement('div');
    tabbar.className = 'culture-tools-tabbar';
    const tabs = document.createElement('div');
    tabs.className = 'workspace-ui-tabs';
    for (const tab of CALENDAR_TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `workspace-ui-tab${activeKind === tab.id ? ' is-active' : ''}`;
      btn.textContent = `${tab.label} · ${tab.desc}`;
      btn.addEventListener('click', () => {
        activeKind = tab.id;
        renderAstroControls();
        void runCalendarCalculation();
      });
      tabs.appendChild(btn);
    }
    tabbar.appendChild(tabs);
    astroSection.appendChild(tabbar);

    if (activeKind === 'solar-term') {
      const row = document.createElement('div');
      row.className = 'workspace-ui-form-row';
      row.appendChild(
        makeUiField('公历年份（1900–2199）', termYear, '输入四位公历年份', (v) => {
          termYear = v.replace(/[^\d]/g, '').slice(0, 4);
          emitChange();
        }),
      );
      astroSection.appendChild(row);
    } else {
      const dtRow = document.createElement('div');
      dtRow.className = 'workspace-ui-form-row is-two-column';

      const dField = document.createElement('label');
      dField.className = 'workspace-ui-field';
      const dSpan = document.createElement('span');
      dSpan.textContent = '公历日期';
      const dInput = document.createElement('input');
      dInput.type = 'date';
      dInput.className = 'workspace-ui-control';
      dInput.value = selectedDate;
      dInput.addEventListener('change', () => {
        selectedDate = dInput.value || nowParts.dateStr;
        emitChange();
      });
      dField.append(dSpan, dInput);

      const tField = document.createElement('label');
      tField.className = 'workspace-ui-field';
      const tSpan = document.createElement('span');
      tSpan.textContent = '钟表时刻（北京时间）';
      const tInput = document.createElement('input');
      tInput.type = 'time';
      tInput.className = 'workspace-ui-control';
      tInput.value = selectedTime;
      tInput.addEventListener('change', () => {
        selectedTime = tInput.value || nowParts.timeStr;
        emitChange();
      });
      tField.append(tSpan, tInput);

      dtRow.append(dField, tField);
      astroSection.appendChild(dtRow);

      if (activeKind === 'true-solar' || activeKind === 'solar-illumination') {
        const placeRow = document.createElement('div');
        placeRow.className = 'workspace-ui-form-row';
        const placeField = document.createElement('div');
        placeField.className = 'workspace-ui-field';
        const placeLabel = document.createElement('label');
        placeLabel.textContent = '观测地区';
        const placeBtn = document.createElement('button');
        placeBtn.type = 'button';
        placeBtn.className = 'workspace-ui-control address-trigger';
        placeBtn.innerHTML = `<span>${placeDisplay}（东经 ${placeLon.toFixed(2)}°，北纬 ${placeLat.toFixed(2)}°）</span><span class="address-trigger-arrow">选择</span>`;
        placeBtn.addEventListener('click', () => {
          openPlacePickerModal({
            title: '选择真太阳时 / 光照观测地区',
            currentDisplayName: placeDisplay,
            onSelect: (entry) => {
              placeDisplay = entry.displayName;
              placeLon = entry.longitude;
              placeLat = entry.latitude ?? 39.9;
              renderAstroControls();
              void runCalendarCalculation();
            },
          });
        });
        placeField.append(placeLabel, placeBtn);
        placeRow.appendChild(placeField);
        astroSection.appendChild(placeRow);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'workspace-ui-form-actions';
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'workspace-ui-button is-primary';
    runBtn.textContent = '立即换算并更新历法数据';
    runBtn.addEventListener('click', () => {
      void runCalendarCalculation();
    });
    actions.appendChild(runBtn);
    astroSection.append(actions, resultBox);
  }

  renderAstroControls();
  void runCalendarCalculation();

  return {
    element: astroSection,
    syncDate(nextDateKey: string) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDateKey)) return;
      selectedDate = nextDateKey;
      termYear = nextDateKey.slice(0, 4);
      renderAstroControls();
      void runCalendarCalculation();
    },
  };
}

/**
 * 渲染独立「干支万年历与天文历法页（CalendarPage）」。
 */
export function renderCalendarPage(options: CultureOrCalendarPageOptions): void {
  const { container, onChange, onResult } = options;
  const nowParts = getBeijingNowParts();

  const outer = document.createElement('div');
  outer.className = 'workspace-focused-page workspace-calendar-page';

  const calendarHost = document.createElement('div');
  const astroWrap = document.createElement('section');
  astroWrap.className = 'workspace-ui-form-surface';
  const astroWidget = createAstroCalendarWidget({
    initialDate: nowParts.dateStr,
    onChange,
    onResult,
  });
  astroWrap.appendChild(astroWidget.element);

  outer.append(calendarHost, astroWrap);
  container.replaceChildren(outer);

  renderGanzhiCalendarPanel({
    container: calendarHost,
    selectedDate: nowParts.dateStr,
    onSelectDate: (nextDateKey) => {
      astroWidget.syncDate(nextDateKey);
    },
  });
}

function makeCultureField(
  label: string,
  value: string,
  placeholder: string,
  onInput: (val: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'culture-tools-field workspace-ui-field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'workspace-ui-control';
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(span, input);
  return wrap;
}

function makeCultureTextarea(
  label: string,
  value: string,
  placeholder: string,
  onInput: (val: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'culture-tools-field workspace-ui-field';
  const span = document.createElement('span');
  span.textContent = label;
  const textarea = document.createElement('textarea');
  textarea.className = 'workspace-ui-control';
  textarea.rows = 3;
  textarea.value = value;
  textarea.placeholder = placeholder;
  textarea.addEventListener('input', () => onInput(textarea.value));
  wrap.append(span, textarea);
  return wrap;
}

function makeCultureSelect(
  label: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  currentValue: string,
  onChange: (val: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'culture-tools-field workspace-ui-field';
  const span = document.createElement('span');
  span.textContent = label;
  const select = document.createElement('select');
  select.className = 'workspace-ui-control';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentValue) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.append(span, select);
  return wrap;
}

function makeUiField(
  label: string,
  value: string,
  placeholder: string,
  onInput: (val: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'workspace-ui-field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'workspace-ui-control';
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(span, input);
  return wrap;
}
