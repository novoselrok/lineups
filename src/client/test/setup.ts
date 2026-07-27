import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Radix positions its overlays with ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom has no layout engine, so these are no-ops rather than throwing.
Element.prototype.scrollIntoView ??= () => {};
globalThis.HTMLElement.prototype.hasPointerCapture ??= () => false;
globalThis.HTMLElement.prototype.releasePointerCapture ??= () => {};

afterEach(() => {
  cleanup();
});
