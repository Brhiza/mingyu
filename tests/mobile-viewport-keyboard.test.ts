import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMobileKeyboardMetrics } from '../src/app/hooks/useMobileViewportKeyboard';

describe('computeMobileKeyboardMetrics', () => {
  it('空闲收起状态不触发键盘抬升，并忽略 <= 40px 浏览器工具栏波动', () => {
    const idle = computeMobileKeyboardMetrics({
      layoutHeight: 844,
      visualHeight: 814,
      visualOffsetTop: 0,
      baselineHeight: 844,
      isInputFocused: false,
    });
    assert.equal(idle.visualBottomY, 814);
    assert.equal(idle.visualBottomInset, 0);
    assert.equal(idle.keyboardOpen, false);
    assert.equal(idle.visibleHeight, 814);
  });

  it('iOS Safari 键盘弹出且无视觉滚动（offsetTop = 0）时计算精确 visualBottomY', () => {
    const ios = computeMobileKeyboardMetrics({
      layoutHeight: 844,
      visualHeight: 508,
      visualOffsetTop: 0,
      baselineHeight: 844,
      isInputFocused: true,
    });
    assert.equal(ios.visualBottomY, 508);
    assert.equal(ios.visualBottomInset, 336);
    assert.equal(ios.keyboardOpen, true);
    assert.equal(ios.visibleHeight, 508);
  });

  it('iOS Safari 键盘弹出且伴随视口向上推滚（offsetTop > 0）时同步计入 offsetTop', () => {
    const iosScrolled = computeMobileKeyboardMetrics({
      layoutHeight: 844,
      visualHeight: 508,
      visualOffsetTop: 64,
      baselineHeight: 844,
      isInputFocused: true,
    });
    assert.equal(iosScrolled.visualBottomY, 572);
    assert.equal(iosScrolled.visualBottomInset, 272);
    assert.equal(iosScrolled.keyboardOpen, true);
    assert.equal(iosScrolled.visibleHeight, 508);
  });

  it('Android interactive-widget=resizes-content 压缩布局高度时 visualBottomY 紧贴可视底沿', () => {
    const android = computeMobileKeyboardMetrics({
      layoutHeight: 500,
      visualHeight: 500,
      visualOffsetTop: 0,
      baselineHeight: 844,
      isInputFocused: true,
    });
    assert.equal(android.visualBottomY, 500);
    assert.equal(android.visualBottomInset, 0);
    assert.equal(android.keyboardOpen, true);
    assert.equal(android.visibleHeight, 500);
  });
});
