// Sobe o app Express real em porta local e faz o preflight de CORS que o
// WebView manda antes do login. Imprime o resultado por origem em JSON.
const { app } = require('../../server');

const origins = process.argv.slice(2);
const server = app.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const result = {};
  try {
    for (const origin of origins) {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      result[origin] = { status: response.status, allowOrigin: response.headers.get('access-control-allow-origin') };
    }
    console.log(`CORS=${JSON.stringify(result)}`);
  } finally {
    server.close();
  }
});
