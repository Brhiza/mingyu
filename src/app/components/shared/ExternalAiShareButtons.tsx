import * as React from 'react';
import { Send, Share2 } from 'lucide-react';
import {
  EXTERNAL_AI_JUMP_CHANGED_EVENT,
  getVisibleExternalAiClients,
  launchExternalAiClient,
  loadExternalAiQuickJumpSettings,
  sharePromptViaSystem,
  type ExternalAiClientConfig,
} from '../../../external-ai-share';
import { Button } from '../../../components/ui';

export function ExternalAiShareButtons({
  promptText,
  disabled = false,
  size = 'sm',
}: {
  promptText: string;
  disabled?: boolean;
  size?: 'xs' | 'sm';
}) {
  const [status, setStatus] = React.useState('');
  const [settings, setSettings] = React.useState(() => loadExternalAiQuickJumpSettings());
  const timerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const sync = () => setSettings(loadExternalAiQuickJumpSettings());
    window.addEventListener(EXTERNAL_AI_JUMP_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EXTERNAL_AI_JUMP_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!settings.enabled) return null;

  const visibleClients = getVisibleExternalAiClients(settings);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  if (visibleClients.length === 0 && !canShare) return null;

  const flash = (msg: string) => {
    setStatus(msg);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus(''), 2400);
  };

  const handleClient = async (client: ExternalAiClientConfig) => {
    const { copied, mode } = await launchExternalAiClient(client, promptText);
    if (!copied) {
      flash('复制失败，请手动复制');
      return;
    }
    flash(mode === 'app' ? `已复制并唤起${client.label}` : `已复制并打开${client.label}`);
  };

  const handleShare = async () => {
    const res = await sharePromptViaSystem(promptText);
    if (res === 'copied') flash('已复制提示词');
    else if (res === 'failed') flash('分享失败');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleClients.map((client) => (
        <Button
          key={client.id}
          type="button"
          variant="secondary"
          size={size}
          disabled={disabled || !promptText.trim()}
          onClick={() => void handleClient(client)}
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          <span>{client.label}</span>
        </Button>
      ))}
      {canShare ? (
        <Button
          type="button"
          variant="secondary"
          size={size}
          disabled={disabled || !promptText.trim()}
          onClick={() => void handleShare()}
        >
          <Share2 className="h-3 w-3" aria-hidden="true" />
          <span>分享</span>
        </Button>
      ) : null}
      {status ? <span className="text-[11px] text-[var(--text-muted)]">{status}</span> : null}
    </div>
  );
}
