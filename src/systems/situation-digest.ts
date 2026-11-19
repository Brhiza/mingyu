import { getSynastryRelationshipOption, type SynastryRelationship } from './focus-presets';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from './calendar';
import { getYearSixtyCycle } from './ganzhi-foundation';
import { getBaziQiongtongAdvice } from './classics/bazi-qiongtong';
import { selectQimenClassics } from './classics/qimen';
import { parseQuestionContext } from './question-context';

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
  palaceNumber?: number;
  palaceName?: string;
  diZhi?: string[];
  tianPan?: { stem?: string; companionStem?: string };
  diPan?: { stem?: string };
  renPan?: { door?: string };
  jiuXing?: { star?: string };
  shenPan?: { god?: string };
  horse?: boolean;
  isEmpty?: boolean;
}

/**
 * 按用户问题与当前背景自动定位奇门遁甲「事项核心用神」落宫及其十干克应。
 */
export function buildQimenMatterFocusSection(
  question: string,
  gongs: readonly QimenGongLike[],
  voidBranches: readonly string[] = [],
  zhiFu?: string,
): string {
  const ctx = parseQuestionContext(question);
  const intent = ctx.qimenMatterIntent;
  if (!intent && !ctx.gender && !ctx.subjectRole) return '';

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

  if (targets.length === 0) return '';

  const lines: string[] = [];
  for (const t of targets) {
    const gong = gongs.find(t.test);
    if (!gong) continue;
    const tStem = gong.tianPan?.stem ?? '';
    const dStem = gong.diPan?.stem ?? '';
    const pair = tStem && dStem ? `${tStem}+${dStem}` : '';
    const patternHit = pair ? selectQimenClassics({ stemPairs: [pair] })[0] : undefined;
    const isVoid =
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
    const palaceNum = gong.palaceNumber ? `落${gong.palaceNumber}宫` : '落宫';
    const palaceName = gong.palaceName ? `（${gong.palaceName}）` : '';
    lines.push(`- ${t.label}${palaceNum}${palaceName}：${tags}`);
  }

  if (!lines.length) return '';
  return `【事项用神落宫】\n${lines.join('\n')}`;
}

/**
 * 为六爻、梅花、奇门、大六壬、八字生成面向上层用户与 AI 的简明「局势要点」。
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
    const bazi = (rec.bazi as Record<string, unknown> | undefined) ?? rec;
    const chart = (bazi.chart as Record<string, unknown> | undefined) ?? bazi;
    const pillars = chart.pillars as Record<string, { gan?: string; zhi?: string }> | undefined;
    const strength = chart.strength as { status?: string } | undefined;
    const overview = chart.patternOverview as { pattern?: string } | undefined;
    const dayGan = pillars?.day?.gan ?? '';
    const monthZhi = pillars?.month?.zhi ?? '';
    const qiongtong = dayGan && monthZhi ? getBaziQiongtongAdvice(dayGan, monthZhi) : undefined;
    if (strength?.status || overview?.pattern) {
      lines.push(
        `命局骨架：${dayGan ? `${dayGan}日主` : ''}${monthZhi ? `生于${monthZhi}月` : ''}，${strength?.status ?? ''}，主格取向「${overview?.pattern ?? '待核'}」。`,
      );
    }
    if (qiongtong) {
      lines.push(
        `调候参用：《穷通宝鉴》提示${qiongtong.season}，优先参看 ${qiongtong.preferredGods}（${qiongtong.advice}）。`,
      );
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
    if (ev?.counterEvidenceFacts?.length) {
      lines.push(
        `关键留意：${ev.counterEvidenceFacts.slice(0, 2).map((c) => `${c.candidateLabel ?? ''}${c.detail ? `（${c.detail}）` : ''}`).join('；')}。`,
      );
    }
    return lines;
  }

  if (method === 'meihua') {
    const analysis = rec.analysis as { tiYongRaw?: string; tiYongSummary?: string } | undefined;
    const orig = typeof rec.originalName === 'string' ? rec.originalName : '';
    const chg = typeof rec.changedName === 'string' ? rec.changedName : '';
    const ev = rec.evidenceAnalysis as { timingSummaryFact?: { promptText?: string }; counterEvidenceFacts?: Array<{ promptText?: string }> } | undefined;
    if (orig) {
      lines.push(
        `体用脉络：${orig}${chg ? ` 变 ${chg}` : ''}${analysis?.tiYongRaw ? `，${analysis.tiYongRaw}` : ''}。`,
      );
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
    const tags = Array.isArray(rec.patternTags) ? (rec.patternTags as string[]) : [];
    const ev = rec.evidenceAnalysis as { timingFacts?: Array<{ promptText?: string }> } | undefined;
    lines.push(
      `局势总览：${dun}，值符 ${String(rec.zhiFu ?? '')}、值使 ${String(rec.zhiShi ?? '')}${tags.length ? `（${tags.slice(0, 3).join('、')}）` : ''}。`,
    );
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
    } | null | undefined;
    if (!compat) {
      lines.push(`合盘场景：${relLabel}；当前处于多时辰候选比较阶段，选定双方时辰后可展开逐项细论。`);
      return lines;
    }
    const dm = compat.dayMasterRelation;
    if (dm?.person1Stem && dm?.person2Stem) {
      lines.push(
        `【${relLabel}】日主互动：${p1Name}（${dm.person1Stem}）与 ${p2Name}（${dm.person2Stem}）${dm.person1ToPerson2 ?? ''}，互为${dm.person2AsPerson1TenGod ?? '—'} / ${dm.person1AsPerson2TenGod ?? '—'}。`,
      );
    }
    if (compat.usefulGodComplementarity?.level) {
      lines.push(
        `喜用互补：${compat.usefulGodComplementarity.level}（${compat.usefulGodComplementarity.judgment ?? ''}）。`,
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
      };
    } | null | undefined;
    if (!selected?.evidence) {
      lines.push(`合盘场景：${relLabel}；当前为紫微出生时段对比阶段，请先确认双方时辰候选。`);
      return lines;
    }
    const focusPalaceMap: Record<SynastryRelationship, string[]> = {
      marriage: ['命宫', '夫妻宫', '福德宫'],
      career: ['命宫', '官禄宫', '财帛宫', '交友宫'],
      friendship: ['命宫', '交友宫', '福德宫'],
      children: ['命宫', '子女宫', '田宅宫'],
      parents: ['命宫', '父母宫', '田宅宫'],
      siblings: ['命宫', '兄弟宫', '田宅宫'],
    };
    const focusNames = new Set(focusPalaceMap[rel] ?? ['命宫', '夫妻宫']);
    const overlays = (selected.evidence.overlays ?? []).filter(
      (o) => o.sourcePerson === 'person1' && (focusNames.has(o.sourcePalace ?? '') || focusNames.has(o.targetPalace ?? '')),
    );
    const n1 = selected.natal?.person1;
    const n2 = selected.natal?.person2;
    if (n1 && n2) {
      lines.push(
        `【${relLabel}】命盘底色：${p1Name} 命宫${n1.soulBranch ?? ''}（${n1.fiveElementsClass ?? ''}），${p2Name} 命宫${n2.soulBranch ?? ''}（${n2.fiveElementsClass ?? ''}）。`,
      );
    }
    if (overlays.length) {
      lines.push(
        `重点宫位叠合：${overlays.slice(0, 3).map((o) => `${p1Name}${o.sourcePalace}叠${p2Name}${o.targetPalace}（${o.earthlyBranch}宫）`).join('；')}。`,
      );
    }
    const crossCount = selected.evidence.crossMutagens?.length ?? 0;
    lines.push(`跨盘生年四化牵引：共检出 ${crossCount} 处同名星跨盘落宫对照，可结合飞星互参强弱。`);
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
    const topAspects = aspects
      .slice(0, 3)
      .map((a) => `${p1Name}${a.person1Name ?? ''}与${p2Name}${a.person2Name ?? ''}${a.label ?? ''}`)
      .join('；');
    lines.push(
      `【${relLabel}】星盘互动：共命中 ${aspects.length} 条主要跨盘相位${topAspects ? `（紧密相位：${topAspects}）` : ''}。`,
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

  if (method === 'residential' || method === 'bazhai' || method === 'xuankong') {
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
    const overview = rec.overview as { totalScore?: number; headline?: string; summary?: string } | undefined;
    const scope = typeof rec.scope === 'string' ? rec.scope : '';
    if (overview?.headline || overview?.summary) {
      lines.push(
        `${scope === 'yearly' ? '年运' : scope === 'monthly' ? '月运' : '日运'}总览${typeof overview.totalScore === 'number' ? `（综合分 ${overview.totalScore}）` : ''}：${overview.headline ?? overview.summary ?? ''}`,
      );
    }
    if (overview?.summary && overview.summary !== overview.headline) {
      lines.push(overview.summary);
    }
    return lines;
  }

  if (method === 'tarot' || method === 'lenormand') {
    const cards = Array.isArray(rec.cards)
      ? (rec.cards as Array<{ positionName?: string; name?: string; orientation?: string }>)
      : [];
    if (cards.length) {
      lines.push(
        `牌阵核心落象：${cards.slice(0, 3).map((c) => `${c.positionName ? `${c.positionName}·` : ''}${c.name ?? ''}${c.orientation === 'reversed' ? '（逆位）' : ''}`).join('，')}。`,
      );
    }
    return lines;
  }

  if (method === 'ssgw') {
    const lot = rec.lot as { title?: string; level?: string; summary?: string } | undefined;
    if (lot?.title) {
      lines.push(`灵签签意：${lot.title}${lot.level ? `（${lot.level}）` : ''}${lot.summary ? ` — ${lot.summary}` : ''}`);
    }
    return lines;
  }

  return lines;
}
