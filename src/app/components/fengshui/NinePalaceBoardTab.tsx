import * as React from 'react';
import { Badge, Card, SegmentedTabs } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import type { PalaceViewModel, WorkbenchSnapshot } from './fengshui-engine';

type ViewLayerMode = 'hecan' | 'bazhai' | 'xuankong';

export function NinePalaceBoardTab({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const [layerMode, setLayerMode] = React.useState<ViewLayerMode>('hecan');
  const [selectedEarth, setSelectedEarth] = React.useState<number>(5);

  const selectedPalace: PalaceViewModel =
    snapshot.palaces.find((p) => p.earth === selectedEarth) ?? snapshot.palaces[4]!;

  const primaryResident = snapshot.residentAnalyses[0];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs<ViewLayerMode>
          value={layerMode}
          onValueChange={setLayerMode}
          ariaLabel="盘面图层模式"
          options={[
            { id: 'hecan', label: '八宅玄空合参' },
            { id: 'bazhai', label: '纯八宅' },
            { id: 'xuankong', label: '纯玄空飞星' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryResident ? (
            <Badge variant="accent">{`命卦 ${primaryResident.mingGua} · ${primaryResident.mingGroup}`}</Badge>
          ) : null}
          <Badge variant="outline">{`${snapshot.houseGua}宅 · ${snapshot.houseGroup}`}</Badge>
          {primaryResident ? (
            <Badge variant={primaryResident.matchWithHouse === '同组' ? 'good' : 'warn'}>
              {primaryResident.matchWithHouse}
            </Badge>
          ) : null}
          <Badge variant="accent">{snapshot.formation}</Badge>
        </div>
      </div>

      <div className="fs-board-split">
        <div className="fs-nine-grid" role="grid" aria-label="阳宅九宫总盘">
          {snapshot.palaces.map((p) => {
            const isSelected = p.earth === selectedEarth;
            const toneClass =
              p.earth === 5
                ? 'is-center'
                : layerMode === 'bazhai'
                  ? p.bazhai?.mingLuck === '吉'
                    ? 'is-good'
                    : 'is-warn'
                  : p.statusTone === 'good'
                    ? 'is-good'
                    : p.statusTone === 'warn'
                      ? 'is-warn'
                      : '';

            return (
              <button
                key={p.earth}
                type="button"
                onClick={() => setSelectedEarth(p.earth)}
                aria-pressed={isSelected}
                className={cn('fs-palace-cell', toneClass, isSelected && 'is-selected')}
              >
                <div className="fs-palace-head">
                  <span>{p.earth === 5 ? `中宫 · 5` : `${p.direction} · ${p.trigramSymbol}${p.palaceName.replace('宫', '')}${p.earth}`}</span>
                  {p.xuankong && (p.xuankong.hasFiveSha || p.xuankong.hasTwoSha) ? (
                    <span className="fs-mini-tag is-warn">
                      {p.xuankong.hasFiveSha ? '五黄' : '二黑'}
                    </span>
                  ) : null}
                </div>

                {layerMode !== 'bazhai' && p.xuankong ? (
                  <div className="fs-palace-stars">
                    <span className="fs-star-pair">{`山${p.xuankong.mountainStar} 向${p.xuankong.waterStar}`}</span>
                    <span className="fs-star-sub">
                      {[
                        `运${p.xuankong.periodStar}`,
                        p.xuankong.yearStar !== undefined ? `年${p.xuankong.yearStar}` : '',
                        p.xuankong.monthStar !== undefined ? `月${p.xuankong.monthStar}` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </div>
                ) : null}

                {p.earth === 5 ? (
                  <div className="text-[11.5px] font-bold text-[var(--text-secondary)]">
                    {`坐${snapshot.sitMountain}向${snapshot.facingMountain} · ${snapshot.yuan}${snapshot.yun}运`}
                  </div>
                ) : layerMode !== 'xuankong' && p.bazhai ? (
                  <div className="fs-bazhai-tags">
                    <span
                      className={cn(
                        'fs-mini-tag',
                        p.bazhai.mingLuck === '吉' ? 'is-good' : 'is-warn',
                      )}
                    >
                      {`命·${p.bazhai.mingLabel}`}
                    </span>
                    <span
                      className={cn(
                        'fs-mini-tag',
                        p.bazhai.houseLuck === '吉' ? 'is-good' : 'is-warn',
                      )}
                    >
                      {`宅·${p.bazhai.houseLabel}`}
                    </span>
                  </div>
                ) : null}

                {layerMode === 'xuankong' && p.xuankong?.doubleStarNote ? (
                  <span
                    className={cn(
                      'fs-mini-tag',
                      p.xuankong.doubleStarKind === 'good' ? 'is-good' : 'is-warn',
                    )}
                  >
                    {p.xuankong.doubleStarNote.split('（')[0]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <Card className="grid gap-3 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] pb-2">
            <strong className="text-sm font-extrabold text-[var(--text-strong)]">
              {selectedPalace.earth === 5
                ? `中宫（洛书5）`
                : `${selectedPalace.direction}方 · ${selectedPalace.trigramSymbol}${selectedPalace.palaceName}（${selectedPalace.earth}）`}
            </strong>
            <Badge
              variant={
                selectedPalace.statusTone === 'good'
                  ? 'good'
                  : selectedPalace.statusTone === 'warn'
                    ? 'warn'
                    : 'default'
              }
            >
              {selectedPalace.statusTone === 'good'
                ? '吉方可用'
                : selectedPalace.statusTone === 'warn'
                  ? '留意煞忌'
                  : '平顺常规'}
            </Badge>
          </div>

          <div className="grid gap-1.5">
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-muted)]">宫位六亲</span>
              <span className="font-semibold text-[var(--text-strong)]">{selectedPalace.familyRole}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-muted)]">对应部位</span>
              <span className="font-semibold text-[var(--text-strong)]">{selectedPalace.bodyParts}</span>
            </div>

            {selectedPalace.bazhai ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">宅主命卦游年</span>
                  <span className="font-bold text-[var(--text-strong)]">
                    {`${selectedPalace.bazhai.mingLabel}（${selectedPalace.bazhai.mingLuck} · ${selectedPalace.bazhai.rank}）`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">住宅宅卦游年</span>
                  <span className="font-bold text-[var(--text-strong)]">
                    {`${selectedPalace.bazhai.houseLabel}（${selectedPalace.bazhai.houseLuck}）`}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">星宫生克</span>
                  <span className="font-semibold text-[var(--text-strong)]">
                    {`${selectedPalace.bazhai.starName}${selectedPalace.bazhai.starElement} / ${selectedPalace.bazhai.palaceElement}宫（${selectedPalace.bazhai.relation}）`}
                  </span>
                </div>
              </>
            ) : null}

            {selectedPalace.xuankong ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-[var(--text-muted)]">玄空山向运</span>
                  <span className="font-bold text-[var(--text-strong)]">
                    {`山${selectedPalace.xuankong.mountainStar}(${selectedPalace.xuankong.mountainTimeliness}) · 向${selectedPalace.xuankong.waterStar}(${selectedPalace.xuankong.waterTimeliness}) · 运${selectedPalace.xuankong.periodStar}`}
                  </span>
                </div>
                {selectedPalace.xuankong.yearStar !== undefined ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">流转飞星</span>
                    <span className="font-semibold text-[var(--text-strong)]">
                      {[
                        `年${selectedPalace.xuankong.yearStar}`,
                        selectedPalace.xuankong.monthStar !== undefined
                          ? `月${selectedPalace.xuankong.monthStar}`
                          : '',
                        selectedPalace.xuankong.dayStar !== undefined
                          ? `日${selectedPalace.xuankong.dayStar}`
                          : '',
                        selectedPalace.xuankong.hourStar !== undefined
                          ? `时${selectedPalace.xuankong.hourStar}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ) : null}
                {selectedPalace.xuankong.doubleStarNote ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--text-muted)]">双星组合</span>
                    <span
                      className={cn(
                        'font-bold',
                        selectedPalace.xuankong.doubleStarKind === 'good'
                          ? 'text-[var(--success-text)]'
                          : 'text-[var(--danger-text)]',
                      )}
                    >
                      {selectedPalace.xuankong.doubleStarNote}
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="rounded-lg bg-[var(--surface-soft)] p-2.5 text-[12px] leading-relaxed text-[var(--text-strong)]">
            <strong className="mb-1 block text-[11px] text-[var(--text-muted)]">空间适配建议</strong>
            {selectedPalace.roomSuitability}
          </div>

          {selectedPalace.xuankong?.remedies.length ? (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger-text)_24%,var(--border-soft))] bg-[color-mix(in_srgb,var(--danger-text)_6%,var(--surface-base))] p-2.5 text-[12px] leading-relaxed text-[var(--text-strong)]">
              <strong className="mb-1 block text-[11px] text-[var(--danger-text)]">五行通关化解</strong>
              {selectedPalace.xuankong.remedies.join('；')}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="grid gap-2.5 p-3.5 text-xs">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-soft)] p-2.5">
            <span className="block text-[11px] text-[var(--text-muted)]">到山到向</span>
            <strong className="text-[var(--text-strong)]">
              {`山星${snapshot.shanToMountain ? '到山' : '未到山'} · 向星${snapshot.xiangToFacing ? '到向' : '未到向'}`}
            </strong>
          </div>
          <div className="rounded-lg bg-[var(--surface-soft)] p-2.5">
            <span className="block text-[11px] text-[var(--text-muted)]">元运正零照神</span>
            <strong className="text-[var(--text-strong)]">
              {`正神${snapshot.zhengLing.zheng} · 零神${snapshot.zhengLing.ling}`}
            </strong>
          </div>
          <div className="rounded-lg bg-[var(--surface-soft)] p-2.5">
            <span className="block text-[11px] text-[var(--text-muted)]">城门诀推演</span>
            <strong className="text-[var(--text-strong)]">{snapshot.castleGateSummary}</strong>
          </div>
        </div>

        {snapshot.advice.length > 0 ? (
          <div className="grid gap-1 border-t border-[var(--border-soft)] pt-2">
            {snapshot.advice.map((line, i) => (
              <p key={i} className="m-0 leading-relaxed text-[var(--text-secondary)]">
                {`${i + 1}. ${line}`}
              </p>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
