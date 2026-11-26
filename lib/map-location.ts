const mapHosts = new Set(['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl']);

/** Accept only shareable Google Maps URLs; reject arbitrary or unsafe link targets. */
export function parseMapLocation(value: unknown): string | null | false {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > 1000) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !mapHosts.has(url.hostname.toLowerCase()) || url.username || url.password) return false;
    return url.toString();
  } catch {
    return false;
  }
}

export function mapCoordinates(value: string) {
  const normalized = parseMapLocation(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const pin = url.pathname.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/)
    ?? (url.searchParams.get('q') ?? url.searchParams.get('query'))?.match(/^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/)
    ?? url.pathname.match(/^\/maps\/@(-?[\d.]+),(-?[\d.]+)(?:,|$)/);
  if (!pin) return null;
  const latitude = Number(pin[1]), longitude = Number(pin[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
