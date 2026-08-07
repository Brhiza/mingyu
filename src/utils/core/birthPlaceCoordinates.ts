import { resolveBirthPlaceApproximateLatitude } from 'mingyu-core/location';

export function resolveBirthPlaceLatitude(placeId: string): number {
  return resolveBirthPlaceApproximateLatitude(placeId);
}
