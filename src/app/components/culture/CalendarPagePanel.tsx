import * as React from 'react';
import type { Method } from '../../../core';
import { AstroCalendarPanel } from './AstroCalendarPanel';
import { getBeijingNowParts } from './GanzhiCalendarPanel';

export interface CalendarPagePanelProps {
  onChange?: (method: Method, payload: Record<string, unknown>) => void;
  onResult?: (method: Method, payload: Record<string, unknown>, result: unknown) => void;
}

export default function CalendarPagePanel({ onChange, onResult }: CalendarPagePanelProps) {
  const initialDate = React.useMemo(() => getBeijingNowParts().dateStr, []);

  return (
    <div className="workspace-culture-page w-full min-w-0">
      <div className="workspace-focused-page workspace-calendar-page">
        <section className="workspace-ui-form-surface">
          <AstroCalendarPanel initialDate={initialDate} onChange={onChange} onResult={onResult} />
        </section>
      </div>
    </div>
  );
}
