import {
  closePlaceModalSession,
  isPlaceModalSessionOpen,
  openPlaceModalSession,
} from '../app/modal-bus';
import {
  getChinaProvinceOptions,
  OVERSEAS_CITIES,
  type ChinaCityNode,
  type ChinaDistrictNode,
  type ChinaProvinceNode,
  type OverseasCityInput,
} from '../systems/location';

export interface CascadeDistrictOption {
  id: string;
  label: string;
  displayName: string;
  provinceId: string;
  provinceLabel: string;
  cityId: string;
  cityLabel: string;
  longitude: number;
  latitude: number;
  timezone?: number;
  timeZoneId?: string;
  isOverseas?: boolean;
  searchTerms: string;
}

export interface CascadeCityOption {
  id: string;
  label: string;
  provinceId: string;
  provinceLabel: string;
  longitude: number;
  latitude: number;
  districts: readonly CascadeDistrictOption[];
}

export interface CascadeProvinceOption {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  isOverseas?: boolean;
  cities: readonly CascadeCityOption[];
}

export interface BirthPlaceSelection {
  displayName: string;
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  longitude: number;
  latitude: number;
  timezone?: number;
  timeZoneId?: string;
  isOverseas?: boolean;
}

export interface BirthPlaceModalOptions {
  purpose?: 'birth' | 'observer';
  backdropClassName?: string;
  initialPlace?: string;
  initialDistrictId?: string;
  container?: HTMLElement;
  onConfirm?: (selection: BirthPlaceSelection) => void;
  onClose?: () => void;
}

export interface BirthPlaceModalController {
  open: (options?: Partial<BirthPlaceModalOptions>) => void;
  close: () => void;
  destroy: () => void;
  isOpen: () => boolean;
}

function buildChinaDisplayName(province: string, city: string, district: string): string {
  const parts = [province];
  if (city && city !== province) parts.push(city);
  if (district && district !== city) parts.push(district);
  return parts.join(' ');
}

interface CascadeIndex {
  provinces: readonly CascadeProvinceOption[];
  districtById: ReadonlyMap<string, CascadeDistrictOption>;
  districtByDisplayName: ReadonlyMap<string, CascadeDistrictOption>;
  allDistricts: readonly CascadeDistrictOption[];
}

let cachedCascadeIndex: CascadeIndex | null = null;

export function getBirthPlaceCascadeIndex(): CascadeIndex {
  if (cachedCascadeIndex) return cachedCascadeIndex;

  const provinces: CascadeProvinceOption[] = [];
  const districtById = new Map<string, CascadeDistrictOption>();
  const districtByDisplayName = new Map<string, CascadeDistrictOption>();
  const allDistricts: CascadeDistrictOption[] = [];

  const rawProvinces: readonly ChinaProvinceNode[] = getChinaProvinceOptions();

  for (const prov of rawProvinces) {
    const provId = prov.name;
    const provLat = prov.latitude ?? 35;
    const cities: CascadeCityOption[] = [];

    for (const city of prov.cities) {
      const cityId = `${provId}__${city.name}`;
      const cityLat = city.latitude ?? provLat;
      const rawDistricts: readonly ChinaDistrictNode[] =
        city.districts.length > 0
          ? city.districts
          : [{ name: city.name, longitude: city.longitude, latitude: cityLat }];

      const districts: CascadeDistrictOption[] = rawDistricts.map((dist) => {
        const distId = `${cityId}__${dist.name}`;
        const displayName = buildChinaDisplayName(prov.name, city.name, dist.name);
        const item: CascadeDistrictOption = {
          id: distId,
          label: dist.name,
          displayName,
          provinceId: provId,
          provinceLabel: prov.name,
          cityId,
          cityLabel: city.name,
          longitude: dist.longitude,
          latitude: dist.latitude ?? cityLat,
          timezone: 8,
          searchTerms: [
            prov.name,
            city.name,
            dist.name,
            displayName,
            `${prov.name}${city.name}${dist.name}`,
          ]
            .join('|')
            .toLowerCase(),
        };
        districtById.set(distId, item);
        districtByDisplayName.set(displayName.toLowerCase(), item);
        districtByDisplayName.set(displayName.replace(/\s+/g, '').toLowerCase(), item);
        if (!districtByDisplayName.has(dist.name.toLowerCase())) {
          districtByDisplayName.set(dist.name.toLowerCase(), item);
        }
        allDistricts.push(item);
        return item;
      });

      cities.push({
        id: cityId,
        label: city.name,
        provinceId: provId,
        provinceLabel: prov.name,
        longitude: city.longitude,
        latitude: cityLat,
        districts,
      });
    }

    provinces.push({
      id: provId,
      label: prov.name,
      longitude: prov.longitude,
      latitude: provLat,
      cities,
    });
  }

  // 最后一项：海外城市（按国家分组为第二列，具体城市为第三列）
  const overseasByCountry = new Map<string, OverseasCityInput[]>();
  for (const item of OVERSEAS_CITIES) {
    const group = overseasByCountry.get(item.country);
    if (group) group.push(item);
    else overseasByCountry.set(item.country, [item]);
  }

  const overseasProvinceId = 'overseas';
  const overseasProvinceLabel = '海外城市';
  const overseasCities: CascadeCityOption[] = [];

  for (const [country, cityList] of overseasByCountry.entries()) {
    const cityId = `overseas__${country}`;
    const first = cityList[0];
    const districts: CascadeDistrictOption[] = cityList.map((entry) => {
      const distId = `${cityId}__${entry.name}`;
      const displayName = `${entry.country} ${entry.name}`;
      const item: CascadeDistrictOption = {
        id: distId,
        label: entry.name,
        displayName,
        provinceId: overseasProvinceId,
        provinceLabel: overseasProvinceLabel,
        cityId,
        cityLabel: country,
        longitude: entry.longitude,
        latitude: entry.latitude,
        timeZoneId: entry.timeZoneId,
        isOverseas: true,
        searchTerms: [
          overseasProvinceLabel,
          country,
          entry.name,
          displayName,
          ...entry.aliases,
        ]
          .join('|')
          .toLowerCase(),
      };
      districtById.set(distId, item);
      districtByDisplayName.set(displayName.toLowerCase(), item);
      districtByDisplayName.set(displayName.replace(/\s+/g, '').toLowerCase(), item);
      districtByDisplayName.set(entry.name.toLowerCase(), item);
      allDistricts.push(item);
      return item;
    });

    overseasCities.push({
      id: cityId,
      label: country,
      provinceId: overseasProvinceId,
      provinceLabel: overseasProvinceLabel,
      longitude: first.longitude,
      latitude: first.latitude,
      districts,
    });
  }

  provinces.push({
    id: overseasProvinceId,
    label: overseasProvinceLabel,
    longitude: 139.6917,
    latitude: 35.6895,
    isOverseas: true,
    cities: overseasCities,
  });

  cachedCascadeIndex = {
    provinces,
    districtById,
    districtByDisplayName,
    allDistricts,
  };
  return cachedCascadeIndex;
}

export function findCascadeDistrictByPlace(
  placeOrDistrictId: string | undefined,
): CascadeDistrictOption | null {
  if (!placeOrDistrictId) return null;
  const trimmed = placeOrDistrictId.trim();
  if (!trimmed) return null;
  const index = getBirthPlaceCascadeIndex();
  const byId = index.districtById.get(trimmed);
  if (byId) return byId;

  const lower = trimmed.toLowerCase();
  const byDisplay =
    index.districtByDisplayName.get(lower) ??
    index.districtByDisplayName.get(lower.replace(/[\s/·,，-]+/g, ''));
  if (byDisplay) return byDisplay;

  for (const dist of index.allDistricts) {
    if (dist.displayName.includes(trimmed) || trimmed.includes(dist.displayName)) {
      return dist;
    }
  }
  return null;
}

export function buildSelectionFromDistrict(district: CascadeDistrictOption): BirthPlaceSelection {
  return {
    displayName: district.displayName,
    provinceId: district.provinceId,
    provinceName: district.provinceLabel,
    cityId: district.cityId,
    cityName: district.cityLabel,
    districtId: district.id,
    districtName: district.label,
    longitude: district.longitude,
    latitude: district.latitude,
    ...(district.timezone !== undefined ? { timezone: district.timezone } : {}),
    ...(district.timeZoneId ? { timeZoneId: district.timeZoneId } : {}),
    ...(district.isOverseas ? { isOverseas: true } : {}),
  };
}

/**
 * 通过统一 React Radix Dialog 打开出生地 / 观测地三列级联选择器。
 */
export function createBirthPlaceModal(
  initialOptions: BirthPlaceModalOptions = {},
): BirthPlaceModalController {
  let currentOptions: BirthPlaceModalOptions = { ...initialOptions };
  let activeKey: number | undefined;

  function open(overrideOptions: Partial<BirthPlaceModalOptions> = {}): void {
    currentOptions = { ...currentOptions, ...overrideOptions };
    activeKey = openPlaceModalSession(currentOptions);
  }

  function close(): void {
    closePlaceModalSession(activeKey);
    activeKey = undefined;
  }

  return {
    open,
    close,
    destroy: close,
    isOpen: () => activeKey !== undefined && isPlaceModalSessionOpen(activeKey),
  };
}

/**
 * 快捷打开一次出生地/观测地三列级联选择弹窗。
 */
export function openBirthPlaceModal(options: BirthPlaceModalOptions): BirthPlaceModalController {
  const controller = createBirthPlaceModal(options);
  controller.open();
  return controller;
}
