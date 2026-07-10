import type { PromptRealWorldContext } from '@/lib/metaphysics-prompt';

interface PromptContextFieldsProps {
  value: PromptRealWorldContext;
  onChange: (value: PromptRealWorldContext) => void;
}

const FIELDS: Array<{
  key: keyof PromptRealWorldContext;
  label: string;
  placeholder: string;
}> = [
  { key: 'currentSituation', label: '当前情况', placeholder: '正在发生什么、有哪些选择' },
  { key: 'currentState', label: '当前状态', placeholder: '目前的进度、情绪或资源状态' },
  { key: 'knownFacts', label: '已知事实', placeholder: '已经确认的人、事、时间和结果' },
  { key: 'desiredOutcome', label: '期望结果', placeholder: '最希望实现的结果' },
  { key: 'constraints', label: '现实限制', placeholder: '时间、预算、地点或责任限制' },
];

export function PromptContextFields({ value, onChange }: PromptContextFieldsProps) {
  return (
    <details className="field-card divination-context-fields">
      <summary>补充现实信息（可选）</summary>
      <small>填写越具体，提示词越容易贴近真实情况。</small>
      <div className="field-list">
        {FIELDS.map((field) => (
          <label className="form-item" key={field.key}>
            <span>{field.label}</span>
            <textarea
              rows={2}
              className="form-input divination-textarea"
              value={value[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
