// AI-like order parser using local regex/heuristics (zero cost, no API needed).
// Parses natural language descriptions into structured order drafts.

export type OrderDraft = {
  customerName: string | null;
  deliveryDate: string | null; // ISO string
  description: string;
  items: { name: string; qty: number; price: number }[];
  notes: string | null;
};

type CustomerLite = { id: string; name: string; phone: string };

const MONTHS_PT: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
};

const WEEKDAYS_PT: Record<string, number> = {
  domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6,
};

function parseDate(text: string): string | null {
  const lower = text.toLowerCase();
  const now = new Date();
  const year = now.getFullYear();

  // "dia DD de MES" or "DD de MES"
  const m1 = lower.match(/(?:dia\s+)?(\d{1,2})\s+de\s+(\w+)/);
  if (m1) {
    const day = parseInt(m1[1]);
    const month = MONTHS_PT[m1[2]];
    if (month !== undefined) {
      const d = new Date(year, month, day, 10, 0);
      if (d < now) d.setFullYear(year + 1);
      return d.toISOString();
    }
  }

  // "DD/MM" or "DD/MM/YYYY"
  const m2 = lower.match(/(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?/);
  if (m2) {
    const day = parseInt(m2[1]);
    const month = parseInt(m2[2]) - 1;
    const yr = m2[3] ? (m2[3].length === 2 ? 2000 + parseInt(m2[3]) : parseInt(m2[3])) : year;
    const d = new Date(yr, month, day, 10, 0);
    if (d < now && !m2[3]) d.setFullYear(year + 1);
    return d.toISOString();
  }

  // "próximo sábado", "próxima segunda"
  const m3 = lower.match(/pr[oó]xim[oa]\s+(\w+)/);
  if (m3) {
    const wd = WEEKDAYS_PT[m3[1]];
    if (wd !== undefined) {
      const d = new Date(now);
      const diff = (wd - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(10, 0, 0, 0);
      return d.toISOString();
    }
  }

  // "amanhã"
  if (lower.includes("amanhã") || lower.includes("amanha")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  }

  // "depois de amanhã"
  if (lower.includes("depois de amanhã") || lower.includes("depois de amanha")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  }

  return null;
}

function parseName(text: string): string | null {
  const lower = text.toLowerCase();

  // "do João Francisco", "da Maria", "para o João", "cliente João"
  const patterns = [
    /(?:d[oa]|para\s+[oa]?)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)/,
    /cliente\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      // Exclude date-related words
      const name = m[1].trim();
      const skipWords = new Set(["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]);
      if (!skipWords.has(name.split(" ")[0])) return name;
    }
  }

  return null;
}

function parseItems(text: string): { name: string; qty: number; price: number }[] {
  const items: { name: string; qty: number; price: number }[] = [];
  const lower = text.toLowerCase();

  // "N salgados", "N coxinhas", "N docinhos", "N brigadeiros"
  const qtyPatterns = [
    /(\d+)\s+(salgad\w+|coxinha\w*|empad\w+|bolinha\w*|kibe\w*|risol\w*|pastel\w*|esfirr\w*)/gi,
    /(\d+)\s+(docinho\w*|brigadeiro\w*|beijinho\w*|cajuzinho\w*|trufa\w*|bem.?casado\w*)/gi,
    /(\d+)\s+(cupcake\w*|mini.?bolo\w*|brownie\w*|cookie\w*|macaron\w*)/gi,
  ];

  for (const pat of qtyPatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const qty = parseInt(m[1]);
      const name = m[2].charAt(0).toUpperCase() + m[2].slice(1);
      items.push({ name, qty, price: 0 });
    }
  }

  // "bolo de ...", "torta de ..."
  const cakeMatch = lower.match(/bolo\s+(?:de\s+)?([^,.\d]+?)(?:\s+com\s+|\s+\d|\s*[,.]|$)/);
  if (cakeMatch) {
    const desc = "Bolo de " + cakeMatch[1].trim();
    items.unshift({ name: desc.slice(0, 80), qty: 1, price: 0 });
  } else if (lower.includes("bolo")) {
    items.unshift({ name: "Bolo", qty: 1, price: 0 });
  }

  const tortaMatch = lower.match(/torta\s+(?:de\s+)?([^,.\d]+?)(?:\s+com\s+|\s+\d|\s*[,.]|$)/);
  if (tortaMatch) {
    const desc = "Torta de " + tortaMatch[1].trim();
    items.unshift({ name: desc.slice(0, 80), qty: 1, price: 0 });
  }

  // "kit festa"
  if (lower.includes("kit festa") || lower.includes("kit party")) {
    items.push({ name: "Kit Festa", qty: 1, price: 0 });
  }

  return items;
}

export function parseNaturalOrder(text: string, customers: CustomerLite[]): OrderDraft {
  const customerName = parseName(text);
  const deliveryDate = parseDate(text);
  const items = parseItems(text);

  return {
    customerName,
    deliveryDate,
    description: text.trim(),
    items: items.length > 0 ? items : [{ name: "", qty: 1, price: 0 }],
    notes: null,
  };
}

export function findCustomerMatch(name: string, customers: CustomerLite[]): CustomerLite | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // Exact match
  const exact = customers.find(c => c.name.toLowerCase().trim() === lower);
  if (exact) return exact;

  // Partial match (first name)
  const firstName = lower.split(" ")[0];
  const partial = customers.find(c => c.name.toLowerCase().startsWith(firstName));
  if (partial) return partial;

  // Contains
  const contains = customers.find(c =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
  return contains ?? null;
}

export async function parseNaturalOrderWithLLM(text: string, customers: CustomerLite[]): Promise<OrderDraft> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY não configurada. Usando parser local (Regex).");
    return parseNaturalOrder(text, customers);
  }

  try {
    const today = new Date().toISOString();
    const prompt = `
Você é um assistente de confeitaria especializado em extrair pedidos de clientes a partir de texto natural.
Hoje é: ${today}

Lista de clientes conhecidos:
${customers.map(c => `- ${c.name}`).join("\n") || "Nenhum cliente cadastrado."}

Texto do pedido: "${text}"

Extraia as seguintes informações e retorne EXATAMENTE um JSON válido, sem markdown (\`\`\`json) em volta:
{
  "customerName": "Nome do cliente (tente encontrar na lista acima ou extrair do texto)",
  "deliveryDate": "Data e hora de entrega no formato ISO 8601 (ex: 2024-05-10T10:00:00Z). Se não houver hora, assuma 10:00. Se a data for incerta, use null",
  "description": "Texto original corrigido e formatado gentilmente, com correções ortográficas básicas",
  "items": [
    { "name": "Nome do item (ex: Bolo de Ninho, Coxinha, Kit Festa)", "qty": quantidade_inteira, "price": 0 }
  ]
}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        }
      })
    });

    if (!response.ok) throw new Error("Falha na API do Gemini");
    const data = await response.json();
    let resultText = data.candidates[0].content.parts[0].text;
    
    // Fallback if model wraps in markdown
    if (resultText.startsWith("\`\`\`json")) {
      resultText = resultText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    }
    
    const parsed = JSON.parse(resultText) as OrderDraft;
    
    // Ensure basic structure
    return {
      customerName: parsed.customerName || null,
      deliveryDate: parsed.deliveryDate || null,
      description: parsed.description || text,
      items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : [{ name: "", qty: 1, price: 0 }],
      notes: null,
    };
  } catch (error) {
    console.error("Erro no LLM parser, usando regex como fallback:", error);
    return parseNaturalOrder(text, customers);
  }
}

