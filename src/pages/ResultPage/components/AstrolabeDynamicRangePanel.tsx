import { memo, useEffect, useState } from 'react';
import type { AstrolabeDynamicRangeBranch } from 'mingyu-core/divination/astrolabe-dynamic-range';
import type { useAstrolabeDynamicRange } from '@/hooks/useAstrolabeDynamicRange';
import {
  formatAstrolabeBirthRangeInterval,
  formatAstrolabeBirthRangeTime,
  formatAstrolabeRangeContinuousFact,
} from '@/lib/astrolabe-birth-range-prompt';
import { AstrolabeBoard } from './AstrolabeBoard';

type Props = {
  state: ReturnType<typeof useAstrolabeDynamicRange>;
  error?: string;
};
const BRANCH_PAGE_SIZE = 8;
const FACT_PAGE_SIZE = 20;

const BranchDetails = memo(function BranchDetails({
  branch,
}: {
  branch: AstrolabeDynamicRangeBranch;
}) {
  const [factPage, setFactPage] = useState(0);
  const [scopeIndex, setScopeIndex] = useState(() =>
    Math.max(
      0,
      branch.representative.scopes.findIndex((scope) => scope.scope !== 'natal'),
    ),
  );
  const scope = branch.representative.scopes[scopeIndex];
  const lastScope = branch.last.scopes[scopeIndex];
  const [factScope, setFactScope] = useState<string>(scope?.scope ?? 'all');
  const facts = branch.continuous.filter(
    (fact) =>
      factScope === 'all' ||
      (factScope === 'natal'
        ? !fact.path.startsWith('dynamic.')
        : fact.path.startsWith(`dynamic.${factScope}.`)),
  );
  const factPages = Math.max(1, Math.ceil(facts.length / FACT_PAGE_SIZE));
  return (
    <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
      <p>
        {formatAstrolabeBirthRangeInterval(branch.startTimestamp, branch.endTimestamp)}，共{' '}
        {branch.sampleCount} 秒。
      </p>
      <AstrolabeBoard
        title="当前分段起点盘"
        name={branch.representative.natal.birth.name || '当前命盘'}
        data={branch.representative.natal}
        representativeTime={formatAstrolabeBirthRangeTime(branch.startTimestamp)}
      />
      <div className="result-side-card">
        <label>
          查看推运范围{' '}
          <select
            className="result-chip"
            aria-label="查看推运范围"
            value={scopeIndex}
            onChange={(event) => setScopeIndex(Number(event.target.value))}
          >
            {branch.representative.scopes.map((item, index) => (
              <option key={item.scope} value={index}>
                {item.displayLabel}
              </option>
            ))}
          </select>
        </label>
        <p>以下为当前分段首秒和末秒的推运资料；整段数值变化见连续事实。</p>
        <details>
          <summary>首秒推运资料</summary>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {scope?.promptText}
          </div>
        </details>
        <details>
          <summary>末秒推运资料</summary>
          <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {lastScope?.promptText}
          </div>
        </details>
      </div>
      <section className="result-side-card" aria-label="分段连续事实">
        <h3>
          连续事实（当前 {facts.length} 项，全部 {branch.continuous.length} 项）
        </h3>
        <label>
          事实分类{' '}
          <select
            className="result-chip"
            aria-label="事实分类"
            value={factScope}
            onChange={(event) => {
              setFactScope(event.target.value);
              setFactPage(0);
            }}
          >
            <option value="all">全部事实</option>
            <option value="natal">本命事实</option>
            {branch.representative.scopes
              .filter((item) => item.scope !== 'natal')
              .map((item) => (
                <option key={item.scope} value={item.scope}>
                  {item.displayLabel}
                </option>
              ))}
          </select>
        </label>
        <p>
          第 {factPage + 1} / {factPages} 页，每页最多 {FACT_PAGE_SIZE} 项。
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', overflowWrap: 'anywhere' }}>
          {facts.slice(factPage * FACT_PAGE_SIZE, (factPage + 1) * FACT_PAGE_SIZE).map((fact) => (
            <p key={fact.path} style={{ margin: 0 }}>
              {formatAstrolabeRangeContinuousFact(fact, branch.representative.natal)}
            </p>
          ))}
        </div>
        <div className="result-chip-row" style={{ marginTop: '1rem' }}>
          <button
            className="result-chip"
            type="button"
            disabled={factPage === 0}
            onClick={() => setFactPage((page) => page - 1)}
          >
            上一页事实
          </button>
          <button
            className="result-chip"
            type="button"
            disabled={factPage + 1 >= factPages}
            onClick={() => setFactPage((page) => page + 1)}
          >
            下一页事实
          </button>
        </div>
      </section>
    </div>
  );
});

export const AstrolabeDynamicRangePanel = memo(function AstrolabeDynamicRangePanel({
  state,
  error,
}: Props) {
  const [selection, setSelection] = useState({ key: '', index: 0 });
  const index =
    selection.key === state.key
      ? Math.min(selection.index, Math.max(0, state.branches.length - 1))
      : 0;
  const entry = state.branches[index];
  const [loaded, setLoaded] = useState<{
    key: string;
    index: number;
    branch: AstrolabeDynamicRangeBranch;
  } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const readBranch = state.readBranch;
  const requestKey = state.key;
  useEffect(() => {
    setLoaded(null);
    setReadError(null);
    if (!entry) return;
    let active = true;
    void readBranch(index)
      .then((branch) => {
        if (active) setLoaded({ key: requestKey, index, branch });
      })
      .catch((reason) => {
        if (active) setReadError(reason instanceof Error ? reason.message : '读取分段失败。');
      });
    return () => {
      active = false;
    };
  }, [entry, index, readBranch, requestKey]);
  const page = Math.floor(index / BRANCH_PAGE_SIZE);
  const branch = loaded?.key === requestKey && loaded.index === index ? loaded.branch : null;
  const choose = (next: number) => setSelection({ key: requestKey, index: next });
  return (
    <section className="result-showcase-card astrolabe-showcase-card traditional-chart-layout astrolabe-dynamic-range-panel">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">西洋占星动态出生区间</p>
          <h2>分批核对与分段浏览</h2>
        </div>
      </div>
      <AstrolabeDynamicRangeControls state={state} error={error} />
      {state.branches.length ? (
        <div className="result-side-card" style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
          <h3>已完成分段</h3>
          <nav aria-label="出生区间分段" className="result-chip-row">
            {state.branches
              .slice(page * BRANCH_PAGE_SIZE, (page + 1) * BRANCH_PAGE_SIZE)
              .map((item) => (
                <button
                  className={
                    item.index === index ? 'result-chip result-chip-highlight' : 'result-chip'
                  }
                  type="button"
                  key={item.index}
                  aria-pressed={item.index === index}
                  onClick={() => choose(item.index)}
                >
                  第 {item.index + 1} 段 ·{' '}
                  {formatAstrolabeBirthRangeTime(item.startTimestamp).slice(11)}
                </button>
              ))}
          </nav>
          <div className="result-chip-row">
            <button
              className="result-chip"
              type="button"
              disabled={page === 0}
              onClick={() => choose((page - 1) * BRANCH_PAGE_SIZE)}
            >
              上一页分段
            </button>
            <span>
              第 {page + 1} / {Math.ceil(state.branches.length / BRANCH_PAGE_SIZE)} 页
            </span>
            <button
              className="result-chip"
              type="button"
              disabled={(page + 1) * BRANCH_PAGE_SIZE >= state.branches.length}
              onClick={() => choose((page + 1) * BRANCH_PAGE_SIZE)}
            >
              下一页分段
            </button>
          </div>
          {readError ? (
            <p className="error-text" role="alert">
              {readError}
            </p>
          ) : branch ? (
            <BranchDetails key={`${state.key}:${index}:${branch.startTimestamp}`} branch={branch} />
          ) : (
            <p role="status">正在读取当前分段。</p>
          )}
        </div>
      ) : null}
    </section>
  );
});

export function AstrolabeDynamicRangeControls({ state, error }: Props) {
  return (
    <div className="astrolabe-dynamic-range-panel">
      <p>每批核对约一分钟出生范围，在完整分段边界暂停。可继续下一批，或计算剩余全部。</p>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="result-chip-row">
        {!state.loading ? (
          <button
            className="result-chip"
            type="button"
            disabled={!state.key || Boolean(error)}
            onClick={state.start}
          >
            {state.branches.length || state.error ? '重新核对' : '开始核对'}
          </button>
        ) : null}
        {state.paused ? (
          <button className="result-chip" type="button" onClick={() => state.continueCalculation()}>
            继续一批
          </button>
        ) : null}
        {state.loading ? (
          <>
            <button
              className="result-chip"
              type="button"
              onClick={() => state.continueCalculation(true)}
            >
              计算剩余全部
            </button>
            <button className="result-chip" type="button" onClick={state.cancel}>
              停止计算
            </button>
          </>
        ) : null}
      </div>
      <p role="status">
        {state.summary
          ? `已完整核对 ${state.summary.sampleCount} 秒，共 ${state.summary.branchCount} 段。`
          : state.progress.total
            ? `已核对 ${state.progress.completed} / ${state.progress.total} 秒，已保存 ${state.branches.length} 段。${state.paused ? '等待继续。' : state.loading ? '正在计算。' : ''}当前资料仅覆盖已完成部分。`
            : state.loading
              ? '正在准备区间计算。'
              : '尚未开始核对。'}
      </p>
      {state.error ? (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
