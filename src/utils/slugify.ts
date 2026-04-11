// ─────────────────────────────────────────────────────────────────────────────
// slugify
//
// Converts a company name into a URL-safe slug.
// Used for tenant URLs and database names.
//
// Examples:
//   "Academia Exemplo"         → "academia-exemplo"
//   "Arena Beach & Tennis SP!" → "arena-beach-tennis-sp"
//   "Çentro Ésportivo"         → "centro-esportivo"
// ─────────────────────────────────────────────────────────────────────────────
export const slugify = (text: string): string => {
  return text
    .toString()
    .normalize('NFD')                   // decomposes accents: "é" → "e" + combining accent
    .replace(/[\u0300-\u036f]/g, '')    // removes combining accent characters
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')      // removes special chars except spaces and hyphens
    .replace(/[\s]+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')               // multiple hyphens → single hyphen
    .replace(/^-|-$/g, '');            // trim leading/trailing hyphens
};

// ─────────────────────────────────────────────────────────────────────────────
// slugToDbName
//
// Converts a slug into a valid MySQL database name.
// MySQL identifiers: max 64 chars, only letters, digits and underscores.
//
// Example: "academia-exemplo" → "core_academia_exemplo"
// ─────────────────────────────────────────────────────────────────────────────
export const slugToDbName = (slug: string): string => {
  const sanitized = slug.replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
  return `core_${sanitized}`.substring(0, 64);
};