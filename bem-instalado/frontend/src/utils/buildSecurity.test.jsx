import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cspHashes } from '@vitejs/plugin-legacy';

describe('publicação com política de segurança', () => {
  it('permite apenas os scripts inline conhecidos do compilador atual', () => {
    const config = JSON.parse(readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8'));
    const policy = config.headers.flatMap(item => item.headers).find(item => item.key === 'Content-Security-Policy').value;
    const scriptPolicy = policy.split(';').find(item => item.trim().startsWith('script-src '));
    for (const hash of cspHashes) expect(scriptPolicy).toContain(`'sha256-${hash}'`);
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
  });
  it('usa Tailwind 4 e limita a detecção de classes ao código do site', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toContain('@import "tailwindcss" source("./")');
    expect(css).not.toContain('@tailwind utilities');
    expect(css).toContain('--default-ring-width: 3px');
  });
});
