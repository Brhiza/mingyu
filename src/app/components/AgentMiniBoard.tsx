import * as React from 'react';
import type { AgentToolTrace } from '../../web-agent-storage';

interface MiniBoardProps {
  trace: AgentToolTrace;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractResultData(fullResult: unknown): Record<string, unknown> | null {
  const root = asRecord(fullResult);
  if (!root) return null;
  const data = asRecord(root.data);
  return data ?? root;
}

function BaziMiniBoard({ data }: { data: Record<string, unknown> }) {
  const chart = asRecord(data.chart);
  const pillars = asRecord(chart?.pillars);
  if (!pillars) return null;
  const cols = [
    { key: 'year', label: '年柱' },
    { key: 'month', label: '月柱' },
    { key: 'day', label: '日柱' },
    { key: 'hour', label: '时柱' },
  ] as const;
  const strength = asRecord(chart?.strength);
  const overview = asRecord(chart?.patternOverview);

  return (
    <div className="mt-2 grid gap-1.5">
      <div className="grid grid-cols-4 gap-1.5">
        {cols.map(({ key, label }) => {
          const p = asRecord(pillars[key]);
          if (!p) return null;
          const gan = String(p.gan ?? '');
          const zhi = String(p.zhi ?? '');
          const tenGod = key === 'day' ? '日主' : String(p.tenGod ?? '');
          const naYin = String(p.naYin ?? '');
          return (
            <div
              key={key}
              className="flex flex-col items-center rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-1.5 py-1.5 text-center"
            >
              <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
              <span className="text-[10px] font-semibold text-[var(--accent-strong)]">{tenGod}</span>
              <span className="mt-0.5 text-[15px] font-bold tracking-wider text-[var(--text-strong)]">
                {gan}
                {zhi}
              </span>
              {naYin ? <span className="text-[9.5px] text-[var(--text-muted)]">{naYin}</span> : null}
            </div>
          );
        })}
      </div>
      {(strength?.status || overview?.pattern) ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          {strength?.status ? (
            <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5">
              旺衰：{String(strength.status)}
            </span>
          ) : null}
          {overview?.pattern ? (
            <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5">
              格局：{String(overview.pattern)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ZiweiMiniBoard({ data }: { data: Record<string, unknown> }) {
  const natal = asRecord(data.natal);
  const palacesRaw = Array.isArray(natal?.palaces) ? natal.palaces : [];
  if (!palacesRaw.length) return null;
  const focusNames = ['命宫', '财帛', '官禄', '迁移', '夫妻', '福德'];
  const picked = focusNames
    .map((name) =>
      palacesRaw.find((p) => {
        const rec = asRecord(p);
        const pName = String(rec?.name ?? '');
        return pName === name || pName === name.replace('宫', '');
      }),
    )
    .filter(Boolean) as Record<string, unknown>[];
  if (!picked.length) return null;

  return (
    <div className="mt-2 grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
        {natal?.fiveElementsClass ? (
          <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5 font-semibold text-[var(--text-strong)]">
            {String(natal.fiveElementsClass)}
          </span>
        ) : null}
        {natal?.soul ? (
          <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5">
            命主：{String(natal.soul)}
          </span>
        ) : null}
        {natal?.body ? (
          <span className="rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5">
            身主：{String(natal.body)}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {picked.map((p, idx) => {
          const majors = Array.isArray(p.majorStars)
            ? p.majorStars
                .map((s) => {
                  const sr = asRecord(s);
                  if (!sr?.name) return '';
                  const mut = sr.mutagen ? `[化${String(sr.mutagen)}]` : '';
                  const br = sr.brightness ? `(${String(sr.brightness)})` : '';
                  return `${String(sr.name)}${br}${mut}`;
                })
                .filter(Boolean)
            : [];
          return (
            <div
              key={`${String(p.name ?? idx)}-${idx}`}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-1.5"
            >
              <div className="flex items-center justify-between text-[10.5px]">
                <strong className="text-[var(--text-strong)]">{String(p.name ?? '')}</strong>
                <span className="text-[var(--text-muted)]">
                  {String(p.heavenlyStem ?? '')}
                  {String(p.earthlyBranch ?? '')}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">
                {majors.length ? majors.join('、') : '空宫（借对宫）'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiuyaoMiniBoard({ data }: { data: Record<string, unknown> }) {
  const yaos = Array.isArray(data.yaosDetail) ? data.yaosDetail : [];
  if (yaos.length !== 6) return null;
  const origName = String(data.originalName ?? '');
  const changedName = String(data.changedName ?? '');
  // 自上而下显示六爻 → 初爻
  const ordered = [...yaos].reverse();

  return (
    <div className="mt-2 grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[var(--text-strong)]">
        <span>{origName}</span>
        {changedName && changedName !== origName ? (
          <>
            <span className="text-[var(--text-muted)]">→</span>
            <span className="text-[var(--accent-strong)]">{changedName}</span>
          </>
        ) : null}
        {data.specialPattern ? (
          <span className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
            {String(data.specialPattern)}
          </span>
        ) : null}
      </div>
      <div className="grid gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-2 font-mono text-[11px]">
        {ordered.map((raw, idx) => {
          const y = asRecord(raw);
          if (!y) return null;
          const isYang = y.yaoType === '阳';
          const isChanging = Boolean(y.isChanging);
          const sr = y.isWorld ? '世' : y.isResponse ? '应' : '';
          return (
            <div key={idx} className="grid grid-cols-[40px_1fr_76px_26px] items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)]">{String(y.sixGod ?? '')}</span>
              <div className="flex items-center gap-1">
                {isYang ? (
                  <span className="block h-1.5 w-full rounded-sm bg-[var(--text-strong)]" />
                ) : (
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="block h-1.5 flex-1 rounded-sm bg-[var(--text-strong)]" />
                    <span className="block h-1.5 flex-1 rounded-sm bg-[var(--text-strong)]" />
                  </span>
                )}
                {isChanging ? (
                  <span className="shrink-0 text-[10px] font-bold text-[var(--accent-strong)]">
                    {isYang ? '○' : '×'}
                  </span>
                ) : null}
              </div>
              <span className="truncate text-right text-[10.5px] text-[var(--text-primary)]">
                {String(y.sixRelative ?? '')}
                {String(y.najiaDizhi ?? '')}
                {String(y.wuxing ?? '')}
              </span>
              <span className="text-right text-[10px] font-bold text-[var(--accent-strong)]">
                {sr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LO_SHU_GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;

function QimenMiniBoard({ data }: { data: Record<string, unknown> }) {
  const cells = Array.isArray(data.jiuGongGe) ? data.jiuGongGe : [];
  if (!cells.length) return null;
  const byGong = new Map<number, Record<string, unknown>>();
  for (const raw of cells) {
    const rec = asRecord(raw);
    if (rec && typeof rec.gong === 'number') {
      byGong.set(rec.gong, rec);
    }
  }
  const dunLabel = `${data.isYangDun ? '阳遁' : '阴遁'}${String(data.juShu ?? '')}局`;

  return (
    <div className="mt-2 grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
        <span className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 font-semibold text-[var(--text-strong)]">
          {dunLabel}
        </span>
        {data.zhiFu ? <span>值符：{String(data.zhiFu)}</span> : null}
        {data.zhiShi ? <span>值使：{String(data.zhiShi)}</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {LO_SHU_GRID_ORDER.map((gongNum) => {
          const cell = byGong.get(gongNum);
          const tian = asRecord(cell?.tianPan);
          const di = asRecord(cell?.diPan);
          const ren = asRecord(cell?.renPan);
          const shen = asRecord(cell?.shenPan);
          return (
            <div
              key={gongNum}
              className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-soft)] px-1.5 py-1 text-[10px] leading-tight"
            >
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>{String(shen?.god ?? (gongNum === 5 ? '中五宫' : ''))}</span>
                <span>{String(tian?.stem ?? '')}/{String(di?.stem ?? '')}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between font-semibold text-[var(--text-strong)]">
                <span>{String(tian?.star ?? '')}</span>
                <span className="text-[var(--accent-strong)]">{String(ren?.door ?? '')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardsMiniBoard({ data }: { data: Record<string, unknown> }) {
  const cards = Array.isArray(data.cards) ? data.cards : [];
  if (!cards.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {cards.slice(0, 6).map((raw, idx) => {
        const c = asRecord(raw);
        if (!c?.name) return null;
        const reversed = Boolean(c.reversed);
        return (
          <div
            key={`${String(c.name)}-${idx}`}
            className="flex flex-col rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-1 text-[11px]"
          >
            {c.position ? (
              <span className="text-[9.5px] text-[var(--text-muted)]">{String(c.position)}</span>
            ) : null}
            <span className="font-semibold text-[var(--text-strong)]">
              {String(c.name)}
              {'reversed' in c ? (
                <span
                  className={
                    reversed
                      ? 'ml-1 text-[10px] font-medium text-[var(--danger-text)]'
                      : 'ml-1 text-[10px] font-medium text-[var(--accent-strong)]'
                  }
                >
                  {reversed ? '逆位' : '正位'}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryFallbackMiniBoard({ trace }: { trace: AgentToolTrace }) {
  const tags = trace.summary?.tags ?? [];
  const lines = trace.summary?.lines ?? [];
  if (!tags.length && !lines.length) return null;

  return (
    <div className="mt-2 grid gap-1.5">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 8).map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-primary)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {lines.length > 0 ? (
        <ul className="m-0 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-[var(--text-secondary)]">
          {lines.slice(0, 3).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 聊天流内嵌迷你盘面预览组件：
 * 在 Agent 工具卡片内直接展示核心盘面结构，同时保留点击「查看盘面」进入完整工作台。
 */
export function AgentMiniBoard({ trace }: MiniBoardProps) {
  if (trace.status !== 'success') return null;
  const data = extractResultData(trace.fullResult);

  if (data) {
    if (trace.method === 'bazi') {
      return <BaziMiniBoard data={data} />;
    }
    if (trace.method === 'ziwei') {
      return <ZiweiMiniBoard data={data} />;
    }
    if (trace.method === 'liuyao') {
      return <LiuyaoMiniBoard data={data} />;
    }
    if (trace.method === 'qimen' || trace.method === 'qimen-lifetime') {
      return <QimenMiniBoard data={data} />;
    }
    if (trace.method === 'tarot' || trace.method === 'lenormand') {
      return <CardsMiniBoard data={data} />;
    }
  }

  return <SummaryFallbackMiniBoard trace={trace} />;
}
