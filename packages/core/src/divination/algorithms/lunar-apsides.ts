/**
 * @file 月球交切轨道点：真莉莉丝（交切远地点）与真交点（交升交点）
 * @传统依据 现代占星通行的"真莉莉丝/真交点"即月球瞬时（交切）轨道的远地点与升交点；
 *   Swiss Ephemeris 即按"由月球位置与速度向量直接求交切轨道根数"实现（见其源码
 *   sweph.c 中 lunar_osc_elem 的说明），本模块采用同一方法。
 *
 * 背景：celestine 0.2.1 的 getTrueLilithLongitude 只在平近地点上叠加 ±2.6° 的
 * 小周期项，而交切远地点相对平莉莉丝实际可摆动约 ±30°，该方法在原理上无法
 * 逼近真值（对照 Swiss Ephemeris 平均偏差约 9.8°，最大约 19.4°）；其真交点
 * 级数也有最大约 18′ 的残差。本模块用 astronomy-engine 的月球状态向量直接求
 * 交切根数，对照 Swiss Ephemeris：真莉莉丝 ≤7′（425″），真交点 ≤12″。
 */
import * as AstronomyEngine from 'astronomy-engine';

// astronomy-engine 在 Node 22 的 tsx 环境中可能以 default 暴露，浏览器和 Rollup
// 则通常直接暴露具名导出；同时兼容两种模块形态。
const astronomyNamespace = AstronomyEngine as unknown as Record<string, unknown>;
const Astronomy = (Reflect.get(astronomyNamespace, 'default') ??
  AstronomyEngine) as typeof AstronomyEngine;
const { GeoMoonState, RotateState, Rotation_EQJ_ECT } = Astronomy;

// 地月系引力常数 μ = G(M地球+M月球)，换算为 AU³/day²。
// 两体交切轨道必须用地月总质量（与 Swiss Ephemeris 的 GEOGCONST*(1+1/81.300569) 一致）；
// 只用地球质量会使远地点方向产生数度级偏差。
const MU_EARTH_MOON =
  (3.986004418e14 * (1 + 0.0123000383) * 86400 * 86400) / Math.pow(1.495978707e11, 3);

export interface LunarOsculatingPoints {
  /** 真莉莉丝（交切远地点）黄经，[0, 360) */
  trueLilithLongitude: number;
  /** 真北交点（交切升交点）黄经，[0, 360) */
  trueNorthNodeLongitude: number;
}

function normalize(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

function moonOrbitVectors(utc: Date): { e: [number, number, number]; h: [number, number, number] } {
  // GeoMoonState 返回 J2000 平赤道系（EQJ）的月心地心状态向量（AU、AU/day）
  const state = GeoMoonState(utc);
  // 旋转到当日真黄道系（ECT），与占星黄经口径一致
  const rotation = Rotation_EQJ_ECT(utc);
  const s = RotateState(rotation, state);
  const r = [s.x, s.y, s.z];
  const v = [s.vx, s.vy, s.vz];

  const rmag = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
  const v2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  const rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];

  // 偏心率向量 e（指向近地点）
  const e: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    e[i] = ((v2 - MU_EARTH_MOON / rmag) * r[i] - rv * v[i]) / MU_EARTH_MOON;
  }

  // 角动量向量 h = r × v
  const h: [number, number, number] = [
    r[1] * v[2] - r[2] * v[1],
    r[2] * v[0] - r[0] * v[2],
    r[0] * v[1] - r[1] * v[0],
  ];

  return { e, h };
}

/**
 * 由月球状态向量求当日的交切远地点（真莉莉丝）与交切升交点（真北交点）。
 *
 * @param utc 协调世界时时刻
 * @returns 两个点的黄经（回归黄道，[0, 360)）
 */
export function computeOsculatingLunarPoints(utc: Date): LunarOsculatingPoints {
  const { e, h } = moonOrbitVectors(utc);

  // 远地点方向 = -e
  const lilith = normalize((Math.atan2(-e[1], -e[0]) * 180) / Math.PI);

  // 升交点：交点向量 n = k × h = (-h_y, h_x, 0)
  const node = normalize((Math.atan2(h[0], -h[1]) * 180) / Math.PI);

  return {
    trueLilithLongitude: lilith,
    trueNorthNodeLongitude: node,
  };
}
