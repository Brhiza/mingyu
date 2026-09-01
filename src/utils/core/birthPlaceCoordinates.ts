import { resolveBirthPlaceApproximateLatitude } from '@temposoul/core/location';

export function resolveBirthPlaceLatitude(placeId: string): number {
  return resolveBirthPlaceApproximateLatitude(placeId);
}
