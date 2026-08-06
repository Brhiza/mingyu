import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageTopbar } from '@/components/PageTopbar';
import { PrivacyHint } from '@/components/PrivacyHint';
import { SegmentedControl } from '@/components/SegmentedControl';
import { DIVINATION_METHOD_OPTIONS } from 'mingyu-core/divination/config';
import {
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
  removeCompatibilityHistory,
  removeDivinationHistory,
  removePersonalHistory,
} from '@/lib/history-records';
import { buildResultSearch, defaultPromptState } from '@/lib/query-state';

type HistoryTab = 'personal' | 'compatibility' | 'divination';

const divinationMethodLabelMap = Object.fromEntries(
  DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<(typeof DIVINATION_METHOD_OPTIONS)[number]['value'], string>;

const personalChartTypeLabelMap = {
  bazi: '八字',
  ziwei: '紫微',
  astrolabe: '星盘',
} as const;

function formatUpdatedAt(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function RecordsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const defaultTab: HistoryTab =
    searchParams.get('tab') === 'compatibility'
      ? 'compatibility'
      : searchParams.get('tab') === 'divination'
        ? 'divination'
        : 'personal';
  const [activeTab, setActiveTab] = useState<HistoryTab>(defaultTab);

  const personalRecords = useMemo(
    () => loadPersonalHistory(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );
  const compatibilityRecords = useMemo(
    () => loadCompatibilityHistory(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );
  const divinationRecords = useMemo(
    () => loadDivinationHistory(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );
  const query = searchText.trim().toLowerCase();

  const filteredPersonal = useMemo(() => {
    if (!query) {
      return personalRecords;
    }

    return personalRecords.filter((item) =>
      `${item.name} ${item.birthText}`.toLowerCase().includes(query),
    );
  }, [personalRecords, query]);

  const filteredCompatibility = useMemo(() => {
    if (!query) {
      return compatibilityRecords;
    }

    return compatibilityRecords.filter((item) =>
      `${item.primaryName} ${item.partnerName} ${item.name}`.toLowerCase().includes(query),
    );
  }, [compatibilityRecords, query]);

  const filteredDivination = useMemo(() => {
    if (!query) {
      return divinationRecords;
    }

    return divinationRecords.filter((item) =>
      `${item.question} ${item.method} ${item.requestedMethod}`.toLowerCase().includes(query),
    );
  }, [divinationRecords, query]);

  function handleOpenPersonal(index: number) {
    const record = filteredPersonal[index];
    navigate(
      `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        tab: 'bazi',
        promptSource: 'bazi',
      })}`,
    );
  }

  function handleOpenCompatibility(index: number) {
    const record = filteredCompatibility[index];
    navigate(
      `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        promptSource: 'bazi',
        baziShortcutMode: '合婚',
        baziPresetId: 'ai-compat-marriage',
      })}`,
    );
  }

  function handleOpenDivination(index: number) {
    const record = filteredDivination[index];
    navigate(`/?mode=divination&record=${record.id}`);
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function handleDeletePersonal(id: string) {
    removePersonalHistory(id);
    refresh();
  }

  function handleDeleteCompatibility(id: string) {
    removeCompatibilityHistory(id);
    refresh();
  }

  function handleDeleteDivination(id: string) {
    removeDivinationHistory(id);
    refresh();
  }

  const searchPlaceholder =
    activeTab === 'compatibility'
      ? '搜索双方姓名...'
      : activeTab === 'divination'
        ? '搜索问题或卦种...'
        : '搜索姓名...';

  return (
    <div className="page-shell input-page-shell">
      <div className="bazi-view-container">
        <PrivacyHint />
        <section className="history-page-section">
          <PageTopbar
            title="历史记录"
            onBack={() =>
              navigate(
                activeTab === 'compatibility'
                  ? '/?mode=compatibility'
                  : activeTab === 'divination'
                    ? '/?mode=divination'
                    : '/?mode=single',
              )
            }
          />

          <div className="person-section-head history-section-head">
            <p>支持搜索，点击记录可直接打开对应内容。</p>
          </div>

          <div className="records-header-bar">
            <SegmentedControl
              value={activeTab}
              options={[
                { label: '个人记录', value: 'personal' as const },
                { label: '合盘记录', value: 'compatibility' as const },
                { label: '占卜记录', value: 'divination' as const },
              ]}
              onChange={(value) => setActiveTab(value)}
            />
          </div>

          <div className="records-controls">
            <input
              value={searchText}
              type="text"
              className="form-input"
              placeholder={searchPlaceholder}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {activeTab === 'personal' ? (
            filteredPersonal.length === 0 ? (
              <div className="records-empty-card">暂无匹配的个人记录</div>
            ) : (
              <>
                <div className="records-list">
                  {filteredPersonal.map((record, index) => (
                    <div
                      key={record.id}
                      className="record-item"
                      onClick={() => handleOpenPersonal(index)}
                    >
                      <div className="record-info">
                        <div className="info-line-1">
                          <span className="name">{record.name}</span>
                          <span className="record-time">{formatUpdatedAt(record.updatedAt)}</span>
                        </div>
                        <div className="details-line">
                          <span className="gender">{record.gender === 'male' ? '男' : '女'}</span>
                          <span className="birthday">{record.birthText}</span>
                          <span className="record-tag">
                            {personalChartTypeLabelMap[record.chartType] || '个人'}
                          </span>
                        </div>
                      </div>
                      <div className="history-actions">
                        <button
                          type="button"
                          className="history-action-btn history-action-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeletePersonal(record.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="records-summary">共 {filteredPersonal.length} 条记录</div>
              </>
            )
          ) : activeTab === 'compatibility' ? (
            filteredCompatibility.length === 0 ? (
              <div className="records-empty-card">暂无匹配的合盘记录</div>
            ) : (
              <>
                <div className="records-list">
                  {filteredCompatibility.map((record, index) => (
                    <div
                      key={record.id}
                      className="record-item compatibility-item"
                      onClick={() => handleOpenCompatibility(index)}
                    >
                      <div className="record-info">
                        <div className="info-line-1">
                          <span className="name">{record.name}</span>
                          <span className="record-time">{formatUpdatedAt(record.updatedAt)}</span>
                        </div>
                        <div className="details-line">
                          <span className="birthday">
                            {record.input.year}-{record.input.month}-{record.input.day}
                          </span>
                          <span className="birthday">
                            {record.input.partnerYear}-{record.input.partnerMonth}-
                            {record.input.partnerDay}
                          </span>
                          <span className="record-tag">合盘</span>
                        </div>
                      </div>
                      <div className="history-actions">
                        <button
                          type="button"
                          className="history-action-btn history-action-danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCompatibility(record.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="records-summary">共 {filteredCompatibility.length} 条记录</div>
              </>
            )
          ) : filteredDivination.length === 0 ? (
            <div className="records-empty-card">暂无匹配的占卜记录</div>
          ) : (
            <>
              <div className="records-list">
                {filteredDivination.map((record, index) => (
                  <div
                    key={record.id}
                    className="record-item"
                    onClick={() => handleOpenDivination(index)}
                  >
                    <div className="record-info">
                      <div className="info-line-1">
                        <span className="name">{record.question}</span>
                        <span className="record-time">{formatUpdatedAt(record.updatedAt)}</span>
                      </div>
                      <div className="details-line">
                        <span className="record-tag">
                          {record.requestedMethod === 'random'
                            ? `随机 · ${divinationMethodLabelMap[record.method]}`
                            : divinationMethodLabelMap[record.method]}
                        </span>
                      </div>
                    </div>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="history-action-btn history-action-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteDivination(record.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="records-summary">共 {filteredDivination.length} 条记录</div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
