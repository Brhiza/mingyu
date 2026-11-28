import * as React from 'react';
import { mountains, mountainTrigram } from '../../../systems/compass';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import {
  CONSTRUCTION_PERIODS,
  FENGSHUI_COMPASS_GROUPS,
  LabeledInput,
  LabeledSelect,
} from './divination-shared';

export function ResidentialForm({
  method,
  nowYear,
  orientationKind,
  sitMountain,
  degree,
  constructionYear,
  flowYear,
  mode,
  personYear,
  personGender,
  onChangeOrientationKind,
  onChangeSitMountain,
  onChangeDegree,
  onChangeConstructionYear,
  onChangeFlowYear,
  onChangeMode,
  onChangePersonYear,
  onChangePersonGender,
}: {
  method: 'bazhai' | 'xuankong' | 'residential';
  nowYear: number;
  orientationKind: 'mountain' | 'degree';
  sitMountain: string;
  degree: number;
  constructionYear: number;
  flowYear: number;
  mode: '下卦' | '替卦';
  personYear: string;
  personGender: 'male' | 'female';
  onChangeOrientationKind: (next: 'mountain' | 'degree') => void;
  onChangeSitMountain: (next: string) => void;
  onChangeDegree: (next: number) => void;
  onChangeConstructionYear: (next: number) => void;
  onChangeFlowYear: (next: number) => void;
  onChangeMode: (next: '下卦' | '替卦') => void;
  onChangePersonYear: (next: string) => void;
  onChangePersonGender: (next: 'male' | 'female') => void;
}) {
  const [constructionYearDraft, setConstructionYearDraft] = React.useState(
    String(constructionYear),
  );
  const [flowYearDraft, setFlowYearDraft] = React.useState(String(flowYear));
  const [degreeDraft, setDegreeDraft] = React.useState(String(degree));

  React.useEffect(() => {
    setConstructionYearDraft(String(constructionYear));
  }, [constructionYear]);

  React.useEffect(() => {
    setDegreeDraft(String(degree));
  }, [degree]);

  const activeGroup =
    FENGSHUI_COMPASS_GROUPS.find((grp) =>
      (grp.mountains as readonly string[]).includes(sitMountain),
    ) ?? FENGSHUI_COMPASS_GROUPS[0]!;

  const currentMIdx = Math.max(0, mountains.indexOf(sitMountain as (typeof mountains)[number]));
  const currentFacing = mountains[(currentMIdx + 12) % 24]!;

  const degreeIdx = Math.floor(((((degree + 7.5) % 360) + 360) % 360) / 15);
  const degSit = mountains[degreeIdx]!;
  const degFacing = mountains[(degreeIdx + 12) % 24]!;

  return (
    <>
      <div className="workspace-ui-field">
        <label>立向输入方式</label>
        <div className="manual-orientation-switch">
          {(
            [
              ['mountain', '二十四山罗盘'],
              ['degree', '度数输入（0–360°）'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={orientationKind === id ? 'is-active' : ''}
              onClick={() => onChangeOrientationKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {method === 'bazhai' || method === 'residential' ? (
        <div className="workspace-ui-form-row is-two-column">
          <LabeledInput
            label="宅主出生年份"
            value={personYear}
            placeholder="输入四位出生年份"
            onChange={(v) => onChangePersonYear(v.replace(/[^\d]/g, '').slice(0, 4))}
          />
          <LabeledSelect
            label="宅主性别"
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
            ]}
            value={personGender}
            onChange={(v) => onChangePersonGender(v as 'male' | 'female')}
          />
        </div>
      ) : null}

      {method === 'xuankong' || method === 'residential' ? (
        <>
          <div className="workspace-ui-field">
            <label>建造元运快捷选择</label>
            <div className="workspace-ui-choice-grid">
              {CONSTRUCTION_PERIODS.map((p) => {
                const active =
                  (p.year === 2024 && constructionYear >= 2024) ||
                  (p.year === 2008 && constructionYear >= 2004 && constructionYear <= 2023) ||
                  (p.year === 1996 && constructionYear >= 1984 && constructionYear <= 2003) ||
                  (p.year === 1975 && constructionYear >= 1964 && constructionYear <= 1983);
                return (
                  <button
                    key={p.year}
                    type="button"
                    className={`workspace-ui-choice${active ? ' is-active' : ''}`}
                    onClick={() => onChangeConstructionYear(p.year)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="workspace-ui-form-row is-three-column fengshui-xuan-row">
            <LabeledInput
              label="建造或起运年"
              value={constructionYearDraft}
              placeholder="2024"
              onChange={(v) => {
                const cleaned = v.replace(/[^\d]/g, '');
                setConstructionYearDraft(cleaned);
                const yr = Number.parseInt(cleaned, 10);
                if (yr >= 1900 && yr <= 2100) {
                  onChangeConstructionYear(yr);
                }
              }}
            />
            <LabeledSelect
              label="玄空起法"
              options={[
                { value: '下卦', label: '下卦' },
                { value: '替卦', label: '替卦' },
              ]}
              value={mode}
              onChange={(v) => onChangeMode(v as '下卦' | '替卦')}
            />
            <LabeledInput
              label="目标流运年份"
              value={flowYearDraft}
              placeholder={String(nowYear)}
              onChange={(v) => {
                const cleaned = v.replace(/[^\d]/g, '');
                setFlowYearDraft(cleaned);
                const yr = Number.parseInt(cleaned, 10);
                if (yr >= 1900 && yr <= 2100) {
                  onChangeFlowYear(yr);
                }
              }}
            />
          </div>
        </>
      ) : null}

      <div className="divination-extra-panel manual-entry-panel fengshui-compass-workbench">
        {orientationKind === 'mountain' ? (
          <>
            <div className="workspace-ui-field">
              <label>选择八方坐向</label>
              <div
                className="fengshui-compass-group-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                  gap: '8px',
                }}
              >
                {FENGSHUI_COMPASS_GROUPS.map((grp) => {
                  const isGroupActive = grp.id === activeGroup.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      className={`workspace-ui-choice fengshui-compass-group-card${
                        isGroupActive ? ' is-active' : ''
                      }`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '2px',
                        padding: '8px 10px',
                        textAlign: 'left',
                      }}
                      onClick={() => {
                        const defaultSit = (grp.mountains as readonly string[]).includes(sitMountain)
                          ? sitMountain
                          : grp.mountains[1];
                        onChangeSitMountain(defaultSit);
                        const mIdx = mountains.indexOf(defaultSit as (typeof mountains)[number]);
                        if (mIdx >= 0) onChangeDegree(mIdx * 15);
                      }}
                    >
                      <strong style={{ fontSize: '13px' }}>{grp.label}</strong>
                      <small style={{ fontSize: '11px', opacity: 0.78 }}>{grp.subLabel}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="workspace-ui-field" style={{ marginTop: '10px' }}>
              <label>{`细分三山朝向 · ${sitMountain}山${currentFacing}向 · ${activeGroup.id}宅`}</label>
              <UiSegmentedControl<string>
                value={sitMountain}
                options={activeGroup.mountains.map((sit) => {
                  const idx = Math.max(0, mountains.indexOf(sit as (typeof mountains)[number]));
                  const facing = mountains[(idx + 12) % 24]!;
                  return { value: sit, label: `${sit}山${facing}向` };
                })}
                onChange={(nextSit) => {
                  onChangeSitMountain(nextSit);
                  const mIdx = mountains.indexOf(nextSit as (typeof mountains)[number]);
                  if (mIdx >= 0) onChangeDegree(mIdx * 15);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="metaphysics-direction-preview">
              <strong>{`${degSit}山${degFacing}向 · ${mountainTrigram(degSit)}宅`}</strong>
              <span>{`当前坐山度数：${degree}°`}</span>
            </div>
            <LabeledInput
              label="坐山度数"
              value={degreeDraft}
              placeholder="输入 0–360 度数"
              onChange={(v) => {
                setDegreeDraft(v);
                const deg = Math.min(360, Math.max(0, Number(v) || 0));
                onChangeDegree(deg);
                const nextIdx = Math.floor(((((deg + 7.5) % 360) + 360) % 360) / 15);
                onChangeSitMountain(mountains[nextIdx]!);
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
