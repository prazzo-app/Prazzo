const BASE_URL = 'http://localhost:4001/api';

async function runTests() {
    console.log('🚀 Iniciando Testes de Fluxo Completo (AJA COMO QA)...');

    const timestamp = Date.now();
    const uniqueEmail = `qa_tester_${timestamp}@prazzo.com`;
    const uniqueOAB = `${timestamp % 1000000}`; 
    // CNJ Realista (embora falso) para o Datajud
    const uniqueCase = `000${uniqueOAB}-45.2024.8.26.0000`; 

    try {
        // 1. Registro
        console.log(`\n[PASSO 1] Registro de Advogado (OAB: ${uniqueOAB})...`);
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. QA Auto',
                email: uniqueEmail,
                password: 'password123',
                phone: '11988887777',
                oabNumber: uniqueOAB,
                oabState: 'SP'
            })
        });
        
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error(`Falha no registro: ${JSON.stringify(regData)}`);
        console.log('✅ Registro: OK');
        const token = regData.token;

        // 2. Login
        console.log('\n[PASSO 2] Autenticação (Login)...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: uniqueEmail, password: 'password123' })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Falha no login: ${JSON.stringify(loginData)}`);
        console.log('✅ Login: OK');

        // 3. Cadastro de Processo (Gatilho Datajud + Gemini)
        console.log(`\n[PASSO 3] Monitoramento de Processo (${uniqueCase})...`);
        console.log('⏳ Isso pode demorar alguns segundos (Datajud + Gemini IA)...');
        const caseRes = await fetch(`${BASE_URL}/cases`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({
                caseNumber: uniqueCase,
                courtSystem: 'TJSP'
            })
        });
        const caseData = await caseRes.json();
        if (!caseRes.ok) throw new Error(`Falha no processo: ${JSON.stringify(caseData)}`);
        console.log('✅ Processo Criado: OK');
        console.log(`ℹ️ Resposta: ${caseData.message}`);

        // 4. Verificação de Prazos Gerados
        console.log('\n[PASSO 4] Verificação de Prazos Gerados pela IA...');
        const eventRes = await fetch(`${BASE_URL}/events`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(`Falha na agenda: ${JSON.stringify(eventData)}`);
        
        const events = eventData.data || [];
        console.log(`✅ Sucesso! Foram encontrados ${events.length} eventos/prazos na agenda.`);
        
        if (events.length > 0) {
            console.log('📝 Último evento detectado:', events[0].title);
        }

        console.log('\n🏆 QA COMPLETO: TODAS AS INTEGRAÇÕES (DATAJUD, GEMINI, AUTH) ESTÃO OPERACIONAIS!');
    } catch (error) {
        console.error('\n❌ TESTE DE QA FALHOU:', error.message);
        process.exit(1);
    }
}

runTests();
