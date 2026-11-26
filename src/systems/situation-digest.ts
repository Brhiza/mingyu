import { getSynastryRelationshipOption, type SynastryRelationship } from './focus-presets';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS, getBranchWuxing, getStemWuxing, isChong, isHe, isKe, isSheng, isXing } from './calendar';
import { getYearSixtyCycle } from './ganzhi-foundation';
import { getBaziQiongtongAdvice } from './classics/bazi-qiongtong';
import { selectQimenClassics } from './classics/qimen';
import { parseQuestionContext } from './question-context';
import { buildPatternRelations } from './bazi/pattern-relations';
import { analyzeZiweiPatternRelations, type ZiweiPattern, type ZiweiPatternPalace } from './ziwei-patterns';
import { analyzeQimenPatternRelations } from './qimen/patterns';
import type { QimenData } from './qimen/types';

function getBeijingYear(timestamp?: number): number {
  const ts = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
  return new Date(ts + 8 * 3_600_000).getUTCFullYear();
}

function getBranchOffset(branch: string, steps: number): string {
  const idx = EARTHLY_BRANCHES.indexOf(branch);
  if (idx < 0) return branch;
  return EARTHLY_BRANCHES[((idx + steps) % 12 + 12) % 12]!;
}

function getStemOffset(stem: string, steps: number): string {
  const idx = HEAVENLY_STEMS.indexOf(stem);
  if (idx < 0) return stem;
  return HEAVENLY_STEMS[((idx + steps) % 10 + 10) % 10]!;
}

/**
 * 计算大六壬 / 金口诀求测人「本命」与「当年行年」地支及盘面乘神落位。
 */
export function buildLiurenLifeYearSection(
  question: string,
  chartTimestamp: number,
  plate: ReadonlyArray<{ groundBranch?: string; heavenBranch?: string; branch?: string; god?: string; general?: string }>,
  voidBranches: readonly string[] = [],
): string {
  const ctx = parseQuestionContext(question);
  if (!ctx.birthYear) return '';

  const birthCycle = getYearSixtyCycle(ctx.birthYear);
  const birthBranch = birthCycle.slice(1, 2);
  const currentYear = getBeijingYear(chartTimestamp);
  const nominalAge = Math.max(1, currentYear - ctx.birthYear + 1);

  const calcMaleXingnian = () => {
    const s = getStemOffset('丙', nominalAge - 1);
    const b = getBranchOffset('寅', nominalAge - 1);
    return `${s}${b}`;
  };
  const calcFemaleXingnian = () => {
    const s = getStemOffset('壬', -(nominalAge - 1));
    const b = getBranchOffset('申', -(nominalAge - 1));
    return `${s}${b}`;
  };

  const describePlateHit = (label: string, targetBranch: string) => {
    const asGround = plate.find(
      (item) => (item.groundBranch ?? item.branch) === targetBranch,
    );
    const asHeaven = plate.find(
      (item) => (item.heavenBranch ?? item.branch) === targetBranch,
    );
    const notes: string[] = [];
    if (asGround) {
      const god = asGround.god ?? asGround.general ?? '';
      const above = asGround.heavenBranch ? `天盘${asGround.heavenBranch}` : '';
      notes.push(`地盘${targetBranch}上见${above}${god ? `乘${god}` : ''}`);
    }
    if (asHeaven) {
      const god = asHeaven.god ?? asHeaven.general ?? '';
      const under = asHeaven.groundBranch ? `临${asHeaven.groundBranch}` : '';
      notes.push(`天盘${targetBranch}${god ? `乘${god}` : ''}${under}`);
    }
    if (voidBranches.includes(targetBranch)) {
      notes.push('落旬空');
    }
    return `${label}（${targetBranch}）：${notes.join('；') || '待结合四课三传参看'}`;
  };

  const lines = [
    `本命年柱：${birthCycle}（虚岁${nominalAge}岁）`,
    describePlateHit('本命落位', birthBranch),
  ];

  if (ctx.gender === '男') {
    const xn = calcMaleXingnian();
    lines.push(`男命行年（1岁丙寅顺行）：${xn}`);
    lines.push(describePlateHit('行年落位', xn.slice(1, 2)));
  } else if (ctx.gender === '女') {
    const xn = calcFemaleXingnian();
    lines.push(`女命行年（1岁壬申逆行）：${xn}`);
    lines.push(describePlateHit('行年落位', xn.slice(1, 2)));
  } else {
    const mxn = calcMaleXingnian();
    const fxn = calcFemaleXingnian();
    lines.push(`行年参考：男命在${mxn}（${mxn.slice(1, 2)}），女命在${fxn}（${fxn.slice(1, 2)}）（补选性别可精准锁定）`);
  }

  return `【本命与行年】\n${lines.join('\n')}`;
}

interface QimenGongLike {
  gong?: number;
  name?: string;
  element?: string;
  palaceNumber?: number;
  palaceName?: string;
  diZhi?: string[];
  tianPan?: { stem?: string; companionStem?: string };
  diPan?: { stem?: string };
  renPan?: { door?: string };
  jiuXing?: { star?: string };
  shenPan?: { god?: string };
  horse?: boolean;
  isVoid?: boolean;
  isEmpty?: boolean;
}

const QIMEN_GONG_ELEMENT: Record<number, string> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
};
const QIMEN_OPPOSITE_GONG: Record<number, number> = {
  1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4,
};

function describeQimenPalacePair(aLabel: string, a: QimenGongLike, bLabel: string, b: QimenGongLike): string {
  const numA = a.gong ?? a.palaceNumber ?? 0;
  const numB = b.gong ?? b.palaceNumber ?? 0;
  if (!numA || !numB) return '';
  if (numA === numB) return `${aLabel}与${bLabel}同落${numA}宫（紧贴联动）`;
  const elA = a.element ?? QIMEN_GONG_ELEMENT[numA] ?? '';
  const elB = b.element ?? QIMEN_GONG_ELEMENT[numB] ?? '';
  const opp = QIMEN_OPPOSITE_GONG[numA] === numB ? '兼对宫相冲' : '';
  const rel =
    elA === elB
      ? `${aLabel}(${elA})与${bLabel}(${elB})比和`
      : isSheng(elA, elB)
        ? `${aLabel}(${elA})生${bLabel}(${elB})（主主动付出或事顺）`
        : isSheng(elB, elA)
          ? `${bLabel}(${elB})生${aLabel}(${elA})（事来就我、得助）`
          : isKe(elA, elB)
            ? `${aLabel}(${elA})克${bLabel}(${elB})（主可掌控但须费力）`
            : `${bLabel}(${elB})克${aLabel}(${elA})（外境/事体施压受阻）`;
  return `${rel}${opp}`;
}

/**
 * 按用户问题与当前背景自动定位奇门遁甲「日干主位 + 时干事体 + 事项核心用神」落宫及其宫间生克链。
 */
export function buildQimenMatterFocusSection(
  question: string,
  gongs: readonly QimenGongLike[],
  voidBranches: readonly string[] = [],
  zhiFu?: string,
  ganzhi?: { day?: string; hour?: string },
): string {
  const ctx = parseQuestionContext(question);
  const intent = ctx.qimenMatterIntent;

  const findByStem = (stem: string | undefined) => {
    if (!stem) return undefined;
    const effective = stem === '甲' ? zhiFu : stem;
    return gongs.find(
      (g) =>
        (g.gong ?? g.palaceNumber) !== 5 &&
        (g.tianPan?.stem === effective || g.tianPan?.companionStem === effective || (stem === '甲' && g.jiuXing?.star === zhiFu)),
    );
  };

  const dayStem = ganzhi?.day?.[0];
  const hourStem = ganzhi?.hour?.[0];
  const dayGong = findByStem(dayStem);
  const hourGong = findByStem(hourStem);

  const targets: Array<{ label: string; test: (g: QimenGongLike) => boolean }> = [];
  if (intent === 'wealth') {
    targets.push({ label: '求财门神（生门）', test: (g) => g.renPan?.door?.includes('生') ?? false });
    targets.push({ label: '资本本金（甲子戊）', test: (g) => g.tianPan?.stem === '戊' || g.tianPan?.companionStem === '戊' });
  } else if (intent === 'career') {
    targets.push({ label: '官禄就业（开门）', test: (g) => g.renPan?.door?.includes('开') ?? false });
    if (zhiFu) {
      targets.push({ label: `上级主事（${zhiFu}）`, test: (g) => g.jiuXing?.star === zhiFu });
    }
  } else if (intent === 'relationship') {
    targets.push({ label: '姻缘媒合（六合）', test: (g) => g.shenPan?.god?.includes('六合') ?? false });
    targets.push({ label: '女方/阴方用神（乙奇）', test: (g) => g.tianPan?.stem === '乙' || g.tianPan?.companionStem === '乙' });
    targets.push({ label: '男方/夫星用神（庚金）', test: (g) => g.tianPan?.stem === '庚' || g.tianPan?.companionStem === '庚' });
  } else if (intent === 'health') {
    targets.push({ label: '病神所在（天芮星）', test: (g) => g.jiuXing?.star?.includes('芮') ?? false });
    targets.push({ label: '良医医药（乙奇）', test: (g) => g.tianPan?.stem === '乙' || g.tianPan?.companionStem === '乙' });
  } else if (intent === 'academic') {
    targets.push({ label: '考试主星（天辅星）', test: (g) => g.jiuXing?.star?.includes('辅') ?? false });
    targets.push({ label: '文书考卷（景门）', test: (g) => g.renPan?.door?.includes('景') ?? false });
  } else if (intent === 'travel') {
    targets.push({ label: '出行主门（开门）', test: (g) => g.renPan?.door?.includes('开') ?? false });
  }

  const formatGongLine = (label: string, gong: QimenGongLike) => {
    const tStem = gong.tianPan?.stem ?? '';
    const dStem = gong.diPan?.stem ?? '';
    const pair = tStem && dStem ? `${tStem}+${dStem}` : '';
    const patternHit = pair ? selectQimenClassics({ stemPairs: [pair] })[0] : undefined;
    const isVoid =
      gong.isVoid ||
      gong.isEmpty ||
      (gong.diZhi?.some((z) => voidBranches.includes(z)) ?? false);
    const tags = [
      gong.shenPan?.god,
      gong.jiuXing?.star,
      gong.renPan?.door,
      pair,
      patternHit ? `【${patternHit.title.replace(/^[^（]+（|）$/gu, '')}】` : '',
      isVoid ? '逢空亡' : '',
      gong.horse ? '带驿马' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const num = gong.gong ?? gong.palaceNumber;
    const pName = gong.name ?? gong.palaceName;
    const palaceDesc = pName ? `落${pName}` : num ? `落${num}宫` : '落宫';
    return `- ${label}${palaceDesc}：${tags}`;
  };

  const lines: string[] = [];
  if (dayGong && dayStem) lines.push(formatGongLine(`求测人/日干（${dayStem}）`, dayGong));
  if (hourGong && hourStem) lines.push(formatGongLine(`事体/时干（${hourStem}）`, hourGong));

  const matchedMatterGongs: Array<{ label: string; gong: QimenGongLike }> = [];
  for (const t of targets) {
    const gong = gongs.find(t.test);
    if (!gong) continue;
    matchedMatterGongs.push({ label: t.label, gong });
    lines.push(formatGongLine(t.label, gong));
  }

  const pairNotes: string[] = [];
  if (dayGong && hourGong) {
    const r = describeQimenPalacePair('日干宫', dayGong, '时干宫', hourGong);
    if (r) pairNotes.push(r);
  }
  if (dayGong && matchedMatterGongs[0]) {
    const r = describeQimenPalacePair('日干宫', dayGong, matchedMatterGongs[0].label.split('（')[0]!, matchedMatterGongs[0].gong);
    if (r) pairNotes.push(r);
  }
  if (pairNotes.length) {
    lines.push(`- 主客与用神生克链：${pairNotes.join('；')}。`);
  }

  if (!lines.length) return '';
  return `【事项用神落宫】\n${lines.join('\n')}`;
}

function normalizeDigestPalaceName(name: string): string {
  const bare = name.endsWith('宫') ? name.slice(0, -1) : name;
  return bare === '仆役' ? '交友' : bare;
}

function summarizeZiweiPatternBalanceLines(natal: Record<string, unknown> | undefined): string[] {
  if (!natal) return [];
  const palaces = natal.palaces as readonly ZiweiPatternPalace[] | undefined;
  const patterns = natal.patterns as readonly ZiweiPattern[] | undefined;
  if (!Array.isArray(palaces) || palaces.length !== 12 || !Array.isArray(patterns)) return [];
  if (!palaces.every((p) => typeof p?.earthlyBranch === 'string' && typeof p?.name === 'string')) return [];
  const rel = analyzeZiweiPatternRelations(palaces, patterns);
  const parts: string[] = [];
  if (rel.damagedAuspicious.length) {
    parts.push(
      `吉格受破：${rel.damagedAuspicious.slice(0, 2).map((d) => `${d.patternName}（${d.breakers.slice(0, 2).join('、')}）`).join('；')}`,
    );
  }
  if (rel.inauspiciousRescues.length) {
    parts.push(
      `凶格/落陷救应：${rel.inauspiciousRescues.slice(0, 2).map((r) => `${r.targetName}→${r.status}`).join('；')}`,
    );
  }
  if (!parts.length && rel.synergies.length) {
    parts.push(`格局协同：${rel.synergies[0]}`);
  }
  return parts;
}

function summarizeBaziPatternBalanceLine(chart: Record<string, unknown> | undefined): string | null {
  if (!chart) return null;
  const pillars = chart.pillars as Record<string, Record<string, unknown>> | undefined;
  const strength = chart.strength as Record<string, unknown> | undefined;
  const overview = chart.patternOverview as { pattern?: string; source?: string } | undefined;
  const ordinary = chart.ordinaryPattern as { candidate?: string } | undefined;
  const usefulGod = chart.usefulGod as Record<string, unknown> | undefined;
  if (
    !pillars?.year?.gan ||
    !pillars?.month?.gan ||
    !pillars?.day?.gan ||
    !pillars?.hour?.gan ||
    !strength?.status ||
    !strength?.tendencies ||
    !overview?.pattern ||
    !overview?.source ||
    !ordinary?.candidate ||
    !usefulGod
  ) {
    return null;
  }
  const rel = buildPatternRelations({
    pillars: pillars as unknown as Parameters<typeof buildPatternRelations>[0]['pillars'],
    strength: strength as unknown as Parameters<typeof buildPatternRelations>[0]['strength'],
    patternOverview: { pattern: overview.pattern, source: overview.source },
    ordinaryPattern: { candidate: ordinary.candidate },
    usefulGod: usefulGod as unknown as Parameters<typeof buildPatternRelations>[0]['usefulGod'],
  });
  const parts: string[] = [];
  if (rel.synergies.length) {
    parts.push(`格局协同：${rel.synergies.slice(0, 2).map((s) => s.name).join('、')}`);
  }
  if (rel.specialPatterns.length) {
    parts.push(
      `兼带外象：${rel.specialPatterns.slice(0, 2).map((sp) => `${sp.name}[${sp.status}]`).join('、')}`,
    );
  }
  if (rel.conflictChains.length) {
    parts.push(
      `病药制衡：${rel.conflictChains.slice(0, 2).map((c) => `${c.conflict}（${c.rescueStatus}）`).join('；')}`,
    );
  }
  return parts.length ? `核心制衡：${parts.join('｜')}。` : null;
}

/**
 * 为六爻、梅花、奇门、大六壬、八字、紫微及合盘生成面向上层用户与 AI 的简明「局势要点」。
 */
export function buildMethodSituationDigest(
  method: string,
  data: unknown,
  question = '',
): string[] {
  if (!data || typeof data !== 'object') return [];
  const rec = data as Record<string, unknown>;
  const ctx = parseQuestionContext(question);
  const lines: string[] = [];

  if (method === 'bazi' || method === 'bazi-ziwei') {
    const charts = rec.charts as { bazi?: Record<string, unknown>; ziwei?: Record<string, unknown> } | undefined;
    const bazi = (charts?.bazi ?? (rec.bazi as Record<string, unknown> | undefined) ?? rec) as Record<string, unknown>;
    let chart = (bazi.chart as Record<string, unknown> | undefined) ?? (bazi.pillars ? bazi : undefined);
    let ziweiNatal: Record<string, unknown> | undefined;

    if (method === 'bazi-ziwei') {
      const zwObj = charts?.ziwei;
      const alignment = rec.alignment as {
        kind?: string;
        candidates?: Array<{ baziIndex: number; ziweiIndex: number }>;
      } | undefined;
      const selIdx =
        typeof rec.selectedCandidateIndex === 'number'
          ? rec.selectedCandidateIndex
          : (rec.input as { prompt?: { candidateIndex?: number } } | undefined)?.prompt?.candidateIndex;
      if (!chart && alignment?.kind === 'candidates' && typeof selIdx === 'number') {
        const pair = alignment.candidates?.[selIdx];
        const segments = (bazi.unknown as { segments?: Record<string, unknown>[] } | undefined)?.segments;
        if (pair && segments?.[pair.baziIndex]) chart = segments[pair.baziIndex];
        const zwCandidates = (zwObj?.unknown as { candidates?: Array<{ chart?: { natal?: Record<string, unknown> } }> } | undefined)?.candidates;
        if (pair && zwCandidates?.[pair.ziweiIndex]?.chart?.natal) {
          ziweiNatal = zwCandidates[pair.ziweiIndex].chart?.natal;
        }
      } else if (zwObj && !('unknown' in zwObj)) {
        ziweiNatal = zwObj.natal as Record<string, unknown> | undefined;
      }
    }

    const pillars = chart?.pillars as Record<string, { gan?: string; zhi?: string }> | undefined;
    const strength = chart?.strength as { status?: string } | undefined;
    const overview = chart?.patternOverview as { pattern?: string } | undefined;
    const dayGan = pillars?.day?.gan ?? '';
    const monthZhi = pillars?.month?.zhi ?? '';
    const qiongtong = dayGan && monthZhi ? getBaziQiongtongAdvice(dayGan, monthZhi) : undefined;
    if (strength?.status || overview?.pattern) {
      lines.push(
        `命局骨架：${dayGan ? `${dayGan}日主` : ''}${monthZhi ? `生于${monthZhi}月` : ''}，${strength?.status ?? ''}，主格取向「${overview?.pattern ?? '正格常规论断'}」。`,
      );
    }
    const baziBalanceLine = summarizeBaziPatternBalanceLine(chart);
    if (baziBalanceLine) lines.push(baziBalanceLine);
    const usefulGod = chart?.usefulGod as {
      favorableWuxing?: string[];
      unfavorableWuxing?: string[];
      primaryUsefulGod?: { wuxing?: string; role?: string } | string;
    } | undefined;
    if (usefulGod?.favorableWuxing?.length || usefulGod?.unfavorableWuxing?.length) {
      const fav = usefulGod.favorableWuxing?.join('、') || '待结合岁运';
      const unfav = usefulGod.unfavorableWuxing?.join('、') || '无';
      const located = bazi.located as {
        cycle?: { ganZhi?: string };
        year?: { ganZhi?: string };
      } | undefined;
      const flowTag =
        located?.cycle?.ganZhi || located?.year?.ganZhi
          ? `；当前岁运：${[located.cycle?.ganZhi ? `大运${located.cycle.ganZhi}` : '', located.year?.ganZhi ? `流年${located.year.ganZhi}` : ''].filter(Boolean).join(' / ')}`
          : '';
      lines.push(`用神喜忌：喜用[${fav}]、忌避[${unfav}]${flowTag}。`);
    }
    if (qiongtong) {
      lines.push(
        `调候参用：《穷通宝鉴》提示${qiongtong.season}，优先参看 ${qiongtong.preferredGods}（${qiongtong.advice}）。`,
      );
    }
    if (method === 'bazi-ziwei') {
      const zwParts = summarizeZiweiPatternBalanceLines(ziweiNatal);
      if (zwParts.length) {
        lines.push(`紫微制衡：${zwParts.join('｜')}。`);
      }
      const corr = rec.corroboration as {
        crossSystemBalance?: {
          resonances?: Array<{ topic?: string }>;
          tensions?: Array<{ topic?: string }>;
        };
      } | undefined;
      const resTopics = (corr?.crossSystemBalance?.resonances ?? []).map((x) => x.topic).filter(Boolean);
      const tenTopics = (corr?.crossSystemBalance?.tensions ?? []).map((x) => x.topic).filter(Boolean);
      if (resTopics.length || tenTopics.length) {
        const segs = [
          resTopics.length ? `同向共振（${resTopics.slice(0, 2).join('、')}）` : '',
          tenTopics.length ? `分歧制衡（${tenTopics.slice(0, 2).join('、')}）` : '',
        ].filter(Boolean);
        lines.push(`双盘合参：${segs.join('；')}。`);
      }
    }
    return lines;
  }

  if (method === 'ziwei') {
    const natal = rec.natal as {
      soulBranch?: string;
      bodyBranch?: string;
      fiveElementsClass?: string;
      palaces?: readonly (ZiweiPatternPalace & {
        flyingTransformations?: readonly { mutagen: string; star: string; targetName: string; relation: string }[];
      })[];
      patterns?: readonly ZiweiPattern[];
    } | undefined;
    if (!natal) return lines;
    const patNames = (natal.patterns ?? []).slice(0, 3).map((p) => p.name);
    const ming = natal.palaces?.find((p) => p.name === '命宫');
    const mingStars = ming?.majorStars?.length
      ? ming.majorStars.map((s) => `${s.name}${s.mutagen ? `化${s.mutagen}` : ''}`).join('、')
      : ming
        ? `空宫借对宫${natal.palaces?.[(ming.index + 6) % 12]?.majorStars?.map((s) => s.name).join('、') || '无'}`
        : '';
    lines.push(
      `命盘骨架：命宫${natal.soulBranch ?? ''}${mingStars ? `（${mingStars}）` : ''}、身宫${natal.bodyBranch ?? ''}（${natal.fiveElementsClass ?? ''}）${patNames.length ? `；命中格局：${patNames.join('、')}` : ''}。`,
    );
    const zwParts = summarizeZiweiPatternBalanceLines(natal as unknown as Record<string, unknown>);
    if (zwParts.length) {
      lines.push(`格局制衡：${zwParts.join('｜')}。`);
    }
    const refLayers = (rec.reference as { layers?: { decadal?: { heavenlyStem?: string; earthlyBranch?: string; nominalAge?: number }; yearly?: { heavenlyStem?: string; earthlyBranch?: string; nominalAge?: number } } } | undefined)?.layers;
    if (refLayers?.decadal || refLayers?.yearly) {
      const flowParts = [
        refLayers.decadal ? `大限${refLayers.decadal.heavenlyStem ?? ''}${refLayers.decadal.earthlyBranch ?? ''}` : '',
        refLayers.yearly ? `流年${refLayers.yearly.heavenlyStem ?? ''}${refLayers.yearly.earthlyBranch ?? ''}${refLayers.yearly.nominalAge ? `(${refLayers.yearly.nominalAge}虚岁)` : ''}` : '',
      ].filter(Boolean);
      if (flowParts.length) lines.push(`当前运限：${flowParts.join(' / ')}。`);
    }
    return lines;
  }

  if (method === 'liuyao') {
    const ev = rec.evidenceAnalysis as {
      selectionFact?: { promptText?: string; selectedCandidateKey?: string | null };
      structureFacts?: Array<{ kind?: string; promptText?: string }>;
      counterEvidenceFacts?: Array<{ candidateLabel?: string; detail?: string }>;
      lineFacts?: Array<{ activity?: string; position?: number; sixRelative?: string }>;
    } | undefined;
    const orig = typeof rec.originalName === 'string' ? rec.originalName : '';
    const chg = typeof rec.changedName === 'string' ? rec.changedName : '';
    const movingCount = Array.isArray(rec.changingYaos)
      ? rec.changingYaos.filter((x) => (x as { isChanging?: boolean })?.isChanging).length
      : 0;
    const structTags = (ev?.structureFacts ?? [])
      .map((s) => s.promptText)
      .filter((t): t is string => Boolean(t));
    lines.push(
      `卦势主线：${orig}${chg && chg !== orig ? ` 变 ${chg}` : ''}（${movingCount > 0 ? `共 ${movingCount} 爻发动` : '六爻皆静'}）${structTags.length ? `；${structTags.join('、')}` : ''}。`,
    );
    if (ctx.liuyaoRelative) {
      lines.push(
        `用神定位：${ctx.liuyaoRelativeReason ?? `本次关注${ctx.liuyaoRelative}爻`}${ctx.timeHorizon ? `，参考周期「${ctx.timeHorizon}」` : ''}。`,
      );
    } else if (ev?.selectionFact?.promptText) {
      lines.push(ev.selectionFact.promptText);
    }
    const yaosDetail = Array.isArray(rec.yaosDetail)
      ? (rec.yaosDetail as Array<{
          position?: number;
          sixRelative?: string;
          najiaDizhi?: string;
          wuxing?: string;
          isWorld?: boolean;
          isResponse?: boolean;
          isChanging?: boolean;
          changeDirection?: string;
          changeRelations?: string[];
        }>)
      : [];
    const balanceTokens: string[] = [];
    const shi = yaosDetail.find((y) => y.isWorld);
    const ying = yaosDetail.find((y) => y.isResponse);
    if (shi?.wuxing && ying?.wuxing) {
      const rel =
        shi.wuxing === ying.wuxing
          ? '世应比和'
          : isSheng(shi.wuxing, ying.wuxing)
            ? '世生应'
            : isSheng(ying.wuxing, shi.wuxing)
              ? '应生世'
              : isKe(shi.wuxing, ying.wuxing)
                ? '世克应'
                : '应克世';
      const extra = [
        shi.najiaDizhi && ying.najiaDizhi && isHe(shi.najiaDizhi, ying.najiaDizhi) ? '六合' : '',
        shi.najiaDizhi && ying.najiaDizhi && isChong(shi.najiaDizhi, ying.najiaDizhi) ? '六冲' : '',
        shi.najiaDizhi && ying.najiaDizhi && isXing(shi.najiaDizhi, ying.najiaDizhi) ? '相刑' : '',
      ].filter(Boolean);
      balanceTokens.push(`${rel}${extra.length ? `兼${extra.join('、')}` : ''}`);
    }
    const hexRel = rec.hexagramRelations as { transition?: string } | undefined;
    if (hexRel?.transition) balanceTokens.push(hexRel.transition);
    const fanfu = rec.fanfuRelations as { labels?: string[] } | undefined;
    if (fanfu?.labels?.length) balanceTokens.push(fanfu.labels.join('、'));
    const changeHighlights = yaosDetail
      .filter((y) => y.isChanging && (y.changeDirection === '化进神' || y.changeDirection === '化退神' || y.changeRelations?.includes('回头克') || y.changeRelations?.includes('回头生')))
      .slice(0, 2)
      .map((y) => {
        const tag = y.changeRelations?.includes('回头克')
          ? '化回头克'
          : y.changeRelations?.includes('回头生')
            ? '化回头生'
            : y.changeDirection ?? '';
        return `第${y.position}爻${y.sixRelative ?? ''}${tag}`;
      });
    balanceTokens.push(...changeHighlights);
    if (balanceTokens.length) {
      lines.push(`制衡要点：${balanceTokens.join('；')}。`);
    }
    if (ev?.counterEvidenceFacts?.length) {
      lines.push(
        `关键留意：${ev.counterEvidenceFacts.slice(0, 2).map((c) => `${c.candidateLabel ?? ''}${c.detail ? `（${c.detail}）` : ''}`).join('；')}。`,
      );
    }
    return lines;
  }

  if (method === 'meihua') {
    const analysis = rec.analysis as {
      tiYongRaw?: string;
      tiYongSummary?: string;
      tiSeasonState?: string;
      yongSeasonState?: string;
    } | undefined;
    const orig = typeof rec.originalName === 'string' ? rec.originalName : '';
    const chg = typeof rec.changedName === 'string' ? rec.changedName : '';
    const ev = rec.evidenceAnalysis as { timingSummaryFact?: { promptText?: string }; counterEvidenceFacts?: Array<{ promptText?: string }> } | undefined;
    if (orig) {
      lines.push(
        `体用脉络：${orig}${chg ? ` 变 ${chg}` : ''}${analysis?.tiYongRaw ? `，${analysis.tiYongRaw}` : ''}。`,
      );
    }
    const tiGua = rec.tiGua as { element?: string } | undefined;
    const yongGua = rec.yongGua as { element?: string } | undefined;
    const interTi = rec.interTiGua as { element?: string } | undefined;
    const interYong = rec.interYongGua as { element?: string } | undefined;
    const changedTi = rec.changedTiGua as { element?: string } | undefined;
    const changedYong = rec.changedYongGua as { element?: string } | undefined;
    if (tiGua?.element && yongGua?.element && interTi?.element && interYong?.element && changedTi?.element && changedYong?.element) {
      const toneOf = (other: string, ti: string) =>
        other === ti || isSheng(other, ti) ? 'support' : isKe(ti, other) ? 'control' : 'drain';
      const sTone = toneOf(yongGua.element, tiGua.element);
      const m1Tone = toneOf(interTi.element, tiGua.element);
      const m2Tone = toneOf(interYong.element, tiGua.element);
      const eTone = toneOf(changedYong.element, changedTi.element);
      const startOk = sTone !== 'drain';
      const endOk = eTone !== 'drain';
      const midDrain = m1Tone === 'drain' || m2Tone === 'drain';
      const trajectory =
        startOk && !midDrain && endOk
          ? '全程顺势'
          : startOk && !endOk
            ? '先顺后阻'
            : !startOk && endOk
              ? '先阻后通'
              : !startOk && midDrain && !endOk
                ? '全程受制'
                : '波动拉锯';
      const tones = [sTone, m1Tone, m2Tone, eTone];
      const sup = tones.filter((t) => t === 'support').length;
      const drn = tones.filter((t) => t === 'drain').length;
      const party = sup > drn ? `体党占优(${sup}:${drn})` : drn > sup ? `克泄偏重(${drn}:${sup})` : `势均(${sup}:${drn})`;
      const season = analysis?.tiSeasonState
        ? `；体卦月令${analysis.tiSeasonState}${analysis.tiSeasonState === '旺' || analysis.tiSeasonState === '相' ? '（抗克有力）' : '（体衰忌克泄）'}`
        : '';
      lines.push(`阶段制衡：三阶段呈「${trajectory}」，${party}${season}。`);
    }
    if (ev?.counterEvidenceFacts?.length) {
      lines.push(`阻力提示：${ev.counterEvidenceFacts[0]?.promptText ?? ''}`);
    } else if (ev?.timingSummaryFact?.promptText) {
      lines.push(ev.timingSummaryFact.promptText);
    }
    return lines;
  }

  if (method === 'qimen') {
    const dun = rec.isYangDun ? `阳遁${rec.juShu ?? ''}局` : `阴遁${rec.juShu ?? ''}局`;
    const rawTags = Array.isArray(rec.patternTags) ? (rec.patternTags as string[]) : [];
    const simplifyQimenTag = (tag: string) =>
      tag
        .replace(/^三奇得（/, '三奇得吉门（')
        .replace(/（[^（）]*（[^）]*）[^）]*）/gu, '')
        .replace(/^([^（]+)（([^）]+)）$/u, '$1·$2')
        .trim();
    const tags = [...new Set(rawTags.map(simplifyQimenTag).filter(Boolean))];
    const ev = rec.evidenceAnalysis as { timingFacts?: Array<{ promptText?: string }> } | undefined;
    lines.push(
      `局势总览：${dun}，值符 ${String(rec.zhiFu ?? '')}、值使 ${String(rec.zhiShi ?? '')}${tags.length ? `；要点：${tags.slice(0, 3).join('、')}` : ''}。`,
    );
    if (Array.isArray(rec.jiuGongGe)) {
      const qmRel = analyzeQimenPatternRelations(rec as unknown as QimenData);
      const balanceParts: string[] = [];
      if (qmRel.globalConstraints.length) {
        balanceParts.push(`全局约束：${qmRel.globalConstraints.slice(0, 2).join('；')}`);
      }
      if (qmRel.damagedGoodPalaces.length) {
        balanceParts.push(
          `吉格折损：${qmRel.damagedGoodPalaces.slice(0, 2).map((d) => `${d.palaceName}${d.verdict}（${d.goodPatterns.join('、')}遇${d.negativeFactors.slice(0, 2).join('、')}）`).join('；')}`,
        );
      } else if (qmRel.badRescuePalaces.length) {
        const firstBad = qmRel.badRescuePalaces[0];
        balanceParts.push(
          firstBad.hasRescue
            ? `凶格救应：${firstBad.palaceName}${firstBad.badPatterns.join('、')}得${firstBad.rescueFactors.slice(0, 2).join('、')}通关`
            : `凶象无明救：${firstBad.palaceName}${firstBad.badPatterns.join('、')}`,
        );
      }
      if (balanceParts.length) {
        lines.push(`格局制衡：${balanceParts.join('｜')}。`);
      }
    }
    const ying = ev?.timingFacts?.find((f) => f.promptText)?.promptText;
    if (ying) lines.push(ying);
    return lines;
  }

  if (method === 'liuren') {
    const rule = typeof rec.transmissionRule === 'string' ? rec.transmissionRule : '';
    const pat = typeof rec.transmissionPattern === 'string' ? rec.transmissionPattern : '';
    const ev = rec.evidenceAnalysis as { counterEvidenceFacts?: Array<{ promptText?: string }> } | undefined;
    lines.push(
      `课传主线：${rule || '大六壬四课三传'}${pat ? `（传态${pat}）` : ''}，干支及天将顺逆并看。`,
    );
    const trans = Array.isArray(rec.threeTransmissions)
      ? (rec.threeTransmissions as Array<{ stage?: string; branch?: string; wuxing?: string; seasonState?: string; isVoid?: boolean }>)
      : [];
    if (trans.length === 3) {
      const [chu, zhong, mo] = trans;
      const elem = (t: typeof chu) => t.wuxing || (t.branch ? getBranchWuxing(t.branch) : '');
      const cEl = elem(chu), zEl = elem(zhong), mEl = elem(mo);
      const dayStem = (rec.ganzhi as { day?: string } | undefined)?.day?.[0] ?? '';
      const stemEl = dayStem ? getStemWuxing(dayStem) : '';
      const strong = (t: typeof chu) => (t.seasonState === '旺' || t.seasonState === '相') && !t.isVoid;
      const forward =
        cEl && zEl && mEl && (isSheng(cEl, zEl) || cEl === zEl) && (isSheng(zEl, mEl) || zEl === mEl);
      const moHarmsGan = Boolean(mEl && stemEl && isKe(mEl, stemEl));
      const chuHarmsGan = Boolean(cEl && stemEl && isKe(cEl, stemEl));
      let trend: string;
      if (chu.isVoid || zhong.isVoid || mo.isVoid) {
        const voidNames = trans.filter((t) => t.isVoid).map((t) => t.stage).join('、');
        trend = `空亡待填（${voidNames}落空）`;
      } else if (forward && strong(chu) && strong(mo) && !moHarmsGan) {
        trend = '顺生递进';
      } else if ((!strong(chu) || chuHarmsGan) && strong(mo)) {
        trend = '先阻后通';
      } else if (strong(chu) && (!strong(mo) || moHarmsGan)) {
        trend = '先顺后折';
      } else if (pat === '伏吟' || pat === '反吟') {
        trend = `${pat}滞缓/反复`;
      } else {
        trend = '递传互制';
      }
      lines.push(`三传制衡：${trans.map((t) => `${t.branch ?? ''}${t.isVoid ? '(空)' : ''}`).join('→')}呈「${trend}」。`);
    }
    if (ev?.counterEvidenceFacts?.length) {
      lines.push(`反证提醒：${ev.counterEvidenceFacts[0]?.promptText ?? ''}`);
    }
    return lines;
  }

  if (method === 'bazi-synastry') {
    const inp = rec.input as {
      relationship?: SynastryRelationship;
      person1?: { name?: string };
      person2?: { name?: string };
    } | undefined;
    const rel = inp?.relationship ?? ctx.synastryRelationship ?? 'marriage';
    const relLabel = getSynastryRelationshipOption(rel).tagLabel;
    const p1Name = inp?.person1?.name?.trim() || '第一人';
    const p2Name = inp?.person2?.name?.trim() || '第二人';
    const compat = rec.compatibility as {
      dayMasterRelation?: {
        person1Stem?: string;
        person2Stem?: string;
        person1ToPerson2?: string;
        person2ToPerson1?: string;
        person2AsPerson1TenGod?: string;
        person1AsPerson2TenGod?: string;
      };
      spousePalaceDeep?: {
        isTianDeHe?: boolean;
        isTianKeDiChong?: boolean;
        judgment?: string;
      };
      usefulGodComplementarity?: { level?: string; judgment?: string };
      synastryBalance?: {
        usefulDirection?: string;
        dayPillarPattern?: string;
        overallBalanceTag?: string;
        usefulTensions?: string[];
        crossPillarModulations?: string[];
      };
    } | null | undefined;
    if (!compat) {
      lines.push(`合盘场景：${relLabel}；当前处于多时辰候选比较阶段，选定双方时辰后可展开逐项细论。`);
      return lines;
    }
    const dm = compat.dayMasterRelation;
    if (dm?.person1Stem && dm?.person2Stem) {
      lines.push(
        `合盘场景（${relLabel}）｜日主互动：${p1Name}（${dm.person1Stem}）与 ${p2Name}（${dm.person2Stem}）${dm.person1ToPerson2 ?? ''}，互为${dm.person2AsPerson1TenGod ?? '—'} / ${dm.person1AsPerson2TenGod ?? '—'}。`,
      );
    }
    if (compat.usefulGodComplementarity?.level) {
      const replaceNames = (text: string) => text.replace(/第一人/g, p1Name).replace(/第二人/g, p2Name);
      const j = replaceNames(compat.usefulGodComplementarity.judgment ?? '').replace(/。$/u, '');
      lines.push(
        `喜用互补：${compat.usefulGodComplementarity.level}${j ? `（${j}）` : ''}。`,
      );
    }
    if (rel === 'marriage' && compat.spousePalaceDeep?.judgment) {
      const spBadge = compat.spousePalaceDeep.isTianDeHe
        ? '天地德合 · '
        : compat.spousePalaceDeep.isTianKeDiChong
          ? '天克地冲 · '
          : '';
      lines.push(`夫妻宫合参：${spBadge}${compat.spousePalaceDeep.judgment}`);
    }
    if (compat.synastryBalance) {
      const sb = compat.synastryBalance;
      const replaceNames = (text: string) => text.replace(/第一人/g, p1Name).replace(/第二人/g, p2Name);
      const extra = sb.crossPillarModulations?.[0] ?? sb.usefulTensions?.[0] ?? '';
      lines.push(
        `干支制衡：日柱「${sb.dayPillarPattern ?? ''}」、全盘「${sb.overallBalanceTag ?? ''}」${extra ? `；${replaceNames(extra)}` : ''}。`,
      );
    }
    return lines;
  }

  if (method === 'ziwei-synastry') {
    const inp = rec.input as {
      relationship?: SynastryRelationship;
      person1?: { name?: string };
      person2?: { name?: string };
    } | undefined;
    const rel = inp?.relationship ?? ctx.synastryRelationship ?? 'marriage';
    const relLabel = getSynastryRelationshipOption(rel).tagLabel;
    const p1Name = inp?.person1?.name?.trim() || '第一人';
    const p2Name = inp?.person2?.name?.trim() || '第二人';
    const selected = rec.selected as {
      natal?: {
        person1?: { soul?: string; body?: string; soulBranch?: string; fiveElementsClass?: string };
        person2?: { soul?: string; body?: string; soulBranch?: string; fiveElementsClass?: string };
      };
      evidence?: {
        overlays?: Array<{
          sourcePerson?: string;
          sourcePalace?: string;
          targetPalace?: string;
          earthlyBranch?: string;
          sourceMajorStars?: string[];
          targetMajorStars?: string[];
        }>;
        crossMutagens?: Array<{ kind?: string; mutagen?: string; star?: string; targetPalace?: string }>;
        flyingBalance?: {
          luPattern?: string;
          jiModulations?: Array<{ status?: string; targetPalace?: string; star?: string }>;
        };
      };
    } | null | undefined;
    if (!selected?.evidence) {
      lines.push(`合盘场景：${relLabel}；当前为紫微出生时段对比阶段，请先确认双方时辰候选。`);
      return lines;
    }
    const focusPalaceMap: Record<SynastryRelationship, string[]> = {
      marriage: ['命', '夫妻', '福德'],
      career: ['命', '官禄', '财帛', '交友'],
      friendship: ['命', '交友', '福德'],
      children: ['命', '子女', '田宅'],
      parents: ['命', '父母', '田宅'],
      siblings: ['命', '兄弟', '田宅'],
    };
    const focusNames = new Set(focusPalaceMap[rel] ?? ['命', '夫妻']);
    const overlays = (selected.evidence.overlays ?? []).filter(
      (o) =>
        o.sourcePerson === 'person1' &&
        (focusNames.has(normalizeDigestPalaceName(o.sourcePalace ?? '')) ||
          focusNames.has(normalizeDigestPalaceName(o.targetPalace ?? ''))),
    );
    const n1 = selected.natal?.person1;
    const n2 = selected.natal?.person2;
    if (n1 && n2) {
      lines.push(
        `合盘场景（${relLabel}）｜命盘底色：${p1Name} 命宫${n1.soulBranch ?? ''}（${n1.fiveElementsClass ?? ''}），${p2Name} 命宫${n2.soulBranch ?? ''}（${n2.fiveElementsClass ?? ''}）。`,
      );
    }
    if (overlays.length) {
      lines.push(
        `重点宫位叠合：${overlays.slice(0, 3).map((o) => `${p1Name}${o.sourcePalace}叠${p2Name}${o.targetPalace}（${o.earthlyBranch}宫）`).join('；')}。`,
      );
    }
    const crossCount = selected.evidence.crossMutagens?.length ?? 0;
    const fb = selected.evidence.flyingBalance;
    if (fb?.luPattern) {
      const replaceNames = (text: string) => text.replace(/第一人/g, p1Name).replace(/第二人/g, p2Name);
      const jiList = fb.jiModulations ?? [];
      const relieved = jiList.filter((j) => j.status === '有缓解').length;
      const unrelieved = jiList.filter((j) => j.status === '无明解').length;
      const jiNote = jiList.length
        ? `；关键宫飞忌 ${jiList.length} 处（${relieved} 处有缓解、${unrelieved} 处无明解）`
        : '；未见核心宫飞忌直冲';
      lines.push(`双向飞化制衡：${replaceNames(fb.luPattern)}${jiNote}（生年跨盘四化 ${crossCount} 处）。`);
    } else {
      lines.push(`跨盘生年四化牵引：共检出 ${crossCount} 处同名星跨盘落宫对照，可结合飞星互参强弱。`);
    }
    return lines;
  }

  if (method === 'astrolabe-synastry') {
    const inp = rec.input as { person1?: { name?: string }; person2?: { name?: string } } | undefined;
    const rel = ctx.synastryRelationship ?? 'marriage';
    const relLabel = getSynastryRelationshipOption(rel).tagLabel;
    const p1Name = inp?.person1?.name?.trim() || '第一人';
    const p2Name = inp?.person2?.name?.trim() || '第二人';
    const aspects = Array.isArray(rec.aspects)
      ? (rec.aspects as Array<{ person1Name?: string; person2Name?: string; label?: string; deviation?: number }>)
      : [];
    const receptions = Array.isArray(rec.receptions) ? rec.receptions : [];
    const PERSONAL_STAR_OR_ANGLE = new Set(['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '上升', '中天', '下降', '天底']);
    const isPersonal = (name?: string) => Boolean(name && PERSONAL_STAR_OR_ANGLE.has(name));
    const personalAspects = [...aspects]
      .filter((a) => isPersonal(a.person1Name) || isPersonal(a.person2Name))
      .sort((a, b) => (a.deviation ?? 99) - (b.deviation ?? 99));
    const chosenSynAspects = (personalAspects.length >= 3 ? personalAspects : [...aspects].sort((a, b) => (a.deviation ?? 99) - (b.deviation ?? 99))).slice(0, 3);
    const topAspects = chosenSynAspects
      .map((a) => `${p1Name}${a.person1Name ?? ''}与${p2Name}${a.person2Name ?? ''}${a.label ?? ''}${typeof a.deviation === 'number' ? `(${a.deviation.toFixed(1)}°)` : ''}`)
      .join('；');
    lines.push(
      `合盘场景（${relLabel}）｜星盘互动：共命中 ${aspects.length} 条主要跨盘相位${topAspects ? `（紧密个人相位：${topAspects}）` : ''}。`,
    );
    lines.push(
      receptions.length
        ? `接纳与互溶：检出 ${receptions.length} 组古典守护互溶或接纳，关系张力较有缓冲余地。`
        : '接纳与互溶：当前计算点未见守护互溶，重在对照落宫与相位实际互动。',
    );
    return lines;
  }

  if (method === 'qimen-lifetime') {
    const base = rec.baseChart as { isYangDun?: boolean; juShu?: number; zhiFu?: string; zhiShi?: string } | undefined;
    const markers = Array.isArray(rec.personalMarkers)
      ? (rec.personalMarkers as Array<{ palaceName?: string; traditionalSignificance?: string }>)
      : [];
    if (base) {
      lines.push(
        `终身盘骨架：${base.isYangDun ? `阳遁${base.juShu ?? ''}局` : `阴遁${base.juShu ?? ''}局`}，值符 ${base.zhiFu ?? ''}、值使 ${base.zhiShi ?? ''}。`,
      );
    }
    if (markers.length) {
      lines.push(
        `个人核心落宫：${markers.slice(0, 2).map((m) => `${m.palaceName ?? ''}（${m.traditionalSignificance ?? ''}）`).join('；')}。`,
      );
    }
    return lines;
  }

  if (method === 'residential') {
    const agreements = Array.isArray(rec.agreements)
      ? (rec.agreements as Array<{ level?: string; title?: string; detail?: string }>)
      : [];
    const advice = Array.isArray(rec.advice) ? (rec.advice as string[]) : [];
    if (agreements.length) {
      lines.push(
        `风水分层重点：${agreements.slice(0, 2).map((a) => `[${a.level ?? ''}] ${a.title ?? ''}`).join('；')}。`,
      );
    }
    if (advice.length) {
      lines.push(`首要调整建议：${advice[0]}`);
    }
    return lines;
  }

  if (method === 'fortune') {
    const overview = rec.overview as { overallScore?: number; overallTier?: string; totalScore?: number; headline?: string; summary?: string } | undefined;
    const scope = typeof rec.scope === 'string' ? rec.scope : '';
    const score = typeof overview?.overallScore === 'number' ? overview.overallScore : overview?.totalScore;
    if (overview?.headline || overview?.summary) {
      lines.push(
        `${scope === 'yearly' ? '年运' : scope === 'monthly' ? '月运' : '日运'}总览${typeof score === 'number' ? `（${overview.overallTier ? `${overview.overallTier} · ` : ''}综合分 ${score}）` : ''}：${overview.headline ?? overview.summary ?? ''}`,
      );
    }
    if (overview?.summary && overview.summary !== overview.headline) {
      lines.push(overview.summary);
    }
    return lines;
  }

  if (method === 'tarot') {
    const cards = Array.isArray(rec.cards)
      ? (rec.cards as Array<{ position?: string; positionName?: string; name?: string; reversed?: boolean; orientation?: string; element?: string; id?: number }>)
      : [];
    if (cards.length) {
      const majorCount = cards.filter((c) => typeof c.id === 'number' && c.id <= 22).length;
      const revCount = cards.filter((c) => c.reversed || c.orientation === 'reversed').length;
      const elemCounts = new Map<string, number>();
      for (const c of cards) {
        if (c.element) {
          const shortEl = c.element.replace(/（[^）]*）/gu, '').trim() || c.element;
          elemCounts.set(shortEl, (elemCounts.get(shortEl) ?? 0) + 1);
        }
      }
      const elemSummary = [...elemCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([el, cnt]) => `${el}${cnt}`)
        .join('/');
      lines.push(
        `牌阵落象：${cards.slice(0, 4).map((c) => `${(c.position ?? c.positionName) ? `${c.position ?? c.positionName}·` : ''}${c.name ?? ''}${(c.reversed || c.orientation === 'reversed') ? '(逆)' : ''}`).join('，')}。`,
      );
      lines.push(
        `能量结构：大阿卡纳 ${majorCount}/${cards.length}、逆位 ${revCount}/${cards.length}${elemSummary ? `；元素分布 ${elemSummary}` : ''}。`,
      );
    }
    return lines;
  }

  if (method === 'lenormand') {
    const cards = Array.isArray(rec.cards)
      ? (rec.cards as Array<{ position?: string; positionName?: string; name?: string }>)
      : [];
    const combos = Array.isArray(rec.combinations)
      ? (rec.combinations as Array<{ source?: string; card1?: string; card2?: string; conditioned?: string }>)
      : [];
    if (cards.length) {
      const center = cards.length >= 3 ? cards[Math.floor(cards.length / 2)] : cards[0];
      lines.push(
        `牌序主线：${cards.slice(0, 5).map((c) => `${c.name ?? ''}`).join(' → ')}${center?.name ? `（中心焦点：${center.name}）` : ''}。`,
      );
      const fixed = combos.filter((c) => c.source === '固定组合').slice(0, 2);
      if (fixed.length) {
        lines.push(
          `固定组合：${fixed.map((f) => `${f.card1}+${f.card2}（${f.conditioned ?? ''}）`).join('；')}。`,
        );
      }
    }
    return lines;
  }

  if (method === 'astrolabe') {
    const basis = rec.basis as { dayChart?: boolean; houseSystem?: string } | undefined;
    const angles = Array.isArray(rec.angles)
      ? (rec.angles as Array<{ id?: string; name?: string; sign?: string; degreeInSign?: number }>)
      : [];
    const points = Array.isArray(rec.points)
      ? (rec.points as Array<{ id?: string; name?: string; sign?: string; house?: number; retrograde?: boolean }>)
      : [];
    const aspects = Array.isArray(rec.aspects)
      ? (rec.aspects as Array<{ first?: string; second?: string; name?: string; deviation?: number }>)
      : [];
    const asc = angles.find((a) => a.id === 'asc' || a.name?.includes('上升'));
    const sun = points.find((p) => p.id === 'sun');
    const moon = points.find((p) => p.id === 'moon');
    const nameMap = Object.fromEntries(points.map((p) => [p.id ?? '', p.name ?? '']));
    lines.push(
      `本命骨架：${basis?.dayChart ? '昼盘' : '夜盘'}，${asc ? `上升${asc.sign}` : ''}${sun ? `、太阳${sun.sign}${sun.house}宫` : ''}${moon ? `、月亮${moon.sign}${moon.house}宫` : ''}。`,
    );
    const CORE_ASTRO_BODIES = new Set([
      'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'asc', 'mc',
    ]);
    const MAJOR_ASTRO_ASPECTS = new Set(['合相', '冲相', '刑相', '拱相', '六合']);
    const validAspects = [...aspects]
      .filter((a) => typeof a.deviation === 'number')
      .sort((a, b) => (a.deviation ?? 99) - (b.deviation ?? 99));
    const preferredAspects = validAspects.filter(
      (a) =>
        MAJOR_ASTRO_ASPECTS.has(a.name ?? '') &&
        CORE_ASTRO_BODIES.has(a.first ?? '') &&
        CORE_ASTRO_BODIES.has(a.second ?? ''),
    );
    const fallbackMajor = validAspects.filter((a) => MAJOR_ASTRO_ASPECTS.has(a.name ?? ''));
    const tightAspects = (
      preferredAspects.length >= 2
        ? [...preferredAspects, ...fallbackMajor.filter((x) => !preferredAspects.includes(x))]
        : fallbackMajor.length > 0
          ? fallbackMajor
          : validAspects
    ).slice(0, 4);
    if (tightAspects.length) {
      lines.push(
        `最紧核心相位：${tightAspects.map((a) => `${nameMap[a.first ?? ''] ?? a.first}${a.name ?? ''}${nameMap[a.second ?? ''] ?? a.second}(${(a.deviation ?? 0).toFixed(1)}°)`).join('；')}。`,
      );
    }
    const flow = rec.flow as { transit?: { aspects?: Array<{ movingName?: string; natalName?: string; label?: string; deviation?: number }> } } | undefined;
    const tightTransit = [...(flow?.transit?.aspects ?? [])]
      .sort((a, b) => (a.deviation ?? 99) - (b.deviation ?? 99))
      .slice(0, 2);
    if (tightTransit.length) {
      lines.push(
        `当前行运触发：${tightTransit.map((t) => `行运${t.movingName}${t.label}本命${t.natalName}(${(t.deviation ?? 0).toFixed(1)}°)`).join('；')}。`,
      );
    }
    return lines;
  }

  if (method === 'qizheng') {
    const mingDu = rec.mingDu as { xiu?: string; duZhu?: string } | undefined;
    const enNan = rec.enNan as {
      mingZhu?: string;
      enStars?: string[];
      nanStars?: string[];
      interactions?: Array<{ role?: string; star?: string; aspect?: string }>;
    } | undefined;
    const aspects = Array.isArray(rec.aspects)
      ? (rec.aspects as Array<{ star1?: string; star2?: string; type?: string; orb?: number }>)
      : [];
    lines.push(
      `命度骨架：命主${String(rec.mingZhu ?? enNan?.mingZhu ?? '')}、命度${mingDu?.xiu ?? ''}宿（度主${mingDu?.duZhu ?? ''}）${enNan ? `；恩星[${(enNan.enStars ?? []).join('、')}]、难星[${(enNan.nanStars ?? []).join('、')}]` : ''}。`,
    );
    if (enNan?.interactions?.length) {
      lines.push(
        `恩难交会：${enNan.interactions.slice(0, 3).map((i) => `${i.role}${i.star}${i.aspect}命主`).join('；')}。`,
      );
    }
    const isLuoJiPair = (s1?: string, s2?: string) => {
      if (!s1 || !s2) return false;
      return (
        (s1.startsWith('罗睺') && s2.startsWith('计都')) ||
        (s1.startsWith('计都') && s2.startsWith('罗睺'))
      );
    };
    const tight = [...aspects]
      .filter((a) => typeof a.orb === 'number' && !isLuoJiPair(a.star1, a.star2))
      .sort((a, b) => (a.orb ?? 99) - (b.orb ?? 99))
      .slice(0, 3);
    if (tight.length) {
      lines.push(
        `最紧本命吊照：${tight.map((a) => `${a.star1}${a.type}${a.star2}(${(a.orb ?? 0).toFixed(1)}°)`).join('；')}。`,
      );
    }
    return lines;
  }

  if (method === 'xiaoliuren') {
    const seq = rec.sequence as { month?: { name?: string }; day?: { name?: string } } | undefined;
    const primary = rec.primary as { name?: string } | undefined;
    const ev = rec.evidenceAnalysis as { sanGongAnalysis?: { combinationSummary?: string; tiYongRelation?: string } } | undefined;
    if (primary?.name) {
      lines.push(
        `三宫落点：${seq?.month?.name ?? ''} → ${seq?.day?.name ?? ''} → 主占「${primary.name}」。`,
      );
    }
    if (ev?.sanGongAnalysis?.tiYongRelation) {
      lines.push(`体用定性：${ev.sanGongAnalysis.tiYongRelation}。`);
    }
    return lines;
  }

  if (method === 'jinkoujue') {
    const pos = rec.positions as {
      renYuan?: { stem?: string; element?: string };
      guiShen?: { god?: string; branch?: string; element?: string };
      jiangShen?: { god?: string; branch?: string; element?: string };
      diFen?: { branch?: string; element?: string };
    } | undefined;
    const yyUse = rec.yinYangUse as { usePosition?: string } | undefined;
    const ev = rec.evidenceAnalysis as {
      counterEvidenceFacts?: Array<{ promptText?: string }>;
    } | undefined;
    const moves = Array.isArray(rec.movements)
      ? (rec.movements as Array<{ name?: string }>).map((m) => m.name).filter(Boolean)
      : [];
    if (pos?.renYuan && pos?.guiShen && pos?.jiangShen && pos?.diFen) {
      lines.push(
        `四位与发用：人元${pos.renYuan.stem ?? ''} / 贵神${pos.guiShen.god ?? ''}(${pos.guiShen.branch ?? ''}) / 将神${pos.jiangShen.god ?? ''}(${pos.jiangShen.branch ?? ''}) / 地分${pos.diFen.branch ?? ''}${yyUse?.usePosition ? `；以${yyUse.usePosition}发用` : ''}。`,
      );
    }
    if (moves.length) {
      lines.push(`触发动象：${moves.join('、')}。`);
    }
    if (ev?.counterEvidenceFacts?.[0]?.promptText) {
      lines.push(`反证提醒：${ev.counterEvidenceFacts[0].promptText.replace('，力量条件偏弱', '')}`);
    }
    return lines;
  }

  if (method === 'taiyi') {
    const yy = typeof rec.yinYang === 'string' ? rec.yinYang : '';
    const ju = rec.bureau ?? rec.juNumber ?? rec.ju;
    const pos = typeof rec.taiyiPosition === 'string' ? rec.taiyiPosition : '';
    const host = rec.lordCount ?? rec.hostCount ?? rec.zhuSuan;
    const guest = rec.guestCount ?? rec.keSuan;
    const fixed = rec.setCount ?? rec.fixedCount ?? rec.dingSuan;
    const summaryParts = [
      ju !== undefined ? `${yy}${ju}局${pos ? `（太乙落${pos}）` : ''}` : '',
      host !== undefined ? `主算${host}` : '',
      guest !== undefined ? `客算${guest}` : '',
      fixed !== undefined ? `定算${fixed}` : '',
    ].filter(Boolean);
    if (summaryParts.length) {
      const bias =
        typeof host === 'number' && typeof guest === 'number'
          ? host > guest
            ? '（主算大于客算，偏利主方守成）'
            : guest > host
              ? '（客算大于主算，偏利客方主动）'
              : '（主客算平，势均力敌）'
          : '';
      lines.push(`主客定局：${summaryParts.join('、')}${bias}。`);
    }
    return lines;
  }

  if (method === 'bazhai') {
    const comps = Array.isArray(rec.comparisons)
      ? (rec.comparisons as Array<{ mingGua?: string; sitMountain?: string; houseGua?: string; match?: string; directions?: Array<{ direction?: string; ming?: string; mingLuck?: string }> }>)
      : [];
    const mingPalaces = Array.isArray(rec.mingPalaces)
      ? (rec.mingPalaces as Array<{ gua?: string; palaces?: Array<{ direction?: string; label?: string; luck?: string }> }>)
      : [];
    if (comps[0]) {
      const c = comps[0];
      const goodDirs = (c.directions ?? []).filter((d) => d.mingLuck === '吉').map((d) => `${d.direction}(${d.ming})`).join('、');
      lines.push(`命宅主线：命卦${c.mingGua}配${c.sitMountain}山${c.houseGua}宅（${c.match}）${goodDirs ? `；命卦四吉方：${goodDirs}` : ''}。`);
    } else if (mingPalaces[0]) {
      const mp = mingPalaces[0];
      const goodDirs = (mp.palaces ?? []).filter((d) => d.luck === '吉').map((d) => `${d.direction}(${d.label})`).join('、');
      lines.push(`命卦主线：${mp.gua}命${goodDirs ? `；四吉方：${goodDirs}` : ''}。`);
    }
    return lines;
  }

  if (method === 'xuankong') {
    const charts = Array.isArray(rec.charts)
      ? (rec.charts as Array<{ period?: { yuan?: string; yun?: number }; sitMountain?: string; facingMountain?: string; formation?: string; combinations?: Array<{ name?: string }> }>)
      : [];
    if (charts[0]) {
      const c = charts[0];
      const combos = (c.combinations ?? []).slice(0, 3).map((x) => x.name).filter(Boolean);
      lines.push(
        `飞星主线：${c.period?.yuan ?? ''}${c.period?.yun ?? ''}运 ${c.sitMountain ?? ''}山${c.facingMountain ?? ''}向（${c.formation ?? ''}）${combos.length ? `；关键组合：${combos.join('、')}` : ''}。`,
      );
    }
    return lines;
  }

  if (method === 'almanac') {
    const recObj = rec.recommendations as {
      preferredDays?: Array<{ date?: string; weekday?: string; dayOfficer?: string; bestHours?: Array<{ name?: string }> }>;
      secondaryDays?: Array<{ date?: string }>;
      cautionDays?: Array<{ date?: string }>;
    } | undefined;
    if (recObj) {
      const pref = recObj.preferredDays ?? [];
      const top = pref.slice(0, 3).map((d) => `${d.date}(${d.dayOfficer}日${d.bestHours?.[0]?.name ? `·${d.bestHours[0].name}` : ''})`).join('；');
      lines.push(
        `择吉筛选：优选 ${pref.length} 天、次选 ${(recObj.secondaryDays ?? []).length} 天、慎用 ${(recObj.cautionDays ?? []).length} 天${top ? `；首选：${top}` : ''}。`,
      );
    }
    return lines;
  }

  if (method === 'chinese-name') {
    const analysis = rec.analysis as { surname?: string; given?: string; sancaiEvidence?: { combo?: string } } | undefined;
    const relations = rec.relations as { sancaiFlow?: string; toneSummary?: string; homophones?: string[]; charFavorableHits?: string[]; charAvoidHits?: string[] } | undefined;
    if (analysis) {
      lines.push(
        `姓名骨架：「${analysis.surname ?? ''}${analysis.given ?? ''}」三才${analysis.sancaiEvidence?.combo ?? ''}${relations?.sancaiFlow ? `（${relations.sancaiFlow}）` : ''}${relations?.toneSummary ? `；平仄：${relations.toneSummary}` : ''}。`,
      );
      if (relations) {
        lines.push(
          `核查要点：谐音${relations.homophones?.length ? `见${relations.homophones.join('、')}` : '无冲突'}${relations.charFavorableHits?.length ? `；补喜用：${relations.charFavorableHits.join('、')}` : ''}${relations.charAvoidHits?.length ? `；涉忌神：${relations.charAvoidHits.join('、')}` : ''}。`,
        );
      }
    }
    return lines;
  }

  if (method === 'chinese-naming') {
    const cands = Array.isArray(rec.candidates)
      ? (rec.candidates as Array<{ fullName?: string }>)
      : [];
    const rel = rec.relations as { smoothSancaiCount?: number; favorableHitCount?: number } | undefined;
    if (cands.length) {
      lines.push(
        `起名速览：共生成 ${cands.length} 组候选（三才顺生 ${rel?.smoothSancaiCount ?? 0} 组），前列推荐：${cands.slice(0, 4).map((c) => c.fullName).join('、')}。`,
      );
    }
    return lines;
  }

  if (method === 'number-energy') {
    const summary = rec.magneticSummary as { supportiveCount?: number; steadyCount?: number; challengingCount?: number } | undefined;
    const pairs = Array.isArray(rec.energyPairs)
      ? (rec.energyPairs as Array<{ span?: string; name?: string; nature?: string }>)
      : [];
    const prim = rec.primaryNumerology as { level?: string } | undefined;
    if (pairs.length) {
      const first = pairs[0];
      const last = pairs.at(-1);
      lines.push(
        `磁场主线：起首「${first?.span ?? ''}」${first?.name ?? ''} → 收口「${last?.span ?? ''}」${last?.name ?? ''}（助益${summary?.supportiveCount ?? 0}/守成${summary?.steadyCount ?? 0}/考验${summary?.challengingCount ?? 0}；主数${String(rec.primaryIndex ?? '')}${prim?.level ? `·${prim.level}` : ''}）。`,
      );
    }
    return lines;
  }

  if (method === 'wuyun-liuqi') {
    const mov = rec.annualMovement as { name?: string; element?: string; excess?: string } | undefined;
    const sitian = rec.sitian as { name?: string } | undefined;
    const zaiquan = rec.zaiquan as { name?: string } | undefined;
    if (mov?.name || sitian?.name) {
      lines.push(
        `年度运气骨架：岁运${mov?.name ?? ''}（${mov?.element ?? ''}${mov?.excess ?? ''}），上半年${sitian?.name ?? ''}司天，下半年${zaiquan?.name ?? ''}在泉。`,
      );
    }
    return lines;
  }

  if (method === 'huangji-jingshi') {
    const fc = rec.forecast as {
      hexagrams?: {
        annual?: { name?: string; ganzhi?: string };
        decade?: { hexagram?: { name?: string } };
        sixtyYear?: { hexagram?: { name?: string } };
        yun?: { hexagram?: { name?: string } };
      };
    } | undefined;
    const pos = rec.position as {
      hui?: { indexInYuan?: number };
      yun?: { indexInYuan?: number };
      shi?: { indexInYuan?: number };
    } | undefined;
    const h = fc?.hexagrams;
    if (h?.annual?.name) {
      lines.push(
        `周期主线：值年卦「${h.annual.name}${h.annual.ganzhi ? `·${h.annual.ganzhi}` : ''}」${h.decade?.hexagram?.name ? `、十年卦「${h.decade.hexagram.name}」` : ''}${h.sixtyYear?.hexagram?.name ? `、六十年统卦「${h.sixtyYear.hexagram.name}」` : ''}${h.yun?.hexagram?.name ? `、运卦「${h.yun.hexagram.name}」` : ''}。`,
      );
    } else if (pos?.hui || pos?.yun || pos?.shi) {
      lines.push(
        `周期坐标：第${pos.hui?.indexInYuan ?? '?'}会、第${pos.yun?.indexInYuan ?? '?'}运、第${pos.shi?.indexInYuan ?? '?'}世。`,
      );
    }
    return lines;
  }

  if (method === 'minglu') {
    const baziObj = rec.bazi as { chart?: { pillars?: Record<string, { gan?: string; zhi?: string }>; strength?: { status?: string }; patternOverview?: { pattern?: string }; usefulGod?: { favorableWuxing?: string[]; unfavorableWuxing?: string[] } } } | undefined;
    const ziweiObj = rec.ziwei as { natal?: { soulBranch?: string; fiveElementsClass?: string; palaces?: Array<{ name?: string; majorStars?: Array<{ name?: string }> }> } } | undefined;
    const astroObj = rec.astrolabe as { points?: Array<{ id?: string; sign?: string; house?: number }>; angles?: Array<{ id?: string; sign?: string }> } | undefined;
    const crossRes = rec.crossResonance as { resonances?: string[]; divergences?: string[] } | undefined;
    const bz = baziObj?.chart;
    if (bz?.pillars?.day?.gan && bz.pillars.month?.zhi) {
      const fav = bz.usefulGod?.favorableWuxing?.join('、') || '';
      lines.push(
        `八字骨架：${bz.pillars.day.gan}日主生于${bz.pillars.month.zhi}月（${bz.strength?.status ?? ''}），主格「${bz.patternOverview?.pattern ?? ''}」${fav ? `，喜用[${fav}]` : ''}。`,
      );
    }
    if (ziweiObj?.natal?.soulBranch) {
      const mingStars = ziweiObj.natal.palaces?.find((p) => p.name === '命宫')?.majorStars?.map((s) => s.name).join('、') || '借对宫';
      lines.push(
        `紫微与星盘：紫微命宫${ziweiObj.natal.soulBranch}（${mingStars}·${ziweiObj.natal.fiveElementsClass ?? ''}）${astroObj?.points ? `；星盘上升${astroObj.angles?.find((a) => a.id === 'asc')?.sign ?? ''}、太阳${astroObj.points.find((p) => p.id === 'sun')?.sign ?? ''}、月亮${astroObj.points.find((p) => p.id === 'moon')?.sign ?? ''}` : ''}。`,
      );
    }
    if (crossRes && ((crossRes.resonances?.length ?? 0) > 0 || (crossRes.divergences?.length ?? 0) > 0)) {
      lines.push(
        `跨盘核验：检出 ${crossRes.resonances?.length ?? 0} 项强共振信号、${crossRes.divergences?.length ?? 0} 项跨盘张力。`,
      );
    }
    return lines;
  }

  if (method === 'bazi-reverse') {
    const inp = rec.input as { pillars?: { year?: string; month?: string; day?: string; hour?: string }; startYear?: number; endYear?: number } | undefined;
    const cands = Array.isArray(rec.candidates) ? (rec.candidates as Array<{ start?: string; end?: string }>) : [];
    const pillarStr = inp?.pillars ? [inp.pillars.year, inp.pillars.month, inp.pillars.day, inp.pillars.hour].filter(Boolean).join(' ') : '';
    lines.push(
      `反推主线：四柱「${pillarStr}」在 ${inp?.startYear ?? ''}–${inp?.endYear ?? ''} 年间共命中 ${cands.length} 个候选时段。`,
    );
    if (cands.length) {
      lines.push(
        `时间窗口：首段起于 ${cands[0].start ?? ''}；末段止于 ${cands.at(-1)?.end ?? ''}。`,
      );
    }
    return lines;
  }

  if (method === 'instant') {
    const basis = rec.basis as { localDateTime?: string; timezone?: number } | undefined;
    const bazi = rec.bazi as { pillars?: Record<string, { ganZhi?: string }>; patternOverview?: { pattern?: string } } | undefined;
    const ziwei = rec.ziwei as { soulBranch?: string; fiveElementsClass?: string } | undefined;
    const astro = rec.astrolabe as { points?: Array<{ id?: string; sign?: string }>; angles?: Array<{ id?: string; sign?: string }> } | undefined;
    const qz = rec.qizheng as { mingGong?: string; mingZhu?: string } | undefined;
    const parts: string[] = [];
    if (bazi?.pillars) {
      parts.push(`即时四柱 ${['year', 'month', 'day', 'hour'].map((k) => bazi.pillars?.[k]?.ganZhi ?? '').join(' ')}（${bazi.patternOverview?.pattern ?? ''}）`);
    }
    if (ziwei?.soulBranch) {
      parts.push(`即时紫微命宫${ziwei.soulBranch}（${ziwei.fiveElementsClass ?? ''}）`);
    }
    if (astro?.points) {
      parts.push(`即时星盘太阳${astro.points.find((p) => p.id === 'sun')?.sign ?? ''}、月亮${astro.points.find((p) => p.id === 'moon')?.sign ?? ''}`);
    }
    if (qz?.mingGong) {
      parts.push(`即时七政命宫${qz.mingGong}（命主${qz.mingZhu ?? ''}）`);
    }
    if (parts.length || basis?.localDateTime) {
      lines.push(`即时盘骨架：${basis?.localDateTime ?? ''}｜${parts.join('；') || '已按所选时刻起盘'}。`);
    }
    return lines;
  }

  if (method === 'qizheng-range' || method === 'astrolabe-range') {
    const range = rec.range as { totalSeconds?: number; startIndex?: number; endIndex?: number } | undefined;
    const branches = Array.isArray(rec.branches) ? (rec.branches as Array<{ startIndex?: number; endIndex?: number; first?: Record<string, unknown> }>) : [];
    const total = range?.totalSeconds ?? 0;
    const statusLabel = branches.length <= 1 ? '全区间盘面骨架稳定无跳宫切换' : `共分化为 ${branches.length} 个阶段分支`;
    lines.push(`出生范围概览：覆盖 ${total} 秒（本页第 ${range?.startIndex ?? 0}–${Math.max(0, (range?.endIndex ?? 1) - 1)} 秒），${statusLabel}。`);
    if (branches.length >= 2) {
      lines.push('核对要点：严禁私自选盘，须对照各分支命宫/宫位切换与共同稳定特征。');
    }
    return lines;
  }

  if (method === 'ssgw') {
    const title = typeof rec.title === 'string' ? rec.title : (rec.lot as { title?: string } | undefined)?.title;
    const num = typeof rec.number === 'number' ? rec.number : undefined;
    const core = (rec.details as Record<string, string> | undefined)?.['此签核心'];
    if (title) {
      const cleanTitle = title.trim();
      const prefix = num && !/^第.+签/u.test(cleanTitle) ? `第${num}签 ` : '';
      lines.push(`灵签主线：${prefix}${cleanTitle}${core ? `（${core}）` : ''}。`);
    }
    return lines;
  }

  if (method === 'zhuge') {
    const sign = rec.sign as { poem?: string } | undefined;
    const num = typeof rec.number === 'number' ? rec.number : undefined;
    const summary = typeof rec.sourceSummary === 'string' ? rec.sourceSummary : '';
    if (sign?.poem || summary) {
      lines.push(`神数主线：${num ? `第${num}签` : '诸葛神数'}${summary ? `（${summary}）` : ''}。`);
    }
    return lines;
  }

  return lines;
}
