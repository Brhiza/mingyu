/**
 * 占卜结果摘要:把不同卦种的输出统一格式化为标签+明细行,供 UI 渲染。
 */

import type { DivinationDraft } from './engine';
import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  LenormandData,
  LiurenData,
  LiuyaoData,
  MeihuaData,
  QimenData,
  TarotData,
  TaiyiResult,
  XiaoliurenData,
  JinkoujueData,
} from '../../types/divination';
import { analyzeAlmanacEvidence } from 'mingyu-core/divination/almanac';
import {
  analyzeLenormandEvidence,
  conditionLenormandTraditionalText,
} from 'mingyu-core/divination/lenormand';
import { analyzeXiaoliurenEvidence } from 'mingyu-core/divination/xiaoliuren';
import { rebuildAuditedQimenData } from 'mingyu-core/divination/qimen';
import { analyzeLiurenEvidence } from 'mingyu-core/divination/liuren';
import {
  analyzeLiuyaoActivityPattern,
  analyzeLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
} from 'mingyu-core/divination/liuyao';
import { resolveSsgwStoryContent } from './ssgw-content';

export interface DivinationSummaryBlocks {
  title: string;
  tags: string[];
  lines: string[];
}

function formatLiuyaoFocusSummary(data: LiuyaoData) {
  if (!data.yaosDetail?.length) {
    return '';
  }

  const worldYao = data.yaosDetail.find((item) => item.isWorld);
  const responseYao = data.yaosDetail.find((item) => item.isResponse);
  const movingPositions = data.yaosDetail
    .filter((item) => item.isChanging)
    .map((item) => `第${item.position}爻`);

  const parts = [
    worldYao ? `世爻第${worldYao.position}爻` : '',
    responseYao ? `应爻第${responseYao.position}爻` : '',
  ].filter(Boolean);

  return [
    parts.length ? `世应：${parts.join('，')}` : '',
    `动变：${movingPositions.join('、') || '无动爻'}`,
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoHexagramRelationSummary(data: LiuyaoData) {
  const relations = data.hexagramRelations;
  if (!relations) {
    return '';
  }

  return [
    relations.original ? `主卦${relations.original}` : '',
    relations.changed ? `变卦${relations.changed}` : '',
    relations.transition || '',
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoFanFuRelationSummary(data: LiuyaoData) {
  const labels = analyzeLiuyaoFanFuRelations(data).labels;
  return labels?.length ? labels.join('；') : '';
}

function wrapMainEvidence(text: string) {
  return text ? `主轴：${text}` : '';
}

function formatLiuyaoHiddenSpiritSummary(data: DivinationData) {
  if (!('hiddenSpirits' in data) || !data.hiddenSpirits?.length) {
    return '伏神：无';
  }

  return `伏神：${data.hiddenSpirits
    .map(
      (item) =>
        `${item.sixRelative}伏第${item.position}爻${item.najiaTiangan ?? ''}${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}（${item.conditionAnalysis?.flyingRelation ?? getLiuyaoFlyingHiddenRelation(item.wuxing, item.underYao.wuxing)}）`,
    )
    .join('；')}`;
}

function formatQimenVoidSummary(data: DivinationData) {
  if ('voidPalaces' in data && data.voidPalaces?.length) {
    return `旬空：${data.voidPalaces.map((item) => `${item.branch}空落${item.name}`).join('、')}`;
  }

  if ('voidBranches' in data && data.voidBranches?.length) {
    return `旬空：${data.voidBranches.join('、')}`;
  }

  return '旬空：无';
}

function formatQimenHorseSummary(data: DivinationData) {
  if (!('horseStar' in data) || !data.horseStar) {
    return '马星：未定位';
  }

  return `马星：${data.horseStar.sourceBranch}时驿马在${data.horseStar.branch}，落${data.horseStar.name}`;
}

function formatQimenFocusSummary(data: DivinationData) {
  if (
    !('jiuGongGe' in data) ||
    !('zhiFu' in data) ||
    !('zhiShi' in data) ||
    !('ganzhi' in data) ||
    !data.jiuGongGe?.length
  ) {
    return '';
  }

  const zhiFuPalace = data.jiuGongGe.find(
    (item) => item.tianPan.star === data.zhiFu || item.tianPan.companionStar === data.zhiFu,
  );
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const hourStem = data.ganzhi.hour.charAt(0);
  const hourStemPalaces = data.jiuGongGe.filter(
    (item) =>
      item.tianPan.stem === hourStem ||
      item.tianPan.companionStem === hourStem ||
      item.diPan.stem === hourStem,
  );

  return `值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未定位'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未定位'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '落宫未定位'}`;
}

function formatQimenSpecialTimeSummary(data: DivinationData) {
  if (!('specialConditions' in data) || !data.specialConditions?.description) {
    return '';
  }

  return `时辰：${data.specialConditions.description}`;
}

function formatQimenSeasonalitySummary(data: DivinationData) {
  if (!('seasonality' in data) || !data.seasonality) {
    return '';
  }

  const seasonality = data.seasonality;
  return `节令背景：${seasonality.currentJieQi}${seasonality.jieQiPhase.phase}，节气五行${seasonality.seasonalElement || '未知'}，日干${seasonality.dayStem}${seasonality.seasonRelation}，月相${seasonality.lunarPhaseDetail || seasonality.lunarPhase}，建除${seasonality.dayOfficer}`;
}

function formatQimenPatternComboSummary(data: DivinationData) {
  if (!('patternCombos' in data) || !data.patternCombos?.length) {
    return '';
  }

  return `已校勘组合规则：${data.patternCombos
    .slice(0, 3)
    .map((item) => `${item.name}（传统分类：${item.tone}，不等于现实吉凶）`)
    .join('、')}`;
}

function formatMeihuaSeasonSummary(data: MeihuaData) {
  const basis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;
  return `月令：${basis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`;
}

function formatMeihuaRelationSummary(data: MeihuaData) {
  return `体用：${data.analysis.tiYongRelation}；过程：${data.analysis.inter1Relation}、${data.analysis.inter2Relation}；结果：${data.analysis.changedRelation}`;
}

function formatMeihuaChangedSummary(data: MeihuaData) {
  if (!data.changedTiGua || !data.changedYongGua) {
    return '';
  }

  return `变后：体卦${data.changedTiGua.name}（${data.changedTiGua.element}）；用卦${data.changedYongGua.name}（${data.changedYongGua.element}）；关系${data.analysis.changedTiYongRelation}`;
}

function formatMeihuaMethodSummary(data: MeihuaData) {
  const methodLabelMap: Record<string, string> = {
    time: '年月日时起卦法',
    number: '数字起卦法',
    random: '随机起卦法',
    timeTrigram: '年月日时起卦法（兼容）',
  };
  const label =
    (data.calculation?.method?.trim()
      ? methodLabelMap[data.calculation.method] || data.calculation.method
      : '') ||
    (data.calculation?.methodKey
      ? methodLabelMap[data.calculation.methodKey] || data.calculation.methodKey
      : '');

  return `起卦法：${label || '未知'}`;
}

function formatMeihuaFocusSummary(data: MeihuaData) {
  return `体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻`;
}

function formatLiurenFocusSummary(data: DivinationData) {
  if (!('threeTransmissions' in data) || !data.threeTransmissions?.length) {
    return '';
  }

  const firstTransmission = data.threeTransmissions[0];
  const detailParts = [
    firstTransmission.branch || '未知',
    firstTransmission.god ? `乘${firstTransmission.god}` : '',
    firstTransmission.relation || '',
    firstTransmission.note || '',
  ].filter(Boolean);

  return `发用：初传${detailParts.join('，')}`;
}

function formatLiurenLessonShortSummary(data: DivinationData) {
  if (!('fourLessons' in data) || !data.fourLessons?.length) {
    return '四课关系：未标注';
  }

  return `四课关系：${data.fourLessons
    .map((item) => `${item.name}${item.upper}/${item.lower} ${item.relation}`)
    .join('；')}`;
}

function formatLiurenTransmissionShortSummary(data: DivinationData) {
  if (!('threeTransmissions' in data) || !data.threeTransmissions?.length) {
    return '三传主线：未标注';
  }

  const stageFallback = ['初传', '中传', '末传'];

  return `三传主线：${data.threeTransmissions
    .map((item, index) => `${item.stage || stageFallback[index] || '传'}${item.branch}`)
    .join(' → ')}`;
}

function formatLiurenNoblemanSummary(data: DivinationData) {
  if (!('noblemanBranch' in data) || !data.noblemanBranch) {
    return '贵人：未知';
  }

  const groundBranch =
    'noblemanGroundBranch' in data && data.noblemanGroundBranch
      ? data.noblemanGroundBranch
      : 'heavenlyPlate' in data
        ? data.heavenlyPlate?.find((item) => item.branch === data.noblemanBranch)?.under
        : '';

  return `贵人：${data.noblemanBranch}${groundBranch ? `临${groundBranch}` : ''}`;
}

function formatTarotFocusSummary(data: TarotData) {
  if (!data.cards.length) {
    return '';
  }

  return data.cards
    .slice(0, 3)
    .map((card) => `${card.position}${card.name}（${card.reversed ? '逆位' : '正位'}）`)
    .join('；');
}

function formatSsgwFocusSummary(data: DivinationData) {
  if (!('poem' in data) || !data.poem) {
    return '';
  }

  return `签诗“${data.poem}”`;
}

export function getDivinationSummaryBlocks(
  method: DivinationDraft['method'],
  data: DivinationData,
): DivinationSummaryBlocks {
  switch (method) {
    case 'liuyao': {
      const liuyao = data as LiuyaoData;
      const hexagramRelationText = formatLiuyaoHexagramRelationSummary(liuyao);
      const fanfuRelationText = formatLiuyaoFanFuRelationSummary(liuyao);
      const activityPattern = analyzeLiuyaoActivityPattern(liuyao.yaoArray, liuyao.originalName);
      return {
        title: '六爻起卦结果',
        tags: [
          `主卦：${liuyao.originalName}`,
          `变卦：${liuyao.changedName || '无'}`,
          `互卦：${liuyao.interName || '无'}`,
          liuyao.palaceStage ? `卦位：${liuyao.palaceStage}` : '',
          hexagramRelationText ? `整卦：${hexagramRelationText}` : '',
          fanfuRelationText ? `反伏：${fanfuRelationText}` : '',
          `动爻：${liuyao.changingYaos?.map((item) => item.position).join('、') || '无'}`,
        ].filter(Boolean),
        lines: [
          wrapMainEvidence(formatLiuyaoFocusSummary(liuyao)),
          `宫位：${liuyao.palace?.name ? `${liuyao.palace.name}宫` : '未知'}`,
          `动静结构：${activityPattern.kind}${activityPattern.scriptureReference ? `（${activityPattern.scriptureReference}经文参考）` : ''}`,
          `空亡：${liuyao.voidBranches?.length ? liuyao.voidBranches.join('、') : '无'}`,
          formatLiuyaoHiddenSpiritSummary(liuyao),
        ].filter(Boolean),
      };
    }
    case 'meihua': {
      const meihua = data as MeihuaData;
      return {
        title: '梅花起卦结果',
        tags: [
          `主卦：${meihua.originalName}`,
          `互卦：${meihua.interName || '无'}`,
          `变卦：${meihua.changedName || '无'}`,
          `动爻：第${meihua.movingYao.position}爻`,
        ],
        lines: [
          wrapMainEvidence(formatMeihuaFocusSummary(meihua)),
          `体卦：${meihua.tiGua.name}（${meihua.tiGua.element}）`,
          `用卦：${meihua.yongGua.name}（${meihua.yongGua.element}）`,
          formatMeihuaSeasonSummary(meihua),
          formatMeihuaRelationSummary(meihua),
          formatMeihuaChangedSummary(meihua),
          formatMeihuaMethodSummary(meihua),
        ].filter(Boolean),
      };
    }
    case 'xiaoliuren': {
      const xiaoliuren = data as XiaoliurenData;
      const evidence = xiaoliuren.evidenceAnalysis ?? analyzeXiaoliurenEvidence(xiaoliuren);
      return {
        title: '小六壬起课结果',
        tags: [
          `起课方式：${xiaoliuren.methodLabel}`,
          `占得宫：${xiaoliuren.primary.name}`,
          `时辰：${xiaoliuren.hourLabel}`,
        ],
        lines: [
          wrapMainEvidence(evidence.primaryFact.promptText),
          `顺数轨迹：月宫${xiaoliuren.sequence.month.name}；日宫${xiaoliuren.sequence.day.name}；时宫${xiaoliuren.sequence.hour.name}`,
          `历法口径：${xiaoliuren.calculation.dayBoundary}；${xiaoliuren.calculation.leapMonthRule}`,
        ].filter(Boolean),
      };
    }
    case 'jinkoujue': {
      const jinkoujue = data as JinkoujueData;
      const p = jinkoujue.positions;
      return {
        title: '金口诀起课结果',
        tags: [
          `起课方式：${jinkoujue.methodLabel}`,
          `地分：${p.diFen.branch}`,
          `将神：${p.jiangShen.stem || ''}${p.jiangShen.branch}`,
          `贵神：${p.guiShen.stem || ''}${p.guiShen.branch}乘${p.guiShen.god || ''}`,
          `人元：${p.renYuan.stem || ''}${p.renYuan.branch}`,
        ],
        lines: [
          wrapMainEvidence(jinkoujue.mainLine),
          `阴阳发用：${jinkoujue.yinYangUse.rule}；发用位${jinkoujue.yinYangUse.usePosition}${jinkoujue.yinYangUse.isVoid ? '旬空' : '不空'}`,
          `动爻：${jinkoujue.movements.map((item) => `${item.name}（${item.trigger}）`).join('、') || '未触发五动或三动'}`,
          `月将贵人：月将${jinkoujue.monthLeader}；${jinkoujue.dayNight}贵人起${jinkoujue.noblemanBranch}${jinkoujue.calculation.noblemanDirection}`,
          `四位关系：贵将${jinkoujue.relations.guiToJiang}；贵人${jinkoujue.relations.guiToRen}；将地${jinkoujue.relations.jiangToDi}`,
          jinkoujue.xunKong?.length ? `旬空：${jinkoujue.xunKong.join('、')}` : '',
          jinkoujue.summary ? `提示：${jinkoujue.summary}` : '',
        ].filter(Boolean),
      };
    }
    case 'qimen': {
      // 历史缓存和外部结果可能携带已退役派生字段；摘要也必须从原始盘面统一重建。
      const qimen = rebuildAuditedQimenData(data as QimenData);
      return {
        title: '奇门起局结果',
        tags: [
          `局数：${qimen.isYangDun ? '阳遁' : '阴遁'}${qimen.juShu}局`,
          `值符：${qimen.zhiFu}`,
          `值使：${qimen.zhiShi}`,
        ],
        lines: [
          wrapMainEvidence(formatQimenFocusSummary(qimen)),
          `节气：${qimen.timeInfo.solarTerm}`,
          qimen.timeInfo.juTerm && qimen.timeInfo.juTerm !== qimen.timeInfo.solarTerm
            ? `定局节气：${qimen.timeInfo.juTerm}${qimen.timeInfo.epoch}`
            : '',
          formatQimenSeasonalitySummary(qimen),
          `位置标签：${qimen.patternTags?.length ? qimen.patternTags.join('、') : '无'}`,
          formatQimenPatternComboSummary(qimen),
          formatQimenVoidSummary(qimen),
          formatQimenHorseSummary(qimen),
          formatQimenSpecialTimeSummary(qimen),
        ].filter(Boolean),
      };
    }
    case 'liuren': {
      const liuren = data as LiurenData;
      const xunKong = analyzeLiurenEvidence(liuren).calculationFact.xunKong;
      return {
        title: '大六壬起课结果',
        tags: [
          `时段：${'dayNight' in data && data.dayNight ? data.dayNight : '未知'}`,
          `月将：${'monthLeader' in data ? data.monthLeader : '未知'}`,
          `占时：${'divinationBranch' in data ? data.divinationBranch : '未知'}`,
          `初传：${'threeTransmissions' in data ? data.threeTransmissions[0]?.branch || '未知' : '未知'}`,
          `末传：${'threeTransmissions' in data ? data.threeTransmissions[2]?.branch || '未知' : '未知'}`,
        ],
        lines: [
          wrapMainEvidence(formatLiurenFocusSummary(data)),
          formatLiurenNoblemanSummary(data),
          `日干寄宫：${'dayStemResidence' in data && data.dayStemResidence ? `${data.ganzhi.day.charAt(0)}寄${data.dayStemResidence}` : '未知'}`,
          `旬空：${xunKong.join('、')}`,
          `取传法：${'transmissionRule' in data && data.transmissionRule ? data.transmissionRule : '未标注'}`,
          `古籍依据：${
            'classicalRules' in data && data.classicalRules?.length
              ? data.classicalRules
                  .map((item) => `${item.source}之${item.rule}：${item.summary}`)
                  .join('；')
              : '未标注'
          }`,
          `传态：${'transmissionPattern' in data && data.transmissionPattern ? data.transmissionPattern : '未标注'}`,
          formatLiurenLessonShortSummary(data),
          formatLiurenTransmissionShortSummary(data),
          `课体标签：${'patternTags' in data && data.patternTags?.length ? data.patternTags.join('、') : '无明显标签'}`,
          `课体：${'guaTi' in data && data.guaTi?.length ? data.guaTi.join('、') : '无'}`,
          `神煞：${'shenShaSummary' in data && data.shenShaSummary?.length ? data.shenShaSummary.join('；') : '无'}`,
          'transmissionDetail' in data && data.transmissionDetail
            ? `取传说明：${data.transmissionDetail}`
            : '',
        ].filter(Boolean),
      };
    }
    case 'tarot': {
      const tarot = data as TarotData;
      return {
        title: '塔罗抽牌结果',
        tags: [`牌阵：${tarot.spreadName}`, `张数：${tarot.cards.length} 张`],
        lines: [
          wrapMainEvidence(formatTarotFocusSummary(tarot)),
          ...tarot.cards.map(
            (card) => `${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}`,
          ),
        ].filter(Boolean),
      };
    }
    case 'ssgw': {
      if ('ritual' in data && data.ritual?.rejected) {
        return {
          title: '灵签仪式未确认',
          tags: ['本次不起签'],
          lines: [
            `掷筊记录：${data.ritual.throws.map((item) => item.result).join(' → ')}`,
            data.ritual.reason || '本次未获圣杯，不生成签文结论。',
          ],
        };
      }
      const storyContent =
        'number' in data && 'title' in data && 'poem' in data
          ? resolveSsgwStoryContent(data)
          : { canonicalStory: '', extraStory: '' };

      return {
        title: '灵签结果',
        tags: [
          `签号：${'number' in data ? `第 ${data.number} 签` : '未知'}`,
          `签题：${'title' in data ? data.title : '未知'}`,
        ],
        lines: [
          wrapMainEvidence(formatSsgwFocusSummary(data)),
          'title' in data && data.title ? `签题：${data.title}` : '',
          'poem' in data ? `签诗：${data.poem}` : '',
          storyContent.canonicalStory ? `典故：${storyContent.canonicalStory}` : '',
          storyContent.extraStory ? `补充：${storyContent.extraStory}` : '',
          ...('details' in data && data.details
            ? Object.entries(data.details)
                .filter(([key]) => key !== '典故')
                .map(([key, value]) => `${key}：${value}`)
            : []),
        ].filter(Boolean),
      };
    }
    case 'almanac': {
      const almanac = data as AlmanacData;
      const evidence = almanac.evidenceAnalysis ?? analyzeAlmanacEvidence(almanac);
      const candidateByDate = new Map(evidence.candidates.map((item) => [item.date, item]));
      const primaryDate =
        evidence.preferredDates[0] ??
        evidence.conditionalDates[0] ??
        evidence.cautionDates[0] ??
        almanac.days[0]?.date;
      const primary = primaryDate ? candidateByDate.get(primaryDate) : undefined;
      return {
        title: '黄历择日结果',
        tags: [
          `事项：${almanac.topicLabel}`,
          `范围：${almanac.startDate} 至 ${almanac.endDate}`,
          `参与人：${almanac.participants.length || 0} 位`,
        ],
        lines: [
          primary
            ? wrapMainEvidence(
                `${primary.date}，${primary.status}，需结合所列支持、限制与现实条件取舍`,
              )
            : '',
          ...(almanac.days.slice(0, 5).map((item) => {
            const candidate = candidateByDate.get(item.date);
            const constraints = candidate
              ? [
                  ...candidate.traditionalConstraints,
                  ...candidate.participantConflicts,
                  ...candidate.directionConstraints,
                ]
              : [];
            return `${item.date}：${candidate?.status ?? '待核验候选'}，${item.ganzhi.day}日，${item.dayOfficer}执；${constraints.length ? `限制：${constraints.slice(0, 2).join('、')}` : `未见明确传统禁忌；${item.clash}`}`;
          }) ?? []),
        ].filter(Boolean),
      };
    }
    case 'lenormand': {
      const lenormand = data as LenormandData;
      const evidence =
        lenormand.evidenceAnalysis?.traditionalFacts &&
        lenormand.evidenceAnalysis.structuredLayoutFacts
          ? lenormand.evidenceAnalysis
          : analyzeLenormandEvidence(lenormand);
      return {
        title: '雷诺曼抽牌结果',
        tags: [`牌阵：${lenormand.spreadName}`, `张数：${lenormand.cards.length} 张`],
        lines: [
          wrapMainEvidence(
            lenormand.cards
              .slice(0, 3)
              .map((card) => `${card.position}${card.name}`)
              .join('；'),
          ),
          ...lenormand.cards.map((card) => {
            const fact = evidence.traditionalFacts.find(
              (item) => item.kind === '单牌牌义' && item.positions.includes(card.position),
            );
            return `${card.position}：${card.name}，${fact?.promptText ?? conditionLenormandTraditionalText(card.meaning, { cardNames: [card.name], keywords: card.keywords })}`;
          }),
        ].filter(Boolean),
      };
    }
    case 'astrolabe': {
      const astrolabe = data as AstrolabeData;
      const sun = astrolabe.planets.find((item) => item.name === 'Sun');
      const moon = astrolabe.planets.find((item) => item.name === 'Moon');
      const ascendant = astrolabe.angles.find((item) => item.name === 'Ascendant');
      return {
        title: '星盘结果',
        tags: [
          `太阳：${sun?.formatted || '未知'}`,
          `月亮：${moon?.formatted || '未知'}`,
          `上升：${ascendant?.formatted || '未知'}`,
        ],
        lines: [
          wrapMainEvidence(
            `太阳${sun?.formatted || '未知'}；月亮${moon?.formatted || '未知'}；上升${ascendant?.formatted || '未知'}`,
          ),
          `逆行：${astrolabe.summary.retrograde.join('、') || '无'}`,
          `主要相位：${
            astrolabe.aspects
              .slice(0, 5)
              .map((item) => `${item.body1}${item.symbol}${item.body2}`)
              .join('、') || '无'
          }`,
        ].filter(Boolean),
      };
    }
    case 'taiyi': {
      const taiyi = data as TaiyiResult;
      const scopeLabel = {
        year: '年计',
        month: '月计',
        day: '日计',
        hour: '时计',
      }[taiyi.scope];
      return {
        title: `太乙神数${scopeLabel}结果`,
        tags: [
          `${taiyi.ganZhi}·${scopeLabel}`,
          `${taiyi.yinYang}第${taiyi.bureau}局`,
          `太乙在${taiyi.taiyiPosition}`,
        ],
        lines: [
          wrapMainEvidence(
            `太乙${taiyi.taiyiPosition}；文昌${taiyi.wenChangPosition}；始击${taiyi.shiJiPosition}`,
          ),
          `周期分段：第${taiyi.yuan}个72数段、第${taiyi.ji}个60数段`,
          `主客定算：主算${taiyi.lordCount}，客算${taiyi.guestCount}，定算${taiyi.setCount}`,
          `计神：${taiyi.jiShenPosition}`,
          `判断：${taiyi.judgments.join('；')}`,
          `精度：${taiyi.model.precision}`,
        ],
      };
    }
    default:
      return {
        title: '占卜结果',
        tags: [],
        lines: [],
      };
  }
}
