import React from 'react';

interface MingluLinkProps {
  targetAnchorId: string;
  children: React.ReactNode;
  title?: string;
  category?: string;
  className?: string;
  onNavigate?: (anchorId: string) => void;
}

export function scrollToMingluAnchor(anchorId: string): boolean {
  const elem = document.getElementById(anchorId);
  if (!elem) return false;
  const toolbar = elem
    .closest('.minglu-wiki-wrapper')
    ?.querySelector<HTMLElement>('.minglu-wiki-toolbar');
  if (toolbar) {
    let scrollportTop = 0;
    for (let parent = elem.parentElement; parent; parent = parent.parentElement) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        parent.scrollHeight > parent.clientHeight
      ) {
        scrollportTop = parent.getBoundingClientRect().top;
        break;
      }
    }
    elem.style.scrollMarginTop = `${Math.max(0, toolbar.getBoundingClientRect().bottom - scrollportTop) + 16}px`;
  }
  elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
  elem.classList.remove('minglu-anchor-flash');
  void elem.offsetWidth;
  elem.classList.add('minglu-anchor-flash');
  window.history.replaceState(null, '', `#${anchorId}`);
  return true;
}

export const MingluLink: React.FC<MingluLinkProps> = ({
  targetAnchorId,
  children,
  title,
  category,
  className = '',
  onNavigate,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) onNavigate(targetAnchorId);
    else scrollToMingluAnchor(targetAnchorId);
  };

  return (
    <a
      href={`#${targetAnchorId}`}
      onClick={handleClick}
      className={`minglu-wiki-link ${className}`}
      title={title || `跳转至百科条目：${targetAnchorId}`}
      data-category={category}
    >
      <span className="minglu-wiki-link-text">{children}</span>
      <span className="minglu-wiki-link-icon" aria-hidden="true">
        ↗
      </span>
    </a>
  );
};
