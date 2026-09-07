/**
 * TrustEngine T3 — 排盘仪式
 * 
 * 输入页（排盘/合盘），信息只保存在本地浏览器
 * 基于 AstrolabeChart 和输入页的组合
 */

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { AstrolabeChart } from '@/components/AstrolabeChart';

/**
 * T3 信任引擎组件
 * 
 * 展示排盘仪式界面，强调数据本地保存。
 * 这是信任漏斗的核心阶段——用户输入敏感信息时的信任建立。
 * 
 * 使用方式：
 * - 挂载在 InputPage 中
 * - 配合 AstrolabeChart 展示星盘
 */
export function TrustEngineT3() {
  const { t } = useI18n();
  const [showChart, setShowChart] = useState(false);

  return (
    <div className="trust-engine trust-engine--t3">
      <div className="trust-engine__content">
        <h2 className="trust-engine__title">{t('trust.t3.title', '排盘仪式')}</h2>
        <p className="trust-engine__subtitle">
          {t('trust.t3.subtitle', '你的出生信息只保存在这台设备的浏览器里，不会上传。')}
        </p>
        
        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">本地计算</h3>
          <p className="trust-engine__section-content">
            {t('trust.t3.local_computation', '所有排盘运算均在本地完成，无需网络连接。')}
          </p>
        </div>

        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">数据安全</h3>
          <p className="trust-engine__section-content">
            {t('trust.t3.data_security', '数据仅存储于你的浏览器，关闭页面后自动清除。')}
          </p>
        </div>

        <div className="trust-engine__action">
          <button
            className="trust-engine__btn trust-engine__btn--primary"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? '隐藏星盘' : '查看星盘'}
          </button>
        </div>

        {showChart && (
          <div className="trust-engine__chart">
            <AstrolabeChart />
          </div>
        )}
      </div>
    </div>
  );
}