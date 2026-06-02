const http = require('http');

const payload = JSON.stringify({
  caseNumber: "0001111-22.2024.8.26.0100",
  rawPayload: "Disponibilizado no Diário Eletrônico em 04/04/2026. Intima-se a parte autora para se manifestar sobre a contestação no prazo de 15 dias úteis, sob pena de extinção do feito. Assinado digitalmente pelo Juiz de Direito."
});

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/webhooks/escavador',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, responseData));
});

req.on('error', (e) => console.error(`Problema com a requisição: ${e.message}`));
req.write(payload);
req.end();
