import type { LiurenData, LiurenTemplateType } from '../../types/divination';

export function getLiurenPatternHint(pattern?: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '传态伏吟：旧因反复。';
  }
  if (pattern === '反吟') {
    return '传态反吟：冲动与反复并存。';
  }
  if (pattern === '回环') {
    return '传态回环：问题会回到原点。';
  }
  if (pattern === '递传') {
    return '传态递传：按阶段推进。';
  }

  return '传态未标注。';
}

const TOPIC_GODS: Record<Exclude<LiurenTemplateType, 'general'>, readonly string[]> = {
  ganqing: ['天后', '六合', '青龙'],
  shiye: ['贵人', '朱雀', '青龙'],
  caifu: ['青龙', '太常', '天空'],
};

function formatGodLocations(data: LiurenData, god: string) {
  const plateHits = data.heavenlyPlate.filter((item) => item.god === god);
  const lessonHits = data.fourLessons.filter((item) => item.god === god);
  const transmissionHits = data.threeTransmissions.filter((item) => item.god === god);
  const plateText = plateHits.length
    ? plateHits.map((item) => `天盘${item.branch}下临地盘${item.under}`).join('、')
    : '未见';
  const lessonText = lessonHits.length
    ? lessonHits.map((item) => `${item.name}${item.upper}临${item.lower}`).join('、')
    : '未见';
  const transmissionText = transmissionHits.length
    ? transmissionHits
        .map((item) => {
          const conditions = [
            item.seasonState ? `月令${item.seasonState}` : '',
            typeof item.isVoid === 'boolean' ? (item.isVoid ? '旬空' : '不逢旬空') : '',
            item.dayRelation || '',
          ].filter(Boolean);
          return `${item.stage}${item.branch}${conditions.length ? `（${conditions.join('、')}）` : ''}`;
        })
        .join('、')
    : '未见';
  return `${god}：天地盘${plateText}；四课命中${lessonText}；三传命中${transmissionText}`;
}

export function buildLiurenTemplateText(template: LiurenTemplateType, data: LiurenData) {
  const templateLabelMap: Record<LiurenTemplateType, string> = {
    general: '通用',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财富财运',
  };
  const mainLineMap: Record<LiurenTemplateType, string> = {
    general: '类神：日干为我、日支为事；三传看发端、转折和归结',
    ganqing: '类神：感情看天后、六合、青龙；日干为我、日支为关系',
    shiye: '类神：事业看贵人、朱雀、青龙；日干为我、日支为事务',
    caifu: '类神：财运看青龙、太常、天空；日干为我、日支为财源或交易',
  };
  const safeTemplate = templateLabelMap[template] ? template : 'general';

  if (safeTemplate === 'general') {
    return `${templateLabelMap[safeTemplate]}；${mainLineMap[safeTemplate]}`;
  }

  const locations = TOPIC_GODS[safeTemplate].map((god) => formatGodLocations(data, god)).join('；');
  return `${templateLabelMap[safeTemplate]}；${mainLineMap[safeTemplate]}；事项类神盘面定位：${locations}；初传保持发用结构，事项类神按上述盘面定位与三传条件合看`;
}
