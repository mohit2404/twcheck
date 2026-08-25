#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { analyzeFiles } = require('./language-server');

const VERSION = '1.1.1';
const EXCLUDED = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo', '.cache']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html', '.vue', '.svelte']);
const ANSI = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };

function paint(value, color, enabled) { return enabled ? `${ANSI[color]}${value}${ANSI.reset}` : value; }
function help() { return `twcheck ${VERSION}\n\nFind and fix non-canonical Tailwind CSS classes using Tailwind IntelliSense diagnostics.\n\nUsage:\n  twcheck <path> [options]\n\nOptions:\n  --diff       Preview line-by-line changes without writing\n  --fix        Apply all fixes\n  --check      Check mode; exit 1 when warnings are found\n  --json       Print machine-readable results\n  --css <file> Tailwind CSS entrypoint override\n  --help       Show this help\n  --version    Show the version\n`; }
function parse(argv) { const o = { path: '.', diff: false, fix: false, check: false, json: false }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a === '--help' || a === '-h') o.help = true; else if (a === '--version' || a === '-v') o.version = true; else if (a === '--diff') o.diff = true; else if (a === '--fix') o.fix = true; else if (a === '--check') o.check = true; else if (a === '--json') o.json = true; else if (a === '--css') o.css = argv[++i]; else if (!a.startsWith('-')) o.path = a; else throw new Error(`Unknown option: ${a}`); } return o; }
function ignoredByGitignore(file, root) { const gi = path.join(root, '.gitignore'); if (!fs.existsSync(gi)) return false; return fs.readFileSync(gi, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')).some(pattern => { const p = pattern.replace(/^\//, '').replace(/\*/g, '.*'); return new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\.\*/g, '.*')}$`).test(path.relative(root, file).replace(/\\/g, '/')); }); }
function filesFor(input) { const absolute = path.resolve(input); if (!fs.existsSync(absolute)) throw new Error(`Path not found: ${input}`); const stat = fs.statSync(absolute); const root = stat.isDirectory() ? absolute : path.dirname(absolute); const out = []; function walk(p) { const current = fs.statSync(p); if (current.isDirectory()) { if (EXCLUDED.has(path.basename(p))) return; for (const entry of fs.readdirSync(p)) walk(path.join(p, entry)); } else if (EXTENSIONS.has(path.extname(p).toLowerCase()) && !ignoredByGitignore(p, root)) out.push(p); } walk(absolute); return { files: out, root }; }
function applyChanges(file, issues) { const source = fs.readFileSync(file, 'utf8'); let fixed = source; for (const issue of [...issues].sort((a, b) => b.start - a.start)) fixed = fixed.slice(0, issue.start) + issue.canonical + fixed.slice(issue.end); return { source, fixed }; }

async function main() {
  const o = parse(process.argv.slice(2));
  const colors = Boolean(process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb');
  if (o.help) { console.log(help()); return 0; }
  if (o.version) { console.log(VERSION); return 0; }
  const { files, root } = filesFor(o.path);
  const issues = await analyzeFiles(files, { cwd: process.cwd(), cssPath: o.css ? path.resolve(o.css) : null });
  const byFile = new Map();
  for (const issue of issues) { const absolute = path.resolve(root, issue.file); if (!byFile.has(absolute)) byFile.set(absolute, []); byFile.get(absolute).push(issue); }
  const changed = [];
  if (o.fix) for (const [file, fileIssues] of byFile) { const result = applyChanges(file, fileIssues); if (result.source !== result.fixed) { fs.writeFileSync(file, result.fixed); changed.push(file); } }
  const summary = { filesScanned: files.length, filesWithWarnings: byFile.size, warnings: issues.length, filesChanged: changed.length, issues: issues.map(x => ({ file: x.file, line: x.line, column: x.column, from: x.raw, to: x.canonical })) };
  if (o.json) console.log(JSON.stringify(summary, null, 2));
  else if (o.diff) for (const issue of issues) console.log(`${paint(`line ${issue.line}`, 'cyan', colors)}\n${paint(`- ${issue.raw}`, 'red', colors)}\n${paint(`+ ${issue.canonical}`, 'green', colors)}`);
  else { for (const issue of issues) console.log(`${paint(`${issue.file}:${issue.line}:${issue.column}`, 'cyan', colors)}  ${paint(issue.raw, 'yellow', colors)} ${paint('→', 'bold', colors)} ${paint(issue.canonical, 'green', colors)}`); console.log(issues.length ? `\n${paint(`Found ${issues.length} canonical warning${issues.length === 1 ? '' : 's'} in ${byFile.size} file${byFile.size === 1 ? '' : 's'}.`, 'yellow', colors)}${o.fix ? ` ${paint('Fixes applied.', 'green', colors)}` : ` ${paint('Run with --fix to apply.', 'cyan', colors)}`}` : paint(`No canonical warnings found in ${files.length} file${files.length === 1 ? '' : 's'}.`, 'green', colors)); }
  return o.check && issues.length ? 1 : 0;
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error(`twcheck: ${error.message}`); process.exitCode = 2; });
