import type { DivinationMethodId } from '../divination/config';
import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  JinkoujueData,
  LenormandData,
  LiurenData,
  LiuyaoData,
  MeihuaData,
  QimenData,
  SsgwData,
  TaiyiResult,
  TarotData,
  XiaoliurenData,
} from '../types/divination';
import { formatAstrolabeForPrompt } from './astrolabe';
import { formatDivinationInfo } from './divination';

type SupportedMethod = Exclude<DivinationMethodId, 'random'>;

function formatLiuyaoDetail(data: LiuyaoData) {
  return [
    `爻位：${data.yaosDetail
      .slice()
      .sort((a, b) => b.position - a.position)
      .map(
        (item) =>
          `第${item.position}爻${item.sixGod}${item.sixRelative}${item.najiaDizhi}${item.wuxing}${item.isWorld ? '（世）' : ''}${item.isResponse ? '（应）' : ''}${item.isChanging ? '（动）' : ''}${item.isVoid ? '（空）' : ''}`,
      )
      .join('；')}`,
    data.hiddenSpirits?.length
      ? `伏神：${data.hiddenSpirits
          .map(
            (item) =>
              `${item.sixRelative}伏第${item.position}爻${item.najiaDizhi}${item.wuxing}，伏于${item.underYao.sixRelative}${item.underYao.najiaDizhi}${item.underYao.wuxing}下${item.isVoid ? '（空）' : ''}`,
          )
          .join('；')}`
      : '',
    data.hexagramRelations
      ? `整卦关系：${[
          data.hexagramRelations.original,
          data.hexagramRelations.changed,
          data.hexagramRelations.transition,
        ]
          .filter(Boolean)
          .join('；')}`
      : '',
    data.fanfuRelations?.labels.length ? `反伏关系：${data.fanfuRelations.labels.join('、')}` : '',
    data.sanheWithDay
      ? `日辰三合：${data.sanheWithDay.group}（${data.sanheWithDay.members.join('、')}）`
      : '',
    data.sanheWithMonth
      ? `月建三合：${data.sanheWithMonth.group}（${data.sanheWithMonth.members.join('、')}）`
      : '',
    data.sanxingInYaos?.length
      ? `三刑：${data.sanxingInYaos.map((item) => `${item.branches.join('、')}为${item.type}`).join('；')}`
      : '',
  ];
}

function formatMeihuaDetail(data: MeihuaData) {
  const hexagrams = [data.mainHexagram, data.interHexagram, data.changedHexagram]
    .map((item) => (item ? item : null))
    .filter((item) => item !== null)
    .map((item) => {
      const yaoCi = item.yaoCi?.length ? `；爻辞${item.yaoCi.join('、')}` : '';
      return `${item.name}（${item.upper}上${item.lower}下）${item.description ? `：${item.description}` : ''}${yaoCi}`;
    });
  return [
    `卦体：${hexagrams.join('\n')}`,
    `爻位：${data.yaosDetail
      .slice()
      .sort((a, b) => b.position - a.position)
      .map(
        (item) =>
          `第${item.position}爻${item.yaoType}（${item.tiYong}）${item.isChanging ? '，动' : ''}`,
      )
      .join('；')}`,
    data.calculation
      ? `起卦计算：${data.calculation.method}${data.calculation.numbers?.length ? `；数字${data.calculation.numbers.join('、')}` : ''}${data.calculation.time ? `；时间${data.calculation.time}` : ''}`
      : '',
  ];
}

function formatXiaoliurenDetail(data: XiaoliurenData) {
  return [
    `顺数：月宫${data.sequence.month.name}（${data.sequence.month.verse}）→日宫${data.sequence.day.name}（${data.sequence.day.verse}）→时宫${data.sequence.hour.name}（${data.sequence.hour.verse}）`,
    `历法：农历${data.lunarMonth}月${data.lunarDay}日，${data.isLeapMonth ? '闰月' : '平月'}，${data.calculation.dayBoundary}，${data.calculation.leapMonthRule}`,
  ];
}

function formatJinkoujueDetail(data: JinkoujueData) {
  const positions = [
    data.positions.diFen,
    data.positions.jiangShen,
    data.positions.guiShen,
    data.positions.renYuan,
  ];
  return [
    `四位：${positions.map((item) => `${item.name}${item.stem ?? ''}${item.branch}（${item.element}，${item.yinYang}，月令${item.seasonState}${item.isVoid ? '，空' : ''}）`).join('；')}`,
    `五动三动：${data.movements.map((item) => `${item.category}${item.name}（${item.trigger}）`).join('；') || '未记录'}`,
    `四位关系：贵将${data.relations.guiToJiang}；贵人${data.relations.guiToRen}；将地${data.relations.jiangToDi}；人地${data.relations.renToDi}；贵地${data.relations.guiToDi}`,
  ];
}

function formatQimenDetail(data: QimenData) {
  return [
    `九宫：${data.jiuGongGe
      .slice()
      .sort((a, b) => a.gong - b.gong)
      .map(
        (item) =>
          `${item.gong}宫${item.name}${item.direction}：天盘${item.tianPan.stem}${item.tianPan.star}；地盘${item.diPan.stem}；${item.renPan.door}；${item.shenPan.god}`,
      )
      .join('\n')}`,
    data.patternDetails?.length
      ? `格局明细：${data.patternDetails.map((item) => `${item.tag}：${item.summary}`).join('；')}`
      : '',
    data.directions
      ? `方位：宜${data.directions.goodDirections.map((item) => `${item.direction}（${item.use}）`).join('、') || '未列'}；慎${data.directions.avoidDirections.map((item) => `${item.direction}（${item.use}）`).join('、') || '未列'}`
      : '',
  ];
}

function formatLiurenDetail(data: LiurenData) {
  return [
    `地盘：${data.earthlyPlate?.join('、') || '未列'}`,
    `天盘：${data.heavenlyPlate.map((item) => `${item.under}上${item.branch}乘${item.god}`).join('；')}`,
    `四课：${data.fourLessons.map((item) => `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}`).join('；')}`,
    `三传：${data.threeTransmissions.map((item) => `${item.stage}${item.branch}乘${item.god}，${item.relation}${item.isVoid ? '（空）' : ''}`).join('；')}`,
    data.guaTi?.length ? `课体：${data.guaTi.join('、')}` : '',
  ];
}

function formatTarotDetail(data: TarotData) {
  return [
    `牌位：${data.cards.map((card) => `${card.position}${card.name}（${card.reversed ? '逆位' : '正位'}${card.element ? `，${card.element}` : ''}）`).join('；')}`,
  ];
}

function formatSsgwDetail(data: SsgwData) {
  const details = data.details ?? {};
  const basic = details['核心寓意']?.trim() || details['解签']?.trim() || details['签意']?.trim();
  const supplementary = Object.entries(details)
    .filter(
      ([key, value]) =>
        !['吉凶', '典故', '核心寓意', '解签', '签意', '行动建议', '风险提醒'].includes(key) &&
        value.trim(),
    )
    .map(([key, value]) => `${key}：${value.trim()}`);
  return [
    details['吉凶']?.trim() ? `吉凶级别：${details['吉凶'].trim()}` : '',
    data.story?.trim() ? `典故：${data.story.trim()}` : '',
    basic ? `基础解签：${basic}` : '',
    supplementary.length ? `补充解释：${supplementary.join('；')}` : '',
  ];
}

function formatAlmanacDetail(data: AlmanacData) {
  return [
    `参与人：${data.participants.map((item) => `${item.name}（${item.gender || '性别未填'}，${item.solarDate}，${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}）`).join('；') || '未列'}`,
    `候选日：${data.days.map((item) => `${item.date}：${item.ganzhi.day}，${item.dayOfficer}执，宜${item.recommends.slice(0, 8).join('、') || '无'}，忌${item.avoids.slice(0, 8).join('、') || '无'}，${item.clash}`).join('\n')}`,
  ];
}

function formatLenormandDetail(data: LenormandData) {
  return [
    `牌位：${data.cards.map((card) => `${card.position}${card.name}（${card.keywords.join('、')}）`).join('；')}`,
    data.combinations?.length
      ? `组合：${data.combinations.map((item) => `${item.card1}+${item.card2}：${item.meaning}`).join('；')}`
      : '',
  ];
}

function formatAstrolabeDetail(data: AstrolabeData) {
  return [formatAstrolabeForPrompt(data)];
}

function formatTaiyiDetail(data: TaiyiResult) {
  return [
    `宫位：太乙${data.taiyiPosition}；文昌${data.wenChangPosition}；始击${data.shiJiPosition}；计神${data.jiShenPosition}`,
    `主客定算：主算${data.lordCount}、客算${data.guestCount}、定算${data.setCount}；主大${data.lordGeneral}、主参${data.lordAssistant}；客大${data.guestGeneral}、客参${data.guestAssistant}；定大${data.setGeneral}、定参${data.setAssistant}`,
  ];
}

/** 输出比摘要更完整的、可直接拼入任务书的占法资料。 */
export function formatDetailedDivinationInfo(method: SupportedMethod, data: DivinationData) {
  const detail = (() => {
    switch (method) {
      case 'liuyao':
        return formatLiuyaoDetail(data as LiuyaoData);
      case 'meihua':
        return formatMeihuaDetail(data as MeihuaData);
      case 'xiaoliuren':
        return formatXiaoliurenDetail(data as XiaoliurenData);
      case 'jinkoujue':
        return formatJinkoujueDetail(data as JinkoujueData);
      case 'qimen':
        return formatQimenDetail(data as QimenData);
      case 'liuren':
        return formatLiurenDetail(data as LiurenData);
      case 'tarot':
        return formatTarotDetail(data as TarotData);
      case 'ssgw':
        return formatSsgwDetail(data as SsgwData);
      case 'almanac':
        return formatAlmanacDetail(data as AlmanacData);
      case 'lenormand':
        return formatLenormandDetail(data as LenormandData);
      case 'astrolabe':
        return formatAstrolabeDetail(data as AstrolabeData);
      case 'taiyi':
        return formatTaiyiDetail(data as TaiyiResult);
      default:
        return [];
    }
  })();

  return [formatDivinationInfo(method, data), '详细资料：', ...detail].filter(Boolean).join('\n');
}
