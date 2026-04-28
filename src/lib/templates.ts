// 6 templates prontos para a vitrine. Cada um define tema + ordem/visibilidade
// padrão das seções. A confeiteira escolhe um e personaliza dali.

import type { ShopTheme, ThemePresetKey, FontKey } from "./theme";

export type SectionKey =
  | "hero"
  | "about"
  | "catalog"
  | "promotions"
  | "events"
  | "testimonials"
  | "gallery"
  | "contact";

export type SectionConfig = { key: SectionKey; visible: boolean };

export type TemplateKey =
  | "romantic"
  | "minimal"
  | "festive"
  | "rustic"
  | "modern"
  | "classic";

export type Template = {
  key: TemplateKey;
  label: string;
  description: string;
  theme: ShopTheme & { preset: ThemePresetKey; font: FontKey };
  sections: SectionConfig[];
  heroStyle: "centered" | "split" | "overlay" | "minimal";
};

export const DEFAULT_SECTIONS: SectionConfig[] = [
  { key: "hero", visible: true },
  { key: "about", visible: false },
  { key: "promotions", visible: false },
  { key: "catalog", visible: true },
  { key: "events", visible: false },
  { key: "gallery", visible: false },
  { key: "testimonials", visible: false },
  { key: "contact", visible: true },
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Capa",
  about: "Sobre",
  catalog: "Catálogo",
  promotions: "Promoções",
  events: "Eventos",
  testimonials: "Depoimentos",
  gallery: "Galeria",
  contact: "Contato",
};

export const TEMPLATES: Record<TemplateKey, Template> = {
  romantic: {
    key: "romantic",
    label: "Romântico",
    description: "Rosé clássico com tipografia caligráfica",
    theme: { preset: "rose", font: "playfair" },
    sections: DEFAULT_SECTIONS,
    heroStyle: "centered",
  },
  minimal: {
    key: "minimal",
    label: "Minimalista",
    description: "Preto, branco e muito espaço",
    theme: { preset: "mono", font: "fraunces" },
    sections: DEFAULT_SECTIONS,
    heroStyle: "minimal",
  },
  festive: {
    key: "festive",
    label: "Festivo",
    description: "Cores vibrantes para eventos e festas",
    theme: { preset: "lavender", font: "dm-serif" },
    sections: [
      { key: "hero", visible: true },
      { key: "promotions", visible: true },
      { key: "catalog", visible: true },
      { key: "events", visible: true },
      { key: "gallery", visible: true },
      { key: "about", visible: false },
      { key: "testimonials", visible: false },
      { key: "contact", visible: true },
    ],
    heroStyle: "overlay",
  },
  rustic: {
    key: "rustic",
    label: "Rústico",
    description: "Caramelo e tons artesanais",
    theme: { preset: "caramel", font: "cormorant" },
    sections: [
      { key: "hero", visible: true },
      { key: "about", visible: true },
      { key: "catalog", visible: true },
      { key: "gallery", visible: true },
      { key: "testimonials", visible: true },
      { key: "promotions", visible: false },
      { key: "events", visible: false },
      { key: "contact", visible: true },
    ],
    heroStyle: "split",
  },
  modern: {
    key: "modern",
    label: "Moderno",
    description: "Menta com linhas limpas",
    theme: { preset: "mint", font: "fraunces" },
    sections: DEFAULT_SECTIONS,
    heroStyle: "split",
  },
  classic: {
    key: "classic",
    label: "Clássico",
    description: "Chocolate elegante e atemporal",
    theme: { preset: "chocolate", font: "playfair" },
    sections: [
      { key: "hero", visible: true },
      { key: "about", visible: true },
      { key: "catalog", visible: true },
      { key: "testimonials", visible: true },
      { key: "promotions", visible: false },
      { key: "events", visible: false },
      { key: "gallery", visible: false },
      { key: "contact", visible: true },
    ],
    heroStyle: "centered",
  },
};

export function getTemplate(key?: string | null): Template {
  if (!key) return TEMPLATES.romantic;
  return (TEMPLATES as any)[key] ?? TEMPLATES.romantic;
}
