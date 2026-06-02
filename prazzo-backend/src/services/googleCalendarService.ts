import { google } from 'googleapis';
import { prisma } from '../lib/prisma';

export class GoogleCalendarService {
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  /**
   * Gera a URL de autenticação para o usuário
   */
  /**
   * Gera a URL de autorização do Google OAuth.
   * @param state Token de segurança anti-CSRF gerado pelo authRoutes (userId + nonce em base64).
   *   O Google devolve este state no callback, permitindo validar a origem do fluxo
   *   e identificar a qual userId do Prazzo vincular os tokens resultantes.
   */
  getAuthUrl(state: string) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Necessário para receber Refresh Token (permite sync em background)
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent', // Força exibição de consent screen para garantir refresh_token
      state,             // CSRF protection: validado no callback
    });
  }

  /**
   * Troca o código pelo token e salva no banco
   */
  async handleCallback(code: string, userId: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token, // Salvar o refresh token!
      }
    });

    return tokens;
  }

  /**
   * Garante que o cliente tenha um access token válido
   */
  private async setCredentials(user: any) {
    this.oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Se o access token expirou, o Refresh Token cuidará da renovação automática 
    // quando fizermos a chamadas da API via googleapis.
  }

  /**
   * SINCRO: Prazzo -> Google (Outbound)
   */
  async syncToGoogle(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { user: true }
    });

    if (!event || !event.user.googleRefreshToken) return;

    await this.setCredentials(event.user);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const googleEvent = {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.startTime.toISOString() },
      end: { dateTime: event.endTime.toISOString() },
    };

    try {
      if (event.googleEventId) {
        // Update
        await calendar.events.update({
          calendarId: 'primary',
          eventId: event.googleEventId,
          requestBody: googleEvent,
        });
      } else {
        // Create
        const res = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: googleEvent,
        });
        
        await prisma.event.update({
          where: { id: eventId },
          data: { googleEventId: res.data.id }
        });
      }
    } catch (error) {
      console.error('[GoogleCalendar] Erro ao sincronizar para o Google:', error);
    }
  }

  /**
   * SINCRO: Google -> Prazzo (Inbound)
   * Usa syncToken para pegar apenas o que mudou
   */
  async syncFromGoogle(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleRefreshToken) return;

    await this.setCredentials(user);
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    try {
      const res = await calendar.events.list({
        calendarId: 'primary',
        syncToken: user.googleSyncToken || undefined,
      });

      const changes = res.data.items || [];
      
      for (const item of changes) {
        if (item.status === 'cancelled') {
          // Delete localmente
          await prisma.event.deleteMany({
            where: { userId, googleEventId: item.id }
          });
        } else {
          // Upsert localmente
          const startTime = item.start?.dateTime || item.start?.date;
          const endTime = item.end?.dateTime || item.end?.date;

          if (!startTime || !endTime) continue;

          await prisma.event.upsert({
            where: { id: item.id as string },
            create: {
              userId,
              googleEventId: item.id ?? undefined,
              title: item.summary || 'Evento Google',
              description: item.description ?? undefined,
              startTime: new Date(startTime),
              endTime: new Date(endTime),
              creationSource: 'GOOGLE_SYNC'
            },
            update: {
              title: item.summary || 'Evento Google',
              description: item.description ?? undefined,
              startTime: new Date(startTime),
              endTime: new Date(endTime)
            }
          });
        }
      }

      // Salvar novo syncToken (Google pode retornar null — convertemos para undefined para Prisma)
      await prisma.user.update({
        where: { id: userId },
        data: { googleSyncToken: res.data.nextSyncToken ?? undefined }
      });

    } catch (error: any) {
      if (error.code === 410) {
        // syncToken expirou, resetar e fazer full sync
        await prisma.user.update({
          where: { id: userId },
          data: { googleSyncToken: null }
        });
        await this.syncFromGoogle(userId);
      } else {
        console.error('[GoogleCalendar] Erro ao sincronizar do Google:', error);
      }
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
