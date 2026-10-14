import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist/server/wrangler.json');
let built;
try { built = JSON.parse(await readFile(output, 'utf8')); }
catch { console.error('Run npm run build before applying local database migrations.'); process.exit(1); }
if (!built.d1_databases?.length) throw new Error('Build has no database binding.');
const config = { name: 'open-job-tracker-migrations', compatibility_date: '2026-05-01', d1_databases: built.d1_databases.map(db => ({...db, migrations_dir: resolve(root, 'drizzle')})) };
const directory = resolve(root, '.private/migrations');
await mkdir(directory, { recursive: true, mode: 0o700 });
const configPath = resolve(directory, 'wrangler.json');
await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
const result = spawnSync(process.execPath, ['--import', resolve(root, 'scripts/sites-env.mjs'), resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'migrations', 'apply', 'DB', '--local', '--config', configPath, '--persist-to', resolve(root, '.wrangler/state')], { cwd: root, env: {...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false'}, stdio: 'inherit' });
process.exit(result.status ?? 1);
