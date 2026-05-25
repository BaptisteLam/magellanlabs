import { SUBJECTS, SUBJECT_BY_SLUG, SeoSubject } from "./subjects";
import { SECTORS, SECTOR_BY_SLUG, SeoSector } from "./sectors";
import { CITIES, CITY_BY_SLUG, SeoCity } from "./cities";

export { SUBJECTS, SECTORS, CITIES };
export type { SeoSubject, SeoSector, SeoCity };

export const SEO_BASE_PATH = "/creer";

export interface SeoCombo {
  subject: SeoSubject;
  sector: SeoSector;
  city: SeoCity;
  slug: string;
  url: string;
}

export function buildSlug(
  subjectSlug: string,
  sectorSlug: string,
  citySlug: string,
): string {
  return `${subjectSlug}-pour-${sectorSlug}-${citySlug}`;
}

export function buildUrl(
  subjectSlug: string,
  sectorSlug: string,
  citySlug: string,
): string {
  return `${SEO_BASE_PATH}/${buildSlug(subjectSlug, sectorSlug, citySlug)}`;
}

export function resolveSeoCombo(slug: string): SeoCombo | null {
  // Greedy parse: subjectSlug + "-pour-" + sectorSlug + "-" + citySlug
  const marker = "-pour-";
  const idx = slug.indexOf(marker);
  if (idx < 0) return null;
  const subjectSlug = slug.slice(0, idx);
  const rest = slug.slice(idx + marker.length);
  const subject = SUBJECT_BY_SLUG.get(subjectSlug);
  if (!subject) return null;

  // Try each city slug as suffix
  for (const city of CITY_BY_SLUG.values()) {
    const suffix = `-${city.slug}`;
    if (rest.endsWith(suffix)) {
      const sectorSlug = rest.slice(0, rest.length - suffix.length);
      const sector = SECTOR_BY_SLUG.get(sectorSlug);
      if (sector) {
        return {
          subject,
          sector,
          city,
          slug,
          url: buildUrl(subject.slug, sector.slug, city.slug),
        };
      }
    }
  }
  return null;
}

export function* iterateCombos(): Generator<SeoCombo> {
  for (const subject of SUBJECTS) {
    for (const sector of SECTORS) {
      for (const city of CITIES) {
        yield {
          subject,
          sector,
          city,
          slug: buildSlug(subject.slug, sector.slug, city.slug),
          url: buildUrl(subject.slug, sector.slug, city.slug),
        };
      }
    }
  }
}

export function getAllCombos(): SeoCombo[] {
  return Array.from(iterateCombos());
}

export const TOTAL_COMBOS = SUBJECTS.length * SECTORS.length * CITIES.length;
