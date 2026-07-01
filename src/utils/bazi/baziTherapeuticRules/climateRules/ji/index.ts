import type { ClimateRule } from '../../types';
import { JI_YIN_CLIMATE_RULES } from './yin';
import { JI_MAO_CLIMATE_RULES } from './mao';
import { JI_CHEN_CLIMATE_RULES } from './chen';
import { JI_SI_CLIMATE_RULES } from './si';
import { JI_WU_CLIMATE_RULES } from './wu';
import { JI_WEI_CLIMATE_RULES } from './wei';
import { JI_SHEN_CLIMATE_RULES } from './shen';
import { JI_YOU_CLIMATE_RULES } from './you';
import { JI_XU_CLIMATE_RULES } from './xu';
import { JI_HAI_CLIMATE_RULES } from './hai';
import { JI_ZI_CLIMATE_RULES } from './zi';
import { JI_CHOU_CLIMATE_RULES } from './chou';

export const JI_CLIMATE_RULES: ClimateRule[] = [
  ...JI_YIN_CLIMATE_RULES,
  ...JI_MAO_CLIMATE_RULES,
  ...JI_CHEN_CLIMATE_RULES,
  ...JI_SI_CLIMATE_RULES,
  ...JI_WU_CLIMATE_RULES,
  ...JI_WEI_CLIMATE_RULES,
  ...JI_SHEN_CLIMATE_RULES,
  ...JI_YOU_CLIMATE_RULES,
  ...JI_XU_CLIMATE_RULES,
  ...JI_HAI_CLIMATE_RULES,
  ...JI_ZI_CLIMATE_RULES,
  ...JI_CHOU_CLIMATE_RULES,
];
