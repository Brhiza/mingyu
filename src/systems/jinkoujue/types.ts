export type JinkoujueDivinationMethod = 'time' | 'branch' | 'number' | 'random';
export type JinkoujueGuiRenTable = 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu';

export type JinkoujuePositionName = '地分' | '将神' | '贵神' | '人元';

export type JinkoujueYinYang = '阳' | '阴';

export interface JinkoujueFourPosition {
  name: JinkoujuePositionName;
  role: string;
  branch: string;
  stem?: string;
  stemElement?: string;
  god?: string;
  element: string;
  elementBasis: '地分支' | '月将支' | '贵神本属' | '人元干';
  yinYang: JinkoujueYinYang;
  seasonState: string;
  isVoid: boolean;
  support: string[];
  constraints: string[];
  promptText: string;
}

export interface JinkoujueMovement {
  category: '五动' | '三动';
  name: '妻动' | '官动' | '贼动' | '财动' | '鬼动' | '父母动' | '子孙动' | '兄弟动';
  from: JinkoujuePositionName;
  to: JinkoujuePositionName;
  relation: '克' | '生' | '比和';
  trigger: string;
  source: string;
}

export interface JinkoujueData {
  method: JinkoujueDivinationMethod;
  methodLabel: string;
  guiRenTable?: JinkoujueGuiRenTable;
  timestamp: number;
  timezoneOffsetMinutes: number;
  termReferenceTimestamp?: number;
  timeContext?: { standard: 'true-solar'; longitude: number; referenceTimestamp: number; longitudeCorrectionMinutes: number; equationOfTimeMinutes: number; totalCorrectionMinutes: number };
  ganzhi: BaseGanZhi;
  dayNight: '昼占' | '夜占';
  monthLeader: string;
  divinationBranch: string;
  noblemanBranch: string;
  xunKong: string[];
  diFenBranch: string;
  positions: {
    diFen: JinkoujueFourPosition;
    jiangShen: JinkoujueFourPosition;
    guiShen: JinkoujueFourPosition;
    renYuan: JinkoujueFourPosition;
  };
  relations: {
    guiToJiang: string;
    guiToRen: string;
    renToJiang: string;
    jiangToDi: string;
    renToDi: string;
    guiToDi: string;
  };
  yinYangUse: {
    pattern: '三阴一阳' | '三阳一阴' | '二阴二阳' | '纯阴' | '纯阳';
    yinCount: number;
    yangCount: number;
    usePosition: JinkoujuePositionName;
    rule: string;
    isVoid: boolean;
  };
  movements: JinkoujueMovement[];
  mainLine: string;
  /** 四位比合条件：同五行的实际数量与位次；无同五行组合时为空字符串。 */
  bihePoem: string;
  calculation: {
    method: JinkoujueDivinationMethod;
    methodLabel: string;
    inputBase: number;
    inputBaseSource: '占时地支序数' | '指定地分' | '用户数字' | '随机数';
    diFenNote: string;
    monthLeaderRule: string;
    yuanDunRule: string;
    dayNightRule: string;
    noblemanRule: string;
    noblemanDirection: '顺布' | '逆布';
    guiShenRule: string;
  };
  focusEvidence: Array<{
    target: string;
    role: string;
    level: '主证' | '辅证';
    evidence: string[];
    limitations: string[];
  }>;
  summary: string;
}

export interface BaseGanZhi {
  year: string;
  month: string;
  day: string;
  hour: string;
}

