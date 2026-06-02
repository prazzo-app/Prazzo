import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { validateOAB } from '../services/oabService';
import { AuditService } from '../services/auditService';

/**
 * SEGURANÇA P0: JWT_SECRET sem fallback.
 * Razão: Um secret público em código-fonte permite falsificar tokens de qualquer usuário.
 * A validação de startup (process.exit) garante que o servidor nunca sobe em estado inseguro.
 * O TypeScript não conhece o valor em runtime, então usamos o non-null assertion (!) pois
 * a guarda acima garante que não é undefined se chegou até aqui.
 */
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET não configurado. Encerrando.');
  process.exit(1);
}

/**
 * Hash dummy usado no anti-timing-attack do login.
 * Razão: Se retornarmos imediatamente quando o e-mail não existe, um atacante mede o
 * tempo de resposta e detecta quais e-mails estão cadastrados (enumeração de usuários).
 * Ao sempre executar o bcrypt.compare (mesmo com e-mail inválido), o tempo de resposta
 * é uniforme e o ataque é neutralizado.
 */
const DUMMY_HASH = '$2b$10$dummyhashfortimingprotection.NotARealHash0000000000000';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
        name, email, password, phone, oabNumber, oabState,
        acceptedTerms, acceptedPrivacyPolicy 
    } = req.body;

    // Regra de negócio LGPD: consentimento explícito é requisito legal para coleta de dados.
    if (!acceptedTerms || !acceptedPrivacyPolicy) {
        res.status(400).json({ 
            error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.' 
        });
        return;
    }

    // Regra de negócio: O Prazzo é exclusivo para advogados. A OAB é o identificador
    // profissional único que vincula um usuário à classe jurídica e permite consultas processuais.
    if (!oabNumber || !oabState) {
        res.status(400).json({ error: 'Número e Estado da OAB são obrigatórios para advogados.' });
        return;
    }

    const { valid } = await validateOAB(oabNumber, oabState);
    if (!valid) {
        res.status(400).json({ error: 'OAB em formato inválido ou inexistente no CNA.' });
        return;
    }

    // Verificar se e-mail já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'E-mail já cadastrado no Prazzo.' });
      return;
    }

    // Verificar se OAB já existe (evitar P2002 no create)
    const existingOAB = await prisma.user.findUnique({
      where: {
        oabNumber_oabState: {
          oabNumber,
          oabState: oabState.toUpperCase()
        }
      }
    });

    if (existingOAB) {
        res.status(400).json({ error: 'Esta OAB já está vinculada a outra conta.' });
        return;
    }

    // bcrypt com fator 12: equilíbrio entre segurança e performance.
    // Fator 10 = ~100ms, fator 12 = ~400ms. Para registro (ocorre raramente),
    // 400ms é aceitável e torna brute-force computacionalmente inviável.
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário com consentimento LGPD registrado com timestamp
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        phone,
        subscriptionTier: 'FREE',
        oabNumber,
        oabState: oabState.toUpperCase(),
        acceptedTermsAt: new Date(),
        privacyPolicyAcceptedAt: new Date()
      } as any,
    });

    // JWT com expiração de 7 dias: balanceia conveniência (não forçar re-login diário)
    // e janela de segurança (token comprometido expira em no máximo 1 semana).
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET!, { expiresIn: '7d' });

    // Log de auditoria: Registro bem-sucedido
    await AuditService.log(req, 'REGISTER_SUCCESS', `USER:${user.id}`, { email: user.email });

    res.status(201).json({
      message: 'Usuário Prazzo criado com sucesso!',
      user: { id: user.id, name: user.name, email: user.email, tier: user.subscriptionTier },
      token,
    });
  } catch (error: any) {
    console.error('[Auth] Erro no registro:', error);
    res.status(500).json({ error: 'Falha ao criar conta.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    // Anti-timing attack: sempre buscamos o usuário e depois SEMPRE rodamos o bcrypt.
    // Se retornássemos imediatamente quando user=null, o tempo de resposta diferente
    // permitiria enumerar quais e-mails existem no banco (user enumeration attack).
    const user = await prisma.user.findUnique({ where: { email } });
    const hashToCompare = user?.password_hash || DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    // Só revelamos falha genérica após o bcrypt.compare — nunca antes
    if (!user || !user.password_hash || !isValid) {
      // Log de auditoria: Tentativa falha (IP rastreado pelo middleware)
      await AuditService.log(req, 'LOGIN_FAILED', undefined, { email });
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // JWT com 7 dias de expiração (mesmo do registro)
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET!, { expiresIn: '7d' });

    // Log de auditoria: Login bem-sucedido
    await AuditService.log(req, 'LOGIN_SUCCESS', `USER:${user.id}`);

    res.status(200).json({
      message: 'Bem-vindo de volta ao Prazzo!',
      user: { id: user.id, name: user.name, email: user.email, tier: user.subscriptionTier },
      token,
    });
  } catch (error: any) {
    console.error('[Auth] Erro no login:', error);
    res.status(500).json({ error: 'Erro no servidor durante login.' });
  }
};
