import { marked, Renderer } from 'marked';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripUnsafeUrlCharacters(value: string) {
  let normalized = '';
  for (const char of value.trim()) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127 || /\s/.test(char)) continue;
    normalized += char;
  }
  return normalized;
}

function isSafeMarkdownUrl(value: string) {
  const normalized = stripUnsafeUrlCharacters(value);
  if (!normalized) return true;
  if (/^(?:https?:|mailto:|tel:|#|\/(?!\/)|\.{0,2}\/)/i.test(normalized)) return true;
  return !/^[a-z][a-z0-9+.-]*:/i.test(normalized);
}

const renderer = new Renderer();
const renderLink = renderer.link.bind(renderer);
const renderImage = renderer.image.bind(renderer);

renderer.html = ({ text }) => escapeHtml(text);
renderer.link = (token) =>
  isSafeMarkdownUrl(token.href) ? renderLink(token) : escapeHtml(token.text);
renderer.image = (token) =>
  isSafeMarkdownUrl(token.href) ? renderImage(token) : escapeHtml(token.text);

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

export { marked };
