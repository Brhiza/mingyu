import * as React from 'react';
import {
  AlertTriangle,
  BedDouble,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  DoorOpen,
  Hammer,
  Home,
  PencilLine,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, Input } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import type { Method } from '../../../method-meta';
import type { AlmanacParticipantDraft } from '../divination/divination-shared';
import { NinePalaceBoardTab } from './NinePalaceBoardTab';
import {
  LUOSHU_DIR_BY_EARTH,
  LUOSHU_GRID_ORDER,
  NINE_STAR_SHORT,
  buildPlainLayoutSummary,
  computeAnnualFengShuiSha,
  evaluateRoomPlacements,
  type WorkbenchSnapshot,
} from './fengshui-engine';
import {
  residentToAlmanacParticipant,
  type HouseProfile,
  type HouseProfilesStore,
} from './fengshui-store';

export interface ResidentialReportViewProps {
  store: HouseProfilesStore;
  activeProfile: HouseProfile;
  snapshot: WorkbenchSnapshot;
  facingDegree: number;
  onSelectProfile: (id: string) => void;
  onEditWizard: (step: 1 | 2 | 3) => void;
  onChangeFlowYear: (year: number) => void;
  onOpenFloorPlanModal: () => void;
  onExecuteDivination: (method: Method, payload: Record<string, unknown>) => Promise<void> | void;
  onOpenAlmanacPreset: (
    topic: 'move' | 'renovation',
    participants: AlmanacParticipantDraft[],
  ) => void;
}

export function ResidentialReportView({
  store,
  activeProfile,
  snapshot,
  facingDegree,
  onSelectProfile,
  onEditWizard,
  onChangeFlowYear,
  onOpenFloorPlanModal,
  onExecuteDivination,
  onOpenAlmanacPreset,
}: ResidentialReportViewProps) {
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => new Date().getMonth() + 1);
  const [showMonthlyTable, setShowMonthlyTable] = React.useState(false);
  const [showProBoard, setShowProBoard] = React.useState(false);

  const annual = React.useMemo(
    () => computeAnnualFengShuiSha(activeProfile.flowYear),
    [activeProfile.flowYear],
  );
  const plain = React.useMemo(
    () => buildPlainLayoutSummary(snapshot, annual),
    [snapshot, annual],
  );
  const roomDiagnoses = React.useMemo(
    () => evaluateRoomPlacements(activeProfile.roomPlacements, snapshot),
    [activeProfile.roomPlacements, snapshot],
  );
  const participants = React.useMemo(
    () => activeProfile.residents.map(residentToAlmanacParticipant),
    [activeProfile.residents],
  );

  const activeMonthPlate =
    annual.monthlyPlates.find((m) => m.month === selectedMonth) ?? annual.monthlyPlates[0]!;
  const palaceMap = React.useMemo(
    () => new Map(snapshot.palaces.map((p) => [p.earth, p])),
    [snapshot.palaces],
  );

  const findDirByStar = (star: number) =>
    annual.annualPalaces.find((p) => p.star === star)?.direction ?? '—';

  return (
    <div className="grid gap-3">
      {/* 1. 顶部结果导航条 */}
      <Card className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 text-xs">
        <div className="grid gap-1">
          {store.profiles.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {store.profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProfile(p.id)}
                  className={cn('fs-profile-chip', p.id === activeProfile.id && 'is-active')}
                >
                  {p.name || '未命名房源'}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-sm font-extrabold text-[var(--text-strong)]">
              {activeProfile.name || '我的住宅体检'}
            </strong>
            <Badge variant="accent">
              {`${plain.directionLabel}（面向 ${Math.round(facingDegree)}°）`}
            </Badge>
            <Badge variant="outline">{`${activeProfile.constructionYear}年建`}</Badge>
            {activeProfile.moveInYear ? (
              <Badge variant="outline">{`${activeProfile.moveInYear}年入住`}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onEditWizard(1)}>
            <PencilLine className="h-3.5 w-3.5" />
            <span>修改资料</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void onExecuteDivination('residential', snapshot.residentialPayload)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI 解读</span>
          </Button>
        </div>
      </Card>

      {/* 2. 一句话体检总评 */}
      <Card className="grid gap-2 p-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={plain.isMatch ? 'good' : 'warn'}>
            {plain.isMatch ? '人宅相合' : '分层布局'}
          </Badge>
          <strong className="text-[14px] font-extrabold text-[var(--text-strong)]">
            {plain.headline}
          </strong>
        </div>
        {snapshot.moveInCycleNotice ? (
          <p className="m-0 rounded-lg bg-[var(--surface-soft)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-secondary)]">
            {snapshot.moveInCycleNotice}
          </p>
        ) : null}
        {snapshot.fallbackNotice ? (
          <p className="m-0 rounded-lg bg-[color-mix(in_srgb,var(--danger-text)_7%,var(--surface-base))] px-2.5 py-1.5 text-[11.5px] text-[var(--danger-text)]">
            {snapshot.fallbackNotice}
          </p>
        ) : null}
      </Card>

      {/* 3. 已标房间实测诊断 */}
      {roomDiagnoses.length > 0 ? (
        <Card className="grid gap-2.5 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm font-extrabold text-[var(--text-strong)]">
              你家房间位置诊断
            </strong>
            <Button type="button" variant="ghost" size="xs" onClick={() => onEditWizard(3)}>
              修改房间
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {roomDiagnoses.map((item) => (
              <div
                key={item.kind}
                className="grid gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                    {`${item.kindLabel} · ${item.direction === '房子中心' ? '房子中心' : `${item.direction}方`}`}
                  </strong>
                  <Badge
                    variant={
                      item.status === '宜' ? 'good' : item.status === '慎' ? 'warn' : 'default'
                    }
                  >
                    {item.status === '慎' ? '需注意' : item.status === '宜' ? '合适' : '一般'}
                  </Badge>
                </div>
                <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{item.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 4. 理想摆位建议（4 卡） */}
      <div className="fs-plain-cards-grid text-xs">
        <Card className="grid gap-1.5 p-3.5">
          <div className="flex items-center gap-1.5 text-[var(--success-text)]">
            <BedDouble className="h-4 w-4" />
            <span className="font-bold">主卧与床头</span>
          </div>
          <strong className="text-[15px] font-extrabold text-[var(--text-strong)]">
            {plain.bedroomDirs}
          </strong>
          <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{plain.bedroomTip}</p>
        </Card>

        <Card className="grid gap-1.5 p-3.5">
          <div className="flex items-center gap-1.5 text-[var(--accent-strong)]">
            <BookOpen className="h-4 w-4" />
            <span className="font-bold">书桌与财位</span>
          </div>
          <strong className="text-[15px] font-extrabold text-[var(--text-strong)]">
            {plain.studyDirs}
          </strong>
          <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{plain.studyTip}</p>
        </Card>

        <Card className="grid gap-1.5 p-3.5">
          <div className="flex items-center gap-1.5 text-[var(--text-strong)]">
            <DoorOpen className="h-4 w-4 text-[var(--accent-strong)]" />
            <span className="font-bold">大门与客厅</span>
          </div>
          <strong className="text-[15px] font-extrabold text-[var(--text-strong)]">
            {plain.doorDirs}
          </strong>
          <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{plain.doorTip}</p>
        </Card>

        <Card className="grid gap-1.5 p-3.5">
          <div className="flex items-center gap-1.5 text-[var(--danger-text)]">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-bold">卫浴与避坑</span>
          </div>
          <strong className="text-[15px] font-extrabold text-[var(--text-strong)]">
            {plain.avoidDirs}
          </strong>
          <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{plain.avoidTip}</p>
        </Card>
      </div>

      {/* 5. 全家分房建议（多人时显示） */}
      {snapshot.residentAnalyses.length > 1 ? (
        <Card className="grid gap-2.5 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm font-extrabold text-[var(--text-strong)]">
              全家分房参考
            </strong>
            <Button type="button" variant="ghost" size="xs" onClick={() => onEditWizard(2)}>
              管理家人
            </Button>
          </div>
          <div className="fs-resident-grid">
            {snapshot.residentAnalyses.map((item) => {
              const isMatch = item.matchWithHouse === '同组';
              return (
                <div
                  key={item.member.id}
                  className="grid gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                      {`${item.member.name}（${item.member.birthYear}年${item.member.gender === 'female' ? '女' : '男'}）`}
                    </strong>
                    <Badge variant={isMatch ? 'good' : 'warn'}>
                      {isMatch ? '与房子合拍' : '错开布局'}
                    </Badge>
                  </div>
                  <div className="text-[11.5px] text-[var(--text-strong)]">
                    {`首选卧室：${item.bestSleepDir} · 书桌：${item.bestStudyDir} · 避开：${item.unluckyDirections.slice(0, 2).map((d) => d.direction).join('、')}`}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* 6. 今年动土禁忌与好运方位 + 择吉联动 */}
      <Card className="grid gap-3 p-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onChangeFlowYear(Math.max(1900, annual.year - 1))}
              aria-label="上一年"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Input
              className="h-8 w-20 text-center font-bold"
              aria-label="查看年份"
              value={String(annual.year)}
              onChange={(e) => {
                const yr = Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
                if (yr >= 1900 && yr <= 2100) onChangeFlowYear(yr);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onChangeFlowYear(Math.min(2100, annual.year + 1))}
              aria-label="下一年"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <strong className="text-sm font-extrabold text-[var(--text-strong)]">
              {`${annual.year}年（${annual.ganZhi}）动土与旺位`}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onOpenAlmanacPreset('move', participants)}
            >
              <Home className="h-3.5 w-3.5" />
              <span>搬家择吉</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => onOpenAlmanacPreset('renovation', participants)}
            >
              <Hammer className="h-3.5 w-3.5" />
              <span>装修择吉</span>
            </Button>
          </div>
        </div>

        <div className="fs-plain-cards-grid">
          <div className="grid gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--danger-text)_5%,var(--surface-base))] p-2.5">
            <span className="font-extrabold text-[var(--danger-text)]">今年忌装修动土</span>
            <div className="flex justify-between">
              <span>五黄大煞（忌敲墙动土）</span>
              <strong>{findDirByStar(5)}</strong>
            </div>
            <div className="flex justify-between">
              <span>二黑病符（宜整洁静置）</span>
              <strong>{findDirByStar(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>太岁 / 岁破 / 三煞</span>
              <strong>{`${annual.taiSui.direction} / ${annual.suiPo.direction} / ${annual.sanSha.direction}`}</strong>
            </div>
          </div>

          <div className="grid gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--success-text)_5%,var(--surface-base))] p-2.5">
            <span className="font-extrabold text-[var(--success-text)]">今年好运方位</span>
            <div className="flex justify-between">
              <span>喜庆人缘旺位（九紫）</span>
              <strong>{findDirByStar(9)}</strong>
            </div>
            <div className="flex justify-between">
              <span>正财置业方位（八白）</span>
              <strong>{findDirByStar(8)}</strong>
            </div>
            <div className="flex justify-between">
              <span>文昌学习 / 桃花贵人</span>
              <strong>{`${findDirByStar(4)} / ${findDirByStar(1)}`}</strong>
            </div>
          </div>
        </div>

        <div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowMonthlyTable((s) => !s)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{showMonthlyTable ? '收起月度飞星' : '展开月度飞星'}</span>
            {showMonthlyTable ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          {showMonthlyTable ? (
            <div className="mt-2.5 grid gap-2.5">
              <div className="fs-month-strip">
                {annual.monthlyPlates.map((m) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => setSelectedMonth(m.month)}
                    className={cn('fs-month-btn', selectedMonth === m.month && 'is-active')}
                  >
                    <strong>{`${m.month}月(${m.monthBranch})`}</strong>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {`五黄:${LUOSHU_DIR_BY_EARTH[m.fiveEarth]}`}
                    </span>
                  </button>
                ))}
              </div>
              <div className="fs-nine-grid">
                {LUOSHU_GRID_ORDER.map((earth) => {
                  const ap = annual.annualPalaces.find((item) => item.earth === earth)!;
                  const mStar = activeMonthPlate.plate[earth - 1]!;
                  const basePalace = palaceMap.get(earth);
                  return (
                    <div
                      key={earth}
                      className={cn(
                        'fs-palace-cell cursor-default',
                        ap.avoidDigging || mStar === 5 || mStar === 2 ? 'is-warn' : ap.tone === 'good' ? 'is-good' : '',
                      )}
                    >
                      <div className="fs-palace-head">
                        <span>{earth === 5 ? '中宫' : `${ap.direction} · ${ap.palaceName}`}</span>
                        {ap.avoidDigging ? <span className="fs-mini-tag is-warn">忌动土</span> : null}
                      </div>
                      <div className="fs-palace-stars">
                        <span className="fs-star-pair">{`年${ap.star} · 月${mStar}`}</span>
                        {basePalace?.xuankong ? (
                          <span className="fs-star-sub">{`山${basePalace.xuankong.mountainStar}向${basePalace.xuankong.waterStar}`}</span>
                        ) : null}
                      </div>
                      <span className="text-[10.5px] text-[var(--text-muted)]">
                        {mStar === 5 ? `月${NINE_STAR_SHORT[5]}` : ap.tag}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* 7. 底部折叠专业盘 + 角落户型图弹窗入口 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowProBoard((s) => !s)}
        >
          {showProBoard ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>{showProBoard ? '收起专业九宫盘' : '展开专业九宫盘'}</span>
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={onOpenFloorPlanModal}>
          <Compass className="h-3.5 w-3.5" />
          <span>户型图叠罗盘</span>
        </Button>
      </div>

      {showProBoard ? <NinePalaceBoardTab snapshot={snapshot} /> : null}
    </div>
  );
}
