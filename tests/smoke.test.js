import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('test runner works', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('package entry', () => {
  it('default-exports the Pielet class', async () => {
    const entry = await import('../src/index.js');
    const direct = await import('../src/pielet.js');
    expect(entry.default).toBe(direct.Pielet);
  });

  it('stays default-only so the IIFE global is the constructor', async () => {
    // При именованном экспорте Vite собирает IIFE как объект-модуль: глобал
    // Pielet становится namespace-объектом, и документированный
    // new Pielet(...) из CDN падает с «Pielet is not a constructor».
    const entry = await import('../src/index.js');
    expect(Object.keys(entry)).toEqual(['default']);
  });
});
