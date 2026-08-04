import type { LiurenClassicalRule } from '../../../../types/divination';

const MAIN_SOURCE = '《大六壬大全》九宗门取传法';
const SHEHAI_SOURCE = '《六壬指南》涉害取法及《六壬大全》涉害课';

const RULES: Array<LiurenClassicalRule & { match: RegExp }> = [
  {
    match: /返吟.*重审/,
    source: MAIN_SOURCE,
    rule: '返吟重审',
    category: '返吟课兼四课下贼上',
    summary: '天盘与地盘相冲为返吟；若四课见下贼上，仍从重审口径取发用。',
  },
  {
    match: /返吟(?!重审)/,
    source: MAIN_SOURCE,
    rule: '返吟',
    category: '返吟课',
    summary: '天盘十二位与地盘逐位相冲；有克仍依贼克取传，无克另按井栏射取传。',
  },
  {
    match: /伏吟/,
    source: MAIN_SOURCE,
    rule: '伏吟',
    category: '伏吟课',
    summary: '天盘十二位与地盘同位；有克仍依贼克取传，无克按刚日取干上、柔日取支上起传。',
  },
  {
    match: /遥克/,
    source: MAIN_SOURCE,
    rule: '遥克',
    category: '遥克法',
    summary:
      '四课无直接上下克时，取二三四课上神与日干遥相克者；上神克日干为蒿矢，日干克上神为弹射，多候选再依比用、涉害次序取发用。',
  },
  {
    match: /重审/,
    source: MAIN_SOURCE,
    rule: '重审',
    category: '贼克法',
    summary: '四课只有一处下贼上，以下贼上之上神为初传发用。',
  },
  {
    match: /元首/,
    source: MAIN_SOURCE,
    rule: '元首',
    category: '贼克法',
    summary: '四课只有一处上克下，以上克下之上神为初传发用。',
  },
  {
    match: /贼克|克法/,
    source: MAIN_SOURCE,
    rule: '贼克',
    category: '贼克法',
    summary: '四课先察上下相克；下克上为重审，上克下为元首，多处再转比用、涉害。',
  },
  {
    match: /比用/,
    source: MAIN_SOURCE,
    rule: '知一/比用',
    category: '知一法',
    summary: '贼克或遥克候选不止一处时，取与日干阴阳同类的上神发用。',
  },
  {
    match: /涉害/,
    source: SHEHAI_SOURCE,
    rule: '涉害',
    category: '涉害法',
    summary:
      '多处贼克且阴阳比用候选仍有多支时，先比较各上神归本家途中所受克的深浅；复等先按阳日干上、阴日支上取先见神，无法复等再取四孟、四仲、四季上神。',
  },
  {
    match: /昴星/,
    source: MAIN_SOURCE,
    rule: '昴星',
    category: '昴星法',
    summary: '四课无克又无遥克时，按阳日虎视、阴日冬蛇掩目的口径取用。',
  },
  {
    match: /别责/,
    source: MAIN_SOURCE,
    rule: '别责',
    category: '别责法',
    summary: '课象不备而仍需取传时，阳日取合干上神，阴日取支前三合发用。',
  },
  {
    match: /八专/,
    source: MAIN_SOURCE,
    rule: '八专',
    category: '八专法',
    summary: '干支同位、四课不全时，按八专阳顺阴逆取发用。',
  },
];

export function resolveLiurenClassicalRules(rule?: string) {
  if (!rule) {
    return [];
  }

  return RULES.filter((item) => item.match.test(rule)).map(({ match: _match, ...item }) => item);
}
