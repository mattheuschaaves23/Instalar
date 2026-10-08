const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

const app = read('frontend/src/App.jsx');
const home = read('frontend/src/components/Public/Home.jsx');
const requestStages = read('frontend/src/components/Public/RequestStages.jsx');
const locationMap = read('frontend/src/components/Public/RequestLocationMap.jsx');
const requestIcon = read('frontend/src/components/Public/RequestIcon.jsx');
const landing = read('frontend/src/components/Public/ClientLanding.jsx');
const adminDashboard = read('frontend/src/components/Admin/AdminDashboard.jsx');
const apiClient = read('frontend/src/services/api.jsx');
const adminRoutes = read('backend/routes/adminRoutes.js');
const publicRoutes = read('backend/routes/publicRoutes.js');
const publicController = read('backend/controllers/publicController.js');
const serviceRequestController = read('backend/controllers/serviceRequestController.js');
const opportunityRoutes = read('backend/routes/opportunityRoutes.js');
const reverseGeocoder = read('backend/utils/reverseGeocode.js');
const reverseStreetGeocoder = read('backend/utils/reverseStreetGeocode.js');
const requestGeolocation = read('frontend/src/utils/requestGeolocation.js');

assert.match(landing, /api\.get\('\/public\/recommended-stores'/, 'A landing deve carregar as lojas recomendadas pela API.');
assert.match(adminDashboard, /api\.post\('\/admin\/recommended-stores'/, 'O painel ADM deve permitir adicionar lojas ao carrossel.');
assert.match(adminDashboard, /api\.patch\(`\/admin\/recommended-stores\/\$\{editingStoreId\}`/, 'O painel ADM deve permitir editar lojas do carrossel.');
assert.match(adminRoutes, /router\.delete\('\/recommended-stores\/:id'/, 'O painel ADM deve permitir remover lojas do carrossel.');

assert.match(app, /path="\/papelperto"/, 'A rota pública /papelperto precisa continuar disponível.');
assert.match(landing, /const REQUEST_PATH = '\/cliente';/, 'A landing deve enviar o cliente à área integrada de busca.');
assert.match(home, /const SHOW_PUBLIC_INSTALLER_DIRECTORY = false;/, 'O cliente não deve escolher um instalador antes de publicar o pedido.');
assert.match(home, /api\.get\('\/public\/installers'/, 'O PapelPerto deve consultar instaladores no backend do InstalaPro.');
assert.match(home, /setShowPublishForm\(true\);/, 'A busca guiada deve seguir diretamente para a publicação do pedido.');
assert.match(home, /document\.getElementById\('publicar-pedido'\)/, 'Ao concluir os dados, o cliente deve seguir para a publicação.');
assert.match(home, />\s*Continuar para publicar\s*</, 'O pedido guiado deve terminar com a ação de publicar.');
const requestSteps = home.match(/const REQUEST_STEPS = \[([\s\S]*?)\];/)?.[1] || '';
assert.deepStrictEqual([...requestSteps.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
  ['Serviço', 'Detalhes', 'Localização', 'Confirmar'], 'O fluxo deve manter as quatro etapas aprovadas.');
assert.match(home, /Etapa \{requestStep \+ 1\} de \{REQUEST_STEPS\.length\}/, 'O cliente deve enxergar a etapa atual e o total de etapas.');
assert.doesNotMatch(home, /serviceIntroStep|detailStep/, 'O fluxo não deve voltar a criar subetapas que confundem o cliente.');
assert.match(home, /className="client-app-optional-details"/, 'Observações e fotos opcionais devem ficar recolhidas.');
assert.match(home, /<RequestReview/, 'A confirmação deve usar o componente de resumo compacto.');
assert.match(requestStages, /className="request-summary-grid"/, 'A confirmação deve usar um resumo compacto e organizado.');
assert.match(home, /className="client-app-result-overview/, 'Após preencher, o cliente deve ver um resumo curto do pedido.');
assert.match(home, /className="client-app-results-filters/, 'Filtros avançados devem ficar recolhidos após a busca.');
assert.match(home, /Publique para os instaladores da região/, 'A publicação deve explicar que os profissionais próximos receberão o pedido.');
assert.match(home, /Chamar este instalador/, 'O cliente deve escolher quem chamar somente entre os interessados.');
assert.doesNotMatch(home, /className="client-app-request-receipt/, 'O resumo do pedido não deve ser repetido após a busca.');
assert.doesNotMatch(home, /className="client-app-finder-intro/, 'A introdução dos resultados não deve duplicar informações já confirmadas.');
assert.match(home, /placeholder="CEP, rua, bairro ou cidade"/, 'A localização deve oferecer busca rápida por CEP.');
assert.match(home, /<RequestManualAddress/, 'Um endereço ausente no mapa deve poder ser preenchido manualmente.');
assert.match(home, /buildManualLocation\(manualAddress\)/, 'O endereço manual deve ser validado antes de avançar.');
assert.match(home, /className="request-locate-button"/, 'A localização deve continuar oferecendo o GPS.');
assert.match(requestGeolocation, /geolocation\.watchPosition/, 'O GPS deve aguardar a melhor leitura disponível.');
assert.match(requestGeolocation, /maximumAge: 0/, 'O GPS não deve reutilizar uma localização antiga.');
assert.match(home, /controller\.signal, 'address'/, 'Minha localização deve solicitar rua, e não só a região.');
assert.doesNotMatch(home, /gpsRegionOnly/, 'O formulário não deve descartar a rua encontrada pelo GPS.');
assert.match(home, /api\.get\('\/public\/location\/search'/, 'O endereço digitado deve consultar sugestões geográficas.');
assert.match(home, /<RequestLocationMap target=\{guidedLocationTarget\}/, 'A localização deve mostrar o mapa do endereço selecionado.');
assert.match(locationMap, /www\.openstreetmap\.org\/export\/embed\.html/, 'O mapa deve usar dados geográficos reais, não a imagem de exemplo.');
assert.match(locationMap, /marker: `\$\{latitude\},\$\{longitude\}`/, 'O mapa deve marcar as coordenadas selecionadas.');
assert.match(home, /ApprovedRequestIcon/, 'As etapas devem usar os ícones recortados do modelo aprovado.');
assert.match(requestIcon, /alt="" aria-hidden="true"/, 'Os ícones decorativos não devem interferir na leitura dos campos.');
assert.ok(
  home.indexOf('id="resultados"') < home.indexOf('id="publicar-pedido"'),
  'Os resultados precisam aparecer antes da publicação opcional do pedido.'
);
assert.match(publicRoutes, /router\.get\('\/installers'.*controller\.getInstallers\);/, 'A API pública de instaladores precisa estar registrada.');
assert.match(publicRoutes, /router\.get\('\/location\/search'.*controller\.searchLocation\);/, 'A API pública de endereços precisa estar registrada.');
assert.match(publicRoutes, /router\.post\('\/service-requests'/, 'A publicação pública de pedidos precisa estar registrada.');
assert.match(publicRoutes, /router\.get\('\/service-requests\/:id\/interests'/, 'O cliente precisa poder acompanhar interessados.');
assert.match(publicRoutes, /router\.post\('\/service-requests\/:id\/interests\/:interestId\/select'/, 'A escolha final precisa estar registrada.');
assert.match(opportunityRoutes, /router\.post\('\/:id\/interest'.*expressInterest\);/, 'Instaladores precisam poder demonstrar interesse.');
assert.match(publicController, /forwardGeocode/, 'O backend deve transformar endereços em cidade e estado para a busca.');
assert.match(reverseGeocoder, /detail === 'address'/, 'O backend deve separar consulta de região da consulta de endereço.');
assert.match(reverseStreetGeocoder, /\['house', 'street'\]/, 'O GPS deve buscar ruas e endereços próximos.');
assert.match(reverseStreetGeocoder, /houseNumber: ''/, 'O GPS não pode atribuir ao cliente o número de uma casa próxima.');
assert.doesNotMatch(publicController, /generateWhatsAppLink/, 'Perfis públicos não podem liberar contato direto.');
assert.match(serviceRequestController, /details: row\.details \|\| null/, 'A proposta deve mostrar os detalhes necessários ao instalador.');
assert.match(serviceRequestController, /photo_urls: row\.photo_urls \|\| \[\]/, 'A proposta deve mostrar as fotos do serviço.');
assert.match(serviceRequestController, /client_phone: selectedByMe \? row\.client_phone : null/, 'O telefone deve ficar privado até a escolha.');
assert.match(serviceRequestController, /INSTALLER_ALREADY_SELECTED/, 'A escolha final do cliente não pode ser trocada por outra chamada.');
assert.match(apiClient, /path\.startsWith\('\/papelperto'\)/, 'Sessões do cliente no PapelPerto devem usar o login correto.');

console.log('Integração PapelPerto + InstalaPro verificada.');
