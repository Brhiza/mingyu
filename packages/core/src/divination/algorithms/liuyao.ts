/**
 * @file 六爻排盘算法
 * @description 基于京房八宫法，实现六爻卦象的完整排盘。
 * @流派 京房易
 * @核心思想
 * 1. 时间起卦：通过时间获取卦象的六个爻。
 * 2. 卦象转换：将主卦、变卦、互卦转换为二进制表示，并从数据中查找对应卦象。
 * 3. 安世应：根据主卦在其所属八宫中的位置（首卦、一世、二世...归魂）来确定世爻和应爻。
 * 4. 纳甲：为六个爻配上天干地支，此为定五行、六亲之本。
 * 5. 六亲：根据主卦宫位五行与各爻纳甲地支五行的生克关系，确定父母、官鬼、妻财、子孙、兄弟。
 * 6. 六神：根据起卦日的日干，安上青龙、朱雀、勾陈、螣蛇、白虎、玄武。
 * 7. 变卦分析：分析动爻变化后的爻，形成“父化财”等判断依据。
 */

import { hexagramsData } from '../../divination/hexagram-data';
import { getSixAnimals, getVoidBranches } from '../../calendar/lunar';
import {
  wuxing,
  liuqinRelations,
  hexagramNaJia, // 使用新的完整纳甲数据
  palaces,
  hexagramPalaceMap,
  palaceHexagrams,
} from '../../divination/divination-data';
import { generateYaosByTime, getDivinationTime } from '../../calendar/timeManager';
import {
  isSheng,
  isKe,
  isLiuhe,
  isLiuhai,
  isSanxing,
  getSanxingType,
  getSeasonState,
  isLiuchong,
  BRANCH_ORDER,
  BRANCH_WUXING,
  LIUCHONG_MAP,
} from './_shared';

/**
 * 五行入墓支（《卜筮正宗》卷三《墓库章》、《增删卜易·入墓》定例）：
 * 金墓在丑、木墓在未、火墓在戌、水土墓在辰。
 * 入墓主事物被收藏、束缚、限制或结束。
 * 爻值月墓为月建入墓，值日墓为日辰入墓，二者皆主该爻气运被压抑。
 */
const WUXING_RUMU: Record<string, string> = {
  金: '丑',
  木: '未',
  火: '戌',
  水: '辰',
  土: '辰',
};

/**
 * 五行十二宫（《三命通会》卷三论五行旺相、《卜筮正宗》卷四十二宫）：
 * 长生（气之始）、沐浴（败地）、冠带（渐成）、临官（禄地）、帝旺（极盛）、
 * 衰（始衰）、病（渐损）、死（气尽）、墓（入墓）、绝（无气）、胎（结胎）、养（孕养）。
 *
 * 各局长生位：
 * - 金长生在巳（巳酉丑）
 * - 木长生在亥（亥卯未）
 * - 火长生在寅（寅午戌）
 * - 水长生在申（申子辰）
 * - 土长生在申（水土共长生，《三命通会》卷三）
 */
function getShiErGong(wuxing: string, branch: string): string {
  // 五行各局的长生位：
  const ZHANG_SHENG_START: Record<string, string> = {
    金: '巳', // 金长生在巳
    木: '亥', // 木长生在亥
    火: '寅', // 火长生在寅
    水: '申', // 水长生在申
    土: '申', // 土长生在申（与火不同，按《三命通会》水土共长生）
  };
  const startBranch = ZHANG_SHENG_START[wuxing];
  if (!startBranch) return '';
  const startIndex = BRANCH_ORDER.indexOf(startBranch);
  const branchIndex = BRANCH_ORDER.indexOf(branch);
  if (startIndex === -1 || branchIndex === -1) return '';
  const offset = (((branchIndex - startIndex) % 12) + 12) % 12;
  const SHI_ER_GONG = [
    '长生',
    '沐浴',
    '冠带',
    '临官',
    '帝旺',
    '衰',
    '病',
    '死',
    '墓',
    '绝',
    '胎',
    '养',
  ];
  return SHI_ER_GONG[offset] || '';
}

/** 判断爻之地支是否入墓（按地支五行入墓支） */
function isRuMu(branchWuxing: string, monthBranch: string): boolean {
  const muBranch = WUXING_RUMU[branchWuxing];
  return muBranch === monthBranch;
}

/** 判断爻之地支是否在当月为月墓 */
function isYueMu(branch: string, monthBranch: string): boolean {
  const wuxing = BRANCH_WUXING[branch];
  return isRuMu(wuxing, monthBranch);
}

/** 判断爻之地支是否入日墓 */
function isRiMu(branch: string, dayBranch: string): boolean {
  const wuxing = BRANCH_WUXING[branch];
  return WUXING_RUMU[wuxing] === dayBranch;
}

const SANHE_GROUPS: Record<string, string[]> = {
  水局: ['申', '子', '辰'],
  木局: ['亥', '卯', '未'],
  火局: ['寅', '午', '戌'],
  金局: ['巳', '酉', '丑'],
};

/**
 * 检测月建/日辰对爻的三合局触发（《卜筮正宗》卷三《三合局章》）：
 * 若月建或日辰为三合局中一支，再有两爻相配，即为完整三合局。
 * "三合主久远、多人协力，事势增强，吉凶随局而定。"
 */
function checkSanheWithTrigger(
  yaoBranches: string[],
  triggerBranch: string,
  triggerLabel: '日辰' | '月建',
): { group: string; members: string[]; description: string } | null {
  const allBranches = new Set([...yaoBranches, triggerBranch]);
  // 完整三合局
  for (const [group, members] of Object.entries(SANHE_GROUPS)) {
    if (!members.includes(triggerBranch)) {
      continue;
    }
    const present = members.filter((m) => allBranches.has(m));
    if (present.length === members.length) {
      return {
        group,
        members,
        description: `${triggerLabel}${triggerBranch}引动三合${group}，三合局成，事势增强`,
      };
    }
  }
  return null;
}

// 六合月日暗助检测（已在 yaosDetail 中通过 seasonState + isDayBreak + isChanging 实现暗动判定）

/**
 * 回头生克冲：动爻变出之爻对动爻本身的关系。
 * - 回头生：变爻生动爻（如寅动化卯，水动化木）
 * - 回头克：变爻克动爻
 * - 回头冲：变爻冲动爻（六冲）
 * - 化空：变爻落旬空
 * - 化进/化退：同五行递进退（由 getChangeDirection 判定）
 * - 比和：同五行同比和
 */
function getChangeRelation(
  originalWuxing: string,
  changedWuxing: string,
  originalBranch: string,
  changedBranch: string,
  changedIsVoid: boolean,
): '回头生' | '回头克' | '回头冲' | '化空' | '比和' | null {
  if (!originalWuxing || !changedWuxing) return null;
  if (changedIsVoid) return '化空';
  if (isLiuchong(originalBranch, changedBranch)) return '回头冲';
  if (isSheng(changedWuxing, originalWuxing)) return '回头生';
  if (isKe(changedWuxing, originalWuxing)) return '回头克';
  if (originalWuxing === changedWuxing) return '比和';
  return null;
}

/**
 * 判断是否为日破：爻的地支被日辰地支冲克
 */
function isDayBreak(branch: string, dayBranch: string): boolean {
  return isLiuchong(branch, dayBranch);
}

/**
 * 判断是否为月破：爻的地支被月建地支冲克
 */
function isMonthBreak(branch: string, monthBranch: string): boolean {
  return isLiuchong(branch, monthBranch);
}

/**
 * 判断化进神/退神
 * 化进神：动爻变出的爻与原爻同五行，且顺序递进（如寅木化卯木）
 * 化退神：动爻变出的爻与原爻同五行，且顺序递退（如卯木化寅木）
 */
function getChangeDirection(
  originalBranch: string,
  changedBranch: string,
): '化进神' | '化退神' | null {
  const originalWuxing = BRANCH_WUXING[originalBranch];
  const changedWuxing = BRANCH_WUXING[changedBranch];

  // 必须同五行
  if (!originalWuxing || !changedWuxing || originalWuxing !== changedWuxing) {
    return null;
  }

  const originalIndex = BRANCH_ORDER.indexOf(originalBranch);
  const changedIndex = BRANCH_ORDER.indexOf(changedBranch);

  if (originalIndex === -1 || changedIndex === -1) {
    return null;
  }

  // 计算顺时针距离（进）
  const forwardDistance = (changedIndex - originalIndex + 12) % 12;
  // 计算逆时针距离（退）
  const backwardDistance = (originalIndex - changedIndex + 12) % 12;

  // 进神：顺行一位（距离1）
  if (forwardDistance === 1) {
    return '化进神';
  }
  // 退神：逆行一位（距离1）
  if (backwardDistance === 1) {
    return '化退神';
  }

  // 土支（辰戌丑未）进神退神：《增删卜易》辰→未→戌→丑 顺行3位为进神，逆行3位为退神
  if (originalWuxing === '土') {
    if (forwardDistance === 3) return '化进神';
    if (backwardDistance === 3) return '化退神';
  }

  return null;
}

/**
 * 寻宫：根据卦名查找其所属的八宫
 * @param hexagramName 卦名，如“乾为天”
 * @returns 返回该卦所属的宫位对象，包含五行属性
 */
function findPalace(hexagramName: string) {
  const palaceName = hexagramPalaceMap[hexagramName as keyof typeof hexagramPalaceMap];
  return palaces[palaceName as keyof typeof palaces];
}

/**
 * 纳甲与安六亲
 * @param mainHexagramName 主卦卦名
 * @param palace 主卦所属宫位
 * @returns 返回一个包含六个爻的地支、五行、六亲信息的数组
 */
function getNaJiaAndLiuQin(mainHexagramName: string, palace: { name: string; wuxing: string }) {
  const yaosWithInfo: Array<{ dizhi: string; wuxing: string; liuqin: string }> = [];
  const najiaDizhiArray = hexagramNaJia[mainHexagramName];

  if (!najiaDizhiArray) {
    throw new Error(`找不到卦象 "${mainHexagramName}" 的纳甲信息。`);
  }

  for (let i = 0; i < 6; i++) {
    const dizhi = najiaDizhiArray[i];
    const yaoWuxing = Object.keys(wuxing).find((key) =>
      wuxing[key as keyof typeof wuxing].includes(dizhi),
    );
    if (!yaoWuxing) {
      throw new Error(`无法根据地支 "${dizhi}" 推导五行属性。`);
    }
    const palaceLiuqin = liuqinRelations[palace.wuxing as keyof typeof liuqinRelations];
    if (!palaceLiuqin) {
      throw new Error(`找不到宫位五行 "${palace.wuxing}" 的六亲关系。`);
    }
    const liuqin = palaceLiuqin[yaoWuxing as keyof typeof palaceLiuqin];
    if (!liuqin) {
      throw new Error(`找不到 "${palace.wuxing}" 与 "${yaoWuxing}" 的六亲关系。`);
    }
    yaosWithInfo.push({ dizhi, wuxing: yaoWuxing, liuqin });
  }
  return yaosWithInfo;
}

function buildHiddenSpirits(params: {
  originalName: string;
  palace: { name: string; wuxing: string };
  yaosDetail: Array<{
    position: number;
    sixRelative: string;
    najiaDizhi: string;
    wuxing: string;
  }>;
  voidBranches: string[];
}) {
  const { originalName, palace, yaosDetail, voidBranches } = params;
  const homeHexagramName = palaceHexagrams[palace.name as keyof typeof palaceHexagrams]?.[0];

  if (!homeHexagramName || homeHexagramName === originalName) {
    return [];
  }

  const appearedRelatives = new Set(yaosDetail.map((item) => item.sixRelative));
  const homeYaos = getNaJiaAndLiuQin(homeHexagramName, palace);

  return homeYaos
    .map((homeYao, index) => ({
      sixRelative: homeYao.liuqin,
      position: index + 1,
      najiaDizhi: homeYao.dizhi,
      wuxing: homeYao.wuxing,
      isVoid: voidBranches.includes(homeYao.dizhi),
      underYao: {
        position: yaosDetail[index].position,
        sixRelative: yaosDetail[index].sixRelative,
        najiaDizhi: yaosDetail[index].najiaDizhi,
        wuxing: yaosDetail[index].wuxing,
      },
    }))
    .filter((item) => !appearedRelatives.has(item.sixRelative));
}

/**
 * 安世应
 * @param hexagramName 卦名
 * @param palaceName 宫位名
 * @returns 返回世爻和应爻所在的爻位（1-6）
 */
function getShiYing(hexagramName: string, palaceName: string): { shi: number; ying: number } {
  // 京房八宫卦序，决定了世爻的位置
  const palaceOrder = ['首卦', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];
  const shiYaoMap = { 首卦: 6, 一世: 1, 二世: 2, 三世: 3, 四世: 4, 五世: 5, 游魂: 4, 归魂: 3 };

  const hexagramsInPalace = palaceHexagrams[palaceName as keyof typeof palaceHexagrams];
  if (!hexagramsInPalace) {
    throw new Error(`找不到宫位 "${palaceName}" 的卦象列表。`);
  }

  const generation = hexagramsInPalace.indexOf(hexagramName);
  if (generation === -1) {
    // 理论上不应该发生，因为 palaceName 是从 hexagramName 查出来的
    throw new Error(`卦象 "${hexagramName}" 不在宫位 "${palaceName}" 的列表中。`);
  }

  const shiYao = shiYaoMap[palaceOrder[generation] as keyof typeof shiYaoMap];
  // 应爻永远在世爻之上或之下三位
  const yingYao = shiYao + 3 > 6 ? shiYao - 3 : shiYao + 3;
  return { shi: shiYao, ying: yingYao };
}

/**
 * 生成一个代表世应位置的字符串数组
 * @param shiYing 世应位置对象
 * @returns 一个六元素的数组，在世应位置上标记“世”或“应”
 */
function getWorldAndResponseArray(shiYing: { shi: number; ying: number }): string[] {
  const result = ['', '', '', '', '', ''];
  result[shiYing.shi - 1] = '世';
  result[shiYing.ying - 1] = '应';
  return result;
}

function getSpecialPattern(
  changingCount: number,
  mainHexagramName: string,
): {
  specialPattern?: '静卦' | '独静卦' | '全动卦' | '乾卦用九' | '坤卦用六';
  specialAdvice?: string;
  isChaotic: boolean;
  chaoticReason?: string;
} {
  if (changingCount === 0) {
    return {
      specialPattern: '静卦',
      specialAdvice: '六爻安静，以本卦卦意和世应用神为主，不取变爻之象。',
      isChaotic: false,
    };
  }

  if (changingCount === 5) {
    return {
      specialPattern: '独静卦',
      specialAdvice: '五爻俱动，一爻独静。常见取法以独静爻为关键，同时兼看变卦所示趋势。',
      isChaotic: false,
    };
  }

  if (changingCount === 6) {
    if (mainHexagramName === '乾为天') {
      return {
        specialPattern: '乾卦用九',
        specialAdvice:
          '乾卦六爻皆动，宜以用九“见群龙无首，吉”为主，兼参之卦总势，不按常规逐爻细断。',
        isChaotic: false,
      };
    }

    if (mainHexagramName === '坤为地') {
      return {
        specialPattern: '坤卦用六',
        specialAdvice: '坤卦六爻皆动，宜以用六“利永贞”为主，兼参之卦总势，不按常规逐爻细断。',
        isChaotic: false,
      };
    }

    return {
      specialPattern: '全动卦',
      specialAdvice: '六爻全动，宜总观本卦与变卦气势，不宜按常规逐爻细碎分断。',
      isChaotic: true,
      chaoticReason: '六爻全动，属于乱动卦。传统上此类卦不宜按常规多爻细断，宜另取用神旺衰总观。',
    };
  }

  return {
    isChaotic: false,
  };
}

/**
 * 生成六爻卦盘
 *
 * 使用京房八宫法，按时间起卦。支持传入自定义时间，不传则使用当前时间。
 * 返回完整的六爻卦盘，包含主卦、变卦、互卦、世应、纳甲、六亲、六神等信息。
 *
 * @param customDate 自定义起卦时间（可选），若不提供则使用当前时间。
 * @returns 完整的六爻卦盘数据对象 LiuyaoData。
 *
 * @example
 * ```ts
 * const result = generateLiuyao();
 * // result 包含 mainHexagram、changedHexagram、yaos（六爻详情）等字段
 * ```
 */
export function generateLiuyao(customDate?: Date) {
  // 1. 获取占卜时间的干支信息
  const { ganzhi, timestamp } = getDivinationTime(customDate);
  const rawYaos = generateYaosByTime(timestamp, 6);

  const mainYaos = rawYaos.map((yao) => (yao === 7 || yao === 9 ? '阳' : '阴'));
  const changedYaos = rawYaos.map((yao, index) => {
    if (yao === 6) return '阳';
    if (yao === 9) return '阴';
    return mainYaos[index];
  });

  const mainBinary = mainYaos
    .map((y) => (y === '阳' ? '1' : '0'))
    .reverse()
    .join('');
  const changedBinary = changedYaos
    .map((y) => (y === '阳' ? '1' : '0'))
    .reverse()
    .join('');

  const getInterHexagram = (yaos: string[]) => {
    const interLower = yaos.slice(1, 4);
    const interUpper = yaos.slice(2, 5);
    return [...interLower, ...interUpper];
  };
  const interYaos = getInterHexagram(mainYaos);
  const interBinary = interYaos
    .map((y) => (y === '阳' ? '1' : '0'))
    .reverse()
    .join('');

  const mainHexagram = hexagramsData.find((h) => h.binarySymbol === mainBinary);
  const changedHexagram = hexagramsData.find((h) => h.binarySymbol === changedBinary);
  const interHexagram = hexagramsData.find((h) => h.binarySymbol === interBinary);

  if (!mainHexagram || !changedHexagram || !interHexagram) {
    throw new Error(`卦象查找失败: 主=${mainBinary}, 变=${changedBinary}, 互=${interBinary}`);
  }

  const dayGan = ganzhi.day.substring(0, 1);
  const dayBranch = ganzhi.day.substring(1);
  const monthBranch = ganzhi.month.substring(1);
  const animals = getSixAnimals(dayGan);
  const palace = findPalace(mainHexagram.name);
  const yaosInfo = getNaJiaAndLiuQin(mainHexagram.name, palace);
  const shiYing = getShiYing(mainHexagram.name, palace.name);
  const voids = getVoidBranches(ganzhi.day);

  //【核心修正：增加变卦分析】
  // 六爻占断，吉凶之机尽在“动变”二字。静爻观其本，动爻察其变。
  // 原算法只排主卦，不知其变，则吉凶难辨，故此为修正之核心。
  // 1. 获取变卦的纳甲六亲信息。
  // 2. 关键法理：变卦的宫位五行，永远跟从主卦的宫位五行来定六亲。
  //    例如，乾宫（金）的“天地否”变“风地观”，虽变卦“观”属巽宫（木），
  //    但在定六亲时，仍以主卦的乾金为“我”，来论其兄弟、子孙等。
  const changedYaosInfo = getNaJiaAndLiuQin(changedHexagram.name, palace);

  const changingYaosResult = rawYaos
    .map((yao, index) => ({
      position: index + 1,
      isChanging: yao === 6 || yao === 9,
      type: yao === 6 ? '老阴' : yao === 9 ? '老阳' : '静爻',
    }))
    .filter((yao) => yao.isChanging);

  const { specialPattern, specialAdvice, isChaotic, chaoticReason } = getSpecialPattern(
    changingYaosResult.length,
    mainHexagram.name,
  );
  const yaosDetail = yaosInfo.map((info, index) => {
    const isChanging = rawYaos[index] === 6 || rawYaos[index] === 9;
    const changedInfo = isChanging ? changedYaosInfo[index] : null;
    const isDayBreakFlag = isDayBreak(info.dizhi, dayBranch);
    const isMonthBreakFlag = isMonthBreak(info.dizhi, monthBranch);
    const changeDirection = changedInfo ? getChangeDirection(info.dizhi, changedInfo.dizhi) : null;

    // 月令旺衰：按月建定爻之五行的旺相休囚死。旺相为有力，休囚死为无力。
    const seasonState = getSeasonState(info.wuxing, monthBranch);
    // 暗动：静爻被日辰冲为暗动（旺相有力，暗中发动）；休囚被日冲为日破（无力）。
    // 与 isDayBreak 互补：日冲静爻按旺衰区分暗动（有力可用）与日破（无力）。
    const isHiddenMove =
      !isChanging && isDayBreakFlag && (seasonState === '旺' || seasonState === '相');
    // 回头生克冲：动爻变出之爻对动爻本身的关系（仅动爻有变爻时计算）。
    const changeRelation = changedInfo
      ? getChangeRelation(
          info.wuxing,
          changedInfo.wuxing,
          info.dizhi,
          changedInfo.dizhi,
          voids.includes(changedInfo.dizhi),
        )
      : null;

    return {
      position: index + 1,
      rawValue: rawYaos[index],
      yaoType: mainYaos[index] as '阳' | '阴',
      isChanging: isChanging,
      changeType: rawYaos[index] === 6 ? '老阴' : rawYaos[index] === 9 ? '老阳' : '静爻',
      sixGod: animals[index],
      sixRelative: info.liuqin,
      najiaDizhi: info.dizhi,
      wuxing: info.wuxing,
      isWorld: shiYing.shi === index + 1,
      isResponse: shiYing.ying === index + 1,
      isVoid: voids.includes(info.dizhi),
      isDayBreak: isDayBreakFlag,
      isMonthBreak: isMonthBreakFlag,
      isHiddenMove: isHiddenMove,
      seasonState: seasonState,
      changeDirection: changeDirection,
      changeRelation: changeRelation,
      // 新增长支关系检测
      isSanxing: isSanxing(info.dizhi, dayBranch) || isSanxing(info.dizhi, monthBranch),
      sanxingType: getSanxingType(info.dizhi) || undefined,
      isLiuhe: isLiuhe(info.dizhi, dayBranch) || isLiuhe(info.dizhi, monthBranch),
      liuhePartner: isLiuhe(info.dizhi, dayBranch)
        ? dayBranch
        : isLiuhe(info.dizhi, monthBranch)
          ? monthBranch
          : undefined,
      isLiuhai: isLiuhai(info.dizhi, dayBranch) || isLiuhai(info.dizhi, monthBranch),
      isRuMu: isRuMu(info.wuxing, dayBranch) || isRuMu(info.wuxing, monthBranch),
      shiErGong: getShiErGong(info.wuxing, info.dizhi),
      isYueMu: isYueMu(info.dizhi, monthBranch),
      isRiMu: isRiMu(info.dizhi, dayBranch),
      changedYao: changedInfo
        ? {
            dizhi: changedInfo.dizhi,
            wuxing: changedInfo.wuxing,
            liuqin: changedInfo.liuqin,
            isVoid: voids.includes(changedInfo.dizhi),
          }
        : null,
    };
  });
  const hiddenSpirits = buildHiddenSpirits({
    originalName: mainHexagram.name,
    palace,
    yaosDetail,
    voidBranches: voids,
  });

  // 三合局检测：日辰/月建与爻中静爻/动爻组成的三合局
  const yaoBranches = yaosInfo.map((i) => i.dizhi);
  const sanheWithDay = checkSanheWithTrigger(yaoBranches, dayBranch, '日辰');
  const sanheWithMonth = checkSanheWithTrigger(yaoBranches, monthBranch, '月建');

  // 三刑检测：各爻之间是否构成三刑关系（寅巳申三刑、丑戌未三刑等）
  const sanxingInYaos: Array<{ branches: string[]; type: string }> = [];
  // 寅巳申三刑
  if (['寅', '巳', '申'].every((b) => yaoBranches.includes(b))) {
    sanxingInYaos.push({ branches: ['寅', '巳', '申'], type: '无恩之刑' });
  }
  // 丑戌未三刑
  if (['丑', '戌', '未'].every((b) => yaoBranches.includes(b))) {
    sanxingInYaos.push({ branches: ['丑', '戌', '未'], type: '恃势之刑' });
  }
  // 子卯刑
  if (yaoBranches.includes('子') && yaoBranches.includes('卯')) {
    sanxingInYaos.push({ branches: ['子', '卯'], type: '无礼之刑' });
  }
  // 自刑
  for (const branch of ['辰', '午', '酉', '亥'] as const) {
    if (yaoBranches.filter((b) => b === branch).length >= 2) {
      sanxingInYaos.push({ branches: [branch, branch], type: '自刑' });
    }
  }

  // 月卦身（按六爻传统“阳世从子月起，阴世从午月生，从初数至世方真”）：
  // 阳世：初爻子、二爻丑、三爻寅、四爻卯、五爻辰、六爻巳
  // 阴世：初爻午、二爻未、三爻申、四爻酉、五爻戌、六爻亥
  const SHI_YANG_TO_GUA_SHEN: Record<number, string> = {
    1: '子',
    2: '丑',
    3: '寅',
    4: '卯',
    5: '辰',
    6: '巳',
  };
  const SHI_YIN_TO_GUA_SHEN: Record<number, string> = {
    1: '午',
    2: '未',
    3: '申',
    4: '酉',
    5: '戌',
    6: '亥',
  };
  // 世爻的阴阳决定卦身取阳表还是阴表
  const shiYaoIsYang = mainYaos[shiYing.shi - 1] === '阳';
  const guaShenBranch =
    (shiYaoIsYang ? SHI_YANG_TO_GUA_SHEN : SHI_YIN_TO_GUA_SHEN)[shiYing.shi] || '';
  const guaShenYao = yaosInfo.find((i) => i.dizhi === guaShenBranch);
  const guaShen = guaShenYao
    ? {
        branch: guaShenBranch,
        sixRelative: guaShenYao.liuqin,
        position: yaosInfo.indexOf(guaShenYao) + 1,
      }
    : null;

  return {
    originalName: mainHexagram.name,
    changedName: changedHexagram.name,
    interName: interHexagram.name,
    yaoArray: rawYaos,
    changingYaos: changingYaosResult,
    sixGods: animals,
    sixRelatives: yaosInfo.map((info) => info.liuqin),
    najiaDizhi: yaosInfo.map((info) => info.dizhi),
    wuxing: yaosInfo.map((info) => info.wuxing),
    worldAndResponse: getWorldAndResponseArray(shiYing),
    voidBranches: voids,
    palace,
    ganzhi,
    specialPattern,
    specialAdvice,
    isChaotic,
    chaoticReason,
    yaosDetail,
    hiddenSpirits,
    sanheWithDay,
    sanheWithMonth,
    sanxingInYaos,
    guaShen,
    timestamp,
  };
}

export { buildHiddenSpirits };
