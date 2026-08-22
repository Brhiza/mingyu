import { useEffect, useMemo, useState } from 'react';
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

function resolveHistoryTab(value: string | null): HistoryTab {
  if (value === 'compatibility' || value === 'divination') {
    return value;
  }
  return 'personal';
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<HistoryTab>(() =>
    resolveHistoryTab(searchParams.get('tab')),
  );

  useEffect(() => {
    setActiveTab(resolveHistoryTab(searchParams.get('tab')));
  }, [searchParams]);

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
      `${item.name} ${item.birthText} ${item.input.birthPlace}`.toLowerCase().includes(query),
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

  function switchTab(value: HistoryTab) {
    setActiveTab(value);
    setSearchText('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', value);
    setSearchParams(nextParams, { replace: true });
  }

  function editPersonalCase(id: string) {
    navigate(`/?mode=single&case=${encodeURIComponent(id)}`);
  }

  function openPersonalChart(id: string) {
    const record = personalRecords.find((item) => item.id === id);
    if (!record) {
      return;
    }
    navigate(
      `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        tab: 'prompt',
        promptSource: record.input.chartType,
      })}`,
    );
  }

  function editCompatibilityCase(id: string) {
    navigate(`/?mode=compatibility&case=${encodeURIComponent(id)}`);
  }

  function openCompatibilityChart(id: string) {
    const record = compatibilityRecords.find((item) => item.id === id);
    if (!record) {
      return;
    }
    navigate(
      `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        tab: 'prompt',
        promptSource: 'bazi',
        baziShortcutMode: '合婚',
        baziPresetId: 'ai-compat-marriage',
      })}`,
    );
  }

  function openDivinationRecord(id: string) {
    navigate(`/?mode=divination&record=${encodeURIComponent(id)}`);
  }

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  function deletePersonalCase(id: string, name: string) {
    if (!window.confirm(`确定删除案例“${name}”吗？`)) {
      return;
    }
    removePersonalHistory(id);
    refresh();
  }

  function deleteCompatibilityCase(id: string, name: string) {
    if (!window.confirm(`确定删除合盘案例“${name}”吗？`)) {
      return;
    }
    removeCompatibilityHistory(id);
    refresh();
  }

  function deleteDivinationRecord(id: string) {
    if (!window.confirm('确定删除这条占卜记录吗？')) {
      return;
    }
    removeDivinationHistory(id);
    refresh();
  }

  const searchPlaceholder =
    activeTab === 'compatibility'
      ? '搜索双方姓名'
      : activeTab === 'divination'
        ? '搜索问题或卦种'
        : '搜索姓名、日期或地区';

  const totalCases = personalRecords.length + compatibilityRecords.length;
  const activeCount =
    activeTab === 'personal'
      ? filteredPersonal.length
      : activeTab === 'compatibility'
        ? filteredCompatibility.length
        : filteredDivination.length;

  return (
    <div className="page-shell input-page-shell case-library-page">
      <div className="bazi-view-container">
        <PrivacyHint />
        <section className="history-page-section case-library-section">
          <PageTopbar
            title={activeTab === 'divination' ? '占卜记录' : '案例库'}
            onBack={() => navigate('/?mode=single')}
          />

          <div className="case-library-overview">
            <div className="case-library-heading">
              <span className="case-library-eyebrow">
                {activeTab === 'divination' ? '本机记录' : '案例管理'}
              </span>
              <h2>{activeTab === 'divination' ? '继续上一次占问' : '集中管理常用资料'}</h2>
              <p>
                {activeTab === 'divination'
                  ? '打开记录可继续查看当时的起卦资料。'
                  : '案例可反复编辑，并直接用于排盘或合盘。'}
              </p>
            </div>
            <button
              type="button"
              className="primary-button case-library-create"
              onClick={() => navigate(`/?mode=single&draft=${Date.now()}`)}
            >
              新建案例
            </button>
          </div>

          <div className="case-library-stats" aria-label="案例统计">
            <button type="button" onClick={() => switchTab('personal')}>
              <strong>{personalRecords.length}</strong>
              <span>个人案例</span>
            </button>
            <button type="button" onClick={() => switchTab('compatibility')}>
              <strong>{compatibilityRecords.length}</strong>
              <span>合盘案例</span>
            </button>
            <button type="button" onClick={() => switchTab('divination')}>
              <strong>{divinationRecords.length}</strong>
              <span>占卜记录</span>
            </button>
          </div>

          <div className="records-header-bar case-library-tabs">
            <SegmentedControl
              value={activeTab}
              options={[
                { label: '个人案例', value: 'personal' as const },
                { label: '合盘案例', value: 'compatibility' as const },
                { label: '占卜记录', value: 'divination' as const },
              ]}
              onChange={switchTab}
            />
          </div>

          <label className="records-controls case-library-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={searchText}
              type="search"
              className="form-input"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>

          {activeTab === 'personal' ? (
            filteredPersonal.length === 0 ? (
              <div className="records-empty-card case-library-empty">
                <strong>{personalRecords.length ? '没有匹配的案例' : '还没有个人案例'}</strong>
                <span>
                  {personalRecords.length ? '换个关键词试试' : '录入资料后会自动保存到这里'}
                </span>
                {!personalRecords.length ? (
                  <button
                    type="button"
                    className="secondary-page-button compact-secondary-button"
                    onClick={() => navigate(`/?mode=single&draft=${Date.now()}`)}
                  >
                    新建第一份案例
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="records-list case-records-list">
                {filteredPersonal.map((record) => (
                  <article key={record.id} className="record-item case-record-card">
                    <span className="case-record-avatar" aria-hidden="true">
                      {record.name.slice(0, 1)}
                    </span>
                    <div className="record-info">
                      <div className="info-line-1">
                        <span className="name">{record.name}</span>
                        <span className="record-time">{formatUpdatedAt(record.updatedAt)}</span>
                      </div>
                      <div className="details-line">
                        <span className="gender">{record.gender === 'male' ? '男' : '女'}</span>
                        <span className="birthday">{record.birthText}</span>
                        {record.input.birthPlace ? (
                          <span className="birthday">{record.input.birthPlace}</span>
                        ) : null}
                        <span className="record-tag">
                          {personalChartTypeLabelMap[record.chartType] || '个人'}
                        </span>
                      </div>
                    </div>
                    <div className="history-actions case-record-actions">
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={() => editPersonalCase(record.id)}
                      >
                        编辑资料
                      </button>
                      <button
                        type="button"
                        className="history-action-btn case-record-primary-action"
                        onClick={() => openPersonalChart(record.id)}
                      >
                        直接排盘
                      </button>
                      <button
                        type="button"
                        className="history-action-btn history-action-danger case-record-delete"
                        aria-label={`删除${record.name}`}
                        onClick={() => deletePersonalCase(record.id, record.name)}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'compatibility' ? (
            filteredCompatibility.length === 0 ? (
              <div className="records-empty-card case-library-empty">
                <strong>
                  {compatibilityRecords.length ? '没有匹配的合盘案例' : '还没有合盘案例'}
                </strong>
                <span>从合盘页录入双方资料后会自动保存</span>
              </div>
            ) : (
              <div className="records-list case-records-list">
                {filteredCompatibility.map((record) => (
                  <article key={record.id} className="record-item case-record-card">
                    <span className="case-record-avatar case-record-avatar-pair" aria-hidden="true">
                      合
                    </span>
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
                    <div className="history-actions case-record-actions">
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={() => editCompatibilityCase(record.id)}
                      >
                        编辑资料
                      </button>
                      <button
                        type="button"
                        className="history-action-btn case-record-primary-action"
                        onClick={() => openCompatibilityChart(record.id)}
                      >
                        直接合盘
                      </button>
                      <button
                        type="button"
                        className="history-action-btn history-action-danger case-record-delete"
                        aria-label={`删除${record.name}`}
                        onClick={() => deleteCompatibilityCase(record.id, record.name)}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : filteredDivination.length === 0 ? (
            <div className="records-empty-card case-library-empty">
              <strong>{divinationRecords.length ? '没有匹配的记录' : '还没有占卜记录'}</strong>
              <span>完成一次占卜后会自动保存到这里</span>
            </div>
          ) : (
            <div className="records-list case-records-list">
              {filteredDivination.map((record) => (
                <article key={record.id} className="record-item case-record-card">
                  <span
                    className="case-record-avatar case-record-avatar-divination"
                    aria-hidden="true"
                  >
                    卜
                  </span>
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
                  <div className="history-actions case-record-actions">
                    <button
                      type="button"
                      className="history-action-btn case-record-primary-action"
                      onClick={() => openDivinationRecord(record.id)}
                    >
                      打开记录
                    </button>
                    <button
                      type="button"
                      className="history-action-btn history-action-danger case-record-delete"
                      onClick={() => deleteDivinationRecord(record.id)}
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="records-summary">
            {activeTab === 'divination' ? `共 ${activeCount} 条记录` : `共 ${activeCount} 份案例`}
            {activeTab !== 'divination' ? ` · 案例库总计 ${totalCases} 份` : ''}
          </div>
        </section>
      </div>
    </div>
  );
}
