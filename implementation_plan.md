# Inicialização do MVP - Prazzo (Fase 1)

Este plano cobre a **Fase 1**, conforme estipulado no PRD. A meta aqui é construir a fundação da aplicação, inicializando os dois grandes blocos do sistema, configurar o banco de dados e preparar o ambiente para a autenticação e o primeiro diferencial ("marcação por voz").

## Mudanças Propostas

O projeto será dividido em dois diretórios na raiz do seu workspace (`d:\Prazzo_APP`): `prazzo-backend` (Node.js) e `prazzo-mobile` (Expo/React Native).

---

### Backend (Node.js + REST API)
Preparação da API central que fará a orquestração do banco de dados e conexões com a IA.

#### [NEW] `prazzo-backend/` (Inicialização do Projeto Express + TS)
- Iremos inicializar um projeto Node.js com TypeScript e `express`.
- **Database ORM**: Utilizaremos o **Prisma ORM** por ser extremamente rápido para criar modelos descritos no PRD (Users, Cases, Events).
- Estrutura inicial das rotas (`/api/auth`, `/api/events`).

### Frontend Mobile (App React Native)
Preparação do app nativo que será instalado pelo advogado.

#### [NEW] `prazzo-mobile/` (Inicialização via Expo)
- Utilizaremos o **Expo** (framework recomendado focado no React Native nativo) para gerar o projeto móvel inicial.
- Instalação de biblioteca de calendário (`react-native-calendars`) e base UI moderna.
- Configuração de navegação (`expo-router` ou `@react-navigation/native`).

## Integrações (A serem feitas após fundação)
1. Conectar banco de dados PostgreSQL.
2. Integração com a OpenAI no Node para receber o áudio e estruturar agendamento (usando `multer` para upload de áudio e `openai` sdk).

---

> [!IMPORTANT] 
> **Revisão de Ambiente**
> Antes de executar as inicializações, por favor, me confirme os pontos abaixo:
> 1. Você já tem o **PostgreSQL** instalado na sua máquina para rodarmos localmente durante o desenvolvimento do MVP? (Se não, podemos usar SQLite temporariamente ou configurar uma conta gratuita no Supabase).
> 2. O design deve ser moderno e focado em advocacia: **Dark Mode por padrão** com uma paleta de Cores Premium (ex: fundo preto profundo, acentos em dourado sutil e branco)?

## Plano de Verificação
- A API do backend rodando localmente sem erros na porta `3000`.
- O banco de dados relacional gerado com a migração inicial do Prisma (Tabela de Usuários e Eventos).
- O app do Expo rodando via `npx expo start` com a interface base inicial aparecendo.
