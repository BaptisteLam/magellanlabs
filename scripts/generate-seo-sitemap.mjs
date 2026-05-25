#!/usr/bin/env node
/**
 * Generates public/sitemap.xml and public/sitemap-seo.xml from the SEO data files.
 * Run via: node scripts/generate-seo-sitemap.mjs
 *
 * Outputs:
 *   - public/sitemap-seo.xml: 3000 programmatic SEO URLs (chunked into sub-sitemaps to stay <50k each, here single file is fine)
 *   - public/sitemap.xml:     a sitemap index that references the static + SEO sitemaps
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const SITE_URL = process.env.SITE_URL || "https://magellanlabs.com";
const TODAY = new Date().toISOString().slice(0, 10);

// Parse TS files with a minimal regex extractor (we only need slugs)
function extractSlugs(filePath) {
  const src = readFileSync(filePath, "utf8");
  const slugs = [];
  const re = /slug:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) slugs.push(m[1]);
  return slugs;
}

const subjects = extractSlugs(resolve(ROOT, "src/data/seo/subjects.ts"));
const sectors = extractSlugs(resolve(ROOT, "src/data/seo/sectors.ts"));
const cities = extractSlugs(resolve(ROOT, "src/data/seo/cities.ts"));

const total = subjects.length * sectors.length * cities.length;
console.log(
  `[sitemap] ${subjects.length} subjects × ${sectors.length} sectors × ${cities.length} cities = ${total} pages`,
);

// --- SEO programmatic sitemap ---
const seoUrls = [];
seoUrls.push(`${SITE_URL}/creer`);
for (const subj of subjects) {
  for (const sect of sectors) {
    for (const city of cities) {
      seoUrls.push(`${SITE_URL}/creer/${subj}-pour-${sect}-${city}`);
    }
  }
}

function urlEntry(loc, priority = "0.6", changefreq = "monthly") {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const seoXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoUrls
  .map((u, i) =>
    urlEntry(u, i === 0 ? "0.8" : "0.6", i === 0 ? "weekly" : "monthly"),
  )
  .join("\n")}
</urlset>
`;

mkdirSync(resolve(ROOT, "public"), { recursive: true });
writeFileSync(resolve(ROOT, "public/sitemap-seo.xml"), seoXml);
console.log(`[sitemap] wrote public/sitemap-seo.xml (${seoUrls.length} urls)`);

// --- Static pages sitemap ---
const staticUrls = [
  { loc: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
  { loc: `${SITE_URL}/about`, priority: "0.7", changefreq: "monthly" },
  { loc: `${SITE_URL}/contact`, priority: "0.7", changefreq: "monthly" },
  { loc: `${SITE_URL}/privacy-policy`, priority: "0.3", changefreq: "yearly" },
  { loc: `${SITE_URL}/terms-of-service`, priority: "0.3", changefreq: "yearly" },
];
const staticXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map((u) => urlEntry(u.loc, u.priority, u.changefreq)).join("\n")}
</urlset>
`;
writeFileSync(resolve(ROOT, "public/sitemap-static.xml"), staticXml);
console.log(`[sitemap] wrote public/sitemap-static.xml (${staticUrls.length} urls)`);

// --- Sitemap index ---
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-static.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-seo.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>
`;
writeFileSync(resolve(ROOT, "public/sitemap.xml"), indexXml);
console.log(`[sitemap] wrote public/sitemap.xml (index)`);
