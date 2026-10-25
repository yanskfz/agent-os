// ENGINE FILE: builds the slides from client/content.js and runs the carousel.
// Do not put client text here; add it to client/content.js instead.
(function () {
  var S = window.SITE;
  var U = S.ui;
  var track = document.getElementById("track");
  var dotsBox = document.getElementById("dots");
  var counter = document.getElementById("counter");

  // Tiny element helper. Text always goes through textContent.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    for (var key in attrs || {}) {
      if (key === "text") node.textContent = attrs[key];
      else if (key === "class") node.className = attrs[key];
      else if (key === "onclick") node.addEventListener("click", attrs[key]);
      else node.setAttribute(key, attrs[key]);
    }
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  // Fills {placeholders} in a ui label: fmt("{n} of {total}", { n: 1, total: 7 }).
  function fmt(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; });
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Button that jumps to another slide and moves focus to its title.
  function jumpButton(label, target, cls) {
    return el("button", { type: "button", class: cls, text: label, onclick: function () { go(target, true); } });
  }

  var VIDEO = S.photos.length + 1;
  var CONTACT = S.photos.length + 2;

  // ---------- Slide 1: Hero ----------
  function heroSlide() {
    var H = S.hero, first = S.photos[0];
    var thumbs = S.photos.slice(1).map(function (p, i) {
      return el("button", {
        type: "button", class: "thumb",
        "aria-label": fmt(U.viewPhoto, { name: p.thumb }),
        onclick: function () { go(i + 2, true); }
      }, [
        el("img", { src: p.file, alt: p.alt, width: "1080", height: "896", loading: "lazy" }),
        el("span", { text: p.thumb })
      ]);
    });
    return [
      el("div", { class: "copy" }, [
        el("span", { class: "chip", text: H.chip }),
        el("h1", { class: "slide-title", tabindex: "-1", text: H.title }),
        el("p", { class: "lead", text: H.text }),
        el("div", { class: "actions" }, [
          jumpButton(H.ctaProjects, 1, "btn btn-primary"),
          jumpButton(H.ctaContact, CONTACT, "btn btn-tonal")
        ])
      ]),
      el("div", { class: "media hero-media" }, [
        el("img", { class: "photo", src: first.file, alt: first.alt, width: "1080", height: "896" }),
        el("div", { class: "thumbs" }, thumbs)
      ])
    ];
  }

  // ---------- One slide per project photo ----------
  function photoSlide(p, i) {
    var P = S.project;
    return [
      el("div", { class: "copy" }, [
        el("p", { class: "eyebrow", text: fmt(U.photoOf, { project: P.number, n: i + 1, total: S.photos.length }) }),
        el("span", { class: "chip", text: P.chip }),
        el("h2", { class: "slide-title", tabindex: "-1", text: P.title }),
        el("p", { class: "meta", text: P.place }),
        el("p", { class: "lead", text: p.text }),
        el("div", { class: "actions" }, [jumpButton(P.videoButton, VIDEO, "btn btn-tonal")])
      ]),
      el("div", { class: "media photo-media" }, [
        el("img", { class: "photo", src: p.file, alt: p.alt, width: "1080", height: "896", loading: "lazy" })
      ])
    ];
  }

  // ---------- Video ----------
  function videoSlide() {
    var V = S.video;
    var play = V.url
      ? el("a", { class: "play", href: V.url, target: "_blank", rel: "noopener", "aria-label": U.play })
      : el("button", { class: "play", type: "button", disabled: "", "aria-label": U.playUnavailable });
    play.appendChild(svgPlay());
    return [
      el("div", { class: "video-wrap" }, [
        el("h2", { class: "slide-title", tabindex: "-1", text: V.title }),
        el("div", { class: "video-box" }, [play]),
        el("p", { class: "meta", text: V.caption })
      ])
    ];
  }

  function svgPlay() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "32");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M8 5.5v13l11-6.5z");
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  // ---------- Contact ----------
  function contactSlide() {
    var C = S.contact, L = C.labels;
    var digits = C.whatsapp.replace(/\D/g, "");
    var ready = C.whatsapp.indexOf("[") === -1 && digits.length >= 9;
    var wa = ready
      ? el("a", { class: "btn btn-light", href: "https://wa.me/" + digits, target: "_blank", rel: "noopener", text: C.button })
      : el("button", { class: "btn btn-light", type: "button", disabled: "", text: C.button });

    function row(label, value) {
      return el("div", { class: "row" }, [el("dt", { text: label }), el("dd", { text: value })]);
    }

    return [
      el("div", { class: "copy" }, [
        el("h2", { class: "slide-title", tabindex: "-1", text: C.title })
      ]),
      el("div", { class: "contact-card" }, [
        el("dl", {}, [
          row(L.whatsapp, C.whatsapp),
          row(L.email, C.email),
          row(L.address, C.address),
          row(L.director, C.director)
        ]),
        wa,
        ready ? null : el("p", { class: "card-note", text: C.buttonNote })
      ])
    ];
  }

  // ---------- Assemble ----------
  var builders = [heroSlide]
    .concat(S.photos.map(function (p, i) { return function () { return photoSlide(p, i); }; }))
    .concat([videoSlide, contactSlide]);
  var kinds = ["hero"].concat(S.photos.map(function () { return "photo"; }), ["video", "contact"]);
  var total = builders.length;

  var slides = builders.map(function (build, i) {
    var slide = el("section", {
      class: "slide slide-" + kinds[i],
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": fmt(U.slideOf, { n: i + 1, total: total })
    }, [el("div", { class: "slide-inner" }, build())]);
    track.appendChild(slide);
    return slide;
  });

  var dots = slides.map(function (_, i) {
    var dot = el("button", {
      type: "button", class: "dot", "aria-label": fmt(U.goTo, { n: i + 1 }),
      onclick: function () { go(i); }
    });
    dotsBox.appendChild(dot);
    return dot;
  });

  document.documentElement.lang = S.meta.lang;
  document.title = S.meta.title;
  document.getElementById("logo").textContent = S.logo;
  document.getElementById("brand").textContent = S.brand;
  document.getElementById("note").textContent = S.note;
  document.getElementById("stage").setAttribute("aria-label", U.carousel);
  document.getElementById("prev").setAttribute("aria-label", U.prev);
  document.getElementById("next").setAttribute("aria-label", U.next);

  // ---------- Navigation ----------
  var current = 0;

  function go(index, focusTitle) {
    current = (index + total) % total; // loops around
    track.style.transform = "translateX(" + (-100 * current) + "%)";
    slides.forEach(function (s, i) {
      var active = i === current;
      s.setAttribute("aria-hidden", active ? "false" : "true");
      s.inert = !active;
      if (active) s.scrollTop = 0;
    });
    dots.forEach(function (d, i) {
      if (i === current) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
    counter.textContent = pad(current + 1) + " / " + pad(total);
    if (focusTitle) {
      var title = slides[current].querySelector(".slide-title");
      if (title) title.focus({ preventScroll: true });
    }
  }

  document.getElementById("prev").addEventListener("click", function () { go(current - 1); });
  document.getElementById("next").addEventListener("click", function () { go(current + 1); });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
  });

  // Swipe: only when the gesture is clearly more horizontal than vertical.
  var startX = null, startY = null;
  var stage = document.getElementById("stage");
  stage.addEventListener("touchstart", function (e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    startX = startY = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  go(0);
})();
