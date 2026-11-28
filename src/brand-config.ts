function readBuildEnv(key: string): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    if (metaEnv && typeof metaEnv[key] === 'string') {
      return String(metaEnv[key]).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
      return process.env[key]!.trim();
    }
  } catch {}
  return '';
}

export interface BrandConfig {
  appName: string;
  appFullName: string;
  appSlogan: string;
  sealChar: string;
  appOrigin: string;
  assetOrigin: string;
  defaultTheme: string;
  meritBoxUrl: string;
  builtinAiHint: boolean;
  enableCustomEdition: boolean;
}

export function resolveBrandConfig(overrides?: Partial<Record<string, string>>): BrandConfig {
  const get = (key: string) => (overrides && key in overrides ? String(overrides[key] ?? '').trim() : readBuildEnv(key));

  const appName = get('VITE_APP_NAME') || '命语';
  const appFullName = get('VITE_APP_FULL_NAME') || appName;
  const defaultSlogan = appName === '命语' ? '观四时之命，译数术之语' : '';
  const appSlogan = get('VITE_APP_SLOGAN') || defaultSlogan;
  const sealChar = get('VITE_APP_SEAL_CHAR') || appName.slice(0, 1) || '命';
  const rawOrigin = get('VITE_APP_ORIGIN') || 'https://sydf.cc';
  const appOrigin = rawOrigin.replace(/\/+$/, '');
  const rawAssetOrigin = get('VITE_ASSET_ORIGIN');
  const assetOrigin = rawAssetOrigin ? rawAssetOrigin.replace(/\/+$/, '') : '';
  const defaultTheme = get('VITE_DEFAULT_THEME') || 'blossom';
  const meritBoxUrl = get('VITE_MERIT_BOX_URL');
  const builtinAiHint = get('VITE_BUILTIN_AI_ENABLED') === 'true';
  const enableCustomEdition = Boolean(assetOrigin) || get('VITE_SYDF_EDITION') === 'true';

  return {
    appName,
    appFullName,
    appSlogan,
    sealChar,
    appOrigin,
    assetOrigin,
    defaultTheme,
    meritBoxUrl,
    builtinAiHint,
    enableCustomEdition,
  };
}

export const BRAND_CONFIG = resolveBrandConfig();
export const APP_NAME = BRAND_CONFIG.appName;
export const APP_FULL_NAME = BRAND_CONFIG.appFullName;
export const APP_SLOGAN = BRAND_CONFIG.appSlogan;
export const APP_SEAL_CHAR = BRAND_CONFIG.sealChar;
export const APP_ORIGIN = BRAND_CONFIG.appOrigin;
export const ASSET_ORIGIN = BRAND_CONFIG.assetOrigin;
export const DEFAULT_WORKSPACE_THEME_ID = BRAND_CONFIG.defaultTheme;
export const MERIT_BOX_URL = BRAND_CONFIG.meritBoxUrl;
export const BUILTIN_AI_HINT = BRAND_CONFIG.builtinAiHint;
export const ENABLE_CUSTOM_EDITION = BRAND_CONFIG.enableCustomEdition;
