/* =========================================================
   ONE BULLET / FlexShot — yandex.js
   Модуль интеграции Yandex Games SDK.

   Игра полностью работает без SDK (локальная разработка).
   Если SDK подключён (тег <script src="/sdk.js">) и доступен,
   модуль:
     • инициализирует SDK и сообщает платформе о готовности;
     • сохраняет/загружает прогресс через player.setData/getData;
     • размечает геймплей через GameplayAPI;
     • показывает межстраничную рекламу ТОЛЬКО по запросу игры
       и только между уровнями (см. script.js).

   Ничего не имитируется: если SDK нет — функции просто не работают.
   ========================================================= */
(function (global) {
  'use strict';

  const SAVE_KEY = 'flexshotSave';
  const MIN_AD_INTERVAL = 90 * 1000; // не чаще, чем раз в 90 секунд

  const Yandex = {
    available: false,
    sdk: null,
    player: null,
    lang: 'ru',
    lastAdAt: 0,
    adOpen: false,
    onAdStateChange: null,   // назначает script.js (пауза/звук)

    /* ---------- инициализация ---------- */
    init: function () {
      if (typeof global.YaGames === 'undefined' || !global.YaGames ||
          typeof global.YaGames.init !== 'function') {
        // Тег SDK мог быть подключён с async — подождём немного
        return Yandex._waitForSdk(4000).then(function (ok) {
          if (!ok) return { ok: false, reason: 'sdk-not-loaded' };
          return Yandex._initSdk();
        });
      }
      return Yandex._initSdk();
    },

    _waitForSdk: function (timeoutMs) {
      return new Promise(function (resolve) {
        const started = Date.now();
        const tick = function () {
          if (typeof global.YaGames !== 'undefined' && global.YaGames &&
              typeof global.YaGames.init === 'function') return resolve(true);
          if (Date.now() - started > timeoutMs) return resolve(false);
          setTimeout(tick, 200);
        };
        tick();
      });
    },

    _initSdk: function () {
      return global.YaGames.init()
        .then(function (sdk) {
          Yandex.sdk = sdk;
          Yandex.available = true;
          try {
            Yandex.lang = (sdk.environment && sdk.environment.i18n &&
              sdk.environment.i18n.lang) || 'ru';
          } catch (e) { Yandex.lang = 'ru'; }
          return Yandex._initPlayer();
        })
        .then(function () {
          Yandex._ready();
          return { ok: true, player: !!Yandex.player, lang: Yandex.lang };
        })
        .catch(function (err) {
          // Недоступный SDK не должен ломать игру
          Yandex.available = false;
          console.warn('[Yandex] SDK не инициализирован:', err && err.message ? err.message : err);
          return { ok: false, reason: 'init-failed' };
        });
    },

    _initPlayer: function () {
      const sdk = Yandex.sdk;
      if (!sdk || !sdk.getPlayer) return Promise.resolve();
      return sdk.getPlayer({ scopes: false })
        .then(function (player) { Yandex.player = player; })
        .catch(function () {
          // Анонимный игрок без облачного сохранения — работаем локально
          return sdk.getPlayer({ scopes: false })
            .then(function (p) { Yandex.player = p; })
            .catch(function () { Yandex.player = null; });
        });
    },

    /* Сообщаем платформе, что игра готова к показу */
    _ready: function () {
      try {
        const f = Yandex.sdk && Yandex.sdk.features;
        if (f && f.LoadingAPI && typeof f.LoadingAPI.ready === 'function') {
          f.LoadingAPI.ready();
        }
      } catch (e) { /* не критично */ }
    },

    /* ---------- сохранение прогресса ---------- */
    save: function (data) {
      if (!Yandex.available || !Yandex.player) return;
      try {
        Yandex.player.setData({ [SAVE_KEY]: data }, true).catch(function () {});
      } catch (e) { /* игнорируем: локальное сохранение уже выполнено */ }
    },

    load: function () {
      if (!Yandex.available || !Yandex.player) return Promise.resolve(null);
      try {
        return Yandex.player.getData([SAVE_KEY])
          .then(function (res) { return (res && res[SAVE_KEY]) || null; })
          .catch(function () { return null; });
      } catch (e) {
        return Promise.resolve(null);
      }
    },

    /* ---------- разметка геймплея ---------- */
    gameplayStart: function () {
      try {
        const f = Yandex.sdk && Yandex.sdk.features;
        if (f && f.GameplayAPI && typeof f.GameplayAPI.start === 'function') f.GameplayAPI.start();
      } catch (e) { /* не критично */ }
    },

    gameplayStop: function () {
      try {
        const f = Yandex.sdk && Yandex.sdk.features;
        if (f && f.GameplayAPI && typeof f.GameplayAPI.stop === 'function') f.GameplayAPI.stop();
      } catch (e) { /* не критично */ }
    },

    /**
     * Межстраничная реклама между уровнями.
     * Возвращает Promise<boolean> — была ли реклама показана.
     * Показ не выполняется во время активного геймплея.
     */
    interstitial: function () {
      const now = Date.now();
      if (!Yandex.available || !Yandex.sdk || !Yandex.sdk.adv ||
          typeof Yandex.sdk.adv.showFullscreenAdv !== 'function') {
        return Promise.resolve(false);
      }
      if (Yandex.adOpen) return Promise.resolve(false);
      // Частоту показа дополнительно ограничивает сама платформа
      if (now - Yandex.lastAdAt < MIN_AD_INTERVAL) return Promise.resolve(false);

      Yandex.lastAdAt = now;
      Yandex.adOpen = true;

      return new Promise(function (resolve) {
        let done = false;
        function finish(shown) {
          if (done) return;
          done = true;
          Yandex.adOpen = false;
          if (Yandex.onAdStateChange) Yandex.onAdStateChange(false);
          resolve(shown);
        }

        try {
          Yandex.sdk.adv.showFullscreenAdv({
            callbacks: {
              onOpen: function () {
                if (Yandex.onAdStateChange) Yandex.onAdStateChange(true);
              },
              onClose: function (wasShown) { finish(!!wasShown); },
              onError: function (error) {
                console.warn('[Yandex] Ошибка рекламы:', error);
                finish(false);
              }
            }
          });
        } catch (e) {
          finish(false);
        }
      });
    },

    /* Готова ли игра к запросу рекламы (нет активного геймплея) */
    canShowAd: function () {
      return Yandex.available && !Yandex.adOpen;
    }
  };

  global.Yandex = Yandex;
  if (typeof module !== 'undefined' && module.exports) module.exports = Yandex;
})(typeof window !== 'undefined' ? window : globalThis);
