/**
 * 地点树索引能力。
 *
 * 核心包不内置具体国家或地区数据，调用方可以把自己的省市区树传入，
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
