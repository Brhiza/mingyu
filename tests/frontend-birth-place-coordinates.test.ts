import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBirthPlace } from 'mingyu-core/location';

import { resolveBirthPlaceCoordinates } from '../src/utils/core/birthPlaceCoordinates';

test('出生地表单应取同一区县行政中心的经纬度', () => {
  assert.deepEqual(resolveBirthPlaceCoordinates('460302'), {
    longitude: 112.346961,
    latitude: 16.834372,
    coordinateAccuracy: 'administrative-center',
  });
  assert.deepEqual(resolveBirthPlaceCoordinates('630224'), {
    longitude: 102.031294,
    latitude: 36.011257,
    coordinateAccuracy: 'administrative-center',
  });
  const returnedPlace = resolveBirthPlace('630224')!;
  Object.assign(returnedPlace.path.district!, { longitude: 0, latitude: 0 });
  assert.deepEqual(resolveBirthPlaceCoordinates('630224'), {
    longitude: 102.031294,
    latitude: 36.011257,
    coordinateAccuracy: 'administrative-center',
  });
});

test('无行政中心纬度时保留省级近似及精度标记', () => {
  assert.deepEqual(resolveBirthPlaceCoordinates('710246'), {
    longitude: 120.3120375,
    latitude: 23.6978,
    coordinateAccuracy: 'province-approximation',
  });
  assert.equal(resolveBirthPlaceCoordinates('999999'), null);
});
