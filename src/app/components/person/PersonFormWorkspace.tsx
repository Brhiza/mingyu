import * as React from 'react';
import type { Method } from '../../../schema';
import { createBirthPlaceModal } from '../../../v2-ui/birth-place-modal';
import {
  createDefaultPersonalCase,
  upsertCompatibilityRecord,
  type PersonalCase,
} from '../../../v2-ui/cases-store';
import { PersonFormCard } from './PersonFormCard';
import type {
  PersonFormCardHandle,
  PersonFormWorkspaceHandle,
  PersonRole,
} from './person-form-helpers';

const FORCE_PRECISE_METHODS = new Set<string>([
  'astrolabe',
  'astrolabe-range',
  'astrolabe-synastry',
  'qizheng',
  'qizheng-range',
]);

const ALLOW_UNKNOWN_TIME_METHODS = new Set<string>([
  'bazi',
  'bazi-synastry',
  'ziwei',
  'ziwei-synastry',
  'bazi-ziwei',
  'minglu',
  'chinese-name',
  'chinese-naming',
]);

export interface PersonFormWorkspaceProps {
  mode?: 'single' | 'compatibility';
  method?: Method | string;
  initialSelf?: Partial<PersonalCase>;
  initialPartner?: Partial<PersonalCase>;
  defaultSaveToCase?: boolean;
  onRequestCasePicker?: (
    role: PersonRole,
    applyCase: (selected: PersonalCase, isTemporary: boolean) => void,
  ) => void;
  onOpenTimeReverse?: (person: PersonalCase, role: PersonRole) => void;
  onOpenRangeScan?: (person: PersonalCase, role: PersonRole) => void;
  onChange?: (state: { self: PersonalCase; partner?: PersonalCase }) => void;
  onReady?: () => void;
}

const PersonFormWorkspace = React.forwardRef<PersonFormWorkspaceHandle, PersonFormWorkspaceProps>(
  function PersonFormWorkspace(
    {
      mode,
      method = 'bazi',
      initialSelf,
      initialPartner,
      defaultSaveToCase = false,
      onRequestCasePicker,
      onOpenTimeReverse,
      onOpenRangeScan,
      onChange,
      onReady,
    },
    ref,
  ) {
    const isCompatibility =
      mode === 'compatibility' ||
      method === 'bazi-synastry' ||
      method === 'ziwei-synastry' ||
      method === 'astrolabe-synastry';
    const forcePrecise = FORCE_PRECISE_METHODS.has(method);
    const allowUnknownTime = ALLOW_UNKNOWN_TIME_METHODS.has(method);
    const allowRangeScan = !isCompatibility && (method === 'astrolabe' || method === 'qizheng');

    const [activeMobileRole, setActiveMobileRole] = React.useState<PersonRole>('self');
    const selfCardRef = React.useRef<PersonFormCardHandle | null>(null);
    const partnerCardRef = React.useRef<PersonFormCardHandle | null>(null);
    const sharedPlaceModal = React.useMemo(() => createBirthPlaceModal(), []);

    const defaultPartner = React.useMemo(
      () =>
        initialPartner ??
        createDefaultPersonalCase({
          id: 'temporary_partner',
          name: '',
          gender: 'female',
          year: '1992',
          month: '6',
          day: '15',
          timeIndex: 6,
          isTemporary: true,
        }),
      [initialPartner],
    );

    React.useEffect(() => {
      onReady?.();
    }, [onReady]);

    React.useEffect(() => {
      return () => {
        sharedPlaceModal.destroy();
      };
    }, [sharedPlaceModal]);

    React.useImperativeHandle(
      ref,
      () => ({
        get selfCard() {
          return selfCardRef.current;
        },
        get partnerCard() {
          return partnerCardRef.current;
        },
        getState: () => ({
          self: selfCardRef.current?.getPerson() ?? createDefaultPersonalCase(initialSelf),
          ...(isCompatibility && partnerCardRef.current
            ? { partner: partnerCardRef.current.getPerson() }
            : {}),
        }),
        validate: () => {
          const selfVal = selfCardRef.current?.validate() ?? { ok: true };
          if (!selfVal.ok) {
            if (isCompatibility) setActiveMobileRole('self');
            return selfVal;
          }
          if (isCompatibility && partnerCardRef.current) {
            const partnerVal = partnerCardRef.current.validate();
            if (!partnerVal.ok) {
              setActiveMobileRole('partner');
              return partnerVal;
            }
          }
          return { ok: true };
        },
        persistIfRequested: () => {
          const selfCard = selfCardRef.current!;
          const self = selfCard.shouldSaveToCase()
            ? selfCard.saveToCasesStore()
            : selfCard.getPerson();
          let partner: PersonalCase | undefined;
          if (isCompatibility && partnerCardRef.current) {
            const pCard = partnerCardRef.current;
            partner = pCard.shouldSaveToCase() ? pCard.saveToCasesStore() : pCard.getPerson();
            upsertCompatibilityRecord(self, partner, { method: String(method) });
          }
          return { self, ...(partner ? { partner } : {}) };
        },
      }),
      [initialSelf, isCompatibility, method],
    );

    const handleCardChange = () => {
      const self = selfCardRef.current?.getPerson();
      if (!self) return;
      const partner = isCompatibility ? partnerCardRef.current?.getPerson() : undefined;
      onChange?.({
        self,
        ...(partner ? { partner } : {}),
      });
    };

    return (
      <div
        className={`workspace-ui-form-layout person-form-workspace${
          isCompatibility ? ' is-two-column is-compatibility' : ''
        }`}
      >
        {isCompatibility ? (
          <div
            className="compatibility-mobile-switcher"
            role="tablist"
            aria-label="合盘人员资料切换"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMobileRole === 'self'}
              className={`compatibility-mobile-switcher-btn${
                activeMobileRole === 'self' ? ' is-active' : ''
              }`}
              onClick={() => setActiveMobileRole('self')}
            >
              命主一
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMobileRole === 'partner'}
              className={`compatibility-mobile-switcher-btn${
                activeMobileRole === 'partner' ? ' is-active' : ''
              }`}
              onClick={() => setActiveMobileRole('partner')}
            >
              命主二
            </button>
          </div>
        ) : null}

        <PersonFormCard
          ref={selfCardRef}
          role="self"
          sectionTitle={isCompatibility ? '命主一' : '出生资料'}
          initialCase={initialSelf}
          forcePreciseBirthPlace={forcePrecise}
          allowUnknownTime={allowUnknownTime}
          showCasePickerButton
          showSaveToCaseOption
          defaultSaveToCase={defaultSaveToCase}
          birthPlaceModal={sharedPlaceModal}
          className={isCompatibility && activeMobileRole !== 'self' ? 'is-mobile-hidden-card' : ''}
          onRequestCasePicker={onRequestCasePicker}
          onOpenTimeReverse={onOpenTimeReverse}
          onOpenRangeScan={allowRangeScan ? onOpenRangeScan : undefined}
          onChange={handleCardChange}
        />

        {isCompatibility ? (
          <PersonFormCard
            ref={partnerCardRef}
            role="partner"
            sectionTitle="命主二"
            initialCase={defaultPartner}
            forcePreciseBirthPlace={forcePrecise}
            allowUnknownTime={allowUnknownTime}
            showCasePickerButton
            showSaveToCaseOption
            defaultSaveToCase={false}
            birthPlaceModal={sharedPlaceModal}
            className={activeMobileRole !== 'partner' ? 'is-mobile-hidden-card' : ''}
            onRequestCasePicker={onRequestCasePicker}
            onOpenTimeReverse={onOpenTimeReverse}
            onChange={handleCardChange}
          />
        ) : null}
      </div>
    );
  },
);

export default PersonFormWorkspace;
