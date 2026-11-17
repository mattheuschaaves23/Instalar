const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeListingOptions } = require('../services/opportunityListing');

test('listagem limita paginação e não aceita valores não finitos ou ordenação arbitrária', () => {
  const options = normalizeListingOptions({ limit: 'NaN', offset: '-1', status: 'outra', sort: 'DROP TABLE users' });
  assert.equal(options.limit, 60);
  assert.equal(options.offset, 0);
  assert.equal(options.status, 'open');
  assert.equal(options.sort, 'newest');
  assert.equal(normalizeListingOptions({ limit: '999999' }).limit, 100);
});
test('busca e filtros são normalizados sem alterar o significado de pesquisa literal', () => {
  const options = normalizeListingOptions({ status: 'interested', q: '  São José 100%  ', city: 'Palhoça', state: 'sc', photos: 'true' });
  assert.equal(options.status, 'interested');
  assert.equal(options.search, 'sao jose 100%');
  assert.equal(options.city, 'palhoca');
  assert.equal(options.state, 'sc');
  assert.equal(options.photos, true);
});
