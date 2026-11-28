import * as React from 'react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  createDefaultPersonalCase,
  upsertPersonalCase,
  type PersonalCase,
} from '../../v2-ui/cases-store';
import { PersonFormCard } from './person/PersonFormCard';
import type { PersonFormCardHandle } from './person/person-form-helpers';
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
  const cardRef = React.useRef<PersonFormCardHandle | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setErrorText(null);
  }, [open, editingCase]);

  const initialCase = React.useMemo(
    () => editingCase ?? createDefaultPersonalCase({ id: '', name: '' }),
    [editingCase],
  );

  const handleSave = () => {
    const card = cardRef.current;
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
      <DialogContent className="case-editor-modal max-w-[720px]">
        <DialogHeader className="case-editor-head pr-12">
          <DialogTitle id="case-editor-title">
            {editingCase ? '编辑个人生辰档案' : '新建个人生辰档案'}
          </DialogTitle>
        </DialogHeader>

        <div className="case-editor-body min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {open ? (
            <PersonFormCard
              key={editingCase?.id ?? '__new__'}
              ref={cardRef}
              role="self"
              sectionTitle="出生资料"
              initialCase={initialCase}
              showCasePickerButton={false}
              showSaveToCaseOption={false}
              birthPlaceModal={birthPlaceModal}
            />
          ) : null}
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
