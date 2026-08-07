import {
  findBirthPlaceByDisplayName,
  findBirthPlaceByRegionId,
  getBirthPlaceCityOptions,
  getBirthPlaceDistrictOptions,
  getBirthPlaceProvinceOptions,
  isDistrictBirthPlacePath,
  type BirthPlaceCascadePath,
  type BirthPlaceCityOption,
  type BirthPlaceDistrictOption,
  type BirthPlaceProvinceOption,
} from 'mingyu-core/location';

export type { BirthPlaceCityOption, BirthPlaceDistrictOption, BirthPlaceProvinceOption };

type DistrictBirthPlaceCascadePath = BirthPlaceCascadePath & {
  city: BirthPlaceCityOption;
  district: BirthPlaceDistrictOption;
};

export { getBirthPlaceCityOptions, getBirthPlaceDistrictOptions, getBirthPlaceProvinceOptions };

function toDistrictPath(path: BirthPlaceCascadePath | null): DistrictBirthPlaceCascadePath | null {
  return isDistrictBirthPlacePath(path) && path.city ? path : null;
}

export function findBirthPlaceCascadeByDistrictId(
  districtId: string,
): DistrictBirthPlaceCascadePath | null {
  return toDistrictPath(findBirthPlaceByRegionId(districtId));
}

export function findBirthPlaceCascadeByDisplayName(
  displayName: string,
): DistrictBirthPlaceCascadePath | null {
  return toDistrictPath(findBirthPlaceByDisplayName(displayName));
}
