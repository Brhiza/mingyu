import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chinaBirthPlaceTree,
  findBirthPlaceByDisplayName,
  findBirthPlaceByRegionId,
  getBirthPlaceCityOptions,
  getBirthPlaceDistrictOptions,
  getBirthPlaceProvinceOptions,
  isDistrictBirthPlacePath,
  resolveBirthPlaceApproximateLatitude,
  resolveBirthPlaceLongitude,
} from 'mingyu-location-china';

test('中国地点包应提供完整的省市区树和级联查询', () => {
  const provinces = getBirthPlaceProvinceOptions();
  const cities = provinces.flatMap((province) => province.cities);
  const districts = cities.flatMap((city) => city.districts);

  assert.equal(provinces, chinaBirthPlaceTree);
  assert.equal(provinces.length, 34);
  assert.equal(cities.length, 392);
  assert.equal(districts.length, 3210);
  assert.equal(getBirthPlaceCityOptions('11')[0]?.id, '1101');
  assert.equal(getBirthPlaceDistrictOptions('1101').length, 16);
  assert.deepEqual(getBirthPlaceCityOptions('不存在'), []);
  assert.deepEqual(getBirthPlaceDistrictOptions('不存在'), []);
});

test('中国地点包应支持行政区代码、显示名称和区县简称反查', () => {
  const byId = findBirthPlaceByRegionId('110101');
  const byDisplayName = findBirthPlaceByDisplayName('北京市 东城区');
  const byLabel = findBirthPlaceByDisplayName('东城区');

  assert.equal(byId?.province.label, '北京市');
  assert.equal(byId?.city?.label, '北京市');
  assert.equal(byId?.district?.label, '东城区');
  assert.equal(byDisplayName?.district?.id, '110101');
  assert.equal(byLabel?.district?.id, '110101');
  assert.equal(isDistrictBirthPlacePath(byId), true);
  assert.equal(findBirthPlaceByRegionId('999999'), null);
  assert.equal(findBirthPlaceByDisplayName('不存在的地点'), null);
  assert.equal(isDistrictBirthPlacePath(null), false);
});

test('中国地点包应返回经度并明确区分近似纬度回退', () => {
  assert.equal(resolveBirthPlaceLongitude('110101'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('北京市 东城区'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('不存在的地点'), null);
  assert.equal(resolveBirthPlaceApproximateLatitude('110101'), 39.9042);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999'), 35);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999', 0), 0);
});
