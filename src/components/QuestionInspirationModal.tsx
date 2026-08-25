export type QuestionInspirationFilter = {
  label: string;
  value: string;
};

export type QuestionInspirationItem = {
  id: string;
  question: string;
  tag?: string;
};

export type QuestionInspirationSection = {
  id: string;
  heading?: string;
  items: QuestionInspirationItem[];
};

type QuestionInspirationModalProps = {
  title?: string;
  filters: QuestionInspirationFilter[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sections: QuestionInspirationSection[];
  emptyText: string;
  onSelect: (question: string) => void;
  onClose: () => void;
  filterVariant?: 'chips' | 'segmented';
  selectedQuestion?: string;
};

export function QuestionInspirationModal(props: QuestionInspirationModalProps) {
  const {
    title = '问题灵感',
    filters,
    activeFilter,
    onFilterChange,
    searchValue,
    onSearchChange,
    searchPlaceholder = '搜索常见问题',
    sections,
    emptyText,
    onSelect,
    onClose,
    filterVariant = 'chips',
    selectedQuestion,
  } = props;

  const hasItems = sections.some((section) => section.items.length > 0);

  return (
    <WorkspaceDialog
      className={`question-inspiration-modal ${
        filterVariant === 'segmented' ? 'is-library-picker' : ''
      }`}
      labelledBy="question-inspiration-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header question-inspiration-modal-head">
        <h2 id="question-inspiration-title">{title}</h2>
        <WorkspaceButton
          variant="ghost"
          size="small"
          onClick={onClose}
          aria-label={`关闭${title}面板`}
        >
          关闭
        </WorkspaceButton>
      </header>

      <div className="workspace-ui-dialog-body">
        <div className="question-inspiration-toolbar">
          <div
            className={`question-inspiration-filters ${
              filterVariant === 'segmented' ? 'is-segmented' : ''
            }`}
            role={filterVariant === 'segmented' ? 'tablist' : undefined}
            aria-label={filterVariant === 'segmented' ? '问题类型' : undefined}
          >
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`question-filter-chip ${activeFilter === filter.value ? 'is-active' : ''}`}
                onClick={() => onFilterChange(filter.value)}
                role={filterVariant === 'segmented' ? 'tab' : undefined}
                aria-selected={
                  filterVariant === 'segmented' ? activeFilter === filter.value : undefined
                }
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="question-inspiration-search">
            <input
              type="text"
              className="workspace-ui-control"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
        </div>

        {hasItems ? (
          <div className="question-inspiration-sections">
            {sections.map((section) =>
              section.items.length > 0 ? (
                <div className="question-inspiration-section" key={section.id}>
                  {section.heading ? (
                    <div className="question-inspiration-section-title">{section.heading}</div>
                  ) : null}
                  <div className="question-inspiration-list">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`question-inspiration-item ${
                          selectedQuestion === item.question ? 'is-selected' : ''
                        }`}
                        onClick={() => onSelect(item.question)}
                      >
                        {item.tag ? (
                          <span className="question-inspiration-tag">{item.tag}</span>
                        ) : null}
                        <span>{item.question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <div className="workspace-ui-empty">{emptyText}</div>
        )}
      </div>
    </WorkspaceDialog>
  );
}
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';
