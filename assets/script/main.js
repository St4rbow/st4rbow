(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var whenPreloaded = window.whenPreloaded || function (fn) { fn(); };
  var header = document.getElementById('site-header');

  function initYear() {
    document.getElementById('year').textContent = String(new Date().getFullYear());
  }

  function initMenu() {
    var button = document.getElementById('hamburger');
    var links = document.getElementById('nav-links');

    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    button.addEventListener('click', function () {
      setOpen(!header.classList.contains('nav-open'));
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function initScrollState() {
    var toTop = document.getElementById('to-top');
    var ticking = false;

    function update() {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 10);
      toTop.classList.toggle('visible', y > 400);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function initActiveLink() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var hash = '#' + entry.target.id;
        links.forEach(function (link) {
          var active = link.getAttribute('href') === hash;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (link) {
      observer.observe(document.querySelector(link.getAttribute('href')));
    });
  }

  function initTypewriter() {
    document.querySelectorAll('[data-typewriter]').forEach(function (box) {
      var ghost = box.querySelector('.typewriter-text').cloneNode(true);
      ghost.className = 'typewriter-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      var walker = document.createTreeWalker(ghost, NodeFilter.SHOW_TEXT);
      var chunks = [];
      while (walker.nextNode()) {
        chunks.push({ node: walker.currentNode, text: walker.currentNode.nodeValue.replace(/\s+/g, ' ') });
      }
      chunks.forEach(function (chunk) {
        chunk.node.nodeValue = '';
      });
      var caret = document.createElement('span');
      caret.className = 'typewriter-caret';
      box.appendChild(ghost);

      whenPreloaded(function () {
        if (reduceMotion) {
          chunks.forEach(function (chunk) {
            chunk.node.nodeValue = chunk.text;
          });
          ghost.appendChild(caret);
          return;
        }
        var index = 0;
        var pos = 0;
        setTimeout(function type() {
          var chunk = chunks[index];
          pos += 1;
          chunk.node.nodeValue = chunk.text.slice(0, pos);
          chunk.node.parentNode.insertBefore(caret, chunk.node.nextSibling);
          if (pos >= chunk.text.length) {
            index += 1;
            pos = 0;
          }
          if (index < chunks.length) setTimeout(type, 16 + Math.random() * 30);
        }, 900);
      });
    });
  }

  function initChannelSwitch() {
    var crt = document.getElementById('crt');
    whenPreloaded(function () {
      crt.classList.add('is-switching');
      setTimeout(function () {
        crt.classList.remove('is-switching');
      }, 600);
    });
  }

  function initMusic() {
    var button = document.getElementById('sound-toggle');
    var state = button.querySelector('.sound-state');
    var audio = document.getElementById('bg-music');
    var VOLUME = 0.35;
    var STEP = 0.05;
    var MUTED_KEY = 'music-muted';
    var wantOn = false;
    var fadeTimer;

    function fadeTo(target, done) {
      clearInterval(fadeTimer);
      fadeTimer = setInterval(function () {
        var diff = target - audio.volume;
        if (Math.abs(diff) <= STEP) {
          audio.volume = target;
          clearInterval(fadeTimer);
          if (done) done();
          return;
        }
        audio.volume += diff > 0 ? STEP : -STEP;
      }, 40);
    }

    function setOn(on) {
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
      state.textContent = on ? 'On' : 'Off';
    }

    function rememberMuted(muted) {
      try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
      } catch (e) {}
    }

    function wasMuted() {
      try {
        return localStorage.getItem(MUTED_KEY) === '1';
      } catch (e) {
        return false;
      }
    }

    function start() {
      wantOn = true;
      setOn(true);
      if (audio.paused) audio.volume = 0;
      return audio.play().then(function () {
        fadeTo(VOLUME);
      }, function (error) {
        wantOn = false;
        setOn(false);
        throw error;
      });
    }

    function stop() {
      wantOn = false;
      setOn(false);
      fadeTo(0, function () {
        if (!wantOn) audio.pause();
      });
    }

    button.addEventListener('click', function () {
      rememberMuted(wantOn);
      if (wantOn) stop();
      else start().catch(function () {});
    });

    // Browsers refuse audible autoplay before the visitor interacts, so the preloader waits for one click.
    function waitForConnect(preloader) {
      var enter = document.getElementById('preloader-enter');
      return new Promise(function (resolve) {
        function connect() {
          preloader.removeEventListener('click', connect);
          document.removeEventListener('keydown', connect);
          start().catch(function () {});
          resolve();
        }
        preloader.removeAttribute('aria-hidden');
        preloader.classList.add('is-waiting');
        enter.hidden = false;
        enter.focus();
        preloader.addEventListener('click', connect);
        document.addEventListener('keydown', connect);
      });
    }

    window.holdPreloader(function (preloader) {
      if (wasMuted()) return;
      audio.currentTime = 0;
      return start().catch(function () {
        return waitForConnect(preloader);
      });
    });
  }

  function initTilt() {
    if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var MAX_DEG = 7;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty('--rx', (-y * MAX_DEG).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * MAX_DEG).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.style.removeProperty('--rx');
        el.style.removeProperty('--ry');
      });
    });
  }

  initYear();
  initMenu();
  initScrollState();
  initActiveLink();
  initTypewriter();
  initChannelSwitch();
  initMusic();
  initTilt();
})();
