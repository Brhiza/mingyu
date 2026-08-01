import type { SsgwSign } from './types';

export { SSGW_INTERPRETATION_FIELDS } from './types';
export type { SsgwInterpretation, SsgwInterpretationField, SsgwSign } from './types';

const EMPTY_INTERPRETATION = {
  核心寓意: '',
  事业: '',
  财运: '',
  感情: '',
  学业: '',
  健康: '',
  行动建议: '',
  风险提醒: '',
};

/**
 * 只保留可复算的九十二签编号池。
 *
 * 仓库旧签谱没有可定位到具体庙本、出版物或存档页面的来源，签题、签诗、典故和
 * 分类释义在完成逐签校勘前失败关闭，禁止作为传统原文或解释依据公开输出。
 */
export const SSGW_SIGNS: SsgwSign[] = Array.from({ length: 92 }, (_, index) => ({
  id: index + 1,
  title: `第${index + 1}签（签谱待校）`,
  qianwen: '',
  story: '',
  details: { ...EMPTY_INTERPRETATION },
}));
