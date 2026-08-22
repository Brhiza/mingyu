import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildCompatibilityCaseResultPath,
  buildPersonalCaseResultPath,
} from '@/lib/case-navigation';
import {
  HISTORY_RECORDS_CHANGED_EVENT,
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
  markCompatibilityHistoryUsed,
  markPersonalHistoryUsed,
  type CompatibilityHistoryRecord,
  type PersonalHistoryRecord,
} from '@/lib/history-records';

type HomeCase =
  | { kind: 'personal'; record: PersonalHistoryRecord }
  | { kind: 'compatibility'; record: CompatibilityHistoryRecord };

const quickEntries = [
  {
    key: 'single',
    mark: '命',
    title: '新建排盘',
    description: '录入一份新的出生资料',
    to: '/?mode=single&draft=home',
  },
  {
    key: 'divination',
    mark: '卜',
    title: '开始占卜',
    description: '从常用算法开始选择',
    to: '/?mode=divination',
  },
  {
    key: 'compatibility',
    mark: '合',
    title: '新建合盘',
    description: '录入双方资料并排盘',
    to: '/?mode=compatibility&draft=home',
  },
  {
    key: 'almanac',
    mark: '日',
    title: '黄历择日',
    description: '按事项和日期范围筛选',
    to: '/?mode=almanac',
  },
] as const;

function formatCaseMeta(item: HomeCase) {
  if (item.kind === 'personal') {
    return `${item.record.birthText} · ${item.record.gender === 'male' ? '男' : '女'}`;
  }
  return `${item.record.primaryName} 与 ${item.record.partnerName}`;
}

function formatRecordTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, setHistoryVersion] = useState(0);
  const personalCases = loadPersonalHistory();
  const compatibilityCases = loadCompatibilityHistory();
  const divinationRecords = loadDivinationHistory();
  const recentCases: HomeCase[] = [
    ...personalCases.map((record) => ({ kind: 'personal' as const, record })),
    ...compatibilityCases.map((record) => ({ kind: 'compatibility' as const, record })),
  ]
    .sort(
      (left, right) =>
        new Date(right.record.updatedAt).getTime() - new Date(left.record.updatedAt).getTime(),
    )
    .slice(0, 6);

  useEffect(() => {
    function refreshHistory() {
      setHistoryVersion((current) => current + 1);
    }

    window.addEventListener(HISTORY_RECORDS_CHANGED_EVENT, refreshHistory);
    window.addEventListener('storage', refreshHistory);
    return () => {
      window.removeEventListener(HISTORY_RECORDS_CHANGED_EVENT, refreshHistory);
      window.removeEventListener('storage', refreshHistory);
    };
  }, []);

  function openCase(item: HomeCase) {
    if (item.kind === 'personal') {
      markPersonalHistoryUsed(item.record.id);
    } else {
      markCompatibilityHistoryUsed(item.record.id);
    }
    navigate(
      item.kind === 'personal'
        ? buildPersonalCaseResultPath(item.record)
        : buildCompatibilityCaseResultPath(item.record),
    );
  }

  function editCase(item: HomeCase) {
    const mode = item.kind === 'personal' ? 'single' : 'compatibility';
    navigate(`/?mode=${mode}&case=${encodeURIComponent(item.record.id)}`);
  }

  return (
    <div className="page-shell home-page-shell">
      <main className="home-dashboard">
        <section className="home-dashboard-header">
          <div>
            <span>首页</span>
            <h1>从哪里开始？</h1>
            <p>直接打开案例查看排盘，或开始一次新的排盘与占问。</p>
          </div>
          <button
            type="button"
            className="primary-button home-dashboard-new"
            onClick={() => navigate(`/?mode=single&draft=${encodeURIComponent(location.key)}`)}
          >
            新建案例
          </button>
        </section>

        <section className="home-dashboard-section" aria-labelledby="home-quick-title">
          <div className="home-dashboard-section-head">
            <h2 id="home-quick-title">常用功能</h2>
          </div>
          <div className="home-quick-grid">
            {quickEntries.map((item) => (
              <button type="button" key={item.key} onClick={() => navigate(item.to)}>
                <span className="home-quick-mark" aria-hidden="true">
                  {item.mark}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-dashboard-section" aria-labelledby="home-case-title">
          <div className="home-dashboard-section-head">
            <h2 id="home-case-title">最近案例</h2>
            <button type="button" onClick={() => navigate('/records?tab=personal')}>
              管理全部
            </button>
          </div>
          {recentCases.length ? (
            <div className="home-case-grid">
              {recentCases.map((item) => (
                <article key={`${item.kind}-${item.record.id}`} className="home-case-card">
                  <button className="home-case-open" type="button" onClick={() => openCase(item)}>
                    <span className="home-case-avatar" aria-hidden="true">
                      {item.record.name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{item.record.name}</strong>
                      <small>{formatCaseMeta(item)}</small>
                    </span>
                    <b>{item.kind === 'personal' ? '查看排盘' : '查看合盘'}</b>
                  </button>
                  <button className="home-case-edit" type="button" onClick={() => editCase(item)}>
                    编辑资料
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="home-dashboard-empty">
              <strong>还没有案例</strong>
              <button
                type="button"
                onClick={() => navigate(`/?mode=single&draft=${encodeURIComponent(location.key)}`)}
              >
                新建第一份案例
              </button>
            </div>
          )}
        </section>

        {divinationRecords.length ? (
          <section className="home-dashboard-section" aria-labelledby="home-record-title">
            <div className="home-dashboard-section-head">
              <h2 id="home-record-title">最近占问</h2>
              <button type="button" onClick={() => navigate('/records?tab=divination')}>
                查看全部
              </button>
            </div>
            <div className="home-record-list">
              {divinationRecords.slice(0, 3).map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() =>
                    navigate(`/?mode=divination&record=${encodeURIComponent(record.id)}`)
                  }
                >
                  <span>
                    <strong>{record.question}</strong>
                    <small>{formatRecordTime(record.updatedAt)}</small>
                  </span>
                  <b>继续查看</b>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
