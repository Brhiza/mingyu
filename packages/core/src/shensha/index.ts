/**
 * @file 神煞注册框架（地基层 · 可扩展）
 * @description
 *  八字、六壬、奇门的神煞起法"基本不一样"（用户明确指示不强行统一），
 *  因此本模块提供两层能力：
 *
 *  1) 可扩展注册框架（命理神煞层）：
 *     - 通用命理神煞（空亡、驿马、桃花等跨系统共通者）在此注册；
 *     - 八字/六壬/奇门可保留各自不同的实现，仅在需要时把结果挂到统一接口；
 *     - 新术数系统（太乙、七政四余、八宅等）可自由注册自己的神煞，地基可持续拓展。
 *
 *  2) 黄历/择日神煞层（委托 tyme4ts）：
 *     - tyme4ts 内建 151 个黄历神煞（God），每个带吉凶，并由 `SixtyCycleDay`
 *       提供当日值神(十二建除)、九星、宜忌等。此为"通用黄历"语义，与命理神煞
 *       分属不同层面，故独立暴露，不并入命理注册表，以免与八字/六壬/奇门各自的
 *       神煞体系混淆。
 */
import { SolarDay, SixtyCycle, SixtyCycleDay, God } from 'tyme4ts';
import { getYiMa, getTaoHua } from '../ganzhi';

export type ShenshaScope = 'common' | 'bazi' | 'liuren' | 'qimen' | 'taiyi' | 'qizheng' | 'bazhai';

export interface ShenshaContext {
  yearGanZhi: string;
  monthGanZhi: string;
  dayGanZhi: string;
  hourGanZhi: string;
}

export interface ShenshaResult {
  id: string;
  name: string;
  /** 命中与否 / 相关地支或说明 */
  value: string | string[];
  detail?: string;
}

export interface ShenshaDefinition {
  id: string;
  name: string;
  scope: ShenshaScope;
  /** 计算神煞；返回 null 表示不命中 */
  compute: (ctx: ShenshaContext) => ShenshaResult | null;
}

const REGISTRY = new Map<string, ShenshaDefinition>();

/** 注册神煞（可重复覆盖） */
export function registerShensha(def: ShenshaDefinition): void {
  REGISTRY.set(def.id, def);
}

/** 批量注册 */
export function registerShenshas(defs: ShenshaDefinition[]): void {
  for (const def of defs) REGISTRY.set(def.id, def);
}

/** 列出已注册神煞（可按 scope 过滤） */
export function listShensha(scope?: ShenshaScope): ShenshaDefinition[] {
  const all = Array.from(REGISTRY.values());
  return scope ? all.filter((d) => d.scope === scope || d.scope === 'common') : all;
}

/** 计算指定神煞 */
export function computeShensha(ids: string[], ctx: ShenshaContext): ShenshaResult[] {
  const out: ShenshaResult[] = [];
  for (const id of ids) {
    const def = REGISTRY.get(id);
    if (!def) continue;
    const r = def.compute(ctx);
    if (r) out.push(r);
  }
  return out;
}

function branchOf(ganZhi: string): string {
  return ganZhi[1];
}

/** 旬空（日柱旬空）：甲子旬戌亥空 … 甲寅旬子丑空 */
function getVoidBranchesFromDay(dayGanZhi: string): string[] {
  return SixtyCycle.fromName(dayGanZhi)
    .getExtraEarthBranches()
    .map((branch) => branch.getName());
}

/** 通用命理神煞：空亡、驿马、桃花 */
export const COMMON_SHENSHA: ShenshaDefinition[] = [
  {
    id: 'kongwang',
    name: '空亡',
    scope: 'common',
    compute: (ctx) => {
      const branches = getVoidBranchesFromDay(ctx.dayGanZhi);
      return {
        id: 'kongwang',
        name: '空亡',
        value: branches,
        detail: `日柱${ctx.dayGanZhi}旬空：${branches.join('、')}`,
      };
    },
  },
  {
    id: 'yima',
    name: '驿马',
    scope: 'common',
    compute: (ctx) => {
      const yb = branchOf(ctx.yearGanZhi);
      const m = getYiMa(yb);
      return { id: 'yima', name: '驿马', value: m, detail: `年支${yb}驿马在${m}` };
    },
  },
  {
    id: 'taohua',
    name: '桃花',
    scope: 'common',
    compute: (ctx) => {
      const yb = branchOf(ctx.yearGanZhi);
      const t = getTaoHua(yb);
      return { id: 'taohua', name: '桃花', value: t, detail: `年支${yb}桃花在${t}` };
    },
  },
];

// 注册通用命理神煞
registerShenshas(COMMON_SHENSHA);

/* ===================== 黄历/择日神煞层（委托 tyme4ts） ===================== */

export interface HuangliShensha {
  /** 神煞名 */
  name: string;
  /** 吉凶：吉 / 凶 / 平 */
  luck: string;
}

export interface HuangliInfo {
  /** 当日全部黄历神煞（来自 tyme4ts，共 151 种，按当日命中输出） */
  shensha: HuangliShensha[];
  /** 十二建除（值神） */
  duty: string;
  /** 九星 */
  nineStar: string;
  /** 九星颜色 */
  nineStarColor: string;
}

/** 列出 tyme4ts 内建的全部黄历神煞名（共 151 个），供能力发现/文档用 */
export function listHuangliShenshaNames(): string[] {
  return God.NAMES.slice();
}

/**
 * 查询指定公历日期的黄历神煞（委托 tyme4ts，权威黄历体系）。
 * 返回的 shensha 含吉凶分类，duty 为十二建除，nineStar 为九星。
 */
export function getHuangliShensha(year: number, month: number, day: number): HuangliInfo {
  const solarDay = SolarDay.fromYmd(year, month, day);
  const scDay = SixtyCycleDay.fromSolarDay(solarDay);
  const gods = scDay.getGods();
  const shensha: HuangliShensha[] = gods.map((g) => ({
    name: g.getName(),
    luck: g.getLuck().getName(),
  }));
  const duty = scDay.getDuty().getName();
  const nineStar = scDay.getNineStar();
  return {
    shensha,
    duty,
    nineStar: nineStar.getName(),
    nineStarColor: nineStar.getColor(),
  };
}

export const shensha = {
  registerShensha,
  registerShenshas,
  listShensha,
  computeShensha,
  COMMON_SHENSHA,
  getHuangliShensha,
  listHuangliShenshaNames,
};
