# RK Constructions: website

This is the one-page site for **R.K. Constructions** and its interiors arm, **The Interior Affairs**. It is built from the StudioAdsPro Digital Audit & Growth Plan (Oct 2026).

It is a static site written in plain HTML, CSS and JS modules, with Three.js bundled in `assets/vendor/`. There is no build step.

## What's on the page

- **3D "plot to possession" journey.** A stilt + 4 builder floor builds itself as you scroll, in five stages: plot, structure, walls, facade, and the handover at night. The crane works over the site and then leaves.
- **Interiors configurator.** A 3D room where visitors can switch the feature wall between fluted walnut, fluted oak, charcoal louvers and a PVC marble sheet, and set the LED cove ceiling to warm, cool or off.
- **Cost estimator.** Visitors enter plot size (gaj or sq ft), number of floors, stilt parking, finish level and locality. The page shows an indicative range and a prefilled WhatsApp quote request.
- **Lead capture everywhere.** The "Book free site visit" form, the estimator, the panel enquiry and the floating button all open WhatsApp with a prefilled message.
- Local SEO basics: GeneralContractor JSON-LD, locality list, meta description.
- Respects `prefers-reduced-motion` and falls back to static backgrounds when WebGL isn't available.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

ES modules need the page to be served over HTTP. Opening `index.html` straight from disk won't work.

## Deploy

Upload the folder as-is to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). The root `index.html` is the page.

## Edit before going live

All business settings live in the `CONFIG` object at the top of `assets/js/main.js`.

| What | Where | Note |
|---|---|---|
| WhatsApp number for leads | `CONFIG.whatsapp` | Currently `919717863476`. Confirm which line will be the WhatsApp Business number. |
| Per-sq-ft rates | `CONFIG.rates` | **Placeholders** within the Delhi market range in the audit (₹1,600–5,500/sq ft). Replace with RK's real rates. |
| Coverage & stilt factor | `CONFIG.coverage`, `CONFIG.stiltFactor` | Assumptions used by the estimator. |
| Domain | `index.html` (`canonical`, `og:url`, JSON-LD) | Uses `rkconstructions.in` as suggested in the audit. Update to the real domain. |
| Project photos | `#work` section | Blueprint-style placeholders. Swap in real site/handover photos. |
| Team roles | `#team` section | Confirm titles for Er. Abhishek Kumar and Ravinder Kumar. |
| Office address | `#areas` section | Only "Kalkaji" and "B-5 Local Shopping Centre" are known. Add full addresses once the Google Business Profiles exist. |

Also confirm the claims used in the copy: free site visit, weekly WhatsApp updates, approvals guidance. Add Google reviews and testimonials as soon as they're collected; the page deliberately doesn't invent any.

## Files

```
index.html
assets/css/style.css
assets/js/main.js            page logic, estimator, forms
assets/js/scene-build.js     3D construction journey
assets/js/scene-interior.js  3D interiors configurator
assets/vendor/three.module.min.js  (three.js r160, MIT)
```
