<!-- 2026-11-04 — Setup, deploy and update guide for the swimming coach portfolio. -->
<!-- 2026-11-17 — Site opens by double-click now, real CV details, new photos/certificates/video, MP4-only video uploads. -->
# Coach Shahnawaz Khan — Swimming Coach Portfolio

Plain HTML + CSS + JavaScript website with an admin panel. Photos, videos and all text are managed from `/admin` and stored in **Supabase** (free plan). No build step, no framework.

- Public site: `index.html`
- Admin panel: `admin/index.html` (open `yoursite.com/admin/`)
- Works **without** Supabase too: if `js/config.js` is empty, the site shows the photos in `assets/seed/` and the text in `data/seed.js`.

## Folder structure

```
index.html            public website
admin/index.html      admin panel
css/style.css         website styles
css/admin.css         admin styles
js/config.js          Supabase URL + key (the only file you must edit)
js/data.js            data layer + seed fallback
js/site.js            renders all website sections
js/gallery.js         gallery tabs, lightbox
js/admin.js           admin panel logic
assets/seed/          photos, 18 certificate scans, 6 videos (WebP / MP4 H.264) + thumbnails
assets/og.jpg         social share image
data/seed.js          default text + photo list with categories and captions
supabase/schema.sql   database, storage bucket and security rules
```

## Try it locally

Just double-click `index.html` — the website, gallery and videos work without a server.

The admin panel needs Supabase and a web address, so test it with a local server:
```
cd shahnawaz-portfolio
python -m http.server 8080
```
Open http://localhost:8080/admin/ (or use the VS Code **Live Server** extension).

## Setup (one time, ~10 minutes)

Already ran the old `schema.sql`? Run the new one again — it is safe to re-run and adds the *Awards & Medals* and *Certificates* categories.

1. **Create a Supabase project** — https://supabase.com → New project (free plan). Pick the Mumbai (ap-south-1) region.
2. **Run the SQL** — open `supabase/schema.sql`, change `admin@example.com` on the last line to the admin's email, then in Supabase go to **SQL Editor → New query**, paste the whole file and click **Run**.
3. **Create the admin user** — **Authentication → Users → Add user → Create new user**: same email as step 2, set a strong password, tick **Auto Confirm User**.
4. **Turn off public sign-ups** — **Authentication → Sign In / Providers → Email**: disable *Allow new users to sign up*. (Even if someone signs up, they cannot edit anything because only emails in the `admins` table can write, but there is no reason to leave it open.)
5. **Paste your keys** — **Project Settings → API**: copy *Project URL* and the *anon public* key into `js/config.js`. The anon key is safe to be public; the security comes from the rules in `schema.sql`. Never put the `service_role` key in the website.
6. **Import the seed photos** — open `/admin`, log in, click **Import seed photos**. This adds all seed photos/videos/certificates and the default text to the database. (They stay served from `assets/seed/`, so they don't use your storage quota.)

## Deploy

**Netlify (easiest):** https://app.netlify.com → *Add new site → Deploy manually* → drag the whole project folder. Done.
**Vercel:** push the folder to a GitHub repo → https://vercel.com → *Add New Project* → import the repo → Framework preset: *Other* → Deploy.

**Custom domain:** in Netlify/Vercel → *Domain settings → Add domain* → add the DNS records they show at your domain registrar (GoDaddy, Hostinger, etc.). HTTPS is automatic.

After deploying, also update the `og:image` meta tag in `index.html` to the full URL (e.g. `https://yourdomain.com/assets/og.jpg`) so WhatsApp/Instagram link previews show the photo.

## Using the admin panel

- **Upload:** tap the upload box (works on phone) or drag files. Photos are compressed to WebP (max 1920 px) in the browser before upload. Videos must be **MP4** and under 50 MB (Supabase free limit). iPhone `.mov` files do not play in most browsers — convert them to MP4 (H.264) first, e.g. with HandBrake or `ffmpeg -i in.mov -c:v libx264 -crf 26 -c:a aac -movflags +faststart out.mp4`.
- **Edit:** caption, category, *Featured* (shows in the **Highlights** tab of the gallery), *Celebrity* + name (shows in the gold **Celebrity & Notable Moments** section — this section stays hidden until at least one photo is marked), replace file, delete.
- **Reorder:** drag cards (desktop) or use ↑ ↓ (phone). New uploads appear first.
- **Profile tab:** all website text, stats, programs, certifications, venues, testimonials, contact details, hero and about images. Saved changes are live immediately — no redeploy.

Text list format in the Profile tab (one item per line):
- Stats: `8 | + | Years Experience`
- Programs: `Kids Learn-to-Swim | Fun, safe and structured lessons…`
- Experience: `Swimming Coach | cult.fit, Gurgaon | May 2024 – Jul 2025 | details`
- Education: `B.Com. | Aligarh Muslim University | 2018`
- Testimonials: `Quote text | Name | Role`

## Still to fill in

Name, title, bio, experience, education, certifications, achievements, phone, WhatsApp and email are filled from the CV (Nov 2026). Still missing:

| Field | Now |
|---|---|
| Instagram | empty (hidden on the site) |
| Google Map | empty (shows the city) |
| Testimonials | empty (section hidden) — add real quotes from parents/members only |
| Celebrity photos | none marked — mark them in Admin → Media → Edit |
| Venues | from the CV + Ambience Public School photo; add hotels/other pools only if confirmed |

## Notes

- From the documents PDF only the 18 swimming certificates are used. PAN card, Aadhaar, marksheets and non-swimming certificates were left out on purpose.
- Selfies, car photos and personal pictures from the WhatsApp ZIPs were left out; one WhatsApp video was a duplicate of video-02.
- Three files from the first ZIP were left out on purpose: an Instagram story screenshot, a story-editor screenshot, and a WhatsApp chat screenshot showing a phone number.
- Captions and categories for the 65 seed items were written from what is visible in each photo — review them in the admin panel.
- Get consent from people (especially parents of children and any celebrities) before publishing their photos.
