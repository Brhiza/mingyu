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

  assert.deepEqual(provinces, chinaBirthPlaceTree);
  assert.notStrictEqual(provinces, chinaBirthPlaceTree);
  assert.equal(provinces.length, 34);
  assert.equal(cities.length, 392);
  assert.equal(districts.length, 3210);
  assert.equal(getBirthPlaceCityOptions('11')[0]?.id, '1101');
  assert.equal(getBirthPlaceDistrictOptions('1101').length, 16);
  assert.deepEqual(getBirthPlaceCityOptions('不存在'), []);
  assert.deepEqual(getBirthPlaceDistrictOptions('不存在'), []);

  const publicProvince = chinaBirthPlaceTree.find((province) => province.id === '11')!;
  const publicCity = publicProvince.cities.find((city) => city.id === '1101')!;
  const publicDistrict = publicCity.districts.find((district) => district.id === '110101')!;
  const originalCoordinates = [
    publicProvince.longitude,
    publicCity.longitude,
    publicDistrict.longitude,
  ] as const;
  const provinceOption = provinces.find((province) => province.id === '11')!;
  const cityOption = getBirthPlaceCityOptions('11').find((city) => city.id === '1101')!;
  const districtOption = getBirthPlaceDistrictOptions('1101').find(
    (district) => district.id === '110101',
  )!;
  const path = findBirthPlaceByRegionId('110101')!;
  const displayPath = findBirthPlaceByDisplayName('北京市 东城区')!;
  const searchResult = searchBirthPlaces('110101')[0]!;
  const resolved = resolveBirthPlace('110101')!;

  assert.equal(
    path.city,
    path.province.cities.find((city) => city.id === '1101'),
  );
  assert.equal(
    path.district,
    path.city?.districts.find((district) => district.id === '110101'),
  );

  const corruptPath = (resultPath: typeof path) => {
    Object.assign(resultPath.province, { longitude: 0 });
    if (resultPath.city) Object.assign(resultPath.city, { longitude: 0 });
    if (resultPath.district) Object.assign(resultPath.district, { longitude: 0 });
  };

  try {
    Object.assign(publicProvince, { longitude: 0 });
    Object.assign(publicCity, { longitude: 0 });
    Object.assign(publicDistrict, { longitude: 0 });
    Object.assign(provinceOption, { longitude: 0 });
    Object.assign(provinceOption.cities[0].districts[0], { longitude: 0 });
    Object.assign(cityOption, { longitude: 0 });
    Object.assign(cityOption.districts[0], { longitude: 0 });
    Object.assign(districtOption, { longitude: 0 });
    corruptPath(path);
    corruptPath(displayPath);
    corruptPath(searchResult.path);
    corruptPath(resolved.path);
    Object.assign(searchResult, { longitude: 0 });
    Object.assign(resolved, { longitude: 0 });

    assert.equal(
      getBirthPlaceProvinceOptions().find((province) => province.id === '11')?.longitude,
      originalCoordinates[0],
    );
    assert.equal(
      getBirthPlaceCityOptions('11').find((city) => city.id === '1101')?.longitude,
      originalCoordinates[1],
    );
    assert.equal(
      getBirthPlaceDistrictOptions('1101').find((district) => district.id === '110101')?.longitude,
      originalCoordinates[2],
    );
    assert.equal(findBirthPlaceByRegionId('110101')?.district?.longitude, originalCoordinates[2]);
    assert.equal(searchBirthPlaces('110101')[0]?.longitude, originalCoordinates[2]);
    assert.equal(
      findBirthPlaceByDisplayName('北京市 东城区')?.district?.longitude,
      originalCoordinates[2],
    );
    assert.equal(resolveBirthPlace('110101')?.longitude, originalCoordinates[2]);
    assert.equal(resolveBirthPlaceLongitude('110101'), originalCoordinates[2]);
  } finally {
    Object.assign(publicProvince, { longitude: originalCoordinates[0] });
    Object.assign(publicCity, { longitude: originalCoordinates[1] });
    Object.assign(publicDistrict, { longitude: originalCoordinates[2] });
  }
});

test('地点反查与坐标应保持行政区资料和近似纬度口径一致', () => {
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
  assert.equal(resolveBirthPlaceLongitude('110101'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('北京市 东城区'), 116.416334);
  assert.equal(resolveBirthPlaceLongitude('不存在的地点'), null);
  assert.equal(resolveBirthPlaceApproximateLatitude('110101'), 39.9042);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999'), 35);
  assert.equal(resolveBirthPlaceApproximateLatitude('999999', 0), 0);
  const dongcheng = resolveBirthPlace('110101');
  const taiwanDistrict = resolveBirthPlace('710246');

  assert.equal(dongcheng?.displayName, '北京市 东城区');
  assert.equal(dongcheng?.latitude, 39.928359);
  assert.equal(dongcheng?.coordinateAccuracy, 'administrative-center');
  assert.equal(dongcheng?.timezone, 8);
  assert.equal(taiwanDistrict?.latitude, 23.6978);
  assert.equal(taiwanDistrict?.coordinateAccuracy, 'province-approximation');
});

test('同一行政中心的经纬度应成对取自地点数据', () => {
  for (const { regionId, longitude, latitude } of [
    { regionId: '460302', longitude: 112.346961, latitude: 16.834372 },
    { regionId: '630224', longitude: 102.031294, latitude: 36.011257 },
  ]) {
    const place = resolveBirthPlace(regionId);
    assert.equal(place?.longitude, longitude);
    assert.equal(place?.latitude, latitude);
    assert.equal(place?.coordinateAccuracy, 'administrative-center');
    assert.equal(resolveBirthPlaceLongitude(regionId), longitude);
  }
});

test('地点搜索应保留重名路径且拒绝歧义简称解析', () => {
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
  assert.equal(findBirthPlaceByDisplayName('鼓楼区'), null);
  assert.equal(resolveBirthPlace('鼓楼区'), null);
  assert.equal(resolveBirthPlaceLongitude('鼓楼区'), null);
  assert.equal(findBirthPlaceByDisplayName('福建省 福州市 鼓楼区')?.district?.id, '350102');
  assert.equal(resolveBirthPlace('福建省 福州市 鼓楼区')?.regionId, '350102');
});
