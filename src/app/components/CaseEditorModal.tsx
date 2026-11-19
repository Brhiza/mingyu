import * as React from 'react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  createDefaultPersonalCase,
  upsertPersonalCase,
  type PersonalCase,
} from '../../v2-ui/cases-store';
import { createPersonFormCard, type PersonFormCardController } from '../../v2-ui/person-form';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';

export interface CaseEditorModalProps {
  open: boolean;
  editingCase: PersonalCase | null;
  birthPlaceModal: BirthPlaceModalController;
  onClose: () => void;
  onSaved: (saved: PersonalCase) => void;
}

export function CaseEditorModal({
  open,
  editingCase,
  birthPlaceModal,
  onClose,
  onSaved,
}: CaseEditorModalProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const controllerRef = React.useRef<PersonFormCardController | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErrorText(null);
    const frame = requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      const card = createPersonFormCard({
        role: 'self',
        sectionTitle: '出生资料',
        initialCase: editingCase ?? createDefaultPersonalCase({ id: '', name: '' }),
        showCasePickerButton: false,
        showSaveToCaseOption: false,
        birthPlaceModal,
      });
      controllerRef.current = card;
      host.replaceChildren(card.element);
    });
    return () => {
      cancelAnimationFrame(frame);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [open, editingCase, birthPlaceModal]);

  const handleSave = () => {
    const card = controllerRef.current;
    if (!card) return;
    const val = card.validate();
    if (!val.ok) {
      setErrorText(val.message);
      return;
    }
    const saved = upsertPersonalCase(card.getPerson(), editingCase?.id);
    onSaved(saved);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="case-editor-modal max-w-[720px]" showClose={false}>
        <DialogHeader className="case-editor-head">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle id="case-editor-title">
              {editingCase ? '编辑个人生辰档案' : '新建个人生辰档案'}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭档案编辑">
              关闭
            </Button>
          </div>
        </DialogHeader>

        <div className="case-editor-body min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div ref={hostRef} />
          {errorText ? (
            <div className="workspace-ui-form-error mt-3">{errorText}</div>
          ) : null}
        </div>

        <DialogFooter className="case-editor-actions">
          <Button variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            保存档案
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
