import { Link } from 'react-router';
import BrandWordmark from '../Layout/BrandWordmark';

const deletionSections = [
  [
    '1. Exclusão pelo aplicativo ou site',
    'Entre na conta de instalador, abra Configurações e encontre “Exclusão da conta”. Digite EXCLUIR e confirme. A remoção começa imediatamente e sua sessão é encerrada.',
  ],
  [
    '2. O que é removido',
    'Excluímos o acesso à conta, o perfil profissional, fotos e arquivos do perfil, agenda, clientes cadastrados, orçamentos, interesses, avaliações vinculadas e demais dados operacionais associados ao usuário.',
  ],
  [
    '3. Assinaturas e cobranças',
    'Antes da remoção da conta, cancelamos assinaturas recorrentes ativas na Asaas para impedir novas cobranças. Pagamentos já processados não são apagados automaticamente.',
  ],
  [
    '4. Dados que podem ser conservados',
    'Registros fiscais, financeiros, antifraude, de segurança ou necessários para cumprir obrigação legal e defender direitos podem ser mantidos pelo prazo exigido. Quando possível, esses dados ficam desvinculados do perfil público.',
  ],
  [
    '5. Se você não consegue entrar',
    'Envie a solicitação pelo e-mail cadastrado na conta. A equipe confirmará sua identidade antes de remover os dados para evitar que outra pessoa exclua sua conta sem autorização.',
  ],
];

export default function AccountDeletionPage() {
  return (
    <main className="legal-page">
      <header className="legal-page-header">
        <Link aria-label="InstalarPro - início" className="legal-page-brand" to="/">
          <BrandWordmark className="legal-page-wordmark" size="sm" />
        </Link>
        <Link className="legal-page-back" to="/">Voltar ao início</Link>
      </header>

      <article className="legal-page-card account-deletion-card">
        <p className="legal-page-eyebrow">CONTROLE DOS SEUS DADOS</p>
        <h1>Excluir conta e dados</h1>
        <p className="legal-page-intro">
          Você pode excluir definitivamente sua conta InstalarPro diretamente nas configurações.
        </p>
        <p className="legal-page-version">Processo atualizado em 27 de julho de 2026</p>

        <div className="account-deletion-actions">
          <Link className="gold-button" to="/settings">Entrar e excluir minha conta</Link>
          <a className="ghost-button" href="mailto:instalaproo@gmail.com?subject=Solicitação%20de%20exclusão%20de%20conta">
            Solicitar por e-mail
          </a>
        </div>

        <div className="legal-page-sections">
          {deletionSections.map(([title, body]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>

        <aside className="legal-page-note">
          <strong>Canal de privacidade</strong>
          <p>
            Se precisar de ajuda, escreva para{' '}
            <a href="mailto:instalaproo@gmail.com">instalaproo@gmail.com</a> usando o e-mail
            cadastrado na conta.
          </p>
        </aside>

        <nav className="legal-page-links" aria-label="Documentos legais">
          <Link to="/privacidade">Política de Privacidade</Link>
          <Link to="/termos">Termos de Uso</Link>
          <Link to="/">Página inicial</Link>
        </nav>
      </article>
    </main>
  );
}
