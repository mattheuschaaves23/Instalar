import { readFileSync, writeFileSync } from 'node:fs';

// Capacitor's SPM generator preserves only the major iOS version. Restore
// the CSS engine minimum after every sync, including builds run by CI.
if (process.env.CAPACITOR_PLATFORM_NAME === 'ios') {
  const manifest = new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url);
  const source = readFileSync(manifest, 'utf8');
  const updated = source.replace(/platforms:\s*\[\.iOS\([^)]*\)\]/, 'platforms: [.iOS("16.4")]');
  if (source === updated && !source.includes('.iOS("16.4")')) throw new Error('Plataforma iOS ausente no manifesto SPM.');
  if (source !== updated) writeFileSync(manifest, updated);
}
