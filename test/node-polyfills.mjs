/**
 * Minimal browser shims so Node can import modules that pull in `stateStore` (e.g. `@core/locationTools`).
 */
const store = new Map();
const ls = {
    getItem(k) {
        return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
        store.set(String(k), String(v));
    },
    removeItem(k) {
        store.delete(String(k));
    },
    clear() {
        store.clear();
    },
    key(i) {
        return [...store.keys()][i] ?? null;
    },
};
Object.defineProperty(ls, 'length', {
    get() {
        return store.size;
    },
});
globalThis.localStorage ??= ls;
