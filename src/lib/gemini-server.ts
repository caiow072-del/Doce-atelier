import { createServerFn } from "@tanstack/react-start";

type ChatMsg = { role: "user" | "model"; text: string };

const ORDER_TAG = "[ORDER_READY]";

export const sendToGeminiServer = createServerFn({ method: "POST" })
  .validator((d: { history: ChatMsg[]; systemPrompt: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in server environment");
      throw new Error("Chave do Gemini não configurada no servidor.");
    }

    const contents = [
      { role: "user", parts: [{ text: data.systemPrompt + "\n\n(Aguarde a primeira mensagem do atendente)" }] },
      { role: "model", parts: [{ text: "Olá! 🎂 Sou a Doce IA! Me conte sobre a encomenda — pode falar o nome do cliente, o que deseja e para quando." }] },
      ...data.history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Gemini server error:", err);
      throw new Error((err as any)?.error?.message ?? "Erro ao contactar a API do Gemini.");
    }

    const result = await res.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Resposta vazia da IA.";
  });
