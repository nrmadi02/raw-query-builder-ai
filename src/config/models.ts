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
        id: "gemini/gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        provider: "Google",
        badge: "FREE" as const,
        envKey: "GEMINI_API_KEY",
        note: "Stabil, gratis via Google AI Studio",
      },
      {
        id: "openrouter/qwen/qwen-turbo",
        label: "Qwen Turbo",
        provider: "OpenRouter",
        badge: "PAID" as const,
        envKey: "OPENROUTER_API_KEY",
        note: "Sangat murah (~$0.03/1M token), cepat",
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
        id: "deepseek/deepseek-chat",
        label: "DeepSeek V3",
        provider: "DeepSeek",
        badge: "PAID" as const,
        envKey: "DEEPSEEK_API_KEY",
        note: "Murah, sangat bagus untuk coding & SQL",
      },
      {
        id: "deepseek/deepseek-reasoner",
        label: "DeepSeek R1",
        provider: "DeepSeek",
        badge: "PAID" as const,
        envKey: "DEEPSEEK_API_KEY",
        note: "Reasoning model, cocok query kompleks",
      },
      {
        id: "openrouter/qwen/qwen3-max-thinking",
        label: "Qwen 3 Max Thinking",
        provider: "OpenRouter",
        badge: "PAID" as const,
        envKey: "OPENROUTER_API_KEY",
        note: "Reasoning model Qwen terkuat",
      },
      {
        id: "openai/gpt-4o",
        label: "GPT-4o",
        provider: "OpenAI",
        badge: "PAID" as const,
        envKey: "OPENAI_API_KEY",
        note: "Paling akurat, tapi berbayar",
      },
      {
        id: "anthropic/claude-3-5-sonnet-20240620",
        label: "Claude 3.5 Sonnet",
        provider: "Anthropic",
        badge: "PAID" as const,
        envKey: "ANTHROPIC_API_KEY",
        note: "Sangat andal untuk SQL kompleks",
      },
      {
        id: "zai/glm-4.7",
        label: "GLM 4.7",
        provider: "Z.ai",
        badge: "PAID" as const,
        envKey: "ZAI_API_KEY",
        note: "Model terbaru Zhipu AI, kuat untuk SQL & analitik",
      },
    ],
  },
];

export const ALL_MODELS: Model[] = MODEL_OPTIONS.flatMap((g) => g.models);
