import { resolveBirthPlace } from 'mingyu-core/location';

export function resolveBirthPlaceCoordinates(placeId: string) {
  const place = resolveBirthPlace(placeId);
  if (!place) return null;
  return {
    longitude: place.longitude,
    latitude: place.latitude,
    coordinateAccuracy: place.coordinateAccuracy,
  };
}
