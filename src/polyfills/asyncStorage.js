// Polyfill for @react-native-async-storage/async-storage in browser
// wagmi / coinbase wallet SDK require this as a peer dep; we back it with localStorage
class AsyncStoragePolyfill {
  getItem(key) {
    try { return Promise.resolve(localStorage.getItem(key)); }
    catch (_) { return Promise.resolve(null); }
  }
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
    return Promise.resolve();
  }
  removeItem(key) {
    try { localStorage.removeItem(key); } catch (_) {}
    return Promise.resolve();
  }
  clear() {
    try { localStorage.clear(); } catch (_) {}
    return Promise.resolve();
  }
  getAllKeys() {
    try { return Promise.resolve(Object.keys(localStorage)); }
    catch (_) { return Promise.resolve([]); }
  }
  multiGet(keys) {
    try { return Promise.resolve(keys.map(k => [k, localStorage.getItem(k)])); }
    catch (_) { return Promise.resolve(keys.map(k => [k, null])); }
  }
  multiSet(pairs) {
    try { pairs.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (_) {}
    return Promise.resolve();
  }
  multiRemove(keys) {
    try { keys.forEach(k => localStorage.removeItem(k)); } catch (_) {}
    return Promise.resolve();
  }
  flushGetRequests() {}
}

module.exports = AsyncStoragePolyfill;
module.exports.default = AsyncStoragePolyfill;
