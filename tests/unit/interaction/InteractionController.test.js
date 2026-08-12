// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionController } from '../../../src/interaction/InteractionController.js';
import { calculateSectorLayout } from '../../../src/geometry/calculateSector.js';

const TAU = Math.PI * 2;

function makeGeometry({ n = 4, gap = 8, selectable = null } = {}) {
  const { sectors } = calculateSectorLayout({
    itemCount: n,
    arcStart: 0,
    arcLength: TAU,
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
    selectable: selectable ?? Array.from({ length: n }, () => true)
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
      button: 0,
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
      button: 0,
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
});

describe('InteractionController — pointerup (click mode)', () => {
  let controller, onClose, onSelect;

  function make(mode = 'click', button = 0) {
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

  it('selects the item under the pointer (any button in click mode)', () => {
    make();
    fire(window, 'pointerup', pointAt(0.3));
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selects with any mouse button in click mode', () => {
    make();
    fire(window, 'pointerup', { ...pointAt(0.3), button: 2 });
    expect(onSelect).toHaveBeenCalledWith(0);
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
      button: 0,
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
});

describe('InteractionController — pointerup (hold mode)', () => {
  let controller, onClose, onSelect;

  function make(button = 0) {
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
    make(0);
    fire(window, 'pointerup', { ...pointAt(0.3), button: 2 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selects on pointerup with the configured button over a sector', () => {
    make(2);
    fire(window, 'pointerup', { ...pointAt(0.3), button: 2 });
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('closes on pointerup with the configured button in the center/gap', () => {
    make(0);
    fire(window, 'pointerup', pointAt(0, 10));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('InteractionController — cancellation and context menu', () => {
  it('pointercancel closes the menu', () => {
    const onClose = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 0,
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose,
      onSelect: vi.fn()
    });
    controller.attach();
    fire(window, 'pointercancel');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses the browser context menu while open', () => {
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 0,
      geometry: makeGeometry(),
      ...CENTER,
      onHover: vi.fn(),
      onClose: vi.fn(),
      onSelect: vi.fn()
    });
    controller.attach();
    const event = fire(window, 'contextmenu');
    expect(event.defaultPrevented).toBe(true);
    expect(event.cancelable).toBe(true);
  });
});

describe('InteractionController — attach/detach', () => {
  it('detach removes all listeners', () => {
    const onHover = vi.fn();
    const controller = new InteractionController({
      interactionMode: 'click',
      button: 0,
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
      button: 0,
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