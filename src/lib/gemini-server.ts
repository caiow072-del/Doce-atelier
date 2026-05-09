import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

type ChatMsg = { role: "user" | "model"; text: string };

export const sendToGeminiServer = createServerFn({ method: "POST" })
  .handler(async (ctx: any) => {
    const { data } = ctx;
    let apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      // Fallback: busca no banco de dados se a Cloudflare apagar a variável
      try {
        const { data: secretData, error: dbError } = await (supabase as any)
          .from('secret_settings')
          .select('value')
          .eq('key', 'gemini_api_key')
          .single();
        
        if (dbError) {
          console.error("Erro detalhado do Supabase:", dbError);
          throw new Error(`Erro no banco: ${dbError.message}`);
        }

        if (secretData?.value) {
          apiKey = secretData.value;
        }
      } catch (e: any) {
        console.error("Erro ao buscar chave no Supabase:", e);
        throw new Error(`Falha ao buscar chave no banco: ${e.message}`);
      }
    }
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY não encontrada no ambiente nem no banco");
      throw new Error("Chave do Gemini não configurada. Por favor, adicione no painel da Cloudflare ou no banco de dados.");
    }

    const contents = [
      { role: "user", parts: [{ text: (data as any).systemPrompt + "\n\n(Aguarde a primeira mensagem do atendente)" }] },
      { role: "model", parts: [{ text: "Olá! 🎂 Sou a Doce IA! Me conte sobre a encomenda — pode falar o nome do cliente, o que deseja e para quando." }] },
      ...(data as any).history.map((m: any) => ({ role: m.role, parts: [{ text: m.text }] })),
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
