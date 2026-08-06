import { resolveBirthPlaceApproximateLatitude } from 'mingyu-location-china';

export function resolveBirthPlaceLatitude(placeId: string): number {
  return resolveBirthPlaceApproximateLatitude(placeId);
}
