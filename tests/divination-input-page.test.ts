import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const inputPageSource = readFileSync(new URL('../src/pages/InputPage.tsx', import.meta.url), 'utf8');
const divinationPanelSource = readFileSync(new URL('../src/components/DivinationPanel.tsx', import.meta.url), 'utf8');
const divinationConfigSource = readFileSync(new URL('../src/lib/divination/config.ts', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('输入页顶部切换新增占卜入口，并按需懒加载占卜面板', () => {
  assert.match(inputPageSource, /label: '占卜', value: 'divination' as const/);
  assert.match(inputPageSource, /const LazyDivinationPanel = lazy\(async \(\) =>/);
  assert.match(inputPageSource, /<LazyDivinationPanel \/>/);
});

test('输入页顶部切换会把当前模式写回地址栏，刷新后仍保留在当前页签', () => {
  assert.match(inputPageSource, /const \[searchParams, setSearchParams\] = useSearchParams\(\);/);
  assert.match(inputPageSource, /function updateEntryMode\(value: InputEntryMode\)/);
  assert.match(inputPageSource, /nextSearchParams\.set\('mode', value\);/);
  assert.match(inputPageSource, /setSearchParams\(nextSearchParams, \{ replace: true \}\);/);
  assert.match(inputPageSource, /onChange=\{updateEntryMode\}/);
});

test('输入页切换到占卜时使用固定舞台和骨架回退，减少高度宽度抖动', () => {
  assert.match(inputPageSource, /const divinationPanelFallback = \(/);
  assert.match(inputPageSource, /className="divination-panel-shell input-mode-loading"/);
  assert.match(inputPageSource, /<Suspense fallback=\{divinationPanelFallback\}>/);
  assert.doesNotMatch(inputPageSource, /<Suspense fallback=\{null\}>/);
  assert.match(stylesSource, /\.analysis-view \{[\s\S]*min-height: 560px;/);
  assert.match(
    stylesSource,
    /\.analysis-view > \* \{[\s\S]*width: 100%;[\s\S]*max-width: 100%;[\s\S]*min-width: 0;/,
  );
  assert.match(
    stylesSource,
    /@media \(max-width: 900px\) \{[\s\S]*\.analysis-view \{[\s\S]*min-height: max\(520px, calc\(100dvh - 150px\)\);/,
  );
});

test('占卜面板复用复制与移动端分享能力', () => {
  assert.match(divinationPanelSource, /shouldShowPromptShareButton/);
  assert.match(divinationPanelSource, /await navigator\.clipboard\.writeText\(session\.prompt\);/);
  assert.match(divinationPanelSource, /const ok = await shareText\(session\.prompt\);/);
});

test('占卜页提示词操作按钮在电脑端保持单行，避免复制按钮文字换行', () => {
  assert.match(divinationPanelSource, /className="panel-head divination-prompt-head"/);
  assert.match(divinationPanelSource, /className="action-row compact-actions divination-prompt-actions"/);
  assert.match(divinationPanelSource, /<div className="prompt-send-tip">\s*点击复制后，发送到你常用的在线 AI 软件继续提问。\s*<\/div>/);
  assert.match(stylesSource, /\.divination-prompt-actions \.copy-button \{[\s\S]*white-space: nowrap;/);
});

test('占卜面板会自动写入历史，并提供历史记录入口', () => {
  assert.match(divinationPanelSource, /addDivinationHistory/);
  assert.match(divinationPanelSource, /const savedRecord = addDivinationHistory\(draft, nextSession\);/);
  assert.match(divinationPanelSource, /nextSearchParams\.set\('record', savedRecord\.id\);/);
  assert.match(divinationPanelSource, /navigate\('\/records\?tab=divination'\)/);
});

test('占卜面板可根据地址栏里的记录 id 恢复历史结果', () => {
  assert.match(divinationPanelSource, /const recordId = searchParams\.get\('record'\);/);
  assert.match(divinationPanelSource, /const record = getDivinationHistoryById\(recordId\);/);
  assert.match(divinationPanelSource, /setDraft\(record\.draft\);/);
  assert.match(divinationPanelSource, /setSession\(record\.session\);/);
});

test('排盘与占卜输入页底部操作区统一为左历史右开始', () => {
  assert.match(
    inputPageSource,
    /<button[\s\S]*className="secondary-page-button"[\s\S]*>\s*历史记录\s*<\/button>[\s\S]*<button[\s\S]*className="primary-button start-submit-button"[\s\S]*>\s*开始排盘\s*<\/button>/,
  );
  assert.match(
    divinationPanelSource,
    /<button[\s\S]*className="secondary-page-button"[\s\S]*>\s*历史记录\s*<\/button>[\s\S]*<button[\s\S]*className="primary-button start-submit-button"[\s\S]*>\s*开始占卜\s*<\/button>/,
  );
});

test('占卜页把底部操作区放在卡片外，和排盘页结构一致', () => {
  assert.match(
    divinationPanelSource,
    /<\/section>\s*\{error \? <div className="form-error-text global-form-error">\{error\}<\/div> : null\}\s*<div[\s\S]*className="form-actions page-submit-actions"/,
  );
});

test('占卜页改为单个问题灵感按钮，不再直接渲染三条快捷问题', () => {
  assert.match(divinationPanelSource, />\s*问题灵感\s*</);
  assert.match(divinationPanelSource, /openQuestionInspirationModal/);
  assert.doesNotMatch(divinationPanelSource, /DIVINATION_EXAMPLES/);
  assert.doesNotMatch(divinationPanelSource, /currentExamples/);
});

test('移动端把问题灵感按钮放进起卦方式同一行，并隐藏桌面端的独立入口', () => {
  assert.match(divinationPanelSource, /className="quick-chip divination-mobile-inspiration-btn"/);
  assert.match(
    divinationPanelSource,
    /className="divination-mobile-method-picker"[\s\S]*draft\.method === 'meihua'[\s\S]*className="divination-mobile-secondary-picker"[\s\S]*draft\.method === 'tarot'[\s\S]*className="divination-mobile-secondary-picker"[\s\S]*draft\.method === 'liuren'[\s\S]*className="divination-mobile-secondary-picker"[\s\S]*className="quick-chip divination-mobile-inspiration-btn"/,
  );
  assert.match(stylesSource, /\.divination-mobile-inspiration-btn \{[\s\S]*display: none;/);
  assert.match(
    stylesSource,
    /\.divination-mobile-control-row \{[\s\S]*display: flex;[\s\S]*flex-wrap: wrap;[\s\S]*width: 100%;/,
  );
  assert.match(
    stylesSource,
    /\.divination-mobile-inspiration-btn \{[\s\S]*width: auto;[\s\S]*min-width: max-content;[\s\S]*margin-left: auto;/,
  );
  assert.match(
    stylesSource,
    /\.divination-desktop-question-footer \{[\s\S]*display: none;/,
  );
});

test('电脑端把问题灵感放到输入框下方右侧，并和额外参数共用一行，塔罗不显示出生年份', () => {
  assert.match(
    divinationPanelSource,
    /className="divination-question-field"[\s\S]*id="divination-question-input"[\s\S]*className="divination-desktop-question-footer"[\s\S]*className="divination-desktop-question-controls"[\s\S]*id="meihua-method-select"[\s\S]*id="liuren-template-select"[\s\S]*id="tarot-spread-select"[\s\S]*className="quick-chip divination-desktop-inspiration-btn"/,
  );
  assert.match(
    divinationPanelSource,
    /className=\{`form-row-flex divination-meta-row \$\{draft\.method === 'tarot' \? 'is-single' : ''\}`\}[\s\S]*divination-gender-select[\s\S]*draft\.method !== 'tarot' \?/,
  );
  assert.match(
    stylesSource,
    /\.divination-desktop-question-footer \{[\s\S]*display: flex;[\s\S]*justify-content: space-between;/,
  );
  assert.match(
    stylesSource,
    /\.divination-desktop-inspiration-btn \{[\s\S]*width: auto;[\s\S]*min-width: 112px;[\s\S]*min-height: 46px;/,
  );
});

test('占卜页复用通用问题灵感模态窗，并接入 sydf 迁移过来的灵感数据', () => {
  assert.match(divinationPanelSource, /QuestionInspirationModal/);
  assert.match(divinationPanelSource, /DIVINATION_INSPIRATION_CONTENT/);
  assert.match(divinationPanelSource, /DIVINATION_INSPIRATION_TABS/);
  assert.match(divinationPanelSource, /TAROT_SPREAD_INSPIRATION_QUESTIONS/);
  assert.match(divinationPanelSource, /questionInputRef/);
});

test('随机占卜结果会明确显示本次随机到的卦种', () => {
  assert.match(divinationPanelSource, /session\.requestedMethod === 'random'/);
  assert.match(divinationPanelSource, /本次随机到：\{methodLabelMap\[session\.method\]\}/);
});

test('占卜面板不再提供解读风格和输出长度选项', () => {
  assert.doesNotMatch(divinationPanelSource, /divination-style-select/);
  assert.doesNotMatch(divinationPanelSource, /divination-length-select/);
  assert.doesNotMatch(divinationPanelSource, /解读风格/);
  assert.doesNotMatch(divinationPanelSource, /输出长度/);
});

test('随机占卜入口放在第一个', () => {
  assert.match(
    divinationConfigSource,
    /DIVINATION_METHOD_OPTIONS[\s\S]*value: 'random'[\s\S]*label: '随机'[\s\S]*value: 'liuyao'/,
  );
});

test('占卜面板提供移动端下拉入口，并与当前卦种共用同一个状态源', () => {
  assert.match(divinationPanelSource, /divination-mobile-method-select/);
  assert.match(divinationPanelSource, /value=\{draft\.method\}/);
  assert.match(divinationPanelSource, /updateDraft\('method', event\.target\.value as DivinationDraft\['method'\]\)/);
});

test('占卜面板默认卦种仍为随机，桌面端按钮组继续展示六个选项', () => {
  assert.match(divinationPanelSource, /const defaultDraft: DivinationDraft = \{[\s\S]*method: 'random'/);
  assert.match(divinationPanelSource, /className="divination-method-grid"/);
  assert.match(divinationConfigSource, /value: 'liuren'[\s\S]*label: '大六壬'/);
  assert.match(stylesSource, /\.divination-method-grid \{[\s\S]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(stylesSource, /\.input-mode-loading-methods \{[\s\S]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(inputPageSource, /Array\.from\(\{ length: 7 \}, \(_, index\) =>/);
});
