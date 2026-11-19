import * as React from 'react';
import { renderMarkdownContent } from '../../web-report';
import { cn } from '../../lib/utils';

export interface AgentMarkdownProps {
  content: string;
  className?: string;
}

export function AgentMarkdown({ content, className }: AgentMarkdownProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!content) {
      el.replaceChildren();
      return;
    }
    renderMarkdownContent(el, content);
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={cn('ai-analysis-content markdown-body agent-markdown-body', className)}
    />
  );
}
