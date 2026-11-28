export interface SelectOptionItem {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface DropdownPositionResult {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
}

export function computeDropdownPosition(
  triggerRect: { top: number; bottom: number; left: number; width: number },
  viewport: { width: number; height: number },
  estimatedHeight = 260,
): DropdownPositionResult {
  const margin = 8;
  const gap = 6;
  const spaceBelow = Math.max(0, viewport.height - triggerRect.bottom - margin - gap);
  const spaceAbove = Math.max(0, triggerRect.top - margin - gap);

  const flipToTop = spaceBelow < Math.min(estimatedHeight, 180) && spaceAbove > spaceBelow;
  const placement: 'bottom' | 'top' = flipToTop ? 'top' : 'bottom';
  const availableVertical = placement === 'top' ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, Math.min(320, Math.floor(availableVertical)));

  const maxWidth = Math.max(120, viewport.width - margin * 2);
  const minWidth = Math.min(Math.max(120, Math.round(triggerRect.width)), maxWidth);

  const maxLeft = Math.max(margin, viewport.width - margin - minWidth);
  const left = Math.round(Math.min(Math.max(margin, triggerRect.left), maxLeft));

  if (placement === 'top') {
    return {
      bottom: Math.round(viewport.height - triggerRect.top + gap),
      left,
      minWidth,
      maxWidth,
      maxHeight,
      placement,
    };
  }

  return {
    top: Math.round(triggerRect.bottom + gap),
    left,
    minWidth,
    maxWidth,
    maxHeight,
    placement,
  };
}
