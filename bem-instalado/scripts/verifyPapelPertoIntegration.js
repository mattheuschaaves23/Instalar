const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

const app = read('frontend/src/App.jsx');
const home = read('frontend/src/components/Public/Home.jsx');
const locationGlobe = read('frontend/src/components/Public/AnimatedLocationGlobe.jsx');
const landing = read('frontend/src/components/Public/ClientLandingLegacy.jsx');
const apiClient = read('frontend/src/services/api.jsx');
const publicRoutes = read('backend/routes/publicRoutes.js');
const publicController = read('backend/controllers/publicController.js');
const reverseGeocoder = read('backend/utils/reverseGeocode.js');

assert.match(app, /path="\/papelperto"/, 'A rota pública /papelperto precisa continuar disponível.');
assert.match(landing, /const REQUEST_PATH = '\/cliente';/, 'A landing deve enviar o cliente à área integrada de busca.');
assert.match(home, /const SHOW_PUBLIC_INSTALLER_DIRECTORY = true;/, 'A vitrine de instaladores não pode ficar desativada.');
assert.match(home, /api\.get\('\/public\/installers'/, 'O PapelPerto deve consultar instaladores no backend do Instalar+.');
assert.match(home, /await loadDirectory\(nextFilters\);/, 'A busca guiada deve recarregar profissionais da região informada.');
assert.match(home, /document\.getElementById\('resultados'\)/, 'Ao concluir o pedido, o cliente deve seguir para os resultados.');
assert.match(home, />\s*Encontrar instaladores\s*</, 'O pedido guiado deve terminar com a ação de encontrar profissionais.');
assert.match(home, /Responda quatro etapas rápidas/, 'O fluxo do cliente deve explicar que possui apenas quatro etapas.');
assert.doesNotMatch(home, /serviceIntroStep|detailStep/, 'O fluxo não deve voltar a criar subetapas que confundem o cliente.');
assert.match(home, /className="client-app-optional-details"/, 'Observações e fotos opcionais devem ficar recolhidas.');
assert.match(home, /className="client-app-clean-summary"/, 'A confirmação deve usar um resumo compacto e organizado.');
assert.match(home, /className="client-app-result-overview/, 'Após a busca, o cliente deve ver apenas um resumo curto do resultado.');
assert.match(home, /className="client-app-results-filters/, 'Filtros avançados devem ficar recolhidos após a busca.');
assert.match(home, /showPublishForm/, 'A publicação do pedido deve abrir somente quando o cliente solicitar.');
assert.doesNotMatch(home, /className="client-app-request-receipt/, 'O resumo do pedido não deve ser repetido após a busca.');
assert.doesNotMatch(home, /className="client-app-finder-intro/, 'A introdução dos resultados não deve duplicar informações já confirmadas.');
assert.match(home, /placeholder="Rua, bairro ou cidade"/, 'A localização deve usar o campo único do Pertolar.');
assert.match(home, /className="client-app-pertolar-locate"/, 'A localização deve oferecer o GPS como no Pertolar.');
assert.match(home, /navigator\.geolocation\.watchPosition/, 'O GPS deve aguardar a melhor leitura disponível.');
assert.match(home, /maximumAge: 0/, 'O GPS não deve reutilizar uma localização antiga.');
assert.match(home, /gpsRegionOnly: true/, 'O GPS deve confirmar apenas a região, sem inventar uma rua próxima.');
assert.match(home, /api\.get\('\/public\/location\/search'/, 'O endereço digitado deve consultar sugestões geográficas.');
assert.match(home, /<AnimatedLocationGlobe/, 'A localizacao deve exibir o globo animado do Pertolar.');
assert.match(locationGlobe, /geoOrthographic/, 'O globo deve usar uma projecao geografica real.');
assert.match(locationGlobe, /requestAnimationFrame/, 'O globo deve girar continuamente.');
assert.ok(
  home.indexOf('id="resultados"') < home.indexOf('id="publicar-pedido"'),
  'Os resultados precisam aparecer antes da publicação opcional do pedido.'
);
assert.match(publicRoutes, /router\.get\('\/installers'.*controller\.getInstallers\);/, 'A API pública de instaladores precisa estar registrada.');
assert.match(publicRoutes, /router\.get\('\/location\/search'.*controller\.searchLocation\);/, 'A API pública de endereços precisa estar registrada.');
assert.match(publicController, /forwardGeocode/, 'O backend deve transformar endereços em cidade e estado para a busca.');
assert.match(reverseGeocoder, /zoom: '14'/, 'A localização automática deve consultar nível de região, não uma rua aproximada.');
assert.match(publicController, /encontrei seu perfil no PapelPerto/, 'O contato público deve identificar a origem PapelPerto.');
assert.match(apiClient, /path\.startsWith\('\/papelperto'\)/, 'Sessões do cliente no PapelPerto devem usar o login correto.');

console.log('Integração PapelPerto + Instalar+ verificada.');
