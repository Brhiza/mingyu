/**
 * 占卜结果摘要:把不同卦种的输出统一格式化为标签+明细行,供 UI 渲染。
 */

import type { DivinationDraft } from './engine';
import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  LenormandData,
  LiuyaoData,
  MeihuaData,
  TarotData,
  XiaoliurenData,
} from '../../types/divination';
import { resolveSsgwStoryContent } from './ssgw-content';
import { formatTarotCardLabel, getTarotFocusCards } from './tarot-focus';

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
  const labels = data.fanfuRelations?.labels;
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
        `${item.sixRelative}伏第${item.position}爻${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}`,
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

  const zhiFuPalace = data.jiuGongGe.find((item) => item.tianPan.star === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const hourStem = data.ganzhi.hour.charAt(0);
  const hourStemPalaces = data.jiuGongGe.filter(
    (item) => item.tianPan.stem === hourStem || item.diPan.stem === hourStem,
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
  return `节令背景：${seasonality.currentJieQi}${seasonality.jieQiPhase.phase}，节气五行${seasonality.seasonalElement || '未知'}，日干${seasonality.dayStem}${seasonality.seasonRelation}，月相${seasonality.lunarPhaseDetail || seasonality.lunarPhase}，建除${seasonality.dayOfficer}${seasonality.dayOfficerFortuneLabel}`;
}

function formatQimenPatternComboSummary(data: DivinationData) {
  if (!('patternCombos' in data) || !data.patternCombos?.length) {
    return '';
  }

  return `复合格局：${data.patternCombos
    .slice(0, 3)
    .map((item) => `${item.name}（${item.score}）`)
    .join('、')}`;
}

function formatMeihuaSeasonSummary(data: MeihuaData) {
  return `四时：${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`;
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
    external: '外应起卦法',
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

function formatMeihuaExternalSummary(data: MeihuaData) {
  const isExternalMethod =
    data.calculation?.methodKey === 'external' || data.calculation?.method === '外应起卦法';

  if (!data.calculation?.externalSummary || !isExternalMethod) {
    return '';
  }

  return `外应：${data.calculation.externalSummary}`;
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

  return getTarotFocusCards(data)
    .map((card) => formatTarotCardLabel(card))
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
          `特殊卦式：${liuyao.specialPattern || '常规卦'}`,
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
          formatMeihuaExternalSummary(meihua),
        ].filter(Boolean),
      };
    }
    case 'xiaoliuren': {
      const xiaoliuren = data as XiaoliurenData;
      return {
        title: '小六壬起课结果',
        tags: [
          `起课方式：${xiaoliuren.methodLabel}`,
          `主判断：${xiaoliuren.primary.name}`,
          `倾向：${xiaoliuren.tendency}`,
        ],
        lines: [
          wrapMainEvidence(
            `起因${xiaoliuren.sequence.start.name}；过程${xiaoliuren.sequence.process.name}；结果${xiaoliuren.sequence.result.name}`,
          ),
          `起因：${xiaoliuren.sequence.start.keywords.join('、')}`,
          `过程：${xiaoliuren.sequence.process.keywords.join('、')}`,
          `结果：${xiaoliuren.sequence.result.keywords.join('、')}`,
          `提醒：${xiaoliuren.questionHint}`,
        ].filter(Boolean),
      };
    }
    case 'qimen':
      return {
        title: '奇门起局结果',
        tags: [
          `局数：${'isYangDun' in data ? `${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局` : '未知'}`,
          `值符：${'zhiFu' in data ? data.zhiFu : '未知'}`,
          `值使：${'zhiShi' in data ? data.zhiShi : '未知'}`,
        ],
        lines: [
          wrapMainEvidence(formatQimenFocusSummary(data)),
          `节气：${'timeInfo' in data ? data.timeInfo.solarTerm : '未知'}`,
          formatQimenSeasonalitySummary(data),
          `格局标签：${'patternTags' in data && data.patternTags?.length ? data.patternTags.join('、') : '无明显标签'}`,
          formatQimenPatternComboSummary(data),
          formatQimenVoidSummary(data),
          formatQimenHorseSummary(data),
          formatQimenSpecialTimeSummary(data),
        ].filter(Boolean),
      };
    case 'liuren':
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
          `旬空：${'xunKong' in data && data.xunKong?.length ? data.xunKong.join('、') : '未知'}`,
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
    case 'tarot': {
      const tarot = data as TarotData;
      return {
        title: '塔罗抽牌结果',
        tags: [`牌阵：${tarot.spreadName}`, `张数：${tarot.cards.length} 张`],
        lines: [
          wrapMainEvidence(formatTarotFocusSummary(tarot)),
          ...tarot.cards.map(
            (card) =>
              `${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}，关键词 ${card.keywords.join('、')}`,
          ),
        ].filter(Boolean),
      };
    }
    case 'ssgw': {
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
      const best = almanac.days[0];
      return {
        title: '黄历择日结果',
        tags: [
          `事项：${almanac.topicLabel}`,
          `范围：${almanac.startDate} 至 ${almanac.endDate}`,
          `参与人：${almanac.participants.length || 0} 位`,
        ],
        lines: [
          best ? wrapMainEvidence(`${best.date}，评分${best.score}`) : '',
          ...(almanac.days
            .slice(0, 5)
            .map(
              (item) =>
                `${item.date}：${item.ganzhi.day}日，${item.dayOfficer}执，评分${item.score}，${item.clash}`,
            ) ?? []),
        ].filter(Boolean),
      };
    }
    case 'lenormand': {
      const lenormand = data as LenormandData;
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
            (card) => `${card.position}：${card.name}，关键词 ${card.keywords.join('、')}`,
          ),
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
    default:
      return {
        title: '占卜结果',
        tags: [],
        lines: [],
      };
  }
}
