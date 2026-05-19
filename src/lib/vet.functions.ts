import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VetSchema = z.object({
  species: z.string().min(1).max(40),
  breed: z.string().max(80).optional().default(""),
  sex: z.enum(["macho", "femea", "desconhecido"]).default("desconhecido"),
  ageMonths: z.number().int().min(0).max(600).optional(),
  weightKg: z.number().min(0).max(2000).optional(),
  symptoms: z.string().min(3).max(2000),
});

export type VetAdvice = {
  urgency: "baixa" | "media" | "alta" | "emergencia";
  possibleCauses: { name: string; description: string }[];
  immediateCare: string[];
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    notes: string;
  }[];
  whenToCallVet: string;
  disclaimer: string;
};

export const askVetAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VetSchema.parse(input))
  .handler(async ({ data }): Promise<VetAdvice> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const sys = `Você é um assistente veterinário para produtores rurais brasileiros.
Responda SEMPRE em português do Brasil, de forma clara e direta para alguém sem formação técnica.
Considere medicina veterinária de animais de produção (bovinos, equinos, suínos, caprinos, ovinos, aves).
Sempre inclua aviso de que a recomendação não substitui avaliação presencial de um veterinário.
Responda APENAS em JSON válido seguindo o schema fornecido.`;

    const user = `Animal: ${data.species}${data.breed ? ` (${data.breed})` : ""}
Sexo: ${data.sex}
${data.ageMonths != null ? `Idade: ${data.ageMonths} meses` : ""}
${data.weightKg != null ? `Peso: ${data.weightKg} kg` : ""}

Sintomas relatados pelo produtor:
${data.symptoms}

Forneça avaliação em JSON com este formato exato:
{
  "urgency": "baixa" | "media" | "alta" | "emergencia",
  "possibleCauses": [{"name": "string", "description": "string curta"}],
  "immediateCare": ["passo 1", "passo 2", ...],
  "medications": [{"name": "string", "dosage": "string com mg/kg", "frequency": "string", "notes": "contraindicações"}],
  "whenToCallVet": "string",
  "disclaimer": "string"
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429)
        throw new Error("Muitas consultas no momento. Tente novamente em instantes.");
      if (res.status === 402)
        throw new Error("Créditos de IA esgotados. Avise o administrador.");
      throw new Error(`Erro na IA (${res.status})`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: VetAdvice;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Resposta inválida da IA. Tente refazer a pergunta.");
    }

    // Garantir o disclaimer
    if (!parsed.disclaimer) {
      parsed.disclaimer =
        "Estas recomendações não substituem a avaliação de um veterinário presencial.";
    }
    return parsed;
  });
