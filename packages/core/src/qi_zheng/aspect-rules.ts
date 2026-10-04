import type { QizhengAspect } from './index';

/** 七政吊照的目标夹角与容许度，供本命、流曜和恩难交会核验共用。 */
const qizhengAspectRules: ReadonlyArray<{
  type: QizhengAspect['type'];
  angle: number;
  orb: number;
}> = [
  { type: '同宫', angle: 0, orb: 8 },
  { type: '六合', angle: 60, orb: 4 },
  { type: '四正', angle: 90, orb: 6 },
  { type: '三方', angle: 120, orb: 6 },
  { type: '对照', angle: 180, orb: 8 },
];

/** 返回独立的七政吊照固定规则。 */
export function getQizhengAspectRules(): typeof qizhengAspectRules {
  return qizhengAspectRules.map((rule) => ({ ...rule }));
}

export const QIZHENG_ASPECTS: typeof qizhengAspectRules = getQizhengAspectRules();
