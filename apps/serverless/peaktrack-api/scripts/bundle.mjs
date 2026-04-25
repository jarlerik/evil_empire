// Bundle the Lambda entry into a single ESM file plus a minimal package.json
// so SAM can package the result as-is. This replaces SAM's built-in
// NodejsNpmEsbuildBuilder, which runs `npm install` against the source and
// chokes on pnpm's `workspace:*` protocol references.
//
// Output layout:
//   dist/
//     index.js          ← bundled entry (workspace deps inlined)
//     index.js.map      ← sourcemap (kept for CloudWatch traces)
//     package.json      ← { "type": "module" } so the Lambda runtime treats
//                          index.js as ESM under nodejs22.x
//
// SAM is configured (template.yaml) to use CodeUri: dist/ with no
// BuildMethod, so it just copies what we produce here.

import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distDir = resolve(pkgRoot, 'dist');

mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [resolve(pkgRoot, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: resolve(distDir, 'index.js'),
  sourcemap: true,
  banner: {
    // Some bundled deps (e.g., jose's CJS shims) reach for `require` —
    // legal in Node ESM only via createRequire. Cheap insurance even when
    // not strictly needed.
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
  // The Lambda runtime ships @aws-sdk/* — leaving it external keeps the
  // bundle small and avoids version drift with the platform-provided one.
  external: ['@aws-sdk/*'],
  logLevel: 'info',
});

// Minimal package.json for the Lambda artifact:
//   - "type": "module" so the runtime treats index.js as ESM under nodejs22.x
//   - name + version are required by SAM's NodejsNpmBuilder:NpmPack step
//     (npm pack rejects a manifest missing either field), even though the
//     bundle has no runtime deps to install.
writeFileSync(
  resolve(distDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'peaktrack-api-bundle',
      version: '0.0.0',
      type: 'module',
      main: 'index.js',
    },
    null,
    2,
  )}\n`,
);

console.log(`Bundle written to ${distDir}`);
