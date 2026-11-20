import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { appBuildEnvErrors } from './appBuildEnv.mjs';

const FRONTEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const VITE_CONFIG_URL = new URL('../vite.config.mjs', import.meta.url).href;
const SITE_KEY = '0x4AAAAAAAexemploPublico';

// Carrega o vite.config.mjs de verdade num processo separado, com uma pasta de
// trabalho que só tem os .env versionados do app (sem .env.*.local da máquina).
function loadViteConfig(mode, extraEnv = {}, extraFiles = {}, command = 'build') {
  const cwd = mkdtempSync(join(tmpdir(), 'instalapro-app-env-'));
  try {
    for (const file of ['.env.android', '.env.ios']) copyFileSync(join(FRONTEND_DIR, file), join(cwd, file));
    for (const [name, content] of Object.entries(extraFiles)) writeFileSync(join(cwd, name), content);
    const env = { ...process.env, ...extraEnv };
    if (!('REACT_APP_TURNSTILE_SITE_KEY' in extraEnv)) delete env.REACT_APP_TURNSTILE_SITE_KEY;
    const script = `const { default: config } = await import(process.argv[1]);
const result = config({ mode: process.argv[2], command: process.argv[3] });
console.log('ENV=' + result.define['process.env']);`;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script, VITE_CONFIG_URL, mode, command], {
      cwd, env, encoding: 'utf8', timeout: 30000,
    });
    const line = run.stdout.split('\n').find((item) => item.startsWith('ENV='));
    return { status: run.status, stderr: run.stderr, define: line ? JSON.parse(line.slice(4)) : null };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('variáveis obrigatórias do build do aplicativo', () => {
  it('exige a chave de site do Turnstile só nos modos do aplicativo', () => {
    expect(appBuildEnvErrors('android', {})[0]).toMatch(/REACT_APP_TURNSTILE_SITE_KEY ausente/);
    expect(appBuildEnvErrors('ios', { REACT_APP_TURNSTILE_SITE_KEY: '   ' })).toHaveLength(1);
    expect(appBuildEnvErrors('production', {})).toEqual([]);
    expect(appBuildEnvErrors('android', { REACT_APP_TURNSTILE_SITE_KEY: SITE_KEY })).toEqual([]);
  });

  it('recusa chave de teste da Cloudflare no aplicativo', () => {
    expect(appBuildEnvErrors('android', { REACT_APP_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' })[0]).toMatch(/chave de teste/);
    expect(appBuildEnvErrors('ios', { REACT_APP_TURNSTILE_SITE_KEY: '3x00000000000000000000FF' })).toHaveLength(1);
  });

  it('build Android e iOS sem a chave para com erro claro', () => {
    for (const mode of ['android', 'ios']) {
      const result = loadViteConfig(mode);
      expect(result.status, `modo ${mode} deveria falhar`).not.toBe(0);
      expect(result.stderr).toMatch(/Build do aplicativo \((android|ios)\) interrompido/);
      expect(result.stderr).toMatch(/REACT_APP_TURNSTILE_SITE_KEY ausente/);
    }
  }, 60000);

  it('build Android leva a chave vinda da variável de ambiente (GitHub Actions)', () => {
    const result = loadViteConfig('android', { REACT_APP_TURNSTILE_SITE_KEY: SITE_KEY });
    expect(result.status, result.stderr).toBe(0);
    expect(result.define.REACT_APP_TURNSTILE_SITE_KEY).toBe(SITE_KEY);
    expect(result.define.REACT_APP_INSTALLER_APP).toBe('true');
  }, 30000);

  it('build iOS leva a chave vinda de .env.ios.local (máquina do desenvolvedor)', () => {
    const result = loadViteConfig('ios', {}, { '.env.ios.local': `REACT_APP_TURNSTILE_SITE_KEY=${SITE_KEY}\n` });
    expect(result.status, result.stderr).toBe(0);
    expect(result.define.REACT_APP_TURNSTILE_SITE_KEY).toBe(SITE_KEY);
  }, 30000);

  it('vite dev do aplicativo na máquina local sobe sem a chave', () => {
    const result = loadViteConfig('android', {}, {}, 'serve');
    expect(result.status, result.stderr).toBe(0);
  }, 30000);

  it('build do site continua sem exigir a chave', () => {
    const result = loadViteConfig('production');
    expect(result.status, result.stderr).toBe(0);
  }, 30000);

  it('workflows do Android e do iOS passam a chave ao build web do aplicativo', () => {
    for (const [file, script] of [['android.yml', 'build:android:web'], ['ios.yml', 'build:ios:web']]) {
      const workflow = parse(readFileSync(new URL(`../../../.github/workflows/${file}`, import.meta.url), 'utf8'));
      const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
      const build = steps.find((step) => String(step.run || '').includes(script));
      expect(build?.env?.REACT_APP_TURNSTILE_SITE_KEY, file).toBe('${{ vars.REACT_APP_TURNSTILE_SITE_KEY }}');
    }
  });
});
