import React, { useState } from 'react';
import type { MingluTOCItem } from 'mingyu-core/minglu';

interface MingluTOCProps {
  items: MingluTOCItem[];
  activeAnchorId: string;
  onSelectAnchor: (anchorId: string) => void;
}

export const MingluTableOfContents: React.FC<MingluTOCProps> = ({
  items,
  activeAnchorId,
  onSelectAnchor,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <nav className="minglu-toc-nav" aria-label="命录百科目录">
      <div className="minglu-toc-header">
        <h3 className="minglu-toc-title">命录全息目录</h3>
        <span className="minglu-toc-count">{items.length} 章节</span>
      </div>
      <ul className="minglu-toc-list">
        {items.map((item) => {
          const isActive =
            activeAnchorId === item.anchorId ||
            item.subItems?.some((sub) => sub.anchorId === activeAnchorId);
          const isCollapsed = collapsedSections[item.id];

          return (
            <li
              key={item.id}
              className={`minglu-toc-item level-${item.level} ${isActive ? 'is-active' : ''}`}
            >
              <div className="minglu-toc-item-header" onClick={() => onSelectAnchor(item.anchorId)}>
                <span className="minglu-toc-item-text">{item.title}</span>
                {item.badge && <span className="minglu-toc-badge">{item.badge}</span>}
                {item.subItems && item.subItems.length > 0 && (
                  <button
                    type="button"
                    className="minglu-toc-toggle-btn"
                    onClick={(e) => toggleCollapse(item.id, e)}
                    aria-label={isCollapsed ? '展开子条目' : '折叠子条目'}
                  >
                    {isCollapsed ? '+' : '−'}
                  </button>
                )}
              </div>

              {item.subItems && item.subItems.length > 0 && !isCollapsed && (
                <ul className="minglu-toc-sublist">
                  {item.subItems.map((sub) => {
                    const isSubActive = activeAnchorId === sub.anchorId;
                    return (
                      <li
                        key={sub.id}
                        className={`minglu-toc-subitem ${isSubActive ? 'is-active' : ''}`}
                        onClick={() => onSelectAnchor(sub.anchorId)}
                      >
                        <span className="minglu-toc-dot">•</span>
                        <span className="minglu-toc-subitem-text">{sub.title}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
