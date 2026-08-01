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
  SsgwData,
  TarotData,
  TaiyiResult,
  XiaoliurenData,
  JinkoujueData,
} from '../../types/divination';
import { rebuildAuditedAlmanacData } from 'mingyu-core/divination/almanac';
import { rebuildAuditedLenormandData } from 'mingyu-core/divination/lenormand';
import { rebuildAuditedTarotData } from 'mingyu-core/divination/tarot';
import { rebuildAuditedXiaoliurenData } from 'mingyu-core/divination/xiaoliuren';
import { rebuildAuditedQimenData } from 'mingyu-core/divination/qimen';
import { analyzeLiurenEvidence, rebuildAuditedLiurenData } from 'mingyu-core/divination/liuren';
import {
  analyzeLiuyaoActivityPattern,
  analyzeLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
  rebuildAuditedLiuyaoData,
} from 'mingyu-core/divination/liuyao';
import { rebuildAuditedMeihuaData } from 'mingyu-core/divination/meihua';
import { rebuildAuditedSsgwData } from 'mingyu-core/divination/ssgw';
import { rebuildAuditedJinkoujueData } from 'mingyu-core/divination/jinkoujue';
import { rebuildAuditedTaiyiData } from 'mingyu-core/taiyi';
import { rebuildAuditedAstrolabeData } from 'mingyu-core/divination/astrolabe';

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

  if ('scope' in data && data.scope && data.scope !== 'hour') {
    return '旬空：适用层级未闭合，未自动推算';
  }

  return '旬空：时旬空复核未定位';
}

function formatQimenHorseSummary(_data: DivinationData) {
  return '马星：起例层级未闭合，未自动推算';
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
  return `节令背景：${seasonality.currentJieQi}，月令五行${seasonality.seasonalElement || '未知'}，日干${seasonality.dayStem}为${seasonality.seasonRelation}，月相${seasonality.lunarPhaseDetail}，建除${seasonality.dayOfficer}`;
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

export function getDivinationSummaryBlocks(
  method: DivinationDraft['method'],
  data: DivinationData,
): DivinationSummaryBlocks {
  switch (method) {
    case 'liuyao': {
      const liuyao = rebuildAuditedLiuyaoData(data as LiuyaoData);
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
      const meihua = rebuildAuditedMeihuaData(data as MeihuaData);
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
      const xiaoliuren = rebuildAuditedXiaoliurenData(data as XiaoliurenData);
      const evidence = xiaoliuren.evidenceAnalysis!;
      return {
        title: '小六壬原始时间事实',
        tags: [
          `起课方式：${xiaoliuren.methodLabel}`,
          `时辰：${xiaoliuren.hourLabel}`,
          `来源状态：${evidence.summaryFact.status}`,
        ],
        lines: [
          `农历事实：${xiaoliuren.isLeapMonth ? '闰' : ''}${xiaoliuren.lunarMonth}月${xiaoliuren.lunarDay}日；${xiaoliuren.hourLabel}；时辰序号${xiaoliuren.calculation.hourNumber}`,
          `历法口径：${xiaoliuren.calculation.dayBoundary}；${xiaoliuren.calculation.leapMonthRule}`,
          evidence.calculationFact.limitation,
        ].filter(Boolean),
      };
    }
    case 'jinkoujue': {
      const jinkoujue = rebuildAuditedJinkoujueData(data as JinkoujueData);
      const evidence = jinkoujue.evidenceAnalysis!;
      return {
        title: '金口诀原始起课记录',
        tags: [
          `起课方式：${jinkoujue.methodLabel}`,
          `日柱：${jinkoujue.ganzhi.day}`,
          `时柱：${jinkoujue.ganzhi.hour}`,
          `来源状态：${evidence.summaryFact.status}`,
        ],
        lines: [
          `四柱：${jinkoujue.ganzhi.year}、${jinkoujue.ganzhi.month}、${jinkoujue.ganzhi.day}、${jinkoujue.ganzhi.hour}`,
          jinkoujue.method === 'number' ? `用户原始数字：${jinkoujue.numberInput}` : '',
          jinkoujue.method === 'random' ? evidence.randomTraceFact.promptText : '',
          evidence.summaryFact.promptText,
          evidence.limitationFacts.find((item) => item.type === '继续推算条件')?.promptText || '',
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
      const liuren = rebuildAuditedLiurenData(data as LiurenData);
      const xunKong = analyzeLiurenEvidence(liuren).calculationFact.xunKong;
      return {
        title: '大六壬起课结果',
        tags: [
          `时段：${liuren.dayNight ?? '未知'}`,
          `月将：${liuren.monthLeader}`,
          `占时：${liuren.divinationBranch}`,
          `初传：${liuren.threeTransmissions[0]?.branch || '未知'}`,
          `末传：${liuren.threeTransmissions[2]?.branch || '未知'}`,
        ],
        lines: [
          wrapMainEvidence(formatLiurenFocusSummary(liuren)),
          formatLiurenNoblemanSummary(liuren),
          `日干寄宫：${liuren.dayStemResidence ? `${liuren.ganzhi.day.charAt(0)}寄${liuren.dayStemResidence}` : '未知'}`,
          `旬空：${xunKong.join('、')}`,
          `取传法：${liuren.transmissionRule ?? '未标注'}`,
          `古籍依据：${
            liuren.classicalRules?.length
              ? liuren.classicalRules
                  .map((item) => `${item.source}之${item.rule}：${item.summary}`)
                  .join('；')
              : '未标注'
          }`,
          `传态：${liuren.transmissionPattern ?? '未标注'}`,
          formatLiurenLessonShortSummary(liuren),
          formatLiurenTransmissionShortSummary(liuren),
          `课体标签：${liuren.patternTags?.length ? liuren.patternTags.join('、') : '无明显标签'}`,
          `课体：${liuren.guaTi?.length ? liuren.guaTi.join('、') : '无'}`,
          `神煞：${liuren.shenShaSummary?.length ? liuren.shenShaSummary.join('；') : '无'}`,
          liuren.transmissionDetail ? `取传说明：${liuren.transmissionDetail}` : '',
        ].filter(Boolean),
      };
    }
    case 'tarot': {
      const tarot = rebuildAuditedTarotData(data as TarotData);
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
      const audited = rebuildAuditedSsgwData(data as SsgwData);
      return {
        title: '灵签结果',
        tags: [`签号：第 ${audited.number} 签`, '签谱待校'],
        lines: [
          '签谱与掷筊规则来源尚未完成校勘，本次只保留签号与抽取记录，不提供签文解释或仪式确认。',
        ],
      };
    }
    case 'almanac': {
      const almanac = rebuildAuditedAlmanacData(data as AlmanacData);
      const evidence = almanac.evidenceAnalysis!;
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
      const lenormand = rebuildAuditedLenormandData(data as LenormandData);
      const evidence = lenormand.evidenceAnalysis!;
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
          ...lenormand.cards.map(
            (card) => `${card.position}：第${card.id}号 ${card.name}；关键词与牌义待具体版本校勘`,
          ),
          `证据状态：${evidence.summaryFact.status}`,
        ].filter(Boolean),
      };
    }
    case 'astrolabe': {
      const astrolabe = rebuildAuditedAstrolabeData(data as AstrolabeData);
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
      const taiyi = rebuildAuditedTaiyiData(data as TaiyiResult);
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
          `周期分段：360周期余数${taiyi.cycleRemainder360}，第${taiyi.segment72}个72数段、第${taiyi.segment60}个60数段`,
          `主客定算：主算${taiyi.lordCount}，客算${taiyi.guestCount}，定算${taiyi.setCount}`,
          `计神：${taiyi.jiShenPosition}`,
          `位置条件：${taiyi.evidenceAnalysis.conditionFacts
            .map(
              (fact) =>
                `${fact.kind}${fact.matched ? '已命中' : '未命中'}：${fact.calculationText}`,
            )
            .join('；')}`,
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
