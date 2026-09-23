import { memo } from 'react';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';
import { AstrolabeChart } from '@/components/AstrolabeChart';
import type {
  AstrolabeScopeContext,
  AstrolabePeriodAxisItem,
  AstrolabePeriodEvent,
  AstrolabePeriodTransitGroup,
  AstrolabePeriodWindow,
} from '@/lib/astrolabe-scope';
import type { AstrolabeData } from '@/types/divination';

function findPlanet(data: AstrolabeData, name: string) {
  return data.planets.find((item) => item.name === name)?.formatted || '未知';
}

function findAngle(data: AstrolabeData, name: string) {
  return data.angles.find((item) => item.name === name)?.formatted || '未知';
}

function formatAdvancedPosition(
  point: NonNullable<
    AstrolabeScopeContext['secondaryProgressionEvidence']
  >['movingPointFacts'][number],
) {
  return `${point.label}${point.signLabel}${point.degree}°${String(point.minute).padStart(2, '0')}′${point.house ? `，第${point.house}宫` : ''}${point.retrograde ? '，逆行' : ''}`;
}

function formatAdvancedAspect(
  aspect: NonNullable<AstrolabeScopeContext['solarArcEvidence']>['aspectFacts'][number],
) {
  return `${aspect.movingPoint}${aspect.aspectName}${aspect.natalPoint}（偏差${aspect.deviation.toFixed(2)}°，容许${aspect.allowedOrb}°）`;
}

export const AstrolabeBoard = memo(function AstrolabeBoard(props: {
  title: string;
  name: string;
  data: AstrolabeData;
  isInstant?: boolean;
  timeBasisLabel?: string;
  birthTimeRange?: BaziReverseSource | null;
  representativeTime?: string;
  periodEvents?: AstrolabePeriodEvent[];
  periodRangeLabel?: string;
  periodAxis?: AstrolabePeriodAxisItem[];
  periodWindows?: AstrolabePeriodWindow[];
  periodGroups?: AstrolabePeriodTransitGroup[];
  advancedScopeContext?: AstrolabeScopeContext | null;
}) {
  const {
    title,
    name,
    data,
    isInstant = false,
    timeBasisLabel,
    birthTimeRange,
    representativeTime,
    periodEvents = [],
    periodRangeLabel,
    periodAxis = [],
    periodWindows = [],
    periodGroups = [],
    advancedScopeContext,
  } = props;
  const range = isInstant ? null : birthTimeRange;
  const hasRepresentativeTime = !isInstant && Boolean(range || representativeTime);
  const displayedTime = isInstant
    ? data.birth.dateTime
    : (representativeTime ?? range?.intervalStart ?? data.birth.dateTime);
  const highlightAspects = data.aspects.slice(0, 4);
  const retrogradeText =
    data.summary.retrograde.length > 0 ? data.summary.retrograde.join('、') : '无';
  const returnPeriods = advancedScopeContext?.solarReturnPeriods;
  const returnTechniques = returnPeriods?.length
    ? returnPeriods.map((period) => ({
        key: `solar-return-${period.evidence.targetYear}`,
        title: `太阳返照 · ${period.evidence.targetYear}年返照`,
        evidence: period.evidence,
        detail: `返照时刻 ${period.evidence.dateTime} · 年内有效 ${period.startsAt} 至 ${period.endsAt}${period.isReferencePeriod ? ' · 参考日有效' : ''}`,
      }))
    : [
        {
          key: 'solar-return',
          title: '太阳返照',
          evidence: advancedScopeContext?.solarReturnEvidence,
          detail: advancedScopeContext?.solarReturnEvidence?.dateTime
            ? `返照时刻 ${advancedScopeContext.solarReturnEvidence.dateTime}`
            : '按本命太阳黄经定位周年返照',
        },
      ];
  const advancedTechniques = advancedScopeContext
    ? [
        ...returnTechniques,
        {
          key: 'secondary-progression',
          title: '次限推进',
          evidence: advancedScopeContext.secondaryProgressionEvidence,
          detail: advancedScopeContext.secondaryProgressionEvidence?.progressedDateTime
            ? `一岁一日 · ${advancedScopeContext.secondaryProgressionEvidence.progressedDateTime}`
            : '按一岁一日映射长期发展',
        },
        {
          key: 'solar-arc',
          title: '太阳弧',
          evidence: advancedScopeContext.solarArcEvidence,
          detail:
            advancedScopeContext.solarArcEvidence?.arcDegrees !== undefined
              ? `推进弧 ${advancedScopeContext.solarArcEvidence.arcDegrees.toFixed(2)}°`
              : '按推进太阳弧度平移本命点',
        },
      ].filter((item) => item.evidence)
    : [];

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
          <span className="result-chip">
            {hasRepresentativeTime ? '代表时刻：' : ''}
            {displayedTime}
          </span>
          <span className="result-chip">{data.birth.location}</span>
          {data.houseSystem && (
            <span className="result-chip">
              {data.houseSystem === 'whole_sign' ? '整宫制' : '普拉西德斯宫制'}
            </span>
          )}
        </div>
      </div>

      {Boolean(data.ephemerisWarnings?.length) && (
        <div className="result-side-card" role="note" aria-label="星历精度">
          {data.ephemerisWarnings!.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

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
                <span>
                  {isInstant ? '起盘时间' : hasRepresentativeTime ? '代表时刻' : '出生信息'}
                </span>
                <strong>{displayedTime}</strong>
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

          {advancedTechniques.length > 0 ? (
            <div className="result-side-card">
              <div className="result-side-head">
                <h3>年度高级推运</h3>
                <p>结合太阳返照、次限推进、太阳弧与行运查看年度线索。</p>
              </div>
              <div className="astrolabe-period-group-list">
                {advancedTechniques.map((item) => {
                  const evidence = item.evidence!;
                  const solarReturnChart =
                    'returnChart' in evidence ? evidence.returnChart : undefined;
                  const positions = evidence.movingPointFacts.slice(0, 4);
                  const aspects = evidence.aspectFacts.slice(0, 3);
                  const statusLabel =
                    evidence.status === 'unavailable'
                      ? '不可用'
                      : evidence.status === 'not-applicable'
                        ? '不适用'
                        : evidence.status === 'approximate'
                          ? '近似值'
                          : '已计算';
                  return (
                    <div className="astrolabe-period-event-item" key={item.key}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                        {positions.length > 0 ? (
                          <span>{positions.map(formatAdvancedPosition).join('；')}</span>
                        ) : null}
                        {item.key.startsWith('solar-return') && solarReturnChart ? (
                          <span>
                            {solarReturnChart.angles
                              .slice(0, 2)
                              .map(formatAdvancedPosition)
                              .join('；')}
                            {`；${solarReturnChart.houses.length}个宫头；${solarReturnChart.internalAspectFacts.length}组返照盘内相位`}
                          </span>
                        ) : null}
                        {aspects.length > 0 ? (
                          <span>{aspects.map(formatAdvancedAspect).join('；')}</span>
                        ) : (
                          <span>{evidence.aspectSummaryFact.promptText}</span>
                        )}
                        {evidence.movingPointFacts.length > 0 ? (
                          <details className="astrolabe-advanced-details">
                            <summary>查看全部点位、宫位与相位</summary>
                            {item.key.startsWith('solar-return') && solarReturnChart ? (
                              <p>
                                返照地点：{solarReturnChart.location.name}；宫位制：
                                {solarReturnChart.houseSystem === 'whole_sign'
                                  ? '整宫制'
                                  : '普拉西德斯宫制'}
                              </p>
                            ) : null}
                            <h4>全部点位（{evidence.movingPointFacts.length}）</h4>
                            <ul>
                              {evidence.movingPointFacts.map((point) => (
                                <li key={point.key}>{formatAdvancedPosition(point)}</li>
                              ))}
                            </ul>
                            {item.key.startsWith('solar-return') && solarReturnChart ? (
                              <>
                                <h4>十二宫宫头</h4>
                                <ul>
                                  {solarReturnChart.houses.map((house) => (
                                    <li key={house.key}>
                                      第{house.house}宫 {house.signLabel}
                                      {house.degree}°{String(house.minute).padStart(2, '0')}′
                                    </li>
                                  ))}
                                </ul>
                                <h4>
                                  返照盘内相位（{solarReturnChart.internalAspectFacts.length}）
                                </h4>
                                {solarReturnChart.internalAspectFacts.length > 0 ? (
                                  <ul>
                                    {solarReturnChart.internalAspectFacts.map((aspect) => (
                                      <li key={aspect.key}>{aspect.promptText}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>当前容许度内未见主要盘内相位。</p>
                                )}
                              </>
                            ) : null}
                            <h4>对本命相位（{evidence.candidateAspectFacts.length}）</h4>
                            {evidence.candidateAspectFacts.length > 0 ? (
                              <ul>
                                {evidence.candidateAspectFacts.map((aspect) => (
                                  <li key={aspect.key}>{formatAdvancedAspect(aspect)}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>当前容许度内未见主要对本命相位。</p>
                            )}
                          </details>
                        ) : evidence.limitations.length > 0 ? (
                          <span>{evidence.limitations[0]}</span>
                        ) : null}
                      </div>
                      <em>{statusLabel}</em>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

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
                    ? `${periodRangeLabel}，共 ${periodEvents.length} 项。先看主轴和窗口，完整时刻在下方明细。`
                    : `共 ${periodEvents.length} 项。先看主轴和窗口，完整时刻在下方明细。`}
                </p>
              </div>
              {periodAxis.length > 0 ? (
                <div className="astrolabe-period-axis">
                  {periodAxis.map((item) => (
                    <span className="result-soft-tag result-soft-tag-strong" key={item.key}>
                      {item.promptText}
                    </span>
                  ))}
                </div>
              ) : null}
              {periodWindows.length > 0 ? (
                <div className="astrolabe-period-window-list">
                  {periodWindows.map((item) => (
                    <div
                      className="astrolabe-period-event-item"
                      key={`${item.startDateTime}-${item.endDateTime}`}
                    >
                      <div>
                        <strong>{item.promptText}</strong>
                        <span>关键窗口</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {periodGroups.length > 0 ? (
                <div className="astrolabe-period-group-list">
                  {periodGroups.map((item) => (
                    <div className="astrolabe-period-event-item" key={item.key}>
                      <div>
                        <strong>{item.promptText}</strong>
                        <span>过境归组</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
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
