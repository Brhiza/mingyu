import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SegmentedControl } from '@/components/SegmentedControl';
import { DIVINATION_METHOD_OPTIONS } from 'mingyu-core/divination/config';
import {
  loadCompatibilityHistory,
  loadDivinationHistory,
  removeCompatibilityHistory,
  removeDivinationHistory,
  toggleCompatibilityHistoryPin,
} from '@/lib/history-records';
import { buildCompatibilityRecordPath, buildDivinationRecordPath } from '@/lib/case-navigation';

type HistoryTab = 'compatibility' | 'divination';

const divinationMethodLabelMap = Object.fromEntries(
  DIVINATION_METHOD_OPTIONS.map((item) => [item.value, item.label]),
) as Record<(typeof DIVINATION_METHOD_OPTIONS)[number]['value'], string>;

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
  const requestedTab = searchParams.get('tab');
  const defaultTab: HistoryTab = requestedTab === 'compatibility' ? 'compatibility' : 'divination';
  const [activeTab, setActiveTab] = useState<HistoryTab>(defaultTab);
  const [searchText, setSearchText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

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

  const filteredCompatibility = useMemo(() => {
    if (!query) return compatibilityRecords;
    return compatibilityRecords.filter((item) =>
      `${item.primaryName} ${item.partnerName} ${item.name}`.toLowerCase().includes(query),
    );
  }, [compatibilityRecords, query]);

  const filteredDivination = useMemo(() => {
    if (!query) return divinationRecords;
    return divinationRecords.filter((item) =>
      `${item.question} ${item.method} ${item.requestedMethod} ${item.caseName ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [divinationRecords, query]);

  if (requestedTab === 'personal') {
    return <Navigate to="/cases" replace />;
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function deleteCompatibility(id: string) {
    if (!window.confirm('确定删除这个合盘记录吗？删除后无法恢复。')) return;
    removeCompatibilityHistory(id);
    refresh();
  }

  function deleteDivination(id: string) {
    if (!window.confirm('确定删除这条占问记录吗？删除后无法恢复。')) return;
    removeDivinationHistory(id);
    refresh();
  }

  const searchPlaceholder = activeTab === 'compatibility' ? '搜索双方姓名' : '搜索问题或卦种';

  return (
    <div className="page-shell input-page-shell workspace-records-page">
      <div className="bazi-view-container">
        <header className="workspace-task-header">
          <h1>历史记录</h1>
        </header>
        <section className="history-page-section">
          <div className="records-toolbar">
            <div className="records-header-bar">
              <SegmentedControl
                value={activeTab}
                options={[
                  { label: '合盘记录', value: 'compatibility' as const },
                  { label: '占问历史', value: 'divination' as const },
                ]}
                onChange={(value) => {
                  setActiveTab(value);
                  navigate(`/records?tab=${value}`, { replace: true });
                }}
              />
            </div>
            <input
              value={searchText}
              type="search"
              className="form-input records-search-input"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {activeTab === 'compatibility' ? (
            filteredCompatibility.length ? (
              <div className="records-list">
                {filteredCompatibility.map((record) => (
                  <div
                    key={record.id}
                    className="record-item compatibility-item"
                    onClick={() => navigate(buildCompatibilityRecordPath(record))}
                  >
                    <div className="record-info">
                      <div className="info-line-1">
                        <span className="name">
                          {record.pinned ? '★ ' : ''}
                          {record.name}
                        </span>
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
                        className="history-action-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCompatibilityHistoryPin(record.id);
                          refresh();
                        }}
                      >
                        {record.pinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        type="button"
                        className="history-action-btn history-action-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCompatibility(record.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="records-empty-card">暂无匹配的合盘记录</div>
            )
          ) : filteredDivination.length ? (
            <div className="records-list">
              {filteredDivination.map((record) => (
                <div
                  key={record.id}
                  className="record-item divination-record-item"
                  onClick={() => navigate(buildDivinationRecordPath(record))}
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
                      <span className="record-tag">案例：{record.caseName ?? '未指定'}</span>
                    </div>
                  </div>
                  <div className="history-actions">
                    <button
                      type="button"
                      className="history-action-btn history-action-danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteDivination(record.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="records-empty-card">暂无匹配的占问记录</div>
          )}
        </section>
      </div>
    </div>
  );
}
