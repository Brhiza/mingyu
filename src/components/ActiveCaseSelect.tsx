import type { PersonalHistoryRecord } from '@/lib/history-records';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';

type ActiveCaseSelectProps = {
  className?: string;
  label?: string;
  unspecifiedLabel?: string;
  onSelect?: (record: PersonalHistoryRecord | null) => void;
};

export function ActiveCaseSelect({
  className = '',
  label = '当前案例',
  unspecifiedLabel = '不指定（每次新建）',
  onSelect,
}: ActiveCaseSelectProps) {
  const { cases, activeCaseId, selectCase } = useActivePersonalCase();

  return (
    <label className={`active-case-select ${className}`.trim()}>
      <span>{label}</span>
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
        {cases.map((record) => (
          <option value={record.id} key={record.id}>
            {record.pinned ? '★ ' : ''}
            {record.name} · {record.birthText}
          </option>
        ))}
      </select>
    </label>
  );
}
