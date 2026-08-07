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
  resolveBirthPlace,
  resolveBirthPlaceApproximateLatitude,
  resolveBirthPlaceLongitude,
  searchBirthPlaces,
} from 'mingyu-core/location';

test('核心包应内置完整的中国省市区树和级联查询', () => {
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

test('核心包地点能力应支持行政区代码、显示名称和区县简称反查', () => {
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

test('核心包地点能力应返回经度并明确区分近似纬度回退', () => {
  assert.equal(resolveBirthPlaceLongitude('110101'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('北京市 东城区'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('不存在的地点'), null);
  assert.equal(resolveBirthPlaceApproximateLatitude('110101'), 39.9042);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999'), 35);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999', 0), 0);
});

test('核心包地点能力应提供区县行政中心纬度和坐标精度', () => {
  const dongcheng = resolveBirthPlace('110101');
  const taiwanDistrict = resolveBirthPlace('710246');

  assert.equal(dongcheng?.displayName, '北京市 东城区');
  assert.equal(dongcheng?.latitude, 39.928359);
  assert.equal(dongcheng?.coordinateAccuracy, 'administrative-center');
  assert.equal(dongcheng?.timezone, 8);
  assert.equal(taiwanDistrict?.latitude, 23.6978);
  assert.equal(taiwanDistrict?.coordinateAccuracy, 'province-approximation');
});

test('地点搜索应支持拼音和代码，并保留重名区县的完整路径', () => {
  const byPinyin = searchBirthPlaces('dong cheng', { levels: ['district'] });
  const byCode = searchBirthPlaces('110101');
  const duplicated = searchBirthPlaces('鼓楼区', { levels: ['district'], limit: 20 });

  assert.equal(byPinyin[0]?.regionId, '110101');
  assert.equal(byCode[0]?.displayName, '北京市 东城区');
  assert.deepEqual(
    new Set(duplicated.map((item) => item.regionId)),
    new Set(['350102', '410204', '320106', '320302']),
  );
  assert.equal(new Set(duplicated.map((item) => item.displayName)).size, 4);
});

test('重名地点简称不应静默解析为任意首项', () => {
  assert.equal(findBirthPlaceByDisplayName('鼓楼区'), null);
  assert.equal(resolveBirthPlace('鼓楼区'), null);
  assert.equal(resolveBirthPlaceLongitude('鼓楼区'), null);
  assert.equal(findBirthPlaceByDisplayName('福建省 福州市 鼓楼区')?.district?.id, '350102');
  assert.equal(resolveBirthPlace('福建省 福州市 鼓楼区')?.regionId, '350102');
});
