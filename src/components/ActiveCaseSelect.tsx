import type { PersonalHistoryRecord } from '@/lib/history-records';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';

type ActiveCaseSelectProps = {
  className?: string;
  label?: string;
  unspecifiedLabel?: string;
  onSelect?: (record: PersonalHistoryRecord | null) => void;
  onManage?: () => void;
};

export function ActiveCaseSelect({
  className = '',
  label = '当前案例',
  unspecifiedLabel = '不指定',
  onSelect,
  onManage,
}: ActiveCaseSelectProps) {
  const { cases, activeCaseId, selectCase } = useActivePersonalCase();
  const pinnedCases = cases.filter((record) => record.pinned);
  const recentCases = cases.filter((record) => !record.pinned);

  const renderOption = (record: PersonalHistoryRecord) => (
    <option value={record.id} key={record.id}>
      {record.name} · {record.birthText}
    </option>
  );

  return (
    <div className={`active-case-select ${className}`.trim()}>
      <div className="active-case-select-head">
        <span>{label}</span>
        {onManage ? (
          <button type="button" onClick={onManage}>
            管理
          </button>
        ) : null}
      </div>
      <select
        aria-label={label}
        value={activeCaseId ?? ''}
        onChange={(event) => {
          const record = cases.find((item) => item.id === event.target.value) ?? null;
          selectCase(record?.id ?? null);
          onSelect?.(record);
        }}
      >
        <option value="">{unspecifiedLabel}</option>
        {pinnedCases.length ? (
          <optgroup label="置顶案例">{pinnedCases.map(renderOption)}</optgroup>
        ) : null}
        {recentCases.length ? (
          <optgroup label="最近使用">{recentCases.map(renderOption)}</optgroup>
        ) : null}
      </select>
    </div>
  );
}
