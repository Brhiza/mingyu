import type { z } from 'zod';
import type { astrolabeSynastryIndependentInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { sameJsonValue } from '../json-value';
import { calculateAstrolabeIndependentData, formatAstrolabeClassics } from './astrolabe';
import { houseAt } from './astrology/geometry';
import { parseQuestionContext } from './question-context';
import { buildMethodSituationDigest } from './situation-digest';
import type { SynastryRelationship } from './focus-presets';

type Input = z.infer<typeof astrolabeSynastryIndependentInput>;
type Source = Pick<Input, 'person1' | 'person2' | 'referenceTime' | 'syncYears' | 'options' | 'prompt'>;
type PointId = NonNullable<NonNullable<Input['options']>['points']>[number];
const defaults: PointId[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'juno', 'true_node', 'south_node', 'asc', 'mc', 'desc', 'ic'];
const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const rules = [
  { id: 'conjunction', label: '合相', angle: 0, orb: 8 }, { id: 'sextile', label: '六合', angle: 60, orb: 4 },
  { id: 'square', label: '刑相', angle: 90, orb: 6 }, { id: 'trine', label: '拱相', angle: 120, orb: 6 },
  { id: 'opposition', label: '冲相', angle: 180, orb: 8 },
] as const;
const rulers: PointId[] = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter'];
const exaltations: (PointId | null)[] = ['sun', 'moon', null, 'jupiter', null, 'mercury', 'saturn', null, null, 'mars', null, 'venus'];
const seven = new Set<PointId>(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
const transitBodies = new Set<string>(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'true_node']);
const outerTransitBodies = new Set<string>(['jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'true_node']);
function matchTransitPoints(moving: Point[], natalPoints: Point[], transitOrb: number) {
  return moving.flatMap((tr) => natalPoints.flatMap((nat) => {
    const delta = Math.abs(tr.longitude - nat.longitude), actual = Math.min(delta, 360 - delta);
    for (const rule of rules) {
      const deviation = Math.abs(actual - rule.angle);
      if (deviation <= transitOrb) {
        return [{ transitBody: tr.id, transitName: tr.name, natalPoint: nat.id, natalName: nat.name, type: rule.id, label: rule.label, angle: rule.angle, actualAngle: actual, deviation, allowedOrb: transitOrb }];
      }
    }
    return [];
  })).sort((a, b) => a.deviation - b.deviation);
}
const norm = (value: number) => ((value % 360) + 360) % 360;
function circularMidpoint(lon1: number, lon2: number) {
  const a = norm(lon1), b = norm(lon2);
  const delta = ((b - a + 540) % 360) - 180;
  if (Math.abs(delta + 180) < 1e-9) return norm(Math.min(a, b) + 90);
  return norm(a + delta / 2);
}
function signPosition(longitude: number) {
  const lon = norm(longitude), signIndex = Math.floor(lon / 30);
  return { longitude: lon, sign: signs[signIndex], signIndex, degreeInSign: lon - signIndex * 30 };
}
type Chart = Awaited<ReturnType<typeof calculateAstrolabeIndependentData>>;
function selectedPoints(chart: Chart, ids: PointId[]) {
  const all = [...chart.points, ...chart.derived, ...chart.angles];
  // Use chart order for deterministic cross-chart comparisons, irrespective of input selection order.
  return all.filter((item) => ids.includes(item.id as PointId));
}
type Point = ReturnType<typeof selectedPoints>[number];
function overlay(owner: Chart, ownerId: 'person1' | 'person2', visitor: Point[]) {
  return visitor.map((point) => {
    const index = houseAt(point.longitude, owner.houses.map((house) => house.longitude)) - 1;
    return { owner: ownerId, visitor: ownerId === 'person1' ? 'person2' as const : 'person1' as const, point: point.id, pointName: point.name,
      longitude: point.longitude, house: index + 1, houseStart: owner.houses[index].longitude, houseEnd: owner.houses[(index + 1) % 12].longitude };
  });
}
function buildCompositeChart(person1: Chart, person2: Chart, p1: Point[], p2: Point[], aspectOrbs: Record<string, number>, maxAspects: number) {
  const asc1 = person1.angles.find((a) => a.id === 'asc')!.longitude;
  const asc2 = person2.angles.find((a) => a.id === 'asc')!.longitude;
  const compositeAsc = circularMidpoint(asc1, asc2);
  const cusps = Array.from({ length: 12 }, (_, index) => norm(compositeAsc + index * 30));
  const houses = cusps.map((lon, index) => ({ house: index + 1, ...signPosition(lon) }));
  const points = p1.map((first, index) => {
    const second = p2[index];
    const midLon = circularMidpoint(first.longitude, second.longitude);
    const house = houseAt(midLon, cusps);
    return { id: first.id, name: first.name, ...signPosition(midLon), house };
  });
  const redundantCompositePoints = new Set(['desc', 'ic', 'south_node']);
  const compositeAxes = new Set(['asc', 'mc', 'true_node']);
  const matched = points.flatMap((first, i) => points.slice(i + 1).flatMap((second) => {
    if (redundantCompositePoints.has(first.id) || redundantCompositePoints.has(second.id)) return [];
    if (compositeAxes.has(first.id) && compositeAxes.has(second.id)) return [];
    const delta = Math.abs(first.longitude - second.longitude), actual = Math.min(delta, 360 - delta);
    for (const rule of rules) {
      const allowedOrb = aspectOrbs[rule.id] ?? rule.orb, deviation = Math.abs(actual - rule.angle);
      if (deviation <= allowedOrb) return [{ point1: first.id, point2: second.id, point1Name: first.name, point2Name: second.name,
        type: rule.id, label: rule.label, angle: rule.angle, actualAngle: actual, deviation, allowedOrb, orbRatio: deviation / allowedOrb }];
    }
    return [];
  })).sort((a, b) => a.orbRatio - b.orbRatio || a.deviation - b.deviation);
  return {
    model: '最短圆弧中点组合盘（等宫制宫位）' as const,
    ascendant: signPosition(compositeAsc),
    houses,
    points,
    aspects: matched.slice(0, maxAspects),
    totalAspects: matched.length,
  };
}
async function calculateData(source: Source, context?: RuntimeContext) {
  const input = { person1: source.person1, person2: source.person2, ...(source.referenceTime ? { referenceTime: source.referenceTime } : {}), ...(source.syncYears ? { syncYears: source.syncYears } : {}), ...(source.options ? { options: source.options } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) };
  const ids = input.options?.points ?? defaults;
  const includeAsteroids = ids.some((id) => ['ceres', 'pallas', 'juno', 'vesta'].includes(id));
  const chartOptions = { includeAsteroids, ...(input.options?.houseSystem ? { houseSystem: input.options.houseSystem } : {}) };
  const [person1, person2] = await Promise.all([
    calculateAstrolabeIndependentData({ birth: input.person1, options: chartOptions }, context),
    calculateAstrolabeIndependentData({ birth: input.person2, options: chartOptions }, context),
  ]);
  const p1 = selectedPoints(person1, ids), p2 = selectedPoints(person2, ids);
  if (p1.length !== ids.length || p2.length !== ids.length) throw new Error('合盘计算点不完整。');
  const matched = p1.flatMap((first) => p2.flatMap((second) => {
    const delta = Math.abs(first.longitude - second.longitude), actual = Math.min(delta, 360 - delta);
    for (const rule of rules) {
      const allowedOrb = input.options?.aspectOrbs?.[rule.id] ?? rule.orb, deviation = Math.abs(actual - rule.angle);
      if (deviation <= allowedOrb) return [{ person1Point: first.id, person2Point: second.id, person1Name: first.name, person2Name: second.name,
        type: rule.id, label: rule.label, angle: rule.angle, actualAngle: actual, deviation, allowedOrb, orbRatio: deviation / allowedOrb }];
    }
    return [];
  })).sort((a, b) => a.orbRatio - b.orbRatio || a.deviation - b.deviation);
  const limit = input.options?.maxAspects ?? 40, aspects = matched.slice(0, limit);
  const overlays = input.options?.includeHouseOverlays === false ? [] : [...overlay(person1, 'person1', p2), ...overlay(person2, 'person2', p1)];
  const classical1 = p1.filter((p) => seven.has(p.id as PointId)), classical2 = p2.filter((p) => seven.has(p.id as PointId));
  const mutualPairs = new Set<string>();
  const receptions: Array<{ type: 'mutual' | 'reception'; person1Point: string; person2Point: string; person1Name: string; person2Name: string; sign1: string; sign2: string; receiver?: 'person1' | 'person2'; dignity?: string[]; aspect?: string }> = [];
  for (const a of classical1) for (const b of classical2) {
    if (a.id !== b.id && rulers[a.signIndex] === b.id && rulers[b.signIndex] === a.id) {
      mutualPairs.add(`${a.id}:${b.id}`);
      receptions.push({ type: 'mutual', person1Point: a.id, person2Point: b.id, person1Name: a.name, person2Name: b.name, sign1: a.sign, sign2: b.sign });
    }
  }
  for (const aspect of matched) {
    const a = classical1.find((point) => point.id === aspect.person1Point), b = classical2.find((point) => point.id === aspect.person2Point);
    if (!a || !b || mutualPairs.has(`${a.id}:${b.id}`)) continue;
    const dignity1 = [rulers[b.signIndex] === a.id ? '入庙' : '', exaltations[b.signIndex] === a.id ? '曜升' : ''].filter(Boolean);
    const dignity2 = [rulers[a.signIndex] === b.id ? '入庙' : '', exaltations[a.signIndex] === b.id ? '曜升' : ''].filter(Boolean);
    const base = { type: 'reception' as const, person1Point: a.id, person2Point: b.id, person1Name: a.name, person2Name: b.name, sign1: a.sign, sign2: b.sign, aspect: aspect.label };
    if (dignity2.length) receptions.push({ ...base, receiver: 'person2', dignity: dignity2 });
    if (dignity1.length) receptions.push({ ...base, receiver: 'person1', dignity: dignity1 });
  }
  const aspectOrbsMap = Object.fromEntries(rules.map((rule) => [rule.id, input.options?.aspectOrbs?.[rule.id] ?? rule.orb]));
  const includeComposite = input.options?.includeComposite !== false;
  const composite = includeComposite ? buildCompositeChart(person1, person2, p1, p2, aspectOrbsMap, limit) : null;
  const transits = input.referenceTime ? await (async () => {
    const refDate = new Date(Date.parse(input.referenceTime!));
    if (refDate.getUTCFullYear() < 1900 || refDate.getUTCFullYear() > 2100) throw new Error('推运参考时刻年份须在 1900 至 2100 年之间。');
    const sky = await calculateAstrolabeIndependentData({
      birth: {
        year: refDate.getUTCFullYear(), month: refDate.getUTCMonth() + 1, day: refDate.getUTCDate(),
        hour: refDate.getUTCHours(), minute: refDate.getUTCMinutes(), second: refDate.getUTCSeconds(),
        latitude: input.person1.latitude, longitude: input.person1.longitude, timezone: 0,
      },
      options: { includeAsteroids: false },
    }, context);
    const moving = sky.points.filter((pt) => transitBodies.has(pt.id));
    const transitOrb = 3;
    const toPerson1 = matchTransitPoints(moving, p1, transitOrb);
    const toPerson2 = matchTransitPoints(moving, p2, transitOrb);
    return {
      referenceTime: input.referenceTime!,
      transitOrb,
      skyPoints: moving.map((pt) => ({ id: pt.id, name: pt.name, longitude: pt.longitude, sign: pt.sign, degreeInSign: pt.degreeInSign, retrograde: pt.retrograde })),
      toPerson1: toPerson1.slice(0, 20),
      toPerson2: toPerson2.slice(0, 20),
    };
  })() : undefined;
  const annualSync = input.syncYears ? await (async () => {
    const transitOrb = 3;
    const years = await Promise.all(
      Array.from({ length: input.syncYears!.endYear - input.syncYears!.startYear + 1 }, async (_, i) => {
        const year = input.syncYears!.startYear + i;
        const sky = await calculateAstrolabeIndependentData({
          birth: {
            year, month: 6, day: 15, hour: 4, minute: 0, second: 0,
            latitude: input.person1.latitude, longitude: input.person1.longitude, timezone: 0,
          },
          options: { includeAsteroids: false },
        }, context);
        const moving = sky.points.filter((pt) => outerTransitBodies.has(pt.id));
        const toPerson1 = matchTransitPoints(moving, p1, transitOrb).slice(0, 8);
        const toPerson2 = matchTransitPoints(moving, p2, transitOrb).slice(0, 8);
        const sharedBodies = [...new Set(toPerson1.map((t) => t.transitName).filter((name) => toPerson2.some((u) => u.transitName === name)))];
        return { year, sharedBodies, toPerson1, toPerson2 };
      }),
    );
    return {
      startYear: input.syncYears!.startYear,
      endYear: input.syncYears!.endYear,
      transitOrb,
      years,
      limitation: '多年行运同步按每年公历6月15日外行星（木土天海冥及北交）对双方本命点的几何相位（容许度 3°）采样，不代表具体日度事件。',
    };
  })() : undefined;
  return { input, charts: { person1, person2 }, settings: { points: ids, houseSystem: input.options?.houseSystem ?? 'placidus', includeAsteroids,
    aspectOrbs: aspectOrbsMap, maxAspects: limit, includeHouseOverlays: input.options?.includeHouseOverlays !== false, includeComposite },
    aspects, overlays, receptions, ...(composite ? { composite } : {}), ...(transits ? { transits } : {}), ...(annualSync ? { annualSync } : {}), counts: { selectedPoints1: p1.length, selectedPoints2: p2.length, evaluatedPairs: p1.length * p2.length,
      matchedAspects: matched.length, returnedAspects: aspects.length, omittedAspects: matched.length - aspects.length, overlays: overlays.length },
    limitations: [
      transits ? '双人行运仅比较参考时刻流年星体对双方本命点的几何相位（容许度 3°），不直接断言事件结果。' : '未提供 referenceTime 时仅比较静态本命与组合中点盘，不计算动态行运。',
      '跨盘相位使用黄经最小夹角；落宫使用宫主十二宫头区间；组合中点盘采用最短圆弧黄经中点与中点上升等宫制。',
      '守护互溶只判定不同古典七政交换入庙；单向接纳须伴随已命中相位，按入庙或曜升判断，基于全部命中相位而非截断列表。',
      ...(matched.length > limit ? [`跨盘相位共 ${matched.length} 条，仅返回前 ${limit} 条，可提高 maxAspects（最多 200）。`] : []),
      ...new Set([...person1.limitations.filter((v) => v.includes('坐标') || v.includes('改用')), ...person2.limitations.filter((v) => v.includes('坐标') || v.includes('改用'))])] };
}
type Data = Awaited<ReturnType<typeof calculateData>>;
function buildSynastryPatternRelations(data: Data, label1: string, label2: string): string {
  const coreIds = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'asc', 'desc', 'mc', 'ic']);
  const pressureIds = new Set(['saturn', 'mars', 'pluto', 'uranus', 'neptune']);
  const conjunctions = data.aspects.filter((a) => a.type === 'conjunction');
  const softAspects = data.aspects.filter((a) => a.type === 'trine' || a.type === 'sextile');
  const hardAspects = data.aspects.filter((a) => a.type === 'square' || a.type === 'opposition');
  const lines: string[] = [];

  lines.push(
    `跨盘相位总览：当前返回 ${data.aspects.length} 条相位中，合相（能量聚焦）${conjunctions.length} 条、和谐相位（拱/六合吸引力）${softAspects.length} 条、困难相位（刑/冲磨合点）${hardAspects.length} 条。`,
  );

  // 1. 和谐吸引力与核心合相
  const attractive = [...conjunctions, ...softAspects]
    .filter((a) => coreIds.has(a.person1Point) || coreIds.has(a.person2Point))
    .sort((a, b) => {
      const aBoth = (coreIds.has(a.person1Point) && coreIds.has(a.person2Point)) ? 1 : 0;
      const bBoth = (coreIds.has(b.person1Point) && coreIds.has(b.person2Point)) ? 1 : 0;
      return bBoth - aBoth || a.orbRatio - b.orbRatio;
    })
    .slice(0, 6);
  lines.push(
    `和谐相位吸引力与共振轴：${attractive.map((a) => `${label1}${a.person1Name}${a.label}${label2}${a.person2Name}（偏差${a.deviation.toFixed(2)}°）`).join('；') || '所选点位中未见核心星体/四轴的和谐或合相共振'}。`,
  );

  // 2. 困难相位磨合点与缓冲制衡
  const receptionMap = new Set<string>();
  for (const r of data.receptions) {
    receptionMap.add(`${r.person1Point}:${r.person2Point}`);
  }
  const frictions = hardAspects
    .filter((a) => coreIds.has(a.person1Point) || coreIds.has(a.person2Point))
    .sort((a, b) => {
      const aPress = (pressureIds.has(a.person1Point) || pressureIds.has(a.person2Point)) ? 1 : 0;
      const bPress = (pressureIds.has(b.person1Point) || pressureIds.has(b.person2Point)) ? 1 : 0;
      return bPress - aPress || a.orbRatio - b.orbRatio;
    })
    .slice(0, 6);
  if (frictions.length) {
    const frictionNotes = frictions.map((a) => {
      const hasRec = receptionMap.has(`${a.person1Point}:${a.person2Point}`);
      const p1Soft = softAspects.find((s) => s.person1Point === a.person1Point && s.person2Point !== a.person2Point);
      const p2Soft = softAspects.find((s) => s.person2Point === a.person2Point && s.person1Point !== a.person1Point);
      const buffers = [
        hasRec ? '有传统接纳/互溶缓和' : '',
        p1Soft ? `${label1}${a.person1Name}另与${label2}${p1Soft.person2Name}成${p1Soft.label}出口` : '',
        p2Soft ? `${label2}${a.person2Name}另与${label1}${p2Soft.person1Name}成${p2Soft.label}出口` : '',
      ].filter(Boolean);
      return `${label1}${a.person1Name}${a.label}${label2}${a.person2Name}（偏差${a.deviation.toFixed(2)}°${buffers.length ? `；缓冲：${buffers.join('，')}` : '；无直接跨盘和谐出口或接纳缓冲'}）`;
    });
    lines.push(`困难相位磨合点与缓冲：${frictionNotes.join('；')}。`);
  } else {
    lines.push('困难相位磨合点与缓冲：当前返回相位中未见核心星体/四轴的刑相或冲相。');
  }

  // 3. 双方十大星体元素互补与同频制衡
  const e1 = data.charts.person1.distributions.elements;
  const e2 = data.charts.person2.distributions.elements;
  const complements: string[] = [];
  const resonances: string[] = [];
  for (let i = 0; i < e1.length; i++) {
    const c1 = e1[i].members.length, c2 = e2[i].members.length, elem = e1[i].label;
    if (c1 >= 3 && c2 >= 3) resonances.push(`${elem}象同频（${label1} ${c1}星 / ${label2} ${c2}星）`);
    else if (c1 <= 1 && c2 >= 3) complements.push(`${label1}${elem}象薄弱（${c1}星）由${label2}${elem}象（${c2}星）互补`);
    else if (c2 <= 1 && c1 >= 3) complements.push(`${label2}${elem}象薄弱（${c2}星）由${label1}${elem}象（${c1}星）互补`);
  }
  lines.push(
    `双方元素制衡：${[...resonances, ...complements].join('；') || '双方四元素分布均较平缓，无极端同频或单边互补'}。`,
  );

  return lines.join('\n');
}

function render(data: Data, question: string, options?: Input['prompt']) {
  const name1 = data.input.person1.name?.trim() || '第一人', name2 = data.input.person2.name?.trim() || '第二人';
  const label1 = name1 === name2 ? `第一人${name1}` : name1, label2 = name1 === name2 ? `第二人${name2}` : name2;
  const aspects = data.aspects.map((a) => `${label1}${a.person1Name}与${label2}${a.person2Name}${a.label}（偏差${a.deviation.toFixed(2)}°）`).join('；');
  const overlays1to2 = data.overlays.filter((o) => o.visitor === 'person1').map((o) => `${o.pointName}落第${o.house}宫`).join('、');
  const overlays2to1 = data.overlays.filter((o) => o.visitor === 'person2').map((o) => `${o.pointName}落第${o.house}宫`).join('、');
  const overlays = [
    overlays1to2 ? `${label1}落${label2}宫位：${overlays1to2}` : '',
    overlays2to1 ? `${label2}落${label1}宫位：${overlays2to1}` : '',
  ].filter(Boolean).join('\n');
  const receptions = data.receptions.map((r) => r.type === 'mutual'
    ? `${label1}${r.person1Name}落${r.sign1}，${label2}${r.person2Name}落${r.sign2}：守护互溶`
    : `${r.receiver === 'person1' ? label1 + r.person1Name : label2 + r.person2Name}以${r.dignity?.join('、')}接纳${r.receiver === 'person1' ? label2 + r.person2Name : label1 + r.person1Name}，伴随${r.aspect}`).join('\n');
  const compositeText = data.composite
    ? `【组合中点盘（Composite）】\n中点上升：${data.composite.ascendant.sign}${data.composite.ascendant.degreeInSign.toFixed(2)}°（${data.composite.model}）\n中点星位：${data.composite.points.map((pt) => `${pt.name}${pt.sign}${pt.degreeInSign.toFixed(2)}°（第${pt.house}宫）`).join('；')}\n组合盘内部相位（前 ${data.composite.aspects.length}/${data.composite.totalAspects} 条）：\n${data.composite.aspects.map((a) => `${a.point1Name}与${a.point2Name}${a.label}（偏差${a.deviation.toFixed(3)}°）`).join('；') || '无命中相位'}`
    : '';
  const transitText = data.transits
    ? `【双人行运合参（Transit）】\n参考时刻：${data.transits.referenceTime}（容许度 ${data.transits.transitOrb}°）\n流年对${label1}本命：${data.transits.toPerson1.map((t) => `流年${t.transitName}${t.label}本命${t.natalName}（偏差${t.deviation.toFixed(2)}°）`).join('；') || '无紧密相位'}\n流年对${label2}本命：${data.transits.toPerson2.map((t) => `流年${t.transitName}${t.label}本命${t.natalName}（偏差${t.deviation.toFixed(2)}°）`).join('；') || '无紧密相位'}`
    : '';
  const schools = options?.schools?.map((school) => ({ modern: '现代占星：结合双方本命位置、组合中点盘和跨盘相位讨论互动。', traditional: '传统占星：核对已列守护互溶及伴随相位的接纳。', hellenistic: '希腊古典：兼顾双方昼夜盘阵营与本命定位星互溶互动。', timing: data.transits ? '时机：结合已列双人流年行运相位讨论阶段议题。' : '时机：本次未提供 referenceTime 计算动态运限，不推断具体应期。' })[school]).join('\n');
  const natal = (chart: Chart) => selectedPoints(chart, data.settings.points).map((point) => `${point.name}${point.sign}${point.degreeInSign.toFixed(2)}°，第${point.house}宫`).join('；');
  const astroScenarioMap: Record<SynastryRelationship, { label: string; focus: string }> = {
    marriage: {
      label: '恋爱合婚',
      focus: '优先考察双方金星、火星、月亮、太阳与第七宫/第五宫的互溶落点与合拱刑冲，评估情感吸引力、情绪共振与长久磨合点。',
    },
    career: {
      label: '事业合伙',
      focus: '优先考察双方水星、木星、土星、中天（MC）与第十宫/第二宫/第十一宫的相位与落宫，分析沟通协作、信用稳固度与资源分工边界。',
    },
    friendship: {
      label: '友人搭档',
      focus: '优先考察水星、金星、木星与第十一宫/第三宫互动，评估三观交流频率与互相支持感。',
    },
    children: {
      label: '亲子育儿',
      focus: '优先考察月亮、太阳、水星与第五宫/第四宫互动及土星课题，理解情绪安全感表达与教养沟通节奏。',
    },
    parents: {
      label: '父母长辈',
      focus: '优先考察月亮、土星与第四宫/第十宫落点，区分代际习惯、界限尊重与照顾沟通方式。',
    },
    siblings: {
      label: '同胞手足',
      focus: '优先考察水星、月亮与第三宫/第四宫互动，评估日常沟通风格与协作默契。',
    },
  };
  const rel = parseQuestionContext(question).synastryRelationship ?? 'marriage';
  const scenario = astroScenarioMap[rel];
  const syncText = data.annualSync
    ? [
        `【多年外行星行运同步（${data.annualSync.startYear}–${data.annualSync.endYear}）】`,
        ...data.annualSync.years.map((item) =>
          `${item.year}年（同引动：${item.sharedBodies.join('、') || '无'}）：对${label1}[${item.toPerson1.slice(0, 4).map((t) => `${t.transitName}${t.label}${t.natalName}`).join('、') || '无紧密相位'}]；对${label2}[${item.toPerson2.slice(0, 4).map((t) => `${t.transitName}${t.label}${t.natalName}`).join('、') || '无紧密相位'}]。`,
        ),
        data.annualSync.limitation,
      ].join('\n')
    : '';
  const situationLines = buildMethodSituationDigest('astrolabe-synastry', data, question);
  const g1 = data.input.person1.gender === 'male' ? '（男）' : data.input.person1.gender === 'female' ? '（女）' : '';
  const g2 = data.input.person2.gender === 'male' ? '（男）' : data.input.person2.gender === 'female' ? '（女）' : '';
  const text = [`【西洋星盘双人合盘】\n${label1}${g1} UTC ${data.charts.person1.basis.utcDateTime}，${data.charts.person1.basis.houseSystem} 宫位；${label2}${g2} UTC ${data.charts.person2.basis.utcDateTime}，${data.charts.person2.basis.houseSystem} 宫位。`,
    `【双方本命计算点】\n${label1}：${natal(data.charts.person1)}\n${label2}：${natal(data.charts.person2)}`,
    `【跨盘相位】\n${aspects || '未命中所选主要相位。'}\n共命中 ${data.counts.matchedAspects} 条，返回 ${data.counts.returnedAspects} 条。`,
    `【双向落宫】\n${data.settings.includeHouseOverlays ? overlays || '没有可用落宫。' : '未启用。'}`,
    `【传统接纳与互溶】\n${receptions || '所选计算点未见守护互溶或伴随相位的入庙、曜升接纳。'}`,
    `【相位格局与能量制衡关系】\n${buildSynastryPatternRelations(data, label1, label2)}`,
    compositeText,
    transitText,
    syncText,
    schools ? `【流派】\n${schools}` : '', formatAstrolabeClassics(options?.includeClassics),
    situationLines.length ? `【局势要点】\n${situationLines.join('\n')}` : '',
    `【${scenario.label}任务】\n${scenario.focus} 结合双方位置、跨盘相位和落宫回答问题；区分几何事实与占星解释，不按数量打匹配分，也不推断对方意图。`,
    `【限制】\n${data.limitations.join('\n')}${data.charts.person1.warnings.length || data.charts.person2.warnings.length ? `\n${label1}星历警告：${data.charts.person1.warnings.length ? JSON.stringify(data.charts.person1.warnings) : '无'}；${label2}星历警告：${data.charts.person2.warnings.length ? JSON.stringify(data.charts.person2.warnings) : '无'}` : ''}`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function astrolabeSynastryIndependent(input: Input, context?: RuntimeContext) {
  const data = await calculateData(input, context);
  return { data, summary: { title: '西洋星盘双人合盘', lines: [`跨盘相位 ${data.counts.returnedAspects}/${data.counts.matchedAspects}`, `双向落宫 ${data.counts.overlays} 条`, `传统接纳与互溶 ${data.receptions.length} 条`] }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedAstrolabeSynastryIndependent(data: unknown, source: Source, question: string, options?: Input['prompt'], context?: RuntimeContext) {
  const expected = await calculateData(source, context);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('西洋双盘与保存的出生资料不一致。');
  return render(expected, question, options ?? source.prompt);
}
