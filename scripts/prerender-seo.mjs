#!/usr/bin/env node
/**
 * Post-build prerender: writes a static HTML stub for each of the 3000 SEO URLs
 * into dist/creer/<slug>/index.html. Each stub clones dist/index.html and injects:
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical">
 *   - Open Graph / Twitter tags
 *   - JSON-LD structured data
 *   - A pre-rendered <h1> + intro inside #root (so crawlers see content even
 *     before JS runs; React rehydrates the page on top).
 *
 * This is what gives the SPA real SEO juice across the 3000 pages.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const SITE_URL = process.env.SITE_URL || "https://magellanlabs.com";

if (!existsSync(DIST)) {
  console.error("[prerender] dist/ not found — run `npm run build` first");
  process.exit(1);
}

const indexHtml = readFileSync(resolve(DIST, "index.html"), "utf8");

function parseObjects(filePath, fields) {
  // Naive parser that grabs each "{ ... }" object from a TS array, then extracts the requested fields by regex.
  const src = readFileSync(filePath, "utf8");
  // Anchor on `= [` to skip interface/type declarations that contain `string[]` etc.
  const arrayStart = src.search(/=\s*\[/);
  if (arrayStart < 0) throw new Error(`No array literal found in ${filePath}`);
  const openIdx = src.indexOf("[", arrayStart);
  const arr = src.slice(openIdx + 1, src.lastIndexOf("]"));
  const objs = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (arr[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const block = arr.slice(start, i + 1);
        const obj = {};
        for (const f of fields) {
          // string field
          const re = new RegExp(`${f}:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
          const m = block.match(re);
          if (m) obj[f] = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        }
        objs.push(obj);
        start = -1;
      }
    }
  }
  return objs;
}

const subjects = parseObjects(resolve(ROOT, "src/data/seo/subjects.ts"), [
  "slug", "label", "labelShort", "article", "description",
]);
const sectors = parseObjects(resolve(ROOT, "src/data/seo/sectors.ts"), [
  "slug", "label", "labelPlural", "noun",
]);
const cities = parseObjects(resolve(ROOT, "src/data/seo/cities.ts"), [
  "slug", "name", "region", "preposition",
]);

console.log(
  `[prerender] ${subjects.length} × ${sectors.length} × ${cities.length} = ${
    subjects.length * sectors.length * cities.length
  } pages`,
);

function escape(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inject(subject, sector, city) {
  const slug = `${subject.slug}-pour-${sector.slug}-${city.slug}`;
  const url = `${SITE_URL}/creer/${slug}`;
  const title = `Créer ${subject.article} ${subject.label} pour ${sector.label} ${city.preposition} ${city.name} | Magellan`;
  const description = `Créez ${subject.article} ${subject.label} professionnel pour votre ${sector.noun} ${city.preposition} ${city.name} en quelques minutes avec l'IA Magellan. Sans code, sans agence.`;
  const h1 = `Créer ${subject.article} ${subject.label} pour ${sector.label} ${city.preposition} ${city.name}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    name: title,
    description,
    inLanguage: "fr-FR",
  };

  let html = indexHtml;

  // Replace title
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escape(title)}</title>`);

  // Strip existing description / canonical / og / twitter / json-ld so we don't dupe
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, "");
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "");
  html = html.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");

  const headInject = `
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:site_name" content="Magellan" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`;
  html = html.replace(/<\/head>/i, headInject);

  // Inject a crawler-visible H1 + intro into #root (replaced by React on hydration)
  const intro = `Avec Magellan, créez ${subject.article} ${subject.label} pour votre ${sector.noun} ${city.preposition} ${city.name} en moins de 10 minutes grâce à l'IA.`;
  const bodyContent = `<div style="padding:2rem;max-width:900px;margin:0 auto;font-family:system-ui,sans-serif">
      <h1>${escape(h1)}</h1>
      <p>${escape(intro)}</p>
      <p><a href="/auth?mode=signup">Démarrer gratuitement</a></p>
    </div>`;
  html = html.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root">${bodyContent}</div>`,
  );

  return { slug, html };
}

let count = 0;
for (const subject of subjects) {
  for (const sector of sectors) {
    for (const city of cities) {
      const { slug, html } = inject(subject, sector, city);
      const outDir = resolve(DIST, "creer", slug);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "index.html"), html);
      count++;
    }
  }
  process.stdout.write(`\r[prerender] ${count} pages written`);
}
process.stdout.write("\n");
console.log(`[prerender] done: ${count} pages in dist/creer/`);
