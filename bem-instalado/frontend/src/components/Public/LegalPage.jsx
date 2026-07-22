import { Link } from 'react-router-dom';
import BrandWordmark from '../Layout/BrandWordmark';

const UPDATED_AT = '22 de julho de 2026';

const privacySections = [
  ['1. Quais dados usamos', 'Coletamos os dados informados no cadastro e no pedido, como nome, telefone, e-mail, cidade, endereço aproximado ou completo, fotos do ambiente e preferências do serviço. Para instaladores, também tratamos dados profissionais, documentos de verificação, certificado e portfólio.'],
  ['2. Por que usamos esses dados', 'Usamos os dados para criar e acompanhar pedidos, indicar profissionais da região, permitir contato após a escolha, verificar perfis, prevenir fraude, prestar suporte e manter a segurança da plataforma.'],
  ['3. Compartilhamento', 'As informações necessárias do pedido são exibidas a instaladores elegíveis. Telefone e demais formas de contato são liberados conforme o fluxo de interesse e escolha. Também podemos usar provedores de hospedagem, banco de dados, e-mail e armazenamento, limitados à operação do serviço.'],
  ['4. Localização', 'A localização do navegador é usada somente com sua permissão. Como o GPS pode variar, mostramos o endereço encontrado para você revisar e corrigir antes de publicar. A busca por cidade também pode ser preenchida manualmente.'],
  ['5. Armazenamento e segurança', 'Pedidos, contas e registros de segurança são mantidos em banco de dados protegido. Identificadores de acompanhamento ficam no navegador para você retomar o pedido. Fotos e certificados usam armazenamento próprio de arquivos, com limites de formato e tamanho.'],
  ['6. Prazo e exclusão', 'Mantemos os dados pelo período necessário para prestar o serviço, cumprir obrigações legais e tratar disputas. Você pode solicitar correção, acesso, portabilidade, oposição ou exclusão, quando aplicável.'],
  ['7. Seus direitos pela LGPD', 'Você pode confirmar o tratamento, acessar e corrigir dados, pedir anonimização ou exclusão de dados desnecessários e revogar consentimentos. Para exercer esses direitos, use o suporte da plataforma ou o canal informado na sua conta.'],
];

const termsSections = [
  ['1. Papel da plataforma', 'O InstalaPro aproxima clientes e profissionais independentes. A plataforma organiza pedidos e contatos, mas não executa a instalação nem é parte automática do contrato fechado entre cliente e instalador.'],
  ['2. Pedidos e propostas', 'O cliente deve revisar serviço, medidas, fotos e localização antes de publicar. Valores, materiais, prazo, garantia, deslocamento e forma de pagamento devem ser confirmados diretamente com o profissional escolhido.'],
  ['3. Perfis profissionais', 'Um perfil só pode aparecer publicamente após liberação administrativa. Selos de documento ou certificado indicam a análise realizada pela plataforma e não substituem a avaliação do cliente sobre experiência, orçamento e condições do serviço.'],
  ['4. Conduta e segurança', 'Não é permitido enviar informação falsa, assediar usuários, desviar pagamentos de forma fraudulenta, publicar conteúdo ilegal ou tentar acessar contas e dados de terceiros. Contas e pedidos podem ser suspensos para investigação.'],
  ['5. Responsabilidades', 'Cada parte responde pelas informações que fornece e pelos compromissos que assume. O profissional é responsável pela execução, segurança, tributos, licenças e garantia prometida; o cliente, pelo acesso ao local e pagamento combinado.'],
  ['6. Cancelamento e indisponibilidade', 'Pedidos podem ser encerrados pelo cliente ou pela plataforma em caso de abuso. Recursos podem ficar temporariamente indisponíveis para manutenção ou falhas de fornecedores, com esforço razoável para restabelecimento.'],
  ['7. Alterações e contato', 'Estes termos podem ser atualizados para refletir mudanças legais ou do produto. A versão e a data ficam registradas nesta página. Dúvidas e solicitações devem ser encaminhadas pelo suporte da plataforma.'],
];

export default function LegalPage({ type }) {
  const isPrivacy = type === 'privacy';
  const sections = isPrivacy ? privacySections : termsSections;
  const title = isPrivacy ? 'Política de Privacidade e LGPD' : 'Termos de Uso';
  const intro = isPrivacy
    ? 'Esta política explica, de forma direta, como o InstalaPro trata dados de clientes e instaladores.'
    : 'Estas regras definem o uso do InstalaPro por clientes, instaladores e administradores.';

  return (
    <main className="legal-page">
      <header className="legal-page-header">
        <Link aria-label="InstalaPro - inicio" className="legal-page-brand" to="/">
          <BrandWordmark className="legal-page-wordmark" size="sm" />
        </Link>
        <Link className="legal-page-back" to="/">Voltar ao início</Link>
      </header>

      <article className="legal-page-card">
        <p className="legal-page-eyebrow">TRANSPARÊNCIA E SEGURANÇA</p>
        <h1>{title}</h1>
        <p className="legal-page-intro">{intro}</p>
        <p className="legal-page-version">Versão 2026-07-22 · atualizada em {UPDATED_AT}</p>

        <div className="legal-page-sections">
          {sections.map(([sectionTitle, body]) => (
            <section key={sectionTitle}>
              <h2>{sectionTitle}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>

        <aside className="legal-page-note">
          <strong>Precisa falar sobre seus dados?</strong>
          <p>
            Instaladores podem usar a área de suporte. Clientes e pessoas sem acesso podem escrever para{' '}
            <a href="mailto:beminstaladohd@gmail.com">beminstaladohd@gmail.com</a>.
          </p>
        </aside>

        <nav className="legal-page-links" aria-label="Documentos legais">
          <Link to="/privacidade">Política de Privacidade</Link>
          <Link to="/termos">Termos de Uso</Link>
        </nav>
      </article>
    </main>
  );
}
