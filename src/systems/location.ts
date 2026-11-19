import chinaLocationsData from '../data/locations-cn.json' with { type: 'json' };

export type LocationLevel = 'province' | 'city' | 'district' | 'overseas';

export interface ChinaDistrictNode {
  name: string;
  longitude: number;
  latitude?: number;
}

export interface ChinaCityNode {
  name: string;
  longitude: number;
  latitude?: number;
  districts: readonly ChinaDistrictNode[];
}

export interface ChinaProvinceNode {
  name: string;
  longitude: number;
  latitude?: number;
  cities: readonly ChinaCityNode[];
}

interface ChinaLocationDataset {
  timezone: 8;
  provinces: readonly ChinaProvinceNode[];
}

export interface OverseasCityInput {
  name: string;
  country: string;
  aliases: readonly string[];
  timeZoneId: string;
  longitude: number;
  latitude: number;
}

export interface LocationEntry {
  name: string;
  displayName: string;
  level: LocationLevel;
  country: string;
  province?: string;
  city?: string;
  district?: string;
  longitude: number;
  latitude?: number;
  timezone?: number;
  timeZoneId?: string;
}

const CHINA_DATA = chinaLocationsData as ChinaLocationDataset;

/** 常见海外主要城市与华人聚居地列表（含 IANA 时区与经纬度）。 */
export const OVERSEAS_CITIES: readonly OverseasCityInput[] = [
  { name: '东京', country: '日本', aliases: ['Tokyo', 'とうきょう'], timeZoneId: 'Asia/Tokyo', longitude: 139.6917, latitude: 35.6895 },
  { name: '大阪', country: '日本', aliases: ['Osaka', 'おおさか'], timeZoneId: 'Asia/Tokyo', longitude: 135.5023, latitude: 34.6937 },
  { name: '首尔', country: '韩国', aliases: ['Seoul', '汉城'], timeZoneId: 'Asia/Seoul', longitude: 126.978, latitude: 37.5665 },
  { name: '釜山', country: '韩国', aliases: ['Busan'], timeZoneId: 'Asia/Seoul', longitude: 129.0756, latitude: 35.1796 },
  { name: '新加坡', country: '新加坡', aliases: ['Singapore', '狮城'], timeZoneId: 'Asia/Singapore', longitude: 103.8198, latitude: 1.3521 },
  { name: '吉隆坡', country: '马来西亚', aliases: ['Kuala Lumpur', 'KL'], timeZoneId: 'Asia/Kuala_Lumpur', longitude: 101.6869, latitude: 3.139 },
  { name: '槟城', country: '马来西亚', aliases: ['Penang', '乔治市'], timeZoneId: 'Asia/Kuala_Lumpur', longitude: 100.3327, latitude: 5.4164 },
  { name: '曼谷', country: '泰国', aliases: ['Bangkok'], timeZoneId: 'Asia/Bangkok', longitude: 100.5018, latitude: 13.7563 },
  { name: '清迈', country: '泰国', aliases: ['Chiang Mai'], timeZoneId: 'Asia/Bangkok', longitude: 98.9853, latitude: 18.7883 },
  { name: '雅加达', country: '印度尼西亚', aliases: ['Jakarta'], timeZoneId: 'Asia/Jakarta', longitude: 106.8456, latitude: -6.2088 },
  { name: '马尼拉', country: '菲律宾', aliases: ['Manila'], timeZoneId: 'Asia/Manila', longitude: 120.9842, latitude: 14.5995 },
  { name: '胡志明市', country: '越南', aliases: ['Ho Chi Minh City', '西贡', 'Saigon'], timeZoneId: 'Asia/Ho_Chi_Minh', longitude: 106.6297, latitude: 10.8231 },
  { name: '河内', country: '越南', aliases: ['Hanoi'], timeZoneId: 'Asia/Ho_Chi_Minh', longitude: 105.8342, latitude: 21.0278 },
  { name: '迪拜', country: '阿联酋', aliases: ['Dubai'], timeZoneId: 'Asia/Dubai', longitude: 55.2708, latitude: 25.2048 },
  { name: '悉尼', country: '澳大利亚', aliases: ['Sydney', '雪梨'], timeZoneId: 'Australia/Sydney', longitude: 151.2093, latitude: -33.8688 },
  { name: '墨尔本', country: '澳大利亚', aliases: ['Melbourne'], timeZoneId: 'Australia/Melbourne', longitude: 144.9631, latitude: -37.8136 },
  { name: '布里斯班', country: '澳大利亚', aliases: ['Brisbane'], timeZoneId: 'Australia/Brisbane', longitude: 153.0251, latitude: -27.4698 },
  { name: '珀斯', country: '澳大利亚', aliases: ['Perth'], timeZoneId: 'Australia/Perth', longitude: 115.8605, latitude: -31.9505 },
  { name: '奥克兰', country: '新西兰', aliases: ['Auckland'], timeZoneId: 'Pacific/Auckland', longitude: 174.7633, latitude: -36.8485 },
  { name: '伦敦', country: '英国', aliases: ['London'], timeZoneId: 'Europe/London', longitude: -0.1276, latitude: 51.5072 },
  { name: '巴黎', country: '法国', aliases: ['Paris'], timeZoneId: 'Europe/Paris', longitude: 2.3522, latitude: 48.8566 },
  { name: '法兰克福', country: '德国', aliases: ['Frankfurt'], timeZoneId: 'Europe/Berlin', longitude: 8.6821, latitude: 50.1109 },
  { name: '柏林', country: '德国', aliases: ['Berlin'], timeZoneId: 'Europe/Berlin', longitude: 13.405, latitude: 52.52 },
  { name: '慕尼黑', country: '德国', aliases: ['Munich'], timeZoneId: 'Europe/Berlin', longitude: 11.582, latitude: 48.1351 },
  { name: '阿姆斯特丹', country: '荷兰', aliases: ['Amsterdam'], timeZoneId: 'Europe/Amsterdam', longitude: 4.9041, latitude: 52.3676 },
  { name: '米兰', country: '意大利', aliases: ['Milan'], timeZoneId: 'Europe/Rome', longitude: 9.19, latitude: 45.4642 },
  { name: '马德里', country: '西班牙', aliases: ['Madrid'], timeZoneId: 'Europe/Madrid', longitude: -3.7038, latitude: 40.4168 },
  { name: '莫斯科', country: '俄罗斯', aliases: ['Moscow'], timeZoneId: 'Europe/Moscow', longitude: 37.6173, latitude: 55.7558 },
  { name: '纽约', country: '美国', aliases: ['New York', 'NYC'], timeZoneId: 'America/New_York', longitude: -74.006, latitude: 40.7128 },
  { name: '波士顿', country: '美国', aliases: ['Boston'], timeZoneId: 'America/New_York', longitude: -71.0589, latitude: 42.3601 },
  { name: '芝加哥', country: '美国', aliases: ['Chicago'], timeZoneId: 'America/Chicago', longitude: -87.6298, latitude: 41.8781 },
  { name: '休斯顿', country: '美国', aliases: ['Houston'], timeZoneId: 'America/Chicago', longitude: -95.3698, latitude: 29.7604 },
  { name: '旧金山', country: '美国', aliases: ['San Francisco', '三藩市', 'SF'], timeZoneId: 'America/Los_Angeles', longitude: -122.4194, latitude: 37.7749 },
  { name: '洛杉矶', country: '美国', aliases: ['Los Angeles', 'LA'], timeZoneId: 'America/Los_Angeles', longitude: -118.2437, latitude: 34.0522 },
  { name: '西雅图', country: '美国', aliases: ['Seattle'], timeZoneId: 'America/Los_Angeles', longitude: -122.3321, latitude: 47.6062 },
  { name: '檀香山', country: '美国', aliases: ['Honolulu', '火奴鲁鲁'], timeZoneId: 'Pacific/Honolulu', longitude: -157.8583, latitude: 21.3069 },
  { name: '温哥华', country: '加拿大', aliases: ['Vancouver'], timeZoneId: 'America/Vancouver', longitude: -123.1207, latitude: 49.2827 },
  { name: '多伦多', country: '加拿大', aliases: ['Toronto'], timeZoneId: 'America/Toronto', longitude: -79.3832, latitude: 43.6532 },
  { name: '蒙特利尔', country: '加拿大', aliases: ['Montreal'], timeZoneId: 'America/Toronto', longitude: -73.5673, latitude: 45.5017 },
];

interface IndexedLocation {
  entry: LocationEntry;
  terms: readonly string[];
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s·,，/]+/g, '');
}

const REGION_SUFFIX_RE = /(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市|区|县)$/;

function stripRegionSuffix(value: string): string {
  return value.trim().replace(REGION_SUFFIX_RE, '');
}

function matchRegionName<T extends { name: string }>(items: readonly T[], target: string): T | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;
  const exact = items.find((item) => item.name === trimmed);
  if (exact) return exact;
  const strippedTarget = stripRegionSuffix(trimmed);
  if (!strippedTarget) return undefined;
  const matches = items.filter((item) => stripRegionSuffix(item.name) === strippedTarget);
  return matches.length === 1 ? matches[0] : undefined;
}

function buildChinaDisplayName(province: string, city?: string, district?: string): string {
  const parts = [province];
  if (city && city !== province) parts.push(city);
  if (district && district !== city) parts.push(district);
  return parts.join(' ');
}

function toChinaEntry(
  province: ChinaProvinceNode,
  city?: ChinaCityNode,
  district?: ChinaDistrictNode,
): LocationEntry {
  const node = district ?? city ?? province;
  const level: LocationLevel = district ? 'district' : city ? 'city' : 'province';
  const latitude = node.latitude ?? city?.latitude ?? province.latitude;
  return {
    name: node.name,
    displayName: buildChinaDisplayName(province.name, city?.name, district?.name),
    level,
    country: '中国',
    province: province.name,
    ...(city ? { city: city.name } : {}),
    ...(district ? { district: district.name } : {}),
    longitude: node.longitude,
    ...(latitude !== undefined ? { latitude } : {}),
    timezone: CHINA_DATA.timezone,
  };
}

function toOverseasEntry(item: OverseasCityInput): LocationEntry {
  return {
    name: item.name,
    displayName: `${item.country} ${item.name}`,
    level: 'overseas',
    country: item.country,
    city: item.name,
    longitude: item.longitude,
    latitude: item.latitude,
    timeZoneId: item.timeZoneId,
  };
}

const SEARCH_INDEX: readonly IndexedLocation[] = (() => {
  const list: IndexedLocation[] = [];
  for (const province of CHINA_DATA.provinces) {
    const pEntry = toChinaEntry(province);
    list.push({ entry: pEntry, terms: [pEntry.name, pEntry.displayName].map(normalizeText) });
    for (const city of province.cities) {
      const cEntry = toChinaEntry(province, city);
      list.push({
        entry: cEntry,
        terms: [cEntry.name, cEntry.displayName, `${province.name}${city.name}`].map(normalizeText),
      });
      for (const district of city.districts) {
        const dEntry = toChinaEntry(province, city, district);
        list.push({
          entry: dEntry,
          terms: [
            dEntry.name,
            dEntry.displayName,
            `${province.name}${city.name}${district.name}`,
            `${city.name}${district.name}`,
          ].map(normalizeText),
        });
      }
    }
  }
  for (const overseas of OVERSEAS_CITIES) {
    const oEntry = toOverseasEntry(overseas);
    list.push({
      entry: oEntry,
      terms: [overseas.name, oEntry.displayName, overseas.country, ...overseas.aliases].map(normalizeText),
    });
  }
  return list;
})();

function scoreMatch(terms: readonly string[], query: string): number | null {
  for (let i = 0; i < terms.length; i++) {
    if (terms[i] === query) return i === 0 ? 0 : 1;
  }
  for (let i = 0; i < terms.length; i++) {
    if (terms[i].startsWith(query)) return i === 0 ? 2 : 3;
  }
  for (let i = 0; i < terms.length; i++) {
    if (terms[i].includes(query)) return i === 0 ? 4 : 5;
  }
  return null;
}

const LEVEL_RANK: Record<LocationLevel, number> = {
  overseas: 0,
  province: 1,
  city: 2,
  district: 3,
};

/** 返回中国省级行政区列表。 */
export function getChinaProvinceOptions(): readonly ChinaProvinceNode[] {
  return CHINA_DATA.provinces;
}

/** 返回指定省级行政区下的地级市/区列表。 */
export function getChinaCityOptions(provinceName: string): readonly ChinaCityNode[] {
  return matchRegionName(CHINA_DATA.provinces, provinceName)?.cities ?? [];
}

/** 返回指定省、市下的区县列表。 */
export function getChinaDistrictOptions(provinceName: string, cityName: string): readonly ChinaDistrictNode[] {
  const province = matchRegionName(CHINA_DATA.provinces, provinceName);
  if (!province) return [];
  return matchRegionName(province.cities, cityName)?.districts ?? [];
}

/** 返回内置的常见海外城市列表。 */
export function getOverseasLocations(): LocationEntry[] {
  return OVERSEAS_CITIES.map(toOverseasEntry);
}

/** 按中文名、英文名、别名或省市区路径模糊搜索地点，返回经纬度与时区信息。 */
export function searchLocations(query: string, limit = 20): LocationEntry[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const matches: Array<{ entry: LocationEntry; score: number }> = [];
  for (const item of SEARCH_INDEX) {
    const score = scoreMatch(item.terms, normalized);
    if (score !== null) matches.push({ entry: item.entry, score });
  }
  matches.sort(
    (a, b) =>
      a.score - b.score ||
      LEVEL_RANK[a.entry.level] - LEVEL_RANK[b.entry.level] ||
      a.entry.displayName.localeCompare(b.entry.displayName, 'zh-CN'),
  );
  return matches.slice(0, safeLimit).map((item) => ({ ...item.entry }));
}

function matchOverseas(query: string): LocationEntry | null {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  const found = OVERSEAS_CITIES.find(
    (item) =>
      normalizeText(item.name) === normalized ||
      item.aliases.some((alias) => normalizeText(alias) === normalized),
  );
  return found ? toOverseasEntry(found) : null;
}

/** 根据省、市、区县（或海外城市名）精确反查经纬度与时区。 */
export function resolveLocationCoordinates(
  provinceOrCity: string,
  city?: string,
  district?: string,
): LocationEntry | null {
  const first = provinceOrCity?.trim();
  if (!first) return null;

  const province = matchRegionName(CHINA_DATA.provinces, first);
  if (province) {
    const second = city?.trim();
    const third = district?.trim();
    if (!second && !third) return toChinaEntry(province);

    if (second) {
      const matchedCity = matchRegionName(province.cities, second);
      if (matchedCity) {
        if (!third) return toChinaEntry(province, matchedCity);
        const matchedDistrict = matchRegionName(matchedCity.districts, third);
        return matchedDistrict ? toChinaEntry(province, matchedCity, matchedDistrict) : null;
      }
      // 兼容直辖市直接传 (province, district) 的简写，例如 ('北京市', '朝阳区')
      if (!third) {
        for (const c of province.cities) {
          const matchedDistrict = matchRegionName(c.districts, second);
          if (matchedDistrict) return toChinaEntry(province, c, matchedDistrict);
        }
      }
      return null;
    }

    if (third) {
      for (const c of province.cities) {
        const matchedDistrict = matchRegionName(c.districts, third);
        if (matchedDistrict) return toChinaEntry(province, c, matchedDistrict);
      }
    }
    return null;
  }

  // 未传省名时，支持直接按海外城市名（或 国家 + 城市）查找
  if (!district) {
    if (!city) return matchOverseas(first);
    const overseas = matchOverseas(city);
    if (overseas && normalizeText(overseas.country) === normalizeText(first)) return overseas;
  }
  return null;
}
