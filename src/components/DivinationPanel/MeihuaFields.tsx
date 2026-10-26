import { Fragment, type ReactNode } from 'react';
import {
  MEIHUA_DIRECTION_OPTIONS,
  MEIHUA_METHOD_OPTIONS,
  MEIHUA_OBJECT_OPTIONS,
} from 'mingyu-core/divination/config';
import { DropdownSelect } from '@/components/DropdownSelect';
import type { DivinationDraft } from '@/lib/divination/engine';

type MeihuaFieldProps = {
  draft: DivinationDraft;
  updateDraft: <K extends keyof DivinationDraft>(key: K, value: DivinationDraft[K]) => void;
  layout: 'desktop' | 'mobile';
};

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function MeihuaMethodField({ draft, updateDraft, layout }: MeihuaFieldProps) {
  const isDesktop = layout === 'desktop';
  const select = (
    <DropdownSelect
      id={isDesktop ? 'meihua-method-select' : undefined}
      value={draft.meihuaMethod}
      options={MEIHUA_METHOD_OPTIONS}
      ariaLabel={isDesktop ? undefined : '起卦方式'}
      onChange={(value) => updateDraft('meihuaMethod', value)}
    />
  );

  return isDesktop ? (
    <div className="form-item divination-inline-field">
      <label htmlFor="meihua-method-select">起卦方式</label>
      <div className="divination-select-shell divination-desktop-select-shell">{select}</div>
    </div>
  ) : (
    <div className="divination-mobile-secondary-picker">{select}</div>
  );
}

export function MeihuaFields({ draft, updateDraft, layout }: MeihuaFieldProps) {
  const isDesktop = layout === 'desktop';
  const suffix = isDesktop ? '' : '-mobile';
  const fieldClassName = isDesktop ? 'form-item divination-inline-field' : 'form-item';
  const characterCount = Array.from(draft.meihuaCharacterText.trim()).length;

  function updateCharacterText(value: string) {
    updateDraft('meihuaCharacterText', value);
    if (Array.from(value.trim()).length !== characterCount) {
      updateDraft('meihuaCharacterTones', '');
      updateDraft('meihuaCharacterStrokeCounts', '');
      updateDraft('meihuaCharacterLeftStrokes', '');
      updateDraft('meihuaCharacterRightStrokes', '');
    }
  }

  let fields: ReactNode;
  if (draft.meihuaMethod === 'number' || draft.meihuaMethod === 'sound') {
    const isNumber = draft.meihuaMethod === 'number';
    const id = `meihua-${isNumber ? 'number' : 'sound-count'}-input${suffix}`;
    const key = isNumber ? 'meihuaNumber' : 'meihuaSoundCount';
    fields = (
      <div
        className={isDesktop ? `${fieldClassName} divination-inline-number-field` : fieldClassName}
      >
        <label htmlFor={id}>{isNumber ? '起卦数字' : '声音数'}</label>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="form-input"
          placeholder={isNumber ? '例如 123' : '例如 3'}
          value={draft[key]}
          onChange={(event) => updateDraft(key, digitsOnly(event.target.value))}
        />
      </div>
    );
  } else if (draft.meihuaMethod === 'character') {
    const singleCharacterFields = (
      <>
        <div className={fieldClassName}>
          <label htmlFor={`meihua-character-left-strokes-input${suffix}`}>左侧笔画</label>
          <input
            id={`meihua-character-left-strokes-input${suffix}`}
            type="text"
            inputMode="numeric"
            className="form-input"
            placeholder={isDesktop ? '单字分笔' : undefined}
            value={draft.meihuaCharacterLeftStrokes}
            onChange={(event) =>
              updateDraft('meihuaCharacterLeftStrokes', digitsOnly(event.target.value))
            }
          />
        </div>
        <div className={fieldClassName}>
          <label htmlFor={`meihua-character-right-strokes-input${suffix}`}>右侧笔画</label>
          <input
            id={`meihua-character-right-strokes-input${suffix}`}
            type="text"
            inputMode="numeric"
            className="form-input"
            placeholder={isDesktop ? '单字分笔' : undefined}
            value={draft.meihuaCharacterRightStrokes}
            onChange={(event) =>
              updateDraft('meihuaCharacterRightStrokes', digitsOnly(event.target.value))
            }
          />
        </div>
      </>
    );
    fields = (
      <>
        <div className={fieldClassName}>
          <label htmlFor={`meihua-character-text-input${suffix}`}>起卦文字</label>
          <input
            id={`meihua-character-text-input${suffix}`}
            type="text"
            className="form-input"
            placeholder="例如 今日动静如何"
            value={draft.meihuaCharacterText}
            onChange={(event) => updateCharacterText(event.target.value)}
          />
        </div>
        {characterCount >= 4 && characterCount <= 10 ? (
          <div className={fieldClassName}>
            <label htmlFor={`meihua-character-tones-input${suffix}`}>
              传统平上去入声数（非普通话声调）
            </label>
            <input
              id={`meihua-character-tones-input${suffix}`}
              type="text"
              className="form-input"
              placeholder="4-10字填写，如 1,4,3,3"
              value={draft.meihuaCharacterTones}
              onChange={(event) => updateDraft('meihuaCharacterTones', event.target.value)}
            />
          </div>
        ) : null}
        {[2, 3].includes(characterCount) ? (
          <div className={fieldClassName}>
            <label htmlFor={`meihua-character-strokes-input${suffix}`}>各字笔画数</label>
            <input
              id={`meihua-character-strokes-input${suffix}`}
              type="text"
              inputMode="numeric"
              className="form-input"
              placeholder="2-3字填写，如 7,8"
              value={draft.meihuaCharacterStrokeCounts}
              onChange={(event) =>
                updateDraft(
                  'meihuaCharacterStrokeCounts',
                  event.target.value.replace(/[^\d,，、\s]/g, ''),
                )
              }
            />
          </div>
        ) : null}
        {characterCount === 1 ? (
          isDesktop ? (
            singleCharacterFields
          ) : (
            <div className="form-row-flex">{singleCharacterFields}</div>
          )
        ) : null}
      </>
    );
  } else if (draft.meihuaMethod === 'direction') {
    const directionSelect = (
      <DropdownSelect
        id={`meihua-direction-select${suffix}`}
        value={draft.meihuaDirection}
        options={MEIHUA_DIRECTION_OPTIONS}
        onChange={(value) => updateDraft('meihuaDirection', value)}
      />
    );
    const objectSelect = (
      <DropdownSelect
        id={`meihua-object-type-select${suffix}`}
        value={draft.meihuaObjectType}
        options={MEIHUA_OBJECT_OPTIONS}
        onChange={(value) => updateDraft('meihuaObjectType', value)}
      />
    );
    fields = (
      <>
        <div className={fieldClassName}>
          <label htmlFor={`meihua-direction-select${suffix}`}>方位</label>
          {isDesktop ? (
            <div className="divination-select-shell divination-desktop-select-shell">
              {directionSelect}
            </div>
          ) : (
            directionSelect
          )}
        </div>
        <div className={fieldClassName}>
          <label htmlFor={`meihua-object-type-select${suffix}`}>所见物类</label>
          {isDesktop ? (
            <div className="divination-select-shell divination-desktop-select-shell">
              {objectSelect}
            </div>
          ) : (
            objectSelect
          )}
        </div>
      </>
    );
  } else {
    return null;
  }

  return isDesktop ? (
    <Fragment key={draft.meihuaMethod}>{fields}</Fragment>
  ) : (
    <div
      key={draft.meihuaMethod}
      className={
        draft.meihuaMethod === 'direction'
          ? 'form-row-flex divination-mobile-only'
          : 'form-row divination-mobile-only'
      }
    >
      {fields}
    </div>
  );
}
