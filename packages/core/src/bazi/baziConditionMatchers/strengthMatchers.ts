import type { Matcher } from './types';

export const strengthMatcher: Matcher = ({ condition }) => {
  if (condition.includes('当令') || condition.includes('旺盛') || condition.includes('势旺')) {
    return true;
  }
  if (condition.includes('日干与月支同气') || condition.includes('月令司权')) {
    return true;
  }
  if (condition.includes('羊刃')) {
    return true;
  }
  return null;
};
