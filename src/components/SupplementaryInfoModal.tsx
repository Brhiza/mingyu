import { useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';
import { DropdownSelect, type DropdownSelectOption } from './DropdownSelect';

export type SupplementaryInfoModalField = {
  key: string;
  label: string;
  placeholder?: string;
  rows?: number;
  type?: 'textarea' | 'select' | 'text';
  options?: readonly DropdownSelectOption<string>[];
  inputMode?: 'text' | 'numeric';
  maxLength?: number;
  fullWidth?: boolean;
};

type SupplementaryInfoModalProps = {
  fields: readonly SupplementaryInfoModalField[];
  values: Record<string, string | undefined>;
  onSave: (values: Record<string, string>) => void;
  onClose: () => void;
  description?: string;
};

export function SupplementaryInfoModal({
  fields,
  values,
  onSave,
  onClose,
  description = '填写与问题直接相关的背景或限制，未填写的项目不会进入解读。',
}: SupplementaryInfoModalProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, values[field.key] ?? ''])),
  );

  return (
    <WorkspaceDialog
      className="supplementary-info-modal"
      labelledBy="supplementary-info-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header">
        <div>
          <h2 id="supplementary-info-title">补充信息</h2>
          <p>{description}</p>
        </div>
        <WorkspaceButton variant="ghost" size="small" onClick={onClose} aria-label="关闭补充信息">
          关闭
        </WorkspaceButton>
      </header>

      <form
        className="supplementary-info-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draftValues);
          onClose();
        }}
      >
        <div
          className={`workspace-ui-dialog-body supplementary-info-grid ${
            fields.length === 1 ? 'is-single' : ''
          }`}
        >
          {fields.map((field) => (
            <label
              className={`supplementary-info-field${
                field.fullWidth || (field.rows && field.rows > 3) ? ' is-full-width' : ''
              }`}
              key={field.key}
            >
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <DropdownSelect
                  value={draftValues[field.key] ?? ''}
                  options={field.options ?? []}
                  variant="field"
                  ariaLabel={field.label}
                  onChange={(value) =>
                    setDraftValues((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                />
              ) : field.type === 'text' ? (
                <input
                  type="text"
                  className="supplementary-info-input"
                  inputMode={field.inputMode}
                  maxLength={field.maxLength}
                  placeholder={field.placeholder}
                  value={draftValues[field.key] ?? ''}
                  onChange={(event) =>
                    setDraftValues((current) => ({
                      ...current,
                      [field.key]:
                        field.inputMode === 'numeric'
                          ? event.target.value.replace(/[^\d]/g, '').slice(0, field.maxLength ?? 4)
                          : event.target.value,
                    }))
                  }
                />
              ) : (
                <textarea
                  rows={field.rows ?? 3}
                  value={draftValues[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setDraftValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
        </div>

        <footer className="workspace-ui-dialog-footer">
          <WorkspaceButton onClick={onClose}>取消</WorkspaceButton>
          <WorkspaceButton type="submit" variant="primary">
            保存
          </WorkspaceButton>
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
