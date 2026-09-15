import { ChildLimit, DefaultChildLimitProvider, SolarTime } from 'tyme4ts';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type ChildLimitInstance = ReturnType<typeof ChildLimit.fromSolarTime>;
type EightCharInstance = ReturnType<ReturnType<SolarTimeInstance['getLunarHour']>['getEightChar']>;

export const CHILD_LIMIT_METHOD = '按实际节气时刻计算，三日折一年';

const childLimitProvider = new DefaultChildLimitProvider();

/**
 * ChildLimit 的节气差取真实瞬时轴，八字对象则使用年月与日时合成结果。
 * tyme4ts 将 ChildLimit 的构造函数和 eightChar 标为 protected，这里通过
 * 窄子类替换对象，避免重写 provider 或让当地真太阳时丢失小运时柱。
 */
class BaziChildLimit extends ChildLimit {
  public constructor(
    solarTime: SolarTimeInstance,
    gender: LuckGender,
    eightChar: EightCharInstance,
  ) {
    super(solarTime, gender);
    this.eightChar = eightChar;
  }
}

/**
 * 使用项目固定的三日一岁起运口径，避免 tyme4ts 的可变全局配置改变排盘结果。
 */
export function createChildLimit(
  solarTime: SolarTimeInstance,
  gender: LuckGender,
  eightChar: EightCharInstance = solarTime.getLunarHour().getEightChar(),
): ChildLimitInstance {
  const previousProvider = ChildLimit.provider;
  ChildLimit.provider = childLimitProvider;

  try {
    return new BaziChildLimit(solarTime, gender, eightChar);
  } finally {
    ChildLimit.provider = previousProvider;
  }
}
