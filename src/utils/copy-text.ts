export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error('暂无可复制内容');
  }

  let clipboardError: unknown = null;
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  if (typeof document !== 'undefined' && document.body) {
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    try {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
      if (copied) {
        return;
      }
    } catch (fallbackError) {
      clipboardError = clipboardError ?? fallbackError;
    } finally {
      textarea.remove();
      activeElement?.focus?.({ preventScroll: true });
    }
  }

  throw clipboardError instanceof Error ? clipboardError : new Error('复制失败');
}
