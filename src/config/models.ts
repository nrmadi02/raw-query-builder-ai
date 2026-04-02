import type { Model } from "@/types";

export const MODEL_OPTIONS: { group: string; models: Model[] }[] = [
  {
    group: "Free Tier",
    models: [
      {
        id: "gemini/gemini-2.0-flash-exp",
        label: "Gemini 2.0 Flash Exp",
        provider: "Google",
        badge: "FREE" as const,
        envKey: "GEMINI_API_KEY",
        note: "Terbaru, gratis via Google AI Studio",
      },
      {
        id: "gemini/gemini-1.5-flash-latest",
        label: "Gemini 1.5 Flash Latest",
        provider: "Google",
        badge: "FREE" as const,
        envKey: "GEMINI_API_KEY",
        note: "Stabil, gratis via Google AI Studio",
      },
      {
        id: "groq/llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        provider: "Groq",
        badge: "FREE" as const,
        envKey: "GROQ_API_KEY",
        note: "Super cepat (LPU), gratis via Groq",
      },
      {
        id: "groq/llama-3.1-8b-instant",
        label: "Llama 3.1 8B Instant",
        provider: "Groq",
        badge: "FREE" as const,
        envKey: "GROQ_API_KEY",
        note: "Paling cepat, cocok query sederhana",
      },
    ],
  },
  {
    group: "Paid",
    models: [
      {
        id: "gpt-4o",
        label: "GPT-4o",
        provider: "OpenAI",
        badge: "PAID" as const,
        envKey: "OPENAI_API_KEY",
        note: "Paling akurat, tapi berbayar",
      },
      {
        id: "claude-3-5-sonnet-20240620",
        label: "Claude 3.5 Sonnet",
        provider: "Anthropic",
        badge: "PAID" as const,
        envKey: "ANTHROPIC_API_KEY",
        note: "Sangat andal untuk SQL kompleks",
      },
    ],
  },
];

export const ALL_MODELS: Model[] = MODEL_OPTIONS.flatMap((g) => g.models);
