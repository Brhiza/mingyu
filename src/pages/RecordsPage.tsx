import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  WorkspaceButton,
  WorkspaceConfirmDialog,
  WorkspacePage,
  WorkspaceSurface,
} from '@/components/workspace/WorkspaceUI';
import { DIVINATION_METHOD_OPTIONS } from 'mingyu-core/divination/config';
import { INSTANT_CHART_DEFINITIONS } from 'mingyu-core/instant';
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
const instantChartLabelMap = Object.fromEntries(
  INSTANT_CHART_DEFINITIONS.map((item) => [item.type, item.label]),
);

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
  const [pendingDeletion, setPendingDeletion] = useState<{
    type: HistoryTab;
    id: string;
  } | null>(null);

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
    return divinationRecords.filter((item) => {
      const text =
        item.type === 'instant'
          ? `${item.question} ${instantChartLabelMap[item.instantType]}`
          : `${item.question} ${item.method} ${item.requestedMethod} ${item.caseName ?? ''}`;
      return text.toLowerCase().includes(query);
    });
  }, [divinationRecords, query]);

  if (requestedTab === 'personal') {
    return <Navigate to="/cases" replace />;
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function deleteCompatibility(id: string) {
    setPendingDeletion({ type: 'compatibility', id });
  }

  function deleteDivination(id: string) {
    setPendingDeletion({ type: 'divination', id });
  }

  function confirmDeletion() {
    if (!pendingDeletion) return;
    if (pendingDeletion.type === 'compatibility') {
      removeCompatibilityHistory(pendingDeletion.id);
    } else {
      removeDivinationHistory(pendingDeletion.id);
    }
    setPendingDeletion(null);
    refresh();
  }

  const searchPlaceholder = activeTab === 'compatibility' ? '搜索双方姓名' : '搜索问题或算法';

  return (
    <div className="workspace-records-page">
      <WorkspacePage title="历史记录">
        <WorkspaceSurface variant="plain" className="records-page-content">
          <div className="records-toolbar">
            <div className="workspace-records-tabs">
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
              className="workspace-ui-control records-search-input"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {activeTab === 'compatibility' ? (
            filteredCompatibility.length ? (
              <div className="workspace-record-list">
                {filteredCompatibility.map((record) => (
                  <article key={record.id} className="workspace-record-card">
                    <button
                      type="button"
                      className="workspace-record-open"
                      onClick={() => navigate(buildCompatibilityRecordPath(record))}
                    >
                      <span className="workspace-record-info">
                        <span className="workspace-record-title">
                          <strong>
                            {record.pinned ? '★ ' : ''}
                            {record.name}
                          </strong>
                          <time>{formatUpdatedAt(record.updatedAt)}</time>
                        </span>
                        <span className="workspace-record-meta">
                          <span>
                            {record.input.year}-{record.input.month}-{record.input.day}
                          </span>
                          <span>
                            {record.input.partnerYear}-{record.input.partnerMonth}-
                            {record.input.partnerDay}
                          </span>
                          <span className="workspace-record-tag">合盘</span>
                        </span>
                      </span>
                    </button>
                    <div className="workspace-record-actions">
                      <WorkspaceButton
                        size="small"
                        onClick={() => {
                          toggleCompatibilityHistoryPin(record.id);
                          refresh();
                        }}
                      >
                        {record.pinned ? '取消置顶' : '置顶'}
                      </WorkspaceButton>
                      <WorkspaceButton
                        variant="danger"
                        size="small"
                        onClick={() => {
                          deleteCompatibility(record.id);
                        }}
                      >
                        删除
                      </WorkspaceButton>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="workspace-ui-empty">暂无匹配的合盘记录</div>
            )
          ) : filteredDivination.length ? (
            <div className="workspace-record-list">
              {filteredDivination.map((record) => (
                <article key={record.id} className="workspace-record-card">
                  <button
                    type="button"
                    className="workspace-record-open"
                    onClick={() => navigate(buildDivinationRecordPath(record))}
                  >
                    <span className="workspace-record-info">
                      <span className="workspace-record-title">
                        <strong>{record.question}</strong>
                        <time>{formatUpdatedAt(record.updatedAt)}</time>
                      </span>
                      <span className="workspace-record-meta">
                        {record.type === 'instant' ? (
                          <>
                            <span className="workspace-record-tag">
                              {instantChartLabelMap[record.instantType]}
                            </span>
                            <span className="workspace-record-tag">
                              {record.timeStandard === 'true-solar' ? '真太阳时' : '北京时间'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="workspace-record-tag">
                              {record.requestedMethod === 'random'
                                ? `随机 · ${divinationMethodLabelMap[record.method]}`
                                : divinationMethodLabelMap[record.method]}
                            </span>
                            <span className="workspace-record-tag">
                              案例：{record.caseName ?? '未指定'}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                  <div className="workspace-record-actions">
                    <WorkspaceButton
                      variant="danger"
                      size="small"
                      onClick={() => deleteDivination(record.id)}
                    >
                      删除
                    </WorkspaceButton>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="workspace-ui-empty">暂无匹配的占问记录</div>
          )}
        </WorkspaceSurface>
      </WorkspacePage>
      {pendingDeletion ? (
        <WorkspaceConfirmDialog
          title={pendingDeletion.type === 'compatibility' ? '删除合盘记录' : '删除占问记录'}
          message="删除后无法恢复，确定继续吗？"
          onClose={() => setPendingDeletion(null)}
          onConfirm={confirmDeletion}
        />
      ) : null}
    </div>
  );
}
