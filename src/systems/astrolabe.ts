import { Engine, isDayChart, lotFortune, lotSpirit, type EngineData } from 'caelus';
import { embeddedData } from 'caelus/data-embedded';
import type { z } from 'zod';
import type { astrolabeIndependentInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { browserAsteroidData } from '../asteroid-data';
import { sameJsonValue } from '../json-value';
import { correctBirthClock, resolveBirthClock } from './birth-time';
import { houseAt } from './astrology/geometry';
import { astroEventLabels, astroEventDirections, astroEclipseLabels } from './astrology/event-labels';
import { natalAspectRules } from './astrology/natal-aspects';
import { natalEvidence } from './astrology/natal-evidence';
import { formatClassicExcerpts, type ClassicExcerpt } from './classics';
import { evaluateAstrolabeSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';

const WESTERN_ASTROLOGY_CLASSICS: readonly ClassicExcerpt[] = [
  {
    book: '四书（Tetrabiblos）',
    chapter: '卷一·行星尊贵与昼夜派别',
    title: '昼夜盘与行星配置',
    quote: '日月为昼夜之主，诸星之得时、失时与宫位强弱，皆当依昼夜与黄道位置察其所宜。',
    explanation: '传统占星以昼夜盘（Sect）区分日月及佐星的顺逆喜忌，并结合入庙、曜升等尊贵状态判断行星发用条件。',
    condition: '西洋星盘本命与推运昼夜盘及尊贵状态核对',
  },
  {
    book: '基督教占星学（Christian Astrology）',
    chapter: '卷一·接纳与相位',
    title: '守护接纳与相位成败',
    quote: '两星既成相位，若兼见主星互溶或庙旺接纳，则其情相通；无接纳而刑冲者，虽合亦多阻滞。',
    explanation: '判断相位与合盘互动时，除几何容许度与入出相外，须核对守护、曜升等接纳与互溶关系。',
    condition: '西洋星盘相位及双人合盘接纳与互溶核对',
  },
];

export function formatAstrolabeClassics(include?: boolean): string {
  return include ? formatClassicExcerpts(WESTERN_ASTROLOGY_CLASSICS, '典籍片段') : '';
}

type Input = z.infer<typeof astrolabeIndependentInput>;
type Source = Pick<Input, 'birth' | 'options' | 'flow' | 'prompt'>;
const baseEngine = new Engine(embeddedData);
let extendedEngine: Promise<Engine> | undefined;
let workerEngine: Engine | undefined;
const asteroidNames = ['ceres', 'pallas', 'juno', 'vesta'] as const;
function engineFromPacks([ceres, pallas, juno, vesta]: unknown[]) {
  return new Engine({ ...embeddedData, chebPacks: { ceres, pallas, juno, vesta } as EngineData['chebPacks'] });
}
function cacheExtendedEngine(load: () => Promise<Engine>) {
  if (!extendedEngine) {
    const pending = load();
    extendedEngine = pending;
    void pending.catch(() => { if (extendedEngine === pending) extendedEngine = undefined; });
  }
  return extendedEngine;
}
async function engineWithAsteroids(context?: RuntimeContext) {
  if (typeof __MINGYU_WORKER_ASSETS__ !== 'undefined' && __MINGYU_WORKER_ASSETS__) {
    if (workerEngine) return workerEngine;
    if (!context?.asteroidData) throw new Error('小行星星历资源加载器未配置。');
    const packs = await Promise.all(asteroidNames.map(context.asteroidData));
    return workerEngine = engineFromPacks(packs);
  } else if (typeof __MINGYU_BROWSER_ASSETS__ !== 'undefined' && __MINGYU_BROWSER_ASSETS__) {
    return cacheExtendedEngine(async () => engineFromPacks(await Promise.all(asteroidNames.map(browserAsteroidData))));
  } else {
    return cacheExtendedEngine(() => Promise.all([
      import('./astrology/data/ceres_cheb.js'), import('./astrology/data/pallas_cheb.js'),
      import('./astrology/data/juno_cheb.js'), import('./astrology/data/vesta_cheb.js'),
    ]).then((modules) => engineFromPacks(modules.map((module) => module.default))));
  }
}
const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const bodies = [
  ['sun', '太阳'], ['moon', '月亮'], ['mercury', '水星'], ['venus', '金星'], ['mars', '火星'],
  ['jupiter', '木星'], ['saturn', '土星'], ['uranus', '天王星'], ['neptune', '海王星'], ['pluto', '冥王星'],
  ['chiron', '凯龙星'], ['ceres', '谷神星'], ['pallas', '智神星'], ['juno', '婚神星'], ['vesta', '灶神星'],
  ['true_node', '北交点'], ['true_lilith', '真莉莉丝'],
] as const;
const topicLabels: Record<string, string> = { life: '人生全貌', career: '事业', 'job-change': '工作变动', 'startup-partnership': '创业合作', 'investment-partnership': '投资合作', wealth: '财务', relationship: '感情', 'relationship-push': '关系推进', 'relationship-decision': '关系决策', 'reconciliation-decision': '复合决策', marriage: '婚姻', children: '子女', family: '家庭', 'home-move': '搬家', 'settle-relocate': '定居迁移', social: '社交', emotion: '情绪', growth: '成长', talent: '天赋', health: '身心健康', study: '学习', 'study-advance': '升学', 'exam-landing': '考试与落地', recent: '近期关注', chat: '自由提问' };
const normalize = (value: number) => ((value % 360) + 360) % 360;
function position(longitude: number) {
  const lon = normalize(longitude), signIndex = Math.floor(lon / 30);
  return { longitude: lon, sign: signs[signIndex], signIndex, degreeInSign: lon - signIndex * 30 };
}
export async function calculateAstrolabeIndependentData(source: Source, context?: RuntimeContext) {
  const input = { birth: source.birth, ...(source.options ? { options: source.options } : {}), ...(source.flow ? { flow: source.flow } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) };
  const birth = input.birth;
  if (Math.abs(birth.latitude) === 90) throw new Error('地理极点无法确定完整星盘宫位。');
  const clock = { year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, minute: birth.minute, second: birth.second ?? 0,
    timezone: birth.timezone, timeZoneId: birth.timeZoneId, ...(birth.useTrueSolarTime ? { timeStandard: 'true-solar' as const, longitude: birth.longitude } : {}) };
  const resolved = resolveBirthClock(clock), corrected = await correctBirthClock(clock, resolved);
  const engine = input.options?.includeAsteroids ? await engineWithAsteroids(context) : baseEngine;
  const jd = resolved.utcTimestamp / 86_400_000 + 2_440_587.5;
  const houseSystem = input.options?.houseSystem ?? 'placidus';
  const chart = engine.chartAt(jd, birth.latitude, birth.longitude, { houseSystem,
    bodies: input.options?.includeAsteroids ? ['true_lilith', 'ceres', 'pallas', 'juno', 'vesta'] : ['true_lilith'] });
  const requested = bodies.filter(([id]) => input.options?.includeAsteroids || !['ceres', 'pallas', 'juno', 'vesta'].includes(id));
  const missing = requested.filter(([id]) => !chart.bodies[id]);
  if (missing.length) throw new RangeError(`当前日期无法计算：${missing.map(([, name]) => name).join('、')}。`);
  const points = requested.map(([id, name]) => {
    const body = chart.bodies[id]!;
    return { id, name, ...position(body.lon), latitude: body.lat, distance: body.dist, speed: body.speed, retrograde: body.retrograde, house: body.house, dignities: body.dignities };
  });
  const node = chart.bodies.true_node;
  const point = (id: string, name: string, longitude: number) => ({ id, name, ...position(longitude), house: houseAt(longitude, chart.cusps) });
  const dayChart = isDayChart(engine, jd, birth.latitude, birth.longitude);
  const derived = [point('south_node', '南交点', node.lon + 180),
    point('fortune', '福点', lotFortune(chart.angles.asc, chart.bodies.sun.lon, chart.bodies.moon.lon, dayChart)),
    point('spirit', '精神点', lotSpirit(chart.angles.asc, chart.bodies.sun.lon, chart.bodies.moon.lon, dayChart))];
  const aspects = points.flatMap((first, i) => points.slice(i + 1).flatMap((second) => {
    const direct = normalize(second.longitude - first.longitude), actual = Math.min(direct, 360 - direct);
    return natalAspectRules.flatMap(([type, name, angle, allowedOrb]) => {
      const deviation = Math.abs(actual - angle), strength = 100 * (1 - deviation / allowedOrb);
      if (strength < 30) return [];
      const relativeSpeed = second.speed - first.speed, separationSpeed = (direct > 180 ? -1 : 1) * relativeSpeed;
      const applying = relativeSpeed === 0 || actual === angle ? null : (actual - angle) * separationSpeed < 0;
      return [{ first: first.id, second: second.id, type, name, angle, separation: actual, deviation, allowedOrb, strength, applying }];
    });
  }));
  const evidence = natalEvidence(points, aspects);
  const angles = [point('asc', '上升', chart.angles.asc), point('desc', '下降', chart.angles.asc + 180), point('mc', '天顶', chart.angles.mc), point('ic', '天底', chart.angles.mc + 180)];
  const houses = chart.cusps.map((lon, index) => ({ house: index + 1, ...position(lon) }));
  const limitations = [
    ...(source.flow ? [] : ['未提供推运参考时间，当前只计算本命盘。']),
    '出生时间范围需使用 astrolabe-range，不能把精确出生单盘视为整个范围。',
    '本命相位按十一种类型与固定容许度计算；格局仅使用十大星体，同座或同宫星群不要求相互合相。',
    '元素、模式与格局是盘面统计和几何事实，不代表人格强弱或现实结果。',
    ...(input.options?.includeAsteroids ? [] : ['默认未计算谷神、智神、婚神和灶神；启用 includeAsteroids 可加入。']),
    ...(chart.houseSystem !== chart.houseSystemRequested ? [`所选 ${chart.houseSystemRequested} 宫位制在该纬度不可用，已改用 ${chart.houseSystem}。`] : []),
    ...(!birth.coordinateAccuracy || birth.coordinateAccuracy !== 'user-provided' ? ['出生地坐标精度未经确认或为近似值，宫位和四轴可能发生变化。'] : []),
  ];
  const natal = { input, basis: { utcDateTime: new Date(resolved.utcTimestamp).toISOString(), timezone: resolved.timezone, julianDay: jd,
    coordinates: { latitude: birth.latitude, longitude: birth.longitude, accuracy: birth.coordinateAccuracy ?? 'unspecified' },
    requestedHouseSystem: chart.houseSystemRequested, houseSystem: chart.houseSystem, dayChart,
    trueSolarTimeCorrection: corrected.correction ?? null, engine: 'caelus 0.24.1', zodiac: 'tropical' },
    points, derived, angles, houses, aspects, ...evidence, warnings: chart.warnings, limitations };
  const flow = source.flow ? await (await import('./astrolabe-flow')).calculateAstrolabeFlow(source.flow, birth, natal) : undefined;
  return { ...natal, ...(flow ? { flow } : {}) };
}
type Data = Awaited<ReturnType<typeof calculateAstrolabeIndependentData>>;
const classicalRulers: ReadonlyArray<{ id: string; name: string; modernId?: string; modernName?: string }> = [
  { id: 'mars', name: '火星' },
  { id: 'venus', name: '金星' },
  { id: 'mercury', name: '水星' },
  { id: 'moon', name: '月亮' },
  { id: 'sun', name: '太阳' },
  { id: 'mercury', name: '水星' },
  { id: 'venus', name: '金星' },
  { id: 'mars', name: '火星', modernId: 'pluto', modernName: '冥王星' },
  { id: 'jupiter', name: '木星' },
  { id: 'saturn', name: '土星' },
  { id: 'saturn', name: '土星', modernId: 'uranus', modernName: '天王星' },
  { id: 'jupiter', name: '木星', modernId: 'neptune', modernName: '海王星' },
];
const houseDomains = ['命宫/自我', '财帛/资源', '兄弟/沟通', '田宅/根基', '男女/创造', '奴仆/日常工作与健康', '夫妻/合作', '疾厄/深层转化与偏财', '迁移/高等学识与远行', '官禄/事业名望', '福德/社群愿景', '相貌/潜意识与隐秘'];
const domicileSigns: Record<string, number[]> = { sun: [4], moon: [3], mercury: [2, 5], venus: [1, 6], mars: [0, 7], jupiter: [8, 11], saturn: [9, 10] };
const exaltationSigns: Record<string, number> = { sun: 0, moon: 1, mercury: 5, venus: 11, mars: 9, jupiter: 3, saturn: 6 };
const detrimentSigns: Record<string, number[]> = { sun: [10], moon: [9], mercury: [8, 11], venus: [7, 0], mars: [6, 1], jupiter: [2, 5], saturn: [3, 4] };
const fallSigns: Record<string, number> = { sun: 6, moon: 7, mercury: 11, venus: 5, mars: 3, jupiter: 9, saturn: 0 };

function formatPointDignityAndSolar(point: Data['points'][number], sunLon: number): string {
  const tags: string[] = [];
  if (point.retrograde) tags.push('逆行');
  if (domicileSigns[point.id]?.includes(point.signIndex)) tags.push('入庙');
  if (exaltationSigns[point.id] === point.signIndex) tags.push('曜升');
  if (detrimentSigns[point.id]?.includes(point.signIndex)) tags.push('落陷');
  if (fallSigns[point.id] === point.signIndex) tags.push('失势');
  if (['mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(point.id)) {
    const raw = Math.abs(point.longitude - sunLon);
    const dist = Math.min(raw, 360 - raw);
    if (dist <= 0.2833) tags.push('日核（Cazimi）');
    else if (dist <= 8.5) tags.push('焦伤（Combust）');
    else if (dist <= 17) tags.push('日光下');
  }
  return tags.length ? `（${tags.join('、')}）` : '';
}

function buildHouseRulerLines(data: Data): string {
  const byId = Object.fromEntries(data.points.map((p) => [p.id, p]));
  const items = data.houses.map((h) => {
    const rule = classicalRulers[h.signIndex];
    const rulerPt = byId[rule.id];
    const classicalPlacement = rulerPt ? `${rule.name}飞第${rulerPt.house}宫（${rulerPt.sign}）` : rule.name;
    const modernPt = rule.modernId ? byId[rule.modernId] : undefined;
    const modernPlacement = modernPt ? `，现代共管${rule.modernName}飞第${modernPt.house}宫（${modernPt.sign}）` : '';
    return `第${h.house}宫（${houseDomains[h.house - 1].split('/')[0]}·${h.sign}）：古典宫主${classicalPlacement}${modernPlacement}`;
  });
  return [items.slice(0, 6).join('；'), items.slice(6, 12).join('；')].filter(Boolean).join('\n');
}

function buildNatalMutualReceptions(data: Data): string[] {
  const classical = data.points.filter((p) => Object.hasOwn(domicileSigns, p.id));
  const results: string[] = [];
  for (let i = 0; i < classical.length; i++) {
    for (let j = i + 1; j < classical.length; j++) {
      const a = classical[i], b = classical[j];
      if (domicileSigns[a.id].includes(b.signIndex) && domicileSigns[b.id].includes(a.signIndex)) {
        results.push(`${a.name}（${a.sign}第${a.house}宫）与${b.name}（${b.sign}第${b.house}宫）入庙守护互溶`);
      } else if (exaltationSigns[a.id] === b.signIndex && exaltationSigns[b.id] === a.signIndex) {
        results.push(`${a.name}（${a.sign}第${a.house}宫）与${b.name}（${b.sign}第${b.house}宫）曜升互溶`);
      }
    }
  }
  return results;
}

export function renderAstrolabeIndependentData(data: Data, question: string, options?: Input['prompt'], renderOptions?: { includePeriod?: boolean }) {
  const sunLon = data.points.find((p) => p.id === 'sun')?.longitude ?? 0;
  const location = (item: { name: string; sign: string; degreeInSign: number; house: number }) => `${item.name}${item.sign}${item.degreeInSign.toFixed(2)}°，第${item.house}宫`;
  const pointLocation = (item: Data['points'][number]) => `${location(item)}${formatPointDignityAndSolar(item, sunLon)}`;
  const names = Object.fromEntries(data.points.map((item) => [item.id, item.name]));
  const aspectText = data.aspects.map((a) => `${names[a.first]}与${names[a.second]}${a.name}（偏差${a.deviation.toFixed(2)}°${a.applying === null ? '' : a.applying ? '，入相' : '，出相'}）`).join('；');
  const distribution = (items: Array<{ label: string; members: Array<{ name: string }> }>) => items.map((item) => `${item.label}（${item.members.length}）：${item.members.map((member) => member.name).join('、') || '无'}`).join('；');
  const mutualReceptions = buildNatalMutualReceptions(data);
  const patternLines = [
    ...data.patterns.map((pattern) => `${pattern.label}：${pattern.members.map((member) => member.name).join('、')}${pattern.sign ? `，${pattern.sign}座` : ''}${pattern.house ? `，第${pattern.house}宫` : ''}${pattern.apex ? `，焦点${pattern.apex.name}` : ''}${pattern.aspects.length ? `；${pattern.aspects.map((a) => `${names[a.first]}与${names[a.second]}${a.name}（偏差${a.deviation.toFixed(2)}°）`).join('、')}` : '；同座或同宫，不要求各星体形成合相'}`),
    ...mutualReceptions.map((item) => `互溶结构：${item}`),
  ];
  const patternText = patternLines.join('\n');
  const houseRulerText = buildHouseRulerLines(data);
  const schools = options?.schools?.map((school) => ({ modern: '现代占星：结合星体、星座、宫位和相位讨论心理与生活议题。', traditional: '传统占星：结合昼夜盘与已列尊贵状态，不补造未计算的主星规则。', hellenistic: '希腊古典：结合昼夜星体阵营（Sect）、整宫主星及福点等阿拉伯点定位论断。', timing: data.flow ? '时机：依据已列参考瞬时推运，不能将快照当作整个周期。' : '时机：本盘未计算运限，不能据此断定具体时间。' })[school]).join('\n');
  const flowText = data.flow ? (() => {
    const flow = data.flow;
    const formatAspects = (items: Array<{ movingName: string; natalName: string; label: string; deviation: number }>, target = '本命') => items.map((item) => `${item.movingName}与${target}${item.natalName}${item.label}（偏差${item.deviation.toFixed(2)}°）`).join('；') || '无符合当前容许度的相位';
    const transit = flow.transit ? `【行运快照】\n${flow.transit.points.map((p) => `${p.name}黄经${p.longitude.toFixed(2)}°，落本命第${p.natalHouse}宫${p.retrograde ? '，逆行' : ''}`).join('；')}\n${formatAspects(flow.transit.aspects)}` : '';
    const secondary = flow.secondary ? flow.secondary.status === 'calculated' ? `【次限】\n推进瞬时 ${flow.secondary.progressedUtcDateTime}；${flow.secondary.points.map((p) => `${p.name}${p.longitude.toFixed(2)}°`).join('；')}\n${formatAspects(flow.secondary.aspects)}` : `【次限】\n${flow.secondary.reason}` : '';
    const arc = flow.solarArc ? flow.solarArc.status === 'calculated' ? `【太阳弧】\n推进弧${flow.solarArc.arcDegrees.toFixed(4)}°；${flow.solarArc.points.map((p) => `${p.name}${p.longitude.toFixed(2)}°`).join('；')}\n${formatAspects(flow.solarArc.aspects)}` : `【太阳弧】\n${flow.solarArc.reason}` : '';
    const returns = flow.solarReturn ? flow.solarReturn.status === 'calculated' ? `【太阳返照】\n当前周期起点 ${flow.solarReturn.previousUtcDateTime ?? '出生时点附近未找到上一返照'}，下次 ${flow.solarReturn.nextUtcDateTime ?? '未找到'}；地点为${flow.solarReturn.location.meaning}（纬度${flow.solarReturn.location.latitude}°，经度${flow.solarReturn.location.longitude}°）。\n${flow.solarReturn.charts.map((c) => `返照 ${c.utcDateTime}：${c.houseSystem} 宫位；${c.points.map((p) => `${p.name}${p.longitude.toFixed(2)}°第${p.house}宫`).join('；')}\n四轴：${c.angles.map((p) => `${p.name}${p.longitude.toFixed(2)}°`).join('；')}\n盘内主要相位：${formatAspects(c.internalAspects, '')}\n返照对本命：${formatAspects(c.natalAspects)}${c.warnings.length ? `；星历警告${JSON.stringify(c.warnings)}` : ''}`).join('\n')}` : `【太阳返照】\n${flow.solarReturn.reason}` : '';
    const allPeriodEvents = flow.period?.events ?? [];
    const shownPeriodEvents = options?.eventDetail === 'summary' ? allPeriodEvents.slice(0, 20) : allPeriodEvents;
    const period = flow.period && renderOptions?.includePeriod !== false ? `【周期事件】\nUTC ${flow.period.page.start} 至 ${flow.period.page.end}（不含终点）；${flow.period.page.nextCursor ? `后续游标 ${flow.period.page.nextCursor}` : '本次范围已扫描完毕'}；共 ${allPeriodEvents.length} 项，列出 ${shownPeriodEvents.length} 项。\n${shownPeriodEvents.map((e) => `${e.localDateTime} UTC${e.timezone >= 0 ? '+' : ''}${e.timezone} ${astroEventLabels[e.kind]} ${e.movingName ?? ''}${e.targetName ? `→${e.kind === 'transit_aspect' ? '本命' : ''}${e.targetName}` : ''}${e.aspectName ?? ''}${e.sign ? `进入${e.sign}` : ''}${e.house ? `进入第${e.house}宫` : ''}${e.direction ? `（${astroEventDirections[e.direction] ?? e.direction}）` : ''}${e.phase ?? ''}${e.eclipse ? astroEclipseLabels[e.eclipse] ?? e.eclipse : ''}${e.touches?.length ? `；触及本命${e.touches.map((t) => `${t.pointName}${t.aspect}（偏差${t.deviation.toFixed(2)}°）`).join('、')}` : ''}`).join('\n') || '本页无所选事件。'}\n${flow.period.limitations.join('\n')}` : '';
    return [`【推运参考】\n${flow.reference.kind}，UTC ${flow.reference.utcDateTime}${flow.reference.localDateTime ? `，当地 ${flow.reference.localDateTime}` : ''}。`, transit, returns, secondary, arc, period, `【推运限制】\n${flow.limitations.join('\n')}`].filter(Boolean).join('\n\n');
  })() : '';
  const pointItems = [...data.points.map(pointLocation), ...data.derived.map(location)];
  const text = [`【西洋星盘本命】\n出生 UTC ${data.basis.utcDateTime}；${data.basis.houseSystem} 宫位制；${data.basis.dayChart ? '昼盘' : '夜盘'}。`,
    `【星体与计算点】\n${pointItems.join('；')}`,
    `【四轴与宫首】\n${data.angles.map(location).join('；')}\n${data.houses.map((item) => `${item.house}宫${item.sign}${item.degreeInSign.toFixed(2)}°`).join('；')}`,
    `【十二宫宫主星与飞宫】\n${houseRulerText}`,
    `【本命相位】\n${aspectText || '未发现符合阈值的相位。'}`,
    `【十大星体分布】\n元素：${distribution(data.distributions.elements)}\n模式：${distribution(data.distributions.modalities)}\n逆行：${data.distributions.retrograde.map((item) => item.name).join('、') || '无'}`, 
    `【十大星体格局】\n${patternText || '按当前相位及星群规则未发现格局。'}`,
    flowText,
    formatSchoolAlgorithmSection(evaluateAstrolabeSchoolAlgorithms(data, options?.schools)),
    schools ? `【解读口径】\n${schools}` : '', options?.topic ? `【关注主题】\n${topicLabels[options.topic]}` : '',
    formatAstrolabeClassics(options?.includeClassics),
    `【任务】\n依据列出的盘面解释问题，区分计算事实与占星诠释；对缺失资料明确说明，不虚构未提供的动态运限。`,
    `【限制】\n${data.limitations.join('\n')}${data.warnings.length ? `\n星历警告：${JSON.stringify(data.warnings)}` : ''}`,
    `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function astrolabeIndependent(input: Input, context?: RuntimeContext) {
  const data = await calculateAstrolabeIndependentData(input, context);
  return { data, summary: { title: '西洋星盘本命盘', lines: [`${data.basis.houseSystem} 宫位制`, `${data.points.length} 个星体与计算点，${data.aspects.length} 个相位`] }, prompt: renderAstrolabeIndependentData(data, input.question, input.prompt) };
}
export async function promptForSavedAstrolabeIndependent(data: unknown, source: Source, question: string, options?: Input['prompt'], context?: RuntimeContext) {
  const expected = await calculateAstrolabeIndependentData(source, context);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('星盘与保存的出生资料不一致。');
  return renderAstrolabeIndependentData(expected, question, options ?? source.prompt);
}
