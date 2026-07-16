/**
 * @file 奇门遁甲定局数、值符值使、特殊时辰和遁干
 * @description 基于拆补法或置闰法实现时家/日家奇门的定局数、值符值使、特殊时辰检查和遁干。
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

import { SolarDay, SolarTime } from 'tyme4ts';
import { tiangan, jiazi, qimen } from '../../../../divination/divination-data';
import { SIX_XUN_HEADS } from '../../../../ganzhi/data';
import { sanQiLiuYi } from './_constants';

const { dizhi, diPanPalaces, palaceStars, palaceDoorMap, jieQiJuShuMap } = qimen;
type TymeSolarDay = ReturnType<typeof SolarDay.fromYmd>;
const tenStems = tiangan;
const dunJiaStemByXun: Record<string, string> = {
  甲子: '戊',
  甲戌: '己',
  甲申: '庚',
  甲午: '辛',
  甲辰: '壬',
  甲寅: '癸',
};
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
const hourRuMuByGanZhi: Record<
  string,
  { branch: string; palace: number; category: '三奇日时干入墓' | '时干入墓' }
> = {
  乙未: { branch: '未', palace: 2, category: '三奇日时干入墓' },
  丙戌: { branch: '戌', palace: 6, category: '三奇日时干入墓' },
  丁丑: { branch: '丑', palace: 8, category: '三奇日时干入墓' },
  戊辰: { branch: '辰', palace: 4, category: '时干入墓' },
  壬辰: { branch: '辰', palace: 4, category: '时干入墓' },
  己未: { branch: '未', palace: 2, category: '时干入墓' },
  癸未: { branch: '未', palace: 2, category: '时干入墓' },
  辛丑: { branch: '丑', palace: 8, category: '时干入墓' },
};

export type QimenJuMethod = 'chaibu' | 'zhirun';

export type QimenChaoShenState = '正授' | '超神' | '接气';

export interface QimenJuShuResult {
  isYangDun: boolean;
  juShu: number;
  yuan: string;
  jieQi: string;
  juMethod: QimenJuMethod;
  fuTou?: string;
  fuTouDate?: string;
  chaoShenOrJieQi?: QimenChaoShenState;
  isZhiRun?: boolean;
  juMethodNote?: string;
}

export interface QimenLayoutContext {
  isYangDun: boolean;
  juShu: number;
}

// ============================================================================
// 内部辅助方法
// ============================================================================

/**
 * 取某 SolarDay 的六十甲子名（如 "甲子"）
 * @param sd 公历日
 * @returns 干支字符串
 */
function getDayGanZhi(sd: TymeSolarDay): string {
  return sd.getLunarDay().getSixtyCycle().getName();
}

/**
 * 在 [from, to) 区间内按方向查找最近的符头日
 * @param start 起始日
 * @param direction -1 向前找，1 向后找
 * @returns { day, ganzhi } 或 null
 */
function findFuTou(
  start: TymeSolarDay,
  direction: -1 | 1,
): { day: TymeSolarDay; ganzhi: string } | null {
  let cur = start;
  // 最多搜索 70 天（远超节气跨度 15 天），确保能找到
  for (let i = 0; i < 70; i++) {
    const gz = getDayGanZhi(cur);
    if (SIX_XUN_HEADS.includes(gz)) return { day: cur, ganzhi: gz };
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
function dayDiff(from: TymeSolarDay, to: TymeSolarDay): number {
  return Math.round(Number(to.getJulianDay()) - Number(from.getJulianDay()));
}

function getQimenGanZhiDay(currentTime: ReturnType<typeof SolarTime.fromYmdHms>): TymeSolarDay {
  const solarDay = currentTime.getSolarDay();
  return currentTime.getHour() >= 23 ? solarDay.next(1) : solarDay;
}

function getXunShouBranch(ganZhi: string): string {
  const gan = ganZhi.charAt(0);
  const zhi = ganZhi.charAt(1);

  const ganIndex = tenStems.indexOf(gan);
  const zhiIndex = (dizhi as readonly string[]).indexOf(zhi);

  if (ganIndex === -1 || zhiIndex === -1) {
    throw new Error(`无法识别干支 "${ganZhi}"。`);
  }

  const xunShouZhiIndex = (zhiIndex - ganIndex + 12) % 12;
  return dizhi[xunShouZhiIndex];
}

function getXunShouPalace(ganZhi: string, layout?: QimenLayoutContext): number {
  const xunShouZhi = getXunShouBranch(ganZhi);
  const xunShou = `甲${xunShouZhi}`;

  if (layout) {
    const dunStem = dunJiaStemByXun[xunShou];
    if (!dunStem) {
      throw new Error(`无法识别旬首 "${xunShou}" 的遁干。`);
    }

    for (let i = 0; i < sanQiLiuYi.length; i++) {
      const palace = layout.isYangDun
        ? ((layout.juShu + i - 1 + 9) % 9) + 1
        : ((layout.juShu - i - 1 + 9) % 9) + 1;
      if (sanQiLiuYi[i] === dunStem) return palace;
    }

    throw new Error(
      `无法在${layout.isYangDun ? '阳' : '阴'}遁${layout.juShu}局中定位旬首 "${xunShou}"。`,
    );
  }

  // 兼容旧调用：没有当前局信息时，只能退回地支方位，主入口不会使用此兜底。
  return diPanPalaces[xunShouZhi as keyof typeof diPanPalaces];
}

function getDoorByXunShouPalace(palace: number): string {
  // 旬首落中五宫时，中宫无门，按古籍“寄于坤二”借死门为值使。
  if (palace === 5) return '死门';
  return palaceDoorMap[palace as keyof typeof palaceDoorMap];
}

// ============================================================================
// 1. 定局数（拆补法）
// ============================================================================

/**
 * 拆补法 / 置闰法定三元局数
 *
 * 拆补法：
 *   1. 以节气交节日为界，每个节气跨 15 天左右，含上中下三元。
 *   2. 上元起于该节气内最近的"甲己符头日"。
 *   3. 交节后至首个符头前归属上一节气下元（拆补）。
 *   4. 本法不置闰。
 *
 * 置闰法 v1：
 *   1. 仍使用同一节气三元局数表。
 *   2. 以甲己符头定元。
 *   3. 符头与交节同日为正授；符头早于交节为超神；晚于交节为接气。
 *   4. 超神超过 9 日则置闰：本节气首个符头前并入上一节气下元，不换局。
 */
export function getQimenJuShu(
  timeInfo: {
    solar?: {
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
    };
    jieQi: string;
    ganzhi: { day: string };
  },
  juMethod: QimenJuMethod = 'chaibu',
): QimenJuShuResult {
  if (juMethod !== 'chaibu' && juMethod !== 'zhirun') {
    throw new Error(`未知的奇门定局方法：${String(juMethod)}。`);
  }

  const formatDay = (day: TymeSolarDay) =>
    `${day.getYear()}-${String(day.getMonth()).padStart(2, '0')}-${String(day.getDay()).padStart(2, '0')}`;

  if (timeInfo.solar) {
    const currentTime = SolarTime.fromYmdHms(
      timeInfo.solar.year,
      timeInfo.solar.month,
      timeInfo.solar.day,
      timeInfo.solar.hour ?? 12,
      timeInfo.solar.minute ?? 0,
      timeInfo.solar.second ?? 0,
    );
    const today = getQimenGanZhiDay(currentTime);
    const term = currentTime.getTerm();
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

    const jieQiDay = term.getSolarDay();
    const fuTouAfter = findFuTou(jieQiDay, 1);
    const fuTouBefore = findFuTou(jieQiDay.next(-1), -1);
    const yuanNames = ['上元', '中元', '下元'] as const;

    if (juMethod === 'zhirun') {
      let chaoShenOrJieQi: QimenChaoShenState = '正授';
      let isZhiRun = false;
      let juMethodNote = '置闰法定局：以甲己符头定元，超神/接气按符头与交节先后判定';
      const activeJieQi = jieQi;
      const activeRule = rule;
      let activeFuTou = fuTouAfter;

      if (fuTouAfter && dayDiff(jieQiDay, fuTouAfter.day) === 0) {
        chaoShenOrJieQi = '正授';
        activeFuTou = fuTouAfter;
      } else if (fuTouAfter && dayDiff(jieQiDay, fuTouAfter.day) > 0) {
        chaoShenOrJieQi = '接气';
        activeFuTou = fuTouAfter;
        juMethodNote = '置闰法定局：符头晚于交节，按接气处理，上元起于本节气符头';
      } else if (fuTouBefore) {
        const superDays = dayDiff(fuTouBefore.day, jieQiDay);
        chaoShenOrJieQi = '超神';
        if (superDays > 9) {
          isZhiRun = true;
          juMethodNote = `置闰法定局：符头超节气 ${superDays} 日，触发置闰`;
          if (!fuTouAfter || today.isBefore(fuTouAfter.day)) {
            const prevTerm = term.next(-1);
            const prevJieQi = prevTerm.getName();
            const prevRule = jieQiJuShuMap[prevJieQi as keyof typeof jieQiJuShuMap];
            if (!prevRule) {
              throw new Error(`置闰时找不到上一节气 "${prevJieQi}" 对应的局数规则。`);
            }
            const prevFu = findFuTou(prevTerm.getSolarDay(), 1) ?? fuTouBefore;
            return {
              isYangDun: prevRule.dun === '阳',
              juShu: prevRule.ju[2],
              yuan: '下元',
              jieQi: prevJieQi,
              juMethod: 'zhirun',
              fuTou: prevFu?.ganzhi,
              fuTouDate: prevFu ? formatDay(prevFu.day) : undefined,
              chaoShenOrJieQi,
              isZhiRun,
              juMethodNote: `${juMethodNote}，当前并入${prevJieQi}下元`,
            };
          }
          activeFuTou = fuTouAfter;
        } else {
          activeFuTou = fuTouBefore;
          juMethodNote = `置闰法定局：符头超节气 ${superDays} 日，按超神处理，仍用本节气三元`;
        }
      }

      if (!activeFuTou) {
        throw new Error(`置闰法无法定位节气 "${activeJieQi}" 的符头日。`);
      }

      if (today.isBefore(activeFuTou.day)) {
        const prevTerm = term.next(-1);
        const prevJieQi = prevTerm.getName();
        const prevRule = jieQiJuShuMap[prevJieQi as keyof typeof jieQiJuShuMap];
        if (!prevRule) {
          throw new Error(`置闰法找不到上一节气 "${prevJieQi}" 对应的局数规则。`);
        }
        const prevFu = findFuTou(prevTerm.getSolarDay(), 1);
        return {
          isYangDun: prevRule.dun === '阳',
          juShu: prevRule.ju[2],
          yuan: '下元',
          jieQi: prevJieQi,
          juMethod: 'zhirun',
          fuTou: prevFu?.ganzhi,
          fuTouDate: prevFu ? formatDay(prevFu.day) : undefined,
          chaoShenOrJieQi,
          isZhiRun,
          juMethodNote: `${juMethodNote}；当日早于符头，归属上一节气下元`,
        };
      }

      const diff = dayDiff(activeFuTou.day, today);
      const yuanIndex = Math.min(2, Math.max(0, Math.floor(diff / 5)));
      return {
        isYangDun: activeRule.dun === '阳',
        juShu: activeRule.ju[yuanIndex],
        yuan: yuanNames[yuanIndex],
        jieQi: activeJieQi,
        juMethod: 'zhirun',
        fuTou: activeFuTou.ganzhi,
        fuTouDate: formatDay(activeFuTou.day),
        chaoShenOrJieQi,
        isZhiRun,
        juMethodNote,
      };
    }

    // 拆补法
    let yuanIndex: number;
    if (fuTouAfter && !today.isBefore(fuTouAfter.day)) {
      const diff = dayDiff(fuTouAfter.day, today);
      yuanIndex = Math.min(2, Math.floor(diff / 5));
    } else {
      const prevTerm = term.next(-1);
      const prevJieQi = prevTerm.getName();
      const prevRule = jieQiJuShuMap[prevJieQi as keyof typeof jieQiJuShuMap];
      if (prevRule) {
        return {
          isYangDun: prevRule.dun === '阳',
          juShu: prevRule.ju[2],
          yuan: '下元',
          jieQi: prevJieQi,
          juMethod: 'chaibu',
          fuTou: fuTouBefore?.ganzhi,
          fuTouDate: fuTouBefore ? formatDay(fuTouBefore.day) : undefined,
          chaoShenOrJieQi: '接气',
          isZhiRun: false,
          juMethodNote: '拆补法定局：交节后至本节气首个符头前，归属上一节气下元',
        };
      }
      yuanIndex = 2;
    }

    return {
      isYangDun: rule.dun === '阳',
      juShu: rule.ju[yuanIndex],
      yuan: yuanNames[yuanIndex],
      jieQi,
      juMethod: 'chaibu',
      fuTou: fuTouAfter?.ganzhi,
      fuTouDate: fuTouAfter ? formatDay(fuTouAfter.day) : undefined,
      chaoShenOrJieQi:
        fuTouAfter && dayDiff(jieQiDay, fuTouAfter.day) === 0
          ? '正授'
          : fuTouAfter && dayDiff(jieQiDay, fuTouAfter.day) > 0
            ? '接气'
            : '超神',
      isZhiRun: false,
      juMethodNote: '拆补法定局：以节气内首个甲己符头起上元，不置闰',
    };
  }

  // 兜底：无 solar 字段时使用日干支序数定元
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
  return {
    isYangDun,
    juShu,
    yuan,
    jieQi,
    juMethod,
    isZhiRun: false,
    juMethodNote:
      juMethod === 'zhirun'
        ? '置闰法兜底：无精确公历时刻时退回日干支序数定元，不执行超神置闰判定'
        : '拆补法兜底：无精确公历时刻时退回日干支序数定元',
  };
}

// ============================================================================
// 2. 检查特殊时辰情况
// ============================================================================

/**
 * 检查特殊时辰情况
 *
 * 包括：六甲时、六癸时、时干入墓、五不遇时。
 *
 * 时干入墓法理依据：
 *   《奇门宝鉴御定》校正为戊辰、壬辰、己未、癸未、辛丑五时；
 *   另列乙未、丙戌、丁丑为日时干三奇入墓，其凶与墓制同。
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
  if (SIX_XUN_HEADS.includes(hourGanZhi)) {
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
  // 《奇门宝鉴御定》明言旧本有误，时辰级入墓采用校正后的干支专表。
  const ruMuInfo = hourRuMuByGanZhi[hourGanZhi];
  if (ruMuInfo && hourZhi === ruMuInfo.branch) {
    result.isShiGanRuMu = true;
    result.description += `${ruMuInfo.category}（${hourGanZhi}，${hourGan}入${ruMuInfo.palace}宫/${ruMuInfo.branch}支），事情停滞，不宜举事；`;
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
 *   旬首（如甲子、甲戌、甲申等）所遁六仪在当前局地盘所在的九宫，其对应的星即为值符，
 *   其对应的门即为值使。
 *
 * 《奇门遁甲统宗》：
 *   "地盘旬首所临之宫，其星即为值符，其门即为值使。"
 *
 * 计算步骤：
 *   1. 求旬首地支：旬首地支序数 = (时支序 - 时干序 + 12) % 12
 *   2. 以旬首所遁六仪在当前局地盘的落宫作为旬首落宫
 *   3. 该宫之星 = 值符，该宫之门 = 值使；旬首落中五宫时，借坤二死门为值使
 *
 * @param hourGanZhi 时辰干支（如 "甲子"、"乙丑"）
 * @param dayGanZhi  日干支（用于特殊时辰中的五不遇时判断）
 * @param layout      当前奇门局数，用于定位旬首所遁六仪的地盘落宫
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
  layout?: QimenLayoutContext,
): {
  zhiFu: string;
  zhiShi: string;
  zhiFuPalace: number;
  specialConditions: ReturnType<typeof checkSpecialHourConditions>;
} {
  const xunShouPalace = getXunShouPalace(hourGanZhi, layout);

  // 该宫之星 = 值符，该宫之门 = 值使
  const zhiFu = palaceStars[xunShouPalace - 1];
  const zhiShi = getDoorByXunShouPalace(xunShouPalace);

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
 *   由干支求旬首，再以旬首所遁六仪在当前局地盘所临之宫定值符值使。
 *
 * @param ganZhi 任意干支字符串（如 "甲子"、"乙丑"）
 * @param layout 当前奇门局数，用于定位旬首所遁六仪的地盘落宫
 * @returns { zhiFu, zhiShi, xunShouPalace }
 *    zhiFu         - 值符星名
 *    zhiShi        - 值使门名
 *    xunShouPalace - 旬首所在宫位编号
 *
 * @throws 当干支无法识别时
 */
export function getZhiFuZhiShiByGanZhi(
  ganZhi: string,
  layout?: QimenLayoutContext,
): {
  zhiFu: string;
  zhiShi: string;
  xunShouPalace: number;
} {
  const xunShouPalace = getXunShouPalace(ganZhi, layout);

  // 该宫之星 = 值符，该宫之门 = 值使
  const zhiFu = palaceStars[xunShouPalace - 1];
  const zhiShi = getDoorByXunShouPalace(xunShouPalace);

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
  if (!jiazi.includes(hourGanZhi)) {
    throw new Error(`无法识别干支 "${hourGanZhi}" 的遁甲天干。`);
  }

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

  const dunStem = dunJiaMap[hourGanZhi];
  if (!dunStem) {
    throw new Error(`无法识别六甲干支 "${hourGanZhi}" 的遁甲天干。`);
  }
  return dunStem;
}
