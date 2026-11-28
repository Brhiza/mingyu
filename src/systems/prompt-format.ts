/**
 * 底层源头公共中文格式化工具。
 * 供各术数核心渲染模块与精炼层共同引用，保证源头直接输出纯净中文而无需后期补丁翻译。
 */

export const ASTRO_HOUSE_SYSTEM_LABELS: Record<string, string> = {
  placidus: '普拉西德',
  whole_sign: '整宫',
  equal: '等宫',
  koch: '科赫',
  porphyry: '波菲利',
  regiomontanus: '雷吉奥蒙塔努斯',
  campanus: '坎帕努斯',
  alcabitius: '阿尔卡比特',
  morinus: '莫里努斯',
  meridian: '子午圈',
  polich_page: '波利希-佩奇',
  vehlow: '维洛等宫',
};

export const ASTRO_BODY_LABELS: Record<string, string> = {
  sun: '太阳',
  moon: '月亮',
  mercury: '水星',
  venus: '金星',
  mars: '火星',
  jupiter: '木星',
  saturn: '土星',
  uranus: '天王星',
  neptune: '海王星',
  pluto: '冥王星',
  chiron: '凯龙星',
  true_node: '真北交点',
  mean_node: '平均北交点',
  south_node: '南交点',
  fortune: '福点',
  ceres: '谷神星',
  pallas: '智神星',
  juno: '婚神星',
  vesta: '灶神星',
  asc: '上升点',
  desc: '下降点',
  mc: '天顶',
  ic: '天底',
};

export function formatAstroHouseSystem(system: string): string {
  return ASTRO_HOUSE_SYSTEM_LABELS[system.toLowerCase()] ?? system;
}

export function formatAstroChartWarnings(warnings: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];
  const out: string[] = [];
  for (const item of warnings) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (rec.kind === 'outside_validated_range') {
        const bodyRaw = typeof rec.body === 'string' ? rec.body : '';
        const bodyCn = ASTRO_BODY_LABELS[bodyRaw] ?? (bodyRaw || '部分星体');
        const validated =
          rec.validated && typeof rec.validated === 'object'
            ? (rec.validated as { from?: unknown; to?: unknown })
            : undefined;
        const fromYear = validated?.from;
        const toYear = validated?.to;
        if (typeof fromYear === 'number' && typeof toYear === 'number') {
          out.push(`「${bodyCn}」超出星历校验年代范围（${fromYear}–${toYear}年），位置仅供参考`);
        } else {
          out.push(`「${bodyCn}」超出星历校验年代范围，位置仅供参考`);
        }
        continue;
      }
      if (rec.kind === 'delta_t_uncertain') {
        const sigma = typeof rec.sigmaSeconds === 'number' ? rec.sigmaSeconds : '若干';
        const angle = typeof rec.angleSmearDeg === 'number' ? rec.angleSmearDeg : '略有';
        const moon = typeof rec.moonSmearArcmin === 'number' ? rec.moonSmearArcmin : '略有';
        out.push(
          `该年代地球自转时差（ΔT）存在约 ${sigma} 秒不确定度，四轴约偏移 ${angle}°、月亮约偏移 ${moon} 角分`,
        );
        continue;
      }
      if (typeof rec.text === 'string' && rec.text.trim()) {
        out.push(rec.text.trim());
        continue;
      }
      out.push('星历计算存在精度边界提示');
    }
  }
  return out;
}

const ASTRO_REFERENCE_KIND_LABELS: Record<string, string> = {
  instant: '指定时刻',
  year: '按年推运',
  month: '按月推运',
  day: '按日推运',
};

export function formatAstroReferenceKind(kind: string): string {
  return ASTRO_REFERENCE_KIND_LABELS[kind] ?? kind;
}

const HUANGJI_TABLE_LABELS: Record<string, string> = {
  'sound-rhythm': '声音律吕图',
  'animal-plant': '动植物数',
  'historical-era': '经辰历史纪年原表',
};

export function formatHuangjiTableLabel(table: string): string {
  return HUANGJI_TABLE_LABELS[table] ?? table;
}

const BAZI_CLIMATE_MODE_LABELS: Record<string, string> = {
  reference: '参考',
  conditional: '条件适用',
  'within-balance': '扶抑兼顾',
};

export function formatBaziClimateMode(mode: string): string {
  return BAZI_CLIMATE_MODE_LABELS[mode] ?? mode;
}

export function formatClockLike(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const year = typeof rec.year === 'number' ? rec.year : undefined;
  const month = typeof rec.month === 'number' ? rec.month : undefined;
  const day = typeof rec.day === 'number' ? rec.day : undefined;
  const hour = typeof rec.hour === 'number' ? rec.hour : undefined;
  const minute = typeof rec.minute === 'number' ? rec.minute : undefined;
  const second = typeof rec.second === 'number' ? rec.second : undefined;
  if (year === undefined || month === undefined || day === undefined) return undefined;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const datePart = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  if (hour === undefined) return datePart;
  return `${datePart} ${pad2(hour)}:${pad2(minute ?? 0)}:${pad2(second ?? 0)}`;
}
