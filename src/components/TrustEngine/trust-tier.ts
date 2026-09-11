/**
 * Trust Engine — 信任引擎核心判定逻辑（T0–T6 信任漏斗分层）。
 *
 * 层级与信任漏斗阶段的映射：
 *   T0 星空首屏 —— 首次到访的排盘首页，零输入，只呈现"已知的从容"
 *   T1 价值预览 —— 教程页，零输入价值展示
 *   T2 隐私安全 —— 隐私政策页（此页不显示横幅，信任在此沉淀，避免自我指涉）
 *   T3 排盘仪式 —— 输入页（排盘/合盘），信息只保存在本地浏览器
 *   T4 法理穿透 —— 占卜/择日，零个人信息，完全本地
 *   T5 排盘仪式(已填) —— 输入页已有内容，强调"不出本机"
 *   T6 结果/记录页 —— 结果与档案只存在本机
 */
export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export interface TrustTierInput {
  /** 当前路由路径，如 '/'、'/tutorial'、'/result' */
  pathname: string;
  /** 输入页当前模式：排盘/合盘/占卜/择日（仅输入页提供） */
  inputMode?: 'single' | 'compatibility' | 'divination' | 'almanac';
  /** 输入页表单是否已有任一实质字段 */
  inputHasContent?: boolean;
  /** T0 首屏话术是否已在历史访问中展示过 */
  hasSeenT0?: boolean;
}

export const TRUST_TIER_COPY: Record<TrustTier, string> = {
  T0: '这里没有广告，也没有弹窗。先看看星空。',
  T1: '不必填写任何信息，就能先了解命律如何工作。',
  T2: '隐私政策全文在这里——每一句话都为你而写。',
  T3: '你的出生信息只保存在这台设备的浏览器里，不会上传。',
  T4: '占卜与择日无需提供任何个人信息，完全在本地进行。',
  T5: '已填入的信息只存在本机，离开前可随时在记录页删除。',
  T6: '结果与档案只存在这台设备。你可以随时带走，或彻底删除。',
};

export function getTrustTier({
  pathname,
  inputMode,
  inputHasContent,
  hasSeenT0,
}: TrustTierInput): TrustTier | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith('/tutorial')) {
    return 'T1';
  }
  if (path.startsWith('/privacy')) {
    return 'T2';
  }
  if (path === '/result' || path === '/records') {
    return 'T6';
  }

  // 输入页（首页）：按模式与填写状态分层
  if (inputMode === 'divination' || inputMode === 'almanac') {
    return 'T4';
  }
  if (inputMode === 'single' || inputMode === 'compatibility') {
    if (inputHasContent) {
      return 'T5';
    }
    // 首次到访的星空首屏：先给"已知的从容"，之后进入排盘仪式话术
    return hasSeenT0 ? 'T3' : 'T0';
  }

  // 其他页面（登录/注册/词库等）：不打扰
  return null;
}

/** 该层级是否应显示信任横幅（T2 隐私页不显示） */
export function shouldShowTrustBanner(tier: TrustTier | null): boolean {
  return tier !== null && tier !== 'T2';
}
