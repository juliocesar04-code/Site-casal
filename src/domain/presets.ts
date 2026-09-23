export const TEMPLATE_IDS = ["classico", "carta", "historia", "cinematico", "capitulos", "colaborativo"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TemplateMode = "scroll" | "paged";

export type TemplateDefinition = {
  id: TemplateId;
  mode: TemplateMode;
  // Order in which content blocks appear in the experience.
  blocks: readonly ("message" | "chapters" | "timeline" | "gallery" | "contributions")[];
};

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  classico: { id: "classico", mode: "scroll", blocks: ["message", "gallery", "chapters", "timeline", "contributions"] },
  carta: { id: "carta", mode: "scroll", blocks: ["message", "chapters", "gallery", "contributions", "timeline"] },
  historia: { id: "historia", mode: "scroll", blocks: ["timeline", "message", "chapters", "gallery", "contributions"] },
  cinematico: { id: "cinematico", mode: "paged", blocks: ["gallery", "message", "chapters", "timeline", "contributions"] },
  capitulos: { id: "capitulos", mode: "paged", blocks: ["chapters", "message", "timeline", "gallery", "contributions"] },
  colaborativo: { id: "colaborativo", mode: "scroll", blocks: ["message", "contributions", "gallery", "chapters", "timeline"] },
};

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

export const THEME_IDS = ["marfim", "noite", "sepia", "bruma", "musgo"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type Theme = {
  id: ThemeId;
  scheme: "light" | "dark";
  vars: {
    "--m-bg": string;
    "--m-surface": string;
    "--m-ink": string;
    "--m-muted": string;
    "--m-line": string;
    "--m-accent": string;
  };
};

export const THEMES: Record<ThemeId, Theme> = {
  marfim: {
    id: "marfim",
    scheme: "light",
    vars: {
      "--m-bg": "#f4efe6",
      "--m-surface": "#fbf8f2",
      "--m-ink": "#1d1a16",
      "--m-muted": "#6d665c",
      "--m-line": "#ddd4c5",
      "--m-accent": "#8a6a3b",
    },
  },
  noite: {
    id: "noite",
    scheme: "dark",
    vars: {
      "--m-bg": "#0f0f10",
      "--m-surface": "#18181a",
      "--m-ink": "#efeae2",
      "--m-muted": "#9a948b",
      "--m-line": "#2c2b2a",
      "--m-accent": "#c9a86a",
    },
  },
  sepia: {
    id: "sepia",
    scheme: "light",
    vars: {
      "--m-bg": "#ecdfcb",
      "--m-surface": "#f4e9d8",
      "--m-ink": "#2d2118",
      "--m-muted": "#75604b",
      "--m-line": "#d3bfa2",
      "--m-accent": "#9b4f2e",
    },
  },
  bruma: {
    id: "bruma",
    scheme: "light",
    vars: {
      "--m-bg": "#e7eaec",
      "--m-surface": "#f2f4f5",
      "--m-ink": "#1b2127",
      "--m-muted": "#5f6a73",
      "--m-line": "#cdd3d8",
      "--m-accent": "#3f5f78",
    },
  },
  musgo: {
    id: "musgo",
    scheme: "dark",
    vars: {
      "--m-bg": "#161a15",
      "--m-surface": "#1e231c",
      "--m-ink": "#e8e6dc",
      "--m-muted": "#9aa08e",
      "--m-line": "#30362c",
      "--m-accent": "#b8b27a",
    },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export const OCCASIONS = [
  "namoro",
  "casamento",
  "amizade",
  "familia",
  "aniversario",
  "pedido",
  "formatura",
  "nascimento",
  "homenagem",
  "agradecimento",
  "despedida",
  "dia_das_maes",
  "dia_dos_pais",
  "viagem",
  "grupo",
  "professor",
  "outro",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const TRANSITIONS = ["fade", "slide", "zoom", "none"] as const;
export type Transition = (typeof TRANSITIONS)[number];
