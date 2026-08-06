# mingyu-location-china

`mingyu-core` 的可选中国出生地点数据包，提供省、市、区级联、名称或行政区代码反查，以及真太阳时所需的经度。

```bash
pnpm add mingyu-core mingyu-location-china
```

```ts
import {
  findBirthPlaceByDisplayName,
  getBirthPlaceProvinceOptions,
  resolveBirthPlaceLongitude,
} from 'mingyu-location-china';

const provinces = getBirthPlaceProvinceOptions();
const place = findBirthPlaceByDisplayName('北京市 东城区');
const longitude = resolveBirthPlaceLongitude('110101');
```

数据包不内置于 `mingyu-core`，未使用中国级联地点的项目无需承担其体积。当前区县数据提供经度，不提供精确纬度；`resolveBirthPlaceApproximateLatitude()` 只是省会级兼容回退，西洋星盘等需要纬度的计算应传入真实坐标。
