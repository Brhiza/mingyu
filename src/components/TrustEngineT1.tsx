/**
 * TrustEngine T1 — 价值预览（教程页）
 * 
 * 零输入价值展示，让用户了解命律如何工作
 * 基于教程页概念，但独立为信任引擎组件
 */

import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';

/**
 * T1 信任引擎组件
 * 
 * 向用户展示命律的核心功能，无需填写任何信息。
 * 通过直观的功能预览建立初步信任。
 * 
 * 使用方式：
 * - 挂载在 '/tutorial' 路由
 * - 或作为功能引导页面
 */
export function TrustEngineT1() {
  const { t } = useI18n();

  return (
    <div className="trust-engine trust-engine--t1">
      <div className="trust-engine__content trust-engine__content--centered">
        <h2 className="trust-engine__title">{t('trust.t1.title', '命律如何工作')}</h2>
        <p className="trust-engine__subtitle">{t('trust.t1.subtitle', '不必填写任何信息，就能先了解命律如何工作。')}</p>
        
        <div className="trust-engine__features">
          <div className="trust-engine__feature">
            <div className="trust-engine__feature-icon">🔮</div>
            <div className="trust-engine__feature-text">
              <h3>八字排盘</h3>
              <p>根据出生年月日时，生成八字命盘，分析五行八字</p>
            </div>
          </div>
          
          <div className="trust-engine__feature">
            <div className="trust-engine__feature-icon">⭐</div>
            <div className="trust-engine__feature-text">
              <h3>紫微斗数</h3>
              <p>星盘排布，解读命运轨迹</p>
            </div>
          </div>
          
          <div className="trust-engine__feature">
            <div className="trust-engine__feature-icon">🔮</div>
            <div className="trust-engine__feature-text">
              <h3>占卜</h3>
              <p>塔罗、六爻等占卜方式，完全本地运算</p>
            </div>
          </div>
        </div>

        <div className="trust-engine__action">
          <Link to="/" className="trust-engine__btn trust-engine__btn--primary">
            开始使用
          </Link>
        </div>
      </div>
    </div>
  );
}
