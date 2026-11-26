import { BRANCH_WUXING, KE_MAP, SHENG_MAP, STEM_WUXING } from './ganzhi-foundation';

export interface SchoolStructuredVerdict {
  stance: string;
  primaryFocus: string;
  favorableSignals: string[];
  riskSignals: string[];
  score?: number;
  keyConclusion: string;
}

export interface SchoolAlgorithmEvaluation {
  school: string;
  label: string;
  ruleFocus: string;
  findings: string[];
  structuredVerdict?: SchoolStructuredVerdict;
}

function clampScore(value: number, min = 10, max = 98): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function formatSchoolAlgorithmSection(
  items: readonly SchoolAlgorithmEvaluation[],
  consensusSummary?: string,
): string {
  if (!items.length) return '';
  const body = items
    .map((item) => {
      const base = `${item.label}：口径重心＝${item.ruleFocus}；本盘核验：${item.findings.join('；')}。`;
      if (!item.structuredVerdict) return base;
      const v = item.structuredVerdict;
      const scoreTag = typeof v.score === 'number' ? `[量化分=${v.score}/100]` : '';
      return `${base}｜结构化裁定：[立场=${v.stance}][焦点=${v.primaryFocus}]${scoreTag} ${v.keyConclusion}`;
    })
    .join('\n');
  const consensusBlock = consensusSummary?.trim() ? `\n${consensusSummary.trim()}` : '';
  return `【流派算法口径核验】\n${body}${consensusBlock}`;
}

const WUXING_GENERATE: Record<string, string> = SHENG_MAP;
const WUXING_CONTROL: Record<string, string> = KE_MAP;

function compareWuxing(subject: string, object: string): '比和' | '主生客' | '客生主' | '主克客' | '客克主' | '未明' {
  if (!subject || !object) return '未明';
  if (subject === object) return '比和';
  if (WUXING_GENERATE[subject] === object) return '主生客';
  if (WUXING_GENERATE[object] === subject) return '客生主';
  if (WUXING_CONTROL[subject] === object) return '主克客';
  if (WUXING_CONTROL[object] === subject) return '客克主';
  return '未明';
}

const TRIGRAM_ELEMENT: Record<string, string> = {
  乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土',
};

const BRANCH_ELEMENT: Record<string, string> = BRANCH_WUXING;
const STEM_ELEMENT: Record<string, string> = STEM_WUXING;

const LIU_HE_PAIRS = new Set(['子丑', '丑子', '寅亥', '亥寅', '卯戌', '戌卯', '辰酉', '酉辰', '巳申', '申巳', '午未', '未午']);
const LIU_CHONG_PAIRS = new Set(['子午', '午子', '丑未', '未丑', '寅申', '申寅', '卯酉', '酉卯', '辰戌', '戌辰', '巳亥', '亥巳']);

function tiYongRelationLabel(tiElement: string, otherElement: string): string {
  const rel = compareWuxing(tiElement, otherElement);
  if (rel === '比和') return '体用比和（助益顺和）';
  if (rel === '客生主') return '用生体（得外助力·偏吉）';
  if (rel === '主克客') return '体克用（主动可控·劳而有成）';
  if (rel === '主生客') return '体生用（耗泄付出·进缓）';
  if (rel === '客克主') return '用克体（受制承压·防阻）';
  return '体用五行持平';
}

function tiYongPolarity(tiElement: string, otherElement: string): '吉' | '平' | '阻' {
  const rel = compareWuxing(tiElement, otherElement);
  if (rel === '比和' || rel === '客生主' || rel === '主克客') return '吉';
  if (rel === '客克主') return '阻';
  return '平';
}

export function evaluateMeihuaSchoolAlgorithms(
  data: {
    originalName: string;
    interName: string;
    changedName: string;
    tiGua: { name: string; element: string };
    yongGua: { name: string; element: string };
    movingYao: { position: number; text?: string };
    interHexagram?: { upper: string; lower: string };
    changedHexagram?: { upper: string; lower: string };
    analysis: {
      tiYongRaw: string;
      tiSeason?: string;
      tiYongSeasonEvaluation?: string;
      timelineTrend?: { trend: string; summary: string };
    };
  },
  schools: readonly ('tiyong' | 'xiangshu' | 'yaoci')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const tiElem = data.tiGua.element || TRIGRAM_ELEMENT[data.tiGua.name] || '';
  const yongElem = data.yongGua.element || TRIGRAM_ELEMENT[data.yongGua.name] || '';
  const isUpperMoving = data.movingYao.position > 3;
  // 体卦不动：上卦动则下卦为体，变卦中与体相对的为变用卦（上卦）
  const changedOtherName = data.changedHexagram
    ? (isUpperMoving ? data.changedHexagram.upper : data.changedHexagram.lower)
    : '';
  const changedOtherElem = TRIGRAM_ELEMENT[changedOtherName] ?? '';
  const interUpperElem = data.interHexagram ? (TRIGRAM_ELEMENT[data.interHexagram.upper] ?? '') : '';
  const interLowerElem = data.interHexagram ? (TRIGRAM_ELEMENT[data.interHexagram.lower] ?? '') : '';

  const startTone = tiYongPolarity(tiElem, yongElem);
  const endTone = changedOtherElem ? tiYongPolarity(tiElem, changedOtherElem) : startTone;
  const tiStrong = Boolean(data.analysis.tiSeason && /旺|相/.test(data.analysis.tiSeason));
  const tiWeak = Boolean(data.analysis.tiSeason && /休|囚|死/.test(data.analysis.tiSeason));

  const stageVerdict = (() => {
    if (startTone === '吉' && endTone === '吉') {
      return tiWeak ? '主变皆扶助体卦，虽月令体气偏弱仍可借外力顺成' : '主变皆利体卦，体旺用扶，事态推进顺畅可成';
    }
    if (startTone === '阻' && endTone === '吉') {
      return '初起受制而变卦转扶体卦，属先难后易、中后段见转机之象';
    }
    if (startTone === '吉' && endTone === '阻') {
      return '初势虽顺而变卦转克体卦，属先易后难，须防后劲不足或尾段生变';
    }
    if (startTone === '阻' && endTone === '阻') {
      return tiStrong ? '用变皆克体而体卦得月令之气，主阻力显著但尚能顶压周旋，宜缓不宜急' : '主变皆克体且体气失令，阻力偏重，宜守避止损、待旺时再图';
    }
    return endTone === '吉'
      ? '初段耗泄持平而终局得变卦扶助，宜先蓄力投入再收成果'
      : endTone === '阻'
        ? '初段耗力而终局承压，须控制投入边界以防徒耗'
        : '全盘体用耗泄平衡，主缓慢推进、以稳取胜';
  })();

  const interSummary = data.interHexagram
    ? `互卦上${data.interHexagram.upper}(${interUpperElem})下${data.interHexagram.lower}(${interLowerElem})对体呈「${tiYongRelationLabel(tiElem, interUpperElem)}／${tiYongRelationLabel(tiElem, interLowerElem)}」`
    : `互卦${data.interName}主中程隐性酝酿与过程转折`;
  const changedSummary = changedOtherName
    ? `变卦之用${changedOtherName}(${changedOtherElem})对体呈「${tiYongRelationLabel(tiElem, changedOtherElem)}」`
    : `变卦${data.changedName}定最终归宿`;

  const yaoStageHint = data.movingYao.position === 1
    ? '初爻发动主事态萌芽起手，宜早作布局'
    : data.movingYao.position === 2 || data.movingYao.position === 5
      ? `第${data.movingYao.position}爻居中得位发动，主核心枢纽转化、主线明朗`
      : data.movingYao.position === 3 || data.movingYao.position === 4
        ? `第${data.movingYao.position}爻居内外卦交界发动，主过渡转折、多生反复需稳控节奏`
        : '上爻发动主事态近尾声或物极必反，宜收口防变';

  // 本、互、变三段体用走势量化评分（0~100）
  const relScore = (ti: string, other: string): number => {
    const r = compareWuxing(ti, other);
    if (r === '客生主') return 88;
    if (r === '比和') return 80;
    if (r === '主克客') return 68;
    if (r === '主生客') return 48;
    if (r === '客克主') return 26;
    return 55;
  };
  const baseStageScore = relScore(tiElem, yongElem);
  const interStageScore = data.interHexagram
    ? Math.round((relScore(tiElem, interUpperElem) + relScore(tiElem, interLowerElem)) / 2)
    : 55;
  const changedStageScore = changedOtherElem ? relScore(tiElem, changedOtherElem) : baseStageScore;
  const seasonBonus = tiStrong ? 8 : tiWeak ? -8 : 0;

  const tiyongScore = clampScore(baseStageScore * 0.3 + interStageScore * 0.25 + changedStageScore * 0.45 + seasonBonus);
  const xiangshuScore = clampScore(baseStageScore * 0.25 + interStageScore * 0.45 + changedStageScore * 0.3 + (changedStageScore > baseStageScore ? 6 : changedStageScore < baseStageScore ? -6 : 0));
  const yaoPosBonus = (data.movingYao.position === 2 || data.movingYao.position === 5)
    ? 8
    : (data.movingYao.position === 3 || data.movingYao.position === 4)
      ? -5
      : 0;
  const yaociScore = clampScore(baseStageScore * 0.2 + changedStageScore * 0.65 + interStageScore * 0.15 + yaoPosBonus);

  const toneStance = (score: number, prefix: string): string =>
    score >= 72 ? `${prefix}·偏吉可成` : score >= 52 ? `${prefix}·平势缓进` : `${prefix}·偏阻宜守`;

  const meihuaFav: string[] = [];
  const meihuaRisk: string[] = [];
  if (startTone === '吉') meihuaFav.push(`主卦体用偏利（${data.analysis.tiYongRaw}）`);
  if (startTone === '阻') meihuaRisk.push(`主卦用克体受制（${data.analysis.tiYongRaw}）`);
  if (endTone === '吉') meihuaFav.push(`变卦终局扶体（${changedOtherName || data.changedName}）`);
  if (endTone === '阻') meihuaRisk.push(`变卦终局克体（${changedOtherName || data.changedName}）`);
  if (tiStrong) meihuaFav.push(`体卦得月令${data.analysis.tiSeason}`);
  if (tiWeak) meihuaRisk.push(`体卦失令（${data.analysis.tiSeason}）`);

  return unique.map((school) => {
    if (school === 'tiyong') {
      return {
        school,
        label: '体用生克派口径',
        ruleFocus: '以体卦为主、用卦为客，逐段裁定主/互/变体用生克比和与月令旺衰成败',
        findings: [
          `主卦：体卦${data.tiGua.name}（${tiElem}${data.analysis.tiSeason ? `·月令${data.analysis.tiSeason}` : ''}）与用卦${data.yongGua.name}（${yongElem}）呈「${data.analysis.tiYongRaw}」`,
          `过程与终局：${interSummary}；${changedSummary}`,
          `综合裁定：${stageVerdict}${data.analysis.timelineTrend ? `（阶段总势：${data.analysis.timelineTrend.trend}）` : ''}`,
        ],
        structuredVerdict: {
          stance: toneStance(tiyongScore, '体用三段生克'),
          primaryFocus: '主互变体用生克与体气旺衰',
          favorableSignals: meihuaFav.length ? meihuaFav : ['体用耗泄持平'],
          riskSignals: meihuaRisk,
          score: tiyongScore,
          keyConclusion: `本(${baseStageScore})→互(${interStageScore})→变(${changedStageScore})三段体用综合${tiyongScore}分；${stageVerdict}`,
        },
      };
    }
    if (school === 'xiangshu') {
      const transitionTag = changedStageScore > baseStageScore + 8
        ? '先抑后扬'
        : changedStageScore < baseStageScore - 8
          ? '先扬后抑'
          : '全程平推';
      return {
        school,
        label: '象数互变派口径',
        ruleFocus: '重本卦起点、互卦隐性过程转折、变卦终局归宿与八宫物象连动',
        findings: [
          `演进链：本卦${data.originalName}（现状）→ 互卦${data.interName}（中程暗流）→ 变卦${data.changedName}（终局落点）`,
          `动爻落第${data.movingYao.position}爻（${isUpperMoving ? '上卦动、下卦为体，主外境/对方先行变化' : '下卦动、上卦为体，主内因/基础层面先行启动'}）；${interSummary}`,
          `转折要点：${stageVerdict}`,
        ],
        structuredVerdict: {
          stance: toneStance(xiangshuScore, `象数演进(${transitionTag})`),
          primaryFocus: '本互变过程转折与内外动向',
          favorableSignals: [
            ...(interStageScore >= 65 ? [`互卦中程顺势(${data.interName})`] : []),
            ...(changedStageScore > baseStageScore ? ['终局优于起点'] : []),
            ...meihuaFav.slice(0, 2),
          ],
          riskSignals: [
            ...(interStageScore < 45 ? [`互卦中程隐阻(${data.interName})`] : []),
            ...(changedStageScore < baseStageScore ? ['后段势能回落'] : []),
            ...meihuaRisk.slice(0, 2),
          ],
          score: xiangshuScore,
          keyConclusion: `${isUpperMoving ? '外境先动' : '内因先动'}、演进呈「${transitionTag}」，互卦中程权重分${interStageScore}，综合${xiangshuScore}分。`,
        },
      };
    }
    return {
      school,
      label: '爻辞动变派口径',
      ruleFocus: '结合动爻爻位进退、体用生克与《周易》对应动爻爻辞参断节奏',
      findings: [
        `动爻为${data.originalName}第${data.movingYao.position}爻（之卦${data.changedName}）：${yaoStageHint}`,
        ...(data.movingYao.text ? [`动爻标志：${data.movingYao.text}`] : []),
        `动变指向：${changedSummary}；${stageVerdict}`,
      ],
      structuredVerdict: {
        stance: toneStance(yaociScore, `第${data.movingYao.position}爻动变`),
        primaryFocus: '动爻爻位进退与之卦归宿',
        favorableSignals: [
          ...(yaoPosBonus > 0 ? [`第${data.movingYao.position}爻居中得位`] : []),
          ...(endTone === '吉' ? [`之卦${data.changedName}归宿扶体`] : []),
        ],
        riskSignals: [
          ...(yaoPosBonus < 0 ? [`第${data.movingYao.position}爻居交界易反复`] : []),
          ...(endTone === '阻' ? [`之卦${data.changedName}终局克体`] : []),
        ],
        score: yaociScore,
        keyConclusion: `${yaoStageHint}；动变终局分${yaociScore}分。`,
      },
    };
  });
}

const LIUREN_AUSPICIOUS_GODS = new Set(['贵人', '青龙', '六合', '太常', '太阴', '天后']);
const LIUREN_CHALLENGE_GODS = new Set(['白虎', '玄武', '螣蛇', '腾蛇', '朱雀', '勾陈', '天空']);

export function evaluateLiurenSchoolAlgorithms(
  data: {
    transmissionRule?: string;
    transmissionPattern?: string;
    guaTi?: string[];
    patternTags?: string[];
    xunKong?: string[];
    noblemanBranch?: string;
    ganzhi?: { day?: string; month?: string; hour?: string };
    fourLessons?: Array<{ name?: string; upper: string; lower?: string; god: string }>;
    threeTransmissions: Array<{ branch: string; god: string; relative?: string; stage?: string }>;
    shenShaFacts?: Array<{ name: string; target: string }>;
  },
  schools: readonly ('keti' | 'bifafu' | 'leishen')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const [chu, zhong, mo] = data.threeTransmissions;
  const voidSet = new Set(data.xunKong ?? []);
  const dayStem = data.ganzhi?.day?.[0] ?? '';
  const dayStemElem = STEM_ELEMENT[dayStem] ?? '';
  const chuElem = chu ? (BRANCH_ELEMENT[chu.branch] ?? '') : '';
  const zhongElem = zhong ? (BRANCH_ELEMENT[zhong.branch] ?? '') : '';
  const moElem = mo ? (BRANCH_ELEMENT[mo.branch] ?? '') : '';

  // 三传初末走势推演
  const chuVoid = chu ? voidSet.has(chu.branch) : false;
  const moVoid = mo ? voidSet.has(mo.branch) : false;
  const chuZhongRel = compareWuxing(chuElem, zhongElem);
  const zhongMoRel = compareWuxing(zhongElem, moElem);
  const moVsDay = dayStemElem && moElem ? compareWuxing(dayStemElem, moElem) : '未明';
  const chuGodGood = chu ? LIUREN_AUSPICIOUS_GODS.has(chu.god) : false;
  const moGodGood = mo ? LIUREN_AUSPICIOUS_GODS.has(mo.god) : false;
  const moGodBad = mo ? LIUREN_CHALLENGE_GODS.has(mo.god) : false;

  const transmissionFlow = (() => {
    const parts: string[] = [];
    if (chuZhongRel === '主生客' && zhongMoRel === '主生客') {
      parts.push('三传顺生递进，势能由初向末汇聚');
    } else if (chuZhongRel === '客生主' && zhongMoRel === '客生主') {
      parts.push('三传逆生回护，主后段反哺起点');
    } else if (chuZhongRel === '主克客' || zhongMoRel === '主克客') {
      parts.push('传间见克，推进过程存在折损或节奏切换');
    } else {
      parts.push('三传气机平缓过渡，重初末落点定性');
    }
    if (chuVoid && moVoid) {
      parts.push('初末皆落旬空，主起止虚浮，须待出空填实方见实效');
    } else if (chuVoid) {
      parts.push(`初传${chu?.branch}落空，主开端犹豫或条件未齐，中末段渐入正轨`);
    } else if (moVoid) {
      parts.push(`末传${mo?.branch}落空，主虎头蛇尾或收口落空，须防尾段变数`);
    }
    if (moVsDay === '客生主' || moVsDay === '比和') {
      parts.push(`末传${mo?.branch}(${moElem})生扶日干${dayStem}(${dayStemElem})，终局向我得助`);
    } else if (moVsDay === '客克主') {
      parts.push(`末传${mo?.branch}(${moElem})克制日干${dayStem}(${dayStemElem})，终局承压宜早留退路`);
    } else if (moVsDay === '主克客') {
      parts.push(`日干克末传${mo?.branch}，终局可凭主动把控收束`);
    } else if (moVsDay === '主生客') {
      parts.push(`日干生末传${mo?.branch}，终局偏重持续投入与耗力`);
    }
    return parts.join('；');
  })();

  const l1 = data.fourLessons?.[0];
  const l3 = data.fourLessons?.[2];
  const lessonInteraction = l1 && l3
    ? (() => {
        const u1 = l1.upper;
        const u3 = l3.upper;
        const rel = compareWuxing(BRANCH_ELEMENT[u1] ?? '', BRANCH_ELEMENT[u3] ?? '');
        const tags: string[] = [
          rel === '比和' ? '干上支上比和（主客同气）'
            : rel === '客生主' ? '支上生干上（事来就我·偏利）'
              : rel === '主生客' ? '干上生支上（我往就事·偏耗）'
                : rel === '主克客' ? '干上克支上（我方主动控局）'
                  : rel === '客克主' ? '支上克干上（外境/对方牵制）'
                    : '干支上神平势',
        ];
        if (LIU_HE_PAIRS.has(`${u1}${u3}`)) tags.push('干支上神六合（易达成协议）');
        if (LIU_CHONG_PAIRS.has(`${u1}${u3}`)) tags.push('干支上神六冲（主客分歧或变动）');
        return `干上${u1}(${l1.god})与支上${u3}(${l3.god})：${tags.join('、')}`;
      })()
    : '';

  const goodTrans = data.threeTransmissions.filter((t) => LIUREN_AUSPICIOUS_GODS.has(t.god)).map((t) => `${t.branch}(${t.god})`);
  const badTrans = data.threeTransmissions.filter((t) => LIUREN_CHALLENGE_GODS.has(t.god)).map((t) => `${t.branch}(${t.god})`);
  const verdictLine = (() => {
    if (moVoid || (moVsDay === '客克主' && moGodBad)) return '终局偏阻或易落空，宜重防范与阶段止损';
    if ((moVsDay === '客生主' || moVsDay === '比和') && moGodGood && !moVoid) return '末传吉将生扶不空，整体走势偏吉可成';
    if (chuVoid && moGodGood) return '初空末吉，先缓后成，待出空填实发力';
    if (chuGodGood && moGodBad) return '初吉末滞，宜趁前段落实核心成果、防后段反复';
    return '三传吉凶互见，宜以中末传落点与日干生克权衡进退';
  })();

  // 三传走势量化评分
  let ketiScore = 58;
  if (chuZhongRel === '主生客' && zhongMoRel === '主生客') ketiScore += 14;
  else if (chuZhongRel === '客生主' && zhongMoRel === '客生主') ketiScore += 8;
  else if (chuZhongRel === '主克客' || zhongMoRel === '主克客') ketiScore -= 8;
  if (moVsDay === '客生主' || moVsDay === '比和') ketiScore += 14;
  else if (moVsDay === '主克客') ketiScore += 6;
  else if (moVsDay === '客克主') ketiScore -= 14;
  else if (moVsDay === '主生客') ketiScore -= 4;
  if (moGodGood) ketiScore += 8;
  if (moGodBad) ketiScore -= 8;
  if (chuVoid) ketiScore -= 6;
  if (moVoid) ketiScore -= 14;
  ketiScore = clampScore(ketiScore);

  // 毕法赋：四课干支上神交涉评分
  let bifafuScore = 56;
  if (l1 && l3) {
    const rel = compareWuxing(BRANCH_ELEMENT[l1.upper] ?? '', BRANCH_ELEMENT[l3.upper] ?? '');
    if (rel === '客生主' || rel === '比和') bifafuScore += 14;
    else if (rel === '主克客') bifafuScore += 6;
    else if (rel === '客克主') bifafuScore -= 12;
    else if (rel === '主生客') bifafuScore -= 5;
    if (LIU_HE_PAIRS.has(`${l1.upper}${l3.upper}`)) bifafuScore += 10;
    if (LIU_CHONG_PAIRS.has(`${l1.upper}${l3.upper}`)) bifafuScore -= 10;
  }
  if (moVoid) bifafuScore -= 10;
  if (moVsDay === '客生主' || moVsDay === '比和') bifafuScore += 8;
  else if (moVsDay === '客克主') bifafuScore -= 10;
  bifafuScore = clampScore(bifafuScore);

  // 类神神煞：三传吉凶天将净值与空亡评分
  let leishenScore = 56 + goodTrans.length * 10 - badTrans.length * 10;
  if (chuVoid) leishenScore -= 5;
  if (moVoid) leishenScore -= 12;
  if (data.noblemanBranch && !voidSet.has(data.noblemanBranch)) leishenScore += 6;
  leishenScore = clampScore(leishenScore);

  const liurenTone = (s: number, prefix: string): string =>
    s >= 70 ? `${prefix}·走势偏吉` : s >= 50 ? `${prefix}·吉凶互见` : `${prefix}·终局偏阻`;

  const liurenFav: string[] = [];
  const liurenRisk: string[] = [];
  if (moVsDay === '客生主' || moVsDay === '比和') liurenFav.push(`末传${mo?.branch ?? ''}生扶日干`);
  if (goodTrans.length) liurenFav.push(`三传吉将：${goodTrans.join('、')}`);
  if (chuZhongRel === '主生客' && zhongMoRel === '主生客') liurenFav.push('三传顺生递进');
  if (moVoid) liurenRisk.push(`末传${mo?.branch ?? ''}落旬空`);
  if (chuVoid) liurenRisk.push(`初传${chu?.branch ?? ''}落旬空`);
  if (moVsDay === '客克主') liurenRisk.push(`末传${mo?.branch ?? ''}克制日干`);
  if (badTrans.length) liurenRisk.push(`三传凶将：${badTrans.join('、')}`);

  return unique.map((school) => {
    if (school === 'keti') {
      return {
        school,
        label: '九宗门课体派口径',
        ruleFocus: '依九宗门发用传法、课体格局与三传初末走势定事态主线',
        findings: [
          `发用取法：${data.transmissionRule ?? '常规取传'}${data.transmissionPattern ? `（${data.transmissionPattern}）` : ''}`,
          `三传：${data.threeTransmissions.map((t) => `${t.branch}(${t.god}${t.relative ? `·${t.relative}` : ''}${voidSet.has(t.branch) ? '·空' : ''})`).join(' → ')}`,
          `初末走势：${transmissionFlow}`,
          ...(data.guaTi?.length ? [`课体：${data.guaTi.join('、')}`] : []),
          `断语要点：${verdictLine}`,
        ],
        structuredVerdict: {
          stance: liurenTone(ketiScore, '三传走势'),
          primaryFocus: '九宗门发用与三传递进收口',
          favorableSignals: liurenFav.length ? liurenFav : ['三传气机平缓'],
          riskSignals: liurenRisk,
          score: ketiScore,
          keyConclusion: `三传走势分${ketiScore}/100；${verdictLine}`,
        },
      };
    }
    if (school === 'bifafu') {
      return {
        school,
        label: '毕法赋百法派口径',
        ruleFocus: '重四课干支上神交涉、初末传向背与日干生克进退',
        findings: [
          `初传${chu?.branch ?? ''}至末传${mo?.branch ?? ''}，结构标签：${data.patternTags?.slice(0, 6).join('、') || '常规传序'}`,
          ...(lessonInteraction ? [lessonInteraction] : []),
          `初末向背：${transmissionFlow}；裁定：${verdictLine}`,
        ],
        structuredVerdict: {
          stance: liurenTone(bifafuScore, '干支交涉'),
          primaryFocus: '四课干支上神向背与主客关系',
          favorableSignals: [
            ...(lessonInteraction.includes('六合') ? ['干支上神六合'] : []),
            ...(lessonInteraction.includes('支上生干上') || lessonInteraction.includes('比和') ? ['支上向我生比'] : []),
            ...liurenFav.slice(0, 1),
          ],
          riskSignals: [
            ...(lessonInteraction.includes('六冲') ? ['干支上神六冲'] : []),
            ...(lessonInteraction.includes('支上克干上') ? ['支上克制干上'] : []),
            ...liurenRisk.slice(0, 2),
          ],
          score: bifafuScore,
          keyConclusion: `四课干支交涉分${bifafuScore}/100；${lessonInteraction || verdictLine}`,
        },
      };
    }
    return {
      school,
      label: '类神神煞派口径',
      ruleFocus: '重天将乘神吉凶、旬空填实、贵人及核心神煞落支',
      findings: [
        `贵人临${data.noblemanBranch ?? '未列'}，旬空${data.xunKong?.join('、') || '无'}`,
        `三传天将权重：吉将${goodTrans.join('、') || '无'}；凶将${badTrans.join('、') || '无'}`,
        ...(data.shenShaFacts?.length ? [`命中神煞：${data.shenShaFacts.slice(0, 5).map((s) => `${s.name}(${s.target})`).join('、')}`] : []),
        `类神提示：${verdictLine}`,
      ],
      structuredVerdict: {
        stance: liurenTone(leishenScore, '天将神煞'),
        primaryFocus: '三传天将吉凶权重与旬空填实',
        favorableSignals: [
          ...(goodTrans.length ? [`吉将临传(${goodTrans.length}位)：${goodTrans.join('、')}`] : []),
          ...(data.noblemanBranch && !voidSet.has(data.noblemanBranch) ? [`贵人临${data.noblemanBranch}不空`] : []),
        ],
        riskSignals: [
          ...(badTrans.length ? [`凶将临传(${badTrans.length}位)：${badTrans.join('、')}`] : []),
          ...(moVoid ? ['末传落空待填实'] : []),
        ],
        score: leishenScore,
        keyConclusion: `吉将${goodTrans.length}位 vs 凶将${badTrans.length}位，天将神煞分${leishenScore}/100；${verdictLine}`,
      },
    };
  });
}

const QIMEN_PALACE_ELEMENT: Record<number, string> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
};

const QIMEN_PALACE_NAME_TO_NUM: Record<string, number> = {
  坎一宫: 1, 坎宫: 1, 坤二宫: 2, 坤宫: 2, 震三宫: 3, 震宫: 3, 巽四宫: 4, 巽宫: 4,
  中五宫: 5, 中宫: 5, 乾六宫: 6, 乾宫: 6, 兑七宫: 7, 兑宫: 7, 艮八宫: 8, 艮宫: 8, 离九宫: 9, 离宫: 9,
};

const QIMEN_DOOR_ELEMENT: Record<string, string> = {
  休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金',
};

const QIMEN_GOOD_DOORS = new Set(['开门', '休门', '生门']);
const QIMEN_BAD_DOORS = new Set(['死门', '惊门', '伤门']);

const QIMEN_JIXING_PALACE: Record<string, number> = {
  戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4,
};

const QIMEN_RUMU_PALACES: Record<string, number[]> = {
  乙: [6, 2], 丙: [6], 丁: [8], 戊: [6], 己: [8], 庚: [8], 辛: [4], 壬: [4], 癸: [2],
};

const QIMEN_BRANCH_PALACE: Record<string, number> = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6,
};

const QIMEN_JIA_DUN: Record<string, string> = {
  甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸',
};

function resolveQimenPalaceNum(g: { gong?: number; name: string } | undefined): number {
  if (!g) return 0;
  if (typeof g.gong === 'number') return g.gong;
  for (const [k, v] of Object.entries(QIMEN_PALACE_NAME_TO_NUM)) {
    if (g.name.includes(k.replace('宫', ''))) return v;
  }
  return 0;
}

function resolveQimenStem(ganzhiPillar: string | undefined): string {
  if (!ganzhiPillar) return '';
  const stem = ganzhiPillar[0] ?? '';
  if (stem === '甲') return QIMEN_JIA_DUN[ganzhiPillar] ?? '戊';
  return stem;
}

function inspectQimenPalaceFlags(
  palace: { gong?: number; name: string; element?: string; tianPan: { star: string; stem: string; companionStem?: string }; renPan: { door: string } } | undefined,
  voidPalaceNums: Set<number>,
): string[] {
  if (!palace) return [];
  const num = resolveQimenPalaceNum(palace);
  const pElem = palace.element || QIMEN_PALACE_ELEMENT[num] || '';
  const flags: string[] = [];
  const doorElem = QIMEN_DOOR_ELEMENT[palace.renPan.door];
  if (doorElem && pElem && WUXING_CONTROL[doorElem] === pElem) flags.push('门迫');
  const stems = [palace.tianPan.stem, palace.tianPan.companionStem].filter((s): s is string => Boolean(s));
  for (const st of stems) {
    if (QIMEN_JIXING_PALACE[st] === num) flags.push(`${st}击刑`);
    if (QIMEN_RUMU_PALACES[st]?.includes(num)) flags.push(`${st}入墓`);
  }
  if (voidPalaceNums.has(num)) flags.push('逢旬空');
  return [...new Set(flags)];
}

export function evaluateQimenSchoolAlgorithms(
  data: {
    method?: 'zhuanpan' | 'feipan';
    feipanMode?: 'star-only' | 'all-fly';
    juMethod?: 'chaibu' | 'zhirun' | 'maoshan';
    isYangDun: boolean;
    juShu: number;
    zhiFu: string;
    zhiShi: string;
    ganzhi?: { year?: string; month?: string; day?: string; hour?: string };
    voidBranches?: string[];
    voidPalaces?: Array<{ branch: string; palace: number; name: string }>;
    horseStar?: string | { palace?: number; palaceName?: string; branch?: string; sourceBranch?: string };
    patternTags?: string[];
    specialConditions?: {
      isShiGanRuMu?: boolean;
      isRiGanRuMu?: boolean;
      isWuBuYuShi?: boolean;
    };
    jiuGongGe: Array<{
      gong?: number;
      name: string;
      element?: string;
      tianPan: { star: string; stem: string; companionStar?: string; companionStem?: string };
      diPan: { stem: string };
      renPan: { door: string };
      shenPan: { god: string };
    }>;
  },
  schools: readonly ('gongwei' | 'geju' | 'zhuke')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const zhiFuPalace = data.jiuGongGe.find((g) => g.tianPan.star === data.zhiFu || g.tianPan.companionStar === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((g) => g.renPan.door === data.zhiShi);
  const voidPalaceNums = new Set<number>([
    ...(data.voidPalaces?.map((v) => v.palace) ?? []),
    ...(data.voidBranches?.map((b) => QIMEN_BRANCH_PALACE[b]).filter((n): n is number => Boolean(n)) ?? []),
  ]);

  const methodLabel = data.method === 'feipan'
    ? `飞盘法（${data.feipanMode === 'all-fly' ? '九星八门九神全飞' : '九星飞宫·门神环转'}）`
    : '转盘法';

  const dayStem = resolveQimenStem(data.ganzhi?.day);
  const hourStem = resolveQimenStem(data.ganzhi?.hour);
  const dayPalace = dayStem
    ? data.jiuGongGe.find((g) => g.tianPan.stem === dayStem || g.tianPan.companionStem === dayStem)
    : undefined;
  const hourPalace = hourStem
    ? data.jiuGongGe.find((g) => g.tianPan.stem === hourStem || g.tianPan.companionStem === hourStem)
    : undefined;

  const dayElem = dayPalace ? (dayPalace.element || QIMEN_PALACE_ELEMENT[resolveQimenPalaceNum(dayPalace)] || '') : '';
  const hourElem = hourPalace ? (hourPalace.element || QIMEN_PALACE_ELEMENT[resolveQimenPalaceNum(hourPalace)] || '') : '';
  const zfElem = zhiFuPalace ? (zhiFuPalace.element || QIMEN_PALACE_ELEMENT[resolveQimenPalaceNum(zhiFuPalace)] || '') : '';
  const zsElem = zhiShiPalace ? (zhiShiPalace.element || QIMEN_PALACE_ELEMENT[resolveQimenPalaceNum(zhiShiPalace)] || '') : '';

  const dayFlags = inspectQimenPalaceFlags(dayPalace, voidPalaceNums);
  const hourFlags = inspectQimenPalaceFlags(hourPalace, voidPalaceNums);
  const zfFlags = inspectQimenPalaceFlags(zhiFuPalace, voidPalaceNums);
  const zsFlags = inspectQimenPalaceFlags(zhiShiPalace, voidPalaceNums);

  const dayHourRel = dayPalace && hourPalace ? compareWuxing(dayElem, hourElem) : '未明';
  const dayHourDesc = dayPalace && hourPalace
    ? `日干${dayStem}落${dayPalace.name}(${dayPalace.renPan.door}${dayFlags.length ? `·${dayFlags.join('/')}` : ''})，时干${hourStem}落${hourPalace.name}(${hourPalace.renPan.door}${hourFlags.length ? `·${hourFlags.join('/')}` : ''})：${
      dayHourRel === '客生主' ? '时干宫生日干宫（事来就我·偏利成事）'
        : dayHourRel === '比和' ? '日时同宫或比和（主客相合·易推进）'
          : dayHourRel === '主克客' ? '日干宫克时干宫（我方主导可控·需亲力推促）'
            : dayHourRel === '主生客' ? '日干宫生时干宫（我方投入偏多·宜控成本）'
              : dayHourRel === '客克主' ? '时干宫克日干宫（事来克我·阻力偏大）'
                : '日时五行平势'
    }`
    : `值符${data.zhiFu}落${zhiFuPalace?.name ?? '中宫寄位'}，值使${data.zhiShi}落${zhiShiPalace?.name ?? '中宫寄位'}`;

  const zfZsRel = zhiFuPalace && zhiShiPalace ? compareWuxing(zfElem, zsElem) : '未明';
  const zfZsDesc = zfZsRel === '主生客'
    ? '值符生值使（顶层谋划助力执行落地）'
    : zfZsRel === '客生主'
      ? '值使生值符（行动反哺大局）'
      : zfZsRel === '比和'
        ? '值符值使比和（谋划与执行同频）'
        : zfZsRel === '主克客'
          ? '值符克值使（统筹约束执行，推进偏紧）'
          : zfZsRel === '客克主'
            ? '值使克值符（执行反制计划，易生中途改弦）'
            : '值符值使平势';

  const allCriticalFlags = [
    ...dayFlags.map((f) => `日干宫${f}`),
    ...hourFlags.map((f) => `时干宫${f}`),
    ...zsFlags.map((f) => `值使宫${f}`),
    ...(data.specialConditions?.isWuBuYuShi ? ['五不遇时'] : []),
    ...(data.specialConditions?.isShiGanRuMu ? ['时干入墓'] : []),
  ];
  const uniqueFlags = [...new Set(allCriticalFlags)];
  const hasGoodDoor = Boolean(
    (hourPalace && QIMEN_GOOD_DOORS.has(hourPalace.renPan.door))
    || (zhiShiPalace && QIMEN_GOOD_DOORS.has(zhiShiPalace.renPan.door)),
  );
  const hasBadDoor = Boolean(hourPalace && QIMEN_BAD_DOORS.has(hourPalace.renPan.door));

  const outcomeVerdict = (() => {
    if (uniqueFlags.length >= 2 || data.specialConditions?.isWuBuYuShi) {
      return `成败裁定：关键宫位叠加「${uniqueFlags.slice(0, 4).join('、')}」，阻碍与损耗明显，不宜贸然硬推，须先避忌化解`;
    }
    if ((dayHourRel === '客生主' || dayHourRel === '比和' || dayHourRel === '主克客') && hasGoodDoor && uniqueFlags.length === 0) {
      return '成败裁定：吉门得位且日时生比可控、无门迫击刑入墓拖累，整体成象偏顺';
    }
    if (uniqueFlags.length === 1 || hasBadDoor || dayHourRel === '客克主') {
      return `成败裁定：盘面见「${[...uniqueFlags, ...(dayHourRel === '客克主' ? ['时克日'] : []), ...(hasBadDoor && hourPalace ? [`时干临${hourPalace.renPan.door}`] : [])].join('、')}」，主先阻后调、须按条件补救方能推进`;
    }
    return '成败裁定：盘面吉凶持衡，宜借吉门方与主动协调逐步落实';
  })();

  const horseLabel = typeof data.horseStar === 'string'
    ? data.horseStar
    : data.horseStar
      ? `${data.horseStar.palaceName ?? ''}${data.horseStar.branch ? `(${data.horseStar.branch})` : ''}`
      : '无';

  const timingHints: string[] = [];
  if (uniqueFlags.some((f) => f.includes('旬空'))) timingHints.push('逢空以出空填实或对宫冲实之时应验');
  if (uniqueFlags.some((f) => f.includes('入墓'))) timingHints.push('入墓须待冲墓之日/时方解滞塞');
  if (uniqueFlags.some((f) => f.includes('门迫') || f.includes('击刑'))) timingHints.push('门迫击刑宜待相冲化解或转换方位后动');
  if (horseLabel !== '无') timingHints.push(`马星临${horseLabel}主事态动速偏快或有行程变动`);
  if (!timingHints.length) timingHints.push('未见空墓滞阻，应期可按值使宫数及日时落宫地支值临参断');

  // 门迫 / 击刑 / 入墓 / 旬空 / 五不遇时 扣分与吉凶倾向量化
  const flagPenalty = (flags: string[]): number =>
    flags.reduce((acc, f) => {
      if (f.includes('门迫')) return acc + 12;
      if (f.includes('击刑')) return acc + 12;
      if (f.includes('入墓')) return acc + 10;
      if (f.includes('旬空')) return acc + 8;
      if (f.includes('五不遇时')) return acc + 18;
      return acc + 6;
    }, 0);

  const totalPenalty = flagPenalty(uniqueFlags);
  const doorBonus = hasGoodDoor ? 12 : hasBadDoor ? -10 : 0;
  const dayHourBonus = dayHourRel === '客生主'
    ? 14
    : dayHourRel === '比和'
      ? 10
      : dayHourRel === '主克客'
        ? 5
        : dayHourRel === '主生客'
          ? -4
          : dayHourRel === '客克主'
            ? -14
            : 0;
  const zfZsBonus = zfZsRel === '主生客' || zfZsRel === '客生主'
    ? 8
    : zfZsRel === '比和'
      ? 6
      : zfZsRel === '客克主'
        ? -10
        : zfZsRel === '主克客'
          ? -4
          : 0;

  // 盘式侧重：转盘重星门落宫迫刑墓空、飞盘重全宫飞动连环、阴遁偏重守成暗动
  const panStyleTag = data.method === 'feipan'
    ? '飞盘'
    : data.isYangDun
      ? '阳遁转盘'
      : '阴遁转盘';
  const gongweiScore = clampScore(68 + doorBonus + Math.round(dayHourBonus * 0.6) - totalPenalty);
  const gejuPatternBonus = Math.min(12, (data.patternTags?.length ?? 0) * 3);
  const gejuScore = clampScore(64 + doorBonus + gejuPatternBonus - Math.round(totalPenalty * 1.15));
  const zhukeScore = clampScore(62 + dayHourBonus + zfZsBonus - Math.round(totalPenalty * 0.5) + (data.isYangDun ? 3 : -2));

  const qimenTone = (score: number, prefix: string): string =>
    score >= 70 ? `${prefix}·偏顺可进` : score >= 50 ? `${prefix}·吉凶互见` : `${prefix}·弊病偏重宜避`;

  const qimenFav: string[] = [];
  if (hasGoodDoor) qimenFav.push(`得三吉门（${hourPalace?.renPan.door ?? zhiShiPalace?.renPan.door ?? ''}）`);
  if (dayHourRel === '客生主' || dayHourRel === '比和') qimenFav.push('日时生比可控');
  if (zfZsRel === '主生客' || zfZsRel === '客生主' || zfZsRel === '比和') qimenFav.push(zfZsDesc);
  if (uniqueFlags.length === 0) qimenFav.push('关键宫无门迫击刑入墓空亡');

  return unique.map((school) => {
    if (school === 'gongwei') {
      return {
        school,
        label: '宫位星门神仪派口径',
        ruleFocus: '核对转/飞盘式、值符值使与日干时干落宫生克，严辨门迫/击刑/入墓/空亡',
        findings: [
          `盘式：${methodLabel}·${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}落${zhiFuPalace?.name ?? '中宫寄位'}（${zhiFuPalace?.tianPan.stem ?? ''}/${zhiFuPalace?.diPan.stem ?? ''}，${zhiFuPalace?.shenPan.god ?? ''}${zfFlags.length ? `·${zfFlags.join('/')}` : ''}）；值使${data.zhiShi}落${zhiShiPalace?.name ?? '中宫寄位'}（${zsFlags.length ? zsFlags.join('/') : '无迫刑空墓'}，空亡${data.voidBranches?.join('、') || '无'}，马星${horseLabel}）`,
          dayHourDesc,
          `${outcomeVerdict}；应期指向：${timingHints.join('；')}`,
        ],
        structuredVerdict: {
          stance: qimenTone(gongweiScore, `${panStyleTag}宫位核验`),
          primaryFocus: '星门落宫与门迫/击刑/入墓/空亡扣分',
          favorableSignals: qimenFav.length ? qimenFav : ['宫位能量持平'],
          riskSignals: uniqueFlags,
          score: gongweiScore,
          keyConclusion: `${panStyleTag}迫刑墓空扣分-${totalPenalty}，宫位吉凶分${gongweiScore}/100；${outcomeVerdict.replace(/^成败裁定：/, '')}`,
        },
      };
    }
    if (school === 'geju') {
      return {
        school,
        label: '吉凶格局派口径',
        ruleFocus: '辨别全局吉凶格局与门迫、击刑、入墓、空亡对成败的实质权重',
        findings: [
          `全局格局：${data.patternTags?.slice(0, 8).join('、') || '未见特殊全局标签（按日时与值使星门组合直断）'}`,
          `关键弊病核验：${uniqueFlags.length ? uniqueFlags.join('、') : '日干/时干/值使未见门迫、击刑、入墓或旬空'}`,
          `${outcomeVerdict}；应期指向：${timingHints.join('；')}`,
        ],
        structuredVerdict: {
          stance: qimenTone(gejuScore, '格局净值'),
          primaryFocus: '全局吉凶格局与关键弊病实质权重',
          favorableSignals: [
            ...(data.patternTags?.length ? [`全局格局：${data.patternTags.slice(0, 4).join('、')}`] : []),
            ...qimenFav.slice(0, 2),
          ],
          riskSignals: uniqueFlags,
          score: gejuScore,
          keyConclusion: `格局加权+${gejuPatternBonus}、弊病重扣-${Math.round(totalPenalty * 1.15)}，格局分${gejuScore}/100。`,
        },
      };
    }
    return {
      school,
      label: '主客动静派口径',
      ruleFocus: '以阴阳遁、天盘为客、地盘为主及值符值使、日干时干生克定主客胜负',
      findings: [
        `${methodLabel}·${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局（${data.isYangDun ? '阳遁利客先动' : '阴遁利主后发'}）；${zfZsDesc}`,
        dayHourDesc,
        outcomeVerdict,
      ],
      structuredVerdict: {
        stance: `${data.isYangDun ? '阳遁利客先动' : '阴遁利主后发'}·${zhukeScore >= 65 ? '主客顺协' : zhukeScore >= 48 ? '主客拉锯' : '主客受制'}`,
        primaryFocus: '阴阳遁动静先机与日时/符使主客生克',
        favorableSignals: [
          data.isYangDun ? '阳遁宜主动出击' : '阴遁宜稳守后发',
          ...(dayHourBonus > 0 ? ['日时关系向我'] : []),
          ...(zfZsBonus > 0 ? ['符使相生比和'] : []),
        ],
        riskSignals: [
          ...(dayHourBonus < 0 ? ['时干宫克泄日干宫'] : []),
          ...(zfZsBonus < 0 ? ['符使相克易改弦'] : []),
          ...uniqueFlags.slice(0, 2),
        ],
        score: zhukeScore,
        keyConclusion: `${data.isYangDun ? '阳遁利客' : '阴遁利主'}，主客态势分${zhukeScore}/100；${zfZsDesc}。`,
      },
    };
  });
}

const ZIWEI_SIX_GOOD = new Set(['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马']);
const ZIWEI_SIX_SHA = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);
const ZIWEI_SELF_PALACES = new Set(['命宫', '财帛', '官禄', '疾厄', '田宅', '福德']);

export function evaluateZiweiSchoolAlgorithms(
  data: {
    natal: {
      soulBranch: string;
      bodyBranch: string;
      chineseDate: string;
      patterns?: Array<{ name: string; category?: string }>;
      palaces: Array<{
        index: number;
        name: string;
        heavenlyStem: string;
        earthlyBranch: string;
        majorStars: Array<{ name: string; brightness?: string; mutagen?: string }>;
        minorStars: Array<{ name: string; mutagen?: string }>;
        adjectiveStars?: Array<{ name: string }>;
        mutagens?: Array<{ star: string; mutagen: string; targetPalaceName?: string }>;
      }>;
    };
    reference?: {
      layers?: {
        decadal?: {
          index: number;
          heavenlyStem: string;
          earthlyBranch: string;
          mutagen?: string[];
          mutagenPlacements?: Array<{ mutagen: string; star: string; natalPalaceName?: string; scopePalaceName?: string }>;
          stars?: Array<Array<{ name: string }>>;
        };
        yearly?: {
          index: number;
          heavenlyStem: string;
          earthlyBranch: string;
          mutagen?: string[];
          mutagenPlacements?: Array<{ mutagen: string; star: string; natalPalaceName?: string; scopePalaceName?: string }>;
          stars?: Array<Array<{ name: string }>>;
        };
      };
    } | null;
  },
  schools: readonly ('sanhe' | 'feixing' | 'sihua' | 'zhongzhou')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const palaces = data.natal.palaces;
  const mingPalace = palaces.find((p) => p.name === '命宫') ?? palaces[0];
  const birthStem = data.natal.chineseDate.slice(0, 1);

  const sanfangIndices = [0, 4, 8, 6].map((offset) => (mingPalace.index + offset) % 12);
  const sanfangPalaces = sanfangIndices.map((idx) => palaces[idx]).filter(Boolean);

  // 统计三方四正庙旺、吉煞与生年四化
  let brightCount = 0;
  let weakCount = 0;
  let emptyCount = 0;
  const goodHits: string[] = [];
  const shaHits: string[] = [];
  const sanfangMutagens: string[] = [];
  const sanfangJi: string[] = [];
  const sanfangLuQuanKe: string[] = [];

  for (const p of sanfangPalaces) {
    if (p.majorStars.length === 0) emptyCount += 1;
    for (const s of p.majorStars) {
      if (s.brightness === '庙' || s.brightness === '旺' || s.brightness === '得') brightCount += 1;
      if (s.brightness === '陷') weakCount += 1;
      if (s.mutagen) {
        const tag = `${p.name}${s.name}化${s.mutagen}`;
        sanfangMutagens.push(tag);
        if (s.mutagen === '忌') sanfangJi.push(tag);
        else sanfangLuQuanKe.push(tag);
      }
    }
    for (const s of p.minorStars) {
      if (ZIWEI_SIX_GOOD.has(s.name)) goodHits.push(`${p.name}${s.name}`);
      if (ZIWEI_SIX_SHA.has(s.name)) shaHits.push(`${p.name}${s.name}`);
      if (s.mutagen) {
        const tag = `${p.name}${s.name}化${s.mutagen}`;
        sanfangMutagens.push(tag);
        if (s.mutagen === '忌') sanfangJi.push(tag);
        else sanfangLuQuanKe.push(tag);
      }
    }
  }

  // 运限叠宫摘要（大限 / 流年）
  const decadalLayer = data.reference?.layers?.decadal;
  const yearlyLayer = data.reference?.layers?.yearly;
  const decadalPalace = decadalLayer ? palaces[decadalLayer.index] : undefined;
  const yearlyPalace = yearlyLayer ? palaces[yearlyLayer.index] : undefined;

  const overlapSummary = (() => {
    const parts: string[] = [];
    if (decadalLayer && decadalPalace) {
      const inSanfang = sanfangIndices.includes(decadalLayer.index);
      const decLu = decadalLayer.mutagenPlacements?.find((m) => m.mutagen === '禄');
      const decJi = decadalLayer.mutagenPlacements?.find((m) => m.mutagen === '忌');
      parts.push(
        `大限(${decadalLayer.heavenlyStem}${decadalLayer.earthlyBranch})叠本命${decadalPalace.name}${inSanfang ? '（直入命财官迁主轴）' : ''}${decLu?.natalPalaceName ? `，大限禄入${decLu.natalPalaceName}` : ''}${decJi?.natalPalaceName ? `、大限忌入${decJi.natalPalaceName}` : ''}`,
      );
    }
    if (yearlyLayer && yearlyPalace) {
      const yrLu = yearlyLayer.mutagenPlacements?.find((m) => m.mutagen === '禄');
      const yrJi = yearlyLayer.mutagenPlacements?.find((m) => m.mutagen === '忌');
      parts.push(
        `流年(${yearlyLayer.heavenlyStem}${yearlyLayer.earthlyBranch})叠本命${yearlyPalace.name}${yrLu?.natalPalaceName ? `，流年禄入${yrLu.natalPalaceName}` : ''}${yrJi?.natalPalaceName ? `、流年忌入${yrJi.natalPalaceName}` : ''}`,
      );
    }
    return parts.join('；');
  })();

  return unique.map((school) => {
    if (school === 'sanhe') {
      const sanfangSummary = sanfangPalaces
        .map((p) => {
          const opp = palaces[(p.index + 6) % 12];
          const stars = p.majorStars.length
            ? p.majorStars.map((s) => `${s.name}${s.brightness ?? ''}${s.mutagen ? `化${s.mutagen}` : ''}`).join('、')
            : `空宫借${opp?.name ?? '对宫'}(${opp?.majorStars.map((s) => s.name).join('、') || '无'})`;
          return `${p.name}(${stars})`;
        })
        .join('；');
      const patternNames = data.natal.patterns?.slice(0, 6).map((p) => p.name).join('、') || '未见特殊格局';
      const sanheVerdict = (() => {
        const netGood = goodHits.length + sanfangLuQuanKe.length;
        const netSha = shaHits.length + sanfangJi.length * 2;
        if (brightCount >= 2 && netGood > netSha && weakCount === 0) {
          return '三方庙旺吉多煞轻，格局成象有力，主根基稳健可担大任';
        }
        if (shaHits.length > 0 || sanfangJi.length > 0) {
          return netGood > 0
            ? `三方见煞忌（${[...shaHits.slice(0, 3), ...sanfangJi].join('、')}）冲破，幸有吉曜/吉化（${[...goodHits.slice(0, 3), ...sanfangLuQuanKe].join('、')}）救应，属成中有破、劳中得成之格`
            : `三方煞忌偏重（${[...shaHits.slice(0, 3), ...sanfangJi].join('、')}）且缺少吉曜救应，易生起伏阻滞，宜借运限扶助稳步推进`;
        }
        if (emptyCount >= 2 || weakCount > brightCount) {
          return '三方正星偏弱或空宫较多，格局偏依外缘借力与后天运限催发';
        }
        return '三方强弱中和，格局平稳，成败重在行运引动';
      })();
      const sanheScore = clampScore(
        56 + brightCount * 7 + goodHits.length * 5 + sanfangLuQuanKe.length * 6 - weakCount * 7 - shaHits.length * 6 - sanfangJi.length * 10 - emptyCount * 3,
      );
      const sanheStance = sanheScore >= 72
        ? '三方庙旺吉多煞轻'
        : shaHits.length > 0 || sanfangJi.length > 0
          ? (goodHits.length + sanfangLuQuanKe.length > 0 ? '成中有破·吉煞交战' : '三方煞忌偏重')
          : '三方中和待运';
      return {
        school,
        label: '三合派口径',
        ruleFocus: '重命财官迁三方四正强弱、格局成败、煞忌冲破与吉曜救应及运限叠宫',
        findings: [
          `三方四正主星：${sanfangSummary}`,
          `吉煞与四化配置：吉曜${goodHits.length}颗（${goodHits.slice(0, 5).join('、') || '无'}），煞曜${shaHits.length}颗（${shaHits.slice(0, 5).join('、') || '无'}）${sanfangMutagens.length ? `，生年四化见${sanfangMutagens.join('、')}` : ''}`,
          `本命格局：${patternNames}；成败裁定：${sanheVerdict}`,
          ...(overlapSummary ? [`运限叠宫裁定：${overlapSummary}`] : []),
        ],
        structuredVerdict: {
          stance: sanheStance,
          primaryFocus: '命财官迁三方四正庙旺与吉煞成败',
          favorableSignals: [
            ...(brightCount > 0 ? [`三方庙旺得地主星${brightCount}颗`] : []),
            ...(goodHits.length ? [`吉曜护持(${goodHits.length}颗)：${goodHits.slice(0, 3).join('、')}`] : []),
            ...(sanfangLuQuanKe.length ? [`三方吉化：${sanfangLuQuanKe.join('、')}`] : []),
          ],
          riskSignals: [
            ...(weakCount > 0 ? [`落陷主星${weakCount}颗`] : []),
            ...(shaHits.length ? [`煞曜冲破(${shaHits.length}颗)：${shaHits.slice(0, 3).join('、')}`] : []),
            ...(sanfangJi.length ? [`三方见忌：${sanfangJi.join('、')}`] : []),
          ],
          score: sanheScore,
          keyConclusion: `三合庙旺吉煞分${sanheScore}/100（庙旺${brightCount}/落陷${weakCount}，吉${goodHits.length}/煞${shaHits.length}）；${sanheVerdict}`,
        },
      };
    }
    if (school === 'feixing') {
      const selfMutagens: string[] = [];
      const centripetalHits: string[] = [];
      const coreTracks: string[] = [];
      const coreNames = new Set(['命宫', '财帛', '官禄', '迁移']);
      for (const p of palaces) {
        const stars = [...p.majorStars, ...p.minorStars];
        const opp = palaces[(p.index + 6) % 12];
        const oppStars = opp ? [...opp.majorStars, ...opp.minorStars] : [];
        for (const m of p.mutagens ?? []) {
          if (stars.some((s) => s.name === m.star)) {
            selfMutagens.push(`${p.name}(${p.heavenlyStem})离心自化${m.mutagen}(${m.star})`);
          } else if (opp && oppStars.some((s) => s.name === m.star)) {
            centripetalHits.push(`${p.name}(${p.heavenlyStem})化${m.mutagen}(${m.star})入对宫${opp.name}向心冲照`);
          }
          if (coreNames.has(p.name) && (m.mutagen === '禄' || m.mutagen === '忌') && m.targetPalaceName) {
            coreTracks.push(`${p.name}干${p.heavenlyStem}化${m.mutagen}入${m.targetPalaceName}`);
          }
        }
      }
      const selfJiCount = selfMutagens.filter((s) => s.includes('自化忌')).length;
      const selfLuCount = selfMutagens.filter((s) => s.includes('自化禄')).length;
      const coreLuCount = coreTracks.filter((t) => t.includes('化禄')).length;
      const coreJiCount = coreTracks.filter((t) => t.includes('化忌')).length;
      const feixingScore = clampScore(64 + centripetalHits.length * 5 + coreLuCount * 4 - selfJiCount * 12 - selfLuCount * 3 - coreJiCount * 4);
      const feixingStance = selfJiCount > 0
        ? `离心自化忌(${selfJiCount}处)·防耗散`
        : centripetalHits.length > 0
          ? `向心冲照活跃(${centripetalHits.length}处)·对宫联动`
          : '宫干飞化平稳·无显性自化忌';
      const feixingVerdict = selfMutagens.some((s) => s.includes('自化忌'))
        ? '盘面见离心自化忌，主对应宫位易有耗散或反复，须防资源外流并结合向心/飞禄补救'
        : centripetalHits.length
          ? '见对宫向心冲照脉络，主本宫与对宫互动频密，宜顺势借对宫资源转化'
          : '本命宫干自化干扰较轻，飞化脉络以命财官迁禄忌流向为主轴';
      return {
        school,
        label: '飞星派口径',
        ruleFocus: '重宫干四化飞星轨迹、离心/向心自化、对宫冲照与运限叠宫禄忌交会',
        findings: [
          `离心自化：${selfMutagens.slice(0, 6).join('、') || '未见本宫干离心自化'}`,
          `对宫冲照（向心）：${centripetalHits.slice(0, 5).join('、') || '未见本宫干直飞对宫向心冲照'}`,
          ...(coreTracks.length ? [`核心三方禄忌飞向：${coreTracks.slice(0, 6).join('；')}`] : []),
          `飞星裁定：${feixingVerdict}`,
          ...(overlapSummary ? [`运限叠宫飞化：${overlapSummary}`] : []),
        ],
        structuredVerdict: {
          stance: feixingStance,
          primaryFocus: '宫干离心自化与对宫向心冲照轨迹',
          favorableSignals: [
            ...(centripetalHits.length ? [`向心冲照${centripetalHits.length}处`] : []),
            ...(coreLuCount > 0 ? [`核心宫干飞禄${coreLuCount}条`] : []),
            ...(selfJiCount === 0 ? ['无离心自化忌耗散'] : []),
          ],
          riskSignals: [
            ...(selfJiCount > 0 ? [`离心自化忌${selfJiCount}处`] : []),
            ...(selfLuCount > 0 ? [`离心自化禄${selfLuCount}处（主外散）`] : []),
            ...(coreJiCount > 0 ? [`核心宫干飞忌${coreJiCount}条`] : []),
          ],
          score: feixingScore,
          keyConclusion: `离心自化${selfMutagens.length}处（忌${selfJiCount}）、向心冲照${centripetalHits.length}处，飞星稳健分${feixingScore}/100。`,
        },
      };
    }
    if (school === 'sihua') {
      const birthMutagens: Array<{ star: string; mutagen: string; palace: string }> = [];
      for (const p of palaces) {
        for (const s of [...p.majorStars, ...p.minorStars]) {
          if (s.mutagen) birthMutagens.push({ star: s.name, mutagen: s.mutagen, palace: p.name });
        }
      }
      const laiyinCandidates = palaces.filter((p) => p.heavenlyStem === birthStem);
      const laiyinPalace = laiyinCandidates.find((p) => p.earthlyBranch !== '子' && p.earthlyBranch !== '丑') ?? laiyinCandidates[0];
      const selfHits = birthMutagens.filter((m) => ZIWEI_SELF_PALACES.has(m.palace));
      const otherHits = birthMutagens.filter((m) => !ZIWEI_SELF_PALACES.has(m.palace));
      const jiEntry = birthMutagens.find((m) => m.mutagen === '忌');
      const luEntry = birthMutagens.find((m) => m.mutagen === '禄');
      const sihuaVerdict = (() => {
        const notes: string[] = [];
        if (luEntry) {
          notes.push(`生年禄落${luEntry.palace}（${ZIWEI_SELF_PALACES.has(luEntry.palace) ? '我宫得禄，主自主聚财得缘' : '他宫见禄，主资源外显或利人际合作'}）`);
        }
        if (jiEntry) {
          notes.push(`生年忌落${jiEntry.palace}（${ZIWEI_SELF_PALACES.has(jiEntry.palace) ? '我宫收藏粘滞，主执着深耕亦防内耗' : '他宫冲照我宫，须防外缘牵制损耗'}）`);
        }
        if (!notes.length) notes.push('本盘未列显性生年四化，以宫干飞化与运限四化为主');
        return notes.join('；');
      })();
      const luInSelf = Boolean(luEntry && ZIWEI_SELF_PALACES.has(luEntry.palace));
      const jiInSelf = Boolean(jiEntry && ZIWEI_SELF_PALACES.has(jiEntry.palace));
      const sihuaScore = clampScore(
        58 + (luInSelf ? 14 : luEntry ? 6 : 0) + (jiInSelf ? 4 : jiEntry ? -12 : 0) + (selfHits.length - otherHits.length) * 3,
      );
      const sihuaStance = luInSelf && jiInSelf
        ? '我宫得禄藏忌·自主聚敛'
        : luInSelf && !jiInSelf
          ? '我宫得禄·防他宫生年忌冲'
          : !luInSelf && jiInSelf
            ? '他宫见禄·我宫藏忌深耕'
            : '四化偏落他宫·重外缘互动';
      return {
        school,
        label: '钦天四化派口径',
        ruleFocus: '重来因宫立极、生年四化我宫/他宫归属与运限叠宫引动',
        findings: [
          `生年天干「${birthStem}」对应来因宫：${laiyinPalace ? `${laiyinPalace.name}(${laiyinPalace.heavenlyStem}${laiyinPalace.earthlyBranch})` : '未在所列宫干中检出（按生年四化落宫直断）'}`,
          `生年四化落宫：${birthMutagens.map((m) => `${m.star}化${m.mutagen}落${m.palace}`).join('、') || '未见显性生年四化'}（我宫${selfHits.length}项／他宫${otherHits.length}项）`,
          `四化裁定：${sihuaVerdict}`,
          ...(overlapSummary ? [`运限引动：${overlapSummary}`] : []),
        ],
        structuredVerdict: {
          stance: sihuaStance,
          primaryFocus: '来因宫立极与生年四化我他宫归属',
          favorableSignals: [
            ...(laiyinPalace ? [`来因宫立于${laiyinPalace.name}`] : []),
            ...(luEntry ? [`生年禄落${luEntry.palace}(${luInSelf ? '我宫' : '他宫'})`] : []),
            `我宫承接四化${selfHits.length}项`,
          ],
          riskSignals: [
            ...(jiEntry && !jiInSelf ? [`生年忌落他宫${jiEntry.palace}防冲我宫`] : []),
            ...(jiEntry && jiInSelf ? [`生年忌落我宫${jiEntry.palace}防执着内耗`] : []),
          ],
          score: sihuaScore,
          keyConclusion: `我宫${selfHits.length}项 vs 他宫${otherHits.length}项，钦天四化归属分${sihuaScore}/100；${sihuaVerdict}`,
        },
      };
    }
    const isEmptyMing = mingPalace.majorStars.length === 0;
    const oppPalace = palaces[(mingPalace.index + 6) % 12];
    const prevPalace = palaces[(mingPalace.index + 11) % 12];
    const nextPalace = palaces[(mingPalace.index + 1) % 12];
    const adjStars = [...(prevPalace?.minorStars ?? []), ...(nextPalace?.minorStars ?? [])].map((s) => s.name);
    const hasGoodClamp = (adjStars.includes('左辅') && adjStars.includes('右弼'))
      || (adjStars.includes('文昌') && adjStars.includes('文曲'))
      || (adjStars.includes('天魁') && adjStars.includes('天钺'));
    const hasShaClamp = (adjStars.includes('擎羊') && adjStars.includes('陀罗'))
      || (adjStars.includes('火星') && adjStars.includes('铃星'))
      || (adjStars.includes('地空') && adjStars.includes('地劫'));
    const adjSummary = [prevPalace, nextPalace]
      .filter(Boolean)
      .map((p) => `${p.name}[${p.minorStars.map((s) => s.name).slice(0, 3).join('、') || '无辅煞'}]`)
      .join(' 夹 ');
    const clampVerdict = hasGoodClamp && !hasShaClamp
      ? '邻宫呈吉曜夹命，主得左右助力护持'
      : hasShaClamp && !hasGoodClamp
        ? '邻宫见煞星夹命，须防环境挤压与突发阻滞'
        : hasGoodClamp && hasShaClamp
          ? '邻宫吉煞并夹，主机会与压力并存'
          : '邻宫无成对吉煞夹命，重本宫双星组合与对宫牵动';
    const adjGoodCount = adjStars.filter((s) => ZIWEI_SIX_GOOD.has(s)).length;
    const adjShaCount = adjStars.filter((s) => ZIWEI_SIX_SHA.has(s)).length;
    const zhongzhouScore = clampScore(
      58 + (hasGoodClamp ? 18 : 0) - (hasShaClamp ? 18 : 0) + (adjGoodCount - adjShaCount) * 4 + (isEmptyMing ? -4 : 4),
    );
    const zhongzhouStance = hasGoodClamp && !hasShaClamp
      ? '吉曜夹命·助力强'
      : hasShaClamp && !hasGoodClamp
        ? '煞星夹命·承压重'
        : hasGoodClamp && hasShaClamp
          ? '吉煞并夹·机压并存'
          : isEmptyMing
            ? '命宫借星·依对宫转化'
            : '星系常规·重双星组合';
    return {
      school,
      label: '中州派口径',
      ruleFocus: '重对宫借星、双星组合、邻宫夹辅与运限叠宫流曜冲照',
      findings: [
        isEmptyMing
          ? `命宫(${mingPalace.earthlyBranch})为空宫，借对宫${oppPalace.name}(${oppPalace.majorStars.map((s) => s.name).join('、') || '无'})`
          : `命宫(${mingPalace.earthlyBranch})正星：${mingPalace.majorStars.map((s) => `${s.name}${s.brightness ?? ''}`).join('、')}`,
        `邻宫夹辅：${adjSummary}（${clampVerdict}）`,
        ...(overlapSummary ? [`运限叠宫：${overlapSummary}`] : []),
      ],
      structuredVerdict: {
        stance: zhongzhouStance,
        primaryFocus: '邻宫夹辅强弱与本对宫星系转化',
        favorableSignals: [
          ...(hasGoodClamp ? ['成对吉曜夹命'] : []),
          ...(adjGoodCount > 0 ? [`邻宫吉辅${adjGoodCount}颗`] : []),
          ...(!isEmptyMing ? [`本宫坐守${mingPalace.majorStars.map((s) => s.name).join('、')}`] : []),
        ],
        riskSignals: [
          ...(hasShaClamp ? ['成对煞星夹命'] : []),
          ...(adjShaCount > 0 ? [`邻宫见煞${adjShaCount}颗`] : []),
          ...(isEmptyMing ? ['命宫空宫须借对宫'] : []),
        ],
        score: zhongzhouScore,
        keyConclusion: `中州夹辅强弱分${zhongzhouScore}/100（邻宫吉${adjGoodCount}/煞${adjShaCount}）；${clampVerdict}`,
      },
    };
  });
}

export function evaluateBazhaiSchoolAlgorithms(
  data: {
    persons: Array<{ gua: string; group: string; year: number | null }>;
    houses: Array<{ sitMountain: string; facingMountain: string; houseGua: string }>;
    comparisons: Array<{
      mingGua: string;
      sitMountain: string;
      houseGua: string;
      match: string;
      directions: Array<{ direction: string; ming: string; mingLuck: string; house: string; houseLuck: string }>;
    }>;
  },
  schools: readonly ('bazhaimingjing' | 'yangzhaisanyao')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const person = data.persons[0];
  const house = data.houses[0];
  const comp = data.comparisons[0];
  return unique.map((school) => {
    if (school === 'bazhaimingjing') {
      return {
        school,
        label: '《八宅明镜》口径',
        ruleFocus: '以人宅命卦与宅卦东四西四相配、游年翻卦四吉四凶为主',
        findings: [
          person ? `命卦${person.gua}（${person.group}）` : '未提供命卦',
          comp ? `与${comp.sitMountain}山${comp.houseGua}宅「${comp.match}」` : house ? `宅卦${house.sitMountain}山${house.houseGua}宅` : '未提供坐山',
        ],
      };
    }
    const houseGood = comp?.directions.filter((d) => d.houseLuck === '吉').map((d) => `${d.direction}(${d.house})`).join('、');
    return {
      school,
      label: '《阳宅三要》口径',
      ruleFocus: '以大门、主房、灶位三要方位五行生克与静宅动变为核验重点',
      findings: [
        house ? `${house.sitMountain}山${house.facingMountain}向（${house.houseGua}宅）` : '未指定坐山，按命卦四吉方参考',
        houseGood ? `宅卦四吉方（宜门/主/灶）：${houseGood}` : '需结合实际门、主卧、灶口方位核对星宫生克',
      ],
    };
  });
}

export function evaluateXuankongSchoolAlgorithms(
  data: {
    charts: Array<{
      period: { yuan: string; yun: number };
      sitMountain: string;
      facingMountain: string;
      mode: string;
      formation: string;
      arrival: { shanToMountain: boolean; xiangToFacing: boolean };
      combinations: readonly { name: string }[];
    }>;
  },
  schools: readonly ('shenshi' | 'wuchang')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const first = data.charts[0];
  return unique.map((school) => {
    if (school === 'shenshi') {
      return {
        school,
        label: '沈氏玄空派口径',
        ruleFocus: '重九星挨排、山向旺衰格局（旺山旺向/上山下水）、令星入囚与组合格局',
        findings: first
          ? [
              `${first.period.yuan}${first.period.yun}运 ${first.sitMountain}山${first.facingMountain}向（${first.mode}）：${first.formation}`,
              `当令到山=${first.arrival.shanToMountain ? '是' : '否'}、到向=${first.arrival.xiangToFacing ? '是' : '否'}；组合：${first.combinations.map((c) => c.name).join('、') || '常规挨星'}`,
            ]
          : ['暂无候选盘面'],
      };
    }
    return {
      school,
      label: '无常派玄空口径',
      ruleFocus: '兼重下卦替卦挨星、城门诀纳气及山向交界跨运校验',
      findings: first
        ? [
            `当前采用「${first.mode}」起星；共产生 ${data.charts.length} 个候选盘面供交界复核`,
          ]
        : ['暂无候选盘面'],
    };
  });
}

export function evaluateAstrolabeSchoolAlgorithms(
  data: {
    basis: { dayChart: boolean; houseSystem: string };
    points: Array<{ name: string; sign: string; house: number; retrograde?: boolean }>;
    distributions: {
      retrograde: Array<{ name: string }>;
    };
    aspects: readonly unknown[];
    flow?: unknown;
  },
  schools: readonly ('modern' | 'traditional' | 'hellenistic' | 'timing')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const outer = data.points
    .filter((p) => ['天王星', '海王星', '冥王星'].includes(p.name))
    .map((p) => `${p.name}落${p.sign}${p.house}宫`)
    .join('、');
  const classical = data.points
    .filter((p) => ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星'].includes(p.name))
    .map((p) => `${p.name}(${p.sign}${p.house}宫${p.retrograde ? '逆' : ''})`)
    .join('、');
  return unique.map((school) => {
    if (school === 'modern') {
      return {
        school,
        label: '现代心理占星口径',
        ruleFocus: '重四元素/三模式分布、外行星（天海冥）代际课题与相位格局',
        findings: [
          `共 ${data.aspects.length} 个本命相位；逆行星体：${data.distributions.retrograde.map((r) => r.name).join('、') || '无'}`,
          `外行星落座：${outer || '未列'}`,
        ],
      };
    }
    if (school === 'traditional') {
      return {
        school,
        label: '传统古典占星口径',
        ruleFocus: '重昼夜盘区分、七大古典星体庙旺陷落、宫主星飞宫与互溶接纳',
        findings: [
          `盘型：${data.basis.dayChart ? '昼盘' : '夜盘'}（${data.basis.houseSystem} 宫位制）`,
          `古典七政：${classical}`,
        ],
      };
    }
    if (school === 'hellenistic') {
      const sectTeam = data.basis.dayChart ? '昼盘阵营（日、木、土得时；火星为夜星易显张力）' : '夜盘阵营（月、金、火得时；土星为昼星易显张力）';
      const fortune = data.points.find((p) => p.name.includes('福点'));
      return {
        school,
        label: '希腊古典占星口径',
        ruleFocus: '重昼夜星体阵营（Sect）、整宫主星与阿拉伯点（福点）定位',
        findings: [
          `昼夜阵营：${sectTeam}`,
          fortune ? `福点落位：${fortune.sign}第${fortune.house}宫` : '福点按已列计算点核对',
        ],
      };
    }
    return {
      school,
      label: '推运时机口径',
      ruleFocus: '依据行运、太阳返照、次限与太阳弧快照核对阶段窗口',
      findings: [
        data.flow ? '已计算指定参考瞬时推运快照，可按实际触及相位论断' : '未提供推运参考时刻，仅限本命结构分析',
      ],
    };
  });
}

export function evaluateTaiyiSchoolAlgorithms(
  data: {
    scope: string;
    taiyiPalace?: number | string;
    lordGeneral?: string | number;
    guestGeneral?: string | number;
    evidenceAnalysis?: {
      calculationSteps: Array<{ key: string; promptText: string }>;
      counterEvidenceFacts: Array<{ promptText: string }>;
    };
  },
  schools: readonly ('zhuke' | 'gongwei' | 'jisuan')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'zhuke') {
      return {
        school,
        label: '主客定算派口径',
        ruleFocus: '重主算、客算、定算对比与主客大将、参将胜负态势',
        findings: [
          `主将「${data.lordGeneral ?? '未列'}」 vs 客将「${data.guestGeneral ?? '未列'}」`,
          ...(data.evidenceAnalysis?.calculationSteps.slice(0, 2).map((s) => s.promptText) ?? []),
        ],
      };
    }
    if (school === 'gongwei') {
      return {
        school,
        label: '宫位神将派口径',
        ruleFocus: '重太乙落宫、文昌始击与八门十六神飞布关系',
        findings: [
          `太乙落宫：${data.taiyiPalace ?? '未单列落宫（按计式盘面核验）'}；计式范围：${data.scope}`,
        ],
      };
    }
    return {
      school,
      label: '积算十六神口径',
      ruleFocus: '重太乙积年/积数推步、十六神落宫及掩迫囚击等反证核验',
      findings: [
        data.evidenceAnalysis?.counterEvidenceFacts.slice(0, 3).map((c) => c.promptText).join('；') || '按十六神常规飞布核对',
      ],
    };
  });
}

export function evaluateJinkoujueSchoolAlgorithms(
  data: {
    positions: {
      renYuan: { stem?: string };
      guiShen: { branch: string; god?: string };
      jiangShen: { branch: string; god?: string };
      diFen: { branch: string };
    };
    movements: Array<{ name: string }>;
    xunKong?: string[];
  },
  schools: readonly ('siwei' | 'fayong' | 'wudong')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'siwei') {
      return {
        school,
        label: '四位生克派口径',
        ruleFocus: '重人元、贵神、将神、地分四位上下生克与旺相休囚',
        findings: [
          `四位：人元${data.positions.renYuan.stem ?? ''}、贵神${data.positions.guiShen.branch}(${data.positions.guiShen.god ?? ''})、将神${data.positions.jiangShen.branch}(${data.positions.jiangShen.god ?? ''})、地分${data.positions.diFen.branch}`,
        ],
      };
    }
    if (school === 'fayong') {
      return {
        school,
        label: '发用神煞派口径',
        ruleFocus: '重用爻（将神/贵神）立极取象、入式歌诀及旬空落位',
        findings: [
          `主用将神${data.positions.jiangShen.branch}(${data.positions.jiangShen.god ?? ''})，旬空${data.xunKong?.join('、') || '无'}`,
        ],
      };
    }
    return {
      school,
      label: '五动三动派口径',
      ruleFocus: '重四位间妻动/财动/官动/贼动/鬼动及干支三动定事体发端',
      findings: [
        `命中动象：${data.movements.map((m) => m.name).join('、') || '四位安静，按常规生克论'}`,
      ],
    };
  });
}

export function evaluateXiaoliurenSchoolAlgorithms(
  data: {
    ruleLabel: string;
    sequence: { month: { name: string }; day: { name: string }; hour: { name: string } };
    primary: { name: string };
    ganzhi: { hour: string };
    evidenceAnalysis: {
      sanGongAnalysis: { combinationSummary: string; tiYongRelation: string };
    };
  },
  schools: readonly ('shunshu' | 'gongjue' | 'daoliu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'shunshu') {
      return {
        school,
        label: '顺数三宫传口径',
        ruleFocus: '重月宫（起因）→日宫（过程）→时宫（结果）三段递进演变',
        findings: [
          `三宫路径：${data.sequence.month.name} → ${data.sequence.day.name} → ${data.sequence.hour.name}（${data.ruleLabel}）`,
        ],
      };
    }
    if (school === 'gongjue') {
      return {
        school,
        label: '宫诀体用口径',
        ruleFocus: '重主占时宫歌诀、五行生克及六神方位取象',
        findings: [
          `主占「${data.primary.name}」；${data.evidenceAnalysis.sanGongAnalysis.tiYongRelation}`,
        ],
      };
    }
    return {
      school,
      label: '道家小六壬口径',
      ruleFocus: '兼重三宫五行生克链与起课时干支（${data.ganzhi.hour}时）地支引动',
      findings: [
        `起课时柱「${data.ganzhi.hour}」；${data.evidenceAnalysis.sanGongAnalysis.combinationSummary}`,
      ],
    };
  });
}

export function evaluateTarotSchoolAlgorithms(
  data: {
    spreadName: string;
    cards: Array<{ id: number; name: string; position: string; reversed: boolean; element: string }>;
  },
  schools: readonly ('rws' | 'yuansu' | 'narrative' | 'marseille')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const majorCount = data.cards.filter((c) => c.id <= 22).length;
  const reversedCount = data.cards.filter((c) => c.reversed).length;
  const elementCounts = data.cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.element] = (acc[c.element] ?? 0) + 1;
    return acc;
  }, {});
  const elementSummary = Object.entries(elementCounts).map(([k, v]) => `${k}${v}张`).join('、');

  return unique.map((school) => {
    if (school === 'rws') {
      return {
        school,
        label: '韦特（RWS）体系口径',
        ruleFocus: '重图像象征、牌位职能与正逆位张力平衡',
        findings: [
          `${data.spreadName}共 ${data.cards.length} 张（大阿卡纳 ${majorCount} 张，逆位 ${reversedCount} 张）`,
        ],
      };
    }
    if (school === 'yuansu') {
      return {
        school,
        label: '四元素能量派口径',
        ruleFocus: '重火土风水四元素比例、缺失元素与相邻牌生克增减',
        findings: [
          `元素分布：${elementSummary || '无显性四元素占比（以主牌核心象义参断）'}`,
        ],
      };
    }
    if (school === 'narrative') {
      return {
        school,
        label: '叙事串联派口径',
        ruleFocus: '重牌序起承转合、人物视线与关键转折牌位呼应',
        findings: [
          `叙事序列：${data.cards.map((c) => `${c.position}[${c.name}${c.reversed ? '逆' : ''}]`).join(' → ')}`,
        ],
      };
    }
    return {
      school,
      label: '马赛（Marseille）传统口径',
      ruleFocus: '重大小阿卡纳结构比例、数字牌阶梯升降与传统对称排布',
      findings: [
        `大牌占比 ${majorCount}/${data.cards.length}，小牌/宫廷 ${data.cards.length - majorCount} 张；按数字阶梯与几何位置参断`,
      ],
    };
  });
}

export function evaluateLenormandSchoolAlgorithms(
  data: {
    spreadType: string;
    cards: Array<{ id: number; name: string; position: string; house?: string }>;
  },
  combinationsCount: number,
  schools: readonly ('combination' | 'eventline' | 'significator')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'combination') {
      return {
        school,
        label: '双牌组合派口径',
        ruleFocus: '重相邻牌「主体+修饰」直接叠加与固定组合词典',
        findings: [
          `共生成 ${combinationsCount} 组邻牌/镜像组合`,
        ],
      };
    }
    if (school === 'eventline') {
      return {
        school,
        label: '事件线叙事口径',
        ruleFocus: '重牌阵从左至右的现实事件因果推进与终局落点',
        findings: [
          `事件链：${data.cards.map((c) => `${c.name}(#${c.id})`).join(' → ')}`,
        ],
      };
    }
    const sig = data.cards.find((c) => c.id === 28 || c.id === 29);
    return {
      school,
      label: '指示牌定位口径',
      ruleFocus: '重指示牌（28绅士/29淑女或主题牌）所在宫位与前后远近距离',
      findings: [
        sig ? `指示牌落位：${sig.name}在${sig.position}${sig.house ? `（${sig.house}宫）` : ''}` : '未抽中28/29人物牌，以中心牌或第一张为主题指示',
      ],
    };
  });
}

export function evaluateWuyunSchoolAlgorithms(
  result: {
    yearGanZhi?: string;
    annualMovement: { name: string; element: string; excess?: string };
    sitian: { name: string };
    zaiquan: { name: string };
  },
  schools: readonly ('yunqi' | 'sitian' | 'kezhu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'yunqi') {
      return {
        school,
        label: '岁运太过不及口径',
        ruleFocus: '重岁干定大运（太过/不及/平气）与五行胜复规律',
        findings: [
          `${result.yearGanZhi ? `${result.yearGanZhi}年` : '当年'}岁运：${result.annualMovement.name}（${result.annualMovement.element}${result.annualMovement.excess ? `·${result.annualMovement.excess}` : ''}）`,
        ],
      };
    }
    if (school === 'sitian') {
      return {
        school,
        label: '司天在泉口径',
        ruleFocus: '重上半年司天之气与下半年在泉之气的气候病候主调',
        findings: [
          `司天「${result.sitian.name}」／在泉「${result.zaiquan.name}」`,
        ],
      };
    }
    return {
      school,
      label: '主客加临口径',
      ruleFocus: '重五步主客运与六步主客气的顺逆相得、相临相制',
      findings: [
        `以年度六步主客气逐段核对当令客气对主气之加临生克`,
      ],
    };
  });
}

export function evaluateAlmanacSchoolAlgorithms(
  data: {
    recommendations: { preferredDays: Array<{ date: string }>; cautionDays: Array<{ date: string }> };
    days: Array<{ date: string }>;
  },
  schools: readonly ('xiejibianfang' | 'tongshu')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'xiejibianfang') {
      return {
        school,
        label: '《协纪辨方书》正统口径',
        ruleFocus: '严格区分正统建除、黄黑道与值日神煞，剔除无典据民间忌日干扰',
        findings: [
          `范围共 ${data.days.length} 天：正统初筛优选 ${data.recommendations.preferredDays.length} 天、慎用 ${data.recommendations.cautionDays.length} 天`,
        ],
      };
    }
    return {
      school,
      label: '民间通书民俗口径',
      ruleFocus: '在正统神煞外兼顾三娘煞、杨公忌、十恶大败等民间通书忌日',
      findings: [
        `已一并标出民俗忌神命中日期，供长辈或传统习俗场景避让参考`,
      ],
    };
  });
}

export function evaluateQizhengSchoolAlgorithms(
  data: {
    mingGong: number;
    mingZhu: string;
    mingDu: { xiu: string; xiuDegree: number; duZhu: string };
    shensha: { stars: Array<{ name: string }> };
    enNan: { enStars: string[]; nanStars: string[] };
  },
  schools: readonly ('guolao' | 'qintang')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'guolao') {
      return {
        school,
        label: '《果老星宗》口径',
        ruleFocus: '重神煞化曜（禄勋/天官/马元等）、恩难仇用生克与限度行年',
        findings: [
          `命主「${data.mingZhu}」，恩星(${data.enNan.enStars.join('、')})、难星(${data.enNan.nanStars.join('、')})；已列神煞 ${data.shensha.stars.length} 项`,
        ],
      };
    }
    return {
      school,
      label: '《琴堂指要》口径',
      ruleFocus: '重命度宿度浅深、度主星格与诸星庙旺升殿吊照',
      findings: [
        `命度「${data.mingDu.xiu}宿${data.mingDu.xiuDegree.toFixed(2)}°」（度主${data.mingDu.duZhu}）`,
      ],
    };
  });
}

const LIUYAO_GEN_MAP: Record<string, string> = {
  官鬼: '妻财', 父母: '官鬼', 兄弟: '父母', 子孙: '兄弟', 妻财: '子孙',
};
const LIUYAO_KE_MAP: Record<string, string> = {
  官鬼: '子孙', 父母: '妻财', 兄弟: '官鬼', 子孙: '父母', 妻财: '兄弟',
};

export function evaluateLiuyaoSchoolAlgorithms(
  data: {
    monthBranch?: string;
    dayBranch?: string;
    focusRelative?: string;
    yaosDetail: Array<{
      position: number;
      sixRelative: string;
      sixGod?: string;
      najiaDizhi: string;
      najiaWuxing?: string;
      isShi?: boolean;
      isYing?: boolean;
      isChanging?: boolean;
      changeDirection?: string;
      changeRelations?: string[];
      seasonState?: string;
      isMonthBreak?: boolean;
      isDayBreak?: boolean;
      isHiddenMove?: boolean;
      isVoid?: boolean;
    }>;
    hiddenSpirits?: Array<{
      sixRelative: string;
      branch: string;
      wuxing?: string;
      flyingBranch?: string;
      flyingWuxing?: string;
      interactionEffect?: string;
    }>;
  },
  schools: readonly ('zengshanbuyi' | 'bushizhengzong' | 'huozhulin')[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  if (!unique.length) return [];

  const shiYao = data.yaosDetail.find((y) => y.isShi);
  const yingYao = data.yaosDetail.find((y) => y.isYing);
  const focusYao = (data.focusRelative
    ? data.yaosDetail.find((y) => y.sixRelative === data.focusRelative)
    : undefined) ?? shiYao ?? data.yaosDetail[0];
  const focusRel = data.focusRelative ?? focusYao?.sixRelative ?? '世爻';
  const yuanShenRel = LIUYAO_GEN_MAP[focusRel] ?? '';
  const jiShenRel = LIUYAO_KE_MAP[focusRel] ?? '';

  const changingYaos = data.yaosDetail.filter((y) => y.isChanging);
  const goodMoves = changingYaos.filter(
    (y) => y.changeDirection === '化进神' || (y.changeRelations ?? []).some((r) => r === '回头生' || r === '比和'),
  );
  const badMoves = changingYaos.filter(
    (y) => y.changeDirection === '化退神' || (y.changeRelations ?? []).some((r) => ['回头克', '化破', '化空', '化墓', '回头冲'].includes(r)),
  );
  const hiddenMoves = data.yaosDetail.filter((y) => !y.isChanging && y.isHiddenMove);
  const brokenYaos = data.yaosDetail.filter((y) => y.isMonthBreak || y.isDayBreak);

  const focusStrong = Boolean(focusYao && (focusYao.seasonState === '旺' || focusYao.seasonState === '相'));
  const focusWeak = Boolean(focusYao && (focusYao.seasonState === '休' || focusYao.seasonState === '囚' || focusYao.seasonState === '死'));
  const focusBroken = Boolean(focusYao && (focusYao.isMonthBreak || focusYao.isDayBreak));

  const yuanYaos = data.yaosDetail.filter((y) => y.sixRelative === yuanShenRel);
  const jiYaos = data.yaosDetail.filter((y) => y.sixRelative === jiShenRel);
  const yuanActive = yuanYaos.some((y) => y.isChanging || y.isHiddenMove || y.seasonState === '旺' || y.seasonState === '相');
  const jiActive = jiYaos.some((y) => y.isChanging || y.isHiddenMove);

  const shiElem = focusYao?.najiaWuxing ?? BRANCH_ELEMENT[shiYao?.najiaDizhi ?? ''] ?? '';
  const yingElem = yingYao?.najiaWuxing ?? BRANCH_ELEMENT[yingYao?.najiaDizhi ?? ''] ?? '';
  const shiYingRel = shiElem && yingElem ? compareWuxing(shiElem, yingElem) : '未明';

  const liuyaoTone = (score: number, prefix: string): string =>
    score >= 70 ? `${prefix}·偏吉可成` : score >= 50 ? `${prefix}·平势待时` : `${prefix}·受制偏阻`;

  return unique.map((school) => {
    if (school === 'zengshanbuyi') {
      // 《增删卜易》：重月日旺衰、动变进退回头生克、暗动日破与旬空真假
      let score = 58;
      if (focusStrong) score += 14;
      if (focusWeak) score -= 8;
      if (focusBroken) score -= 20;
      if (focusYao?.isVoid) score += focusStrong || focusYao.isChanging ? -4 : -14;
      score += goodMoves.length * 9 - badMoves.length * 10 + hiddenMoves.length * 5;
      score = clampScore(score);

      const fav: string[] = [];
      const risk: string[] = [];
      if (focusStrong) fav.push(`用神${focusRel}(${focusYao?.najiaDizhi})得月日${focusYao?.seasonState}`);
      if (goodMoves.length) fav.push(`动变进生(${goodMoves.length}爻)`);
      if (hiddenMoves.length) fav.push(`旺相暗动(${hiddenMoves.map((y) => y.najiaDizhi).join('、')})`);
      if (focusBroken) risk.push(`用神${focusRel}逢月破/日破`);
      if (badMoves.length) risk.push(`动变退克受制(${badMoves.length}爻)`);
      if (focusYao?.isVoid) risk.push(`用神逢旬空(${focusStrong ? '假空待填实' : '偏真空'})`);

      const keyConclusion = focusBroken
        ? `《增删》重月日破损：用神逢破且综合${score}分，难速成宜守避`
        : score >= 70
          ? `《增删》重旺相动进：用神得令且动变有助（${score}分），整体偏吉可成`
          : `《增删》综合旺衰动变${score}分，宜待出空填实或旺相之时发力`;

      return {
        school,
        label: '《增删卜易》口径',
        ruleFocus: '重月建日辰旺衰、动变进退神与回头生克、暗动日破及旬空真假',
        findings: [
          `主用${focusRel}（第${focusYao?.position ?? '-'}爻${focusYao?.najiaDizhi ?? ''}${focusYao?.seasonState ? `·${focusYao.seasonState}` : ''}${focusBroken ? '·逢破' : ''}${focusYao?.isVoid ? '·旬空' : ''}）`,
          `动变态势：进生${goodMoves.length}爻、退克${badMoves.length}爻、暗动${hiddenMoves.length}爻、破损${brokenYaos.length}爻`,
          keyConclusion,
        ],
        structuredVerdict: {
          stance: liuyaoTone(score, '增删旺衰动变'),
          primaryFocus: '月日旺衰、动变进退与暗动日破',
          favorableSignals: fav.length ? fav : ['用神无显性破损'],
          riskSignals: risk,
          score,
          keyConclusion,
        },
      };
    }

    if (school === 'bushizhengzong') {
      // 《卜筮正宗》：重六亲生克链条（用神/原神/忌神）与飞伏露藏
      const hiddenFocus = data.hiddenSpirits?.find((h) => h.sixRelative === focusRel);
      const hiddenBlocked = Boolean(hiddenFocus?.interactionEffect && /飞克伏|受制|压制/.test(hiddenFocus.interactionEffect));
      const hiddenAided = Boolean(hiddenFocus?.interactionEffect && /飞生伏|透出|得生/.test(hiddenFocus.interactionEffect));
      let score = 56;
      if (yuanActive) score += 14;
      if (jiActive) score -= 14;
      if (!yuanYaos.length) score -= 6;
      if (hiddenFocus) score += hiddenAided ? 8 : hiddenBlocked ? -14 : -6;
      if (focusStrong) score += 8;
      if (focusBroken) score -= 12;
      score = clampScore(score);

      const fav: string[] = [];
      const risk: string[] = [];
      if (yuanActive) fav.push(`原神${yuanShenRel}旺动生扶用神`);
      if (!jiActive) fav.push(`忌神${jiShenRel}安静未动`);
      if (hiddenAided && hiddenFocus) fav.push(`伏神${hiddenFocus.sixRelative}(${hiddenFocus.branch})得飞神生扶`);
      if (jiActive) risk.push(`忌神${jiShenRel}发动克制用神`);
      if (!yuanYaos.length) risk.push(`卦中缺原神${yuanShenRel}接续`);
      if (hiddenBlocked && hiddenFocus) risk.push(`伏神${hiddenFocus.sixRelative}受飞神压制难出`);

      const keyConclusion = jiActive && !yuanActive
        ? `《正宗》重原忌生克：忌神${jiShenRel}发动而原神无力（${score}分），须先制忌护用`
        : yuanActive && !jiActive
          ? `《正宗》重原忌生克：原神${yuanShenRel}旺相护用且忌神安静（${score}分），生克有情偏吉`
          : `《正宗》六亲链条与飞伏综合${score}分，重在平衡原神续力与伏神透出时机`;

      return {
        school,
        label: '《卜筮正宗》口径',
        ruleFocus: '重用神/原神/忌神六亲生克链条与伏神飞神露藏关系',
        findings: [
          `六亲链条：用神${focusRel}、原神${yuanShenRel || '无'}(${yuanActive ? '旺动得力' : yuanYaos.length ? '静弱' : '不上卦'})、忌神${jiShenRel || '无'}(${jiActive ? '发动克用' : '安静'})`,
          hiddenFocus
            ? `伏神核验：${hiddenFocus.sixRelative}${hiddenFocus.branch}伏于飞神${hiddenFocus.flyingBranch ?? ''}下（${hiddenFocus.interactionEffect ?? '待引拔透出'}）`
            : '用神明现本卦，无伏藏遮蔽之虞',
          keyConclusion,
        ],
        structuredVerdict: {
          stance: liuyaoTone(score, '正宗原忌飞伏'),
          primaryFocus: '用神/原神/忌神生克链与飞伏关系',
          favorableSignals: fav.length ? fav : ['六亲生克基本平衡'],
          riskSignals: risk,
          score,
          keyConclusion,
        },
      };
    }

    // 《火珠林》：重世应主客生克、六神取象与古法动静
    let score = 56;
    if (shiYingRel === '客生主' || shiYingRel === '比和') score += 14;
    else if (shiYingRel === '主克客') score += 6;
    else if (shiYingRel === '主生客') score -= 4;
    else if (shiYingRel === '客克主') score -= 14;
    const shiGod = shiYao?.sixGod ?? '';
    const isGoodSixGod = ['青龙', '朱雀'].includes(shiGod);
    const isHardSixGod = ['白虎', '玄武', '螣蛇', '腾蛇'].includes(shiGod);
    if (isGoodSixGod) score += 6;
    if (isHardSixGod) score -= 6;
    if (shiYao?.isVoid) score -= 10;
    if (yingYao?.isVoid) score -= 5;
    score = clampScore(score);

    const fav: string[] = [];
    const risk: string[] = [];
    if (shiYingRel === '客生主') fav.push('应爻生世（对方/事体向我）');
    if (shiYingRel === '比和') fav.push('世应比和（主客同心）');
    if (isGoodSixGod) fav.push(`世临${shiGod}主吉象助力`);
    if (shiYingRel === '客克主') risk.push('应爻克世（对方/外境牵制）');
    if (isHardSixGod) risk.push(`世临${shiGod}主变动/虚惊/阻滞`);
    if (shiYao?.isVoid) risk.push('世爻旬空（己方底气未实）');

    const shiYingText = shiYingRel === '客生主'
      ? '应生世（客来就主·偏利）'
      : shiYingRel === '比和'
        ? '世应比和（主客谐同）'
        : shiYingRel === '主克客'
          ? '世克应（我方主动控局）'
          : shiYingRel === '主生客'
            ? '世生应（我方付出偏多）'
            : shiYingRel === '客克主'
              ? '应克世（外境压制主位）'
              : '世应五行平势';
    const keyConclusion = `《火珠林》重世应主客与六神：${shiYingText}${shiGod ? `、世临${shiGod}` : ''}，主客态势分${score}/100`;

    return {
      school,
      label: '《火珠林》口径',
      ruleFocus: '重世应主客生克、六神取象与静动古法断应',
      findings: [
        `世应主客：世爻第${shiYao?.position ?? '-'}爻(${shiYao?.najiaDizhi ?? ''}${shiGod ? `·${shiGod}` : ''}) vs 应爻第${yingYao?.position ?? '-'}爻(${yingYao?.najiaDizhi ?? ''}${yingYao?.sixGod ? `·${yingYao.sixGod}` : ''})→${shiYingText}`,
        keyConclusion,
      ],
      structuredVerdict: {
        stance: liuyaoTone(score, '火珠林世应主客'),
        primaryFocus: '世应主客生克与六神取象',
        favorableSignals: fav.length ? fav : ['世应无直接相克'],
        riskSignals: risk,
        score,
        keyConclusion,
      },
    };
  });
}
