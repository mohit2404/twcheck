const PX_UTILITIES = /^(?:(-))?([a-z][a-z0-9-]*-)?\[(\-?\d+(?:\.\d+)?)px\]$/i;

function pxToTailwind(value) {
  const n = Number(value);
  const scaled = n / 4;
  return Number.isInteger(scaled) ? String(scaled) : String(Number(scaled.toFixed(4)));
}

function canonicalizeCandidate(candidate) {
  if (!candidate || /[{}$`]/.test(candidate)) return candidate;
  const variants = candidate.split(':');
  let utility = variants.pop();
  let negative = false;
  if (utility.startsWith('-')) { negative = true; utility = utility.slice(1); }

  // Tailwind v4 canonical shorthand for CSS custom properties.
  utility = utility.replace(/(.*)-\[var\((--[^\]]+)\)\]$/, '$1-($2)');
  utility = utility.replace(/(.*)-\[var\((--[^\]]+),([^\]]+)\)\]$/, '$1-($2,$3)');
  // Arbitrary property canonicalization.
  if (/^\[overflow-wrap:anywhere\]$/.test(utility)) utility = 'wrap-anywhere';

  const match = utility.match(PX_UTILITIES);
  if (match) {
    const [, sign, prefix, value] = match;
    if (prefix) utility = `${prefix}${pxToTailwind(value)}`;
    else utility = `[${value}px]`;
    if (prefix) negative = negative || Boolean(sign);
  }
  return [...variants, `${negative ? '-' : ''}${utility}`].filter(Boolean).join(':');
}

function scanCandidates(source) {
  const result = [];
  const re = /(?:[!\w@\-\[\]().,/%:#]+(?::[\w@\-\[\]().,/%#]+)*)/g;
  let m;
  while ((m = re.exec(source))) {
    const raw = m[0];
    if (!raw.includes('[') || raw.includes('=') || raw.length < 3) continue;
    const canonical = canonicalizeCandidate(raw);
    if (canonical !== raw && !result.some(x => x.start === m.index)) result.push({ raw, canonical, start: m.index, end: m.index + raw.length });
  }
  return result;
}

function lineColumn(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - (before.lastIndexOf('\n') + 1) + 1;
  return { line, column };
}

function fixSource(source, filename = '') {
  const changes = scanCandidates(source).map(x => ({ ...x, ...lineColumn(source, x.start), file: filename }));
  let fixed = source;
  for (const change of [...changes].sort((a, b) => b.start - a.start)) fixed = fixed.slice(0, change.start) + change.canonical + fixed.slice(change.end);
  return { source: fixed, changes };
}

module.exports = { canonicalizeCandidate, fixSource, scanCandidates };
