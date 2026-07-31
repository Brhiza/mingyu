export type UsefulGodWuxingBundle =
  'resource_companion_output' | 'wealth_officer' | 'output_wealth_officer' | 'resource_companion';

export interface BaseUsefulGodRule {
  id: string;
  label: string;
  description: string;
  patterns?: string[];
  strengths?: string[];
  favorable: UsefulGodWuxingBundle;
  unfavorable: UsefulGodWuxingBundle;
  trace: string;
  primaryReason: string;
}

/** 未逐条完成来源和适用边界校勘，正式取用入口暂不消费旧规则。 */
export const BASE_USEFUL_GOD_RULES: BaseUsefulGodRule[] = [];
