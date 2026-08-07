import { memo, useEffect, useMemo, useState } from 'react';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import { createSecureId } from '@/lib/secure-id';
import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ZiweiRuntimeState } from '../ResultPage.types';
import { getZiweiDisplaySurroundedPalaces, joinText } from '../ResultPage.helpers';
import { createDisplayWorker } from '../utils/createDisplayWorker';
import { ZiweiTraditionalBoard } from './ZiweiTraditionalBoard';
import { ZiweiFortuneSelector } from './ZiweiFortuneSelector';

export const ZiweiBoard = memo(function ZiweiBoard(props: {
  title: string;
  name: string;
  payload: AnalysisPayloadV1;
  chartInput: ChartInput;
  runtime: NonNullable<ZiweiRuntimeState>;
}) {
  const { title, name, payload, chartInput, runtime } = props;
  const defaultContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const [selectedScope, setSelectedScope] = useState<ScopeType>(payload.active_scope.scope);
  const [selectedDateStr, setSelectedDateStr] = useState(payload.active_scope.solar_date);
  const [selectedHourIndex] = useState(defaultContext.hourIndex);
  const [displayPayload, setDisplayPayload] = useState(payload);
  const [isDisplayPayloadLoading, setIsDisplayPayloadLoading] = useState(false);
  const [selectedPalaceIndex, setSelectedPalaceIndex] = useState(
    payload.active_scope.palace_index ?? payload.palaces[0]?.index ?? 0,
  );
  const selectedPalace =
    displayPayload.palaces.find((item) => item.index === selectedPalaceIndex) ??
    displayPayload.palaces[0];
  const oppositePalace =
    displayPayload.palaces.find((item) => item.index === selectedPalace?.opposite_palace_index) ??
    null;
  const surroundedPalaces = getZiweiDisplaySurroundedPalaces(displayPayload, selectedPalace);
  const activeScopeMutagens = uniqueNonEmptyStrings(
    displayPayload.active_scope.mutagen_map.map((item) => `${item.mutagen} ${item.star}`),
  );
  const detailSummaryTags = selectedPalace
    ? uniqueNonEmptyStrings(selectedPalace.summary_tags)
    : [];
  const detailScopeHits = selectedPalace ? uniqueNonEmptyStrings(selectedPalace.scope_hits) : [];

  useEffect(() => {
    setSelectedScope(payload.active_scope.scope);
    setSelectedDateStr(payload.active_scope.solar_date);
    setDisplayPayload(payload);
  }, [payload]);

  useEffect(() => {
    if (
      selectedScope === payload.active_scope.scope &&
      selectedDateStr === payload.active_scope.solar_date
    ) {
      setDisplayPayload(payload);
      setIsDisplayPayloadLoading(false);
      return;
    }

    const requestId = `${selectedScope}-${selectedDateStr}-${createSecureId()}`;
    setIsDisplayPayloadLoading(true);

    return createDisplayWorker(
      {
        id: requestId,
        input: chartInput,
        dateStr: selectedDateStr,
        hourIndex: selectedHourIndex,
        scope: selectedScope,
      },
      (nextPayload) => {
        setDisplayPayload(nextPayload);
        setIsDisplayPayloadLoading(false);
      },
      () => {
        setIsDisplayPayloadLoading(false);
      },
    );
  }, [chartInput, payload, selectedDateStr, selectedHourIndex, selectedScope]);

  useEffect(() => {
    setSelectedPalaceIndex(
      displayPayload.active_scope.palace_index ?? displayPayload.palaces[0]?.index ?? 0,
    );
  }, [displayPayload]);

  return (
    <section className="result-showcase-card ziwei-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">{displayPayload.active_scope.label}</span>
          <span className="result-chip">{displayPayload.basic_info.birth_time_label}</span>
          <span className="result-chip">{displayPayload.basic_info.gender}</span>
        </div>
      </div>

      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>命主</span>
          <strong>{displayPayload.basic_info.soul}</strong>
          <small>命宫支 {displayPayload.basic_info.soul_palace_branch}</small>
        </div>
        <div className="result-stat-card">
          <span>身主</span>
          <strong>{displayPayload.basic_info.body}</strong>
          <small>身宫支 {displayPayload.basic_info.body_palace_branch}</small>
        </div>
        <div className="result-stat-card">
          <span>五行局</span>
          <strong>{displayPayload.basic_info.five_elements_class}</strong>
          <small>{displayPayload.basic_info.zodiac}</small>
        </div>
        <div className="result-stat-card">
          <span>当前时限</span>
          <strong>{displayPayload.active_scope.label}</strong>
          <small>{displayPayload.active_scope.solar_date}</small>
        </div>
      </div>

      <div className="ziwei-layout">
        <div className="ziwei-board-stack">
          <ZiweiTraditionalBoard
            payload={displayPayload}
            boardTitle="传统盘"
            name={name}
            selectedPalaceIndex={selectedPalaceIndex}
            onSelectPalace={setSelectedPalaceIndex}
          />
          {isDisplayPayloadLoading ? (
            <div className="ziwei-board-loading-mask" aria-hidden="true">
              <span className="skeleton-block ziwei-board-loading-pill" />
              <span className="skeleton-block ziwei-board-loading-line" />
              <span className="skeleton-block ziwei-board-loading-line ziwei-board-loading-line-short" />
            </div>
          ) : null}
        </div>

        <div className="ziwei-side-panel">
          <div className="ziwei-focus-card ziwei-summary-card">
            <div className="result-side-head">
              <h3>盘面摘要</h3>
            </div>
            <div className="result-meta-lines">
              <div>
                <span>阳历</span>
                <strong>{displayPayload.basic_info.solar_date}</strong>
              </div>
              <div>
                <span>农历</span>
                <strong>{displayPayload.basic_info.lunar_date}</strong>
              </div>
              <div>
                <span>生肖</span>
                <strong>{displayPayload.basic_info.zodiac}</strong>
              </div>
            </div>
            <div className="result-tag-cloud">
              {activeScopeMutagens.map((item) => (
                <span className="result-soft-tag result-soft-tag-strong" key={item}>
                  {item}
                </span>
              ))}
              {activeScopeMutagens.length === 0 ? (
                <span className="result-soft-tag">当前时限暂无四化标记</span>
              ) : null}
            </div>

            {selectedPalace ? (
              <div className="ziwei-detail-card">
                <div className="ziwei-detail-head">
                  <div>
                    <span className="ziwei-detail-kicker">当前宫位</span>
                    <h4>{selectedPalace.name}</h4>
                  </div>
                  <div className="result-chip-stack">
                    <span className="result-chip">
                      {selectedPalace.heavenly_stem}
                      {selectedPalace.earthly_branch}
                    </span>
                    {selectedPalace.dynamic_scope_name ? (
                      <span className="result-chip result-chip-highlight">
                        {selectedPalace.dynamic_scope_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="ziwei-detail-grid">
                  <div>
                    <span>主星</span>
                    <strong>
                      {joinText(
                        selectedPalace.major_stars.map((item) => item.name),
                        '无主星',
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>辅星</span>
                    <strong>
                      {joinText(
                        selectedPalace.minor_stars.map((item) => item.name),
                        '无',
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>对宫</span>
                    <strong>{oppositePalace?.name ?? '暂无'}</strong>
                  </div>
                  <div>
                    <span>三方四正</span>
                    <strong>
                      {joinText(
                        surroundedPalaces.map((item) => item.name),
                        '暂无',
                      )}
                    </strong>
                  </div>
                </div>
                <div className="result-tag-cloud">
                  {detailSummaryTags.map((tag) => (
                    <span className="result-soft-tag" key={`detail-${selectedPalace.index}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                  {detailScopeHits.map((tag) => (
                    <span
                      className="result-soft-tag result-soft-tag-strong"
                      key={`detail-scope-${selectedPalace.index}-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <ZiweiFortuneSelector
            chartInput={chartInput}
            payloadByScope={runtime.payloadByScope}
            decadalTimeline={runtime.decadalTimeline}
            selectedScope={selectedScope}
            selectedDateStr={selectedDateStr}
            onSelectScopeDate={(scope, dateStr) => {
              setSelectedScope(scope);
              setSelectedDateStr(dateStr);
            }}
          />
        </div>
      </div>
    </section>
  );
});
