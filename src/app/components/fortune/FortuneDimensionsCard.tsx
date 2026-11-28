import { FileText } from 'lucide-react';
import { Badge, Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { trendBadgeVariant } from './fortune-storage';

export interface FortuneDimensionItem {
  id: string;
  label: string;
  score: number;
  trend: '旺' | '平' | '谨' | '吉' | '慎' | '优选' | '平稳' | '慎用';
  summary: string;
}

export interface FortuneDimensionsCardProps {
  dimensions: readonly FortuneDimensionItem[];
  hiddenOnMobile: boolean;
  onOpenDetails: () => void;
}

export function FortuneDimensionsCard({
  dimensions,
  hiddenOnMobile,
  onOpenDetails,
}: FortuneDimensionsCardProps) {
  return (
    <Card className={cn('grid gap-3 bg-[var(--surface-base)] p-3 sm:p-5', hiddenOnMobile && 'hidden lg:grid')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-black text-[var(--text-strong)]">
          五维趋势
        </h2>
        <button
          type="button"
          onClick={onOpenDetails}
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent-strong)]"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>推演明细</span>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {dimensions.map((dim) => {
          const barColor =
            dim.trend === '旺'
              ? 'bg-[var(--success-text)]'
              : dim.trend === '谨'
                ? 'bg-[var(--secondary)]'
                : 'bg-[var(--accent-strong)]';
          return (
            <div
              key={dim.id}
              className="flex flex-col gap-1.5 rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3"
            >
              <div className="flex items-center justify-between gap-1.5">
                <strong className="text-[13px] font-bold text-[var(--text-strong)]">
                  {dim.label}
                </strong>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs font-bold text-[var(--text-strong)]">
                    {dim.score}
                  </span>
                  <Badge variant={trendBadgeVariant(dim.trend)}>{dim.trend}</Badge>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', barColor)}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                {dim.summary}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
