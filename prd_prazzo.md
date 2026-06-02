# Documento de Requisitos do Produto (PRD) e Arquitetura - Prazzo

## 1. Visão Geral do Produto
O **Prazzo** é um aplicativo proprietário de agenda jurídica e acompanhamento processual focado em evitar que advogados percam compromissos e prazos de resposta. Combinando uma agenda inteligente com tracking processual em tempo real, o Prazzo atua como um "secretário jurídico" provido por IA: calcula prazos, sugere blocos de foco, notifica fluxos importantes, converte voz/imagens em agendamentos naturais e alerta ativamente em caso de inércia do usuário.

---

## 2. Requisitos do Produto

### 2.1 Requisitos Funcionais (RF)
* **RF01 - Gestão da Agenda Híbrida**: O usuário poderá incluir, editar e excluir compromissos de forma manual ou automatizada por IA.
* **RF02 - Processamento de Linguagem Natural (Voz -> Ação)**: Integração nativa com o microfone do dispositivo móvel. O app deve transcrever instruções de voz do advogado e utilizar LLMs para extrair tipo de evento, datas, horários e vincular a processos existentes para auto-preencher a agenda.
* **RF03 - Assistente de Consulta por Voz**: O app deve ser capaz de interpretar consultas ("quais minhas audiências hoje?") e responder em formato de UI (lista/cards) e/ou Áudio.
* **RF04 - Visão Computacional de Documentos**: O usuário poderá realizar upload de imagens, fotos ou "prints" (ex. intimações, publicações no diário oficial); O Prazzo extrairá datas e informações contextualizadas para criar eventos automaticamente.
* **RF05 - Agendamento Inteligente e "Blocos de Foco" (Smart Calendar)**:
  * Detecção de conflitos de agenda.
  * Agrupamento inteligente de tarefas similares (ex: block de ligações).
  * Criação automática ou sugerida de "Blocos de Foco" (tempo concentrado para produção de peças), demandando aprovação explícita do usuário para efetivação no calendário.
* **RF06 - Monitoramento Processual em Tempo Real**:
  * **Plano Free**: Limite de 5 processos.
  * **Plano Premium**: Limite de até 20 processos utilizando infraestrutura/API de alta prioridade.
* **RF07 - Motor de Prazos (Rule Engine)**: Motor capaz de cruzar a tipologia da movimentação oriunda da API (ex: "Publicação de Sentença") com a lógica legal para calcular o prazo aproximado, criando tarefas/lembretes de prazo associados.
* **RF08 - Alertas Escalonados Anti-inércia**: Se um prazo é de 5 dias e chega ao 3º dia sem marcações de eventos/tarefas finalizadas pelo usuário, o sistema deve acionar alertas de urgência ativamente.
* **RF09 - Sistema de Notificações Multicanal**:
  * **Plano Free**: Push notifications nativas.
  * **Plano Premium**: Push notifications, E-mail, e WhatsApp.
* **RF10 - Resumo de Andamentos por IA via WhatsApp**: Integração das notificações premium gerando *summaries* curtos ("O juiz decidiu dar provimento...") a partir da sopa de letrinhas técnica do webhook processual, enviando ativamente no WhatsApp do cliente.

### 2.2 Requisitos Não-Funcionais (RNF)
* **RNF01 - Escalabilidade e Filas (Assincronidade)**: O sistema de webhooks de APIs processuais ocorrerá a todo momento. O processamento desses dados, inferência em IA e disparos precisam ser orquestrados por filas (Message Brokers).
* **RNF02 - Segurança e Conformidade (LGPD)**: Proteção de dados sensíveis, criptografia em repouso dos detalhes do processo, proteção da base de contatos.
* **RNF03 - Responsividade em IA**: Como o advogado usa voz, a resposta/criação do evento tem de ser percebida como quase instantânea (latência alvo de IA de no máx 2-3 segundos para confirmar ação).
* **RNF04 - Disponibilidade e SLAs de Notificações**: As notificações de prazo possuem tolerância a falhas zero.

---

## 3. Arquitetura de Banco de Dados Sugerida (Relacional)
Um banco relacional (ex: PostgreSQL) é fortemente sugerido para lidar com alta integridade referencial exigida por um sistema de calendário e billing.

* **Users**: `id`, `name`, `email`, `phone` (para WhatsApp), `password_hash`, `subscription_tier` (FREE/PREMIUM), `created_at`.
* **Subscriptions**: `id`, `user_id`, `stripe_customer_id`, `status`, `expires_at` (Gestão de pagamentos).
* **Cases (Processos)**: `id`, `user_id`, `case_number`, `court_system`, `status`, `created_at`.
* **Case_Movements (Movimentações)**: `id`, `case_id`, `date`, `raw_payload`, `short_summary_ai`, `movement_type` (classification).
* **Events (Agenda)**: `id`, `user_id`, `title`, `description`, `start_time`, `end_time`, `related_case_id` (nulo se avulso), `event_type` (audience, focus_block, deadline, meeting), `creation_source` (manual, voice, image_ocr, webhook_auto).
* **Deadlines (Controle de Prazo)**: `id`, `event_id` ou `case_id`, `calculated_due_date`, `status` (pending, fulfilled, missed).
* **Notifications_Log**: `id`, `user_id`, `trigger_source`, `channel` (Push, E-mail, WhatsApp), `sent_status`.

---

## 4. Arquitetura Técnica e Integrações (APIs)

Para construir um aplicativo robusto e rápido com capacidade nativa focada em celular, eis a Stack recomendada:

### Frontend Mobile Integrado
* **Tecnologia Base**: **React Native** (com Expo) ou **Flutter**.
  * **Motivo**: Permitem abstrair rapidamente acessos ao microfone, biblioteca de imagens, permissões e push notifications nativas tanto para iOS quanto Android a partir do mesmo código.

### Backend Central & Hub de IA
* **Tecnologia Base**: **Node.js (NestJS)** para organização enterprise ou **Python (FastAPI)** pelo poderoso ecossistema de dados/IA. Recomenda-se um ecossistema com Node/Typescript como API central.
* **Banco de Dados**: **PostgreSQL** (AWS RDS, Supabase ou Neon).
* **Job Processor / Fila de Processamento em Background**: **Redis** + **BullMQ** (Node) ou **Celery** (Python) - *Crítico para receber 5.000 webhooks num dia, processar textos complexos no GPT sem derrubar a API).*

### APIs Terceirizadas Nativas e de Nuvem
1. **Dados, Monitoramento e Distribuição Processual**:
   * **API Jusbrasil**, **Escavador** ou **Digesto**. Elas proveem Webhooks (informando ao seu servidor toda vez que um dos processos do advogado na lista tiver movimentação).
   * **API de Distribuição**: Para permitir que, sabendo a OAB do cliente, processos novos cheguem automaticamente.
2. **Motor de IA (Voice / Text NLP / Resumos de Andamento)**:
   * **OpenAI API**:
     * *Whisper (STT)*: Conversão primorosa de microfone/audio para texto ("Marque audiência...").
     * *GPT-4o / GPT-4o-mini*: Extração lógica do texto/voz transcrito para JSON estruturado de evento (`start`, `end`, `title`), e sumarização complexa das movimentações processuais ("Traduzir juridiquês para WhatsApp").
     * *TTS (Text-to-Speech)*: Para a IA responder e dialogar com o advogado por áudio.
3. **Visão Computacional e OCR (Imagens -> Data)**:
   * **Google Cloud Vision API** ou **AWS Textract**: Ferramentas enterprise para extrair textos ricos e confiáveis a partir de prints borrados do celular ou pdfs. (O texto extraído por eles seria posteriormente validado e classificado pelo GPT).
4. **Comunicação Multicanal**:
   * **WhatsApp Cloud API** (Oficial Meta): Disparo de alertas transacionais sem risco de banimento.
   * **Firebase Cloud Messaging (FCM)** / **OneSignal**: Disparo de Pushes Nativos nos Celulares.
   * **Resend** ou **SendGrid**: Para envio de e-mails.
5. **Billing / Assinaturas**:
   * **Stripe** para processar o funil Freemium -> Premium.

---

## 5. Próximos Passos (MVP)

A construção de um MVP precisa focar nas premissas que resolvem as dores e "provar a mágica" da Inteligência Artificial como diferencial, fatiando as entregas.

* **Fase 1: Configuração Core e Agenda Híbrida**
  * Configurar a base móvel (App React Native) o backend (Node) e o banco.
  * Desenvolver a Autenticação e o calendário em si (CRUD de agendamentos).
  * **(Diferencial MVP)**: Integrar o microfone (Whisper + GPT-4o) para criação de eventos com um botão no centro do app ("Criar por voz").
* **Fase 2: Motor Processual (Webhook) e Controle Free VS Premium**
  * Integrar API de Processos (Ex: Escavador).
  * Construir as tabelas de `Cases` e habilitar o usuário a cadastrar processo pelo número.
  * Configurar as Filas (Redis) para receber as andamentos (webhooks).
* **Fase 3: IA nos Prazos, Notificações e O WhatsApp Premium**
  * Com as movimentações chegando, plugar a IA para "Ler a movimentação, identificar prazo e resumir a mensagem".
  * Disparar Push Notifications e Plugar a WhatsApp Business Cloud API.
  * Habilitar os planos pela infra de Billing (Stripe).
* **Fase 4: Alertas e Polimento**
  * Desenvolver os CRON jobs Diários que checam o "Motor de Lembretes/Inércia" comparando prazo e agenda para disparar "Status: Perigo".
  * Teste Fechado (Closed Beta) com um pequeno grupo de advogados selecionados para refinar o prompt da IA de sumarização e os horários/regras do assistente de reorganização ("Bloco de Foco").
