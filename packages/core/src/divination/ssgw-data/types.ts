export const SSGW_INTERPRETATION_FIELDS = [
  '核心寓意',
  '事业',
  '财运',
  '感情',
  '学业',
  '健康',
  '行动建议',
  '风险提醒',
] as const;

export type SsgwInterpretationField = (typeof SSGW_INTERPRETATION_FIELDS)[number];

export type SsgwInterpretation = Record<SsgwInterpretationField, string>;

export interface RawSsgwSign {
  id: number;
  title: string;
  qianwen: string;
  story: string;
  details: Record<string, string>;
}

export interface SsgwSign extends Omit<RawSsgwSign, 'details'> {
  details: Record<string, string> & SsgwInterpretation;
}
