(() => {
  "use strict";

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  document.body.classList.add("js");

  /* ---------- Preloader ---------- */
  const PRELOADER_MS = 1000;
  const preloader = $("#preloader");
  const greeting = $("#preloader-typed");
  const greetingText = $(".preloader-ghost").textContent;
  const charMs = reduceMotion ? 0 : (PRELOADER_MS * 0.7) / greetingText.length;

  // type the greeting over the first 70% of the preloader, then hold it
  for (let i = 1; i <= greetingText.length; i++) {
    setTimeout(() => (greeting.textContent = greetingText.slice(0, i)), charMs * i);
  }

  setTimeout(() => {
    preloader.classList.add("hidden");
    document.body.classList.remove("is-loading");
    setTimeout(() => preloader.remove(), 700);
  }, PRELOADER_MS);

  /* ---------- Typing effect ---------- */
  const typed = $("#typed-text");
  const roles = ["Full-Stack Software Engineer", "Freelance Web Developer", "UI Enthusiast", "Lifelong Learner"];
  $("#typed-ghost").textContent = roles.reduce((a, b) => (b.length > a.length ? b : a));

  if (!reduceMotion) {
    let role = 0;
    let chars = roles[0].length;
    let deleting = true;

    const tick = () => {
      const word = roles[role];
      chars += deleting ? -1 : 1;
      typed.textContent = word.slice(0, chars);

      let delay = deleting ? 38 : 70 + Math.random() * 60;
      if (!deleting && chars === word.length) {
        deleting = true;
        delay = 1900;
      } else if (deleting && chars === 0) {
        deleting = false;
        role = (role + 1) % roles.length;
        delay = 350;
      }
      setTimeout(tick, delay);
    };

    setTimeout(tick, PRELOADER_MS + 1500);
  }

  /* ---------- Header, back-to-top ring ---------- */
  const header = $("#site-header");
  const toTop = $("#to-top");
  const ringFill = $(".ring-fill", toTop);
  const RING_LENGTH = 2 * Math.PI * 22;
  let lastY = scrollY;
  let scrollQueued = false;

  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    header.classList.toggle("scrolled", y > 30);
    if (y > 500 && y > lastY + 6) header.classList.add("hidden");
    else if (y < lastY - 6 || y <= 500) header.classList.remove("hidden");

    toTop.classList.toggle("visible", y > 600);
    ringFill.style.strokeDashoffset = RING_LENGTH * (1 - progress);

    lastY = y;
    scrollQueued = false;
  };

  addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(onScroll);
    },
    { passive: true }
  );
  onScroll();

  /* ---------- Scrollspy ---------- */
  const navLinks = $$(".nav-link");

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${entry.target.id}`));
      }
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main section[id]").forEach((section) => spy.observe(section));

  /* ---------- Scroll reveal ---------- */
  // Once the entrance finishes, drop the attribute so each component's own
  // hover transitions take over from the reveal transition.
  const reveal = (el) => {
    el.classList.add("revealed");
    if (reduceMotion) {
      el.removeAttribute("data-reveal");
      return;
    }
    el.addEventListener("transitionend", function done(e) {
      if (e.target !== el) return;
      el.removeEventListener("transitionend", done);
      el.removeAttribute("data-reveal");
    });
  };

  const revealer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        revealer.unobserve(entry.target);
        reveal(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  // start after the preloader so the hero's entrance isn't spent behind it
  setTimeout(() => $$("[data-reveal]").forEach((el) => revealer.observe(el)), PRELOADER_MS);

  /* ---------- 3D tilt cards ---------- */
  if (finePointer && !reduceMotion) {
    $$("[data-tilt]").forEach((card) => {
      // measured once on enter: the tilt itself would skew later measurements
      let rect = null;

      card.addEventListener("pointerenter", () => {
        rect = card.getBoundingClientRect();
        card.style.transition = "transform 0.12s ease-out";
      });

      card.addEventListener("pointermove", (e) => {
        if (!rect) return;
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) scale(1.02)`;
      });

      card.addEventListener("pointerleave", () => {
        rect = null;
        card.style.transition = "transform 0.5s var(--ease)";
        card.style.transform = "";
      });
    });
  }

  /* ---------- Mobile menu ---------- */
  const hamburger = $("#hamburger");
  const menu = $("#nav-links");

  const setMenu = (open) => {
    menu.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", open);
    hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("no-scroll", open);
  };

  hamburger.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  menu.addEventListener("click", (e) => {
    if (e.target === menu || e.target.closest("a")) setMenu(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  matchMedia("(min-width: 1025px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });

  /* ---------- Footer year ---------- */
  $("#year").textContent = new Date().getFullYear();
})();
