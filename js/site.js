// 2026-11-04 — Public site: renders profile + media, nav, counters, scroll reveal, videos, celebrity section, WhatsApp enquiry.
// 2026-11-17 — Plain script (works on double-click / file://), inline video players with error fallback, new Experience, Achievements & Education sections; certificates kept out of the main gallery.
(async () => {
const { loadSiteData, mediaUrl, esc } = window.Data;
const { initGallery, openLightbox } = window.Gallery;

const $ = (id) => document.getElementById(id);
const { profile: p, media } = await loadSiteData();
const photos = media.filter((m) => m.type === "photo");
const videos = media.filter((m) => m.type === "video");
const c = p.contact || {};
const hideIfEmpty = (id, list) => { $(id).hidden = !(list && list.length); };

// Text bindings
document.querySelectorAll("[data-bind]").forEach((el) => { el.textContent = p[el.dataset.bind] ?? ""; });
document.title = `${p.name} — ${p.title}`;
$("year").textContent = new Date().getFullYear();
if (p.hero_path) $("hero-img").src = mediaUrl(p.hero_path);
if (p.about_path) $("about-img").src = mediaUrl(p.about_path);

$("bio").innerHTML = (p.bio || "").split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join("");
$("certs").innerHTML = (p.certifications || []).map((t) => `<li>${esc(t)}</li>`).join("");

$("stats").innerHTML = (p.stats || []).map((s) => `
  <div><div class="stat-num" data-to="${+s.value || 0}" data-suffix="${esc(s.suffix)}">0</div>
  <div class="stat-label">${esc(s.label)}</div></div>`).join("");

// Experience + education
$("timeline").innerHTML = (p.experience || []).map((x) => `
  <article class="job reveal"><div class="job-period">${esc(x.period)}</div>
  <h3>${esc(x.role)}</h3><p class="job-org">${esc(x.org)}</p><p>${esc(x.desc)}</p></article>`).join("");
hideIfEmpty("experience", p.experience);
$("edu-list").innerHTML = (p.education || []).map((x) => `
  <li><strong>${esc(x.degree)}</strong><span>${esc(x.school)}${x.year ? ` · ${esc(x.year)}` : ""}</span></li>`).join("");
$("edu-block").hidden = !(p.education || []).length;

$("program-list").innerHTML = (p.programs || []).map((x, i) => `
  <article class="program reveal"><div class="program-num">${String(i + 1).padStart(2, "0")}</div>
  <h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p></article>`).join("");
$("program-select").innerHTML = (p.programs || []).map((x) => `<option>${esc(x.title)}</option>`).join("");

$("venue-list").innerHTML = (p.venues || []).map((v) => `<li class="reveal">${esc(v)}</li>`).join("");

$("quote-list").innerHTML = (p.testimonials || []).map((q) => `
  <figure class="quote reveal"><blockquote>${esc(q.quote)}</blockquote>
  <figcaption><strong>${esc(q.name)}</strong><span>${esc(q.role)}</span></figcaption></figure>`).join("");
hideIfEmpty("testimonials", p.testimonials);

// Achievements: text list + awards and certificate scans (click to zoom)
const proofs = [...photos.filter((m) => m.category === "awards"), ...photos.filter((m) => m.category === "certificates")];
$("ach-list").innerHTML = (p.achievements || []).map((t) => `<li>${esc(t)}</li>`).join("");
const PROOF_PAGE = 8;
let proofShown = 0;
const moreProofs = () => {
  const next = proofs.slice(proofShown, proofShown + PROOF_PAGE);
  $("proof-grid").insertAdjacentHTML("beforeend", next.map((m, j) => `
    <button class="proof" data-i="${proofShown + j}">
      <img src="${mediaUrl(m.thumb_path || m.file_path)}" alt="${esc(m.caption)}" loading="lazy" decoding="async">
      <span>${esc(m.caption)}</span>
    </button>`).join(""));
  proofShown += next.length;
  $("proof-more").hidden = proofShown >= proofs.length;
};
moreProofs();
$("proof-more").onclick = moreProofs;
$("proof-grid").onclick = (e) => {
  const b = e.target.closest(".proof");
  if (b) openLightbox(proofs, +b.dataset.i, b);
};
$("achievements").hidden = !proofs.length && !(p.achievements || []).length;

// Contact + WhatsApp
const waBase = `https://wa.me/${String(c.whatsapp || "").replace(/\D/g, "")}`;
const waLink = (text) => `${waBase}?text=${encodeURIComponent(text)}`;
document.querySelectorAll("[data-wa]").forEach((a) => {
  a.href = waLink(`Hi Coach ${p.name}, I'd like to book a swimming session.`);
  a.target = "_blank";
  a.rel = "noopener";
});
const items = [
  c.phone && ["☎", `tel:${c.phone.replace(/[^\d+]/g, "")}`, c.phone],
  c.whatsapp && ["✆", waBase, "WhatsApp"],
  c.email && ["✉", `mailto:${c.email}`, c.email],
  c.instagram && ["◎", c.instagram, "Instagram"],
  c.location && ["⌖", "", c.location],
].filter(Boolean);
$("contact-list").innerHTML = items.map(([ico, href, label]) => href
  ? `<li><a href="${esc(href)}" ${/^https?:/.test(href) ? 'target="_blank" rel="noopener"' : ""}><span class="ico" aria-hidden="true">${ico}</span>${esc(label)}</a></li>`
  : `<li><span><span class="ico" aria-hidden="true">${ico}</span>${esc(label)}</span></li>`).join("");
$("map").innerHTML = /^https:\/\/www\.google\.com\/maps\/embed/.test(c.map_embed || "")
  ? `<iframe src="${esc(c.map_embed)}" title="Location map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
  : `<p>${esc(c.location || "")}</p>`;

$("enquiry").onsubmit = (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const text = `Hi Coach ${p.name}, I'm ${f.name}${f.phone ? ` (${f.phone})` : ""}. I'm interested in: ${f.program}.${f.message ? `\n${f.message}` : ""}`;
  window.open(waLink(text), "_blank", "noopener");
};

// Celebrity section (photos only, names come from admin)
const celebs = photos.filter((m) => m.is_celebrity);
if (celebs.length) {
  $("celebrities").hidden = false;
  $("celeb-grid").innerHTML = celebs.map((m, i) => `
    <button class="celeb reveal" data-i="${i}">
      <img src="${mediaUrl(m.file_path)}" alt="${esc(m.celebrity_name)} with Coach ${esc(p.name)}" loading="lazy">
      <div class="celeb-info"><div class="celeb-name">${esc(m.celebrity_name)}</div><p class="celeb-cap">${esc(m.caption)}</p></div>
    </button>`).join("");
  $("celeb-grid").onclick = (e) => {
    const b = e.target.closest(".celeb");
    if (b) openLightbox(celebs, +b.dataset.i, b);
  };
}

initGallery(photos.filter((m) => m.category !== "certificates"));

// Videos: native inline players (most reliable on phones); only one plays at a time.
$("videos").hidden = !videos.length;
$("video-grid").innerHTML = videos.map((v) => `
  <figure class="video-card reveal">
    <video controls playsinline preload="none" poster="${mediaUrl(v.thumb_path)}">
      <source src="${mediaUrl(v.file_path)}" type="video/mp4">
    </video>
    <figcaption>${esc(v.caption)}</figcaption>
  </figure>`).join("");
$("video-grid").querySelectorAll("video").forEach((v) => {
  v.addEventListener("play", () => $("video-grid").querySelectorAll("video").forEach((o) => o !== v && o.pause()));
  v.querySelector("source").addEventListener("error", () => {
    v.insertAdjacentHTML("afterend", `<a class="video-fallback" href="${esc(v.querySelector("source").src)}" target="_blank" rel="noopener">Video can't play here — open it ↗</a>`);
  }, { once: true });
});

// Nav
const nav = $("nav"), toggle = nav.querySelector(".nav-toggle"), links = $("nav-links");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
toggle.onclick = () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  nav.classList.toggle("scrolled", open || scrollY > 40);
};
links.onclick = (e) => {
  if (!e.target.closest("a")) return;
  links.classList.remove("open");
  toggle.setAttribute("aria-expanded", false);
};

// Scroll reveal + counters
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const countUp = (el) => {
  const to = +el.dataset.to, suffix = el.dataset.suffix, start = performance.now();
  const step = (t) => {
    const k = reduced ? 1 : Math.min((t - start) / 1600, 1);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString("en-IN") + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (!en.isIntersecting) return;
  en.target.classList.add("in");
  if (en.target.dataset.to) countUp(en.target);
  io.unobserve(en.target);
}), { threshold: 0.15 });
document.querySelectorAll(".reveal, .stat-num").forEach((el) => io.observe(el));

// Structured data for search engines
const ld = document.createElement("script");
ld.type = "application/ld+json";
ld.textContent = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Person", name: p.name, jobTitle: p.title, image: mediaUrl(p.hero_path), sameAs: c.instagram ? [c.instagram] : [] },
    { "@type": "LocalBusiness", name: `Coach ${p.name} — Swimming Lessons`, description: p.tagline, telephone: c.phone, email: c.email, areaServed: c.location, image: mediaUrl(p.hero_path), url: location.origin },
  ],
});
document.head.append(ld);
})();
