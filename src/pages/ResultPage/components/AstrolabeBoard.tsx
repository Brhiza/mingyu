import { memo } from 'react';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import type { AstrolabePeriodEvent } from '@/lib/astrolabe-scope';
import type { AstrolabeData } from '@/types/divination';

function findPlanet(data: AstrolabeData, name: string) {
  return data.planets.find((item) => item.name === name)?.formatted || '未知';
}

function findAngle(data: AstrolabeData, name: string) {
  return data.angles.find((item) => item.name === name)?.formatted || '未知';
}

export const AstrolabeBoard = memo(function AstrolabeBoard(props: {
  title: string;
  name: string;
  data: AstrolabeData;
  isInstant?: boolean;
  timeBasisLabel?: string;
  periodEvents?: AstrolabePeriodEvent[];
  periodRangeLabel?: string;
}) {
  const {
    title,
    name,
    data,
    isInstant = false,
    timeBasisLabel,
    periodEvents = [],
    periodRangeLabel,
  } = props;
  const highlightAspects = data.aspects.slice(0, 4);
  const retrogradeText =
    data.summary.retrograde.length > 0 ? data.summary.retrograde.join('、') : '无';

  return (
    <section className="result-showcase-card astrolabe-showcase-card traditional-chart-layout">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          {isInstant && timeBasisLabel ? (
            <span className="result-chip result-chip-highlight">{timeBasisLabel}</span>
          ) : null}
          <span className="result-chip">{data.birth.dateTime}</span>
          <span className="result-chip">{data.birth.location}</span>
        </div>
      </div>

      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>太阳</span>
          <strong>{findPlanet(data, 'Sun')}</strong>
          <small>人格主轴</small>
        </div>
        <div className="result-stat-card">
          <span>月亮</span>
          <strong>{findPlanet(data, 'Moon')}</strong>
          <small>情绪需求</small>
        </div>
        <div className="result-stat-card">
          <span>上升</span>
          <strong>{findAngle(data, 'Ascendant')}</strong>
          <small>外在风格</small>
        </div>
        <div className="result-stat-card">
          <span>相位数量</span>
          <strong>{data.aspects.length}</strong>
          <small>
            宫位 {data.houses.length} / 星体 {data.planets.length}
          </small>
        </div>
      </div>

      <div className="astrolabe-board-layout">
        <div className="astrolabe-board-main">
          <div className="result-side-card astrolabe-chart-shell">
            <div className="result-side-head">
              <h3>星盘图</h3>
              <p>结合星体、宫位与主要相位查看整体结构。</p>
            </div>
            <AstrolabeChart data={data} showHeader={false} />
          </div>
        </div>

        <div className="astrolabe-board-side">
          <div className="result-side-card">
            <div className="result-side-head">
              <h3>盘面摘要</h3>
            </div>
            <div className="result-meta-lines">
              <div>
                <span>{isInstant ? '起盘时间' : '出生信息'}</span>
                <strong>{data.birth.dateTime}</strong>
              </div>
              <div>
                <span>{isInstant ? '观测地点' : '出生地'}</span>
                <strong>{data.birth.location}</strong>
              </div>
              <div>
                <span>逆行星体</span>
                <strong>{retrogradeText}</strong>
              </div>
              <div>
                <span>宫位结构</span>
                <strong>
                  {data.houses
                    .map((item) => item.label)
                    .slice(0, 4)
                    .join('、')}
                  ...
                </strong>
              </div>
            </div>
          </div>

          <div className="result-side-card">
            <div className="result-side-head">
              <h3>核心落点</h3>
            </div>
            <div className="result-tag-cloud">
              <span className="result-soft-tag result-soft-tag-strong">
                太阳 {findPlanet(data, 'Sun')}
              </span>
              <span className="result-soft-tag result-soft-tag-strong">
                月亮 {findPlanet(data, 'Moon')}
              </span>
              <span className="result-soft-tag result-soft-tag-strong">
                上升 {findAngle(data, 'Ascendant')}
              </span>
              <span className="result-soft-tag">天顶 {findAngle(data, 'Midheaven')}</span>
            </div>
          </div>

          <div className="result-side-card">
            <div className="result-side-head">
              <h3>主要相位</h3>
            </div>
            <div className="astrolabe-aspect-list">
              {highlightAspects.map((aspect, index) => (
                <div
                  className="astrolabe-aspect-item"
                  key={`${aspect.body1}-${aspect.body2}-${index}`}
                >
                  <strong>
                    {aspect.body1} - {aspect.body2}
                  </strong>
                  <span>{aspect.type}</span>
                </div>
              ))}
              {highlightAspects.length === 0 ? (
                <div className="astrolabe-aspect-item is-empty">
                  <span>暂无主要相位摘要</span>
                </div>
              ) : null}
            </div>
          </div>

          {periodEvents.length > 0 ? (
            <div className="result-side-card">
              <div className="result-side-head">
                <h3>周期关键星象</h3>
                <p>
                  {periodRangeLabel
                    ? `${periodRangeLabel}，共 ${periodEvents.length} 项精准相位、停逆、换座、换宫、朔望与交食。`
                    : `共 ${periodEvents.length} 项精准相位、停逆、换座、换宫、朔望与交食。`}
                </p>
              </div>
              <div className="astrolabe-period-event-list">
                {periodEvents.map((event) => (
                  <div className="astrolabe-period-event-item" key={event.key}>
                    <div>
                      <strong>{event.promptText}</strong>
                      <span>{event.dateTime}</span>
                    </div>
                    <em>{event.kind}</em>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
});
