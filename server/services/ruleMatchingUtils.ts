
const WILDCARD_VALUES = new Set(['all', 'general', 'universal', 'any', '*', 'everything', 'all products', 'all territories', 'all channels']);

export function isWildcard(value: string): boolean {
  return WILDCARD_VALUES.has(value.toLowerCase().trim());
}

export function fuzzyContains(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  const h = haystack.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = needle.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h || !n) return false;
  if (h === n) return true;
  if (h.includes(n)) return true;
  if (n.includes(h)) return true;
  const hAlpha = h.replace(/[^a-z0-9]/g, '');
  const nAlpha = n.replace(/[^a-z0-9]/g, '');
  if (hAlpha === nAlpha) return true;
  if (hAlpha.includes(nAlpha) || nAlpha.includes(hAlpha)) return true;
  return false;
}

export function categoriesMatch(saleCategory: string, ruleCategory: string): boolean {
  if (!saleCategory || !ruleCategory) return false;
  const sc = saleCategory.toLowerCase().trim();
  const rc = ruleCategory.toLowerCase().trim();
  if (sc === rc) return true;
  if (sc.includes(rc) || rc.includes(sc)) return true;
  const scWords = sc.split(/\s+/);
  const rcWords = rc.split(/\s+/);
  const commonWords = scWords.filter(w => rcWords.includes(w) && w.length > 2);
  if (commonWords.length > 0 && commonWords.length >= Math.min(scWords.length, rcWords.length) * 0.5) {
    return true;
  }
  return false;
}

export interface SaleForMatching {
  productName: string;
  category?: string;
  territory?: string;
  channel?: string;
}

export interface RuleForMatching {
  id: string;
  ruleName?: string;
  ruleType?: string;
  baseRate?: string | null;
  productCategories?: string[];
  territories?: string[] | null;
  customerSegments?: string[] | null;
  channel?: string | null;
  priority?: number | null;
}

export interface QualifierData {
  inclusions: string[];
  exclusions: string[];
}

export function isContractLevelFixedFee(rule: RuleForMatching): boolean {
  if ((rule.ruleType || '').toLowerCase() !== 'fixed_fee') return false;
  const cats = rule.productCategories || [];
  if (cats.length === 0) return true;
  const realCats = cats.filter(c => !c.trim().startsWith('!'));
  return realCats.length === 0 || realCats.every(c => isWildcard(c));
}

export function buildMergedFilters(
  qualifiers: QualifierData | undefined,
  productCategories: string[]
): { inclusions: string[]; exclusions: string[] } {
  const exclusions: string[] = [];
  const inclusions: string[] = [];
  const seenExc = new Set<string>();
  const seenInc = new Set<string>();

  if (qualifiers) {
    for (const v of qualifiers.exclusions) {
      const lower = v.toLowerCase().trim();
      if (lower && !seenExc.has(lower)) {
        seenExc.add(lower);
        exclusions.push(lower);
      }
    }
    for (const v of qualifiers.inclusions) {
      const lower = v.toLowerCase().trim();
      if (lower && !seenInc.has(lower)) {
        seenInc.add(lower);
        inclusions.push(lower);
      }
    }
  }

  for (const cat of productCategories) {
    const trimmed = cat.trim();
    if (trimmed.startsWith('!')) {
      const lower = trimmed.substring(1).toLowerCase().trim();
      if (lower && !seenExc.has(lower)) {
        seenExc.add(lower);
        exclusions.push(lower);
      }
    } else {
      const lower = trimmed.toLowerCase().trim();
      if (lower && !seenInc.has(lower)) {
        seenInc.add(lower);
        inclusions.push(lower);
      }
    }
  }

  return { inclusions, exclusions };
}

export function territoryMatches(saleTerritory: string | undefined, ruleTerritories: string[] | null | undefined): boolean {
  if (!ruleTerritories || ruleTerritories.length === 0) return true;

  const hasWildcard = ruleTerritories.some(t => isWildcard(t));
  if (hasWildcard) return true;

  if (!saleTerritory || !saleTerritory.trim()) return true;

  const saleTerr = saleTerritory.toLowerCase().trim();

  const abstractTerritories = ['primary', 'secondary', 'tertiary', 'domestic', 'international', 'north', 'south', 'east', 'west'];
  const isAbstract = abstractTerritories.some(abs => saleTerr === abs);
  if (isAbstract) return true;

  return ruleTerritories.some(terr => {
    const ruleTerrLower = terr.toLowerCase().trim();
    if (isWildcard(ruleTerrLower)) return true;
    return saleTerr.includes(ruleTerrLower) || ruleTerrLower.includes(saleTerr);
  });
}

export function channelMatches(saleChannel: string | undefined, ruleChannel: string | null | undefined): boolean {
  if (!ruleChannel) return true;
  const ruleChannelLower = ruleChannel.toLowerCase().trim();
  if (!ruleChannelLower || isWildcard(ruleChannelLower)) return true;
  if (!saleChannel) return true;
  const saleChannelLower = saleChannel.toLowerCase().trim();
  if (!saleChannelLower) return true;

  const ruleChannels = ruleChannelLower.split(',').map(c => c.trim()).filter(c => c);
  return ruleChannels.some(rc => saleChannelLower.includes(rc) || rc.includes(saleChannelLower));
}

export function productMatchesSale(
  sale: SaleForMatching,
  mergedFilters: { inclusions: string[]; exclusions: string[] }
): boolean {
  const saleProductLower = (sale.productName || '').toLowerCase().trim();
  const saleCategoryLower = (sale.category || '').toLowerCase().trim();

  for (const exCat of mergedFilters.exclusions) {
    if (saleProductLower && fuzzyContains(saleProductLower, exCat)) return false;
    if (saleCategoryLower && fuzzyContains(saleCategoryLower, exCat)) return false;
  }

  if (mergedFilters.inclusions.length > 0) {
    const allWildcard = mergedFilters.inclusions.every(v => isWildcard(v));
    if (allWildcard) return true;

    return mergedFilters.inclusions.some(incLower => {
      if (isWildcard(incLower)) return true;
      if (saleProductLower && fuzzyContains(saleProductLower, incLower)) return true;
      if (saleCategoryLower && categoriesMatch(saleCategoryLower, incLower)) return true;
      return false;
    });
  }

  return true;
}

export function ruleMatchesSale(
  sale: SaleForMatching,
  rule: RuleForMatching,
  qualifiers?: QualifierData
): boolean {
  const mergedFilters = buildMergedFilters(qualifiers, rule.productCategories || []);

  if (!productMatchesSale(sale, mergedFilters)) return false;

  if (!territoryMatches(sale.territory, rule.territories as string[] | null)) return false;

  if (!channelMatches(sale.channel, rule.channel)) return false;

  return true;
}

export type MatchQuality = 'strict_exact' | 'contains' | 'category' | 'fallback';

export function getMatchQuality(sale: SaleForMatching, rule: RuleForMatching): MatchQuality {
  const saleProductLower = (sale.productName || '').toLowerCase().trim();
  const cats = (rule.productCategories || []).filter(c => !c.trim().startsWith('!'));

  if (cats.length === 0 || cats.every(c => isWildcard(c))) return 'fallback';

  for (const cat of cats) {
    const catLower = cat.toLowerCase().trim();
    if (isWildcard(catLower)) continue;
    if (saleProductLower === catLower) return 'strict_exact';
  }

  for (const cat of cats) {
    const catLower = cat.toLowerCase().trim();
    if (isWildcard(catLower)) continue;
    if (saleProductLower && fuzzyContains(saleProductLower, catLower)) return 'contains';
  }

  const saleCategoryLower = (sale.category || '').toLowerCase().trim();
  if (saleCategoryLower) {
    for (const cat of cats) {
      const catLower = cat.toLowerCase().trim();
      if (isWildcard(catLower)) continue;
      if (categoriesMatch(saleCategoryLower, catLower)) return 'category';
    }
  }

  return 'fallback';
}

const QUALITY_RANK: Record<MatchQuality, number> = {
  'strict_exact': 4,
  'contains': 3,
  'category': 2,
  'fallback': 1,
};

export function findBestMatchingRule(
  sale: SaleForMatching,
  rules: RuleForMatching[],
  qualifierMap: Map<string, QualifierData>
): RuleForMatching | null {
  const candidates: { rule: RuleForMatching; quality: MatchQuality; specificity: number }[] = [];

  for (const rule of rules) {
    const qualifiers = qualifierMap.get(rule.id);
    if (!ruleMatchesSale(sale, rule, qualifiers)) continue;

    const quality = getMatchQuality(sale, rule);
    const realCats = (rule.productCategories || []).filter(c => !c.trim().startsWith('!') && !isWildcard(c));
    const specificity = realCats.length > 0 ? 1000 / realCats.length : 0;

    candidates.push({ rule, quality, specificity });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const qualDiff = QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality];
    if (qualDiff !== 0) return qualDiff;
    const specDiff = b.specificity - a.specificity;
    if (specDiff !== 0) return specDiff;
    const priA = a.rule.priority ?? 999;
    const priB = b.rule.priority ?? 999;
    return priA - priB;
  });

  return candidates[0].rule;
}
