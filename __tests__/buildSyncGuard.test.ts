import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// The guard script is pure bash + python3 (no project deps), so we can test it
// end-to-end against a throwaway app.config.ts in a temp dir.
const SCRIPT = join(__dirname, '..', 'scripts', 'check-build-sync.sh');

function runWithConfig(configBody: string): { output: string; exit: number } {
  const dir = mkdtempSync(join(tmpdir(), 'gustra-sync-'));
  const cfg = join(dir, 'app.config.ts');
  writeFileSync(cfg, configBody);
  try {
    const output = execFileSync('bash', [SCRIPT], {
      cwd: dir,
      env: { ...process.env, PATH: '/usr/bin:/bin:/usr/local/bin', GUSTRA_APP_CONFIG: cfg },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { output, exit: 0 };
  } catch (e: any) {
    return { output: (e.stdout ?? '') + (e.stderr ?? ''), exit: e.status ?? 1 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SYNCED = `export default () => ({
  ios: { buildNumber: '60' },
  android: { versionCode: 60 },
});`;

const DESYNCED = `export default () => ({
  ios: { buildNumber: '61' },
  android: { versionCode: 60 },
});`;

// Pull the numbers out of the fixture bodies so the assertion matches whatever
// value the guard echoes back (independent of the real repo build number).
function syncNumbers(configBody: string): { ios: string; android: string } {
  const ios = /buildNumber: '(\d+)'/.exec(configBody)?.[1] ?? '';
  const android = /versionCode: (\d+)/.exec(configBody)?.[1] ?? '';
  return { ios, android };
}

describe('check-build-sync guard', () => {
  it('passes when buildNumber === versionCode', () => {
    const { output, exit } = runWithConfig(SYNCED);
    const { ios } = syncNumbers(SYNCED);
    expect(exit).toBe(0);
    expect(output).toMatch(
      new RegExp(`Config in sync: ios\\.buildNumber = android\\.versionCode = ${ios}`),
    );
  });

  it('fails with a clear message when buildNumber !== versionCode', () => {
    const { output, exit } = runWithConfig(DESYNCED);
    const { ios, android } = syncNumbers(DESYNCED);
    expect(exit).not.toBe(0);
    expect(output).toMatch(
      new RegExp(
        `Config niet gesynchroniseerd: ios\\.buildNumber=${ios} maar android\\.versionCode=${android}`,
      ),
    );
  });
});
