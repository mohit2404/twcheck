const assert = require('assert');
const { canonicalizeCandidate, fixSource } = require('../dist');
assert.equal(canonicalizeCandidate('gap-[18px]'), 'gap-4.5');
assert.equal(canonicalizeCandidate('hover:bg-[var(--brand)]'), 'hover:bg-(--brand)');
const result = fixSource('<div className="gap-[18px]" />');
assert.equal(result.source, '<div className="gap-4.5" />');
assert.equal(result.changes[0].line, 1);
console.log('twcheck smoke tests passed');
