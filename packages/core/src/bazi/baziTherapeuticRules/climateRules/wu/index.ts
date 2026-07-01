import type { ClimateRule } from '../../types';
import { WU_YIN_CLIMATE_RULES } from './yin';
import { WU_MAO_CLIMATE_RULES } from './mao';
import { WU_CHEN_CLIMATE_RULES } from './chen';
import { WU_SI_CLIMATE_RULES } from './si';
import { WU_WU_CLIMATE_RULES } from './wu';
import { WU_WEI_CLIMATE_RULES } from './wei';
import { WU_SHEN_CLIMATE_RULES } from './shen';
import { WU_YOU_CLIMATE_RULES } from './you';
import { WU_XU_CLIMATE_RULES } from './xu';
import { WU_HAI_CLIMATE_RULES } from './hai';
import { WU_ZI_CLIMATE_RULES } from './zi';
import { WU_CHOU_CLIMATE_RULES } from './chou';

export const WU_CLIMATE_RULES: ClimateRule[] = [
  ...WU_YIN_CLIMATE_RULES,
  ...WU_MAO_CLIMATE_RULES,
  ...WU_CHEN_CLIMATE_RULES,
  ...WU_SI_CLIMATE_RULES,
  ...WU_WU_CLIMATE_RULES,
  ...WU_WEI_CLIMATE_RULES,
  ...WU_SHEN_CLIMATE_RULES,
  ...WU_YOU_CLIMATE_RULES,
  ...WU_XU_CLIMATE_RULES,
  ...WU_HAI_CLIMATE_RULES,
  ...WU_ZI_CLIMATE_RULES,
  ...WU_CHOU_CLIMATE_RULES,
];
