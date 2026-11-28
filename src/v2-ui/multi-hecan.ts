import { runCalculateInBackground } from '../workers/calc-runner';
import { NON_CLASSICS_METHODS } from '../method-registry';
import type { Method } from '../schema';
import {
  evaluateBaziZiweiCorroboration,
  formatCorroborationSection,
  type BaziZiweiCorroborationResult,
} from '../systems/bazi-ziwei-corroboration';
import { getYearSixtyCycle } from '../systems/ganzhi-foundation';
import { type MingluResonanceSummary } from '../systems/minglu-resonance';
import { ASTRO_HOUSE_SYSTEM_LABELS } from '../systems/prompt-format';
import { parseQuestionContext, type QuestionTopic } from '../systems/question-context';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../web-settings';
import {
  ALL_HECAN_SYSTEMS,
  DEFAULT_HECAN_SYSTEMS,
  HECAN_SYSTEMS,
  HECAN_SYSTEM_MAP,
  getAvailableHecanSystems,
  getHecanSystemAvailability,
  normalizeHecanSystems,
  readSavedHecanSystems,
  saveHecanSystems,
  toggleHecanSystem,
  type HecanComputedEntry,
  type HecanOmittedEntry,
  type HecanSystemId,
  type HecanSystemMeta,
  type MultiHecanData,
  type MultiHecanResult,
} from './multi-hecan-meta';
import { BIRTH_TIME_OPTIONS, normalizeTimeIndex, type PersonalCase } from './cases-store';
import { buildPersonalChartPayload } from './chart-payloads';

export {
  ALL_HECAN_SYSTEMS,
  DEFAULT_HECAN_SYSTEMS,
  HECAN_SYSTEMS,
  getAvailableHecanSystems,
  getHecanSystemAvailability,
  normalizeHecanSystems,
  readSavedHecanSystems,
  saveHecanSystems,
  toggleHecanSystem,
  type HecanComputedEntry,
  type HecanOmittedEntry,
  type HecanSystemId,
  type HecanSystemMeta,
  type MultiHecanData,
  type MultiHecanResult,
};

const CN_NUMERALS = ['一', '二', '三', '四', '五', '六'] as const;

function asRec(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function formatZiweiStarCompact(star: unknown): string {
  const s = asRec(star);
  if (!s) return '';
  const name = asStr(s.name);
  if (!name) return '';
  const br = asStr(s.brightness);
  const mut = asStr(s.mutagen);
  const mutPart = mut ? `·化${mut}` : '';
  return `${name}${br}${mutPart}`;
}

export function extractHecanAnchor(
  systemId: HecanSystemId,
  data: unknown,
): string {
  const d = asRec(data);
  if (!d) return '已排盘';

  if (systemId === 'bazi') {
    const chart = asRec(d.chart);
    if (chart) {
      const pillars = asRec(chart.pillars);
      const gz = ['year', 'month', 'day', 'hour']
        .map((k) => asStr(asRec(pillars?.[k])?.ganZhi))
        .filter(Boolean)
        .join(' ');
      const strength = asStr(asRec(chart.strength)?.status);
      const pattern = asStr(asRec(chart.patternOverview)?.pattern);
      const fav = asArr(asRec(chart.usefulGod)?.favorableWuxing)
        .filter((x): x is string => typeof x === 'string')
        .join('');
      return [gz, strength, pattern, fav ? `喜${fav}` : ''].filter(Boolean).join(' · ') || '已排盘';
    }
    const unknown = asRec(d.unknown);
    const segments = asArr(unknown?.segments);
    const dayPossible = asArr(asRec(unknown?.possible)?.day)
      .filter((x): x is string => typeof x === 'string')
      .join('/');
    return (
      [
        segments.length ? `候选 ${segments.length} 段` : '',
        dayPossible ? `日柱 ${dayPossible}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || '不确定时辰候选'
    );
  }

  if (systemId === 'ziwei') {
    if ('unknown' in d) {
      const candidates = asArr(asRec(d.unknown)?.candidates);
      return candidates.length ? `候选 ${candidates.length} 段` : '不确定时辰候选';
    }
    const natal = asRec(d.natal);
    if (natal) {
      const soulBranch = asStr(natal.soulBranch);
      const bodyBranch = asStr(natal.bodyBranch);
      const fiveClass = asStr(natal.fiveElementsClass);
      const palaces = asArr(natal.palaces).map(asRec);
      const mingPalace = palaces.find((p) => p?.name === '命宫');
      const majorStars = asArr(mingPalace?.majorStars)
        .map((s) => asStr(asRec(s)?.name))
        .filter(Boolean)
        .join('、');
      return (
        [
          soulBranch ? `命宫${soulBranch}（${majorStars || '无主星'}）` : '',
          bodyBranch ? `身宫${bodyBranch}` : '',
          fiveClass,
        ]
          .filter(Boolean)
          .join(' · ') || '已排盘'
      );
    }
  }

  if (systemId === 'astrolabe') {
    const points = asArr(d.points).map(asRec);
    const angles = asArr(d.angles).map(asRec);
    const sun = asStr(points.find((p) => p?.id === 'sun')?.sign);
    const moon = asStr(points.find((p) => p?.id === 'moon')?.sign);
    const asc = asStr(angles.find((a) => a?.id === 'asc')?.sign);
    return (
      [sun ? `日${sun}` : '', moon ? `月${moon}` : '', asc ? `升${asc}` : '']
        .filter(Boolean)
        .join(' · ') || '已排盘'
    );
  }

  if (systemId === 'qizheng') {
    const twelve = asArr(d.twelvePalaces).map(asRec);
    const mingBranch = asStr(twelve.find((p) => p?.palace === '命宫')?.signBranch);
    const mingZhu = asStr(d.mingZhu);
    const duZhu = asStr(asRec(d.mingDu)?.duZhu);
    return (
      [
        mingBranch ? `命宫${mingBranch}` : '',
        mingZhu ? `命主${mingZhu}` : '',
        duZhu ? `度主${duZhu}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || '已排盘'
    );
  }

  if (systemId === 'qimen-lifetime') {
    const base = asRec(d.baseChart);
    if (base) {
      const dun = `${base.isYangDun ? '阳遁' : '阴遁'}${String(base.juShu ?? '')}局`;
      const zhiFu = asStr(base.zhiFu);
      const zhiShi = asStr(base.zhiShi);
      return [dun, zhiFu ? `值符${zhiFu}` : '', zhiShi ? `值使${zhiShi}` : '']
        .filter(Boolean)
        .join(' · ');
    }
  }

  return '已排盘';
}

const WRAPPER_HEADER_RE =
  /^【(?:顶部任务锚点|解读与交付契约|AI 报告输出规范|局势要点|任务|任务与限制|限制与任务|限制|合参任务|问题|提示词参考时间|计算口径|资料口径|模型口径|口径|传统语境|适用边界|计算限制|传统依据|解读选择|主题：综合|主题与任务)】/u;

const SYSTEM_ROOT_REMAP: Record<HecanSystemId, RegExp> = {
  bazi: /^【八字命盘】\s*/u,
  ziwei: /^【紫微斗数】\s*/u,
  astrolabe: /^【西洋星盘本命】\s*/u,
  qizheng: /^【七政四余本命】\s*/u,
  'qimen-lifetime': /^【奇门终身局基础盘】\s*/u,
};

const SYSTEM_ROOT_LABEL: Record<HecanSystemId, string> = {
  bazi: '八字概况：',
  ziwei: '紫微概况：',
  astrolabe: '西洋星盘概况：',
  qizheng: '七政四余概况：',
  'qimen-lifetime': '奇门终身局概况：',
};

function splitTopHeadingBlocks(rawText: string): Array<{ header: string; lines: string[] }> {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const blocks: Array<{ header: string; lines: string[] }> = [];

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    const standalone = /^(【[^】\n]+】)\s*$/.exec(trimmed);
    const inlineHeading = !standalone ? /^(【[^】\n]{1,18}】)(.+)$/.exec(trimmed) : null;
    if (standalone) {
      blocks.push({ header: standalone[1]!, lines: [] });
    } else if (
      inlineHeading &&
      !/^[，。；：、）】》]/.test(inlineHeading[2]!.trim()) &&
      (blocks.length === 0 ||
        blocks[blocks.length - 1]!.lines.length === 0 ||
        /^【(?:七政四余本命|西洋星盘本命|八字命盘|紫微斗数|奇门终身局基础盘)/.test(
          inlineHeading[1]!,
        ))
    ) {
      blocks.push({ header: inlineHeading[1]!, lines: [inlineHeading[2]!.trim()] });
    } else if (blocks.length === 0) {
      blocks.push({ header: '', lines: [line] });
    } else {
      blocks[blocks.length - 1]!.lines.push(line);
    }
  }
  return blocks;
}

export function extractCleanSystemPromptBody(
  systemId: HecanSystemId,
  rawPromptText: string,
): string {
  if (!rawPromptText.trim()) return '';
  const blocks = splitTopHeadingBlocks(rawPromptText);
  const rootRe = SYSTEM_ROOT_REMAP[systemId];
  const rootLabel = SYSTEM_ROOT_LABEL[systemId];
  const outParts: string[] = [];

  for (const block of blocks) {
    const header = block.header;
    const body = block.lines.join('\n').trim();

    if (!header) {
      if (body) outParts.push(body);
      continue;
    }
    if (WRAPPER_HEADER_RE.test(header)) continue;

    if (rootRe.test(header)) {
      if (body) outParts.push(`${rootLabel}${body}`);
      continue;
    }

    if (!body) continue;
    const innerTitle = header.replace(/^【|】$/g, '').trim();
    outParts.push(`▸ ${innerTitle}：\n${body}`);
  }

  return outParts.join('\n\n').trim();
}

function extractNamedPromptBlock(rawPromptText: string, headerRe: RegExp): string {
  if (!rawPromptText) return '';
  const blocks = splitTopHeadingBlocks(rawPromptText);
  for (const block of blocks) {
    if (block.header && headerRe.test(block.header)) {
      return block.lines.join('\n').trim();
    }
  }
  return '';
}

function extractCompactTimingLine(
  systemId: HecanSystemId,
  entry: HecanComputedEntry,
): string | null {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';

  if (systemId === 'bazi') {
    const located = asRec(data?.located);
    if (!located) return null;
    const cycle = asRec(located.cycle);
    const year = asRec(located.year);
    const cycleLabel = cycle
      ? `大运${asStr(cycle.ganZhi)}（${asStr(asRec(cycle.pillar)?.tenGod) || ''}）`
      : '童限';
    const yearLabel = year
      ? `流年${asStr(year.ganZhi)}（${asStr(asRec(year.pillar)?.tenGod) || ''}）`
      : '';
    return [cycleLabel, yearLabel].filter(Boolean).join(' · ') || null;
  }

  if (systemId === 'ziwei') {
    const ref = asRec(data?.reference);
    const layers = asRec(ref?.layers);
    if (!layers) return null;
    const dec = asRec(layers.decadal);
    const yr = asRec(layers.yearly);
    const fmtMut = (layer: Record<string, unknown> | undefined) => {
      const muts = asArr(layer?.mutagenPlacements).map(asRec);
      return muts
        .map((m) => `${asStr(m?.star)}化${asStr(m?.mutagen)}→${asStr(m?.natalPalace)}`)
        .filter(Boolean)
        .join('、');
    };
    const decText = dec
      ? `大限${asStr(dec.heavenlyStem)}${asStr(dec.earthlyBranch)}（${fmtMut(dec) || '四化见下'}）`
      : '';
    const yrText = yr
      ? `流年${asStr(yr.heavenlyStem)}${asStr(yr.earthlyBranch)}（${fmtMut(yr) || '四化见下'}）`
      : '';
    return [decText, yrText].filter(Boolean).join('；') || null;
  }

  if (systemId === 'astrolabe') {
    const block = extractNamedPromptBlock(promptText, /^【小限与年运窗口（压平精要）】$/u);
    if (!block) return null;
    return block.split('\n').slice(0, 2).join('｜');
  }

  if (systemId === 'qizheng') {
    const block = extractNamedPromptBlock(promptText, /^【行限与流年小限（压平精要）】$/u);
    if (!block) return null;
    return block.split('\n').slice(0, 2).join('｜');
  }

  if (systemId === 'qimen-lifetime') {
    const block = extractNamedPromptBlock(promptText, /^【阶段运限与流年落宫（压平精要）】$/u);
    if (!block) return null;
    return block.split('\n').slice(0, 2).join('｜');
  }

  return null;
}

function formatBirthSummaryLine(person: PersonalCase): string {
  const cal = (person.calendar ?? person.dateType) === 'lunar' ? '农历' : '公历';
  const leap = cal === '农历' && person.isLeapMonth ? '闰' : '';
  const datePart = `${cal}${person.year}年${leap}${person.month}月${person.day}日`;
  const hasClock =
    String(person.birthHour ?? '').trim() !== '' &&
    String(person.birthMinute ?? '').trim() !== '';
  let timePart = '未知时辰';
  if (hasClock) {
    const hh = String(person.birthHour).padStart(2, '0');
    const mm = String(person.birthMinute).padStart(2, '0');
    timePart = `${hh}:${mm}${person.useTrueSolarTime ? '（真太阳时校正）' : ''}`;
  } else {
    const idx = normalizeTimeIndex(person.timeIndex);
    if (typeof idx === 'number' && BIRTH_TIME_OPTIONS[idx]) {
      timePart = `${BIRTH_TIME_OPTIONS[idx].label}（${BIRTH_TIME_OPTIONS[idx].range}）`;
    }
  }
  const placePart = person.birthPlace?.trim() ? ` · ${person.birthPlace.trim()}` : '';
  return `${datePart} ${timePart}${placePart}`;
}

const KEY_SHENSHA_RE =
  /天乙贵人|太极贵人|文昌贵人|天德贵人|月德贵人|福星贵人|禄神|羊刃|驿马|桃花|咸池|华盖|将星|孤辰|寡宿|红鸾|天喜|空亡|天罗地网|金舆|国印/;

function buildBaziEvidenceCard(entry: HecanComputedEntry): string {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';
  const chart = asRec(data?.chart);

  if (!chart) {
    const unknown = asRec(data?.unknown);
    const segments = asArr(unknown?.segments).map(asRec);
    const segLines = segments.slice(0, 6).map((seg, idx) => {
      const p = asRec(seg?.pillars);
      const gz = ['year', 'month', 'day', 'hour']
        .map((k) => asStr(asRec(p?.[k])?.ganZhi))
        .filter(Boolean)
        .join(' ');
      const strength = asStr(asRec(seg?.strength)?.status);
      const pattern = asStr(asRec(seg?.patternOverview)?.pattern);
      const ug = asRec(seg?.usefulGod);
      const fav = asArr(ug?.favorableWuxing).join('、');
      return `候选${idx + 1}：${gz}｜${strength}｜${pattern}｜喜[${fav || '中和'}]`;
    });
    return [
      `未知/区间时辰（共 ${segments.length} 个候选时段）：`,
      ...segLines,
      segments.length > 6 ? `（其余 ${segments.length - 6} 段请先用过往大事定盘核准时辰）` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const pillars = asRec(chart.pillars);
  const posLabels: Array<[string, string]> = [
    ['year', '年'],
    ['month', '月'],
    ['day', '日'],
    ['hour', '时'],
  ];
  const pillarStr = posLabels
    .map(([k, lbl]) => {
      const p = asRec(pillars?.[k]);
      const hidden = asArr(p?.hiddenStems)
        .map((h) => `${asStr(asRec(h)?.stem)}${asStr(asRec(h)?.tenGod)}`)
        .filter(Boolean)
        .join('/');
      return `${lbl}${asStr(p?.ganZhi)}(${asStr(p?.tenGod)}${hidden ? `·藏${hidden}` : ''})`;
    })
    .join('｜');

  const strength = asStr(asRec(chart.strength)?.status);
  const pattern = asStr(asRec(chart.patternOverview)?.pattern);
  const ordPattern = asStr(asRec(chart.ordinaryPattern)?.candidate);
  const ug = asRec(chart.usefulGod);
  const usefulMain = asStr(ug?.useful);
  const fav = asArr(ug?.favorableWuxing).join('、');
  const unfav = asArr(ug?.unfavorableWuxing).join('、');
  const climateFav = asArr(asRec(chart.climateDecision)?.favorable).join('、');

  const shenshaEntries = asArr(asRec(chart.shensha)?.entries).map(asRec);
  const posCn: Record<string, string> = { year: '年', month: '月', day: '日', hour: '时' };
  const keyShensha: string[] = [];
  const seenSs = new Set<string>();
  for (const s of shenshaEntries) {
    const name = asStr(s?.name);
    if (!name || !KEY_SHENSHA_RE.test(name)) continue;
    const pos = posCn[asStr(s?.position)] ?? asStr(s?.position);
    const key = `${name}(${pos})`;
    if (seenSs.has(key)) continue;
    seenSs.add(key);
    keyShensha.push(key);
    if (keyShensha.length >= 8) break;
  }

  const patternRelBlock = extractNamedPromptBlock(promptText, /^【格局组合与互制关系】$/u);
  const compactFortuneBlock = extractNamedPromptBlock(
    promptText,
    /^【岁运动态与格局引动（压平精要）】$/u,
  );

  const lines = [
    `四柱：${pillarStr}`,
    `格局与用神：${strength} · 主格「${pattern || ordPattern}」；主用${usefulMain || '待定'}，喜[${fav || '中和'}]，忌[${unfav || '偏颇'}]${climateFav ? `（调候参考：${climateFav}）` : ''}`,
    keyShensha.length > 0 ? `▸ 核心神煞（精选）：${keyShensha.join('、')}` : '',
    patternRelBlock ? `▸ 格局互制：\n${patternRelBlock}` : '',
    compactFortuneBlock ? `▸ 岁运精要：\n${compactFortuneBlock}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

const CORE_ZIWEI_MINOR_SET = new Set([
  '左辅',
  '右弼',
  '文昌',
  '文曲',
  '天魁',
  '天钺',
  '禄存',
  '天马',
  '擎羊',
  '陀罗',
  '火星',
  '铃星',
  '地空',
  '地劫',
]);

function buildZiweiEvidenceCard(entry: HecanComputedEntry): string {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';
  if (!data) return '';

  if ('unknown' in data) {
    const candidates = asArr(asRec(data.unknown)?.candidates).map(asRec);
    const rows = candidates.slice(0, 6).map((c, idx) => {
      const natal = asRec(asRec(c?.chart)?.natal);
      const palaces = asArr(natal?.palaces).map(asRec);
      const ming = palaces.find((p) => p?.name === '命宫');
      const majors = asArr(ming?.majorStars).map(formatZiweiStarCompact).filter(Boolean).join('、');
      return `候选${idx + 1}：命宫${asStr(natal?.soulBranch)}（${majors || '空宫'}）· 身宫${asStr(natal?.bodyBranch)} · ${asStr(natal?.fiveElementsClass)}`;
    });
    return [`未知时辰紫微候选（共 ${candidates.length} 盘）：`, ...rows].join('\n');
  }

  const natal = asRec(data.natal);
  if (!natal) return '';
  const palaces = asArr(natal.palaces).map(asRec);
  const formatPalaceLine = (p: Record<string, unknown> | undefined) => {
    if (!p) return '';
    const majors = asArr(p.majorStars).map(formatZiweiStarCompact).filter(Boolean);
    const minors = asArr(p.minorStars)
      .filter((s) => CORE_ZIWEI_MINOR_SET.has(asStr(asRec(s)?.name)))
      .map(formatZiweiStarCompact)
      .filter(Boolean);
    let majorStr = majors.join('、');
    if (!majorStr) {
      const idx = typeof p.index === 'number' ? p.index : -1;
      const opp = idx >= 0 ? palaces[(idx + 6) % 12] : undefined;
      const oppMajors = asArr(opp?.majorStars).map(formatZiweiStarCompact).filter(Boolean).join('、');
      majorStr = oppMajors ? `空宫(借${asStr(opp?.name)}:${oppMajors})` : '空宫';
    }
    const bodyTag = p.isBodyPalace ? '·身' : '';
    const minorStr = minors.length ? `｜辅煞:${minors.join('、')}` : '';
    return `${asStr(p.name)}(${asStr(p.heavenlyStem)}${asStr(p.earthlyBranch)}${bodyTag})：${majorStr}${minorStr}`;
  };

  const palaceLines = palaces.map(formatPalaceLine).filter(Boolean);
  const patterns = asArr(natal.patterns)
    .map((pt) => asStr(asRec(pt)?.name))
    .filter(Boolean);
  const patternBalance = extractNamedPromptBlock(promptText, /^【格局叠合与成败制衡关系】$/u);
  const flowCompact = extractNamedPromptBlock(
    promptText,
    /^【运限动态与流年四化（压平精要）】$/u,
  );
  const stackMutagens = extractNamedPromptBlock(
    promptText,
    /^【三代四化叠宫引动（本命×大限×流年）】$/u,
  );

  const lines = [
    `命身局：命宫${asStr(natal.soulBranch)}、身宫${asStr(natal.bodyBranch)}、命主${asStr(natal.soul)}、身主${asStr(natal.body)}、${asStr(natal.fiveElementsClass)}`,
    patterns.length ? `命中格局：${patterns.slice(0, 8).join('、')}` : '',
    `▸ 十二宫核心星曜（主星+六吉六煞禄马）：\n${palaceLines.join('\n')}`,
    patternBalance ? `▸ 格局制衡：\n${patternBalance}` : '',
    flowCompact ? `▸ 运限精要：\n${flowCompact}` : '',
    stackMutagens
      ? `▸ 三代四化叠宫：\n${stackMutagens.split('\n').slice(0, 5).join('\n')}`
      : '',
  ];
  return lines.filter(Boolean).join('\n');
}

const MAIN_ASTRO_POINT_IDS = new Set([
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'true_node',
  'chiron',
]);

function buildAstrolabeEvidenceCard(entry: HecanComputedEntry): string {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';
  if (!data) return '';

  const basis = asRec(data.basis);
  const hsKey = asStr(basis?.houseSystem);
  const hsLabel = ASTRO_HOUSE_SYSTEM_LABELS[hsKey.toLowerCase()] ?? hsKey;

  const points = asArr(data.points).map(asRec);
  const angles = asArr(data.angles).map(asRec);
  const idToName = new Map<string, string>();
  for (const p of points) {
    if (asStr(p?.id) && asStr(p?.name)) idToName.set(asStr(p?.id), asStr(p?.name));
  }
  for (const a of angles) {
    if (asStr(a?.id) && asStr(a?.name)) idToName.set(asStr(a?.id), asStr(a?.name));
  }

  const angleText = angles
    .filter((a) => ['asc', 'mc', 'desc', 'ic'].includes(asStr(a?.id)))
    .map((a) => `${asStr(a?.name)}${asStr(a?.sign)}${Math.round(Number(a?.degreeInSign ?? 0))}°`)
    .join('、');

  const pointText = points
    .filter((p) => MAIN_ASTRO_POINT_IDS.has(asStr(p?.id)))
    .map((p) => {
      const deg = Math.round(Number(p?.degreeInSign ?? 0));
      const retro = p?.retrograde ? '逆' : '';
      const dig = asArr(p?.dignities).filter((x): x is string => typeof x === 'string').join('');
      const suffix = [retro, dig].filter(Boolean).join('·');
      return `${asStr(p?.name)}:${asStr(p?.sign)}${deg}°(${String(p?.house ?? '?')}宫${suffix ? `·${suffix}` : ''})`;
    })
    .join('；');

  const validAspectIds = new Set([...MAIN_ASTRO_POINT_IDS, 'asc', 'mc']);
  const aspects = asArr(data.aspects)
    .map(asRec)
    .filter((a) => validAspectIds.has(asStr(a?.first)) && validAspectIds.has(asStr(a?.second)))
    .sort((a, b) => Number(a?.deviation ?? 99) - Number(b?.deviation ?? 99))
    .slice(0, 12)
    .map((a) => {
      const n1 = idToName.get(asStr(a?.first)) ?? asStr(a?.first);
      const n2 = idToName.get(asStr(a?.second)) ?? asStr(a?.second);
      const dev = Number(a?.deviation ?? 0).toFixed(1);
      return `${n1}${asStr(a?.name)}${n2}(${dev}°)`;
    });

  const patternBalance = extractNamedPromptBlock(promptText, /^【相位格局与能量制衡关系】$/u);
  const compactProfection = extractNamedPromptBlock(
    promptText,
    /^【小限与年运窗口（压平精要）】$/u,
  );
  const flowBlock = extractNamedPromptBlock(promptText, /^【推运|【行运/u);

  const lines = [
    `宫位制：${hsLabel || '普拉西度'}｜四轴：${angleText}`,
    `星体落宫：${pointText}`,
    aspects.length ? `▸ 紧密主相位（前${aspects.length}条）：${aspects.join('；')}` : '',
    patternBalance ? `▸ 相位格局与制衡：\n${patternBalance}` : '',
    compactProfection ? `▸ 小限与年运精要：\n${compactProfection}` : '',
    flowBlock ? `▸ 流年推运切片：\n${flowBlock.split('\n').slice(0, 4).join('\n')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildQizhengEvidenceCard(entry: HecanComputedEntry): string {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';
  if (!data) return '';

  const twelve = asArr(data.twelvePalaces).map(asRec);
  const mingBranch = asStr(twelve.find((p) => p?.palace === '命宫')?.signBranch);
  const shenBranch = asStr(twelve.find((p) => p?.palace === '身宫')?.signBranch);
  const mingDu = asRec(data.mingDu);
  const enNan = asRec(data.enNan);

  const stars = asArr(data.stars)
    .map(asRec)
    .map((s) => {
      const retro = s?.retrograde ? '·逆' : '';
      return `${asStr(s?.name)}:${asStr(s?.xiu)}宿·${asStr(s?.signBranch)}${asStr(s?.palace)}(${asStr(s?.dignity)}${retro})`;
    })
    .join('；');

  const aspects = asArr(data.aspects)
    .map(asRec)
    .sort((a, b) => Number(a?.orb ?? 99) - Number(b?.orb ?? 99))
    .slice(0, 8)
    .map((a) => `${asStr(a?.star1)}与${asStr(a?.star2)}${asStr(a?.type)}(${Number(a?.orb ?? 0).toFixed(1)}°)`);

  const enNanLine = enNan
    ? `${asStr(enNan.sect)}（${asStr(enNan.sectSummary)}）｜恩:${asArr(enNan.enStars).join('、')}｜用:${asArr(enNan.yongStars).join('、')}｜仇:${asArr(enNan.chouStars).join('、')}｜难:${asArr(enNan.nanStars).join('、')}`
    : '';

  const enNanBalance = extractNamedPromptBlock(promptText, /^【恩用仇难与星曜制衡关系】$/u);
  const compactLimits = extractNamedPromptBlock(promptText, /^【行限与流年小限（压平精要）】$/u);

  const lines = [
    `命度：命宫${mingBranch}、身宫${shenBranch}、命主${asStr(data.mingZhu)}、度主${asStr(mingDu?.duZhu)}（${asStr(mingDu?.xiu)}宿）`,
    enNanLine ? `恩难仇用：${enNanLine}` : '',
    `十一星落宫：${stars}`,
    aspects.length ? `▸ 紧密吊照：${aspects.join('；')}` : '',
    enNanBalance ? `▸ 星曜制衡：\n${enNanBalance}` : '',
    compactLimits ? `▸ 行限与小限精要：\n${compactLimits}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildQimenEvidenceCard(entry: HecanComputedEntry): string {
  const data = asRec(entry.result.data);
  const promptText = entry.result.prompt?.text ?? '';
  if (!data) return '';

  const base = asRec(data.baseChart);
  if (!base) return '';
  const dun = `${base.isYangDun ? '阳遁' : '阴遁'}${String(base.juShu ?? '')}局`;
  const zhiFu = asStr(base.zhiFu);
  const zhiShi = asStr(base.zhiShi);
  const horse = asStr(asRec(base.horseStar)?.palaceName) || asStr(base.horseStar);
  const voidPalaces = asArr(base.voidPalaces).join('、');
  const jiuGong = asArr(base.jiuGongGe).map(asRec);
  const gongNameByNum = new Map<number, string>();
  for (const g of jiuGong) {
    if (typeof g?.gong === 'number') gongNameByNum.set(g.gong, asStr(g.name));
  }

  const markers = asArr(data.personalMarkers)
    .map(asRec)
    .map((m) => `${asStr(m?.palaceName)}（${asStr(m?.value)}）：${asStr(m?.traditionalSignificance)}`)
    .slice(0, 6);

  const topics = asArr(data.topicCandidates)
    .map(asRec)
    .slice(0, 5)
    .map((t) => {
      const pNames = asArr(t?.primaryPalaces)
        .map((n) => (typeof n === 'number' ? gongNameByNum.get(n) ?? `${n}宫` : String(n)))
        .join('、');
      return `${asStr(t?.topicName)}→主宫[${pNames}]`;
    });

  const patternBalance = extractNamedPromptBlock(
    promptText,
    /^【格局叠加与吉凶制衡关系】$/u,
  );
  const compactStages = extractNamedPromptBlock(
    promptText,
    /^【阶段运限与流年落宫（压平精要）】$/u,
  );

  const lines = [
    `局象：${dun} · 值符${zhiFu} · 值使${zhiShi}${horse ? ` · 马星${horse}` : ''}${voidPalaces ? ` · 空亡${voidPalaces}` : ''}`,
    markers.length ? `▸ 个人标记：\n${markers.join('\n')}` : '',
    topics.length ? `▸ 事项用神落宫：${topics.join('｜')}` : '',
    patternBalance ? `▸ 格局与制衡：\n${patternBalance}` : '',
    compactStages ? `▸ 阶段运限精要：\n${compactStages}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function buildEvidenceCard(
  id: HecanSystemId,
  entry: HecanComputedEntry,
): string {
  switch (id) {
    case 'bazi':
      return buildBaziEvidenceCard(entry);
    case 'ziwei':
      return buildZiweiEvidenceCard(entry);
    case 'astrolabe':
      return buildAstrolabeEvidenceCard(entry);
    case 'qizheng':
      return buildQizhengEvidenceCard(entry);
    case 'qimen-lifetime':
      return buildQimenEvidenceCard(entry);
  }
}

interface AxisRow {
  id: 'personality' | 'career' | 'relationship' | 'timing';
  title: string;
  entries: string[];
}

function buildCrossTopicMatrix(
  computedSystems: readonly HecanSystemId[],
  computedMap: Partial<Record<HecanSystemId, HecanComputedEntry>>,
  topic: QuestionTopic,
): string {
  if (computedSystems.length < 2) return '';

  const baziData = asRec(computedMap.bazi?.result.data);
  const baziChart = asRec(baziData?.chart);
  const ziweiData = asRec(computedMap.ziwei?.result.data);
  const ziweiExact = ziweiData && !('unknown' in ziweiData) ? ziweiData : undefined;
  const astroData = asRec(computedMap.astrolabe?.result.data);
  const qizhengData = asRec(computedMap.qizheng?.result.data);
  const qimenData = asRec(computedMap['qimen-lifetime']?.result.data);

  const ziweiPalaces = asArr(asRec(ziweiExact?.natal)?.palaces).map(asRec);
  const getZiweiPalaceSummary = (name: string) => {
    const p = ziweiPalaces.find((x) => x?.name === name);
    if (!p) return '';
    const majors = asArr(p.majorStars).map(formatZiweiStarCompact).filter(Boolean);
    if (majors.length > 0) return majors.join('、');
    const idx = typeof p.index === 'number' ? p.index : -1;
    const opp = idx >= 0 ? ziweiPalaces[(idx + 6) % 12] : undefined;
    const oppMajors = asArr(opp?.majorStars).map(formatZiweiStarCompact).filter(Boolean);
    return oppMajors.length ? `空宫借${asStr(opp?.name)}[${oppMajors.join('、')}]` : '空宫';
  };

  const astroPoints = asArr(astroData?.points).map(asRec);
  const astroAngles = asArr(astroData?.angles).map(asRec);
  const qzTwelve = asArr(qizhengData?.twelvePalaces).map(asRec);
  const qzStars = asArr(qizhengData?.stars).map(asRec);
  const qimenBase = asRec(qimenData?.baseChart);
  const qimenGongMap = new Map<number, string>();
  for (const g of asArr(qimenBase?.jiuGongGe).map(asRec)) {
    if (typeof g?.gong === 'number') qimenGongMap.set(g.gong, asStr(g.name));
  }
  const qimenTopics = asArr(qimenData?.topicCandidates).map(asRec);

  // 1. 本命底色
  const pEntries: string[] = [];
  if (computedMap.bazi) {
    if (baziChart) {
      const day = asRec(asRec(baziChart.pillars)?.day);
      const fav = asArr(asRec(baziChart.usefulGod)?.favorableWuxing).join('、') || '中和';
      pEntries.push(
        `八字[${asStr(day?.gan)}${asStr(day?.stemElement)}日主·${asStr(asRec(baziChart.strength)?.status)}·${asStr(asRec(baziChart.patternOverview)?.pattern)}·喜${fav}]`,
      );
    } else {
      pEntries.push('八字[未知/区间时辰候选]');
    }
  }
  if (computedMap.ziwei) {
    if (ziweiExact) {
      const natal = asRec(ziweiExact.natal);
      const pts = asArr(natal?.patterns).slice(0, 2).map((pt) => asStr(asRec(pt)?.name)).filter(Boolean);
      pEntries.push(
        `紫微[命宫${asStr(natal?.soulBranch)}:${getZiweiPalaceSummary('命宫')}·身宫${asStr(natal?.bodyBranch)}${pts.length ? `·${pts.join('/')}` : ''}]`,
      );
    } else {
      pEntries.push('紫微[多候选时辰]');
    }
  }
  if (astroData) {
    const sun = asStr(astroPoints.find((p) => p?.id === 'sun')?.sign);
    const moon = asStr(astroPoints.find((p) => p?.id === 'moon')?.sign);
    const asc = asStr(astroAngles.find((a) => a?.id === 'asc')?.sign);
    const ptLabels = asArr(astroData.patterns).slice(0, 2).map((pt) => asStr(asRec(pt)?.label)).filter(Boolean);
    pEntries.push(`星盘[日${sun}·月${moon}·升${asc}${ptLabels.length ? `·${ptLabels.join('/')}` : ''}]`);
  }
  if (qizhengData) {
    const mingBr = asStr(qzTwelve.find((p) => p?.palace === '命宫')?.signBranch);
    const enNan = asRec(qizhengData.enNan);
    pEntries.push(
      `七政[命${mingBr}·命主${asStr(qizhengData.mingZhu)}·度主${asStr(asRec(qizhengData.mingDu)?.duZhu)}·${asStr(enNan?.sect)}]`,
    );
  }
  if (qimenBase) {
    pEntries.push(
      `奇门[${qimenBase.isYangDun ? '阳遁' : '阴遁'}${String(qimenBase.juShu ?? '')}局·符${asStr(qimenBase.zhiFu)}·使${asStr(qimenBase.zhiShi)}]`,
    );
  }

  // 2. 事业与财富
  const cEntries: string[] = [];
  if (computedMap.bazi && baziChart) {
    const pillars = asRec(baziChart.pillars);
    cEntries.push(
      `八字[月${asStr(asRec(pillars?.month)?.tenGod)}/时${asStr(asRec(pillars?.hour)?.tenGod)}·主用${asStr(asRec(baziChart.usefulGod)?.useful)}]`,
    );
  }
  if (ziweiExact) {
    cEntries.push(`紫微[官(${getZiweiPalaceSummary('官禄')})/财(${getZiweiPalaceSummary('财帛')})]`);
  }
  if (astroData) {
    const mc = asStr(astroAngles.find((a) => a?.id === 'mc')?.sign);
    const p10 = astroPoints.filter((p) => p?.house === 10).map((p) => asStr(p?.name)).filter(Boolean).join('、');
    const p2 = astroPoints.filter((p) => p?.house === 2).map((p) => asStr(p?.name)).filter(Boolean).join('、');
    cEntries.push(`星盘[天顶${mc}${p10 ? `·10宫(${p10})` : ''}${p2 ? `·2宫(${p2})` : ''}]`);
  }
  if (qizhengData) {
    const gStars = qzStars.filter((s) => s?.palace === '官禄').map((s) => `${asStr(s?.name)}(${asStr(s?.dignity)})`).join('、');
    const cStars = qzStars.filter((s) => s?.palace === '财帛').map((s) => `${asStr(s?.name)}(${asStr(s?.dignity)})`).join('、');
    cEntries.push(`七政[官(${gStars || '无主星'})/财(${cStars || '无主星'})]`);
  }
  if (qimenData) {
    const careerTc = qimenTopics.find((t) => t?.topic === 'career');
    const wealthTc = qimenTopics.find((t) => t?.topic === 'wealth');
    const cPal = asArr(careerTc?.primaryPalaces).map((n) => (typeof n === 'number' ? qimenGongMap.get(n) ?? `${n}宫` : String(n))).join('/');
    const wPal = asArr(wealthTc?.primaryPalaces).map((n) => (typeof n === 'number' ? qimenGongMap.get(n) ?? `${n}宫` : String(n))).join('/');
    if (cPal || wPal) cEntries.push(`奇门[事业${cPal || '-'}/资产${wPal || '-'}]`);
  }

  // 3. 感情与人际
  const rEntries: string[] = [];
  if (computedMap.bazi && baziChart) {
    const day = asRec(asRec(baziChart.pillars)?.day);
    const hidden = asArr(day?.hiddenStems).map((h) => `${asStr(asRec(h)?.stem)}${asStr(asRec(h)?.tenGod)}`).join('、');
    rEntries.push(`八字[日支${asStr(day?.zhi)}(${hidden || '-'})]`);
  }
  if (ziweiExact) {
    rEntries.push(`紫微[夫妻(${getZiweiPalaceSummary('夫妻')})/福德(${getZiweiPalaceSummary('福德')})]`);
  }
  if (astroData) {
    const desc = asStr(astroAngles.find((a) => a?.id === 'desc')?.sign);
    const venus = astroPoints.find((p) => p?.id === 'venus');
    const p7 = astroPoints.filter((p) => p?.house === 7).map((p) => asStr(p?.name)).filter(Boolean).join('、');
    rEntries.push(
      `星盘[下降${desc}·金星${asStr(venus?.sign)}(${String(venus?.house ?? '?')}宫)${p7 ? `·7宫(${p7})` : ''}]`,
    );
  }
  if (qizhengData) {
    const qStars = qzStars.filter((s) => s?.palace === '妻妾').map((s) => `${asStr(s?.name)}(${asStr(s?.dignity)})`).join('、');
    rEntries.push(`七政[妻妾(${qStars || '无主星'})]`);
  }
  if (qimenData) {
    const mTc = qimenTopics.find((t) => t?.topic === 'marriage');
    const mPal = asArr(mTc?.primaryPalaces).map((n) => (typeof n === 'number' ? qimenGongMap.get(n) ?? `${n}宫` : String(n))).join('/');
    if (mPal) rEntries.push(`奇门[婚恋${mPal}]`);
  }

  // 4. 岁运与阶段节奏
  const tEntries: string[] = [];
  for (const id of computedSystems) {
    const entry = computedMap[id];
    if (!entry) continue;
    const line = extractCompactTimingLine(id, entry);
    if (line) {
      const short = HECAN_SYSTEM_MAP.get(id)?.shortLabel ?? id;
      tEntries.push(`${short}[${line}]`);
    }
  }

  const rawRows: AxisRow[] = [
    { id: 'personality', title: '本命底色', entries: pEntries },
    { id: 'career', title: '事业财富', entries: cEntries },
    { id: 'relationship', title: '感情人际', entries: rEntries },
    { id: 'timing', title: '岁运节奏', entries: tEntries },
  ];
  const allRows = rawRows.filter((row) => row.entries.length >= 2);

  if (allRows.length === 0) return '';

  // 将贴合当前问题的维度置顶
  const preferredId: AxisRow['id'] =
    topic === 'shiye' || topic === 'caifu'
      ? 'career'
      : topic === 'ganqing'
        ? 'relationship'
        : 'personality';
  const orderedRows = [
    ...allRows.filter((r) => r.id === preferredId),
    ...allRows.filter((r) => r.id !== preferredId),
  ];

  return `【跨体系主题矩阵】\n${orderedRows.map((r) => `- ${r.title}：${r.entries.join(' ｜ ')}`).join('\n')}`;
}

interface AxisVote {
  system: string;
  polarity: 'active' | 'steady' | 'tension';
  evidence: string;
}

const ACTIVE_ZIWEI_STARS = new Set(['七杀', '破军', '贪狼', '太阳', '武曲', '廉贞', '紫微']);
const STEADY_ZIWEI_STARS = new Set(['天同', '天梁', '太阴', '天府', '天相', '天机']);
const SHA_ZIWEI_STARS = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);
const FIRE_AIR_SIGNS = new Set(['白羊', '狮子', '射手', '双子', '天秤', '水瓶']);
const EARTH_WATER_SIGNS = new Set(['金牛', '处女', '摩羯', '巨蟹', '天蝎', '双鱼']);

function buildMultiHecanResonance(
  computedMap: Partial<Record<HecanSystemId, HecanComputedEntry>>,
): MingluResonanceSummary {
  const driveVotes: AxisVote[] = [];
  const wealthVotes: AxisVote[] = [];
  const relationVotes: AxisVote[] = [];

  // 1. 八字
  const baziChart = asRec(asRec(computedMap.bazi?.result.data)?.chart);
  if (baziChart) {
    const strengthStatus = asStr(asRec(baziChart.strength)?.status);
    const pattern = asStr(asRec(baziChart.patternOverview)?.pattern);
    if (/七杀|伤官|阳刃|羊刃|劫财|偏财|从/.test(pattern) || /偏强|身强|极强/.test(strengthStatus)) {
      driveVotes.push({ system: '八字', polarity: 'active', evidence: `${strengthStatus}/${pattern || '偏外拓'}` });
    } else if (/正印|正官|食神|正财/.test(pattern)) {
      driveVotes.push({ system: '八字', polarity: 'steady', evidence: `${pattern}（偏稳健）` });
    }
    const useful = asStr(asRec(baziChart.usefulGod)?.useful);
    if (useful) {
      wealthVotes.push({
        system: '八字',
        polarity: /财|官|杀|食伤|比劫/.test(useful) ? 'active' : 'steady',
        evidence: `主用${useful}`,
      });
    }
    const dayHidden = asArr(asRec(asRec(baziChart.pillars)?.day)?.hiddenStems)
      .map((h) => asStr(asRec(h)?.tenGod))
      .join('');
    if (/七杀|伤官|劫财/.test(dayHidden)) {
      relationVotes.push({ system: '八字', polarity: 'tension', evidence: `日支藏${dayHidden}（重主见与磨合）` });
    } else if (/正官|正财|正印|食神/.test(dayHidden)) {
      relationVotes.push({ system: '八字', polarity: 'steady', evidence: `日支藏${dayHidden}（偏安稳重情）` });
    }
  }

  // 2. 紫微
  const ziweiData = asRec(computedMap.ziwei?.result.data);
  const ziweiNatal = ziweiData && !('unknown' in ziweiData) ? asRec(ziweiData.natal) : undefined;
  if (ziweiNatal) {
    const palaces = asArr(ziweiNatal.palaces).map(asRec);
    const ming = palaces.find((p) => p?.name === '命宫');
    const cai = palaces.find((p) => p?.name === '财帛');
    const fuqi = palaces.find((p) => p?.name === '夫妻');
    const mingNames = asArr(ming?.majorStars).map((s) => asStr(asRec(s)?.name)).filter(Boolean);
    if (mingNames.some((n) => ACTIVE_ZIWEI_STARS.has(n))) {
      driveVotes.push({ system: '紫微', polarity: 'active', evidence: `命宫${mingNames.join('、')}` });
    } else if (mingNames.some((n) => STEADY_ZIWEI_STARS.has(n))) {
      driveVotes.push({ system: '紫微', polarity: 'steady', evidence: `命宫${mingNames.join('、')}` });
    }
    const caiStars = asArr(cai?.majorStars).map(asRec);
    if (caiStars.some((s) => s?.mutagen === '忌')) {
      wealthVotes.push({ system: '紫微', polarity: 'tension', evidence: '财帛见生年化忌（重风控防耗）' });
    } else if (caiStars.some((s) => s?.mutagen === '禄' || s?.mutagen === '权')) {
      wealthVotes.push({ system: '紫微', polarity: 'active', evidence: '财帛得生年禄/权引动' });
    }
    const fuqiStars = [...asArr(fuqi?.majorStars), ...asArr(fuqi?.minorStars)].map(asRec);
    if (fuqiStars.some((s) => s?.mutagen === '忌' || SHA_ZIWEI_STARS.has(asStr(s?.name)))) {
      relationVotes.push({ system: '紫微', polarity: 'tension', evidence: '夫妻宫带煞忌（重边界与沟通磨合）' });
    } else if (fuqiStars.length > 0) {
      relationVotes.push({ system: '紫微', polarity: 'steady', evidence: '夫妻宫星曜相对平和' });
    }
  }

  // 3. 西洋星盘
  const astro = asRec(computedMap.astrolabe?.result.data);
  if (astro) {
    const pts = asArr(astro.points).map(asRec);
    const angles = asArr(astro.angles).map(asRec);
    const sunSign = asStr(pts.find((p) => p?.id === 'sun')?.sign).replace(/座$/, '');
    const ascSign = asStr(angles.find((a) => a?.id === 'asc')?.sign).replace(/座$/, '');
    const hint = sunSign || ascSign;
    if (FIRE_AIR_SIGNS.has(hint)) {
      driveVotes.push({ system: '星盘', polarity: 'active', evidence: `太阳/上升落${hint}` });
    } else if (EARTH_WATER_SIGNS.has(hint)) {
      driveVotes.push({ system: '星盘', polarity: 'steady', evidence: `太阳/上升落${hint}` });
    }
    const careerPts = pts.filter((p) => p?.house === 10 || p?.house === 2);
    if (careerPts.length >= 2) {
      wealthVotes.push({ system: '星盘', polarity: 'active', evidence: `2/10宫聚星(${careerPts.map((p) => asStr(p?.name)).join('、')})` });
    }
    const venusSign = asStr(pts.find((p) => p?.id === 'venus')?.sign).replace(/座$/, '');
    if (FIRE_AIR_SIGNS.has(venusSign)) {
      relationVotes.push({ system: '星盘', polarity: 'active', evidence: `金星${venusSign}（直接重交流）` });
    } else if (EARTH_WATER_SIGNS.has(venusSign)) {
      relationVotes.push({ system: '星盘', polarity: 'steady', evidence: `金星${venusSign}（慢热重安全感）` });
    }
  }

  // 4. 七政四余
  const qizheng = asRec(computedMap.qizheng?.result.data);
  if (qizheng) {
    const stars = asArr(qizheng.stars).map(asRec);
    const enNan = asRec(qizheng.enNan);
    const enSet = new Set(asArr(enNan?.enStars).concat(asArr(enNan?.yongStars)).map(String));
    const nanSet = new Set(asArr(enNan?.nanStars).concat(asArr(enNan?.chouStars)).map(String));
    const mingZhu = asStr(qizheng.mingZhu);
    const mingStar = stars.find((s) => asStr(s?.key) === mingZhu || asStr(s?.name).startsWith(mingZhu));
    if (mingStar) {
      const dig = asStr(mingStar.dignity);
      if (/庙|旺/.test(dig) && !mingStar.retrograde) {
        driveVotes.push({ system: '七政', polarity: 'active', evidence: `命主${asStr(mingStar.name)}${dig}` });
      } else if (/陷|弱/.test(dig) || mingStar.retrograde) {
        driveVotes.push({ system: '七政', polarity: 'steady', evidence: `命主${asStr(mingStar.name)}${dig}${mingStar.retrograde ? '逆行' : ''}` });
      }
    }
    const careerStars = stars.filter((s) => s?.palace === '官禄' || s?.palace === '财帛');
    if (careerStars.some((s) => enSet.has(asStr(s?.name)))) {
      wealthVotes.push({ system: '七政', polarity: 'active', evidence: '官禄/财帛见恩用星' });
    } else if (careerStars.some((s) => nanSet.has(asStr(s?.name)))) {
      wealthVotes.push({ system: '七政', polarity: 'tension', evidence: '官禄/财帛见难仇星' });
    }
    const wifeStars = stars.filter((s) => s?.palace === '妻妾');
    if (wifeStars.some((s) => nanSet.has(asStr(s?.name)))) {
      relationVotes.push({ system: '七政', polarity: 'tension', evidence: '妻妾宫见难仇星' });
    } else if (wifeStars.some((s) => enSet.has(asStr(s?.name)))) {
      relationVotes.push({ system: '七政', polarity: 'steady', evidence: '妻妾宫得恩用星' });
    }
  }

  // 5. 奇门终身局
  const qimenBase = asRec(asRec(computedMap['qimen-lifetime']?.result.data)?.baseChart);
  if (qimenBase) {
    const zhiShi = asStr(qimenBase.zhiShi);
    if (/开门|生门|休门/.test(zhiShi)) {
      driveVotes.push({ system: '奇门', polarity: 'active', evidence: `值使${zhiShi}` });
    } else if (/杜门|死门|惊门|伤门/.test(zhiShi)) {
      driveVotes.push({ system: '奇门', polarity: 'steady', evidence: `值使${zhiShi}（先稳后动）` });
    }
  }

  const resonances: string[] = [];
  const divergences: string[] = [];

  const summarize = (axisName: string, votes: AxisVote[]) => {
    if (votes.length < 2) return;
    const active = votes.filter((v) => v.polarity === 'active');
    const steady = votes.filter((v) => v.polarity === 'steady');
    const tension = votes.filter((v) => v.polarity === 'tension');

    if (active.length >= 2) {
      resonances.push(
        `[强共振·${axisName}] ${active.map((v) => `${v.system}(${v.evidence})`).join(' ＋ ')} → 多体系共振指向主动外拓、敢于推进。`,
      );
    } else if (steady.length >= 2) {
      resonances.push(
        `[强共振·${axisName}] ${steady.map((v) => `${v.system}(${v.evidence})`).join(' ＋ ')} → 多体系共振指向稳健蓄势、长线深耕。`,
      );
    }
    if ((active.length >= 1 && steady.length >= 1) || ((active.length >= 1 || steady.length >= 1) && tension.length >= 1)) {
      const left = active[0] ?? steady[0]!;
      const right = tension[0] ?? steady[0]!;
      if (left.system !== right.system) {
        divergences.push(
          `[张力核验·${axisName}] ${left.system}(${left.evidence}) vs ${right.system}(${right.evidence}) → 攻守并存，宜结合现实节奏取舍。`,
        );
      }
    }
  };

  summarize('行事动能', driveVotes);
  summarize('财官承压', wealthVotes);
  summarize('关系互动', relationVotes);

  const lines = [...resonances.map((r) => `- ${r}`), ...divergences.map((d) => `- ${d}`)];
  return {
    resonances,
    divergences,
    formattedText: lines.join('\n'),
  };
}

const SYSTEM_TERM_MAP: Record<HecanSystemId, string> = {
  bazi: '八字（干支十神喜忌与岁运）',
  ziwei: '紫微（宫位星曜四化与运限）',
  astrolabe: '西洋星盘（星座宫位相位与行运）',
  qizheng: '七政四余（星宿恩难与行限）',
  'qimen-lifetime': '奇门终身局（九宫门星神与阶段）',
};

function buildMultiHecanTopicFocus(
  topic: QuestionTopic,
  computedSystems: readonly HecanSystemId[],
): string {
  if (topic === 'general') return '';
  const has = (id: HecanSystemId) => computedSystems.includes(id);
  const hints: string[] = [];

  switch (topic) {
    case 'shiye':
      if (has('bazi')) hints.push('八字月令格局与官印食伤');
      if (has('ziwei')) hints.push('紫微官禄/命宫三方四正');
      if (has('astrolabe')) hints.push('星盘天顶与10宫星象');
      if (has('qizheng')) hints.push('七政官禄宫与恩用星');
      if (has('qimen-lifetime')) hints.push('奇门开门与事业候选宫');
      return `事业焦点：围绕${hints.join('、')}跨盘印证适配方向、发力窗口与阻力。`;
    case 'caifu':
      if (has('bazi')) hints.push('八字财星食伤与用忌');
      if (has('ziwei')) hints.push('紫微财帛/田宅与禄忌');
      if (has('astrolabe')) hints.push('星盘2宫/8宫与木土金相位');
      if (has('qizheng')) hints.push('七政财帛宫与恩难制衡');
      if (has('qimen-lifetime')) hints.push('奇门生门与资产候选宫');
      return `财运焦点：围绕${hints.join('、')}跨盘对照生财通道与风控边界。`;
    case 'ganqing':
      if (has('bazi')) hints.push('八字日支夫妻宫与配偶星');
      if (has('ziwei')) hints.push('紫微夫妻/福德宫星曜四化');
      if (has('astrolabe')) hints.push('星盘下降点/金火月与7宫');
      if (has('qizheng')) hints.push('七政妻妾宫与恩难交会');
      if (has('qimen-lifetime')) hints.push('奇门婚恋候选宫');
      return `感情焦点：围绕${hints.join('、')}跨盘研判关系底色、磨合卡点与改善关键。`;
    case 'guaishen':
      return '身心焦点：跨盘对照体质偏枯、压力源与作息情绪调养节点（仅作生活参考，不替代就医）。';
    case 'house':
      return '居所置业焦点：跨盘对照安居稳定度、搬迁时机与空间方位取舍。';
    case 'academic':
      return '学业考运焦点：跨盘对照思维表达、专注力与阶段考运发力点。';
    default:
      return '';
  }
}

function buildMultiHecanContract(params: {
  computedSystems: readonly HecanSystemId[];
  question: string;
  flowYear: number | null;
}): string {
  const { computedSystems, question, flowYear } = params;
  let promptPrefs = {
    enableContract: true,
    replyStyle: 'standard' as 'standard' | 'concise' | 'deep',
    topTaskAnchor: false,
    customFramework: '',
  };
  try {
    const loaded = loadGlobalRules().prompt;
    promptPrefs = {
      enableContract: loaded.enableContract ?? true,
      replyStyle: loaded.replyStyle ?? 'standard',
      topTaskAnchor: loaded.topTaskAnchor ?? false,
      customFramework: loaded.customFramework?.trim() ?? '',
    };
  } catch {}

  if (!promptPrefs.enableContract) {
    return promptPrefs.customFramework
      ? `【用户自定义规则框架】\n${promptPrefs.customFramework}`
      : '';
  }

  const termRules = computedSystems.map((id) => SYSTEM_TERM_MAP[id]).join('、');
  const topic = question ? parseQuestionContext(question).inferredTopic : 'general';
  const topicFocus = buildMultiHecanTopicFocus(topic, computedSystems);

  const isMulti = computedSystems.length >= 2;
  const outputFormat = isMulti
    ? promptPrefs.replyStyle === 'concise'
      ? '输出格式：① 一句话共振核心结论 → ② 跨体系关键同向依据与分歧点（3条内） → ③ 直接可执行建议。'
      : '输出格式：① 共振主线结论（先直给多体系一致指向的核心判断，标明哪几套术数互相印证）→ ② 分歧与张力拆解（说明体系间差异在现实中的双面表现或触发前提）→ ③ 紧扣问题的深度展开（结合已选术数关键证据讲清机会、阻力与阶段节奏）→ ④ 落地行动建议（2–3 条具体可执行建议）。'
    : '输出格式：① 一句话明确结论 → ② 2–4 条核心盘面依据 → ③ 机会、阻力与关键节点 → ④ 具体可落地的行动建议。';

  const rules = [
    '直面推演，拒绝敷衍：直接按已选术数逻辑给出明确判断，不要以“AI 不能算命/无法预测”推脱，不堆砌免责空话。',
    '严禁重算与补造：所有盘面与共振信号已由引擎算定，禁止重算、篡改或脑补未选/未列出的术数。',
    `术语独立不串味：本次仅涉及 ${termRules}；各体系按自身术语独立阐释，再做跨盘对照，用大白话直译结论。`,
    ...(topicFocus ? [topicFocus] : []),
    ...(flowYear ? [`时间基准：本次重点参照 ${flowYear}（${getYearSixtyCycle(flowYear)}）年流运切片。`] : []),
    outputFormat,
  ];

  const sections = [
    `【解读与交付契约】\n${rules.map((line, i) => `${i + 1}. ${line}`).join('\n')}`,
  ];
  if (promptPrefs.customFramework) {
    sections.push(`【用户自定义规则框架】\n${promptPrefs.customFramework}`);
  }
  return sections.join('\n\n');
}

function buildTopTaskAnchorIfNeeded(question: string, flowYear: number | null): string {
  try {
    const loaded = loadGlobalRules().prompt;
    if (!loaded.topTaskAnchor) return '';
  } catch {
    return '';
  }
  const baseYear = flowYear ?? new Date().getFullYear();
  const clean = question.replace(/\s+/g, ' ').trim();
  const focus =
    clean && clean !== '问题'
      ? `请紧扣用户问题“${clean.slice(0, 60)}${clean.length > 60 ? '…' : ''}”直接合参作答；`
      : '请紧扣文末用户问题直接合参作答；';
  return `【顶部任务锚点】\n${focus}（时间基准：${baseYear}年为${getYearSixtyCycle(baseYear)}年，${baseYear + 1}年为${getYearSixtyCycle(baseYear + 1)}年）下方已整理好跨体系共振矩阵与精要证据，严禁自行重算或脑补未选术数。`;
}

export function assembleMultiHecanResult(params: {
  person: PersonalCase;
  selectedSystems: readonly HecanSystemId[];
  computedMap: Partial<Record<HecanSystemId, HecanComputedEntry>>;
  omitted: HecanOmittedEntry[];
  question: string;
  options?: {
    flowYear?: number | null;
    includeClassics?: boolean;
  };
}): MultiHecanResult {
  const { person, computedMap, omitted, options } = params;
  const selectedSystems = normalizeHecanSystems(params.selectedSystems);
  const computedSystems = selectedSystems.filter((id) => Boolean(computedMap[id]));
  const flowYear = options?.flowYear ?? null;
  const cleanQuestion =
    params.question.trim() || '请综合所选术数盘面，提炼跨体系共振主线、分歧要点与阶段建议。';

  const anchors: Partial<Record<HecanSystemId, string>> = {};
  for (const id of computedSystems) {
    anchors[id] = extractHecanAnchor(id, computedMap[id]!.result.data);
  }

  const baziChart = asRec(asRec(computedMap.bazi?.result.data)?.chart);
  const ziweiData = asRec(computedMap.ziwei?.result.data);
  const ziweiExact = ziweiData && !('unknown' in ziweiData) ? ziweiData : undefined;

  let corroboration: BaziZiweiCorroborationResult | undefined;
  if (baziChart && ziweiExact) {
    try {
      corroboration = evaluateBaziZiweiCorroboration(
        baziChart as unknown as Parameters<typeof evaluateBaziZiweiCorroboration>[0],
        ziweiExact as unknown as Parameters<typeof evaluateBaziZiweiCorroboration>[1],
      );
    } catch {
      corroboration = undefined;
    }
  }

  const crossResonance =
    computedSystems.length >= 2 ? buildMultiHecanResonance(computedMap) : undefined;

  const selectedLabels = selectedSystems.map((id) => HECAN_SYSTEM_MAP.get(id)?.label ?? id);
  const computedLabels = computedSystems.map((id) => HECAN_SYSTEM_MAP.get(id)?.label ?? id);
  const genderText =
    person.gender === 'male' ? '乾造（男）' : person.gender === 'female' ? '坤造（女）' : '未指定';

  // Layer 1: 命主基准与合参范围（只列一次，杜绝重复生辰头部）
  const layer1Lines = [
    `性别：${genderText}；出生：${formatBirthSummaryLine(person)}`,
    [
      `已选体系（共 ${computedSystems.length} 套）：${computedLabels.join('、') || '无'}`,
      flowYear ? `参考流年：${flowYear} 年` : '',
    ]
      .filter(Boolean)
      .join('；'),
    omitted.length > 0
      ? `未纳入：${omitted.map((o) => `${o.label}（${o.reason}）`).join('、')}`
      : '',
  ].filter(Boolean);
  const layer1 = `【命主基准与合参范围】\n${layer1Lines.join('\n')}`;

  // Layer 2: 跨体系主题矩阵
  const topic = parseQuestionContext(cleanQuestion).inferredTopic;
  const layer2 = buildCrossTopicMatrix(computedSystems, computedMap, topic);

  // Layer 3: 跨体系共振与分歧预筛
  const layer3Parts: string[] = [];
  if (computedSystems.length >= 2) {
    if (crossResonance?.formattedText) {
      layer3Parts.push(crossResonance.formattedText);
    }
    if (corroboration) {
      layer3Parts.push(formatCorroborationSection(corroboration));
      const bal = corroboration.crossSystemBalance;
      const sigLines = [
        ...bal.resonances.map(
          (item) => `- [八字×紫微同向·${item.topic}] ${item.baziSignal}｜${item.ziweiSignal}`,
        ),
        ...bal.tensions.map(
          (item) => `- [八字×紫微张力·${item.topic}] ${item.baziSignal}｜${item.ziweiSignal}`,
        ),
      ];
      if (sigLines.length > 0) {
        layer3Parts.push(sigLines.join('\n'));
      }
    }
  }
  const layer3 =
    layer3Parts.length > 0 ? `【跨体系共振与分歧预筛】\n${layer3Parts.join('\n')}` : '';

  // Layer 4: 各体系精要证据卡
  const layer4Cards = computedSystems
    .map((id, idx) => {
      const num = CN_NUMERALS[idx] ?? String(idx + 1);
      const label = HECAN_SYSTEM_MAP.get(id)?.label ?? id;
      const body = buildEvidenceCard(id, computedMap[id]!);
      if (!body) return '';
      return `【${num}、${label}精要】\n${body}`;
    })
    .filter(Boolean);

  // 可选：典籍参考合并去重
  let classicsSection = '';
  if (options?.includeClassics) {
    const seenClassics = new Set<string>();
    const classicLines: string[] = [];
    for (const id of computedSystems) {
      const raw = computedMap[id]?.result.prompt?.text ?? '';
      const block = extractNamedPromptBlock(raw, /^【典籍片段】$/u);
      if (!block) continue;
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || seenClassics.has(trimmed)) continue;
        seenClassics.add(trimmed);
        classicLines.push(trimmed);
      }
    }
    if (classicLines.length > 0) {
      classicsSection = `【典籍参考】\n${classicLines.slice(0, 8).join('\n')}`;
    }
  }

  // Layer 5: 问题 + 已选术数定制契约
  const questionSection = `【问题】\n${cleanQuestion}`;
  const contractSection = buildMultiHecanContract({
    computedSystems,
    question: cleanQuestion,
    flowYear,
  });
  const topAnchor = buildTopTaskAnchorIfNeeded(cleanQuestion, flowYear);

  const text = [
    topAnchor,
    layer1,
    layer2,
    layer3,
    ...layer4Cards,
    classicsSection,
    questionSection,
    contractSection,
  ]
    .filter(Boolean)
    .join('\n\n');

  const charts: Partial<Record<HecanSystemId, unknown>> = {};
  for (const id of computedSystems) {
    charts[id] = computedMap[id]!.result.data;
  }

  const titleName =
    computedLabels.length <= 3
      ? `${computedLabels.join('·')}合参`
      : `多术数合参（${computedLabels.length}项）`;

  return {
    currentTime: new Date().toISOString(),
    summary: {
      title: titleName || `多术数合参（${selectedLabels.join('·')}）`,
      tags: computedLabels.length > 0 ? computedLabels : selectedLabels,
      lines: [
        `已纳入 ${computedSystems.length} 项术数：${computedLabels.join('、') || '无'}`,
        ...(omitted.length > 0
          ? [`未计算：${omitted.map((o) => `${o.label}（${o.reason}）`).join('、')}`]
          : []),
      ],
    },
    data: {
      kind: 'multi-hecan',
      selectedSystems,
      computedSystems,
      anchors,
      omitted,
      ...(corroboration ? { corroboration } : {}),
      ...(crossResonance ? { crossResonance } : {}),
      flowYear,
      charts,
    },
    prompt: { text },
  };
}

function buildPersonCacheSignature(person: PersonalCase): string {
  return [
    person.id,
    person.gender,
    person.calendar,
    person.isLeapMonth,
    person.year,
    person.month,
    person.day,
    person.timeIndex,
    person.birthHour,
    person.birthMinute,
    person.birthSecond,
    person.useTrueSolarTime,
    person.birthPlace,
    person.longitude ?? '',
    person.latitude ?? '',
    person.timezone ?? '',
    person.timeZoneId ?? '',
    person.reverseSource
      ? `${person.reverseSource.intervalStart}-${person.reverseSource.intervalEnd}`
      : '',
  ].join(':');
}

export function buildHecanSystemCacheKey(params: {
  person: PersonalCase;
  systemId: HecanSystemId;
  rulesSig?: string;
  includeClassics?: boolean;
  flowYear?: number | null;
}): string {
  const meta = HECAN_SYSTEM_MAP.get(params.systemId);
  const flowPart = meta?.supportsFlowYear ? String(params.flowYear ?? 'default') : 'na';
  const clsPart = NON_CLASSICS_METHODS.has(params.systemId as Method)
    ? '0'
    : params.includeClassics
      ? '1'
      : '0';
  return `${buildPersonCacheSignature(params.person)}::${params.systemId}::${params.rulesSig ?? ''}::cls:${clsPart}::flow:${flowPart}`;
}

export async function runMultiHecan(params: {
  person: PersonalCase;
  selectedSystems: readonly HecanSystemId[];
  question: string;
  options?: {
    flowYear?: number | null;
    includeClassics?: boolean;
    cache?: Map<string, HecanComputedEntry>;
    rulesSig?: string;
    applyGlobalRules?: boolean;
  };
}): Promise<{
  result: MultiHecanResult;
  computedMap: Partial<Record<HecanSystemId, HecanComputedEntry>>;
  omitted: HecanOmittedEntry[];
}> {
  const { person, question, options } = params;
  const selectedSystems = normalizeHecanSystems(params.selectedSystems);
  const flowYear = options?.flowYear ?? null;
  const includeClassics = Boolean(options?.includeClassics);
  const cache = options?.cache;
  const applyRules = options?.applyGlobalRules !== false;

  const computedMap: Partial<Record<HecanSystemId, HecanComputedEntry>> = {};
  const omitted: HecanOmittedEntry[] = [];
  const pendingSystems: HecanSystemId[] = [];

  for (const sysId of selectedSystems) {
    const label = HECAN_SYSTEM_MAP.get(sysId)?.label ?? sysId;
    const avail = getHecanSystemAvailability(person, sysId);
    if (!avail.available) {
      omitted.push({ id: sysId, label, reason: avail.reason ?? '当前资料暂不可算' });
      continue;
    }

    const cacheKey = buildHecanSystemCacheKey({
      person,
      systemId: sysId,
      rulesSig: options?.rulesSig,
      includeClassics,
      flowYear,
    });
    const hit = cache?.get(cacheKey);
    if (hit) {
      computedMap[sysId] = hit;
    } else {
      pendingSystems.push(sysId);
    }
  }

  if (pendingSystems.length > 0) {
    const settled = await Promise.all(
      pendingSystems.map(async (sysId) => {
        const label = HECAN_SYSTEM_MAP.get(sysId)?.label ?? sysId;
        try {
          const rawPayload = buildPersonalChartPayload(person, sysId, question, {
            flowYear,
          });
          const supportsClassics = !NON_CLASSICS_METHODS.has(sysId as Method);
          const withRules = applyRules
            ? (applyGlobalRulesToPayload(sysId as Method, rawPayload, supportsClassics) as Record<
                string,
                unknown
              >)
            : rawPayload;
          const existingPrompt =
            withRules.prompt &&
            typeof withRules.prompt === 'object' &&
            !Array.isArray(withRules.prompt)
              ? (withRules.prompt as Record<string, unknown>)
              : {};
          const finalPayload: Record<string, unknown> = supportsClassics
            ? {
                ...withRules,
                prompt: {
                  ...existingPrompt,
                  includeClassics,
                },
              }
            : withRules;

          const res = (await runCalculateInBackground(sysId as Method, finalPayload, {
            promptGuidance: loadGlobalRules().prompt,
          })) as HecanComputedEntry['result'];
          const entry: HecanComputedEntry = {
            systemId: sysId,
            payload: finalPayload,
            result: res,
          };
          const cacheKey = buildHecanSystemCacheKey({
            person,
            systemId: sysId,
            rulesSig: options?.rulesSig,
            includeClassics,
            flowYear,
          });
          cache?.set(cacheKey, entry);
          return { ok: true as const, sysId, entry };
        } catch (err) {
          return {
            ok: false as const,
            sysId,
            label,
            reason: err instanceof Error ? err.message : '计算失败',
          };
        }
      }),
    );

    for (const item of settled) {
      if (item.ok) {
        computedMap[item.sysId] = item.entry;
      } else {
        omitted.push({ id: item.sysId, label: item.label, reason: item.reason });
      }
    }
  }

  const result = assembleMultiHecanResult({
    person,
    selectedSystems,
    computedMap,
    omitted,
    question,
    options: {
      flowYear,
      includeClassics,
    },
  });

  return { result, computedMap, omitted };
}
