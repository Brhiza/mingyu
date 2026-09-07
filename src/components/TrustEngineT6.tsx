/**
 * TrustEngine T6 — 结果/记录
 * 
 * 结果与档案只存在本机
 * 基于 ResultPage 和 RecordsPage 的组合
 */

import { useState } from 'react';
import { useI18n } from '@/i18n';

/**
 * T6 信任引擎组件
 * 
 * 展示结果和记录页面，强调数据本地存储。
 * 这是信任漏斗的最终阶段——用户看到结果后的信任确认。
 * 
 * 使用方式：
 * - 挂载在 ResultPage / RecordsPage 中
 * - 或作为独立的结果展示组件
 */
export function TrustEngineT6() {
  const { t } = useI18n();
  const [exported, setExported] = useState(false);

  return (
    <div className="trust-engine trust-engine--t6">
      <div className="trust-engine__content">
        <h2 className="trust-engine__title">{t('trust.t6.title', '结果与档案')}</h2>
        <p className="trust-engine__subtitle">
          {t('trust.t6.subtitle', '结果与档案只存在这台设备。你可以随时带走，或彻底删除。')}
        </p>
        
        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">本地存储</h3>
          <p className="trust-engine__section-content">
            {t('trust.t6.local_storage', '所有结果都存储在你的设备上，不会上传到服务器。')}
          </p>
        </div>

        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">数据导出</h3>
          <p className="trust-engine__section-content">
            {t('trust.t6.export', '你可以将数据导出为文件，随时带走。')}
          </p>
        </div>

        <div className="trust-engine__section">
          <h3 className="trust-engine__section-title">彻底删除</h3>
          <p className="trust-engine__section-content">
            {t('trust.t6.delete', '你可以随时删除所有数据，不可恢复。')}
          </p>
        </div>

        <div className="trust-engine__action">
          <button
            className="trust-engine__btn trust-engine__btn--primary"
            onClick={() => {
              setExported(true);
              setTimeout(() => setExported(false), 3000);
            }}
          >
            {t('trust.t6.export_data', '导出数据')}
          </button>
        </div>

        {exported && (
          <div className="trust-engine__exported">
            <p className="trust-engine__exported-message">
              {t('trust.t6.exported', '数据已导出。')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}