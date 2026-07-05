import { useDeferredValue, useMemo, useState } from 'react';
import { commonQuestionInspirations, inspirationCategories } from '../ResultPage.constants';
import type { InspirationCategory } from '../ResultPage.types';

export function useQuestionInspiration() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<InspirationCategory>('全部');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const filteredItems = useMemo(() => {
    const keyword = deferredSearch.trim();

    return commonQuestionInspirations.filter((item) => {
      const matchesCategory = activeCategory === '全部' || item.category === activeCategory;
      const matchesKeyword = keyword ? item.question.includes(keyword) : true;
      return matchesCategory && matchesKeyword;
    });
  }, [activeCategory, deferredSearch]);

  const filteredSections = useMemo(
    () => [
      {
        id: 'common',
        items: filteredItems.map((item) => ({
          id: `${item.category}-${item.question}`,
          question: item.question,
          tag: item.category,
        })),
      },
    ],
    [filteredItems],
  );

  function open() {
    setActiveCategory('全部');
    setSearch('');
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return {
    isOpen,
    activeCategory,
    search,
    deferredSearch,
    filteredItems,
    filteredSections,
    inspirationFilters: inspirationCategories.map((category) => ({
      label: category,
      value: category,
    })),
    open,
    close,
    setActiveCategory,
    setSearch,
  };
}
