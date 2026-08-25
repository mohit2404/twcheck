# twcheck

[![npm version](https://img.shields.io/npm/v/twcheck.svg)](https://www.npmjs.com/package/twcheck)
[![CI](https://github.com/mohit2404/twcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/mohit2404/twcheck/actions/workflows/ci.yml)

Find and fix non-canonical Tailwind CSS classes using the same official Tailwind IntelliSense diagnostics used by VS Code.

## Usage

```bash
npx twcheck src
npx twcheck src --diff
npx twcheck src --fix
npx twcheck . --check
npx twcheck src --json
npx twcheck src --css src/styles/globals.css
```

The default mode is read-only. `--diff` previews exact replacements, `--fix` writes them, and `--check` returns exit code `1` when warnings are found. Runtime or configuration errors return exit code `2`.

twcheck runs Tailwind’s official language server, so it loads the project’s Tailwind CSS entrypoint, theme variables, plugins, and canonicalization behavior instead of maintaining a separate rule list.

V1 scans supported source files recursively, respects `.gitignore`, and skips generated folders including `node_modules`, `.next`, `dist`, `build`, `out`, and `coverage`.

## Options

`<path>` accepts a file, directory, or `.`. Available flags are `--diff`, `--fix`, `--check`, `--json`, `--css <file>`, `--help`, and `--version`.

## License

MIT

## Links

- [GitHub](https://github.com/mohit2404/twcheck)
- [npm](https://www.npmjs.com/package/twcheck)
