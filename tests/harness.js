/* Общий стенд для тестов: минимальная заглушка DOM/Canvas
   с виртуальными таймерами и requestAnimationFrame. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function boot() {
  function ClassList() {
    const set = new Set();
    this.add = c => set.add(c);
    this.remove = c => set.delete(c);
    this.toggle = (c, on) => {
      if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); }
      else if (on) set.add(c); else set.delete(c);
    };
    this.contains = c => set.has(c);
  }

  const gradient = () => ({ addColorStop() {} });

  function ctx2d(canvas) {
    const noop = () => {};
    const target = {
      canvas,
      createLinearGradient: gradient, createRadialGradient: gradient,
      createPattern: () => null, measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: [] }),
      setTransform: noop, save: noop, restore: noop, translate: noop, rotate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      rect: noop, fill: noop, stroke: noop, clip: noop, fillRect: noop,
      strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
      drawImage: noop, setLineDash: noop
    };
    return new Proxy(target, {
      get(t, p) { return p in t ? t[p] : () => {}; },
      set(t, p, v) { t[p] = v; return true; }
    });
  }

  let n = 0;
  function El(id, tag) {
    this.id = id || ('el' + (++n));
    this.tagName = (tag || 'div').toUpperCase();
    this.listeners = {};
    this.style = {};
    this.attrs = {};
    this.children = [];
    this.classList = new ClassList();
    this.textContent = '';
    this.disabled = false;
    this._html = '';
  }
  El.prototype.addEventListener = function (t, fn) {
    (this.listeners[t] = this.listeners[t] || []).push(fn);
  };
  El.prototype.removeEventListener = function () {};
  El.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  El.prototype.getAttribute = function (k) {
    return this.attrs[k] !== undefined ? this.attrs[k] : null;
  };
  El.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 1280, height: 720 };
  };
  El.prototype.appendChild = function (c) { this.children.push(c); return c; };
  El.prototype.removeChild = function (c) {
    this.children = this.children.filter(x => x !== c);
  };
  El.prototype.querySelectorAll = function () { return []; };
  El.prototype.querySelector = function () { return null; };
  El.prototype.closest = function () { return this; };
  El.prototype.getContext = function () {
    if (!this._ctx) this._ctx = ctx2d(this);
    return this._ctx;
  };
  El.prototype.click = function () { this.dispatch('click', {}); };
  El.prototype.dispatch = function (type, ev) {
    (this.listeners[type] || []).forEach(fn => fn(Object.assign({
      preventDefault() {}, target: this, button: 0, pointerType: 'mouse'
    }, ev)));
  };
  Object.defineProperty(El.prototype, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = v; this.children = []; }
  });
  Object.defineProperty(El.prototype, 'lastElementChild', {
    get() { return this.children[this.children.length - 1] || null; }
  });

  const elements = {};
  function getEl(id) {
    if (!elements[id]) elements[id] = new El(id, id === 'game' ? 'canvas' : 'div');
    return elements[id];
  }

  // виртуальное время и таймеры
  let vnow = 0;
  let timers = [];
  let tid = 1;
  function vSetTimeout(fn, ms) {
    timers.push({ id: tid, fn, at: vnow + (ms || 0) });
    return tid++;
  }
  function vClearTimeout(id) { timers = timers.filter(t => t.id !== id); }
  function flushTimers(ms) {
    const end = vnow + (ms || 0);
    let guard = 0;
    while (guard++ < 1000) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > end) break;
      timers.shift();
      vnow = t.at;
      try { t.fn(); } catch (e) { console.error('[timer]', e.message); }
    }
    vnow = Math.max(vnow, end);
  }

  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };

  const documentStub = {
    getElementById: getEl,
    createElement: tag => new El(null, tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: new El('html'),
    addEventListener: () => {},
    hidden: false
  };

  let rafCb = null;
  const windowListeners = {};

  const windowStub = {
    document: documentStub,
    localStorage: localStorageStub,
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    navigator: { language: 'ru', maxTouchPoints: 0, userAgent: 'node' },
    location: { href: 'http://localhost/' },
    matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
    addEventListener: (t, fn) => { (windowListeners[t] = windowListeners[t] || []).push(fn); },
    removeEventListener: () => {},
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    cancelAnimationFrame: () => {},
    setTimeout: vSetTimeout,
    clearTimeout: vClearTimeout,
    setInterval: () => 0,
    clearInterval: () => {},
    performance: { now: () => vnow },
    console,
    confirm: () => true
  };
  windowStub.window = windowStub;

  const sandbox = Object.assign({}, windowStub, {
    window: windowStub, self: windowStub, globalThis: windowStub
  });
  const context = vm.createContext(sandbox);

  function load(file) {
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }

  function tick(times, ms) {
    for (let i = 0; i < (times || 1); i++) {
      vnow += (ms || 16);
      if (!rafCb) return;
      const cb = rafCb;
      rafCb = null;
      cb(vnow);
      flushTimers(0);
    }
  }

  function dispatch(id, type, ev) {
    const el = getEl(id);
    (el.listeners[type] || []).forEach(fn => fn(Object.assign({
      preventDefault() {}, target: el, button: 0, pointerType: 'mouse'
    }, ev)));
  }

  function key(type, k) {
    (windowListeners[type] || []).forEach(fn => fn({
      key: k, preventDefault() {}
    }));
  }

  function worldToClient(x, y) {
    return { x: x, y: y }; // масштаб 1:1 (canvas 1280x720)
  }

  function flush(ms) { flushTimers(ms || 0); }

  load('js/engine.js');
  load('js/generator.js');
  load('js/yandex.js');
  load('script.js');

  return {
    win: windowStub,
    context, elements, element: getEl, dispatch, key, tick,
    flushTimers: flush, worldToClient, localStorage: localStorageStub,
    W: 1280, H: 720
  };
}

module.exports = { boot };
