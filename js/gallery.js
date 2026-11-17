// 2026-11-04 — Gallery: category tabs, masonry grid with "load more", lightbox (keyboard + swipe).
// 2026-11-17 — Plain script (window.Gallery) so the site works from file://; video modal removed (videos now play inline).
(() => {
const { mediaUrl, esc, CATEGORIES } = window.Data;

const PAGE = 16;
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
let lbList = [], lbIndex = 0, opener = null;

function openModal(el, from) {
  opener = from || document.activeElement;
  el.hidden = false;
  document.body.classList.add("locked");
  el.querySelector(".lb-close").focus();
}

function closeModal(el) {
  el.hidden = true;
  document.body.classList.remove("locked");
  opener?.focus();
}

function show(i) {
  lbIndex = (i + lbList.length) % lbList.length;
  const m = lbList[lbIndex];
  lbImg.src = mediaUrl(m.file_path);
  lbImg.alt = m.caption || "";
  lbCap.textContent = m.is_celebrity && m.celebrity_name ? `${m.celebrity_name} — ${m.caption || ""}` : m.caption || "";
}

function openLightbox(list, index, from) {
  lbList = list;
  show(index);
  openModal(lb, from);
}

lb.querySelector(".lb-close").onclick = () => closeModal(lb);
lb.querySelector(".lb-prev").onclick = () => show(lbIndex - 1);
lb.querySelector(".lb-next").onclick = () => show(lbIndex + 1);
lb.onclick = (e) => { if (e.target === lb) closeModal(lb); };

let touchX = 0;
lb.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
lb.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) show(lbIndex + (dx < 0 ? 1 : -1));
});

document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeModal(lb);
  if (e.key === "ArrowLeft") show(lbIndex - 1);
  if (e.key === "ArrowRight") show(lbIndex + 1);
});

function initGallery(photos) {
  const tabs = document.getElementById("gallery-tabs");
  const grid = document.getElementById("gallery-grid");
  const more = document.getElementById("gallery-more");
  const filters = [
    ...(photos.some((p) => p.is_featured) ? [["featured", "Highlights"]] : []),
    ["all", "All"],
    ...Object.entries(CATEGORIES).filter(([k]) => photos.some((p) => p.category === k)),
  ];
  let current = filters[0][0], list = [], shown = 0;

  tabs.innerHTML = filters
    .map(([k, label]) => `<button class="tab" role="tab" data-k="${k}" aria-selected="${k === current}">${esc(label)}</button>`)
    .join("");

  const append = () => {
    const next = list.slice(shown, shown + PAGE);
    grid.insertAdjacentHTML("beforeend", next.map((m, j) => `
      <button class="tile" data-i="${shown + j}">
        <img src="${mediaUrl(m.thumb_path || m.file_path)}" alt="${esc(m.caption)}" loading="lazy" decoding="async">
        <span class="tile-cap">${esc(m.caption)}</span>
      </button>`).join(""));
    shown += next.length;
    more.hidden = shown >= list.length;
  };

  const render = () => {
    list = current === "all" ? photos
      : current === "featured" ? photos.filter((p) => p.is_featured)
      : photos.filter((p) => p.category === current);
    grid.innerHTML = "";
    shown = 0;
    append();
  };

  tabs.onclick = (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    current = b.dataset.k;
    tabs.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t === b));
    render();
  };
  grid.onclick = (e) => {
    const t = e.target.closest(".tile");
    if (t) openLightbox(list, +t.dataset.i, t);
  };
  more.onclick = append;
  render();
}

window.Gallery = { openLightbox, initGallery };
})();
