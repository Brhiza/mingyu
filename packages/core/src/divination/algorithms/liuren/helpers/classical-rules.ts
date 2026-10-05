import type { LiurenClassicalRule } from '../../../../types/divination';

const MAIN_SOURCE = '《大六壬大全》九宗门取传法';
const SHEHAI_SOURCE = '《六壬指南》涉害取法及《六壬大全》涉害课';

const RULES: Array<LiurenClassicalRule & { match: RegExp }> = [
  {
    match: /返吟.*重审/,
    source: MAIN_SOURCE,
    rule: '返吟重审',
    category: '返吟课兼四课下贼上',
    summary: '天盘与地盘相冲；四课见下贼上，按重审取发用。',
  },
  {
    match: /^返吟法$/,
    source: MAIN_SOURCE,
    rule: '返吟',
    category: '返吟课',
    summary: '天盘十二位与地盘逐位相冲；四课无克，以日支驿马发用，支上与干上为中末传。',
  },
  {
    match: /^返吟(?:元首|比用|涉害)法$/,
    source: MAIN_SOURCE,
    rule: '返吟',
    category: '返吟课',
    summary: '天盘十二位与地盘逐位相冲；四课有克，依本课选定的克法取发用。',
  },
  {
    match: /^伏吟法$/,
    source: MAIN_SOURCE,
    rule: '伏吟',
    category: '伏吟课',
    summary: '天盘十二位与地盘同位；四课无克，刚日从干上、柔日从支上发用，再按三刑推进中末传。',
  },
  {
    match: /^伏吟(?:重审|元首|比用|涉害)法$/,
    source: MAIN_SOURCE,
    rule: '伏吟',
    category: '伏吟课',
    summary: '天盘十二位与地盘同位；四课有克，依本课选定的克法发用，再按三刑推进中末传。',
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
    summary: '四课下贼上候选只有一个不同上神，以该上神为初传发用。',
  },
  {
    match: /元首/,
    source: MAIN_SOURCE,
    rule: '元首',
    category: '贼克法',
    summary: '四课上克下候选只有一个不同上神，以该上神为初传发用。',
  },
  {
    match: /贼克/,
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
      '多个相克候选经阴阳比用后仍未唯一时，先比较各上神归本家途中所受克的深浅；深浅相同按所临地盘的四孟、四仲、四季取舍，复等再按阳日干上、阴日支上取先见神。',
  },
  {
    match: /昴星/,
    source: MAIN_SOURCE,
    rule: '昴星',
    category: '昴星法',
    summary:
      '四课全备且无上下克、无遥克；阳日初传取地盘酉上神，中传支上、末传干上；阴日初传取天盘酉下神，中传干上、末传支上。',
  },
  {
    match: /别责/,
    source: MAIN_SOURCE,
    rule: '别责',
    category: '别责法',
    summary:
      '四课不全而三课备，无上下克、无遥克；阳日取合干寄宫上神，阴日取日支前三合支本身为初传，中末均取干上神。',
  },
  {
    match: /八专/,
    source: MAIN_SOURCE,
    rule: '八专',
    category: '八专法',
    summary:
      '甲寅、庚申、丁未、己未、癸丑日干支同位；有上下克先取克，无克按八专取传：阳日从干上神顺数三位，阴日从第四课上神逆数三位，连本位数，中末均取干上神。',
  },
];

export function resolveLiurenClassicalRules(rule?: string) {
  if (!rule) {
    return [];
  }

  return RULES.filter((item) => item.match.test(rule)).map(({ match: _match, ...item }) => item);
}
