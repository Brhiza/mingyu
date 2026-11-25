/**
 * 八字格局组合、互制与成败救应关系引擎
 *
 * 将原本分散在主格局、普通格、化气、调候与病药中的信息，整合为清晰、事实性的结构化格局关系图谱：
 * 1. 主格与兼带组合（格局协同关系：伤官佩印、伤官生财、杀印相生、食神制杀、财旺生官、官印相生、专旺泄秀、合杀留官等）
 * 2. 破格因子与救应链（具体病灶干支 → 所需救应机制 → 原局是否已救成）
 * 3. 格局、调候与旺衰扶抑之间的层级优先级关系
 */
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';
import type { UsefulGodResult } from './useful-god';

type Pillars = Record<PillarName, BaziPillar>;
type Strength = ReturnType<typeof buildDayMasterStrength>;

const POSITIONS: PillarName[] = ['year', 'month', 'day', 'hour'];
const LABELS: Record<PillarName, string> = { year: '年', month: '月', day: '日', hour: '时' };
const STEM_COMBINE_PAIR: Record<string, string> = {
  甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊',
};

export interface PatternSynergy {
  name: string;
  relation: '成格协同' | '兼格互济' | '取清救应';
  evidence: string;
  condition: string;
}

export interface PatternConflictChain {
  conflict: string;
  target: string;
  remedyNeeded: string;
  rescueStatus: '原局明透已救' | '地支暗藏待引' | '原局无救（破格待运补药）';
  evidence: string;
}

export interface PatternRelationsResult {
  primaryPattern: string;
  primarySource: string;
  synergies: PatternSynergy[];
  conflictChains: PatternConflictChain[];
  layerPriority: string;
}

interface GodOccurrence {
  pos: PillarName;
  stem: string;
  tenGod: string;
  visible: boolean;
}

function collectGods(pillars: Pillars): GodOccurrence[] {
  const list: GodOccurrence[] = [];
  for (const pos of POSITIONS) {
    const p = pillars[pos];
    if (pos !== 'day') {
      list.push({ pos, stem: p.gan, tenGod: p.tenGod, visible: true });
    }
    for (const h of p.hiddenStems) {
      list.push({ pos, stem: h.stem, tenGod: h.tenGod, visible: false });
    }
  }
  return list;
}

function fmtOcc(items: GodOccurrence[], max = 3): string {
  return items
    .slice(0, max)
    .map((x) => `${LABELS[x.pos]}${x.visible ? '干' : '支藏'}${x.stem}(${x.tenGod})`)
    .join('、');
}

export function buildPatternRelations(input: {
  pillars: Pillars;
  strength: Strength;
  patternOverview: { pattern: string; source: string };
  ordinaryPattern: { candidate: string };
  usefulGod: UsefulGodResult;
}): PatternRelationsResult {
  const { pillars, strength, patternOverview, ordinaryPattern, usefulGod } = input;
  const all = collectGods(pillars);
  const visible = all.filter((x) => x.visible);
  const byGod = (names: string[], onlyVisible = false) =>
    (onlyVisible ? visible : all).filter((x) => names.includes(x.tenGod));

  const mainPat = patternOverview.pattern;
  const ordPat = ordinaryPattern.candidate;
  const isSpecial = patternOverview.source !== '普通月令取格候选';
  const isStrong = ['身强', '偏强', '极强'].includes(strength.status);

  const synergies: PatternSynergy[] = [];
  const conflictChains: PatternConflictChain[] = [];

  const visSeal = byGod(['正印', '偏印'], true);
  const allSeal = byGod(['正印', '偏印']);
  const visWealth = byGod(['正财', '偏财'], true);
  const allWealth = byGod(['正财', '偏财']);
  const visOfficer = byGod(['正官'], true);
  const visKiller = byGod(['七杀'], true);
  const visFood = byGod(['食神'], true);
  const visHurt = byGod(['伤官'], true);
  const visOutput = byGod(['食神', '伤官'], true);
  const visComp = byGod(['比肩', '劫财'], true);

  // 1. 格局兼带与协同关系
  // 1a. 专旺泄秀（曲直/炎上/稼穑/从革/润下 + 食伤明透）
  if (/曲直格|炎上格|稼穑格|从革格|润下格|专旺格/.test(mainPat) && visOutput.length > 0) {
    synergies.push({
      name: `${mainPat}·食伤顺势泄秀`,
      relation: '成格协同',
      evidence: `${fmtOcc(visOutput)}明透吐秀，承接专旺旺气`,
      condition: '食伤为专旺顺势化神，忌官杀犯旺或重印回克伤尽化神',
    });
  }

  // 1b. 伤官佩印
  if ((ordPat.includes('伤官') || visHurt.length > 0) && allSeal.length > 0) {
    const daySeal = pillars.day.hiddenStems[0] && ['正印', '偏印'].includes(pillars.day.hiddenStems[0].tenGod);
    if (visSeal.length > 0 || daySeal) {
      const sealEv = visSeal.length > 0 ? fmtOcc(visSeal) : `日支${pillars.day.zhi}藏${pillars.day.hiddenStems[0].stem}(${pillars.day.hiddenStems[0].tenGod})`;
      synergies.push({
        name: '伤官佩印',
        relation: ordPat.includes('伤官') ? '成格协同' : '兼格互济',
        evidence: `${visHurt.length ? fmtOcc(visHurt) : '月令伤官'}配${sealEv}制伤护身`,
        condition: visWealth.length > 0 ? `原局另透${fmtOcc(visWealth)}，须防财星坏印而破佩印之功` : '原局无明透财星破印，佩印清纯',
      });
    }
  }

  // 1c. 伤官生财 / 食神生财
  if ((ordPat.includes('伤官') || ordPat.includes('食神') || visOutput.length > 0) && visWealth.length > 0) {
    synergies.push({
      name: visHurt.length > 0 || ordPat.includes('伤官') ? '伤官生财' : '食神生财',
      relation: '兼格互济',
      evidence: `${visOutput.length ? fmtOcc(visOutput) : ordPat}转生${fmtOcc(visWealth)}`,
      condition: isStrong ? '身强食伤生财顺畅，忌重印夺食或比劫争财' : '身弱食伤生财易泄耗过度，须见印比助身担财',
    });
  }

  // 1d. 杀印相生
  if ((ordPat.includes('七杀') || visKiller.length > 0) && allSeal.length > 0 && (visSeal.length > 0 || ['正印', '偏印'].includes(pillars.day.hiddenStems[0]?.tenGod ?? ''))) {
    const sealEv = visSeal.length > 0 ? fmtOcc(visSeal) : `日支${pillars.day.zhi}藏${pillars.day.hiddenStems[0].stem}(${pillars.day.hiddenStems[0].tenGod})`;
    synergies.push({
      name: '杀印相生',
      relation: ordPat.includes('七杀') ? '成格协同' : '兼格互济',
      evidence: `${visKiller.length ? fmtOcc(visKiller) : '月令七杀'}生${sealEv}，化杀为权`,
      condition: visWealth.length > 0 ? `见${fmtOcc(visWealth)}，须防贪财坏印而失化杀通路` : '无明财破印，化杀流通',
    });
  }

  // 1e. 食神制杀
  if ((ordPat.includes('七杀') || visKiller.length > 0) && (ordPat.includes('食神') || visFood.length > 0)) {
    const hasXiao = byGod(['偏印'], true).length > 0;
    synergies.push({
      name: '食神制杀',
      relation: '成格协同',
      evidence: `${visFood.length ? fmtOcc(visFood) : '月令食神'}制伏${visKiller.length ? fmtOcc(visKiller) : '月令七杀'}`,
      condition: hasXiao ? '原局明透偏印，须防枭神夺食而失制杀之功' : '食杀相对无枭夺，制化有力',
    });
  }

  // 1f. 财旺生官 / 官印相生
  if ((ordPat.includes('财') || visWealth.length > 0) && (ordPat.includes('正官') || visOfficer.length > 0)) {
    synergies.push({
      name: '财旺生官',
      relation: '成格协同',
      evidence: `${visWealth.length ? fmtOcc(visWealth) : ordPat}生助${visOfficer.length ? fmtOcc(visOfficer) : '月令正官'}`,
      condition: visHurt.length > 0 ? '原局见伤官，须防伤官见官破格' : isStrong ? '身足任财官，忌伤官克官' : '身偏弱须印比助身任财官',
    });
  }
  if ((ordPat.includes('正官') || visOfficer.length > 0) && visSeal.length > 0) {
    synergies.push({
      name: '官印相生',
      relation: '成格协同',
      evidence: `${visOfficer.length ? fmtOcc(visOfficer) : '月令正官'}生${fmtOcc(visSeal)}护身`,
      condition: visWealth.length > 0 ? '官星居中可一定程度通关财印，仍忌重财直破印根' : '官印清纯相生',
    });
  }

  // 1g. 官杀混杂的合杀留官 / 合官留杀取清检测
  if ((visOfficer.length > 0 || ordPat.includes('正官')) && (visKiller.length > 0 || ordPat.includes('七杀'))) {
    let clearedNote = '';
    for (const k of visKiller) {
      const partner = visible.find((v) => v.pos !== k.pos && STEM_COMBINE_PAIR[v.stem] === k.stem && ['劫财', '伤官'].includes(v.tenGod));
      if (partner) {
        clearedNote = `${LABELS[partner.pos]}干${partner.stem}(${partner.tenGod})合${LABELS[k.pos]}干${k.stem}(七杀)，构成「合杀留官」取清`;
        break;
      }
    }
    if (!clearedNote) {
      for (const o of visOfficer) {
        const partner = visible.find((v) => v.pos !== o.pos && STEM_COMBINE_PAIR[v.stem] === o.stem && ['食神', '比肩', '劫财', '伤官'].includes(v.tenGod));
        if (partner) {
          clearedNote = `${LABELS[partner.pos]}干${partner.stem}(${partner.tenGod})合${LABELS[o.pos]}干${o.stem}(正官)，构成「合官留杀」取清`;
          break;
        }
      }
    }
    if (clearedNote) {
      synergies.push({
        name: clearedNote.includes('合杀留官') ? '合杀留官取清' : '合官留杀取清',
        relation: '取清救应',
        evidence: clearedNote,
        condition: '官杀混杂得合去其一，格局由浊转清',
      });
    } else {
      conflictChains.push({
        conflict: '官杀混杂',
        target: `${fmtOcc([...visOfficer, ...visKiller]) || '正官与七杀并见'}`,
        remedyNeeded: '取合杀留官、食神制杀或印星化杀统一气机',
        rescueStatus: visSeal.length > 0 || visFood.length > 0 ? '原局明透已救' : allSeal.length > 0 ? '地支暗藏待引' : '原局无救（破格待运补药）',
        evidence: visSeal.length > 0 ? `明透${fmtOcc(visSeal)}化官杀` : visFood.length > 0 ? `明透${fmtOcc(visFood)}制杀` : '原局未见明透合清或化杀之字',
      });
    }
  }

  // 2. 破格因子与救应链检测
  // 2a. 枭神夺食
  const visXiao = byGod(['偏印'], true);
  const monthIsXiao = pillars.month.hiddenStems[0]?.tenGod === '偏印';
  if ((visXiao.length > 0 || monthIsXiao) && (visFood.length > 0 || ordPat.includes('食神'))) {
    const rescueStatus: PatternConflictChain['rescueStatus'] =
      visWealth.length > 0 ? '原局明透已救' : allWealth.length > 0 ? '地支暗藏待引' : '原局无救（破格待运补药）';
    conflictChains.push({
      conflict: '枭神夺食',
      target: `${visXiao.length ? fmtOcc(visXiao) : '月令偏印'}克制${visFood.length ? fmtOcc(visFood) : '月令食神'}`,
      remedyNeeded: '财星（尤喜明透偏财）制枭护食',
      rescueStatus,
      evidence: visWealth.length > 0 ? `明透${fmtOcc(visWealth)}制枭护食` : allWealth.length > 0 ? `仅${fmtOcc(allWealth, 2)}暗藏未透，救应力弱` : '全盘无财星制枭',
    });
  }

  // 2b. 伤官见官
  if ((visHurt.length > 0 || ordPat.includes('伤官')) && (visOfficer.length > 0 || ordPat.includes('正官'))) {
    const hasRescue = visWealth.length > 0 || visSeal.length > 0;
    conflictChains.push({
      conflict: '伤官见官',
      target: `${visHurt.length ? fmtOcc(visHurt) : '月令伤官'}直克${visOfficer.length ? fmtOcc(visOfficer) : '月令正官'}`,
      remedyNeeded: '财星通关（伤官生财、财生官）或印星制伤护官',
      rescueStatus: hasRescue ? '原局明透已救' : (allWealth.length > 0 || allSeal.length > 0) ? '地支暗藏待引' : '原局无救（破格待运补药）',
      evidence: visWealth.length > 0 ? `明透${fmtOcc(visWealth)}通关` : visSeal.length > 0 ? `明透${fmtOcc(visSeal)}制伤护官` : '原局缺明透财印解救',
    });
  }

  // 2c. 印重成病（土重埋金 / 母慈灭子）
  const monthIsSeal = ['正印', '偏印'].includes(pillars.month.hiddenStems[0]?.tenGod ?? '');
  if (!isSpecial && isStrong && visSeal.length >= 2 && monthIsSeal) {
    conflictChains.push({
      conflict: '印重成病（母慈灭子/土重埋金类）',
      target: `${fmtOcc(visSeal)}叠透兼月令印星当权，印重反晦日主`,
      remedyNeeded: '财星破印疏通、食伤泄秀，严忌官杀再生印助病',
      rescueStatus: visWealth.length > 0 || visOutput.length > 0 ? '原局明透已救' : (allWealth.length > 0 || byGod(['食神', '伤官']).length > 0) ? '地支暗藏待引' : '原局无救（破格待运补药）',
      evidence: visWealth.length > 0 ? `明透${fmtOcc(visWealth)}疏印` : visOutput.length > 0 ? `明透${fmtOcc(visOutput)}泄秀` : `仅支藏${fmtOcc([...allWealth, ...byGod(['食神', '伤官'])], 2) || '极微'}待岁运引透`,
    });
  }

  // 2d. 贪财坏印（印格或身弱用印见重财）
  if (!isSpecial && !isStrong && visWealth.length >= 1 && allSeal.length >= 1 && (visSeal.length >= 1 || ordPat.includes('印'))) {
    const hasRescue = visComp.length > 0 || visOfficer.length > 0 || visKiller.length > 0;
    conflictChains.push({
      conflict: '贪财坏印',
      target: `${fmtOcc(visWealth)}克损${visSeal.length ? fmtOcc(visSeal) : '印根'}`,
      remedyNeeded: '比劫制财护印或官杀通关（财生官、官生印）',
      rescueStatus: hasRescue ? '原局明透已救' : byGod(['比肩', '劫财', '正官', '七杀']).length > 0 ? '地支暗藏待引' : '原局无救（破格待运补药）',
      evidence: visComp.length > 0 ? `明透${fmtOcc(visComp)}护印` : visOfficer.length > 0 ? `明透${fmtOcc(visOfficer)}通关` : '原局缺明透比劫或官星护印',
    });
  }

  // 3. 格局、调候与旺衰扶抑的层级优先级
  let layerPriority = '';
  if (isSpecial) {
    layerPriority = `特殊格「${mainPat}」顺势逻辑优先于常规扶抑；普通月令候选项「${ordPat}」仅作参照，喜忌以顺势护格（${usefulGod.favorableWuxing.join('、')}）为纲。`;
  } else {
    const syn = usefulGod.tradeoffAnalysis?.synthesis || '';
    if (syn.includes('冬夏急候先顾调候')) {
      layerPriority = `冬夏极候下调候与扶抑存在张力：先顾调候生态底盘，同时配合主格「${ordPat}」与扶抑喜用（${usefulGod.favorableWuxing.join('、')}）协调取舍。`;
    } else if (conflictChains.some((c) => c.rescueStatus !== '原局明透已救')) {
      layerPriority = `普通格「${ordPat}」存在未全救之破格病灶：取用优先以「病药救应」为第一顺位（喜${usefulGod.favorableWuxing.join('、')}），常规扶抑次之。`;
    } else {
      layerPriority = `主格「${ordPat}」、旺衰（${strength.status}）与调候方向协调一致，以喜用[${usefulGod.favorableWuxing.join('、')}]护格流通为主轴。`;
    }
  }

  return {
    primaryPattern: mainPat,
    primarySource: patternOverview.source,
    synergies,
    conflictChains,
    layerPriority,
  };
}

export function formatPatternRelations(res: PatternRelationsResult): string {
  const lines: string[] = [
    `主格定位：${res.primaryPattern}（来源：${res.primarySource}）`,
    `层级优先级：${res.layerPriority}`,
  ];
  if (res.synergies.length > 0) {
    lines.push(
      '格局协同与兼带关系：' +
        res.synergies
          .map((s) => `「${s.name}」[${s.relation}]（${s.evidence}；成立/维持条件：${s.condition}）`)
          .join('；'),
    );
  } else {
    lines.push('格局协同与兼带关系：以单一主格清纯运作，未见显著兼格叠加。');
  }
  if (res.conflictChains.length > 0) {
    lines.push(
      '破格因子与救应链：' +
        res.conflictChains
          .map((c) => `「${c.conflict}」→ 病灶：${c.target}｜需药：${c.remedyNeeded}｜状态：${c.rescueStatus}（${c.evidence}）`)
          .join('；'),
    );
  } else {
    lines.push('破格因子与救应链：原局未见显著破格交战链条，格局气机相对清顺。');
  }
  return lines.join('\n');
}
