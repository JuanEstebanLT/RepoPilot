export function normalizeTopics(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}
