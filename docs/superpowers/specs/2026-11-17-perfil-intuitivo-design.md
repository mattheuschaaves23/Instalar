# Perfil intuitivo do instalador

## Decisão aprovada
O menu Perfil abre a apresentação que o cliente conhece. O botão Editar perfil abre uma tela separada por etapas. Tutorial na primeira edição, com possibilidade de pular e rever. Checklist dos cinco requisitos já existentes: nome, telefone, cidade, estado e e-mail confirmado.

## Abordagens
Escolhida pelo usuário: apresentação e edição separadas por etapas. Alternativa considerada: janelas para cada seção; descartada para manter a edição consistente no celular.

## Limites
- Só frontend; preservar API, banco, autenticação, recuperação de senha e Turnstile do Augusto.
- Reutilizar a apresentação pública com uma prévia privada para o próprio instalador, inclusive antes de aprovação pública.
- Não publicar o perfil automaticamente nem expor e-mail, telefone, documento completo ou contatos privados na apresentação.
- Preservar uploads, certificado opcional, portfólio, disponibilidade, valores e configurações existentes.
- Etapas: Dados essenciais; Apresentação; Atendimento. Dados complementares não bloqueiam aceitar pedidos.
- Tutorial por conta neste dispositivo, pulável, acessível por teclado e disponível novamente no editor.
- Salvar somente os campos da etapa. Cancelar não persiste alterações; avisar antes de descartar.
- Claro/escuro, desktop e celular. Não fazer merge, deploy ou build de aplicativo nesta entrega sem autorização adicional.

## Domínio adicionado ao escopo
Verificar www.instalarpro.com.br na conta Vercel, registro e DNS antes de conectar. Nenhuma compra, cobrança, alteração de autenticação ou redirecionamento de produção sem comprovar propriedade e compatibilidade. Não depende da implementação do perfil.
