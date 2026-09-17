import type { BirthProfile } from 'mingyu-core/profile';
import type { useBaziRangeCalculations } from '../hooks/useBaziRangeCalculations';
import { BaziChartBoard } from './BaziChartBoard';
import './BaziBirthRangePanel.css';

type RangeState = ReturnType<typeof useBaziRangeCalculations>;

function formatBirthTime(profile: BirthProfile, timestamp?: number) {
  if (timestamp !== undefined) {
    return `${new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')}（北京时间）`;
  }
  const date = `${profile.calendarType === 'lunar' ? '农历' : '公历'}${profile.year}年${profile.month}月${profile.day}日`;
  return profile.hour !== undefined && profile.minute !== undefined
    ? `${date} ${String(profile.hour).padStart(2, '0')}:${String(profile.minute).padStart(2, '0')}${profile.second === undefined ? '' : `:${String(profile.second).padStart(2, '0')}`}`
    : `${date} · 固定出生时辰`;
}

/** 各排盘视图共享同一个出生样本游标。 */
export function BirthRangeNavigator({ state }: { state: RangeState }) {
  const { page, loading, error, paused } = state;
  const isPair = Boolean(page?.partner);
  return (
    <div className="birth-range-navigator" aria-busy={loading}>
      <div className="bazi-birth-range-toolbar">
        <div>
          <h3>出生时间区间</h3>
          <p>逐秒查看盘面变化；当前结果对应下方列出的具体出生时间。</p>
        </div>
        <div className="bazi-birth-range-navigation" aria-label="出生区间翻页">
          <button type="button" onClick={state.previous} disabled={loading || state.index <= 0}>
            上一条
          </button>
          <span role="status" aria-live="polite">
            {state.total > 0
              ? `第 ${(state.index + 1).toLocaleString('zh-CN')} / ${state.total.toLocaleString('zh-CN')} ${isPair ? '组' : '条'}`
              : '等待计算'}
          </span>
          <button
            type="button"
            onClick={state.next}
            disabled={loading || !page || page.nextIndex === null}
          >
            下一条
          </button>
          {loading ? (
            <button type="button" onClick={state.cancel}>
              取消计算
            </button>
          ) : null}
          {paused ? (
            <button type="button" onClick={state.resume}>
              继续计算
            </button>
          ) : null}
          {error ? (
            <button type="button" onClick={state.retry}>
              重新计算
            </button>
          ) : null}
          {state.total > 1 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const index = Number(new FormData(event.currentTarget).get('index')) - 1;
                if (Number.isSafeInteger(index) && index >= 0 && index < state.total)
                  state.goTo(index);
              }}
            >
              <label>
                条目{' '}
                <input
                  key={state.index}
                  name="index"
                  type="number"
                  min={1}
                  max={state.total}
                  step={1}
                  defaultValue={state.index + 1}
                  required
                  aria-label="跳转到条目"
                />
              </label>
              <button type="submit" disabled={loading}>
                跳转
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {loading ? <p role="status">正在计算当前出生时间的完整盘面…</p> : null}
      {paused ? <p role="status">计算已暂停，可以继续读取当前条目。</p> : null}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {page ? (
        <>
          {[page.primarySource, page.partnerSource].map((source, index) =>
            source ? (
              <p className="bazi-birth-range-time" key={index}>
                {isPair ? `${index === 0 ? '第一人' : '第二人'}出生区间：` : '出生区间：'}
                {new Date(source.startTimestamp + 8 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')}{' '}
                至{' '}
                {new Date(source.endTimestamp + 8 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 19)
                  .replace('T', ' ')}
                （北京时间，终点不含）
              </p>
            ) : null,
          )}
          {[page.primary, ...(page.partner ? [page.partner] : [])].map((person, index) => (
            <p className="bazi-birth-range-time" key={`${page.index}:${index}`}>
              {isPair ? `${index === 0 ? '第一人' : '第二人'}当前出生时间：` : '当前出生时间：'}
              {formatBirthTime(person.profile, person.timestamp)}
            </p>
          ))}
        </>
      ) : null}
    </div>
  );
}

/** 在原有八字盘面中逐条查看出生区间的实际计算结果。 */
export function BaziBirthRangePanel({ state }: { state: RangeState }) {
  const { page } = state;
  const isPair = Boolean(page?.partner);
  return (
    <div className="bazi-birth-range">
      <BirthRangeNavigator state={state} />
      {page ? (
        <>
          <div className={isPair ? 'result-dual-layout' : undefined}>
            {[page.primary, ...(page.partner ? [page.partner] : [])].map((person, index) => (
              <BaziChartBoard
                key={`${page.index}:${index}`}
                title={isPair ? `${index === 0 ? '第一人' : '第二人'}八字` : '八字总览'}
                name={person.profile.name || (isPair ? `第${index + 1}人` : '当前命盘')}
                result={person.result}
              />
            ))}
          </div>
          {page.compatibility ? (
            <details className="bazi-birth-range-relations">
              <summary>当前出生组合的合盘资料</summary>
              <pre>{page.compatibility.promptText}</pre>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
