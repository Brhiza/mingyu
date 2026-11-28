import { Plus, Trash2 } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import {
  TIME_REVERSE_CHIPS,
  type TimeReverseDraft,
  type TimeReverseMilestones,
} from '../../../v2-ui/time-reverse';
import { ChipSuggestions, ClozeBlank } from './TimeReverseClozeParts';

export interface TimeReverseMilestonesSectionProps {
  draft: TimeReverseDraft;
  onUpdateMilestones: (patch: Partial<TimeReverseMilestones>) => void;
  onAddCustomMilestone: () => void;
  onUpdateCustomMilestone: (
    id: string,
    patch: { when?: string; event?: string; impact?: string },
  ) => void;
  onRemoveCustomMilestone: (id: string) => void;
}

export function TimeReverseMilestonesSection({
  draft,
  onUpdateMilestones,
  onAddCustomMilestone,
  onUpdateCustomMilestone,
  onRemoveCustomMilestone,
}: TimeReverseMilestonesSectionProps) {
  return (
    <Card className="grid gap-3.5 p-4 sm:p-5">
      <h2 className="m-0 text-[15px] font-bold text-[var(--text-strong)]">
        三、人生重大节点
      </h2>

      {/* 1. 学业与考学 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">1. 学业与考学转折</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>我大约在</span>
          <ClozeBlank
            value={draft.milestones.studyWhen}
            onChange={(v) => onUpdateMilestones({ studyWhen: v })}
            placeholder="如 2016年 或 18岁"
            widthClass="min-w-[130px]"
            ariaLabel="学业转折年份"
          />
          <span>经历过一次印象很深的学业/考试转折，结果是</span>
          <ClozeBlank
            value={draft.milestones.studyResult}
            onChange={(v) => onUpdateMilestones({ studyResult: v })}
            placeholder="超常发挥 / 失常 / 考研上岸"
            widthClass="min-w-[175px]"
            ariaLabel="学业转折结果"
          />
          <span>；我最高学历或擅长方向偏向</span>
          <ClozeBlank
            value={draft.milestones.studyMajor}
            onChange={(v) => onUpdateMilestones({ studyMajor: v })}
            placeholder="理工 / 文史 / 经管 / 艺术"
            widthClass="min-w-[160px]"
            ariaLabel="专业方向"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.studyResult}
          value={draft.milestones.studyResult}
          onSelect={(v) => onUpdateMilestones({ studyResult: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.studyMajor}
          value={draft.milestones.studyMajor}
          onSelect={(v) => onUpdateMilestones({ studyMajor: v })}
        />
      </div>

      {/* 2. 职业与事业变动 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">2. 职业起步与重大变动</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>我大概在</span>
          <ClozeBlank
            value={draft.milestones.careerStartWhen}
            onChange={(v) => onUpdateMilestones({ careerStartWhen: v })}
            placeholder="如 2019年"
            widthClass="min-w-[110px]"
            ariaLabel="开始工作年份"
          />
          <span>开始正式工作；在</span>
          <ClozeBlank
            value={draft.milestones.careerChangeWhen}
            onChange={(v) => onUpdateMilestones({ careerChangeWhen: v })}
            placeholder="如 2023年"
            widthClass="min-w-[110px]"
            ariaLabel="职场变动年份"
          />
          <span>经历过一次明显变动：</span>
          <ClozeBlank
            value={draft.milestones.careerChangeEvent}
            onChange={(v) => onUpdateMilestones({ careerChangeEvent: v })}
            placeholder="升职 / 跳槽 / 创业 / 被裁"
            widthClass="min-w-[165px]"
            ariaLabel="职场变动事件"
          />
          <span>，目前或做得最久的行业偏向</span>
          <ClozeBlank
            value={draft.milestones.careerField}
            onChange={(v) => onUpdateMilestones({ careerField: v })}
            placeholder="体制内 / 互联网 / 销售 / 自由职业"
            widthClass="min-w-[180px]"
            ariaLabel="从事行业"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.careerChangeEvent}
          value={draft.milestones.careerChangeEvent}
          onSelect={(v) => onUpdateMilestones({ careerChangeEvent: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.careerField}
          value={draft.milestones.careerField}
          onSelect={(v) => onUpdateMilestones({ careerField: v })}
        />
      </div>

      {/* 3. 感情与婚姻 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">3. 感情经历与婚姻状态</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>我大约在</span>
          <ClozeBlank
            value={draft.milestones.loveWhen}
            onChange={(v) => onUpdateMilestones({ loveWhen: v })}
            placeholder="如 2018年 或 22岁"
            widthClass="min-w-[130px]"
            ariaLabel="重要恋情年份"
          />
          <span>遇到过印象很深的一段感情；在</span>
          <ClozeBlank
            value={draft.milestones.marriageWhen}
            onChange={(v) => onUpdateMilestones({ marriageWhen: v })}
            placeholder="年份（单身可不填）"
            widthClass="min-w-[130px]"
            ariaLabel="婚恋节点年份"
          />
          <span>经历了</span>
          <ClozeBlank
            value={draft.milestones.marriageStatus}
            onChange={(v) => onUpdateMilestones({ marriageStatus: v })}
            placeholder="领证结婚 / 重大分手 / 至今单身"
            widthClass="min-w-[180px]"
            ariaLabel="婚恋状态"
          />
          <span>。另一半给我的感觉通常是</span>
          <ClozeBlank
            value={draft.milestones.partnerTraits}
            onChange={(v) => onUpdateMilestones({ partnerTraits: v })}
            placeholder="脾气较急 / 很照顾人 / 聚少离多"
            widthClass="min-w-[180px]"
            ariaLabel="伴侣特征"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.marriageStatus}
          value={draft.milestones.marriageStatus}
          onSelect={(v) => onUpdateMilestones({ marriageStatus: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.partnerTraits}
          value={draft.milestones.partnerTraits}
          onSelect={(v) => onUpdateMilestones({ partnerTraits: v })}
        />
      </div>

      {/* 4. 财运起伏与买房置业 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">4. 财运起伏与买房置业</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>进账最顺的一年大概在</span>
          <ClozeBlank
            value={draft.milestones.wealthGoodWhen}
            onChange={(v) => onUpdateMilestones({ wealthGoodWhen: v })}
            placeholder="如 2021年"
            widthClass="min-w-[100px]"
            ariaLabel="顺财年份"
          />
          <span>，因为</span>
          <ClozeBlank
            value={draft.milestones.wealthGoodReason}
            onChange={(v) => onUpdateMilestones({ wealthGoodReason: v })}
            placeholder="奖金大涨 / 副业爆单 / 投资赚钱"
            widthClass="min-w-[180px]"
            ariaLabel="顺财原因"
          />
          <span>；而明显破财或经济压力最大的一年是</span>
          <ClozeBlank
            value={draft.milestones.wealthBadWhen}
            onChange={(v) => onUpdateMilestones({ wealthBadWhen: v })}
            placeholder="如 2024年"
            widthClass="min-w-[100px]"
            ariaLabel="破财年份"
          />
          <span>，原因是</span>
          <ClozeBlank
            value={draft.milestones.wealthBadReason}
            onChange={(v) => onUpdateMilestones({ wealthBadReason: v })}
            placeholder="投资被套 / 被骗 / 生意亏损"
            widthClass="min-w-[180px]"
            ariaLabel="破财原因"
          />
          <span>。另外我在</span>
          <ClozeBlank
            value={draft.milestones.propertyWhen}
            onChange={(v) => onUpdateMilestones({ propertyWhen: v })}
            placeholder="年份"
            widthClass="min-w-[90px]"
            ariaLabel="置业年份"
          />
          <span>有过</span>
          <ClozeBlank
            value={draft.milestones.propertyEvent}
            onChange={(v) => onUpdateMilestones({ propertyEvent: v })}
            placeholder="买房 / 买车 / 长途搬家"
            widthClass="min-w-[150px]"
            ariaLabel="置业事件"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.wealthGoodReason}
          value={draft.milestones.wealthGoodReason}
          onSelect={(v) => onUpdateMilestones({ wealthGoodReason: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.wealthBadReason}
          value={draft.milestones.wealthBadReason}
          onSelect={(v) => onUpdateMilestones({ wealthBadReason: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.propertyEvent}
          value={draft.milestones.propertyEvent}
          onSelect={(v) => onUpdateMilestones({ propertyEvent: v })}
        />
      </div>

      {/* 5. 健康、伤病与突发意外 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">5. 健康、伤病或至亲变故</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>我自己或至亲在</span>
          <ClozeBlank
            value={draft.milestones.healthWhen}
            onChange={(v) => onUpdateMilestones({ healthWhen: v })}
            placeholder="年份或年龄"
            widthClass="min-w-[115px]"
            ariaLabel="健康意外年份"
          />
          <span>遇到过一次较担心的状况（</span>
          <ClozeBlank
            value={draft.milestones.healthType}
            onChange={(v) => onUpdateMilestones({ healthType: v })}
            placeholder="住院手术 / 骨折 / 车祸 / 至亲变故"
            widthClass="min-w-[180px]"
            ariaLabel="健康意外类型"
          />
          <span>），大概情况是</span>
          <ClozeBlank
            value={draft.milestones.healthDetail}
            onChange={(v) => onUpdateMilestones({ healthDetail: v })}
            placeholder="简述部位或经过（可选）"
            widthClass="min-w-[180px]"
            ariaLabel="健康意外详情"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.healthType}
          value={draft.milestones.healthType}
          onSelect={(v) => onUpdateMilestones({ healthType: v })}
        />
      </div>

      {/* 6. 离乡变动、贵人与是非 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">6. 离乡方向、贵人或是非纠纷</div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>我大约在</span>
          <ClozeBlank
            value={draft.milestones.moveWhen}
            onChange={(v) => onUpdateMilestones({ moveWhen: v })}
            placeholder="年份"
            widthClass="min-w-[95px]"
            ariaLabel="离乡年份"
          />
          <span>离开老家去外地求学/工作，前往的方向大致在老家的</span>
          <ClozeBlank
            value={draft.milestones.moveDirection}
            onChange={(v) => onUpdateMilestones({ moveDirection: v })}
            placeholder="南方 / 北方 / 沿海 / 海外"
            widthClass="min-w-[155px]"
            ariaLabel="离乡方向"
          />
          <span>；我在</span>
          <ClozeBlank
            value={draft.milestones.helperWhen}
            onChange={(v) => onUpdateMilestones({ helperWhen: v })}
            placeholder="年份"
            widthClass="min-w-[90px]"
            ariaLabel="遇贵人年份"
          />
          <span>遇到过特别拉我一把的贵人；在</span>
          <ClozeBlank
            value={draft.milestones.disputeWhen}
            onChange={(v) => onUpdateMilestones({ disputeWhen: v })}
            placeholder="年份"
            widthClass="min-w-[90px]"
            ariaLabel="遇是非年份"
          />
          <span>遭遇过</span>
          <ClozeBlank
            value={draft.milestones.disputeType}
            onChange={(v) => onUpdateMilestones({ disputeType: v })}
            placeholder="合同纠纷 / 口舌是非 / 被背刺"
            widthClass="min-w-[175px]"
            ariaLabel="是非纠纷类型"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.moveDirection}
          value={draft.milestones.moveDirection}
          onSelect={(v) => onUpdateMilestones({ moveDirection: v })}
        />
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.disputeType}
          value={draft.milestones.disputeType}
          onSelect={(v) => onUpdateMilestones({ disputeType: v })}
        />
      </div>

      {/* 7. 近两三年真实体感 */}
      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5">
        <div className="mb-1 text-xs font-bold text-[var(--accent-strong)]">
          7. 近两三年真实体感（流年最容易精准校准）
        </div>
        <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
          <span>回想最近两三年（如 2024–2026 年），我整体感受最深的变化主要是</span>
          <ClozeBlank
            value={draft.milestones.recentTrend}
            onChange={(v) => onUpdateMilestones({ recentTrend: v })}
            placeholder="事业卡顿 / 感情波动 / 财运起伏"
            widthClass="min-w-[190px]"
            ariaLabel="近两三年主线感受"
          />
          <span>，具体发生的一件典型事是：</span>
          <ClozeBlank
            value={draft.milestones.recentEvent}
            onChange={(v) => onUpdateMilestones({ recentEvent: v })}
            placeholder="用一句话写件记得住的事"
            widthClass="min-w-[210px] sm:min-w-[260px]"
            ariaLabel="近两三年典型事件"
          />
          <span>。</span>
        </div>
        <ChipSuggestions
          chips={TIME_REVERSE_CHIPS.recentTrend}
          value={draft.milestones.recentTrend}
          onSelect={(v) => onUpdateMilestones({ recentTrend: v })}
        />
      </div>

      {/* 8. 自由追加大事记 */}
      {draft.milestones.customMilestones.map((item, idx) => (
        <div
          key={item.id}
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              补充大事记 #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemoveCustomMilestone(item.id)}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger-text)] cursor-pointer bg-transparent border-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>删除</span>
            </button>
          </div>
          <div className="text-[14px] leading-[2.2] text-[var(--text-primary)]">
            <span>大约在</span>
            <ClozeBlank
              value={item.when}
              onChange={(v) => onUpdateCustomMilestone(item.id, { when: v })}
              placeholder="年份或年龄"
              widthClass="min-w-[110px]"
              ariaLabel={`补充大事记${idx + 1}时间`}
            />
            <span>，发生了</span>
            <ClozeBlank
              value={item.event}
              onChange={(v) => onUpdateCustomMilestone(item.id, { event: v })}
              placeholder="具体事情"
              widthClass="min-w-[180px]"
              ariaLabel={`补充大事记${idx + 1}事件`}
            />
            <span>，对我的影响是</span>
            <ClozeBlank
              value={item.impact}
              onChange={(v) => onUpdateCustomMilestone(item.id, { impact: v })}
              placeholder="结果或感受（可选）"
              widthClass="min-w-[170px]"
              ariaLabel={`补充大事记${idx + 1}影响`}
            />
            <span>。</span>
          </div>
        </div>
      ))}

      <div>
        <Button variant="outline" size="sm" onClick={onAddCustomMilestone}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>添加大事记</span>
        </Button>
      </div>
    </Card>
  );
}
