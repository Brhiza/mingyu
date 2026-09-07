/**
 * TrustEngine T0 — 星空首屏
 * 
 * 首次到访的排盘首页，零输入，只呈现"已知的从容"
 * 复用 StarfieldBackground 组件
 */

import { StarfieldBackground } from '@/components/StarfieldBackground';

/**
 * T0 信任引擎组件
 * 
 * 展示深空星空背景，传递"这里没有广告，没有弹窗"的初始信任信号。
 * 这是信任漏斗的起点——用户第一次接触到产品时感受到的从容。
 * 
 * 使用方式：
 * - 作为独立页面组件挂载在 '/' 路由
 * - 或作为 InputPage 的背景层之一
 */
export function TrustEngineT0() {
  return (
    <div className="trust-engine trust-engine--t0">
      <StarfieldBackground />
      <div className="trust-engine__content">
        <div className="trust-engine__message">
          <p className="trust-engine__copy">这里没有广告，也没有弹窗。先看看星空。</p>
        </div>
      </div>
    </div>
  );
}
