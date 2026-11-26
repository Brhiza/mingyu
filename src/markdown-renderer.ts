function isSafeHref(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed);
}

function appendInlineMarkdown(target: HTMLElement, line: string) {
  const tokenPattern =
    /\\([\\`*_{}[\]()#+\-.!~|>])|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\n]+\))|(\*\*\*[^\n]+?\*\*\*|___[^\n]+?___)|(\*\*[^\n]+?\*\*|__[^\n]+?__)|(~~[^\n]+?~~)|(\*(?!\s)[^*\n]+?(?<!\s)\*)|((?:^|[\s(（【「『])_(?!\s)[^_\n]+?(?<!\s)_(?=$|[\s.,;:!?，。；：！？)）】」』]))/g;

  let lastIndex = 0;
  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    let token = match[0];
    let matchStart = index;

    // Preserve any leading boundary character captured for _italic_
    if (match[8]) {
      const underscoreOffset = token.indexOf('_');
      if (underscoreOffset > 0) {
        if (index + underscoreOffset > lastIndex) {
          target.append(document.createTextNode(line.slice(lastIndex, index + underscoreOffset)));
        }
        matchStart = index + underscoreOffset;
        token = token.slice(underscoreOffset);
        lastIndex = matchStart;
      }
    }

    if (matchStart > lastIndex) {
      target.append(document.createTextNode(line.slice(lastIndex, matchStart)));
    }

    if (match[1]) {
      target.append(document.createTextNode(match[1]));
    } else if (match[2]) {
      const code = document.createElement('code');
      code.textContent = token.slice(1, -1);
      target.append(code);
    } else if (match[3]) {
      const sep = token.indexOf('](');
      const label = token.slice(1, sep);
      const href = token.slice(sep + 2, -1);
      if (isSafeHref(href)) {
        const a = document.createElement('a');
        a.href = href.trim();
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        appendInlineMarkdown(a, label);
        target.append(a);
      } else {
        appendInlineMarkdown(target, label);
      }
    } else if (match[4]) {
      const strong = document.createElement('strong');
      const em = document.createElement('em');
      appendInlineMarkdown(em, token.slice(3, -3));
      strong.append(em);
      target.append(strong);
    } else if (match[5]) {
      const strong = document.createElement('strong');
      appendInlineMarkdown(strong, token.slice(2, -2));
      target.append(strong);
    } else if (match[6]) {
      const del = document.createElement('del');
      appendInlineMarkdown(del, token.slice(2, -2));
      target.append(del);
    } else if (match[7] || match[8]) {
      const em = document.createElement('em');
      appendInlineMarkdown(em, token.slice(1, -1));
      target.append(em);
    }

    lastIndex = matchStart + token.length;
  }

  if (lastIndex < line.length) {
    target.append(document.createTextNode(line.slice(lastIndex)));
  }
}

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const HEADING_RE = /^\s*(#{1,6})(?:\s+|(?=\S)(?!\d+\b))(.+?)\s*#*\s*$/;
const HR_RE = /^\s*(?:[-*_]\s*){3,}$/;
const BLOCKQUOTE_RE = /^\s*>\s?(.*)$/;
const UNORDERED_LIST_RE = /^(\s*)[-*+•]\s+(.*)$/;
const ORDERED_LIST_RE = /^(\s*)\d+[.)]\s+(.*)$/;

function splitTableCells(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(row: string): boolean {
  if (!row.includes('|') && !row.includes('-')) return false;
  const cells = splitTableCells(row);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function isBlockStarter(line: string, nextLine: string | undefined): boolean {
  if (!line.trim()) return true;
  if (FENCE_RE.test(line)) return true;
  if (HEADING_RE.test(line)) return true;
  if (HR_RE.test(line)) return true;
  if (BLOCKQUOTE_RE.test(line)) return true;
  if (UNORDERED_LIST_RE.test(line) || ORDERED_LIST_RE.test(line)) return true;
  if (/^【[^】]+】$/.test(line.trim())) return true;
  if (line.includes('|') && nextLine !== undefined && isTableSeparator(nextLine)) return true;
  return false;
}

interface ParsedListItem {
  indent: number;
  ordered: boolean;
  text: string;
}

function buildListNode(items: ParsedListItem[], startIdx: number, baseIndent: number, ordered: boolean): [HTMLElement, number] {
  const listEl = document.createElement(ordered ? 'ol' : 'ul');
  let i = startIdx;
  while (i < items.length) {
    const item = items[i];
    if (item.indent < baseIndent) break;
    if (item.indent > baseIndent) {
      const lastLi = listEl.lastElementChild as HTMLElement | null;
      const [nested, nextIdx] = buildListNode(items, i, item.indent, item.ordered);
      if (lastLi) {
        lastLi.append(nested);
      } else {
        listEl.append(nested);
      }
      i = nextIdx;
      continue;
    }
    if (item.ordered !== ordered) break;
    const li = document.createElement('li');
    const itemLines = item.text.split('\n');
    itemLines.forEach((part, idx) => {
      if (idx > 0) li.append(document.createElement('br'));
      appendInlineMarkdown(li, part);
    });
    listEl.append(li);
    i++;
  }
  return [listEl, i];
}

export function renderMarkdownContent(container: HTMLElement, markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced code block
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceLen = fenceMatch[2].length;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length) {
        const closeMatch = lines[i].match(FENCE_RE);
        if (closeMatch && closeMatch[2][0] === fenceChar && closeMatch[2].length >= fenceLen && !closeMatch[3].trim()) {
          i++;
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.append(code);
      container.append(pre);
      continue;
    }

    // 2. Horizontal rule
    if (HR_RE.test(trimmed)) {
      container.append(document.createElement('hr'));
      i++;
      continue;
    }

    // 3. Heading
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4);
      const heading = document.createElement(`h${level}`);
      appendInlineMarkdown(heading, headingMatch[2]);
      container.append(heading);
      i++;
      continue;
    }

    // 4. 【...】 subheading
    if (/^【[^】]+】$/.test(trimmed)) {
      const sub = document.createElement('p');
      sub.className = 'report-subheading';
      appendInlineMarkdown(sub, trimmed);
      container.append(sub);
      i++;
      continue;
    }

    // 5. Blockquote
    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const qm = lines[i].match(BLOCKQUOTE_RE);
        if (!qm) break;
        quoteLines.push(qm[1]);
        i++;
      }
      const blockquote = document.createElement('blockquote');
      renderMarkdownContent(blockquote, quoteLines.join('\n'));
      container.append(blockquote);
      continue;
    }

    // 6. Table
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableCells(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !isBlockStarter(lines[i], lines[i + 1])) {
        bodyRows.push(splitTableCells(lines[i]));
        i++;
      }
      const wrap = document.createElement('div');
      wrap.className = 'markdown-table-wrap';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headTr = document.createElement('tr');
      for (const h of headers) {
        const th = document.createElement('th');
        appendInlineMarkdown(th, h);
        headTr.append(th);
      }
      thead.append(headTr);
      table.append(thead);

      if (bodyRows.length > 0) {
        const tbody = document.createElement('tbody');
        for (const cells of bodyRows) {
          const tr = document.createElement('tr');
          for (let c = 0; c < headers.length; c++) {
            const td = document.createElement('td');
            appendInlineMarkdown(td, cells[c] ?? '');
            tr.append(td);
          }
          tbody.append(tr);
        }
        table.append(tbody);
      }
      wrap.append(table);
      container.append(wrap);
      continue;
    }

    // 7. Unordered / Ordered list (supports nested indents and single-blank-line gaps between same-type items)
    const ulFirst = line.match(UNORDERED_LIST_RE);
    const olFirst = line.match(ORDERED_LIST_RE);
    if (ulFirst || olFirst) {
      const items: ParsedListItem[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const ul = cur.match(UNORDERED_LIST_RE);
        const ol = cur.match(ORDERED_LIST_RE);
        if (ul) {
          items.push({ indent: ul[1].replace(/\t/g, '  ').length, ordered: false, text: ul[2] });
          i++;
          continue;
        }
        if (ol) {
          items.push({ indent: ol[1].replace(/\t/g, '  ').length, ordered: true, text: ol[2] });
          i++;
          continue;
        }
        // Continuation line inside list item (non-empty, not a new block starter)
        if (cur.trim() && items.length > 0 && !isBlockStarter(cur, lines[i + 1])) {
          items[items.length - 1].text += `\n${cur.trim()}`;
          i++;
          continue;
        }
        break;
      }
      let idx = 0;
      while (idx < items.length) {
        const [listEl, nextIdx] = buildListNode(items, idx, items[idx].indent, items[idx].ordered);
        container.append(listEl);
        idx = nextIdx;
      }
      continue;
    }

    // 8. Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStarter(lines[i], lines[i + 1])) {
      paraLines.push(lines[i].trimEnd());
      i++;
    }
    if (paraLines.length > 0) {
      const paragraph = document.createElement('p');
      paraLines.forEach((pLine, idx) => {
        if (idx > 0) paragraph.append(document.createElement('br'));
        appendInlineMarkdown(paragraph, pLine);
      });
      container.append(paragraph);
    }
  }
}

