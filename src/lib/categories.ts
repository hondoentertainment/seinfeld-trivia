/** Curated “encyclopedic” buckets so users can grind every angle of the dataset */
export type CategoryGroup = {
  id: string;
  label: string;
  subtitle: string;
  types: readonly string[];
};

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    id: "dialogue",
    label: "Dialogue detectives",
    subtitle: '“Who said it?” hooks & transcript completions',
    types: ["who_said", "transcript_word"],
  },
  {
    id: "episode_meta",
    label: "Episode craft",
    subtitle: "Credits, headings, titled moments",
    types: ["title", "written_by", "directed_by"],
  },
  {
    id: "world",
    label: "On-screen geography",
    subtitle: "Where the gang is standing or sitting",
    types: ["scene_setting"],
  },
  {
    id: "cast",
    label: "Cast ledger",
    subtitle: "Name-the-guest-energy prompts",
    types: ["cast"],
  },
  {
    id: "lore",
    label: "Metatext chronology",
    subtitle: "Airdates & series framing pulled from headings",
    types: ["meta_series", "meta_series_alt", "meta_season", "meta_airdate"],
  },
] as const;

const TYPE_PRETTY: Record<string, string> = {
  who_said: "Who said it",
  transcript_word: "Script keyword",
  scene_setting: "Scene & setting",
  written_by: "Written by",
  directed_by: "Directed by",
  cast: "Cast & characters",
  meta_series: "Series chronology",
  meta_season: "Season meta",
  meta_airdate: "Airdate meta",
  meta_series_alt: "Series meta (alt)",
  title: "Episode title cues",
};

export function readableTypeName(raw: string): string {
  return TYPE_PRETTY[raw] ?? raw.replace(/_/g, " ");
}
