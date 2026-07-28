import type { ClimateRule } from '../types';
import { GENERAL_CLIMATE_RULES } from './general';
import { JIA_CLIMATE_RULES } from './jia';
import { YI_CLIMATE_RULES } from './yi';
import { BING_CLIMATE_RULES } from './bing';
import { DING_CLIMATE_RULES } from './ding';
import { WU_CLIMATE_RULES } from './wu';
import { JI_CLIMATE_RULES } from './ji';
import { GENG_CLIMATE_RULES } from './geng';
import { XIN_CLIMATE_RULES } from './xin';
import { REN_CLIMATE_RULES } from './ren';
import { GUI_CLIMATE_RULES } from './gui';
import { CLIMATE_RULE_PRECEDENCE } from './precedence';

const climateRules: ClimateRule[] = [
  ...GENERAL_CLIMATE_RULES,
  ...JIA_CLIMATE_RULES,
  ...YI_CLIMATE_RULES,
  ...BING_CLIMATE_RULES,
  ...DING_CLIMATE_RULES,
  ...WU_CLIMATE_RULES,
  ...JI_CLIMATE_RULES,
  ...GENG_CLIMATE_RULES,
  ...XIN_CLIMATE_RULES,
  ...REN_CLIMATE_RULES,
  ...GUI_CLIMATE_RULES,
];

function orderClimateRules(rules: ClimateRule[]): ClimateRule[] {
  const ruleById = new Map<string, ClimateRule>();
  for (const rule of rules) {
    if (ruleById.has(rule.id)) {
      throw new Error(`调候规则 ID 重复：${rule.id}`);
    }
    ruleById.set(rule.id, rule);
  }

  const orderedRules = CLIMATE_RULE_PRECEDENCE.map((ruleId) => {
    const rule = ruleById.get(ruleId);
    if (!rule) {
      throw new Error(`调候冲突顺序引用了不存在的规则：${ruleId}`);
    }
    return rule;
  });
  const unlistedRuleIds = rules
    .map((rule) => rule.id)
    .filter((ruleId) => !CLIMATE_RULE_PRECEDENCE.includes(ruleId));
  if (unlistedRuleIds.length) {
    throw new Error(`调候规则未声明冲突顺序：${unlistedRuleIds.join('、')}`);
  }

  return orderedRules;
}

export const CLIMATE_RULES = orderClimateRules(climateRules);
