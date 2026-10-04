/**
 * 太乙三门、五将与阴阳和条件。
 *
 * 这些条件只描述盘面中可以由现有宫位、算数和积数直接复算的关系，
 * 不把条件命中数转换成分数、概率或现实成败。
 */

const CANONICAL_TAIYI_GATE_ORDER = [
  '开门',
  '休门',
  '生门',
  '伤门',
  '杜门',
  '景门',
  '死门',
  '惊门',
] as const;

export const TAIYI_GATE_ORDER: typeof CANONICAL_TAIYI_GATE_ORDER = [...CANONICAL_TAIYI_GATE_ORDER];

export type TaiyiGateName = (typeof TAIYI_GATE_ORDER)[number];

/** 太乙八宫左行顺序：乾一、坎八、艮三、震四、巽九、离二、坤七、兑六。 */
const CANONICAL_TAIYI_GATE_PALACE_ORDER = [1, 8, 3, 4, 9, 2, 7, 6] as const;

export const TAIYI_GATE_PALACE_ORDER: typeof CANONICAL_TAIYI_GATE_PALACE_ORDER = [
  ...CANONICAL_TAIYI_GATE_PALACE_ORDER,
];

const TAIYI_THREE_AUSPICIOUS_GATES = new Set<TaiyiGateName>(['开门', '休门', '生门']);
const TAIYI_TWO_GATE_INCOMPLETE = new Set<TaiyiGateName>(['开门', '生门']);

/** 太乙本宫的阴阳：八三四九为阳，二七六一为阴。 */
const TAIYI_YANG_PALACES = new Set([8, 3, 4, 9]);

/** 十六神中八个正宫位为阳，其余八个间辰为阴。 */
const TAIYI_YANG_POINTS = new Set(['乾', '子', '艮', '卯', '巽', '午', '坤', '酉']);

export type TaiyiPalaceRelation = '同宫' | '击' | '迫' | '格';
export type TaiyiPolarity = '阳' | '阴';
export type TaiyiWuxing = '木' | '火' | '土' | '金' | '水';

/** 十六神所在神名的五行，取《古今图书集成·太乙淘金歌·定胜负》所列二目五行。 */
const CANONICAL_TAIYI_POINT_WUXING: Readonly<Partial<Record<string, TaiyiWuxing>>> = {
  子: '水',
  丑: '土',
  艮: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巽: '木',
  巳: '火',
  午: '火',
  未: '土',
  坤: '土',
  申: '金',
  酉: '金',
  戌: '土',
  乾: '金',
  亥: '水',
};

export const TAIYI_POINT_WUXING: typeof CANONICAL_TAIYI_POINT_WUXING = {
  ...CANONICAL_TAIYI_POINT_WUXING,
};

export type TaiyiHostGuestElementRelation =
  '客关主' | '主关客' | '同类' | '未形成五行相制' | '未判定';

export interface TaiyiGateRoleFact {
  role: '太乙' | '文昌（主目）' | '始击（客目）';
  position: string;
  palace: number;
  gate?: TaiyiGateName;
  /** 始击的门位保留展示，但不并入当前“太乙、文昌主目”三门具判定。 */
  usedForThreeGate: boolean;
}

export interface TaiyiThreeGateCondition {
  directGate: TaiyiGateName;
  /** 240 周期余数，余 0 以 240 表示。 */
  directGateRemainder: number;
  /** 直门在开、休、生、伤、杜、景、死、惊中的序号，1-8。 */
  directGateNumber: number;
  gateByPalace: Record<number, TaiyiGateName>;
  roles: TaiyiGateRoleFact[];
  /** 当前三门具判定采用主门口径：太乙与文昌（主目）。 */
  gateScope: '太乙、文昌（主目）';
  complete: boolean;
  status: '三门具' | '两门不具' | '三门不具';
  missingGateCount: 0 | 2 | 3;
  blockedRoles: string[];
  basis: string;
}

export interface TaiyiFiveGeneralsRelation {
  relation: TaiyiPalaceRelation;
  left: string;
  leftPalace: number;
  right: string;
  rightPalace: number;
  kind: '始击掩/击' | '文昌囚/迫' | '主客同宫关' | '客目/客将格' | '文昌对';
}

/** 卷四“推主客相关法”的二目五行事实；不冒充卷三同宫关。 */
export interface TaiyiHostGuestElementFact {
  hostPosition: string;
  hostElement?: TaiyiWuxing;
  guestPosition: string;
  guestElement?: TaiyiWuxing;
  relation: TaiyiHostGuestElementRelation;
  /** 卷四另称以日计纳音决之；当前接口只具备二目所在十六神，故不宣称完整日计纳音判层。 */
  complete: boolean;
  usedForFiveGeneralsLaunch: false;
  basis: string;
}

export interface TaiyiFiveGeneralsCondition {
  shiJiNoCoverOrHit: boolean;
  shiJiRelationToTaiyi?: TaiyiPalaceRelation;
  wenChangNoImprisonOrPressure: boolean;
  wenChangRelationToTaiyi?: TaiyiPalaceRelation;
  /** 卷三“推关法”同宫关；中宫同宫也计入，只有邻/对关系跳过中宫。 */
  hostGuestNoSamePalaceRelation: boolean;
  /** 卷三格、对另列：客目/客将对太乙为格，文昌对太乙为对。 */
  noGuestOppositionOrWenChangOpposition: boolean;
  hostGuestElementRelation: TaiyiHostGuestElementFact;
  relations: TaiyiFiveGeneralsRelation[];
  launched: boolean;
  launchRule: string;
  basis: string;
}

export interface TaiyiYinYangPairFact {
  role: '太乙-主算' | '太乙-客算' | '文昌-主算' | '始击-客算';
  position?: string;
  palace: number;
  polarity: TaiyiPolarity;
  count: number;
  countPolarity: TaiyiPolarity;
  matched: boolean;
  basis: string;
}

export interface TaiyiYinYangCondition {
  matched: boolean;
  pairFacts: TaiyiYinYangPairFact[];
  basis: string;
}

export interface TaiyiRuleConditions {
  threeGates: TaiyiThreeGateCondition;
  fiveGenerals: TaiyiFiveGeneralsCondition;
  yinYangHarmony: TaiyiYinYangCondition;
}

export interface TaiyiConditionInput {
  accumulatedValue: number;
  taiyiPosition: string;
  taiyiPalace: number;
  wenChangPosition: string;
  wenChangPalace: number;
  shiJiPosition: string;
  shiJiPalace: number;
  lordCount: number;
  guestCount: number;
  lordGeneral: number;
  lordAssistant: number;
  guestGeneral: number;
  guestAssistant: number;
}

function positiveOneBased(value: number, cycle: number): number {
  const remainder = ((value % cycle) + cycle) % cycle;
  return remainder === 0 ? cycle : remainder;
}

function relationBetweenPalaces(
  leftPalace: number,
  rightPalace: number,
): TaiyiPalaceRelation | undefined {
  // 中宫不参加八宫的前后邻宫、对宫关系，但两将同入中宫仍属于同宫相关。
  if (leftPalace === rightPalace) return '同宫';
  if (leftPalace === 5 || rightPalace === 5) return undefined;
  const leftIndex = CANONICAL_TAIYI_GATE_PALACE_ORDER.indexOf(
    leftPalace as (typeof CANONICAL_TAIYI_GATE_PALACE_ORDER)[number],
  );
  const rightIndex = CANONICAL_TAIYI_GATE_PALACE_ORDER.indexOf(
    rightPalace as (typeof CANONICAL_TAIYI_GATE_PALACE_ORDER)[number],
  );
  if (leftIndex < 0 || rightIndex < 0) return undefined;
  const distance = Math.abs(leftIndex - rightIndex);
  const circularDistance = Math.min(distance, CANONICAL_TAIYI_GATE_PALACE_ORDER.length - distance);
  if (circularDistance === 0) return '同宫';
  if (circularDistance === 1) return '迫';
  if (circularDistance === 4) return '格';
  return undefined;
}

/** 二目按十六神原位判同宫与邻位，不能先把间辰折入相邻八宫。 */
function relationBetweenEyeAndTaiyi(
  eyePosition: string,
  taiyiPosition: string,
  eyePalace: number,
  taiyiPalace: number,
  adjacentRelation: '击' | '迫',
): TaiyiPalaceRelation | undefined {
  const positions = '子丑艮寅卯辰巽巳午未坤申酉戌乾亥';
  const eyeIndex = positions.indexOf(eyePosition);
  const taiyiIndex = positions.indexOf(taiyiPosition);
  if (eyeIndex >= 0 && taiyiIndex >= 0) {
    const distance = Math.abs(eyeIndex - taiyiIndex);
    const circularDistance = Math.min(distance, positions.length - distance);
    if (circularDistance === 0) return '同宫';
    if (circularDistance <= 2) return adjacentRelation;
  }
  return relationBetweenPalaces(eyePalace, taiyiPalace) === '格' ? '格' : undefined;
}

function buildGateCondition(data: TaiyiConditionInput): TaiyiThreeGateCondition {
  const directGateRemainder = positiveOneBased(data.accumulatedValue, 240);
  // 周内第 1 至 30 数为开门，第 31 数起换休门；第 240 数仍属惊门。
  const directGateIndex = Math.floor((directGateRemainder - 1) / 30);
  const directGate = CANONICAL_TAIYI_GATE_ORDER[directGateIndex]!;
  const directGateNumber = directGateIndex + 1;
  const anchorIndex = CANONICAL_TAIYI_GATE_PALACE_ORDER.indexOf(
    data.taiyiPalace as (typeof CANONICAL_TAIYI_GATE_PALACE_ORDER)[number],
  );
  if (anchorIndex < 0) {
    throw new Error(`太乙直门无法加临中宫：第${data.taiyiPalace}宫`);
  }

  const gateByPalace: Record<number, TaiyiGateName> = {};
  for (let offset = 0; offset < CANONICAL_TAIYI_GATE_ORDER.length; offset += 1) {
    const palace =
      CANONICAL_TAIYI_GATE_PALACE_ORDER[
        (anchorIndex + offset) % CANONICAL_TAIYI_GATE_PALACE_ORDER.length
      ];
    gateByPalace[palace] =
      CANONICAL_TAIYI_GATE_ORDER[(directGateIndex + offset) % CANONICAL_TAIYI_GATE_ORDER.length]!;
  }

  const roles: TaiyiGateRoleFact[] = [
    {
      role: '太乙',
      position: data.taiyiPosition,
      palace: data.taiyiPalace,
      gate: gateByPalace[data.taiyiPalace],
      usedForThreeGate: true,
    },
    {
      role: '文昌（主目）',
      position: data.wenChangPosition,
      palace: data.wenChangPalace,
      gate: gateByPalace[data.wenChangPalace],
      usedForThreeGate: true,
    },
    {
      role: '始击（客目）',
      position: data.shiJiPosition,
      palace: data.shiJiPalace,
      gate: gateByPalace[data.shiJiPalace],
      usedForThreeGate: false,
    },
  ];
  const blockedRoles = roles
    .filter(
      (role) => role.usedForThreeGate && role.gate && TAIYI_THREE_AUSPICIOUS_GATES.has(role.gate),
    )
    .map((role) => `${role.role}${role.gate}`);
  const gateRoles = roles.filter((role) => role.usedForThreeGate);
  const hasRestGate = gateRoles.some((role) => role.gate === '休门');
  const hasOpenOrLifeGate = roles.some(
    (role) =>
      role.usedForThreeGate && role.gate !== undefined && TAIYI_TWO_GATE_INCOMPLETE.has(role.gate),
  );
  const missingGateCount: 0 | 2 | 3 = hasRestGate ? 3 : hasOpenOrLifeGate ? 2 : 0;
  const status =
    missingGateCount === 3 ? '三门不具' : missingGateCount === 2 ? '两门不具' : '三门具';
  return {
    directGate,
    directGateRemainder,
    directGateNumber,
    gateByPalace,
    roles,
    gateScope: '太乙、文昌（主目）',
    complete: missingGateCount === 0,
    status,
    missingGateCount,
    blockedRoles,
    basis:
      '依《太乙金镜式经·推三门具不具》按积数入二百四十周、每三十数更一直使，并以直门加临太乙。八宫左行次序为乾一、坎八、艮三、震四、巽九、离二、坤七、兑六，时计八门另见卷一。《太乙统宗宝鉴》卷五“明三门具不具”载：太乙天目在开、生门下为两门不具，在休门下为三门不具，不在开、休、生三门下名为门具。本栏依主目传本取太乙与文昌（主目）判定，并列各自所临之门；始击（客目）门位单列，客方专用门具另取客大将宫。',
  };
}

function buildHostGuestElementRelation(data: TaiyiConditionInput): TaiyiHostGuestElementFact {
  const hostElement = CANONICAL_TAIYI_POINT_WUXING[data.wenChangPosition];
  const guestElement = CANONICAL_TAIYI_POINT_WUXING[data.shiJiPosition];
  return {
    hostPosition: data.wenChangPosition,
    hostElement,
    guestPosition: data.shiJiPosition,
    guestElement,
    relation: '未判定',
    complete: false,
    usedForFiveGeneralsLaunch: false,
    basis:
      '卷四《推主客相关法》称“皆用日计纳音以决之”，并以地目、天目五行相制举例；本栏只记录二目所在十六神的五行，尚未接入独立日计纳音判层，故不判主客相关，亦不参与五将发不发。',
  };
}

function buildFiveGeneralsCondition(data: TaiyiConditionInput): TaiyiFiveGeneralsCondition {
  const shiJiRelationToTaiyi = relationBetweenEyeAndTaiyi(
    data.shiJiPosition,
    data.taiyiPosition,
    data.shiJiPalace,
    data.taiyiPalace,
    '击',
  );
  const wenChangRelationToTaiyi = relationBetweenEyeAndTaiyi(
    data.wenChangPosition,
    data.taiyiPosition,
    data.wenChangPalace,
    data.taiyiPalace,
    '迫',
  );
  const shiJiNoCoverOrHit = shiJiRelationToTaiyi !== '同宫' && shiJiRelationToTaiyi !== '击';
  const wenChangNoImprisonOrPressure =
    wenChangRelationToTaiyi !== '同宫' && wenChangRelationToTaiyi !== '迫';
  const relations: TaiyiFiveGeneralsRelation[] = [];
  if (shiJiRelationToTaiyi === '同宫' || shiJiRelationToTaiyi === '击') {
    relations.push({
      relation: shiJiRelationToTaiyi,
      left: '始击',
      leftPalace: data.shiJiPalace,
      right: '太乙',
      rightPalace: data.taiyiPalace,
      kind: '始击掩/击',
    });
  }
  if (wenChangRelationToTaiyi === '同宫' || wenChangRelationToTaiyi === '迫') {
    relations.push({
      relation: wenChangRelationToTaiyi,
      left: '文昌',
      leftPalace: data.wenChangPalace,
      right: '太乙',
      rightPalace: data.taiyiPalace,
      kind: '文昌囚/迫',
    });
  }

  if (wenChangRelationToTaiyi === '格') {
    relations.push({
      relation: wenChangRelationToTaiyi,
      left: '文昌',
      leftPalace: data.wenChangPalace,
      right: '太乙',
      rightPalace: data.taiyiPalace,
      kind: '文昌对',
    });
  }

  const hostGenerals = [
    ['主大将', data.lordGeneral],
    ['主参将', data.lordAssistant],
  ] as const;
  const guestGenerals = [
    ['客大将', data.guestGeneral],
    ['客参将', data.guestAssistant],
  ] as const;
  for (const [left, leftPalace] of hostGenerals) {
    for (const [right, rightPalace] of guestGenerals) {
      const relation = relationBetweenPalaces(leftPalace, rightPalace);
      if (relation === '同宫') {
        relations.push({
          relation,
          left,
          leftPalace,
          right,
          rightPalace,
          kind: '主客同宫关',
        });
      }
    }
  }
  for (const [role, palace] of [['始击', data.shiJiPalace], ...guestGenerals] as const) {
    const relation = relationBetweenPalaces(palace, data.taiyiPalace);
    if (relation === '格') {
      relations.push({
        relation,
        left: role,
        leftPalace: palace,
        right: '太乙',
        rightPalace: data.taiyiPalace,
        kind: '客目/客将格',
      });
    }
  }
  const hostGuestNoSamePalaceRelation = !relations.some((item) => item.kind === '主客同宫关');
  const noGuestOppositionOrWenChangOpposition = !relations.some(
    (item) => item.kind === '客目/客将格' || item.kind === '文昌对',
  );
  const hostGuestElementRelation = buildHostGuestElementRelation(data);
  const launchRule =
    '《太乙金镜式经》卷四“推五将发不发”三项：始击无掩击、文昌无囚迫、主客大小将无相关；其中“相关”明确按卷三“推关法”记录四将同宫关。客目/客将格、文昌对及二目五行制化另列，不混入本三项。';
  return {
    shiJiNoCoverOrHit,
    shiJiRelationToTaiyi,
    wenChangNoImprisonOrPressure,
    wenChangRelationToTaiyi,
    hostGuestNoSamePalaceRelation,
    noGuestOppositionOrWenChangOpposition,
    hostGuestElementRelation,
    relations,
    launched: shiJiNoCoverOrHit && wenChangNoImprisonOrPressure && hostGuestNoSamePalaceRelation,
    launchRule,
    basis:
      '依《太乙金镜式经·推五将发不发》卷四，并将“主客大小将无相关”限定为卷三“推关法”的主客四将同宫关；中宫不参加八宫的邻、对关系，但两将同入中宫仍为同宫关。卷三格、对与卷四主客相关法的二目五行制化均单列，不能用同宫事实冒充完整主客相关。',
  };
}

function buildPairFact(
  role: TaiyiYinYangPairFact['role'],
  position: string | undefined,
  palace: number,
  polarity: TaiyiPolarity,
  count: number,
): TaiyiYinYangPairFact {
  const countPolarity: TaiyiPolarity = count % 2 === 0 ? '阴' : '阳';
  return {
    role,
    position,
    palace,
    polarity,
    count,
    countPolarity,
    matched: polarity !== countPolarity,
    basis: '阳位配偶数、阴位配奇数为和；阳位配奇数为重阳，阴位配偶数为重阴，均为不和。',
  };
}

function buildYinYangCondition(data: TaiyiConditionInput): TaiyiYinYangCondition {
  const taiyiPolarity: TaiyiPolarity = TAIYI_YANG_PALACES.has(data.taiyiPalace) ? '阳' : '阴';
  const lordPolarity: TaiyiPolarity = TAIYI_YANG_POINTS.has(data.wenChangPosition) ? '阳' : '阴';
  const guestPolarity: TaiyiPolarity = TAIYI_YANG_POINTS.has(data.shiJiPosition) ? '阳' : '阴';
  const pairFacts = [
    buildPairFact('太乙-主算', data.taiyiPosition, data.taiyiPalace, taiyiPolarity, data.lordCount),
    buildPairFact(
      '太乙-客算',
      data.taiyiPosition,
      data.taiyiPalace,
      taiyiPolarity,
      data.guestCount,
    ),
    buildPairFact(
      '文昌-主算',
      data.wenChangPosition,
      data.wenChangPalace,
      lordPolarity,
      data.lordCount,
    ),
    buildPairFact(
      '始击-客算',
      data.shiJiPosition,
      data.shiJiPalace,
      guestPolarity,
      data.guestCount,
    ),
  ];
  return {
    matched: pairFacts.every((item) => item.matched),
    pairFacts,
    basis:
      '依《太乙金镜式经·推阴阳和不和》：太乙八三四九为阳宫、二七六一为阴宫；下目/上目落正宫为阳、间辰为阴；将主客算的奇偶分别与太乙及两目配合，逐项满足阳偶或阴奇才记为和。',
  };
}

export function evaluateTaiyiConditions(data: TaiyiConditionInput): TaiyiRuleConditions {
  return {
    threeGates: buildGateCondition(data),
    fiveGenerals: buildFiveGeneralsCondition(data),
    yinYangHarmony: buildYinYangCondition(data),
  };
}
