const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { canonicalizeCandidate, fixSource } = require('../dist');
const { analyzeFiles } = require('../dist/language-server');
assert.equal(canonicalizeCandidate('gap-[18px]'), 'gap-4.5');
assert.equal(canonicalizeCandidate('hover:bg-[var(--brand)]'), 'hover:bg-(--brand)');
assert.equal(canonicalizeCandidate('bg-(--background)'), 'bg-background');
assert.equal(canonicalizeCandidate('text-(--primary)'), 'text-primary');
assert.equal(canonicalizeCandidate('hover:bg-(--accent)'), 'hover:bg-accent');
const result = fixSource('<div className="gap-[18px]" />');
assert.equal(result.source, '<div className="gap-4.5" />');
assert.equal(result.changes[0].line, 1);
console.log('twcheck smoke tests passed');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'twcheck-'));
  const css = path.join(root, 'app.css');
  const file = path.join(root, 'page.tsx');
  fs.writeFileSync(css, '@import "tailwindcss"; @theme inline { --color-primary: var(--primary); }');
  fs.writeFileSync(file, '<div className="text-(--primary) gap-[18px]" />');
  const issues = await analyzeFiles([file], { cwd: root, cssPath: css });
  assert.deepEqual(issues.map(issue => issue.canonical), ['text-primary', 'gap-4.5']);
  fs.rmSync(root, { recursive: true, force: true });
  console.log('official Tailwind diagnostic test passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
