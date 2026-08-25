const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');

function lineOffset(source, line, character) {
  let offset = 0;
  for (let i = 0; i < line; i++) {
    const next = source.indexOf('\n', offset);
    offset = next === -1 ? source.length : next + 1;
  }
  return offset + character;
}

function frame(message) {
  const body = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function languageServerPath() {
  const packageJson = require.resolve('@tailwindcss/language-server/package.json');
  return path.join(path.dirname(packageJson), 'bin', 'tailwindcss-language-server');
}

function projectSettings(cssPath) {
  return {
    validate: true,
    lint: {
      cssConflict: 'warning',
      invalidApply: 'ignore',
      invalidScreen: 'ignore',
      invalidVariant: 'ignore',
      deprecatedAtRule: 'ignore',
      invalidConfigPath: 'ignore',
      invalidTailwindDirective: 'ignore',
      invalidSourceDirective: 'ignore',
      recommendedVariantOrder: 'ignore',
      usedBlocklistedClass: 'ignore',
      suggestCanonicalClasses: 'warning',
    },
    experimental: { configFile: cssPath || null },
    files: { exclude: [] },
  };
}

async function analyzeFiles(files, options = {}) {
  const root = path.resolve(options.cwd || process.cwd());
  const rootUri = pathToFileURL(root).href;
  const sources = new Map(files.map(file => [pathToFileURL(path.resolve(file)).href, fs.readFileSync(file, 'utf8')]));
  const server = spawn(process.execPath, [languageServerPath(), '--stdio'], { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  let initialized = false;
  let resolveReady;
  let rejectReady;
  const diagnostics = new Map();
  const seen = new Set();
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let idleTimer;
  const timeout = setTimeout(() => rejectReady(new Error('Tailwind language server timed out while loading the project')), 30000);

  function send(method, params) {
    const id = nextId++;
    server.stdin.write(frame({ jsonrpc: '2.0', id, method, params }));
    return id;
  }
  function respond(id, result) { server.stdin.write(frame({ jsonrpc: '2.0', id, result })); }
  function finishIfReady() {
    if (initialized && seen.size === sources.size) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { clearTimeout(timeout); resolveReady(); }, 250);
    }
  }
  function onMessage(message) {
    if (message.id && message.result && !initialized) {
      initialized = true;
      server.stdin.write(frame({ jsonrpc: '2.0', method: 'initialized', params: {} }));
      for (const [uri, source] of sources) server.stdin.write(frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'typescriptreact', version: 1, text: source } } }));
      if (sources.size === 0) finishIfReady();
      return;
    }
    if (message.method === 'workspace/configuration') {
      respond(message.id, message.params.items.map(() => projectSettings(options.cssPath)));
      return;
    }
    if (message.id && message.method) { respond(message.id, null); return; }
    if (message.method !== 'textDocument/publishDiagnostics') return;
    const uri = message.params.uri;
    if (!sources.has(uri)) return;
    const issues = message.params.diagnostics
      .filter(diagnostic => diagnostic.code === 'suggestCanonicalClasses' || diagnostic.code === 'cssConflict')
      .map(diagnostic => {
        const source = sources.get(uri);
        const start = lineOffset(source, diagnostic.range.start.line, diagnostic.range.start.character);
        const end = lineOffset(source, diagnostic.range.end.line, diagnostic.range.end.character);
        const relatedRanges = (diagnostic.relatedInformation || [])
          .map(item => item.location?.uri === uri ? item.location.range : null)
          .filter(Boolean)
          .map(range => ({ start: lineOffset(source, range.start.line, range.start.character), end: lineOffset(source, range.end.line, range.end.character) }));
        const conflictRanges = [{ start, end }, ...relatedRanges].sort((a, b) => a.start - b.start);
        const conflict = diagnostic.code === 'cssConflict';
        if (!conflict && !diagnostic.suggestions?.[0]) return null;
        return {
          type: conflict ? 'conflict' : 'canonical',
          file: path.relative(root, fileURLToPath(uri)),
          absoluteFile: fileURLToPath(uri),
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          raw: source.slice(start, end),
          canonical: conflict ? null : diagnostic.suggestions[0],
          message: conflict ? diagnostic.message : null,
          start,
          end,
          conflictStart: conflict ? conflictRanges[0].start : null,
          conflictEnd: conflict ? conflictRanges[0].end : null,
        };
      })
      .filter(Boolean);
    diagnostics.set(uri, issues);
    seen.add(uri);
    finishIfReady();
  }
  server.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const separator = buffer.indexOf(Buffer.from('\r\n\r\n'));
      if (separator < 0) break;
      const header = buffer.slice(0, separator).toString();
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) { buffer = buffer.slice(separator + 4); continue; }
      const length = Number(match[1]);
      if (buffer.length < separator + 4 + length) break;
      const body = buffer.slice(separator + 4, separator + 4 + length).toString();
      buffer = buffer.slice(separator + 4 + length);
      onMessage(JSON.parse(body));
    }
  });
  server.on('error', rejectReady);

  send('initialize', {
    processId: process.pid,
    rootUri,
    workspaceFolders: [{ uri: rootUri, name: path.basename(root) }],
    capabilities: {
      workspace: { configuration: true },
      textDocument: { publishDiagnostics: { relatedInformation: true, tagSupport: { valueSet: [2] } } },
    },
  });
  try { await ready; } finally {
    clearTimeout(timeout);
    if (!server.killed) server.kill();
    await new Promise(resolve => server.once('exit', resolve));
  }
  return [...diagnostics.values()].flat();
}

module.exports = { analyzeFiles };
