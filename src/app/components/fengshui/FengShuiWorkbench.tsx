import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Hammer,
  Home,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Slider,
} from '../../../components/ui';
import { cn } from '../../../lib/utils';
import type { Method } from '../../../method-meta';
import { mountains } from '../../../systems/compass';
import type { PersonalCase } from '../../../v2-ui/cases-store';
import { CONSTRUCTION_PERIODS, type AlmanacParticipantDraft } from '../divination/divination-shared';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import { FloorPlanOverlayTab } from './FloorPlanOverlayTab';
import { HouseOrientationDiagram } from './HouseOrientationDiagram';
import { ResidentialReportView } from './ResidentialReportView';
import { RoomDirectionPicker } from './RoomDirectionPicker';
import {
  computeAnnualFengShuiSha,
  computeWorkbenchSnapshot,
} from './fengshui-engine';
import {
  SIMPLE_HOUSE_DIRECTIONS,
  createDefaultHouseProfile,
  deleteFloorPlanImageBlob,
  getSimpleDirectionLabel,
  loadHouseProfilesStore,
  personalCaseToResident,
  residentToAlmanacParticipant,
  saveHouseProfilesStore,
  type HouseProfile,
  type HouseProfilesStore,
  type ResidentMember,
} from './fengshui-store';
import '../../../styles/fengshui-workbench.css';

export interface FengShuiWorkbenchProps {
  personalCases: PersonalCase[];
  onExecuteDivination: (method: Method, payload: Record<string, unknown>) => Promise<void> | void;
  onOpenAlmanacPreset: (
    topic: 'move' | 'renovation',
    participants: AlmanacParticipantDraft[],
  ) => void;
}

function resolveFacingDegree(profile: HouseProfile): number {
  if (profile.orientationKind === 'degree') {
    return profile.degreeReading === 'facing'
      ? profile.degree
      : (profile.degree + 180) % 360;
  }
  const idx = mountains.indexOf(profile.sitMountain as (typeof mountains)[number]);
  return idx >= 0 ? ((idx + 12) % 24) * 15 : 180;
}

function facingSideEightDir(facingDeg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] as const;
  const idx = Math.floor(((((facingDeg + 22.5) % 360) + 360) % 360) / 45);
  return dirs[idx]!;
}

export default function FengShuiWorkbench({
  personalCases,
  onExecuteDivination,
  onOpenAlmanacPreset,
}: FengShuiWorkbenchProps) {
  const [store, setStore] = React.useState<HouseProfilesStore>(() => loadHouseProfilesStore());
  const activeProfile: HouseProfile = React.useMemo(
    () => store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0]!,
    [store],
  );

  const [viewMode, setViewMode] = React.useState<'wizard' | 'report'>(() =>
    activeProfile.hasCompletedWizard ? 'report' : 'wizard',
  );
  const [wizardStep, setWizardStep] = React.useState<1 | 2 | 3>(1);
  const [showProCalib, setShowProCalib] = React.useState(false);
  const [showCasePick, setShowCasePick] = React.useState(false);
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [memberName, setMemberName] = React.useState('');
  const [memberYear, setMemberYear] = React.useState('1992');
  const [memberGender, setMemberGender] = React.useState<'male' | 'female'>('female');
  const [floorPlanModalOpen, setFloorPlanModalOpen] = React.useState(false);

  React.useEffect(() => {
    saveHouseProfilesStore(store);
  }, [store]);

  const updateActiveProfile = React.useCallback(
    (updater: (prev: HouseProfile) => HouseProfile) => {
      setStore((prevStore) => ({
        ...prevStore,
        profiles: prevStore.profiles.map((item) =>
          item.id === prevStore.activeId
            ? { ...updater(item), updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    },
    [],
  );

  const handleSelectProfile = (id: string) => {
    const next = store.profiles.find((p) => p.id === id);
    setStore((prev) => ({ ...prev, activeId: id }));
    setViewMode(next?.hasCompletedWizard ? 'report' : 'wizard');
    setWizardStep(1);
  };

  const handleAddProfile = () => {
    const next = createDefaultHouseProfile({
      name: `候选房源 ${store.profiles.length + 1}`,
      residents: activeProfile.residents.map((r) => ({ ...r })),
      primaryResidentId: activeProfile.primaryResidentId,
    });
    setStore((prev) => ({
      ...prev,
      activeId: next.id,
      profiles: [...prev.profiles, next],
    }));
    setViewMode('wizard');
    setWizardStep(1);
  };

  const handleRemoveProfile = (id: string) => {
    if (store.profiles.length <= 1) return;
    void deleteFloorPlanImageBlob(id, false);
    setStore((prev) => {
      const remaining = prev.profiles.filter((p) => p.id !== id);
      const nextActive = prev.activeId === id ? remaining[0]!.id : prev.activeId;
      return { ...prev, activeId: nextActive, profiles: remaining };
    });
  };

  const snapshot = React.useMemo(() => computeWorkbenchSnapshot(activeProfile), [activeProfile]);
  const annualSha = React.useMemo(
    () => computeAnnualFengShuiSha(activeProfile.flowYear),
    [activeProfile.flowYear],
  );
  const facingDegree = resolveFacingDegree(activeProfile);
  const directionLabel = getSimpleDirectionLabel(snapshot.sitMountain);
  const facingSideDir = facingSideEightDir(facingDegree);

  const primaryResident =
    activeProfile.residents.find((r) => r.id === activeProfile.primaryResidentId) ??
    activeProfile.residents[0]!;

  const participants = React.useMemo(
    () => activeProfile.residents.map(residentToAlmanacParticipant),
    [activeProfile.residents],
  );

  const finishWizardToReport = () => {
    updateActiveProfile((prev) => ({ ...prev, hasCompletedWizard: true }));
    setViewMode('report');
  };

  const handleAddFamilyMember = () => {
    const yr = Number.parseInt(memberYear, 10);
    if (!Number.isInteger(yr) || yr < 1900 || yr > 2100) return;
    const nextMember: ResidentMember = {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: memberName.trim() || `家人 ${activeProfile.residents.length + 1}`,
      birthYear: yr,
      gender: memberGender,
    };
    updateActiveProfile((prev) => ({
      ...prev,
      residents: [...prev.residents, nextMember],
    }));
    setMemberName('');
    setShowAddMember(false);
  };

  const fiveShaDir = annualSha.annualPalaces.find((p) => p.star === 5)?.direction ?? '—';

  return (
    <div className="fengshui-workbench" data-testid="fengshui-workbench">
      {viewMode === 'report' ? (
        <ResidentialReportView
          store={store}
          activeProfile={activeProfile}
          snapshot={snapshot}
          facingDegree={facingDegree}
          onSelectProfile={handleSelectProfile}
          onEditWizard={(step) => {
            setWizardStep(step);
            setViewMode('wizard');
          }}
          onChangeFlowYear={(yr) =>
            updateActiveProfile((prev) => ({ ...prev, flowGranularity: 'year', flowYear: yr }))
          }
          onOpenFloorPlanModal={() => setFloorPlanModalOpen(true)}
          onExecuteDivination={onExecuteDivination}
          onOpenAlmanacPreset={onOpenAlmanacPreset}
        />
      ) : (
        <div className="grid gap-3">
          {/* 3步引导进度条 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="fs-stepper" role="tablist" aria-label="住宅体检步骤">
              {(
                [
                  [1, '1 房子朝向'],
                  [2, '2 年份与居住人'],
                  [3, '3 房间位置(选填)'],
                ] as const
              ).map(([stepNum, label]) => {
                const active = wizardStep === stepNum;
                const done = wizardStep > stepNum;
                return (
                  <button
                    key={stepNum}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setWizardStep(stepNum)}
                    className={cn(
                      'fs-step-pill',
                      active && 'is-active',
                      done && 'is-done',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : null}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <Button type="button" variant="ghost" size="xs" onClick={finishWizardToReport}>
              <span>直接看报告 →</span>
            </Button>
          </div>

          {/* 第 1 步：房子朝向（配动态交互示意图） */}
          {wizardStep === 1 ? (
            <Card className="grid gap-4 p-4 text-xs">
              <div className="fs-wizard-step1-grid">
                <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <HouseOrientationDiagram
                    facingDegree={facingDegree}
                    measurementTarget={activeProfile.measurementTarget}
                    directionLabel={directionLabel}
                    isSensitive={snapshot.measurementWarnings.length > 0}
                  />
                </div>

                <div className="grid content-start gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-extrabold text-[var(--text-strong)]">
                      选择测量方式
                    </strong>
                    <UiSegmentedControl<'degree' | 'mountain'>
                      value={activeProfile.orientationKind}
                      options={[
                        { value: 'degree', label: '手机指南针度数' },
                        { value: 'mountain', label: '大致方向速选' },
                      ]}
                      onChange={(kind) =>
                        updateActiveProfile((prev) => ({
                          ...prev,
                          orientationKind: kind,
                          ...(kind === 'degree' ? { degreeReading: 'facing' as const } : {}),
                        }))
                      }
                    />
                  </div>

                  {activeProfile.orientationKind === 'degree' ? (
                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <span className="font-bold text-[var(--text-secondary)]">
                          站在屋内面向哪里量？
                        </span>
                        <UiSegmentedControl<'balcony' | 'door'>
                          value={activeProfile.measurementTarget}
                          options={[
                            { value: 'balcony', label: '面向客厅大阳台/采光窗外' },
                            { value: 'door', label: '面向入户大门外' },
                          ]}
                          onChange={(target) =>
                            updateActiveProfile((prev) => ({
                              ...prev,
                              measurementTarget: target,
                              degreeReading: 'facing',
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-secondary)]">
                            输入手机指南针显示的角度（0–360°）
                          </span>
                          <Badge variant="outline">{`${Math.round(facingDegree)}°`}</Badge>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Input
                            type="number"
                            min={0}
                            max={360}
                            step={1}
                            aria-label="指南针角度"
                            className="h-9 w-28 font-bold"
                            value={String(Math.round(facingDegree))}
                            onChange={(e) => {
                              const deg = Math.min(360, Math.max(0, Number(e.target.value) || 0));
                              const sitDeg = (deg + 180) % 360;
                              const idx = Math.floor(((((sitDeg + 7.5) % 360) + 360) % 360) / 15);
                              updateActiveProfile((prev) => ({
                                ...prev,
                                orientationKind: 'degree',
                                degreeReading: 'facing',
                                degree: deg,
                                sitMountain: mountains[idx]!,
                              }));
                            }}
                          />
                          <Slider
                            min={0}
                            max={359}
                            step={1}
                            aria-label="旋转朝向角度"
                            className="flex-1"
                            value={Math.round(facingDegree) % 360}
                            onChange={(e) => {
                              const deg = Number(e.target.value);
                              const sitDeg = (deg + 180) % 360;
                              const idx = Math.floor(((((sitDeg + 7.5) % 360) + 360) % 360) / 15);
                              updateActiveProfile((prev) => ({
                                ...prev,
                                orientationKind: 'degree',
                                degreeReading: 'facing',
                                degree: deg,
                                sitMountain: mountains[idx]!,
                              }));
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowProCalib((s) => !s)}
                          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent-strong)]"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          <span>{showProCalib ? '收起校准' : '精确校准'}</span>
                          {showProCalib ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>

                        {showProCalib ? (
                          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-soft)] p-2.5">
                            <Select
                              value={activeProfile.northReference}
                              onChange={(e) =>
                                updateActiveProfile((prev) => ({
                                  ...prev,
                                  northReference: e.target.value as
                                    | 'true'
                                    | 'magnetic'
                                    | 'unspecified',
                                }))
                              }
                            >
                              <option value="true">真北（手机指南针默认）</option>
                              <option value="magnetic">磁北（需填磁偏角）</option>
                              <option value="unspecified">未声明基准</option>
                            </Select>
                            <Select
                              value={activeProfile.xuankongMode}
                              onChange={(e) =>
                                updateActiveProfile((prev) => ({
                                  ...prev,
                                  xuankongMode: e.target.value as '下卦' | '替卦',
                                }))
                              }
                            >
                              <option value="下卦">常规下卦</option>
                              <option value="替卦">兼向替卦</option>
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="fs-simple-dir-grid" role="group" aria-label="选择大致朝向">
                      {SIMPLE_HOUSE_DIRECTIONS.map((item) => {
                        const active = directionLabel === item.label;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() =>
                              updateActiveProfile((prev) => ({
                                ...prev,
                                orientationKind: 'mountain',
                                sitMountain: item.sitMountain,
                                degree: item.facingDegree,
                                degreeReading: 'facing',
                              }))
                            }
                            className={cn('fs-simple-dir-btn', active && 'is-active')}
                          >
                            {item.facingLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
                  <Badge variant="warn">{`${annualSha.year}忌动土`}</Badge>
                  <span>{`五黄/太岁在「${fiveShaDir}」，三煞在「${annualSha.sanSha.direction}」`}</span>
                  <button
                    type="button"
                    onClick={() => onOpenAlmanacPreset('renovation', participants)}
                    className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-bold text-[var(--accent-strong)] cursor-pointer hover:underline"
                  >
                    <Hammer className="h-3 w-3" />
                    <span>装修择吉</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAlmanacPreset('move', participants)}
                    className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-bold text-[var(--accent-strong)] cursor-pointer hover:underline"
                  >
                    <Home className="h-3 w-3" />
                    <span>搬家择吉</span>
                  </button>
                </div>

                <Button type="button" variant="primary" size="md" onClick={() => setWizardStep(2)}>
                  <span>下一步</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ) : null}

          {/* 第 2 步：房子年份与谁来住 */}
          {wizardStep === 2 ? (
            <Card className="grid gap-4 p-4 text-xs">
              <div className="grid gap-2">
                <strong className="text-sm font-extrabold text-[var(--text-strong)]">
                  房子什么时候建的？
                </strong>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CONSTRUCTION_PERIODS.map((p) => {
                    const active =
                      (p.year === 2024 && activeProfile.constructionYear >= 2024) ||
                      (p.year === 2008 &&
                        activeProfile.constructionYear >= 2004 &&
                        activeProfile.constructionYear <= 2023) ||
                      (p.year === 1996 &&
                        activeProfile.constructionYear >= 1984 &&
                        activeProfile.constructionYear <= 2003) ||
                      (p.year === 1975 &&
                        activeProfile.constructionYear >= 1964 &&
                        activeProfile.constructionYear <= 1983);
                    const plainPeriodLabel =
                      p.year === 2024
                        ? '2024年后新房'
                        : p.year === 2008
                          ? '2004–2023年房'
                          : p.year === 1996
                            ? '1984–2003年房'
                            : '1983年前老房';
                    return (
                      <button
                        key={p.year}
                        type="button"
                        onClick={() =>
                          updateActiveProfile((prev) => ({ ...prev, constructionYear: p.year }))
                        }
                        className={cn('fs-simple-dir-btn', active && 'is-active')}
                      >
                        {plainPeriodLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                    <span>建成年份</span>
                    <Input
                      value={String(activeProfile.constructionYear)}
                      placeholder="例如 2024"
                      onChange={(e) => {
                        const yr = Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
                        if (yr >= 1900 && yr <= 2100) {
                          updateActiveProfile((prev) => ({ ...prev, constructionYear: yr }));
                        }
                      }}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                    <span>入住或大翻新年份（选填）</span>
                    <Input
                      value={activeProfile.moveInYear ? String(activeProfile.moveInYear) : ''}
                      placeholder="例如 2026"
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                        if (!cleaned) {
                          updateActiveProfile((prev) => {
                            const next = { ...prev };
                            delete next.moveInYear;
                            return next;
                          });
                          return;
                        }
                        const yr = Number.parseInt(cleaned, 10);
                        if (yr >= 1900 && yr <= 2100) {
                          updateActiveProfile((prev) => ({ ...prev, moveInYear: yr }));
                        }
                      }}
                    />
                  </label>
                  <label className="grid gap-1 font-semibold text-[var(--text-secondary)]">
                    <span>房源名称（选填）</span>
                    <Input
                      value={activeProfile.name}
                      placeholder="例如：现住房 / 备选A"
                      onChange={(e) =>
                        updateActiveProfile((prev) => ({
                          ...prev,
                          name: e.target.value.slice(0, 60),
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-2.5 border-t border-[var(--border-soft)] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm font-extrabold text-[var(--text-strong)]">
                    谁来住这套房？
                  </strong>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {personalCases.length > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => setShowCasePick((s) => !s)}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>选择档案</span>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => setShowAddMember((s) => !s)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>添加家人</span>
                    </Button>
                  </div>
                </div>

                {showCasePick && personalCases.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
                    {personalCases.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const res = personalCaseToResident(c);
                          updateActiveProfile((prev) => {
                            const exists = prev.residents.some((r) => r.id === res.id);
                            return {
                              ...prev,
                              residents: exists
                                ? prev.residents.map((r) => (r.id === res.id ? res : r))
                                : [...prev.residents, res],
                              primaryResidentId: res.id,
                            };
                          });
                          setShowCasePick(false);
                        }}
                        className="fs-profile-chip"
                      >
                        {`${c.name}（${c.year}·${c.gender === 'female' ? '女' : '男'}）`}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-soft)] p-2.5">
                  <Badge variant="accent">主居住人</Badge>
                  <Input
                    className="h-8 w-24"
                    aria-label="主居住人称呼"
                    value={primaryResident.name}
                    onChange={(e) =>
                      updateActiveProfile((prev) => ({
                        ...prev,
                        residents: prev.residents.map((r) =>
                          r.id === primaryResident.id
                            ? { ...r, name: e.target.value.slice(0, 20) }
                            : r,
                        ),
                      }))
                    }
                  />
                  <Input
                    className="h-8 w-24"
                    aria-label="出生年份"
                    placeholder="出生年"
                    value={String(primaryResident.birthYear)}
                    onChange={(e) => {
                      const yr = Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
                      if (yr >= 1900 && yr <= 2100) {
                        updateActiveProfile((prev) => ({
                          ...prev,
                          residents: prev.residents.map((r) =>
                            r.id === primaryResident.id ? { ...r, birthYear: yr } : r,
                          ),
                        }));
                      }
                    }}
                  />
                  <UiSegmentedControl<'male' | 'female'>
                    value={primaryResident.gender}
                    options={[
                      { value: 'male', label: '男' },
                      { value: 'female', label: '女' },
                    ]}
                    onChange={(gender) =>
                      updateActiveProfile((prev) => ({
                        ...prev,
                        residents: prev.residents.map((r) =>
                          r.id === primaryResident.id ? { ...r, gender } : r,
                        ),
                      }))
                    }
                  />
                </div>

                {activeProfile.residents.filter((r) => r.id !== primaryResident.id).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeProfile.residents
                      .filter((r) => r.id !== primaryResident.id)
                      .map((r) => (
                        <div key={r.id} className="fs-profile-chip">
                          <span>{`${r.name} · ${r.birthYear}年${r.gender === 'female' ? '女' : '男'}`}</span>
                          <button
                            type="button"
                            aria-label={`移除 ${r.name}`}
                            onClick={() =>
                              updateActiveProfile((prev) => ({
                                ...prev,
                                residents: prev.residents.filter((item) => item.id !== r.id),
                              }))
                            }
                            className="border-0 bg-transparent p-0 text-[var(--text-muted)] cursor-pointer hover:text-[var(--danger-text)]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                  </div>
                ) : null}

                {showAddMember ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5 sm:grid-cols-4">
                    <Input
                      placeholder="称呼（如：配偶/孩子）"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value.slice(0, 20))}
                    />
                    <Input
                      placeholder="出生年"
                      value={memberYear}
                      onChange={(e) => setMemberYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                    />
                    <Select
                      value={memberGender}
                      onChange={(e) => setMemberGender(e.target.value as 'male' | 'female')}
                    >
                      <option value="female">女</option>
                      <option value="male">男</option>
                    </Select>
                    <Button type="button" variant="primary" size="sm" onClick={handleAddFamilyMember}>
                      <Plus className="h-3.5 w-3.5" />
                      <span>确认添加</span>
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                <Button type="button" variant="secondary" size="md" onClick={() => setWizardStep(1)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>上一步</span>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="md" onClick={finishWizardToReport}>
                    直接看报告
                  </Button>
                  <Button type="button" variant="primary" size="md" onClick={() => setWizardStep(3)}>
                    <span>下一步</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {/* 第 3 步：免传图房间方位点选 */}
          {wizardStep === 3 ? (
            <Card className="grid gap-4 p-4 text-xs">
              <RoomDirectionPicker
                roomPlacements={activeProfile.roomPlacements}
                facingSideDir={facingSideDir}
                directionLabel={directionLabel}
                onChange={(next) =>
                  updateActiveProfile((prev) => ({ ...prev, roomPlacements: next }))
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
                <Button type="button" variant="secondary" size="md" onClick={() => setWizardStep(2)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>上一步</span>
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="md" onClick={finishWizardToReport}>
                    直接看报告
                  </Button>
                  <Button type="button" variant="primary" size="md" onClick={finishWizardToReport}>
                    <Sparkles className="h-4 w-4" />
                    <span>生成报告</span>
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {/* 角落轻量入口：多房源与上传户型图叠罗盘 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {store.profiles.length > 1
                ? store.profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProfile(p.id)}
                      className={cn('fs-profile-chip', p.id === activeProfile.id && 'is-active')}
                    >
                      {p.name || '未命名房源'}
                    </button>
                  ))
                : null}
              <Button type="button" variant="ghost" size="xs" onClick={handleAddProfile}>
                <Plus className="h-3 w-3" />
                <span>新增对比房源</span>
              </Button>
              {store.profiles.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleRemoveProfile(activeProfile.id)}
                  aria-label="删除当前房源"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              ) : null}
            </div>

            <Button type="button" variant="ghost" size="xs" onClick={() => setFloorPlanModalOpen(true)}>
              <Compass className="h-3.5 w-3.5" />
              <span>户型图叠罗盘</span>
            </Button>
          </div>
        </div>
      )}

      {/* 户型图叠罗盘弹窗 */}
      <Dialog open={floorPlanModalOpen} onOpenChange={setFloorPlanModalOpen}>
        <DialogContent className="max-h-[88dvh] max-w-[840px]" aria-label="户型图叠罗盘">
          <DialogHeader>
            <DialogTitle>户型图叠罗盘</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {floorPlanModalOpen ? (
              <FloorPlanOverlayTab
                profile={activeProfile}
                snapshot={snapshot}
                isDefaultProfile={
                  activeProfile.id === 'house_default' || store.profiles[0]?.id === activeProfile.id
                }
                onUpdateProfile={updateActiveProfile}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
