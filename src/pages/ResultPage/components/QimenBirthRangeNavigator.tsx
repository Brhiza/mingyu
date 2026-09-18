import type { QimenLifetimeData } from '@/types/divination';

export function QimenBirthRangeNavigator({
  range,
  onChange,
}: {
  range: QimenLifetimeData['birthRange'];
  onChange?: (index: number) => void;
}) {
  return (
    <>
      {range ? (
        <section className="panel traditional-chart-card" aria-label="出生候选范围">
          <p>
            出生范围：
            {new Date(range.source.startTimestamp + 8 * 3600000)
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ')}{' '}
            至{' '}
            {new Date(range.source.endTimestamp + 8 * 3600000)
              .toISOString()
              .slice(0, 19)
              .replace('T', ' ')}
            （北京时间，终点不含）
          </p>
          <p>
            当前候选：
            {new Date(range.timestamp + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ')}
            。本页阶段与动态事实以该候选秒为条件。
          </p>
          {onChange ? (
            <div className="traditional-qimen-actions qimen-birth-range-navigation">
              <button type="button" disabled={range.index === 0} onClick={() => onChange(0)}>
                首秒
              </button>
              <button
                type="button"
                disabled={range.index === 0}
                onClick={() => onChange(range!.index - 1)}
              >
                上一秒
              </button>
              <label>
                候选序号{' '}
                <input
                  aria-label="奇门出生候选序号"
                  type="number"
                  min={1}
                  max={range.totalSamples}
                  key={range.timestamp}
                  defaultValue={range.index + 1}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  onBlur={(event) => {
                    const index = Number(event.target.value) - 1;
                    if (Number.isInteger(index) && index >= 0 && index < range!.totalSamples)
                      onChange(index);
                    else event.currentTarget.value = String(range!.index + 1);
                  }}
                />
              </label>
              <span>共 {range.totalSamples} 秒</span>
              <button
                type="button"
                disabled={range.nextIndex === null}
                onClick={() => onChange(range!.nextIndex!)}
              >
                下一秒
              </button>
              <button
                type="button"
                disabled={range.nextIndex === null}
                onClick={() => onChange(range!.totalSamples - 1)}
              >
                末秒
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
