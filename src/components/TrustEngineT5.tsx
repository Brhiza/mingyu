/**
 * TrustEngine T5 — 排盘仪式（已填）
 * 
 * 输入页已有内容，强调"不出本机"
 * 基于 BaziFortuneTools 和输入状态的组合
 */

import { useState } from 'react';
import { useI18n } from '@/i18n';

/**
 * T5 信任引擎组件
 * 
 * 当用户已填写输入信息后显示，强调数据不出本机。
 * 这是信任漏斗中"已填信息"的阶段——用户已提供数据，需要更强的信任保障。
 * 
 * 使用方式：
 * - 挂载在 InputPage 已填信息状态下
 * - 配合 BaziFortuneTools 展示结果
 */
export function TrustEngineT5() {
  const { t } = useI18n();
  const [dataCleared, setDataCleared] = useState(false);

  return (
    <div className="trust-engine trust-engine--t5">
      <div className="trust-engine__content">
        <h2 className="trust-engine__title">{t('trust.t5.title', '已填写的信息')}</h2>
        <p className="trust-engine__subtitle">
          {t('trust.t5.subtitle', '已填入的信息只存在本机，离开前可随时在记录页删除。')}
        </p>
        
        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">数据归属</h3>
          <p className="trust-engine__section-content">
            {t('trust.t5.data_ownership', '所有数据归你所有，我们无权访问。')}
          </p>
        </div>

        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">随时清除</h3>
          <p className="trust-engine__section-content">
            {t('trust.t5.clear_anytime', '你可以在记录页随时删除所有本地数据。')}
          </p>
        </div>

        <div className="trust-engine__action">
          <button
            className="trust-engine__btn trust-engine__btn--secondary"
            onClick={() => setDataCleared(true)}
          >
            {t('trust.t5.clear_data', '清除本地数据')}
          </button>
        </div>

        {dataCleared && (
          <div className="trust-engine__cleared">
            <p className="trust-engine__cleared-message">
              {t('trust.t5.data_cleared', '本地数据已清除。')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}