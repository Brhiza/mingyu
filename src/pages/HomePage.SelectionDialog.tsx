import { useEffect, useId, useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from '@/components/workspace/WorkspaceUI';
import './HomePage.SelectionDialog.css';

export type HomeSelectionOption = {
  value: string;
  label: string;
  description: string;
};

export function HomeSelectionDialog(props: {
  title: string;
  searchPlaceholder: string;
  options: HomeSelectionOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  favoriteValue?: string;
  favoriteLabel?: string;
  onFavoriteChange?: (value: string) => void;
}) {
  const titleId = useId();
  const [search, setSearch] = useState('');
  const keyword = search.trim().toLocaleLowerCase();
  const options = props.options.filter((option) =>
    `${option.label} ${option.description}`.toLocaleLowerCase().includes(keyword),
  );

  useEffect(() => {
    const dialog = document.getElementById(titleId)?.closest('[role="dialog"]');
    if (!dialog) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [titleId]);

  return (
    <WorkspaceDialog className="home-selection-dialog" labelledBy={titleId} onClose={props.onClose}>
      <header className="workspace-ui-dialog-header">
        <h2 id={titleId}>{props.title}</h2>
        <WorkspaceButton
          variant="ghost"
          size="small"
          onClick={props.onClose}
          aria-label={`关闭${props.title}`}
        >
          关闭
        </WorkspaceButton>
      </header>
      <div className="home-selection-search">
        <input
          type="search"
          className="workspace-ui-control"
          aria-label={props.searchPlaceholder}
          placeholder={props.searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="workspace-ui-dialog-body">
        {options.length ? (
          <div className="home-selection-grid">
            {options.map((option) => (
              <div
                className={`home-selection-card ${option.value === props.value ? 'is-selected' : ''}`}
                key={option.value}
              >
                <button
                  type="button"
                  className="home-selection-option"
                  aria-pressed={option.value === props.value}
                  onClick={() => props.onSelect(option.value)}
                >
                  <span className="home-selection-name">
                    <strong>{option.label}</strong>
                    {option.value === props.value ? (
                      <span className="home-selection-status">已选</span>
                    ) : null}
                  </span>
                  <span className="home-selection-description">{option.description}</span>
                </button>
                {props.onFavoriteChange ? (
                  <button
                    type="button"
                    className="home-selection-favorite"
                    aria-label={`${option.label}设为${props.favoriteLabel}`}
                    aria-pressed={option.value === props.favoriteValue}
                    onClick={() => props.onFavoriteChange?.(option.value)}
                  >
                    {option.value === props.favoriteValue ? '★ 默认' : '☆ 设为默认'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="home-selection-empty">没有找到匹配项，请换个关键词。</p>
        )}
      </div>
    </WorkspaceDialog>
  );
}
