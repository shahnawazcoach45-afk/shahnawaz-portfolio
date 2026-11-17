// 2026-11-17 — Data layer (replaces supabase.js): plain script, no fetch for seed data, so file:// works. Adds awards/certificates categories.
(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET } = window.SITE_CONFIG;
  const ROOT = new URL("../", document.currentScript.src);
  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  const CATEGORIES = {
    coaching: "Coaching",
    kids: "Kids & Beginners",
    venues: "Pools & Venues",
    events: "Events & Teams",
    awards: "Awards & Medals",
    certificates: "Certificates",
    bts: "Behind the Scenes",
  };

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  let clientPromise;
  function getClient() {
    if (!configured) return Promise.resolve(null);
    clientPromise ??= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    return clientPromise;
  }

  // Seed files live in the site ("assets/..."); everything else is in the storage bucket.
  function mediaUrl(path) {
    if (!path) return "";
    if (/^https?:/.test(path)) return path;
    if (path.startsWith("assets/")) return new URL(path, ROOT).href;
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  }

  const loadSeed = async () => structuredClone(window.SEED);

  // Returns { profile, media, source }. Missing profile keys fall back to seed defaults.
  async function loadSiteData() {
    const seed = await loadSeed();
    try {
      const sb = await getClient();
      if (!sb) throw new Error("not configured");
      const [p, m] = await Promise.all([
        sb.from("profile").select("data").eq("id", 1).maybeSingle(),
        sb.from("media").select("*").order("sort_order"),
      ]);
      if (p.error || m.error) throw p.error || m.error;
      if (!m.data.length && !p.data) throw new Error("database empty");
      return { profile: { ...seed.profile, ...(p.data?.data || {}) }, media: m.data, source: "supabase" };
    } catch {
      return { profile: seed.profile, media: seed.media, source: "seed" };
    }
  }

  window.Data = { configured, CATEGORIES, esc, getClient, mediaUrl, loadSeed, loadSiteData, SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET };
})();
