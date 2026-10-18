(function () {
  'use strict';

  var MIN_VISIBLE_MS = 3500;
  var REPEAT_VISIBLE_MS = 900;
  var MAX_WAIT_MS = 8000;
  var FADE_MS = 600;
  var INTRO_KEY = 'intro-seen';

  var preloader = document.getElementById('preloader');
  var queue = [];
  var holds = [];
  var finished = false;

  window.whenPreloaded = function (fn) {
    if (finished) fn();
    else queue.push(fn);
  };

  // A hold returns a promise; the preloader stays up until every hold settles.
  window.holdPreloader = function (fn) {
    holds.push(fn);
  };

  function finish() {
    if (finished) return;
    finished = true;
    document.body.classList.remove('is-loading');
    preloader.classList.add('is-done');
    setTimeout(function () {
      preloader.remove();
    }, FADE_MS);
    queue.splice(0).forEach(function (fn) {
      fn();
    });
  }

  // The full intro plays once per tab session; reloads get a compressed one.
  function introSeen() {
    try {
      var seen = sessionStorage.getItem(INTRO_KEY) === '1';
      sessionStorage.setItem(INTRO_KEY, '1');
      return seen;
    } catch (e) {
      return false;
    }
  }

  var repeat = introSeen();
  if (repeat) preloader.classList.add('is-repeat');

  var minVisible = new Promise(function (resolve) {
    setTimeout(resolve, repeat ? REPEAT_VISIBLE_MS : MIN_VISIBLE_MS);
  });
  var pageLoaded = new Promise(function (resolve) {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  var maxWait = new Promise(function (resolve) {
    setTimeout(resolve, MAX_WAIT_MS);
  });

  Promise.race([Promise.all([minVisible, pageLoaded]), maxWait])
    .then(function () {
      return Promise.all(holds.map(function (fn) {
        return fn(preloader);
      }));
    })
    .then(finish, finish);
})();
