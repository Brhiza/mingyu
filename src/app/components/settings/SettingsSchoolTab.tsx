import { Select, Switch } from '../../../components/ui';
import {
  GLOBAL_RULE_SECTIONS,
  type GlobalRuleFieldDescriptor,
  type GlobalRulesSettings,
} from '../../../web-settings';

export interface SettingsSchoolTabProps {
  rulesDraft: GlobalRulesSettings;
  onUpdateSectionField: (
    group: keyof GlobalRulesSettings,
    key: string,
    value: unknown,
  ) => void;
}

export function SettingsSchoolTab({
  rulesDraft,
  onUpdateSectionField,
}: SettingsSchoolTabProps) {
  return (
    <div className="grid gap-4">
      {GLOBAL_RULE_SECTIONS.map((section) => (
        <section
          key={section.title}
          className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"
        >
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            {section.title}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(section.fields as ReadonlyArray<GlobalRuleFieldDescriptor>).map((field) => {
              const bucket = rulesDraft[field.group] as Record<string, unknown>;
              const cur = bucket[field.key];
              if (field.kind === 'checkbox') {
                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-[var(--text-strong)]">
                      {field.label}
                    </span>
                    <Switch
                      checked={Boolean(cur)}
                      onCheckedChange={(val) =>
                        onUpdateSectionField(field.group, field.key, val)
                      }
                    />
                  </div>
                );
              }
              if (field.kind === 'textarea') {
                return (
                  <label
                    key={field.id}
                    className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2"
                  >
                    <span>{field.label}</span>
                    <textarea
                      id={field.id}
                      rows={field.rows ?? 4}
                      value={String(cur ?? '')}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        onUpdateSectionField(field.group, field.key, e.target.value)
                      }
                      className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                );
              }
              return (
                <label
                  key={field.id}
                  className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  <span>{field.label}</span>
                  <Select
                    value={String(cur ?? '')}
                    onChange={(e) =>
                      onUpdateSectionField(field.group, field.key, e.target.value)
                    }
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
