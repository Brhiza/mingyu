import React, { useMemo, useState } from 'react';
import type { AnalysisPayloadV1 } from '@/types/analysis';
import { getZiweiStarClassic } from 'mingyu-core/classics';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import { useMetaphysicsTermModal } from '@/components/TermExplanationModal';
import { ChartShareModal } from '@/components/ChartShareModal';
import { ZIWEI_GRID_ORDER } from '../ResultPage.constants';
import { getZiweiDisplaySurroundedPalaces, joinStarNames } from '../ResultPage.helpers';
import { ChartStarLine } from './ChartStar';

const ZIWEI_PALACE_CENTER: Record<number, readonly [number, number]> = {
  0: [12.5, 87.5],
  1: [12.5, 62.5],
  2: [12.5, 37.5],
  3: [12.5, 12.5],
  4: [37.5, 12.5],
  5: [62.5, 12.5],
  6: [87.5, 12.5],
  7: [87.5, 37.5],
  8: [87.5, 62.5],
  9: [87.5, 87.5],
  10: [62.5, 87.5],
  11: [37.5, 87.5],
};

export function ZiweiTraditionalBoard(props: {
  payload: AnalysisPayloadV1;
  boardTitle: string;
  name: string;
  selectedPalaceIndex: number;
  onSelectPalace: (index: number) => void;
  isInstant?: boolean;
}) {
  const {
    payload,
    boardTitle,
    name,
    selectedPalaceIndex,
    onSelectPalace,
    isInstant = false,
  } = props;
  const { openTerm } = useMetaphysicsTermModal();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const selectedPalace =
    payload.palaces.find((item) => item.index === selectedPalaceIndex) ?? payload.palaces[0];
  const palaceMap = new Map(payload.palaces.map((item) => [item.index, item]));
  const oppositePalace = palaceMap.get(selectedPalace.opposite_palace_index)?.name ?? '暂无';
  const surroundedPalaces = getZiweiDisplaySurroundedPalaces(payload, selectedPalace);
  const surroundedIndexSet = new Set(surroundedPalaces.map((palace) => palace.index));
  const surrounded = surroundedPalaces.map((palace) => palace.name).join('、') || '暂无';
  const selectedPoint = ZIWEI_PALACE_CENTER[selectedPalace.index];
  const oppositePoint = ZIWEI_PALACE_CENTER[selectedPalace.opposite_palace_index];
  const trinePoints = surroundedPalaces
    .filter((palace) => palace.index !== selectedPalace.opposite_palace_index)
    .map((palace) => ZIWEI_PALACE_CENTER[palace.index])
    .filter((point): point is readonly [number, number] => Boolean(point));
  const trianglePoints = selectedPoint ? [selectedPoint, ...trinePoints].slice(0, 3) : [];
  const centerFocusTags = isInstant
    ? []
    : uniqueNonEmptyStrings(selectedPalace.scope_hits).slice(0, 2);
  const centerSummaryTags =
    centerFocusTags.length === 0
      ? uniqueNonEmptyStrings(selectedPalace.summary_tags)
          .filter((item) => !isInstant || !item.includes('童限'))
          .slice(0, 2)
      : [];
  const fourPillars = payload.basic_info.four_pillars
    ? [
        payload.basic_info.four_pillars.year_pillar,
        payload.basic_info.four_pillars.month_pillar,
        payload.basic_info.four_pillars.day_pillar,
        payload.basic_info.four_pillars.hour_pillar,
      ].join(' ')
    : '';

  const formatZiweiChartText = () => {
    const lines = [
      `【紫微斗数命盘 · ${name}】`,
      `局数：${payload.basic_info.five_elements_class}  命主：${payload.basic_info.soul}  身主：${payload.basic_info.body}`,
      `阳历：${payload.basic_info.solar_date}  农历：${payload.basic_info.lunar_date}`,
      fourPillars ? `四柱：${fourPillars}` : '',
      `命宫：${payload.basic_info.soul_palace_branch}  身宫：${payload.basic_info.body_palace_branch}`,
      `当前焦点：【${selectedPalace.name}】（主星：${joinStarNames(selectedPalace.major_stars, '无主星')}） 对宫：【${oppositePalace}】 三方：【${surrounded}】`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  const activeScopeMutagens = uniqueNonEmptyStrings(
    payload.active_scope.mutagen_map.map((item) => {
      const palaceName = item.dynamic_palace_name || item.palace_name;
      return `${item.star}化${item.mutagen}${palaceName ? `入${palaceName}` : ''}`;
    }),
  );

  const [classicExpanded, setClassicExpanded] = useState(true);
  const majorStarClassic = useMemo(() => {
    const star = selectedPalace.major_stars[0]?.name;
    return star ? getZiweiStarClassic(star) : undefined;
  }, [selectedPalace.major_stars]);

  return (
    <section className="ziwei-traditional-shell">
      <div className="ziwei-traditional-head">
        <div>
          <h3>{boardTitle}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="bazi-share-chart-btn"
            onClick={() => setIsShareModalOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            分享排盘
          </button>
          <span className="result-chip result-chip-highlight">{payload.active_scope.label}</span>
        </div>
      </div>

      <div className="ziwei-traditional-board">
        <div className="ziwei-board-note ziwei-board-note-top-left">
          命宫支
          <strong>{payload.basic_info.soul_palace_branch}</strong>
        </div>
        <div className="ziwei-board-note ziwei-board-note-top-right">
          身宫支
          <strong>{payload.basic_info.body_palace_branch}</strong>
        </div>
        <div className="ziwei-board-note ziwei-board-note-bottom-left">
          {payload.basic_info.chinese_date}
        </div>
        <div className="ziwei-board-note ziwei-board-note-bottom-right">
          {payload.basic_info.birth_time_label}
        </div>

        {trianglePoints.length === 3 && oppositePoint ? (
          <svg
            className="ziwei-relation-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              className="ziwei-relation-triangle"
              points={trianglePoints.map((point) => point.join(',')).join(' ')}
            />
            <line
              className="ziwei-relation-opposite-line"
              x1={selectedPoint[0]}
              y1={selectedPoint[1]}
              x2={oppositePoint[0]}
              y2={oppositePoint[1]}
            />
            {[...trianglePoints, oppositePoint].map((point, index) => (
              <circle
                className="ziwei-relation-point"
                cx={point[0]}
                cy={point[1]}
                r="0.65"
                key={`${point.join('-')}-${index}`}
              />
            ))}
          </svg>
        ) : null}

        <div className="ziwei-traditional-grid">
          {ZIWEI_GRID_ORDER.map((item, index) => {
            if (item === 'center') {
              return (
                <div className="ziwei-board-center chart-center" key={`center-${index}`}>
                  <div className="ziwei-board-center-head chart-center-head">
                    <div className="chart-center-scope">{payload.active_scope.label}</div>
                    <div className="chart-center-age">
                      {!isInstant && payload.active_scope.nominal_age > 0
                        ? `${payload.active_scope.nominal_age} 岁`
                        : isInstant
                          ? '即时盘'
                          : '本命盘'}
                    </div>
                  </div>
                  <div className="chart-center-info">
                    <div className="chart-center-info-row chart-center-info-wide">
                      <span>命盘</span>
                      <strong>{isInstant ? name : `${name} · ${payload.basic_info.gender}`}</strong>
                    </div>
                    <div className="chart-center-info-row">
                      <span>生肖</span>
                      <strong>
                        {payload.basic_info.zodiac} · {payload.basic_info.sign}
                      </strong>
                    </div>
                    <div className="chart-center-info-row">
                      <span>阳历</span>
                      <strong>{payload.basic_info.solar_date}</strong>
                    </div>
                    <div className="chart-center-info-row chart-center-info-wide">
                      <span>农历</span>
                      <strong>{payload.basic_info.lunar_date}</strong>
                    </div>
                    <div className="chart-center-info-row">
                      <span>时辰</span>
                      <strong>{payload.basic_info.birth_time_label}</strong>
                    </div>
                    {fourPillars ? (
                      <div className="chart-center-info-row chart-center-info-wide">
                        <span>四柱</span>
                        <strong>{fourPillars}</strong>
                      </div>
                    ) : null}
                    {payload.active_scope.scope !== 'origin' ? (
                      <div className="chart-center-info-row chart-center-info-wide">
                        <span>当前</span>
                        <strong>{payload.active_scope.solar_date}</strong>
                      </div>
                    ) : null}
                  </div>
                  <div className="chart-center-meta chart-center-grid">
                    <div
                      className="chart-center-chip is-clickable-term"
                      onClick={() => openTerm('命宫')}
                    >
                      命主 {payload.basic_info.soul}
                    </div>
                    <div
                      className="chart-center-chip is-clickable-term"
                      onClick={() => openTerm('身宫')}
                    >
                      身主 {payload.basic_info.body}
                    </div>
                    <div className="chart-center-chip">
                      {payload.basic_info.five_elements_class}
                    </div>
                    <div
                      className="chart-center-chip is-clickable-term"
                      onClick={() => openTerm('命宫')}
                    >
                      命宫 {payload.basic_info.soul_palace_branch}
                    </div>
                    <div
                      className="chart-center-chip is-clickable-term"
                      onClick={() => openTerm('身宫')}
                    >
                      身宫 {payload.basic_info.body_palace_branch}
                    </div>
                  </div>
                  {activeScopeMutagens.length ? (
                    <div className="chart-center-mutagens" aria-label="当前四化落宫">
                      {activeScopeMutagens.map((item) => (
                        <span
                          key={item}
                          className="is-clickable-term"
                          onClick={() => openTerm('四化')}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="ziwei-board-center-relation chart-center-focus">
                    <div className="chart-center-focus-label">当前宫位</div>
                    <div className="ziwei-board-center-name chart-center-focus-name">
                      {selectedPalace.name}
                    </div>
                    <div className="ziwei-board-center-stars chart-center-focus-stars">
                      {joinStarNames(selectedPalace.major_stars, '无主星')}
                    </div>
                    <div className="chart-center-relations">
                      <div
                        className="chart-center-relation-row is-clickable-term"
                        onClick={() => openTerm('对宫')}
                      >
                        <span className="chart-center-relation-label">对宫</span>
                        <span className="chart-center-relation-value">{oppositePalace}</span>
                      </div>
                      <div
                        className="chart-center-relation-row is-clickable-term"
                        onClick={() => openTerm('三方四正')}
                      >
                        <span className="chart-center-relation-label">三方四正</span>
                        <span className="chart-center-relation-value">{surrounded}</span>
                      </div>
                    </div>
                    <div className="chart-center-badges">
                      {centerFocusTags.map((tag) => (
                        <span
                          className="chart-center-chip chart-center-chip-strong"
                          key={`${selectedPalace.index}-focus-${tag}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {centerSummaryTags.map((tag) => (
                        <span
                          className="chart-center-chip"
                          key={`${selectedPalace.index}-summary-${tag}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            if (item === 'center-skip') {
              return (
                <div
                  className="ziwei-board-center ziwei-board-center-empty"
                  key={`empty-${index}`}
                />
              );
            }

            const palace = palaceMap.get(item);
            if (!palace) return null;
            const isActive = palace.index === selectedPalaceIndex;
            const isOpposite = palace.index === selectedPalace.opposite_palace_index;
            const isSurrounded = surroundedIndexSet.has(palace.index);
            const footerBadges = uniqueNonEmptyStrings([
              palace.dynamic_scope_name,
              !isInstant && palace.changsheng12 ? `长生 ${palace.changsheng12}` : '',
              !isInstant && palace.boshi12 ? `博士 ${palace.boshi12}` : '',
              palace.base_jiangqian12 ? `将前 ${palace.base_jiangqian12}` : '',
              palace.base_suiqian12 ? `岁前 ${palace.base_suiqian12}` : '',
              payload.active_scope.scope === 'origin' || !palace.yearly_jiangqian12
                ? ''
                : `流年将前 ${palace.yearly_jiangqian12}`,
              payload.active_scope.scope === 'origin' || !palace.yearly_suiqian12
                ? ''
                : `流年岁前 ${palace.yearly_suiqian12}`,
            ]);

            return (
              <button
                type="button"
                className={`ziwei-grid-cell chart-cell ${isActive ? 'is-active is-selected' : ''} ${
                  palace.is_body_palace ? 'is-body-palace' : ''
                } ${isOpposite ? 'is-opposite is-relation-opposite' : ''} ${
                  isSurrounded ? 'is-surrounded is-relation-surrounded' : ''
                }`}
                key={palace.index}
                onClick={() => onSelectPalace(palace.index)}
              >
                <div className="ziwei-grid-cell-corner chart-cell-corner chart-cell-corner-left">
                  {palace.heavenly_stem}
                  {palace.earthly_branch}
                </div>
                <div className="ziwei-grid-cell-corner chart-cell-corner chart-cell-corner-right">
                  {palace.decadal_range[0]}-{palace.decadal_range[1]}
                </div>
                <div className="chart-cell-body">
                  <div className="ziwei-grid-cell-title chart-cell-title-stack">
                    <span className="chart-cell-title">{palace.name}</span>
                    <div className="ziwei-grid-cell-flags chart-cell-flags">
                      {palace.is_body_palace ? <span className="chart-cell-flag">身</span> : null}
                      {palace.is_original_palace ? (
                        <span className="chart-cell-flag">因</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="chart-cell-star-layers">
                    <ChartStarLine
                      fallback="无主星"
                      layout="wrap"
                      stars={palace.major_stars}
                      tone="major"
                    />
                    <ChartStarLine layout="wrap" stars={palace.minor_stars} tone="minor" />
                    <ChartStarLine layout="wrap" stars={palace.other_stars} tone="other" />
                    <ChartStarLine layout="wrap" stars={palace.scope_stars} tone="scope" />
                  </div>
                </div>
                {palace.ages.length > 0 ? (
                  <div className="chart-cell-age-cycle" title="本宫流年虚岁序列">
                    流年 {palace.ages.join('·')}
                  </div>
                ) : null}
                <div className="ziwei-grid-cell-foot chart-cell-foot">
                  {footerBadges.map((item) => (
                    <span className="chart-cell-badge" key={`${palace.index}-${item}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {majorStarClassic ? (
        <div className="traditional-classic-card ziwei-classic-card">
          <div
            className="traditional-classic-head"
            onClick={() => setClassicExpanded(!classicExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setClassicExpanded(!classicExpanded);
            }}
            role="button"
            tabIndex={0}
          >
            <div>
              <span className="traditional-classic-badge">诸星问答论</span>
              <strong>
                {selectedPalace.name} · {majorStarClassic.star}星精解
              </strong>
            </div>
            <span className="traditional-classic-toggle">
              {classicExpanded ? '收起典籍 ▴' : '展开典籍 ▾'}
            </span>
          </div>
          {classicExpanded ? (
            <div className="traditional-classic-body">
              <p className="traditional-classic-verse">{majorStarClassic.verse}</p>
              <p className="traditional-classic-advice">
                {`【星性象意】${majorStarClassic.nature}\n【行事运途】${majorStarClassic.careerAdvice}`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isShareModalOpen ? (
        <ChartShareModal
          chartTitle={`紫微斗数 · ${name}`}
          chartMethodName="紫微斗数"
          chartText={formatZiweiChartText()}
          timeLabel={payload.basic_info.solar_date}
          extraMeta={[
            { label: '局数', value: payload.basic_info.five_elements_class },
            { label: '命主', value: payload.basic_info.soul },
            { label: '身主', value: payload.basic_info.body },
            { label: '焦点宫位', value: selectedPalace.name },
          ]}
          onClose={() => setIsShareModalOpen(false)}
        />
      ) : null}
    </section>
  );
}
