import { CHINA_BIRTH_PLACE_TREE_DATA } from './china-data.js';

/**
 * 地点树索引能力。
 *
 * 内置中国省市区与经度数据，同时允许调用方传入自己的地点树，
 * 复用统一的级联查询、路径反查和经度读取逻辑。
 */

export interface BirthPlaceDistrictOption {
  id: string;
  label: string;
  displayName: string;
  pinyin?: string;
  longitude: number;
  [key: string]: unknown;
}

export interface BirthPlaceCityOption {
  id: string;
  label: string;
  displayName: string;
  pinyin?: string;
  longitude: number;
  districts: readonly BirthPlaceDistrictOption[];
  [key: string]: unknown;
}

export interface BirthPlaceProvinceOption {
  id: string;
  label: string;
  displayName?: string;
  pinyin?: string;
  longitude: number;
  cities: readonly BirthPlaceCityOption[];
  [key: string]: unknown;
}

export interface BirthPlaceCascadePath {
  province: BirthPlaceProvinceOption;
  city?: BirthPlaceCityOption;
  district?: BirthPlaceDistrictOption;
}

export interface BirthPlaceIndex {
  getProvinceOptions(): readonly BirthPlaceProvinceOption[];
  getCityOptions(provinceId: string): readonly BirthPlaceCityOption[];
  getDistrictOptions(cityId: string): readonly BirthPlaceDistrictOption[];
  findByRegionId(regionId: string): BirthPlaceCascadePath | null;
  findByDisplayName(displayName: string): BirthPlaceCascadePath | null;
  resolveLongitude(regionIdOrDisplayName: string): number | null;
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

/** 从任意省市区树创建地点索引。 */
export function createBirthPlaceIndex(tree: readonly BirthPlaceProvinceOption[]): BirthPlaceIndex {
  const regionPathById = new Map<string, BirthPlaceCascadePath>();
  const pathByDisplayName = new Map<string, BirthPlaceCascadePath>();

  for (const province of tree) {
    const provincePath = { province } satisfies BirthPlaceCascadePath;
    regionPathById.set(normalizeKey(province.id), provincePath);
    pathByDisplayName.set(normalizeKey(province.label), provincePath);
    if (province.displayName) {
      pathByDisplayName.set(normalizeKey(province.displayName), provincePath);
    }

    for (const city of province.cities) {
      const cityPath = { province, city } satisfies BirthPlaceCascadePath;
      regionPathById.set(normalizeKey(city.id), cityPath);
      pathByDisplayName.set(normalizeKey(city.displayName), cityPath);
      pathByDisplayName.set(normalizeKey(city.label), cityPath);

      for (const district of city.districts) {
        const districtPath = { province, city, district } satisfies BirthPlaceCascadePath;
        regionPathById.set(normalizeKey(district.id), districtPath);
        pathByDisplayName.set(normalizeKey(district.displayName), districtPath);
        pathByDisplayName.set(normalizeKey(district.label), districtPath);
      }
    }
  }

  return {
    getProvinceOptions: () => tree,
    getCityOptions: (provinceId) =>
      tree.find((province) => normalizeKey(province.id) === normalizeKey(provinceId))?.cities ?? [],
    getDistrictOptions: (cityId) => {
      for (const province of tree) {
        const city = province.cities.find((item) => normalizeKey(item.id) === normalizeKey(cityId));
        if (city) return city.districts;
      }
      return [];
    },
    findByRegionId: (regionId) => regionPathById.get(normalizeKey(regionId)) ?? null,
    findByDisplayName: (displayName) => pathByDisplayName.get(normalizeKey(displayName)) ?? null,
    resolveLongitude: (regionIdOrDisplayName) => {
      const byId = regionPathById.get(normalizeKey(regionIdOrDisplayName));
      if (byId) {
        return byId.district?.longitude ?? byId.city?.longitude ?? byId.province.longitude;
      }
      const byName = pathByDisplayName.get(normalizeKey(regionIdOrDisplayName));
      return byName
        ? (byName.district?.longitude ?? byName.city?.longitude ?? byName.province.longitude)
        : null;
    },
  };
}

/** 中国省、市、区出生地点树。当前数据提供行政区名称、拼音和经度。 */
export const chinaBirthPlaceTree: readonly BirthPlaceProvinceOption[] = CHINA_BIRTH_PLACE_TREE_DATA;

/** 预先构建的中国地点索引，可直接做级联、反查和经度解析。 */
export const chinaBirthPlaceIndex: BirthPlaceIndex = createBirthPlaceIndex(chinaBirthPlaceTree);

export function getBirthPlaceProvinceOptions() {
  return chinaBirthPlaceIndex.getProvinceOptions();
}

export function getBirthPlaceCityOptions(provinceId: string) {
  return chinaBirthPlaceIndex.getCityOptions(provinceId);
}

export function getBirthPlaceDistrictOptions(cityId: string) {
  return chinaBirthPlaceIndex.getDistrictOptions(cityId);
}

export function findBirthPlaceByRegionId(regionId: string): BirthPlaceCascadePath | null {
  return chinaBirthPlaceIndex.findByRegionId(regionId);
}

export function findBirthPlaceByDisplayName(displayName: string): BirthPlaceCascadePath | null {
  return chinaBirthPlaceIndex.findByDisplayName(displayName);
}

export function resolveBirthPlaceLongitude(regionIdOrDisplayName: string): number | null {
  return chinaBirthPlaceIndex.resolveLongitude(regionIdOrDisplayName);
}

const PROVINCE_APPROXIMATE_LATITUDE_BY_ID_PREFIX: Readonly<Record<string, number>> = {
  '11': 39.9042,
  '12': 39.3434,
  '13': 38.0428,
  '14': 37.8706,
  '15': 40.8175,
  '21': 41.8057,
  '22': 43.8171,
  '23': 45.8038,
  '31': 31.2304,
  '32': 32.0603,
  '33': 30.2741,
  '34': 31.8206,
  '35': 26.0745,
  '36': 28.682,
  '37': 36.6512,
  '41': 34.7466,
  '42': 30.5928,
  '43': 28.2282,
  '44': 23.1291,
  '45': 22.817,
  '46': 20.044,
  '50': 29.563,
  '51': 30.5728,
  '52': 26.647,
  '53': 25.0389,
  '54': 29.652,
  '61': 34.3416,
  '62': 36.0611,
  '63': 36.6171,
  '64': 38.4872,
  '65': 43.8256,
};

/**
 * 返回省会级近似纬度，仅用于现有缺少区县纬度时的兼容回退。
 * 精确星盘计算应由调用方提供真实纬度，不能把这个值当作区县坐标。
 */
export function resolveBirthPlaceApproximateLatitude(regionId: string, fallback = 35): number {
  return PROVINCE_APPROXIMATE_LATITUDE_BY_ID_PREFIX[regionId.slice(0, 2)] ?? fallback;
}

/** 确认查询结果包含区县节点，便于表单从通用路径收窄类型。 */
export function isDistrictBirthPlacePath(
  path: BirthPlaceCascadePath | null,
): path is BirthPlaceCascadePath & {
  city: BirthPlaceCityOption;
  district: BirthPlaceDistrictOption;
} {
  return Boolean(path?.city && path.district);
}
