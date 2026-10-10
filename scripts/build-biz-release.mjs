import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIZ_ASSET_FILES, BIZ_ASSET_PREFIX } from '../server/biz-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [output, version, agent, machine] = process.argv.slice(2);
if (!output || !/^v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}$/.test(version || '') || !agent || !machine) {
  throw new Error('Usage: node scripts/build-biz-release.mjs <empty-output-dir> <version> <agent> <machine>');
}
const out = resolve(output);
if (out === root || out.startsWith(root + '/')) throw new Error('Output must be outside the checkout');
mkdirSync(out, {recursive:true});
if (readdirSync(out).length) throw new Error('Output directory must be empty');
const config = JSON.parse(readFileSync(join(root, 'deployment-biz.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
const revision = git('rev-parse', 'HEAD');
const archive = join(out, '.baseline.tar');
execFileSync('git', ['archive', '--output', archive, config.preservedRevision], {cwd:root});
execFileSync('tar', ['-xf', archive, '-C', out]);
unlinkSync(archive);

function stampTree(dir, versionText) {
  for (const entry of readdirSync(dir, {withFileTypes:true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) stampTree(path, versionText);
    else if (/\.html$/.test(entry.name) || path.includes('/mcp/')) {
      const text = readFileSync(path, 'utf8');
      if (text.includes('__ADMIRANEXT_VERSION__')) writeFileSync(path, text.replaceAll('__ADMIRANEXT_VERSION__', versionText));
    }
  }
}
stampTree(out, config.preservedVersion.version);
writeFileSync(join(out, 'version.json'), JSON.stringify(config.preservedVersion, null, 2) + '\n');
// ASSETS sees the internal pathname after the worker selects the biz release.
// Keep every existing baseline header and add its version cache rule for this path.
const headersPath = join(out, '_headers');
writeFileSync(headersPath, readFileSync(headersPath, 'utf8') + '\n' + BIZ_ASSET_PREFIX + '/version.json\n  Cache-Control: no-store\n');
copyFileSync(join(root, '_worker.js'), join(out, '_worker.js'));
copyFileSync(join(root, 'server/biz-assets.mjs'), join(out, 'server/biz-assets.mjs'));
const scoped = join(out, BIZ_ASSET_PREFIX.slice(1));
for (const file of BIZ_ASSET_FILES.filter(file => file !== 'version.json')) {
  mkdirSync(dirname(join(scoped, file)), {recursive:true});
  copyFileSync(join(root, file), join(scoped, file));
}
stampTree(scoped, version);
const release = {version, agent, deployer:agent, machine, signature:agent + ' · ' + machine,
  gitShort:revision.slice(0, 7), deployedAt:new Date().toISOString(), dirty:!!git('status', '--porcelain'),
  novedades:config.novedades, domains:['admira.biz', 'www.admira.biz'], preservedRevision:config.preservedRevision};
writeFileSync(join(scoped, 'version.json'), JSON.stringify(release, null, 2) + '\n');
console.log(JSON.stringify({output:out, version, revision, preservedRevision:config.preservedRevision, files:BIZ_ASSET_FILES.length}));
