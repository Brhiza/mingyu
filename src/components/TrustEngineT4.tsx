/**
 * TrustEngine T4 — 占卜/择日
 * 
 * 占卜与择日无需提供任何个人信息，完全在本地进行
 * 基于 DivinationPanel 和 BaziFortuneTools 的组合
 */

import { useState } from 'react';
import { useI18n } from '@/i18n';

/**
 * T4 信任引擎组件
 * 
 * 展示占卜和择日功能，强调零个人信息、完全本地运算。
 * 这是信任漏斗中"零输入"的阶段——用户无需提供任何数据即可使用。
 * 
 * 使用方式：
 * - 挂载在 InputPage 的占卜/择日模式下
 * - 或作为独立的功能展示组件
 */
export function TrustEngineT4() {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="trust-engine trust-engine--t4">
      <div className="trust-engine__content">
        <h2 className="trust-engine__title">{t('trust.t4.title', '占卜与择日')}</h2>
        <p className="trust-engine__subtitle">
          {t('trust.t4.subtitle', '占卜与择日无需提供任何个人信息，完全在本地进行。')}
        </p>
        
        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">零信息输入</h3>
          <p className="trust-engine__section-content">
            {t('trust.t4.no_input', '无需姓名、出生日期等任何个人信息。')}
          </p>
        </div>

        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">本地运算</h3>
          <p className="trust-engine__section-content">
            {t('trust.t4.local_computation', '所有占卜和择日运算均在本地设备完成。')}
          </p>
        </div>

        <div className="trust-engine__action">
          <button
            className="trust-engine__btn trust-engine__btn--primary"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '收起详情' : '了解更多'}
          </button>
        </div>

        {showDetails && (
          <div className="trust-engine__details">
            <div className="trust-engine__detail-item">
              <span className="trust-engine__detail-label">占卜方式</span>
              <span className="trust-engine__detail-value">塔罗、六爻、奇门遁甲</span>
            </div>
            <div className="trust-engine__detail-item">
              <span className="trust-engine__detail-label">择日范围</span>
              <span className="trust-engine__detail-value">黄道吉日、时辰选择</span>
            </div>
            <div className="trust-engine__detail-item">
              <span className="trust-engine__detail-label">数据流向</span>
              <span className="trust-engine__detail-value">完全本地，无网络请求</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}