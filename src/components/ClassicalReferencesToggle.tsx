import { supportsClassicalReferences } from 'mingyu-core/prompt';

interface ClassicalReferencesToggleProps {
  method: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ClassicalReferencesToggle({
  method,
  checked,
  onChange,
}: ClassicalReferencesToggleProps) {
  if (!supportsClassicalReferences(method)) return null;

  return (
    <label className="workspace-ui-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>附经典依据</span>
    </label>
  );
}
