// 2026-11-04 — Admin panel: auth, media upload (WebP compression + progress), edit/replace/delete, reorder, seed import, profile editor.
// 2026-11-17 — Uses window.Data (plain-script data layer); experience/education/achievements fields; only MP4/WebM videos accepted.
const { getClient, mediaUrl, loadSeed, esc, CATEGORIES, SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET } = window.Data;

const $ = (id) => document.getElementById(id);
const MAX_UPLOAD = 50 * 1024 * 1024; // Supabase free plan per-file limit
const LISTS = {
  stats: ["value", "suffix", "label"], programs: ["title", "desc"], testimonials: ["quote", "name", "role"],
  experience: ["role", "org", "period", "desc"], education: ["degree", "school", "year"],
};
const LINES = ["certifications", "venues", "achievements"];
const sb = await getClient();
const grid = $("grid"), pf = $("profile-form"), dlg = $("edit"), ef = $("edit-form").elements;
let items = [], editing = null, dragId = null;

const setMsg = (id, text, err = false) => { const el = $(id); el.textContent = text; el.classList.toggle("err", err); };

// Category dropdowns
const catOptions = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
$("filter").insertAdjacentHTML("beforeend", catOptions);
ef.category.innerHTML = catOptions;

/* ---------- Auth ---------- */
function showLogin() { $("login").hidden = false; $("app").hidden = true; }

async function start() {
  const { data: ok } = await sb.rpc("is_admin");
  if (!ok) {
    await sb.auth.signOut();
    showLogin();
    return setMsg("login-msg", "This account is not an admin.", true);
  }
  $("login").hidden = true;
  $("app").hidden = false;
  await loadMedia();
  await loadProfile();
}

if (!sb) $("setup").hidden = false;
else {
  const { data: { session } } = await sb.auth.getSession();
  session ? start() : showLogin();
}

$("login-form").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  setMsg("login-msg", "Logging in…");
  const { error } = await sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
  if (error) return setMsg("login-msg", error.message, true);
  setMsg("login-msg", "");
  start();
};
$("logout").onclick = async () => { await sb.auth.signOut(); location.reload(); };

document.querySelectorAll(".top .tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".top .tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    $("tab-media").hidden = t.dataset.tab !== "media";
    $("tab-profile").hidden = t.dataset.tab !== "profile";
  };
});

/* ---------- Storage helpers ---------- */
async function resize(source, max, quality) {
  const img = source instanceof Blob ? await createImageBitmap(source, { imageOrientation: "from-image" }) : source;
  const w = img.videoWidth || img.width, h = img.videoHeight || img.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", quality));
  // Older Safari cannot encode WebP and silently returns PNG — use JPEG instead.
  return blob.type === "image/webp" ? blob : new Promise((r) => c.toBlob(r, "image/jpeg", quality));
}

function videoFrame(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 2); };
    v.onseeked = () => resolve(v);
    v.onerror = () => reject(new Error("Could not read this video"));
  });
}

const extOf = (blob) => (blob.type === "image/webp" ? "webp" : "jpg");

async function put(path, blob, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText || "{}").message || `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

// Compresses (photos) or extracts a poster (videos), uploads both, returns the DB fields.
async function uploadFile(file, onProgress) {
  if (file.size > MAX_UPLOAD) throw new Error("File is larger than 50 MB — compress it first");
  const isVideo = file.type.startsWith("video/");
  // iPhone .mov (HEVC) and other formats do not play in most browsers.
  if (isVideo && !/^video\/(mp4|webm)$/.test(file.type)) throw new Error("Only MP4 videos play on all phones — convert this video to MP4 (H.264) first");
  const id = crypto.randomUUID();
  let main, thumb, ext;
  if (isVideo) {
    const v = await videoFrame(file);
    thumb = await resize(v, 600, 0.75);
    URL.revokeObjectURL(v.src);
    main = file;
    ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  } else {
    main = await resize(file, 1920, 0.8);
    thumb = await resize(file, 600, 0.75);
    ext = extOf(main);
  }
  const file_path = `uploads/${id}.${ext}`, thumb_path = `uploads/${id}-thumb.${extOf(thumb)}`;
  await put(file_path, main, (p) => onProgress(p * 0.9));
  await put(thumb_path, thumb, (p) => onProgress(0.9 + p * 0.1));
  return { file_path, thumb_path, type: isVideo ? "video" : "photo" };
}

// Seed files live in the website itself, only storage files are removed.
async function removeFiles(paths) {
  const stored = paths.filter((p) => p && !p.startsWith("assets/"));
  if (stored.length) await sb.storage.from(MEDIA_BUCKET).remove(stored);
}

/* ---------- Media list ---------- */
async function loadMedia() {
  const { data, error } = await sb.from("media").select("*").order("sort_order");
  if (error) return setMsg("count", error.message, true);
  items = data;
  renderGrid();
  fillImagePickers();
}

const visible = () => {
  const q = $("search").value.trim().toLowerCase(), cat = $("filter").value;
  return items.filter((m) => (!cat || m.category === cat) && (!q || `${m.caption} ${m.celebrity_name}`.toLowerCase().includes(q)));
};

function renderGrid() {
  const list = visible();
  setMsg("count", `${list.length} of ${items.length} items · drag cards or use ↑ ↓ to reorder · new uploads appear first`);
  grid.innerHTML = list.map((m) => `
    <div class="card" draggable="true" data-id="${m.id}">
      <div class="badges">
        ${m.type === "video" ? '<span class="badge">▶ Video</span>' : ""}
        ${m.is_featured ? '<span class="badge">★ Featured</span>' : ""}
        ${m.is_celebrity ? `<span class="badge gold">${esc(m.celebrity_name || "Celebrity")}</span>` : ""}
      </div>
      <img src="${mediaUrl(m.thumb_path || m.file_path)}" alt="" loading="lazy">
      <div class="card-body">
        <div class="card-cap">${esc(m.caption) || "<em>No caption</em>"}</div>
        <div class="card-meta">${esc(CATEGORIES[m.category] || m.category)}</div>
      </div>
      <div class="card-actions">
        <button data-act="up" aria-label="Move up">↑</button>
        <button data-act="down" aria-label="Move down">↓</button>
        <button data-act="edit">Edit</button>
      </div>
    </div>`).join("");
}
$("search").oninput = renderGrid;
$("filter").onchange = renderGrid;

async function saveOrder() {
  const changed = items.filter((m, i) => m.sort_order !== i);
  changed.forEach((m) => { m.sort_order = items.indexOf(m); });
  const res = await Promise.all(changed.map((m) => sb.from("media").update({ sort_order: m.sort_order }).eq("id", m.id)));
  const bad = res.find((r) => r.error);
  if (bad) setMsg("count", `Reorder failed: ${bad.error.message}`, true);
}

function moveTo(id, targetId, after) {
  const m = items.find((x) => x.id === id);
  items = items.filter((x) => x !== m);
  items.splice(items.findIndex((x) => x.id === targetId) + (after ? 1 : 0), 0, m);
  renderGrid();
  saveOrder();
}

grid.onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const id = b.closest(".card").dataset.id;
  if (b.dataset.act === "edit") return openEdit(items.find((m) => m.id === id));
  const list = visible(), k = list.findIndex((m) => m.id === id);
  const target = list[b.dataset.act === "up" ? k - 1 : k + 1];
  if (target) moveTo(id, target.id, b.dataset.act === "down");
};

grid.addEventListener("dragstart", (e) => {
  const c = e.target.closest(".card");
  if (!c) return;
  dragId = c.dataset.id;
  c.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
grid.addEventListener("dragover", (e) => {
  const c = e.target.closest(".card");
  if (!c || !dragId) return;
  e.preventDefault();
  grid.querySelector(".target")?.classList.remove("target");
  c.classList.add("target");
});
grid.addEventListener("drop", (e) => {
  e.preventDefault();
  const c = e.target.closest(".card");
  if (c && dragId && c.dataset.id !== dragId) {
    const from = items.findIndex((m) => m.id === dragId), to = items.findIndex((m) => m.id === c.dataset.id);
    moveTo(dragId, c.dataset.id, from < to);
  }
});
grid.addEventListener("dragend", () => {
  dragId = null;
  grid.querySelector(".dragging")?.classList.remove("dragging");
  grid.querySelector(".target")?.classList.remove("target");
});

/* ---------- Upload ---------- */
async function uploadAll(files) {
  if (!files.length) return;
  let order = (items.length ? Math.min(...items.map((m) => m.sort_order)) : 0) - files.length;
  for (const file of files) { // one at a time keeps phone memory low
    const li = document.createElement("li");
    li.innerHTML = `<span>${esc(file.name)}</span><progress max="1" value="0"></progress>`;
    $("queue").append(li);
    const bar = li.querySelector("progress");
    try {
      const up = await uploadFile(file, (p) => { bar.value = p; });
      const { error } = await sb.from("media").insert({ ...up, category: "coaching", caption: "", sort_order: order++ });
      if (error) throw error;
      li.remove();
    } catch (err) {
      li.innerHTML = `<span class="err">${esc(file.name)}: ${esc(err.message)}</span>`;
    }
  }
  await loadMedia();
}

const drop = $("drop");
$("file-input").onchange = (e) => { uploadAll([...e.target.files]); e.target.value = ""; };
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadAll([...e.dataTransfer.files].filter((f) => /^(image|video)\//.test(f.type)));
});

// Registers the photos/videos shipped in /assets/seed (no re-upload needed) and the default profile.
$("import-seed").onclick = async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  setMsg("count", "Importing…");
  const seed = await loadSeed();
  const have = new Set(items.map((m) => m.file_path));
  const rows = seed.media.filter((m) => !have.has(m.file_path));
  const { error } = rows.length ? await sb.from("media").insert(rows) : {};
  const { data: p } = await sb.from("profile").select("data").eq("id", 1).maybeSingle();
  if (!Object.keys(p?.data || {}).length) await sb.from("profile").upsert({ id: 1, data: seed.profile });
  btn.disabled = false;
  if (error) return setMsg("count", error.message, true);
  await loadMedia();
  await loadProfile();
  setMsg("count", `Imported ${rows.length} new items.`);
};

/* ---------- Edit dialog ---------- */
function openEdit(m) {
  editing = m;
  const isVideo = m.type === "video";
  ef.caption.value = m.caption || "";
  ef.category.value = m.category;
  ef.is_featured.checked = m.is_featured;
  ef.is_celebrity.checked = m.is_celebrity;
  ef.celebrity_name.value = m.celebrity_name || "";
  ef.is_celebrity.disabled = ef.celebrity_name.disabled = isVideo;
  ef.replace.value = "";
  $("edit-prev").src = mediaUrl(m.thumb_path || m.file_path);
  setMsg("edit-msg", isVideo ? "Celebrity highlight is available for photos only." : "");
  dlg.showModal();
}

$("edit-cancel").onclick = () => dlg.close();

$("edit-form").onsubmit = async (e) => {
  e.preventDefault();
  const btn = $("edit-save");
  btn.disabled = true;
  try {
    const patch = {
      caption: ef.caption.value.trim(),
      category: ef.category.value,
      is_featured: ef.is_featured.checked,
      is_celebrity: ef.is_celebrity.checked && editing.type === "photo",
      celebrity_name: ef.celebrity_name.value.trim(),
    };
    const file = ef.replace.files[0];
    let old = [];
    if (file) {
      Object.assign(patch, await uploadFile(file, (p) => setMsg("edit-msg", `Uploading… ${Math.round(p * 100)}%`)));
      if (patch.type === "video") patch.is_celebrity = false;
      old = [editing.file_path, editing.thumb_path];
    }
    if (patch.is_celebrity && !patch.celebrity_name) throw new Error("Please enter the celebrity name.");
    setMsg("edit-msg", "Saving…");
    const { error } = await sb.from("media").update(patch).eq("id", editing.id);
    if (error) throw error;
    await removeFiles(old);
    dlg.close();
    await loadMedia();
  } catch (err) {
    setMsg("edit-msg", err.message, true);
  } finally {
    btn.disabled = false;
  }
};

$("edit-delete").onclick = async () => {
  if (!confirm("Delete this item permanently?")) return;
  const { error } = await sb.from("media").delete().eq("id", editing.id);
  if (error) return setMsg("edit-msg", error.message, true);
  await removeFiles([editing.file_path, editing.thumb_path]);
  dlg.close();
  await loadMedia();
};

/* ---------- Profile ---------- */
const thumbFor = (path) => mediaUrl(items.find((m) => m.file_path === path)?.thumb_path || path);
const pickers = () => pf.querySelectorAll("select[data-preview]");

function setSelect(sel, value) {
  if (value && ![...sel.options].some((o) => o.value === value)) sel.add(new Option("Current image", value));
  sel.value = value || "";
}

function updatePreviews() {
  pickers().forEach((sel) => { $(sel.dataset.preview).src = thumbFor(sel.value); });
}

function fillImagePickers() {
  const options = items.filter((m) => m.type === "photo")
    .map((m) => `<option value="${esc(m.file_path)}">${esc(m.caption || m.file_path)}</option>`).join("");
  pickers().forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = options;
    setSelect(sel, current);
    sel.onchange = updatePreviews;
  });
  updatePreviews();
}

async function loadProfile() {
  const seed = await loadSeed();
  const { data } = await sb.from("profile").select("data").eq("id", 1).maybeSingle();
  const p = { ...seed.profile, ...(data?.data || {}) };
  for (const el of pf.elements) {
    if (!el.name) continue;
    const [a, b] = el.name.split(".");
    let v = b ? p[a]?.[b] : p[a];
    if (LISTS[a]) v = (v || []).map((o) => LISTS[a].map((k) => o[k] ?? "").join(" | ")).join("\n");
    else if (LINES.includes(a)) v = (v || []).join("\n");
    else if (a === "bio") v = (v || "").split(/\n+/).join("\n\n");
    if (el.tagName === "SELECT") setSelect(el, v);
    else el.value = v ?? "";
  }
  updatePreviews();
}

pf.onsubmit = async (e) => {
  e.preventDefault();
  const data = { contact: {} };
  for (const el of pf.elements) {
    if (!el.name) continue;
    const [a, b] = el.name.split(".");
    const raw = el.value.trim();
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (b) data[a][b] = raw;
    else if (LISTS[a]) data[a] = lines.map((l) => {
      const parts = l.split("|").map((s) => s.trim());
      return Object.fromEntries(LISTS[a].map((k, i) => [k, parts[i] ?? ""]));
    });
    else if (LINES.includes(a)) data[a] = lines;
    else data[a] = raw;
  }
  data.stats.forEach((s) => { s.value = Number(String(s.value).replace(/\D/g, "")) || 0; });
  data.contact.whatsapp = data.contact.whatsapp.replace(/\D/g, "");
  setMsg("profile-msg", "Saving…");
  const { error } = await sb.from("profile").upsert({ id: 1, data, updated_at: new Date().toISOString() });
  setMsg("profile-msg", error ? error.message : "Saved ✓ — live on the website now.", Boolean(error));
};
