// Regressao: o app das lojas nao pode convidar a assinar o Pro (politica de pagamento das lojas).
// O storeAppPlanCopy.test.jsx renderiza uma lista fixa de telas; a tela de Orcamentos redesenhada
// em 3d8983c voltou a mostrar "Conhecer o Pro" fora dessa lista. Este teste varre todo o codigo:
// qualquer rotulo de convite ao Pro tem de passar por planLinkLabel (no app vira "Ver meu plano").
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');
const LABELS = ['Conhecer o Pro', 'Ver plano Pro', 'Seja Pro', 'Assinar o Pro', 'Assine o Pro'];

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('rotulos de convite ao Pro passam por planLinkLabel', () => {
  it('nenhum rotulo literal de convite ao Pro fora de planLinkLabel', () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        for (const label of LABELS) {
          const uses = line.split(label).length - 1;
          const wrapped = line.split(`planLinkLabel('${label}')`).length - 1;
          if (uses > wrapped) offenders.push(`${path.relative(SRC, file)}:${index + 1}: ${label}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('link de perfil para clientes (01c439e) no app das lojas', () => {
  it('nao manda ativar o plano no app; no site o texto segue igual', async () => {
    const { clientLinkPlanCopy } = await import('../components/Profile/ClientProfileLink');
    expect(clientLinkPlanCopy(true)).not.toMatch(/(assine|assinar|ative o|ativar|pelo site|pagamento)/i);
    expect(clientLinkPlanCopy(false)).toBe('Ative o plano para receber pedidos por um link direto, sem precisar publicar seu perfil.');
  });
});
