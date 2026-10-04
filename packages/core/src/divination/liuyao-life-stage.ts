import { BRANCH_ORDER, CHANGSHENG_ORDER } from '../ganzhi';

/** 六爻五行十二长生：金巳、木亥、火寅、水土申起长生。 */
export function getShiErGong(wuxing: string, branch: string): string {
  const starts: Record<string, string> = {
    金: '巳',
    木: '亥',
    火: '寅',
    水: '申',
    土: '申',
  };
  const startBranch = starts[wuxing];
  if (!startBranch) {
    throw new Error(`六爻十二长生无法识别五行 "${wuxing}"。`);
  }
  const startIndex = BRANCH_ORDER.indexOf(startBranch);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  if (startIndex === -1 || branchIndex === -1) {
    throw new Error(`六爻十二长生无法识别地支 "${branch}"。`);
  }
  const offset = (((branchIndex - startIndex) % 12) + 12) % 12;
  const stage = CHANGSHENG_ORDER[offset];
  if (!stage) {
    throw new Error(`六爻十二长生无法定位 ${wuxing} 在 ${branch} 支的状态。`);
  }
  return stage;
}
