/**
 * @file 塔罗大阿卡那原型演进轴（The Fool's Journey）
 * @传统依据 Arthur Edward Waite《The Pictorial Key to the Tarot》与荣格原型心理学：
 * 22张大阿卡那代表从 0 号愚人出发的心灵成长阶梯，分为三大演进阶段：
 * 阶段一（1魔术师 至 7战车）：个体意识建立与世俗整合；
 * 阶段二（8力量 至 14节制）：内在心理冲突与潜意识整合；
 * 阶段三（15恶魔 至 21世界）：超个人解构与精神完整。
 */

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
    range: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    stageNumber: 2 as const,
    stageName: '心灵考验阶段（道德冲突与潜意识整合）',
    theme: '面对内在阴影、独处反思、接纳牺牲与寻求中道',
    range: [8, 9, 10, 11, 12, 13, 14],
  },
  {
    stageNumber: 3 as const,
    stageName: '灵性转化阶段（超个人意识与生命完整）',
    theme: '破除执念幻相、经历结构瓦解、重获希望与圆满觉醒',
    range: [15, 16, 17, 18, 19, 20, 21],
  },
];

/**
 * 分析牌阵中大阿卡那在愚人之旅演进轴上的阶段分布与重心
 */
export function analyzeTarotArchetypeJourney(
  cards: Array<{ id: number; name: string; reversed: boolean }>,
): TarotArchetypeJourneyResult {
  const majors = cards.filter((c) => c.id >= 0 && c.id <= 21);
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

  // 判定重心阶段
  let maxCount = 0;
  let dominantStage: string | undefined;
  for (const s of stages) {
    if (s.matchedCards.length > maxCount) {
      maxCount = s.matchedCards.length;
      dominantStage = s.stageName;
    }
  }

  const stageDesc = stages
    .filter((s) => s.matchedCards.length > 0)
    .map(
      (s) =>
        `阶段${s.stageNumber}（${s.matchedCards.map((c) => `${c.name}${c.reversed ? '(逆)' : ''}`).join('、')}）`,
    )
    .join('；');

  const summary =
    majors.length > 0
      ? `【塔罗原型演进轴】共抽得 ${majors.length} 张大阿卡那，主导演进重心为「${dominantStage ?? '均衡分布'}」；阶段分布：${stageDesc}。`
      : '【塔罗原型演进轴】本次牌面均为小阿卡那，侧重具体日常事件与情绪细节，未显现重大原型演进主题。';

  return {
    majorCardCount: majors.length,
    minorCardCount: minorCount,
    dominantStage,
    stages,
    summary,
  };
}
