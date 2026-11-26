import { buildMethodSituationDigest } from './systems/situation-digest';
import { renderMarkdownContent } from './markdown-renderer';
export { renderMarkdownContent };

export interface ReportSection {
  id?: string;
  title: string;
  markdown: string;
}

interface ReportSummary {
  title?: string;
  tags?: string[];
  lines?: string[];
}

export function extractReportSections(value: unknown): ReportSection[] | undefined {
  if (!value || typeof value !== 'object' || !('data' in value)) return undefined;
  const data = value.data;
  if (!data || typeof data !== 'object' || !('sections' in data) || !Array.isArray(data.sections)) return undefined;
  const sections = data.sections.filter(
    (item): item is ReportSection =>
      !!item && typeof item === 'object' && typeof item.title === 'string' && typeof item.markdown === 'string',
  );
  return sections.length ? sections : undefined;
}

export function clearReportView(container: HTMLElement) {
  container.hidden = true;
  container.replaceChildren();
}

export function renderReportView(
  container: HTMLElement,
  value: unknown,
  options?: { method?: string; question?: string },
): boolean {
  const sections = extractReportSections(value);
  const summary =
    value && typeof value === 'object' && 'summary' in value && value.summary && typeof value.summary === 'object'
      ? (value.summary as ReportSummary)
      : undefined;
  const rawData =
    value && typeof value === 'object' && 'data' in value ? (value as { data: unknown }).data : value;
  const digestLines = options?.method
    ? buildMethodSituationDigest(options.method, rawData, options.question ?? '')
    : [];
  const hasSummary = Boolean(
    summary &&
      ((typeof summary.title === 'string' && summary.title.length > 0) ||
        (Array.isArray(summary.tags) && summary.tags.some((t) => typeof t === 'string' && t.length > 0)) ||
        (Array.isArray(summary.lines) && summary.lines.some((l) => typeof l === 'string' && l.length > 0))),
  );

  if (!sections && !hasSummary && digestLines.length === 0) {
    clearReportView(container);
    return false;
  }

  container.className = 'report-view';
  container.replaceChildren();

  if (digestLines.length > 0) {
    const digestBox = document.createElement('div');
    digestBox.className = 'report-digest-box';
    const digestTitle = document.createElement('h3');
    digestTitle.className = 'report-digest-title';
    digestTitle.textContent = '局势要点速览';
    digestBox.append(digestTitle);
    const list = document.createElement('ul');
    list.className = 'report-digest-lines';
    for (const line of digestLines) {
      const li = document.createElement('li');
      li.textContent = line;
      list.append(li);
    }
    digestBox.append(list);
    container.append(digestBox);
  }

  if (summary && hasSummary) {
    const header = document.createElement('div');
    header.className = 'report-summary';
    if (typeof summary.title === 'string' && summary.title) {
      const title = document.createElement('h2');
      title.textContent = summary.title;
      header.append(title);
    }
    if (Array.isArray(summary.tags) && summary.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'report-tags';
      for (const tagText of summary.tags) {
        if (typeof tagText !== 'string') continue;
        const tag = document.createElement('span');
        tag.className = 'report-tag';
        tag.textContent = tagText;
        tags.append(tag);
      }
      header.append(tags);
    }
    if (Array.isArray(summary.lines) && summary.lines.length) {
      const list = document.createElement('ul');
      list.className = 'report-summary-lines';
      for (const line of summary.lines) {
        if (typeof line !== 'string') continue;
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
      }
      header.append(list);
    }
    container.append(header);
  }

  if (sections && sections.length > 0) {
    const grid = document.createElement('div');
    grid.className = 'report-sections';
    for (const section of sections) {
      const card = document.createElement('article');
      card.className = 'report-section';
      if (section.id) card.dataset.sectionId = section.id;

      const title = document.createElement('h3');
      title.className = 'report-section-title';
      title.textContent = section.title;

      const body = document.createElement('div');
      body.className = 'report-section-body';
      renderMarkdownContent(body, section.markdown);

      card.append(title, body);
      grid.append(card);
    }
    container.append(grid);
  }

  container.hidden = false;
  return true;
}
