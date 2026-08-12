// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { acquireActiveMenu, releaseActiveMenu, getActiveMenu } from '../../../src/lifecycle/ActiveMenuRegistry.js';

describe('ActiveMenuRegistry', () => {
  const a = {};
  const b = {};
  const c = {};

  beforeEach(() => {
    releaseActiveMenu(a);
    releaseActiveMenu(b);
    releaseActiveMenu(c);
  });

  afterEach(() => {
    releaseActiveMenu(a);
    releaseActiveMenu(b);
    releaseActiveMenu(c);
  });

  it('starts with no active menu', () => {
    expect(getActiveMenu()).toBeNull();
  });

  it('acquire sets the menu and returns null previously', () => {
    expect(acquireActiveMenu(a)).toBeNull();
    expect(getActiveMenu()).toBe(a);
  });

  it('acquiring a second menu returns the previous one', () => {
    acquireActiveMenu(a);
    expect(acquireActiveMenu(b)).toBe(a);
    expect(getActiveMenu()).toBe(b);
  });

  it('acquiring the same menu again returns null (no self-conflict)', () => {
    acquireActiveMenu(a);
    expect(acquireActiveMenu(a)).toBeNull();
    expect(getActiveMenu()).toBe(a);
  });

  it('release clears only its own registration', () => {
    acquireActiveMenu(a);
    acquireActiveMenu(b);
    releaseActiveMenu(a);
    expect(getActiveMenu()).toBe(b);
    releaseActiveMenu(b);
    expect(getActiveMenu()).toBeNull();
  });

  it('release of a non-active menu is a no-op', () => {
    acquireActiveMenu(a);
    releaseActiveMenu(c);
    expect(getActiveMenu()).toBe(a);
  });

  it('acquire after release works (reuse)', () => {
    acquireActiveMenu(a);
    releaseActiveMenu(a);
    acquireActiveMenu(b);
    expect(getActiveMenu()).toBe(b);
  });
});