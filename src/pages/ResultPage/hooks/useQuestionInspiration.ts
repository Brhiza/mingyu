import { useDeferredValue, useMemo, useState } from 'react';
import { commonQuestionInspirations, inspirationCategories } from '../ResultPage.constants';

export type QuestionLibraryMode = 'matter' | 'natal';

export function useQuestionInspiration() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<QuestionLibraryMode>('matter');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const filteredMatterSections = useMemo(() => {
    const keyword = deferredSearch.trim();
    const categories = inspirationCategories.filter((category) => category !== '全部');

    return categories
      .map((category) => ({
        id: `matter-${category}`,
        heading: category,
        items: commonQuestionInspirations
          .filter(
            (item) =>
              item.category === category && (keyword ? item.question.includes(keyword) : true),
          )
          .map((item) => ({
            id: `${item.category}-${item.question}`,
            question: item.question,
          })),
      }))
      .filter((section) => section.items.length > 0);
  }, [deferredSearch]);

  function open(mode: QuestionLibraryMode = 'matter') {
    setActiveMode(mode);
    setSearch('');
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return {
    isOpen,
    activeMode,
    search,
    deferredSearch,
    filteredMatterSections,
    modeFilters: [
      { label: '问事', value: 'matter' },
      { label: '命书', value: 'natal' },
    ],
    open,
    close,
    setActiveMode,
    setSearch,
  };
}
