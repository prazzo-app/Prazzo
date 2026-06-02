require('dotenv').config();
const https = require('https');

// Testa diretamente a chamada ao GPT-4o-mini sem Redis
const movimentacao = "Disponibilizado no Diário Eletrônico em 04/04/2026. Intima-se a parte autora para se manifestar sobre a contestação no prazo de 15 dias úteis, sob pena de extinção do feito. Assinado digitalmente pelo Juiz de Direito da 3ª Vara Cível.";

const prompt = `Você é um secretário jurídico sênior altamente preventivo.
    Seu cliente acaba de receber uma movimentação oficial no processo.
    Traduza este juridiquês pesado a seguir em uma mensagem MÁXIMA de 2 frases objetivas.
    Formato OBRIGATÓRIO: Inicie com "Dr(a)., movimento novo no processo [Extraia/Invente Numero]."
    Se houver qualquer indício de Prazo, deixe o alerta EM *NEGRITO* dizendo a quantidade de dias para ele não perder!
    Mantenha tom conversacional de ZapZap.
    
    Movimentação Bruta:
    ${movimentacao}`;

const payload = JSON.stringify({
  model: "gpt-4o-mini",
  messages: [{ role: "system", content: prompt }]
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('\n[Prazzo QA] 🤖 Testando Motor de IA "Secretário de Ouro" diretamente...\n');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const mensagem = parsed.choices?.[0]?.message?.content;
    if (mensagem) {
      console.log('======================================================');
      console.log('[WhatsApp API] Disparando Notificação Premium Prazzo');
      console.log('======================================================');
      console.log('📦 Para: +5511999998888');
      console.log('⚖️  Processo: 0001111-22.2024.8.26.0100');
      console.log('\n💬 Mensagem gerada pelo GPT-4o-mini:\n');
      console.log(mensagem);
      console.log('======================================================\n');
    } else {
      console.error('Erro da API:', JSON.stringify(parsed, null, 2));
    }
  });
});

req.on('error', e => console.error('Erro de rede:', e.message));
req.write(payload);
req.end();
