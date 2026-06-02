import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const geminiService = {
  /**
   * Gera uma resposta estruturada (JSON) usando Gemini 1.5 Flash
   */
  async generateStructuredContent(prompt: string): Promise<any> {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpando possíveis blocos de markdown ```json ... ```
      const cleanedText = text.replace(/```json|```/g, "").trim();
      
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Erro no Gemini Service (JSON):", error);
      throw new Error("Falha ao processar conteúdo JSON com Gemini.");
    }
  },

  /**
   * Gera uma resposta de texto puro usando Gemini 1.5 Flash
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Erro no Gemini Service (Text):", error);
      throw new Error("Falha ao processar texto com Gemini.");
    }
  },

  /**
   * Gera resposta baseada em imagem (Multimodal)
   */
  async generateVisionContent(prompt: string, base64Image: string, mimeType: string): Promise<any> {
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        },
        prompt
      ]);
      const response = await result.response;
      const text = response.text();
      
      // Limpando possíveis blocos de markdown ```json ... ```
      const cleanedText = text.replace(/```json|```/g, "").trim();
      
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Erro no Gemini Service (Vision):", error);
      throw new Error("Falha ao processar imagem com Gemini.");
    }
  },

  /**
   * Traduz um andamento jurídico complexo para uma linguagem leiga (Cliente WhatsApp)
   */
  async generateClientFriendlySummary(complexMovement: string): Promise<string> {
    try {
      const prompt = `Traduza o seguinte andamento jurídico para uma linguagem extremamente simples, curta e amigável para o WhatsApp do cliente final (o cidadão leigo). 
      Não use termos técnicos. O tom deve ser informativo e tranquilizador. 
      Máximo 150 caracteres.
      Andamento: "${complexMovement}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error("Erro no Gemini Service (Client Summary):", error);
      return "Tivemos uma nova movimentação no seu processo. Em breve daremos mais detalhes!";
    }
  }
};
