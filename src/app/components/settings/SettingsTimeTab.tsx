import * as React from 'react';
import { MapPin } from 'lucide-react';
import { Button, Select, Switch } from '../../../components/ui';
import type { BirthPlaceModalController } from '../../../v2-ui/birth-place-modal';
import type { GlobalRulesSettings } from '../../../web-settings';

export interface SettingsTimeTabProps {
  rulesDraft: GlobalRulesSettings;
  birthPlaceModal: BirthPlaceModalController;
  onUpdateTimeRule: <K extends keyof GlobalRulesSettings['time']>(
    key: K,
    value: GlobalRulesSettings['time'][K],
  ) => void;
  onUpdateCastingRule: <K extends keyof GlobalRulesSettings['casting']>(
    key: K,
    value: GlobalRulesSettings['casting'][K],
  ) => void;
  onApplyCastingPreset: (mode: 'manual' | 'auto') => void;
  onUpdateDefaultPlace: (place: {
    displayName: string;
    longitude: number;
    latitude: number;
  }) => void;
}

export function SettingsTimeTab({
  rulesDraft,
  birthPlaceModal,
  onUpdateTimeRule,
  onUpdateCastingRule,
  onApplyCastingPreset,
  onUpdateDefaultPlace,
}: SettingsTimeTabProps) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
          时间与地理坐标
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>占卜默认时间</span>
            <Select
              value={rulesDraft.time.defaultDivinationTimeMode}
              onChange={(e) =>
                onUpdateTimeRule(
                  'defaultDivinationTimeMode',
                  e.target.value as GlobalRulesSettings['time']['defaultDivinationTimeMode'],
                )
              }
            >
              <option value="current">当前此刻</option>
              <option value="custom">自定义时间</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>默认时间制式</span>
            <Select
              value={rulesDraft.time.defaultTimeStandard}
              onChange={(e) =>
                onUpdateTimeRule(
                  'defaultTimeStandard',
                  e.target.value as GlobalRulesSettings['time']['defaultTimeStandard'],
                )
              }
            >
              <option value="beijing">北京时间</option>
              <option value="true-solar">真太阳时</option>
            </Select>
          </label>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
            <span className="text-xs font-bold text-[var(--text-strong)]">
              个人命盘默认开启真太阳时
            </span>
            <Switch
              checked={rulesDraft.time.defaultBirthUseTrueSolar}
              onCheckedChange={(val) => onUpdateTimeRule('defaultBirthUseTrueSolar', val)}
              aria-label="个人命盘默认开启真太阳时"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
              <span>
                {rulesDraft.time.defaultPlaceDisplayName}（东经{' '}
                {rulesDraft.time.defaultPlaceLongitude.toFixed(2)}° · 北纬{' '}
                {rulesDraft.time.defaultPlaceLatitude.toFixed(2)}°）
              </span>
            </div>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                birthPlaceModal.open({
                  purpose: 'observer',
                  initialPlace: rulesDraft.time.defaultPlaceDisplayName,
                  onConfirm: onUpdateDefaultPlace,
                });
              }}
            >
              选择城市
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            起卦与抽牌方式
          </h3>
          <div className="flex items-center gap-1.5">
            <Button
              variant={
                rulesDraft.casting.preferManualMode === 'manual' ? 'primary' : 'secondary'
              }
              size="xs"
              onClick={() => onApplyCastingPreset('manual')}
            >
              全部偏手动
            </Button>
            <Button
              variant={
                rulesDraft.casting.preferManualMode === 'auto' ? 'primary' : 'secondary'
              }
              size="xs"
              onClick={() => onApplyCastingPreset('auto')}
            >
              全部偏自动
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>六爻起卦</span>
            <Select
              value={rulesDraft.casting.liuyaoDefaultMethod}
              onChange={(e) =>
                onUpdateCastingRule(
                  'liuyaoDefaultMethod',
                  e.target.value as GlobalRulesSettings['casting']['liuyaoDefaultMethod'],
                )
              }
            >
              <option value="coins">手动摇三钱</option>
              <option value="yarrow">蓍草起卦</option>
              <option value="time">自动按时间</option>
              <option value="manual">手动指定卦象</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>梅花易数</span>
            <Select
              value={rulesDraft.casting.meihuaDefaultMethod}
              onChange={(e) =>
                onUpdateCastingRule(
                  'meihuaDefaultMethod',
                  e.target.value as GlobalRulesSettings['casting']['meihuaDefaultMethod'],
                )
              }
            >
              <option value="number">数字报数</option>
              <option value="time">自动按时间</option>
              <option value="character">测字起卦</option>
              <option value="sound">声音起卦</option>
              <option value="direction">方位起卦</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>金口诀</span>
            <Select
              value={rulesDraft.casting.jinkoujueDefaultMethod}
              onChange={(e) =>
                onUpdateCastingRule(
                  'jinkoujueDefaultMethod',
                  e.target.value as GlobalRulesSettings['casting']['jinkoujueDefaultMethod'],
                )
              }
            >
              <option value="time">自动按时间</option>
              <option value="random">随机地分</option>
              <option value="number">数字报数</option>
              <option value="branch">手动点选地分</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>塔罗抽牌</span>
            <Select
              value={rulesDraft.casting.tarotDefaultDrawMode}
              onChange={(e) =>
                onUpdateCastingRule(
                  'tarotDefaultDrawMode',
                  e.target.value as GlobalRulesSettings['casting']['tarotDefaultDrawMode'],
                )
              }
            >
              <option value="random">自动随机抽取</option>
              <option value="interactive">手动洗牌抽牌</option>
              <option value="manual">手动自选牌面</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>塔罗逆位概率</span>
            <Select
              value={rulesDraft.casting.tarotReversalMode}
              onChange={(e) =>
                onUpdateCastingRule(
                  'tarotReversalMode',
                  e.target.value as GlobalRulesSettings['casting']['tarotReversalMode'],
                )
              }
            >
              <option value="realistic">约 30% 逆位</option>
              <option value="balanced">50% 对半</option>
              <option value="upright-only">仅正位</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>雷诺曼抽牌</span>
            <Select
              value={rulesDraft.casting.lenormandDefaultDrawMode}
              onChange={(e) =>
                onUpdateCastingRule(
                  'lenormandDefaultDrawMode',
                  e.target.value as GlobalRulesSettings['casting']['lenormandDefaultDrawMode'],
                )
              }
            >
              <option value="random">自动随机抽取</option>
              <option value="interactive">手动洗牌抽牌</option>
              <option value="manual">手动自选牌面</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>三山国王灵签</span>
            <Select
              value={rulesDraft.casting.ssgwDefaultMode}
              onChange={(e) =>
                onUpdateCastingRule(
                  'ssgwDefaultMode',
                  e.target.value as GlobalRulesSettings['casting']['ssgwDefaultMode'],
                )
              }
            >
              <option value="interactive">手动摇签筒</option>
              <option value="random">自动一键求签</option>
              <option value="manual">手动指定签号</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>诸葛神数</span>
            <Select
              value={rulesDraft.casting.kongmingDefaultMode}
              onChange={(e) =>
                onUpdateCastingRule(
                  'kongmingDefaultMode',
                  e.target.value as GlobalRulesSettings['casting']['kongmingDefaultMode'],
                )
              }
            >
              <option value="random">自动摇钱起卦</option>
              <option value="manual">手动三字 / 报数</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>奇门盘式</span>
            <Select
              value={rulesDraft.casting.qimenDefaultMethod}
              onChange={(e) =>
                onUpdateCastingRule(
                  'qimenDefaultMethod',
                  e.target.value as GlobalRulesSettings['casting']['qimenDefaultMethod'],
                )
              }
            >
              <option value="zhuanpan">转盘奇门</option>
              <option value="feipan">飞盘奇门</option>
            </Select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>小六壬掌诀</span>
            <Select
              value={rulesDraft.casting.xiaoliurenDefaultRule}
              onChange={(e) =>
                onUpdateCastingRule(
                  'xiaoliurenDefaultRule',
                  e.target.value as GlobalRulesSettings['casting']['xiaoliurenDefaultRule'],
                )
              }
            >
              <option value="common">六宫通行版</option>
              <option value="duoneng">九宫《多能鄙事》版</option>
            </Select>
          </label>
        </div>
      </section>
    </div>
  );
}
