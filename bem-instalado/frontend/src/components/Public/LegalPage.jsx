import { Link } from 'react-router';
import BrandWordmark from '../Layout/BrandWordmark';
import PageMetadata from './PageMetadata';
import legalDocuments from '../../../../shared/legalDocuments.json';
import { useCanonicalLegalUrl } from '../../utils/canonicalLegalUrl';

const privacySections = [
  ['1. A quem esta política se aplica', 'Esta política abrange clientes, instaladores e visitantes do site instalarpro.com.br e os recursos da plataforma utilizados pelo aplicativo InstalarPro. Links antigos dos documentos legais são direcionados ao domínio atual. Serviços externos, como WhatsApp, Google e lojas parceiras, também têm suas próprias políticas.'],
  ['2. Dados que você informa', 'Tratamos nome, telefone, e-mail, cidade, estado e os dados necessários ao cadastro e ao pedido: rua ou referência, número e complemento quando informados, CEP, bairro, medidas, prazo, observações e fotos do ambiente. Para instaladores, há dados profissionais, perfil, portfólio, agenda, orçamentos, documentos e certificados enviados. O certificado é opcional para demonstrar interesse; os dados essenciais são nome, telefone, cidade, estado e e-mail confirmado. Não envie dados sensíveis, documentos de terceiros ou fotos com pessoas identificáveis sem necessidade e autorização adequada.'],
  ['3. Conta, suporte e assinatura', 'Quando você escolhe entrar com Google, recebemos os dados de identificação autorizados pelo provedor, como nome e e-mail; não recebemos sua senha do Google. Também tratamos mensagens de suporte, avaliações e dados dos serviços acompanhados. Na contratação de assinatura, dados cadastrais e de cobrança, inclusive CPF/CNPJ quando necessário, são encaminhados à Asaas. O pagamento ocorre no ambiente do provedor; não solicitamos a senha da sua conta bancária. Instaladores que cadastram clientes e orçamentos devem usar apenas dados necessários e possuir uma base legal para esse cadastro.'],
  ['4. Finalidades e bases legais', 'Usamos os dados necessários para criar contas, organizar pedidos, aproximar profissionais da região, apresentar propostas, agendar, prestar suporte e executar a relação contratual ou os procedimentos solicitados antes da contratação. Obrigações legais podem exigir registros específicos. Segurança, prevenção de fraude e defesa de direitos podem fundamentar tratamentos necessários, observados os direitos dos titulares e a legislação aplicável. Recursos opcionais, como localização do dispositivo, contato prévio por WhatsApp e notificações, dependem das escolhas e permissões informadas a você; quando a base legal for consentimento, ele pode ser revogado.'],
  ['5. Quem vê seu pedido e seu contato', 'Instaladores elegíveis podem ver serviço, medidas, prazo, observações, fotos e região do pedido, como bairro, cidade e estado. Evite incluir telefone, e-mail, documentos ou endereço completo nas fotos e observações, pois esses campos ficam visíveis aos profissionais elegíveis. O e-mail e o endereço completo ou referência são liberados ao instalador escolhido pelo cliente. Equipes autorizadas de operação e suporte podem acessar os dados necessários às suas funções.'],
  ['6. WhatsApp: autorização e envio manual', 'Ao publicar, você pode autorizar separadamente que instaladores interessados tenham acesso ao número informado para entrar em contato sobre o pedido. Sem essa autorização, o contato fica reservado ao profissional escolhido. Ao tocar em “Tenho interesse”, o instalador pode abrir o próprio WhatsApp com uma mensagem preenchida, suas informações e o link do perfil. A plataforma não envia a mensagem automaticamente: o instalador decide se a envia. Conversas realizadas no WhatsApp estão sujeitas às regras desse serviço e às ações dos participantes. Para revogar o contato prévio, solicite pelo canal de privacidade; a revogação não apaga mensagens nem informações já recebidas legitimamente por terceiros.'],
  ['7. Localização e mapas', '“Minha localização” pede permissão do navegador ou dispositivo. As coordenadas obtidas são enviadas à plataforma e ao serviço Photon, baseado em dados OpenStreetMap, para procurar a rua. A busca digitada pode consultar Photon, ViaCEP e BrasilAPI; o mapa incorporado é fornecido pelo OpenStreetMap. Esses serviços recebem os dados necessários à consulta e, em conexões diretas do seu navegador, dados técnicos da conexão. GPS e mapas podem ser imprecisos: confira e corrija o endereço antes de publicar. Você pode recusar a localização e informar o endereço manualmente, sem depender do mapa. A plataforma não precisa acompanhar sua localização continuamente em segundo plano para esse fluxo.'],
  ['8. Perfil e conteúdo profissional', 'Dados e conteúdos definidos para apresentação profissional, como nome de exibição, cidade, descrição, fotos, portfólio, avaliações e disponibilidade, podem ser vistos pelos clientes conforme as regras de publicação do perfil. Um cliente vinculado a um pedido também pode consultar o perfil do instalador que demonstrou interesse, mesmo quando ele não aparece na busca pública. Não publique no portfólio informações de clientes, imagens de imóveis ou documentos sem a autorização ou outra base legal necessária.'],
  ['9. Cookies, armazenamento local e notificações', 'Usamos cookies e recursos de armazenamento do navegador ou aplicativo para sessão, segurança, preferências de aparência e retomada de pedidos. O link ou código de acompanhamento permite acessar o pedido: não o divulgue publicamente. Bloquear ou apagar esse armazenamento pode encerrar sua sessão ou impedir a retomada local, sem apagar os dados mantidos na plataforma. Se você ativar notificações, tratamos os identificadores necessários do dispositivo ou da assinatura de notificação; você pode retirar a permissão nas configurações do navegador ou sistema.'],
  ['10. Fornecedores e dados técnicos', 'A operação utiliza Vercel para hospedagem e arquivos, Neon/PostgreSQL para banco de dados e provedores de e-mail para comunicações da conta e do serviço. Conforme a configuração e o recurso usado, Google, Asaas, Cloudflare Turnstile, Sentry, Better Stack e Firebase podem atuar em autenticação, cobrança, prevenção de abuso, diagnóstico, disponibilidade e notificações. Podem ser tratados IP, informações do navegador/dispositivo, horários, identificadores de conta e registros de falhas. Há medidas para reduzir dados pessoais em diagnósticos; evite incluir segredos ou documentos em relatos de erro. Alguns fornecedores podem processar dados fora do Brasil; essas operações estão sujeitas às regras de transferência internacional da LGPD e aos contratos aplicáveis. Você pode pedir informações sobre o compartilhamento pelo canal de privacidade.'],
  ['11. Conservação, exclusão e segurança', 'Conservamos dados enquanto necessários ao serviço, às finalidades informadas, ao cumprimento de obrigações legais ou à defesa de direitos. O vencimento de um pedido não significa sua exclusão imediata. A conta pode ser excluída nas Configurações; pessoas sem acesso podem solicitar pelo e-mail de privacidade, mediante confirmação proporcional de identidade. Antes da exclusão, assinaturas recorrentes precisam ser canceladas; uma falha nessa etapa pode impedir a conclusão até a regularização. Registros que precisem ser conservados por lei ou disputa podem permanecer pelo período necessário, inclusive nos provedores. Usamos controles de acesso, HTTPS e validações de segurança, mas nenhum serviço oferece garantia absoluta contra incidentes.'],
  ['12. Seus direitos e alterações desta política', 'Você pode solicitar confirmação e acesso, correção, informação sobre compartilhamento, anonimização, bloqueio ou eliminação de dados desnecessários ou irregulares, portabilidade nos termos da regulamentação e eliminação dos dados tratados com consentimento, ressalvadas as hipóteses legais de conservação. Pode revogar consentimento, conhecer as consequências de não fornecê-lo e apresentar oposição nas hipóteses legais. As solicitações são gratuitas e respondidas nos prazos aplicáveis; podemos pedir confirmação de identidade para proteger seus dados. Se não conseguir resolver com a plataforma, você pode procurar a Autoridade Nacional de Proteção de Dados (ANPD) e os órgãos competentes. Mudanças relevantes serão informadas pelos canais disponíveis, especialmente quando afetarem tratamentos sujeitos a consentimento. A versão atual fica indicada nesta página.'],
];

const termsSections = [
  ['1. Papel da plataforma', 'O InstalarPro aproxima clientes e profissionais independentes. A plataforma organiza pedidos e contatos, mas não executa a instalação nem é parte automática do contrato fechado entre cliente e instalador.'],
  ['2. Pedidos e propostas', 'O cliente deve revisar serviço, medidas, fotos e localização antes de publicar. Valores, materiais, prazo, garantia, deslocamento e forma de pagamento devem ser confirmados diretamente com o profissional escolhido.'],
  ['3. Perfis profissionais', 'Um perfil só pode aparecer publicamente após liberação administrativa. Selos de documento ou certificado indicam a análise realizada pela plataforma e não substituem a avaliação do cliente sobre experiência, orçamento e condições do serviço.'],
  ['4. Conduta e segurança', 'Não é permitido enviar informação falsa, assediar usuários, desviar pagamentos de forma fraudulenta, publicar conteúdo ilegal ou tentar acessar contas e dados de terceiros. Contas e pedidos podem ser suspensos para investigação.'],
  ['5. Responsabilidades', 'Cada parte responde pelas informações que fornece e pelos compromissos que assume. O profissional é responsável pela execução, segurança, tributos, licenças e garantia prometida; o cliente, pelo acesso ao local e pagamento combinado.'],
  ['6. Cancelamento e indisponibilidade', 'Pedidos podem ser encerrados pelo cliente ou pela plataforma em caso de abuso. Recursos podem ficar temporariamente indisponíveis para manutenção ou falhas de fornecedores, com esforço razoável para restabelecimento.'],
  ['7. Alterações e contato', 'Estes termos podem ser atualizados para refletir mudanças legais ou do produto. A versão e a data ficam registradas nesta página. Dúvidas e solicitações devem ser encaminhadas pelo suporte da plataforma.'],
  ['8. Cancelamento, reembolso e disputa', 'O cancelamento, eventual reembolso, visita improdutiva, atraso e garantia devem constar na proposta aceita pelo cliente antes do agendamento. Havendo divergência, cliente e instalador devem primeiro registrar a situação pelo suporte com fotos, conversas e comprovantes. A plataforma pode pausar a mediação, preservar evidências e restringir contas enquanto analisa abuso, sem substituir os direitos previstos em lei.'],
];

export default function LegalPage({ type }) {
  const isPrivacy = type === 'privacy';
  useCanonicalLegalUrl(isPrivacy ? '/privacidade' : '/termos');
  const sections = isPrivacy ? privacySections : termsSections;
  const title = isPrivacy ? 'Política de Privacidade e LGPD' : 'Termos de Uso';
  const intro = isPrivacy
    ? 'Esta política explica, de forma direta, como o InstalarPro trata dados de clientes e instaladores.'
    : 'Estas regras definem o uso do InstalarPro por clientes, instaladores e administradores.';
  const documentVersion = isPrivacy ? legalDocuments.privacy : legalDocuments.terms;

  return (
    <main className="legal-page">
      <PageMetadata title={`${isPrivacy ? 'Política de Privacidade' : 'Termos de Uso'} | InstalarPro`}
        description={intro} canonicalPath={isPrivacy ? '/privacidade' : '/termos'} />
      <header className="legal-page-header">
        <Link aria-label="InstalarPro - início" className="legal-page-brand" to="/">
          <BrandWordmark className="legal-page-wordmark" size="sm" />
        </Link>
        <Link className="legal-page-back" to="/">Voltar ao início</Link>
      </header>

      <article className="legal-page-card">
        <p className="legal-page-eyebrow">TRANSPARÊNCIA E SEGURANÇA</p>
        <h1>{title}</h1>
        <p className="legal-page-intro">{intro}</p>
        <p className="legal-page-version">Versão {documentVersion.version} · atualizada em {documentVersion.updatedAt}</p>
        {isPrivacy ? <>
          <p><strong>Responsável pelo tratamento:</strong> {legalDocuments.controller.name} · CNPJ {legalDocuments.controller.cnpj}.</p>
          <p>Site oficial: <a href={legalDocuments.publicOrigin}>instalarpro.com.br</a>.</p>
          <p className="legal-page-note">Nesta atualização: identificação da empresa, domínio oficial, endereço por GPS/CEP, envio manual pelo WhatsApp, fornecedores e formas de exercer seus direitos.</p>
        </> : null}

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
            <a href={`mailto:${legalDocuments.controller.email}`}>{legalDocuments.controller.email}</a>.
          </p>
        </aside>

        <nav className="legal-page-links" aria-label="Documentos legais">
          <Link to="/privacidade">Política de Privacidade</Link>
          <Link to="/termos">Termos de Uso</Link>
          <Link to="/excluir-conta">Excluir conta e dados</Link>
        </nav>
      </article>
    </main>
  );
}
