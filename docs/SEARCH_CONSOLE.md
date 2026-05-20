# Google Search Console

1. Add property `https://seinfeld-trivia-navy.vercel.app` (or your custom domain).
2. Verify via DNS or HTML file upload in `public/`.
3. Submit sitemap: `https://seinfeld-trivia-navy.vercel.app/sitemap.xml`
4. After deploys, run **URL inspection** on:
   - `/daily-challenge.html`
   - `/season-4-trivia.html` (sample season)
   - `/episode-47-trivia.html` (sample episode)
5. Monitor queries containing “Seinfeld trivia”, episode titles, and “daily”.

Regenerate SEO landings when episode metadata changes:

```bash
npm run generate-seo
```
