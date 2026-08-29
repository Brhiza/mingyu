import React from 'react';

interface MingluLinkProps {
  targetAnchorId: string;
  children: React.ReactNode;
  title?: string;
  category?: string;
  className?: string;
}

export const MingluLink: React.FC<MingluLinkProps> = ({
  targetAnchorId,
  children,
  title,
  category,
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const elem = document.getElementById(targetAnchorId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elem.classList.remove('minglu-anchor-flash');
      void elem.offsetWidth; // trigger reflow
      elem.classList.add('minglu-anchor-flash');
      window.history.replaceState(null, '', `#${targetAnchorId}`);
    }
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
