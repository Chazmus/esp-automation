import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Mock default fetch for unit tests
vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ runs: [], activeRunId: null, entries: [] }),
    })
  )
);

// Node 25+ has an experimental global localStorage that can conflict with jsdom
const store = new Map<string, string>();
afterEach(() => {
  store.clear();
});
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock ResizeObserver for Recharts ResponsiveContainer in jsdom
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as any;
  (globalThis as any).ResizeObserver = MockResizeObserver;
}
