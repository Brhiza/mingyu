/**
 * @file 奇门遁甲定局数、值符值使、特殊时辰和遁干
 * @description 基于拆补法实现时家奇门的定局数、值符值使、特殊时辰检查和遁干。
 *
 * 拆补法以节气为界，不置闰，是当代主流排盘软件（元亨利贞、各在线排盘）普遍采用的定局法。
 *
 * ── 法理依据 ──
 *
 * 《烟波钓叟歌》：
 *   "阴阳二遁分顺逆，一气三元人莫测。
 *    五日都来换一元，接气超神为准则。"
 *
 * 《遁甲演义》卷一：
 *   "冬至后用阳遁，顺布六仪逆布三奇；
 *    夏至后用阴遁，逆布六仪顺布三奇。"
 *
 * 《奇门遁甲秘籍大全》卷三"定局成局诀"列二十四节气三元局数：
 *   冬至惊蛰一七四，小寒二八五为嗣。
 *   大寒春分三九六，立春八五二相随。
 *   ……（二十四节气各有所属）
 *
 * 旬首法源出《秘籍大全》卷四"年家奇门定局"篇：
 *   由干支求旬首地支，旬首地支对应地盘宫位，
 *   该宫之星为值符，该宫之门为值使。
 */

import { SolarDay } from 'tyme4ts';
import { tiangan, jiazi, qimen } from '../../../../divination/divination-data';
import { STEM_TOMB_MAP } from './_constants';

const { dizhi, diPanPalaces, palaceStars, palaceDoorMap, jieQiJuShuMap } = qimen;
const tenStems = tiangan;
const wuBuYuHourStemByDayStem: Record<string, string> = {
  甲: '庚',
  乙: '辛',
  丙: '壬',
  丁: '癸',
  戊: '甲',
  己: '乙',
  庚: '丙',
  辛: '丁',
  壬: '戊',
  癸: '己',
};

// ============================================================================
// 内部辅助方法
// ============================================================================

/** 六甲符头日：甲子、甲戌、甲申、甲午、甲辰、甲寅（上元起点候选） */
const FU_TOU = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];

/**
 * 将 Date 转为东八区年月日对应的 SolarDay
 * @param date 要转换的日期
 * @returns SolarDay 对象
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toSolarDay(date: Date): SolarDay {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return SolarDay.fromYmd(Number(v.year), Number(v.month), Number(v.day));
}

/**
 * 取某 SolarDay 的六十甲子名（如 "甲子"）
 * @param sd 公历日
 * @returns 干支字符串
 */
function getDayGanZhi(sd: SolarDay): string {
  return sd.getLunarDay().getSixtyCycle().getName();
}

/**
 * 在 [from, to) 区间内按方向查找最近的符头日
 * @param start 起始日
 * @param direction -1 向前找，1 向后找
 * @returns { day, ganzhi } 或 null
 */
function findFuTou(start: SolarDay, direction: -1 | 1): { day: SolarDay; ganzhi: string } | null {
  let cur = start;
  // 最多搜索 70 天（远超节气跨度 15 天），确保能找到
  for (let i = 0; i < 70; i++) {
    const gz = getDayGanZhi(cur);
    if (FU_TOU.includes(gz)) return { day: cur, ganzhi: gz };
    cur = direction === 1 ? cur.next(1) : cur.next(-1);
  }
  return null;
}

/**
 * 计算两个 SolarDay 相隔天数（to - from）
 * @param from 起始日
 * @param to 结束日
 * @returns 相差天数（可为负数）
 */
function dayDiff(from: SolarDay, to: SolarDay): number {
  return Math.round(Number(to.getJulianDay()) - Number(from.getJulianDay()));
}

// ============================================================================
// 1. 定局数（拆补法）
// ============================================================================

/**
 * 拆补法定三元局数
 *
 * 核心逻辑：
 *   1. 以节气交节日为界，每个节气跨 15 天左右，含上中下三元。
 *   2. 上元起于该节气内最近的"甲己符头日"（甲子/甲戌/甲申/甲午/甲辰/甲寅）。
 *   3. 若符头早于节气交节日（超神），则该符头日之前属上一节气末尾（拆），
 *      之后属本节气上元（补）；若符头晚于交节日，同理向下一节气拆补。
 *   4. 本法不置闰，三元局数严格按节气表取。
 *
 * @param timeInfo 时间信息，包含 solar 日期字段（用于 拆补法 精确计算）、
 *                 jieQi 节气名和 ganzhi 日干支（用作兜底）
 * @returns { isYangDun, juShu, yuan, jieQi }
 *    isYangDun  - 是否为阳遁
 *    juShu      - 局数（1-9）
 *    yuan       - 三元名称（"上元" | "中元" | "下元"）
 *    jieQi      - 实际归属的节气名（当日期在第一个符头前时可能为上一节气）
 *
 * @throws 当无法获取节气信息或查找局数规则失败时
 */
export function getQimenJuShu(timeInfo: {
  solar?: { year: number; month: number; day: number };
  jieQi: string;
  ganzhi: { day: string };
}): {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
  jieQi: string;
} {
  // ── 拆补法（优先） ──
  if (timeInfo.solar) {
    const today = SolarDay.fromYmd(timeInfo.solar.year, timeInfo.solar.month, timeInfo.solar.day);

    // 获取当日所属节气
    const term = today.getTerm();
    if (!term) {
      throw new Error(
        `无法获取 ${timeInfo.solar.year}年${timeInfo.solar.month}月${timeInfo.solar.day}日 的节气信息。`,
      );
    }
    const jieQi = term.getName();
    const rule = jieQiJuShuMap[jieQi as keyof typeof jieQiJuShuMap];
    if (!rule) {
      throw new Error(`找不到节气 "${jieQi}" 对应的局数规则。`);
    }
    const isYangDun = rule.dun === '阳';

    // 节气交节日（精确到日的节气起始日）
    const jieQiDay = term.getSolarDay();

    // 在本节气内找最早的符头日（从交节日当天往后找，取本节气内第一个符头）
    // 拆补法以"本节气内出现的符头日"为上元起点
    // 若交节日当天就是符头，则为正授
    const fuTouAfter = findFuTou(jieQiDay, 1);

    let yuanIndex: number;

    if (fuTouAfter && !today.isBefore(fuTouAfter.day)) {
      // 当日 >= 本节气内首个符头日
      // 按天数差定上/中/下元：
      //   符头日当天 ~ +4 天 → 上元
      //   +5 天 ~ +9 天     → 中元
      //   +10 天 ~ +14 天   → 下元
      const diff = dayDiff(fuTouAfter.day, today); // 0..14
      yuanIndex = Math.min(2, Math.floor(diff / 5));
    } else {
      // 当日在本节气首个符头之前：
      // 从交节日到首个符头之间的日期，属上一节气末尾拆过来的元
      // 统一归为上一节气的下元
      const prevTerm = term.next(-1);
      const prevJieQi = prevTerm.getName();
      const prevRule = jieQiJuShuMap[prevJieQi as keyof typeof jieQiJuShuMap];
      if (prevRule) {
        return {
          isYangDun: prevRule.dun === '阳',
          juShu: prevRule.ju[2], // 上一节气下元
          yuan: '下元',
          jieQi: prevJieQi,
        };
      }
      // 防御：如果查不到上一节气规则，用本节气下元
      yuanIndex = 2;
    }

    const yuan = ['上元', '中元', '下元'][yuanIndex];
    const juShu = rule.ju[yuanIndex];
    return { isYangDun, juShu, yuan, jieQi };
  }

  // ── 兜底：无 solar 字段时使用日干支序数定元（旧方法） ──
  const { jieQi, ganzhi } = timeInfo;
  const dayGanZhi = ganzhi.day;
  const rule = jieQiJuShuMap[jieQi as keyof typeof jieQiJuShuMap];
  if (!rule) {
    throw new Error(`找不到节气 "${jieQi}" 对应的局数规则。`);
  }
  const isYangDun = rule.dun === '阳';
  const dayIndex = jiazi.indexOf(dayGanZhi);
  if (dayIndex === -1) {
    throw new Error(`无法识别日干支 "${dayGanZhi}" 的三元归属。`);
  }
  const yuanIndex = Math.floor(dayIndex / 5) % 3;
  const yuan = ['上元', '中元', '下元'][yuanIndex];
  const juShu = rule.ju[yuanIndex];
  return { isYangDun, juShu, yuan, jieQi };
}

// ============================================================================
// 2. 检查特殊时辰情况
// ============================================================================

/**
 * 检查特殊时辰情况
 *
 * 包括：六甲时、六癸时、时干入墓、五不遇时。
 *
 * 时干入墓法理依据（《烟波钓叟歌》："时干入墓凶无疑"）：
 *   各天干五行墓地不同，时干遇其墓支即为入墓，
 *   主事情停滞、阻力大，不宜举事。
 *
 * 五不遇时法理依据（《遁甲演义》）：
 *   时干克日干，名为五不遇，主事多不顺，好事被阻，凶时。
 *
 * @param hourGanZhi 时辰干支字符串（如 "甲子"、"乙丑"）
 * @param dayGanZhi  日干支字符串（用于判断五不遇时）
 * @returns 包含各项特殊条件的检查结果
 */
export function checkSpecialHourConditions(
  hourGanZhi: string,
  dayGanZhi?: string,
): {
  isLiuJiaHour: boolean;
  isLiuGuiHour: boolean;
  isShiGanRuMu: boolean;
  isWuBuYuShi: boolean;
  description: string;
} {
  const hourGan = hourGanZhi.charAt(0);
  const hourZhi = hourGanZhi.charAt(1);

  const result = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: '',
  };

  // ── 1. 六甲时 ──
  // 甲子、甲戌、甲申、甲午、甲辰、甲寅
  // 《烟波钓叟歌》："六甲时分六仪名"
  const liuJiaHours = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];
  if (liuJiaHours.includes(hourGanZhi)) {
    result.isLiuJiaHour = true;
    result.description += '六甲时辰（甲时），甲遁于六仪之下；';
  }

  // ── 2. 六癸时 ──
  // 癸酉、癸未、癸巳、癸卯、癸丑、癸亥
  const liuGuiHours = ['癸酉', '癸亥', '癸未', '癸巳', '癸卯', '癸丑'];
  if (liuGuiHours.includes(hourGanZhi)) {
    result.isLiuGuiHour = true;
    result.description += '六癸时辰，癸为阴干之末；';
  }

  // ── 3. 时干入墓 ──
  // 《遁甲演义》论入墓法（采用 _constants STEM_TOMB_MAP 统一表）：
  const ruMuMap = STEM_TOMB_MAP;

  const ruMuInfo = ruMuMap[hourGan];
  if (ruMuInfo && hourZhi === ruMuInfo.branch) {
    result.isShiGanRuMu = true;
    result.description += `时干${hourGan}入墓（${hourGan}入${ruMuInfo.palace}宫/${ruMuInfo.branch}支），事情停滞，不宜举事；`;
  }

  // ── 4. 五不遇时 ──
  // 《遁甲演义》："五不遇时者，时干克日干也。"
  // 五不遇必须同时比较日干与时干，不能只凭时辰干支固定列表判断。
  const dayGan = dayGanZhi?.charAt(0);
  if (dayGan && wuBuYuHourStemByDayStem[dayGan] === hourGan) {
    result.isWuBuYuShi = true;
    result.description += `五不遇时（日干${dayGan}遇时干${hourGan}克日干），事多不顺，不宜举事；`;
  }

  return result;
}

// ============================================================================
// 3. 寻值符与值使
// ============================================================================

/**
 * 寻值符与值使（旬首法）
 *
 * 法理：
 *   值符（九星之主）与值使（八门之主）由时辰干支所属的"旬"来决定。
 *   旬首（如甲子、甲戌、甲申等）所在的九宫，其对应的星即为值符，
 *   其对应的门即为值使。
 *
 * 《奇门遁甲秘籍大全》卷四：
 *   "凡占事，先看值符以定九星之吉凶，再看值使以定八门之休咎。"
 *
 * 计算步骤：
 *   1. 求旬首地支：旬首地支序数 = (时支序 - 时干序 + 12) % 12
 *   2. 旬首地支对应地盘宫位即为旬首落宫
 *   3. 该宫之星 = 值符，该宫之门 = 值使
 *
 * @param hourGanZhi 时辰干支（如 "甲子"、"乙丑"）
 * @param dayGanZhi  日干支（用于特殊时辰中的五不遇时判断）
 * @returns { zhiFu, zhiShi, zhiFuPalace, specialConditions }
 *    zhiFu            - 值符星名
 *    zhiShi           - 值使门名
 *    zhiFuPalace      - 值符所在宫位（即旬首落宫）
 *    specialConditions - 当前时辰的特殊情况
 *
 * @throws 当时辰干支无法识别时
 */
export function getZhiFuZhiShi(
  hourGanZhi: string,
  dayGanZhi?: string,
): {
  zhiFu: string;
  zhiShi: string;
  zhiFuPalace: number;
  specialConditions: ReturnType<typeof checkSpecialHourConditions>;
} {
  const hourGan = hourGanZhi.charAt(0);
  const hourZhi = hourGanZhi.charAt(1);

  const hourGanIndex = tenStems.indexOf(hourGan);
  const hourZhiIndex = dizhi.indexOf(hourZhi);

  if (hourGanIndex === -1 || hourZhiIndex === -1) {
    throw new Error(`无法识别时辰干支 "${hourGanZhi}"。`);
  }

  // 旬首地支序数 = (时支序 - 时干序 + 12) % 12
  const xunShouZhiIndex = (hourZhiIndex - hourGanIndex + 12) % 12;
  const xunShouZhi = dizhi[xunShouZhiIndex];

  // 旬首地支对应地盘宫位
  const xunShouPalace = diPanPalaces[xunShouZhi as keyof typeof diPanPalaces];

  // 该宫之星 = 值符，该宫之门 = 值使
  const zhiFu = palaceStars[xunShouPalace - 1];
  const zhiShi = palaceDoorMap[xunShouPalace as keyof typeof palaceDoorMap];

  // 检查当前时辰的特殊情况
  const specialConditions = checkSpecialHourConditions(hourGanZhi, dayGanZhi);

  return { zhiFu, zhiShi, zhiFuPalace: xunShouPalace, specialConditions };
}

/**
 * 通用寻值符与值使（旬首法）
 *
 * 与 getZhiFuZhiShi 的区别：不检查特殊时辰条件（六甲时/五不遇时等），
 * 适用于任意干支（年柱、月柱、日柱、时柱均可）。
 *
 * 旬首法源出《奇门遁甲秘籍大全》：
 *   由干支求旬首地支，旬首地支对应地盘宫位，
 *   该宫之星为值符，该宫之门为值使。
 *
 * @param ganZhi 任意干支字符串（如 "甲子"、"乙丑"）
 * @returns { zhiFu, zhiShi, xunShouPalace }
 *    zhiFu         - 值符星名
 *    zhiShi        - 值使门名
 *    xunShouPalace - 旬首所在宫位编号
 *
 * @throws 当干支无法识别时
 */
export function getZhiFuZhiShiByGanZhi(ganZhi: string): {
  zhiFu: string;
  zhiShi: string;
  xunShouPalace: number;
} {
  const gan = ganZhi.charAt(0);
  const zhi = ganZhi.charAt(1);

  const ganIndex = tenStems.indexOf(gan);
  const zhiIndex = dizhi.indexOf(zhi);

  if (ganIndex === -1 || zhiIndex === -1) {
    throw new Error(`无法识别干支 "${ganZhi}"。`);
  }

  // 旬首地支序数 = (支序 - 干序 + 12) % 12
  const xunShouZhiIndex = (zhiIndex - ganIndex + 12) % 12;
  const xunShouZhi = dizhi[xunShouZhiIndex];

  // 旬首地支对应地盘宫位
  const xunShouPalace = diPanPalaces[xunShouZhi as keyof typeof diPanPalaces];

  // 该宫之星 = 值符，该宫之门 = 值使
  const zhiFu = palaceStars[xunShouPalace - 1];
  const zhiShi = palaceDoorMap[xunShouPalace as keyof typeof palaceDoorMap];

  return { zhiFu, zhiShi, xunShouPalace };
}

// ============================================================================
// 5. 遁干（甲遁于六仪之下）
// ============================================================================

/**
 * 获取时辰的遁干（甲遁于六仪之下）
 *
 * 法理依据（《烟波钓叟歌》）：
 *   "六甲元号六仪名，三奇即是乙丙丁。
 *    阳遁顺仪奇逆布，阴遁逆仪奇顺行。"
 *
 * 六甲所遁：
 *   甲子遁戊、甲戌遁己、甲申遁庚、
 *   甲午遁辛、甲辰遁壬、甲寅遁癸。
 *
 * 非六甲时辰（时干不为"甲"）返回时干本身。
 *
 * @param hourGanZhi 时辰干支（如 "甲子"、"乙丑"）
 * @returns 遁干后的天干名
 *
 * @example
 *   getDunJiaStem('甲子') // => '戊'
 *   getDunJiaStem('甲戌') // => '己'
 *   getDunJiaStem('乙丑') // => '乙'（非六甲时返回时干本身）
 */
export function getDunJiaStem(hourGanZhi: string): string {
  // 非六甲时：时干不为"甲"，返回时干本身
  if (!hourGanZhi.startsWith('甲')) {
    return hourGanZhi.charAt(0);
  }

  // 六甲时：甲遁于六仪之下
  const dunJiaMap: Record<string, string> = {
    甲子: '戊',
    甲戌: '己',
    甲申: '庚',
    甲午: '辛',
    甲辰: '壬',
    甲寅: '癸',
  };

  return dunJiaMap[hourGanZhi] || '戊';
}
