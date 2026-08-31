// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionController } from '../../../src/interaction/InteractionController.js';
import { calculateSectorLayout } from '../../../src/geometry/calculateSector.js';

const TAU = Math.PI * 2;

function makeGeometry({ n = 4, gap = 8, selectable = null, submenu = null } = {}) {
  const { sectors } = calculateSectorLayout({
    itemCount: n,
    arcStart: 0,
    arcLength: TAU,
    outerRadius: 100,
    innerRadius: 30,
    meanRadius: 65,
    ringWidth: 70,
    gap,
    direction: 'clockwise'
  });
  return {
    outerRadius: 100,
    innerRadius: 30,
    closeDistance: 40,
    arcStart: 0,
    arcLength: TAU,
    direction: 'clockwise',
    sectors,
    selectable: selectable ?? Array.from({ length: n }, () => true),
    submenu: submenu ?? Array.from({ length: n }, () => false)
  };
}

const CENTER = { centerX: 200, centerY: 200 };

function pointAt(angle, dist = 65) {
  return { clientX: CENTER.centerX + dist * Math.cos(angle), clientY: CENTER.centerY + dist * Math.sin(angle) };
}

function fire(window, type, init = {}) {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe('InteractionController — hover (pointermove)', () => {
  let onHover, onClose, onSelect, controller;

  beforeEach(() => {
    onHover = vi.fn();
    onClose = vi.fn();
    onSelect = vi.fn();
    controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover,
      onClose,
      onSelect
    });
    controller.attach();
  });

  it('reports hover over a selectable sector', () => {
    fire(window, 'pointermove', pointAt(0.3));
    expect(onHover).toHaveBeenCalledWith(0);
  });

  it('clears selection when moving into the center', () => {
    fire(window, 'pointermove', pointAt(0.3));
    fire(window, 'pointermove', pointAt(0, 10));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('clears selection when moving into a gap', () => {
    const geometry = makeGeometry();
    fire(window, 'pointermove', pointAt(0.3));
    const gapMid = (geometry.sectors[0].end + geometry.sectors[1].start) / 2;
    fire(window, 'pointermove', pointAt(gapMid));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('clears selection when moving over a none sector', () => {
    controller.detach();
    const geometry = makeGeometry({ selectable: [true, false, true, true] });
    const localController = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry,
      ...CENTER,
      onHover,
      onClose,
      onSelect
    });
    localController.attach();
    fire(window, 'pointermove', pointAt(0.3));
    const angle = (geometry.sectors[1].start + geometry.sectors[1].end) / 2;
    fire(window, 'pointermove', pointAt(angle));
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it('moves to another sector switching the hover', () => {
    fire(window, 'pointermove', pointAt(0.3));
    fire(window, 'pointermove', pointAt(0.3 + Math.PI / 2));
    expect(onHover).toHaveBeenLastCalledWith(1);
  });

  it('does not re-report the same hover', () => {
    fire(window, 'pointermove', pointAt(0.3));
    fire(window, 'pointermove', pointAt(0.4));
    expect(onHover).toHaveBeenCalledTimes(1);
  });

  it('closes immediately when leaving outerRadius + closeDistance', () => {
    fire(window, 'pointermove', pointAt(0.3));
    fire(window, 'pointermove', pointAt(0.3, 200));
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears selection in the grace zone outside the outer radius without closing', () => {
    fire(window, 'pointermove', pointAt(0.3));
    // grace-зона: outerRadius(100) < dist <= outerRadius + closeDistance(140)
    fire(window, 'pointermove', pointAt(0.3, 120));
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('InteractionController — pointerup (click mode)', () => {
  let controller, onClose, onSelect;

  function make(mode = 'click', button = 'left') {
    if (controller) controller.detach();
    onClose = vi.fn();
    onSelect = vi.fn();
    controller = new InteractionController({
      interactionMode: mode,
      button,
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect
    });
    controller.attach();
  }

  it('selects the item under the pointer with the configured button (click mode)', () => {
    make();
    const p = pointAt(0.3);
    fire(window, 'pointerup', p);
    expect(onSelect).toHaveBeenCalledWith(0, { x: p.clientX, y: p.clientY });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('passes the pointer coordinates at pointerup to onSelect', () => {
    make();
    const p = pointAt(0.3);
    fire(window, 'pointerup', p);
    expect(onSelect).toHaveBeenCalledWith(0, { x: p.clientX, y: p.clientY });
  });

  it('does NOT select with a non-configured button (click mode)', () => {
    make('click', 'left');
    fire(window, 'pointerup', { ...pointAt(0.3), button: 2 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selects only with the configured button (click mode)', () => {
    make('click', 'right');
    const p = pointAt(0.3);
    fire(window, 'pointerup', { ...p, button: 2 });
    expect(onSelect).toHaveBeenCalledWith(0, { x: p.clientX, y: p.clientY });
  });

  it('does NOT close on pointerup in the center (click mode)', () => {
    make();
    fire(window, 'pointerup', pointAt(0, 10));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does NOT close on pointerup in a gap (click mode)', () => {
    make();
    const geometry = makeGeometry();
    const gapMid = (geometry.sectors[0].end + geometry.sectors[1].start) / 2;
    fire(window, 'pointerup', pointAt(gapMid));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT close on pointerup over a none sector (click mode)', () => {
    controller.detach();
    const geometry = makeGeometry({ selectable: [false, true, true, true] });
    const localOnClose = vi.fn();
    const localController = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry,
      ...CENTER,
      onHover: vi.fn(),
      onClose: localOnClose,
      onSelect: vi.fn()
    });
    localController.attach();
    const angle = (geometry.sectors[0].start + geometry.sectors[0].end) / 2;
    fire(window, 'pointerup', pointAt(angle));
    expect(localOnClose).not.toHaveBeenCalled();
  });

  it('does NOT close on pointerup outside the menu (click mode)', () => {
    make();
    fire(window, 'pointerup', pointAt(0.3, 300));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on pointerup in the grace zone outside the outer radius (click mode)', async () => {
    vi.useFakeTimers();
    try {
      make();
      await vi.advanceTimersByTimeAsync(400);
      // grace-зона: 100 < dist <= 140 — клик вне пункта, должен закрыть меню
      fire(window, 'pointerup', pointAt(0.3, 120));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes on pointerup in the center after the open grace (click mode)', async () => {
    vi.useFakeTimers();
    try {
      make();
      await vi.advanceTimersByTimeAsync(400);
      fire(window, 'pointerup', pointAt(0, 10));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes on pointerup in a gap after the open grace (click mode)', async () => {
    vi.useFakeTimers();
    try {
      make();
      await vi.advanceTimersByTimeAsync(400);
      const geometry = makeGeometry();
      const gapMid = (geometry.sectors[0].end + geometry.sectors[1].start) / 2;
      fire(window, 'pointerup', pointAt(gapMid));
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes on pointerup over a none sector after the open grace (click mode)', async () => {
    vi.useFakeTimers();
    try {
      controller.detach();
      const geometry = makeGeometry({ selectable: [false, true, true, true] });
      const localOnClose = vi.fn();
      const localController = new InteractionController({
        interactionMode: 'click',
        button: 'left',
        geometry,
        ...CENTER,
        onHover: vi.fn(),
        onClose: localOnClose,
        onSelect: vi.fn()
      });
      localController.attach();
      await vi.advanceTimersByTimeAsync(400);
      const angle = (geometry.sectors[0].start + geometry.sectors[0].end) / 2;
      fire(window, 'pointerup', pointAt(angle));
      expect(localOnClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('InteractionController — pointerup (hold mode)', () => {
  let controller, onClose, onSelect;

  function make(button = 'left') {
    if (controller) controller.detach();
    onClose = vi.fn();
    onSelect = vi.fn();
    controller = new InteractionController({
      interactionMode: 'hold',
      button,
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect
    });
    controller.attach();
  }

  it('ignores pointerup with a different button', () => {
    make('left');
    fire(window, 'pointerup', { ...pointAt(0.3), button: 2 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selects on pointerup with the configured button over a sector', () => {
    make('right');
    const p = pointAt(0.3);
    fire(window, 'pointerup', { ...p, button: 2 });
    expect(onSelect).toHaveBeenCalledWith(0, { x: p.clientX, y: p.clientY });
  });

  it('closes on pointerup with the configured button in the center/gap', () => {
    make('left');
    fire(window, 'pointerup', pointAt(0, 10));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on pointerup in the grace zone outside the outer radius (hold mode)', () => {
    make('left');
    fire(window, 'pointerup', pointAt(0.3, 120));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('InteractionController — cancellation and context menu', () => {
  it('pointercancel closes the menu', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointercancel');
    expect(onClose).toHaveBeenCalledTimes(1);
    controller.detach();
  });

  it('suppresses the browser context menu while open', () => {
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose: vi.fn(),
      onSelect: vi.fn()
    });
    controller.attach();
    const event = fire(window, 'contextmenu', { button: 0 });
    expect(event.defaultPrevented).toBe(true);
    expect(event.cancelable).toBe(true);
    controller.detach();
  });

  it('does not suppress the context menu for a button the menu does not track', () => {
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose: vi.fn(),
      onSelect: vi.fn()
    });
    controller.attach();
    const event = fire(window, 'contextmenu', { button: 2 });
    expect(event.defaultPrevented).toBe(false);
    controller.detach();
  });

  it('suppresses the context menu when the event button matches the tracked button', () => {
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'right',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose: vi.fn(),
      onSelect: vi.fn()
    });
    controller.attach();
    const event = fire(window, 'contextmenu', { button: 2 });
    expect(event.defaultPrevented).toBe(true);
    controller.detach();
  });
});

describe('InteractionController — attach/detach', () => {
  it('detach removes all listeners', () => {
    const onHover = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover,
      onClose: vi.fn(),
      onSelect: vi.fn()
    });
    controller.attach();
    controller.detach();
    fire(window, 'pointermove', pointAt(0.3));
    fire(window, 'pointerup', pointAt(0.3));
    fire(window, 'pointercancel');
    expect(onHover).not.toHaveBeenCalled();
  });

  it('attaching twice does not duplicate handlers', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect
    });
    controller.attach();
    controller.attach();
    fire(window, 'pointerup', pointAt(0.3));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('InteractionController — held-button tracking', () => {
  it('hold mode stays open while the tracked button is held', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'hold',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointermove', { ...pointAt(0.3), buttons: 1 });
    expect(onClose).not.toHaveBeenCalled();
    controller.detach();
  });

  it('hold mode closes when the tracked button is not held on move', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'hold',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointermove', { ...pointAt(0.3), buttons: 0 });
    expect(onClose).toHaveBeenCalledTimes(1);
    controller.detach();
  });

  it('hold mode closes when a different button is held (mismatched submenu)', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'hold',
      button: 'right',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointermove', { ...pointAt(0.3), buttons: 1 }); // зажата левая
    expect(onClose).toHaveBeenCalledTimes(1);
    controller.detach();
  });

  it('click mode stays open when the tracked button is not held', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 'left',
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointermove', { ...pointAt(0.3), buttons: 0 });
    expect(onClose).not.toHaveBeenCalled();
    controller.detach();
  });
});

describe('InteractionController — submenu open', () => {
  let controller, onClose, onSelect, onSubmenuOpen;

  function make({ mode = 'hold', button = 'left', submenuDelay = 400, geometry = null } = {}) {
    if (controller) controller.detach();
    onClose = vi.fn();
    onSelect = vi.fn();
    onSubmenuOpen = vi.fn();
    controller = new InteractionController({
      interactionMode: mode,
      button,
      geometry: geometry ?? makeGeometry({ submenu: [true, false, true, false] }),
      ...CENTER,
      submenuDelay,
      onHover: vi.fn(),
      onClose,
      onSelect,
      onSubmenuOpen
    });
    controller.attach();
  }

  function move(angle, dist = 65, buttons = 1) {
    return fire(window, 'pointermove', { ...pointAt(angle, dist), buttons });
  }

  it('opens the submenu after the delay while hovering a submenu item in hold mode', async () => {
    vi.useFakeTimers();
    try {
      make();
      move(0.3); // item 0 — submenu, кнопка зажата
      expect(onSubmenuOpen).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(399);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      const p = pointAt(0.3);
      expect(onSubmenuOpen).toHaveBeenCalledTimes(1);
      expect(onSubmenuOpen).toHaveBeenCalledWith(0, { x: p.clientX, y: p.clientY });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not arm the timer over a non-submenu item', async () => {
    vi.useFakeTimers();
    try {
      make();
      move(0.3 + Math.PI / 2); // item 1 — не submenu
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the submenu in click mode only while the button is held', async () => {
    vi.useFakeTimers();
    try {
      make({ mode: 'click' });
      move(0.3, 65, 0); // кнопка не зажата
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
      move(0.3, 65, 1); // кнопка зажата
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).toHaveBeenCalledTimes(1);
      expect(onSubmenuOpen).toHaveBeenCalledWith(0, expect.any(Object));
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets the delay when moving to another submenu item', async () => {
    vi.useFakeTimers();
    try {
      make({ geometry: makeGeometry({ submenu: [true, true, false, false] }) });
      move(0.3); // item 0
      await vi.advanceTimersByTimeAsync(300);
      move(0.3 + Math.PI / 2); // item 1 — сброс таймера
      await vi.advanceTimersByTimeAsync(300);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(100);
      expect(onSubmenuOpen).toHaveBeenCalledTimes(1);
      expect(onSubmenuOpen).toHaveBeenCalledWith(1, expect.any(Object));
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer when moving off the submenu item', async () => {
    vi.useFakeTimers();
    try {
      make();
      move(0.3); // item 0 — submenu
      await vi.advanceTimersByTimeAsync(300);
      move(0.3 + Math.PI / 2); // item 1 — не submenu
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer on pointerup over the item (click selection path)', async () => {
    vi.useFakeTimers();
    try {
      make({ mode: 'click' });
      move(0.3, 65, 1);
      await vi.advanceTimersByTimeAsync(300);
      fire(window, 'pointerup', { ...pointAt(0.3), button: 0 });
      expect(onSelect).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not open submenu when submenuDelay is 0', async () => {
    vi.useFakeTimers();
    try {
      make({ submenuDelay: 0 });
      move(0.3);
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer on pointercancel', async () => {
    vi.useFakeTimers();
    try {
      make();
      move(0.3);
      await vi.advanceTimersByTimeAsync(300);
      fire(window, 'pointercancel');
      expect(onClose).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the timer when the pointer leaves the menu', async () => {
    vi.useFakeTimers();
    try {
      make();
      move(0.3);
      await vi.advanceTimersByTimeAsync(300);
      move(0.3, 200); // outside
      expect(onClose).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(600);
      expect(onSubmenuOpen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});