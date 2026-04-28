// Per-shop theming. Stored in shops.theme JSONB.
// Structure: { preset, primary, accent, background, font }
// All colors in oklch format.

export type ShopTheme = {
  preset?: ThemePresetKey;
  primary?: string; // oklch(...)
  accent?: string;
  background?: string;
  surface?: string;
  font?: FontKey;
};

export type ThemePresetKey = "rose" | "lavender" | "mint" | "caramel" | "chocolate" | "mono";
export type FontKey = "playfair" | "cormorant" | "fraunces" | "dm-serif";

export const PRESETS: Record<ThemePresetKey, Required<Omit<ShopTheme, "preset" | "font">> & { label: string }> = {
  rose: {
    label: "Rosé clássico",
    primary: "oklch(0.78 0.09 15)",
    accent: "oklch(0.88 0.06 15)",
    background: "oklch(0.985 0.008 60)",
    surface: "oklch(1 0 0)",
  },
  lavender: {
    label: "Lavanda",
    primary: "oklch(0.72 0.10 295)",
    accent: "oklch(0.86 0.05 295)",
    background: "oklch(0.985 0.008 295)",
    surface: "oklch(1 0 0)",
  },
  mint: {
    label: "Menta",
    primary: "oklch(0.74 0.09 165)",
    accent: "oklch(0.88 0.05 165)",
    background: "oklch(0.985 0.01 160)",
    surface: "oklch(1 0 0)",
  },
  caramel: {
    label: "Caramelo",
    primary: "oklch(0.68 0.11 60)",
    accent: "oklch(0.86 0.06 65)",
    background: "oklch(0.98 0.012 75)",
    surface: "oklch(1 0 0)",
  },
  chocolate: {
    label: "Chocolate",
    primary: "oklch(0.45 0.06 40)",
    accent: "oklch(0.78 0.06 40)",
    background: "oklch(0.97 0.012 50)",
    surface: "oklch(1 0 0)",
  },
  mono: {
    label: "Monocromático",
    primary: "oklch(0.30 0.01 250)",
    accent: "oklch(0.85 0.01 250)",
    background: "oklch(0.985 0 0)",
    surface: "oklch(1 0 0)",
  },
};

export const FONTS: Record<FontKey, { label: string; family: string; href: string }> = {
  playfair: {
    label: "Playfair Display",
    family: "'Playfair Display', Georgia, serif",
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
  cormorant: {
    label: "Cormorant Garamond",
    family: "'Cormorant Garamond', Georgia, serif",
    href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
  fraunces: {
    label: "Fraunces",
    family: "'Fraunces', Georgia, serif",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap",
  },
  "dm-serif": {
    label: "DM Serif Display",
    family: "'DM Serif Display', Georgia, serif",
    href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap",
  },
};

export function resolveTheme(theme?: ShopTheme | null): Required<Omit<ShopTheme, "preset" | "font">> & { font: FontKey } {
  const preset = theme?.preset ?? "rose";
  const base = PRESETS[preset] ?? PRESETS.rose;
  return {
    primary: theme?.primary || base.primary,
    accent: theme?.accent || base.accent,
    background: theme?.background || base.background,
    surface: theme?.surface || base.surface,
    font: theme?.font || "playfair",
  };
}

// Apply theme as CSS variables on document.documentElement
export function applyTheme(theme?: ShopTheme | null) {
  if (typeof document === "undefined") return;
  const t = resolveTheme(theme);
  const root = document.documentElement;
  root.style.setProperty("--primary", t.primary);
  root.style.setProperty("--ring", t.primary);
  root.style.setProperty("--rose", t.primary);
  root.style.setProperty("--blush", t.accent);
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--background", t.background);
  root.style.setProperty("--cream", t.background);
  root.style.setProperty("--card", t.surface);

  const f = FONTS[t.font];
  root.style.setProperty("--font-display", f.family);

  // Dynamically load font once
  const id = `font-${t.font}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = f.href;
    document.head.appendChild(link);
  }
}
