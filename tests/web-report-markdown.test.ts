import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdownContent } from '../src/web-report';

class MockTextNode {
  textContent: string;
  constructor(text: string) {
    this.textContent = text;
  }
}

class MockElement {
  tagName: string;
  className = '';
  children: Array<MockElement | MockTextNode> = [];
  attributes: Record<string, string> = {};
  href = '';
  target = '';
  rel = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  append(...nodes: Array<MockElement | MockTextNode | string>) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        this.children.push(new MockTextNode(node));
      } else {
        this.children.push(node);
      }
    }
  }

  get lastElementChild(): MockElement | null {
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      if (child instanceof MockElement) return child;
    }
    return null;
  }

  set textContent(value: string) {
    this.children = value ? [new MockTextNode(value)] : [];
  }

  get textContent(): string {
    return this.children.map((c) => c.textContent).join('');
  }
}

function withMockDocument(fn: () => void) {
  const prev = (globalThis as { document?: unknown }).document;
  (globalThis as { document: unknown }).document = {
    createElement: (tag: string) => new MockElement(tag),
    createTextNode: (text: string) => new MockTextNode(text),
  };
  try {
    fn();
  } finally {
    if (prev === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prev;
    }
  }
}

function collectTags(node: MockElement): string[] {
  const tags: string[] = [];
  for (const child of node.children) {
    if (child instanceof MockElement) {
      tags.push(child.tagName, ...collectTags(child));
    }
  }
  return tags;
}

test('renderMarkdownContent 无多余 md 符号：支持紧邻标题、有序/无序嵌套列表、引用、表格、分隔线与行内样式', () => {
  withMockDocument(() => {
    const root = new MockElement('div');
    const sample = [
      '### **一、核心命局总论**',
      '此造日主偏旺，喜**火土**调候，忌*金水*过盛。',
      '1. **事业方向**：宜选文化、设计或互联网。',
      '   - 重点关注今年下半年',
      '   - 注意避免盲目扩张',
      '2. **感情建议**：保持耐心沟通，参考[命理说明](https://example.com/guide)。',
      '---',
      '> 注：以上结论结合大运流年综合推演，详见下表。',
      '| 维度 | 倾向 | 建议 |',
      '| --- | --- | --- |',
      '| 事业 | **稳中求进** | 忌冲动转行 |',
      '```txt',
      '甲木参天',
      '```',
      '补充说明：这是\\*转义星号\\*与`内联代码`和~~旧方案~~。',
    ].join('\n');

    renderMarkdownContent(root as unknown as HTMLElement, sample);

    const renderedText = root.textContent;
    const tags = collectTags(root);

    assert.ok(tags.includes('H3'), '应渲染三级标题');
    assert.ok(tags.includes('OL'), '应渲染有序列表');
    assert.ok(tags.includes('UL'), '应渲染嵌套无序列表');
    assert.ok(tags.includes('HR'), '应渲染分隔线');
    assert.ok(tags.includes('BLOCKQUOTE'), '应渲染引用块');
    assert.ok(tags.includes('TABLE'), '应渲染表格');
    assert.ok(tags.includes('PRE'), '应渲染代码块');
    assert.ok(tags.includes('STRONG'), '应渲染加粗');
    assert.ok(tags.includes('EM'), '应渲染斜体');
    assert.ok(tags.includes('DEL'), '应渲染删除线');
    assert.ok(tags.includes('A'), '应渲染安全链接');

    assert.doesNotMatch(renderedText, /###|\*\*|~~|```|\|\s*---/);
    assert.doesNotMatch(renderedText, /^>\s/m);
    assert.match(renderedText, /一、核心命局总论/);
    assert.match(renderedText, /这是\*转义星号\*/);
  });
});
