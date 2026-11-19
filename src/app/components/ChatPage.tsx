import * as React from 'react';
import {
  ArrowLeft,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type { AgentChatSession, AgentToolTrace } from '../../web-agent';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui';
import { cn } from '../../lib/utils';
import { AgentChatPanel } from './AgentChatPanel';

export interface ChatPageProps {
  sessions: readonly AgentChatSession[];
  activeSession: AgentChatSession;
  cases: readonly PersonalCase[];
  isRunning: boolean;
  statusText: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onSendMessage: (text: string) => void;
  onStop: () => void;
  onSelectAttachedCase: (caseId: string | null) => void;
  onOpenConnect: () => void;
  onOpenVisualResult: (trace: AgentToolTrace) => void;
  onBack?: () => void;
}

function formatSessionTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export function ChatPage({
  sessions,
  activeSession,
  cases,
  isRunning,
  statusText,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onSendMessage,
  onStop,
  onSelectAttachedCase,
  onOpenConnect,
  onOpenVisualResult,
  onBack,
}: ChatPageProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileSessionsOpen, setMobileSessionsOpen] = React.useState(false);

  const nonEmptyCount = React.useMemo(
    () => sessions.filter((s) => s.messages.length > 0).length,
    [sessions],
  );

  const renderSessionList = (onPicked?: () => void) => (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
      {sessions.map((item) => {
        const isActive = item.id === activeSession.id;
        return (
          <div
            key={item.id}
            className={cn(
              'group flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 transition-colors',
              isActive
                ? 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border-soft))] bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
                : 'border-transparent bg-transparent text-[var(--text-primary)] hover:border-[var(--border-soft)] hover:bg-[var(--surface-soft)]',
            )}
          >
            <button
              type="button"
              onClick={() => {
                onSelectSession(item.id);
                onPicked?.();
              }}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 border-0 bg-transparent p-0 text-left cursor-pointer"
            >
              <span className="w-full truncate text-[12.5px] font-bold">
                {item.title || '新对话'}
              </span>
              <span className="text-[10.5px] text-[var(--text-muted)]">
                {formatSessionTime(item.updatedAt)}
              </span>
            </button>

            {sessions.length > 1 || item.messages.length > 0 ? (
              <button
                type="button"
                aria-label={`删除对话 ${item.title}`}
                title="删除对话"
                disabled={isRunning && isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(item.id);
                }}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] opacity-60 transition-opacity cursor-pointer hover:bg-[var(--surface-elevated)] hover:text-[var(--danger-text)] hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--topbar-height,60px)-36px)] min-h-[520px] w-full max-w-[var(--ws-canvas,1120px)] flex-col gap-3 max-[979px]:h-[calc(100dvh-146px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-[979px]:min-h-[380px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button variant="secondary" size="xs" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>返回</span>
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="xs"
            className="hidden lg:inline-flex"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            )}
            <span>{sidebarOpen ? '收起列表' : '会话列表'}</span>
          </Button>

          <Button
            variant="secondary"
            size="xs"
            className="lg:hidden"
            onClick={() => setMobileSessionsOpen(true)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>会话 ({nonEmptyCount || sessions.length})</span>
          </Button>

          <Button variant="primary" size="xs" disabled={isRunning} onClick={onNewChat}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>新对话</span>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3.5">
        {sidebarOpen ? (
          <aside
            aria-label="历史对话列表"
            className="hidden w-[240px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] shadow-[0_2px_12px_rgba(32,24,16,0.035)] lg:flex"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-3.5 py-2.5">
              <strong className="text-xs font-extrabold text-[var(--text-strong)]">
                聊天会话
              </strong>
              <Badge variant="outline" className="text-[10.5px]">
                {sessions.length}
              </Badge>
            </div>
            {renderSessionList()}
          </aside>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AgentChatPanel
            variant="full-page"
            session={activeSession}
            cases={cases}
            isRunning={isRunning}
            statusText={statusText}
            onSendMessage={onSendMessage}
            onStop={onStop}
            onNewChat={onNewChat}
            onSelectAttachedCase={onSelectAttachedCase}
            onOpenConnect={onOpenConnect}
            onOpenVisualResult={onOpenVisualResult}
          />
        </div>
      </div>

      <Dialog open={mobileSessionsOpen} onOpenChange={setMobileSessionsOpen}>
        <DialogContent className="max-w-sm" aria-label="聊天会话列表">
          <DialogHeader>
            <DialogTitle>聊天会话</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[55vh] flex-col overflow-hidden">
            {renderSessionList(() => setMobileSessionsOpen(false))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
