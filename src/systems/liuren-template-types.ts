export type LiurenTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu';
export type LiurenTemplateData = {
  transmissionPattern?: '伏吟' | '反吟' | '回环' | '递传';
  heavenlyPlate: Array<{ god: string; branch: string; under: string }>;
  fourLessons: Array<{ god: string; name: string; upper: string; lower: string; relation?: string }>;
  threeTransmissions: Array<{ god: string; stage: string; branch: string; seasonState?: string; isVoid?: boolean; dayRelation?: string }>;
};
