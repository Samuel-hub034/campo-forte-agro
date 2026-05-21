// Catálogo de espécies e raças comuns no Brasil.
// Use `getBreedsForSpecies(speciesKey)` para obter a lista de raças sugeridas.

export type SpeciesKey =
  | "boi"
  | "vaca"
  | "bezerro"
  | "novilho"
  | "touro"
  | "bovino"
  | "cavalo"
  | "cabra"
  | "ovelha"
  | "porco"
  | "ave"
  | "outro";

export const ANIMAL_TYPES: { key: SpeciesKey; label: string }[] = [
  { key: "boi", label: "Boi" },
  { key: "vaca", label: "Vaca" },
  { key: "bezerro", label: "Bezerro" },
  { key: "novilho", label: "Novilho" },
  { key: "touro", label: "Touro" },
  { key: "cavalo", label: "Cavalo" },
  { key: "cabra", label: "Cabra" },
  { key: "ovelha", label: "Ovelha" },
  { key: "porco", label: "Porco" },
  { key: "ave", label: "Ave (galinha/frango)" },
  { key: "outro", label: "Outro" },
];

export const VET_SPECIES: { key: SpeciesKey; label: string }[] = [
  { key: "bovino", label: "Bovino (boi/vaca)" },
  { key: "bezerro", label: "Bezerro" },
  { key: "cavalo", label: "Cavalo" },
  { key: "cabra", label: "Cabra" },
  { key: "ovelha", label: "Ovelha" },
  { key: "porco", label: "Porco" },
  { key: "ave", label: "Ave (galinha/frango)" },
  { key: "outro", label: "Outro" },
];

const BOVINE_BREEDS = [
  "Nelore",
  "Angus",
  "Brahman",
  "Girolando",
  "Hereford",
  "Senepol",
  "Caracu",
  "Holandesa",
  "Gir",
  "Outro",
];

const BREEDS: Record<SpeciesKey, string[]> = {
  boi: BOVINE_BREEDS,
  vaca: BOVINE_BREEDS,
  bezerro: BOVINE_BREEDS,
  novilho: BOVINE_BREEDS,
  touro: BOVINE_BREEDS,
  bovino: BOVINE_BREEDS,
  cavalo: [
    "Mangalarga",
    "Quarto de Milha",
    "Crioulo",
    "Campolina",
    "Árabe",
    "Lusitano",
    "Appaloosa",
    "Outro",
  ],
  cabra: ["Boer", "Saanen", "Anglo-Nubiana", "Parda Alpina", "Toggenburg", "Outro"],
  ovelha: ["Santa Inês", "Dorper", "Morada Nova", "Texel", "Suffolk", "Outro"],
  porco: ["Landrace", "Large White", "Duroc", "Pietrain", "Moura", "Outro"],
  ave: ["Caipira", "Rhode Island", "Cobb", "Ross", "Leghorn", "Outro"],
  outro: ["Outro"],
};

export function getBreedsForSpecies(key: string | undefined | null): string[] {
  if (!key) return ["Outro"];
  return BREEDS[key as SpeciesKey] ?? ["Outro"];
}
