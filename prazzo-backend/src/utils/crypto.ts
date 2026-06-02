import crypto from 'crypto';

// ==============================================================
// SEGURANÇA P0: Encriptação de tokens sensíveis em repouso.
//
// Contexto: Os tokens OAuth do Google Calendar (access_token,
// refresh_token) dão acesso completo à agenda do advogado.
// Se o banco for comprometido, esses tokens expostos permitem
// que o atacante leia e modifique a agenda sem a senha do usuário.
//
// Solução: AES-256-GCM — padrão de encriptação autenticada
// (AEAD). O "authenticated" garante que o dado não foi
// adulterado (autenticidade + confidencialidade).
//
// Armazenamento no banco: IV + AuthTag + Ciphertext (em hex),
// separados por ':', concatenados numa única string.
// Exemplo: "a3f1...:<authTag>:<encryptedText>"
// ==============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;         // 96 bits — padrão recomendado para GCM (NIST SP 800-38D)
const KEY_LENGTH_BYTES = 32;  // 256 bits

/**
 * Valida e retorna a chave de encriptação do ambiente.
 * Lança erro em startup se a chave for inválida — fail-fast.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      '[Crypto] ENCRYPTION_KEY não definida nas variáveis de ambiente. ' +
      'Gere uma chave segura com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Suporte a chave em formato hexadecimal (64 chars) ou UTF-8 direto (32 chars)
  const keyBuffer = rawKey.length === 64
    ? Buffer.from(rawKey, 'hex')
    : Buffer.from(rawKey, 'utf8');

  if (keyBuffer.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `[Crypto] ENCRYPTION_KEY inválida. Deve ter exatamente ${KEY_LENGTH_BYTES} bytes. ` +
      `Recebido: ${keyBuffer.length} bytes. ` +
      'Use 64 caracteres hexadecimais (ex: output de crypto.randomBytes(32).toString("hex")).'
    );
  }

  return keyBuffer;
}

/**
 * Encripta uma string usando AES-256-GCM.
 *
 * @param text - Texto puro (ex: access_token, refresh_token do Google)
 * @returns String no formato "ivHex:authTagHex:encryptedHex" para armazenar no banco
 *
 * @throws Error se ENCRYPTION_KEY não estiver configurada corretamente
 *
 * @example
 * const tokenEncriptado = encrypt(googleAccessToken);
 * await prisma.user.update({ data: { googleAccessToken: tokenEncriptado } });
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // AuthTag é o componente de integridade do GCM — detecta adulteração dos dados
  const authTag = cipher.getAuthTag().toString('hex');

  // Formato: IV:AuthTag:CipherText — todos em hex para armazenamento seguro
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decripta uma string previamente encriptada com `encrypt()`.
 *
 * @param encryptedText - String no formato "ivHex:authTagHex:encryptedHex"
 * @returns Texto original decriptado
 *
 * @throws Error se o formato for inválido, AuthTag falhar (dado adulterado)
 *   ou ENCRYPTION_KEY não estiver configurada
 *
 * @example
 * const tokenOriginal = decrypt(user.googleAccessToken);
 * // Usar tokenOriginal para autenticar com a API do Google
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error(
      '[Crypto] Formato de texto encriptado inválido. ' +
      'Esperado: "ivHex:authTagHex:encryptedHex". ' +
      'O dado pode ter sido corrompido ou não foi encriptado com este módulo.'
    );
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv      = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encripta um valor APENAS se ele não estiver vazio/nulo.
 * Helper conveniente para uso nos controllers ao salvar tokens opcionais.
 *
 * @param text - Valor a encriptar (pode ser null ou undefined)
 * @returns String encriptada, ou null se o input for nulo/vazio
 */
export function encryptIfPresent(text: string | null | undefined): string | null {
  if (!text) return null;
  return encrypt(text);
}

/**
 * Decripta um valor APENAS se ele não estiver vazio/nulo.
 * Helper conveniente para uso nos services ao ler tokens do banco.
 *
 * @param encryptedText - Valor encriptado (pode ser null ou undefined)
 * @returns String decriptada, ou null se o input for nulo/vazio
 */
export function decryptIfPresent(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  return decrypt(encryptedText);
}

console.log('[Crypto] ✅ Módulo de encriptação AES-256-GCM carregado com sucesso.');
