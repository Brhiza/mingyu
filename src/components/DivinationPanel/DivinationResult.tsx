import { useEffect, useMemo, useState } from 'react';
import type { DivinationDraft } from '@/lib/divination/engine';
import type { DivinationSession } from '@/lib/divination/engine';
import type { DivinationSummaryBlocks } from '@/lib/divination/summary';
import type { LiurenData, LiurenPlateItem, LiurenTransmission } from '@/types/divination';
import { AiChatPanel } from '@/components/AiChatPanel';
import { TraditionalDivinationBoard } from '@/components/DivinationPanel/TraditionalDivinationBoard';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';
import { CollapsiblePromptPreview } from '@/components/CollapsiblePromptPreview';
import { getCompactDivinationSummary } from './compact-evidence';

interface DivinationResultProps {
  isSubmitting: boolean;
  session: DivinationSession | null;
  summary: DivinationSummaryBlocks | null;
  methodLabelMap: Record<DivinationDraft['method'], string>;
  copyState: string;
  shareState: string;
  showShareButton: boolean;
  isPhoneLayout: boolean;
  onCopy: () => void;
  onShare: () => void;
}

const LIUREN_BRANCH_POSITIONS: Record<string, { row: number; column: number }> = {
  巳: { row: 1, column: 1 },
  午: { row: 1, column: 2 },
  未: { row: 1, column: 3 },
  申: { row: 1, column: 4 },
  酉: { row: 2, column: 4 },
  戌: { row: 3, column: 4 },
  亥: { row: 4, column: 4 },
  子: { row: 4, column: 3 },
  丑: { row: 4, column: 2 },
  寅: { row: 4, column: 1 },
  卯: { row: 3, column: 1 },
  辰: { row: 2, column: 1 },
};

const LIUREN_BRANCH_ORDER = Object.keys(LIUREN_BRANCH_POSITIONS);

function findLiurenTransmissionStage(
  transmissions: LiurenTransmission[],
  branch: string,
): LiurenTransmission['stage'] | null {
  return transmissions.find((item) => item.branch === branch)?.stage || null;
}

function LiurenPlateCell({ data, item }: { data: LiurenData; item: LiurenPlateItem }) {
  const position = LIUREN_BRANCH_POSITIONS[item.under];
  const transmissionStage = findLiurenTransmissionStage(data.threeTransmissions, item.branch);
  const className = [
    'liuren-script-cell',
    item.under === data.divinationBranch ? 'is-hour' : '',
    item.branch === data.monthLeader ? 'is-month-leader' : '',
    item.branch === data.noblemanBranch ? 'is-nobleman' : '',
    data.xunKong?.includes(item.under) ? 'is-empty' : '',
    transmissionStage ? 'is-transmission' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={position ? { gridColumn: position.column, gridRow: position.row } : undefined}
    >
      <span>{item.god}</span>
      <strong>{item.branch}</strong>
      {transmissionStage ? <em>{transmissionStage.replace('传', '')}</em> : null}
    </div>
  );
}

function LiurenPlateGrid({ data }: { data: LiurenData }) {
  const plateMap = new Map(data.heavenlyPlate.map((item) => [item.under, item]));
  const orderedPlate = LIUREN_BRANCH_ORDER.map((branch) => plateMap.get(branch)).filter(
    (item): item is LiurenPlateItem => Boolean(item),
  );

  return (
    <div className="liuren-script-plate">
      {orderedPlate.map((item) => (
        <LiurenPlateCell data={data} item={item} key={item.under} />
      ))}
      <div className="liuren-script-center">
        <span>天地盘</span>
        <strong>
          {data.ganzhi.day}日 {data.ganzhi.hour}时
        </strong>
        <p>
          月将{data.monthLeader}加{data.divinationBranch} · {data.dayNight || '时段未知'}
        </p>
        <p>
          {data.noblemanBranch ? `贵人${data.noblemanBranch}` : '贵人未标注'}
          {data.noblemanGroundBranch ? `临${data.noblemanGroundBranch}` : ''}
          {' · '}
          {data.xunKong?.length ? `旬空${data.xunKong.join('、')}` : '旬空未知'}
        </p>
      </div>
    </div>
  );
}

function LiurenCompactMatrix({ data }: { data: LiurenData }) {
  return (
    <div className="liuren-compact-matrix">
      <section>
        <span className="liuren-matrix-title">四课</span>
        <div className="liuren-matrix-columns">
          {data.fourLessons.map((lesson) => (
            <div className="liuren-matrix-column" key={lesson.name}>
              <span>{lesson.god}</span>
              <strong>{lesson.upper}</strong>
              <b>{lesson.lower}</b>
              <small>{lesson.name}</small>
            </div>
          ))}
        </div>
      </section>

      <section>
        <span className="liuren-matrix-title">三传</span>
        <div className="liuren-matrix-columns">
          {data.threeTransmissions.map((item) => (
            <div className="liuren-matrix-column" key={item.stage}>
              <span>{item.god}</span>
              <strong>{item.branch}</strong>
              <small>{item.stage}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LiurenBoard({ data }: { data: LiurenData }) {
  const transmissionText = data.threeTransmissions
    .map((item) => `${item.stage.replace('传', '')}${item.branch}`)
    .join(' → ');

  return (
    <div className="divination-extra-panel traditional-board liuren-board">
      <div className="divination-extra-head">
        <strong>大六壬天地盘</strong>
        <span>
          {data.ganzhi.day}日 · {data.ganzhi.hour}时
        </span>
      </div>

      <div className="liuren-reference-strip">
        <span>
          月将{data.monthLeader}加{data.divinationBranch}
        </span>
        <span>三传：{transmissionText || '未生成'}</span>
        <span>
          {data.transmissionRule || '取传未标注'}
          {data.xunKong?.length ? ` · 空${data.xunKong.join('、')}` : ''}
        </span>
      </div>

      <div className="liuren-script-panel">
        <LiurenPlateGrid data={data} />
        <LiurenCompactMatrix data={data} />
      </div>
    </div>
  );
}

export function DivinationResult({
  isSubmitting,
  session,
  summary,
  methodLabelMap,
  copyState,
  shareState,
  showShareButton,
  isPhoneLayout,
  onCopy,
  onShare,
}: DivinationResultProps) {
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(!isPhoneLayout);

  useEffect(() => {
    setIsEvidenceOpen(!isPhoneLayout);
  }, [isPhoneLayout, session]);

  if (isSubmitting) {
    if (isAiEnabled) {
      return (
        <div className="divination-ai-card" aria-hidden="true">
          <section className="panel divination-result-panel">
            <div className="divination-result-skeleton">
              <span className="skeleton-block divination-result-skeleton-title" />
              <div className="divination-result-skeleton-list">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    className="skeleton-block divination-result-skeleton-line"
                    key={`ai-line-${index}`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="workspace-grid divination-output-grid" aria-hidden="true">
        <section className="panel divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-tags">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-tag"
                  key={`tag-${index}`}
                />
              ))}
            </div>
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-a-${index}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="panel divination-result-panel">
          <div className="divination-result-skeleton">
            <span className="skeleton-block divination-result-skeleton-title" />
            <div className="divination-result-skeleton-list">
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  className="skeleton-block divination-result-skeleton-line"
                  key={`line-b-${index}`}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!session || !summary) {
    return null;
  }

  const isLiurenResult = session.method === 'liuren';
  const compactSummary = getCompactDivinationSummary(summary);

  // 前端只展示核对盘面所需的摘要；完整传统资料继续保留在提示词中。
  const resultBlock = (
    <section className="panel divination-result-panel">
      {!isLiurenResult ? (
        <div className="panel-head">
          <h2>{summary.title}</h2>
        </div>
      ) : null}

      {session.requestedMethod === 'random' ? (
        <div className="divination-random-note">本次随机到：{methodLabelMap[session.method]}</div>
      ) : null}

      <TraditionalDivinationBoard session={session} />

      {!isLiurenResult ? (
        <>
          <div className="divination-tag-cloud">
            {compactSummary.tags.map((item) => (
              <span className="result-soft-tag" key={item}>
                {item}
              </span>
            ))}
          </div>

          <div className="divination-summary-list">
            {compactSummary.lines.map((item) => (
              <div className="divination-summary-item" key={item}>
                {item}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {session.method === 'liuren' ? <LiurenBoard data={session.data as LiurenData} /> : null}
    </section>
  );

  if (isAiEnabled) {
    return (
      <div className="divination-ai-card">
        <details
          className="divination-result-collapse"
          open={isEvidenceOpen}
          onToggle={(event) => setIsEvidenceOpen(event.currentTarget.open)}
        >
          <summary>{isEvidenceOpen ? '收起排盘依据' : '查看排盘依据'}</summary>
          {resultBlock}
        </details>
        <AiChatPanel
          contextPrompt={session.prompt}
          autoStart={session.prompt}
          autoStartKey={session.prompt}
          resetKey={session.prompt}
          aiConfig={aiRequestConfig}
        />
      </div>
    );
  }

  return (
    <div className="workspace-grid divination-output-grid">
      <section className="panel panel-output divination-result-panel">
        <div className="panel-head divination-prompt-head">
          <div>
            <h2>复制占卜提示词</h2>
            <p>完整提示词已经生成，可以直接复制使用。</p>
          </div>
          <div className="action-row compact-actions divination-prompt-actions">
            <button className="copy-button secondary-button" type="button" onClick={onCopy}>
              {copyState}
            </button>
            {showShareButton ? (
              <button className="copy-button" type="button" onClick={onShare}>
                {shareState}
              </button>
            ) : null}
          </div>
        </div>
        <div className="prompt-send-tip">点击复制后，发送到你常用的在线 AI 软件继续提问。</div>
        <CollapsiblePromptPreview promptText={session.prompt} />
      </section>

      <details
        className="divination-result-collapse"
        open={isEvidenceOpen}
        onToggle={(event) => setIsEvidenceOpen(event.currentTarget.open)}
      >
        <summary>{isEvidenceOpen ? '收起排盘依据' : '查看排盘依据'}</summary>
        {resultBlock}
      </details>
    </div>
  );
}
