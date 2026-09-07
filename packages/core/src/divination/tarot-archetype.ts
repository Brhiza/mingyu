/**
 * @file 塔罗大阿卡那原型演进轴（The Fool's Journey）
 * @解释口径 采用现代愚人之旅主题分组，统计牌面分布，不作为心理发展阶段的判定。
 * 以下为牌面序号，输入 id 使用牌库编号（愚者为1、世界为22）：
 * 阶段一（1魔术师 至 7战车）：个体意识建立与世俗整合；
 * 阶段二（8力量 至 14节制）：内在心理冲突与潜意识整合；
 * 阶段三（15恶魔 至 21世界）：超个人解构与精神完整。
 */
import { tarotCards } from './tarot-data';

export interface TarotArchetypeStage {
  stageNumber: 1 | 2 | 3;
  stageName: string;
  theme: string;
  matchedCards: Array<{ id: number; name: string; reversed: boolean }>;
}

export interface TarotArchetypeJourneyResult {
  majorCardCount: number;
  minorCardCount: number;
  dominantStage?: string;
  stages: TarotArchetypeStage[];
  summary: string;
}

const STAGE_CONFIGS = [
  {
    stageNumber: 1 as const,
    stageName: '个体成长阶段（自我建立与世俗力量）',
    theme: '确立意志、建立边界、掌握工具与社会适应',
    range: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    stageNumber: 2 as const,
    stageName: '心灵考验阶段（道德冲突与潜意识整合）',
    theme: '面对内在阴影、独处反思、接纳牺牲与寻求中道',
    range: [9, 10, 11, 12, 13, 14, 15],
  },
  {
    stageNumber: 3 as const,
    stageName: '灵性转化阶段（超个人意识与生命完整）',
    theme: '破除执念幻相、经历结构瓦解、重获希望与圆满觉醒',
    range: [16, 17, 18, 19, 20, 21, 22],
  },
];

/**
 * 分析牌阵中大阿卡那在愚人之旅演进轴上的阶段分布与重心
 */
export function analyzeTarotArchetypeJourney(
  cards: Array<{ id: number; name: string; reversed: boolean }>,
): TarotArchetypeJourneyResult {
  if (!Array.isArray(cards)) throw new Error('塔罗牌面必须是数组');
  const ids = new Set<number>();
  for (const card of cards) {
    if (
      !card ||
      !tarotCards.some((item) => item.number === card.id && item.name === card.name) ||
      typeof card.reversed !== 'boolean'
    ) {
      throw new Error('塔罗牌号、牌名或正逆位无效');
    }
    if (ids.has(card.id)) throw new Error('同一牌阵不能重复录入塔罗牌');
    ids.add(card.id);
  }
  const majors = cards.filter((c) => c.id >= 1 && c.id <= 22);
  const minorCount = cards.length - majors.length;

  const stages: TarotArchetypeStage[] = STAGE_CONFIGS.map((cfg) => {
    const matched = majors.filter((c) => cfg.range.includes(c.id));
    return {
      stageNumber: cfg.stageNumber,
      stageName: cfg.stageName,
      theme: cfg.theme,
      matchedCards: matched,
    };
  });

  const maxCount = Math.max(...stages.map((stage) => stage.matchedCards.length));
  const leadingStages = stages.filter(
    (stage) => maxCount > 0 && stage.matchedCards.length === maxCount,
  );
  const dominantStage = leadingStages.length === 1 ? leadingStages[0].stageName : undefined;

  const stageDesc = stages
    .filter((s) => s.matchedCards.length > 0)
    .map(
      (s) =>
        `阶段${s.stageNumber}（${s.matchedCards.map((c) => `${c.name}${c.reversed ? '(逆)' : ''}`).join('、')}）`,
    )
    .join('；');

  const summary =
    majors.length > 0
      ? `【塔罗原型演进轴】共抽得 ${majors.length} 张大阿卡那，${dominantStage ? `牌数最多的阶段为「${dominantStage}」` : `牌数并列最多的阶段为${leadingStages.map((stage) => `「${stage.stageName}」`).join('、')}`}；阶段分布：${stageDesc}。`
      : cards.length > 0
        ? `【塔罗原型演进轴】本次 ${minorCount} 张均为小阿卡那，按牌位与具体牌义解读。`
        : '【塔罗原型演进轴】当前尚无牌面。';

  return {
    majorCardCount: majors.length,
    minorCardCount: minorCount,
    dominantStage,
    stages,
    summary,
  };
}
