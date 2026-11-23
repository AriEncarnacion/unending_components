export type ShippedFont = {
  id: string
  label: string
  family: string
  item: { import: string; dependency: string; family: string } | null
  licensed?: boolean
}

const google = (id: string, label: string, importName: string, dependency: string, family: string, fallback: string): ShippedFont => ({
  id,
  label,
  family: `${family}, ${fallback}`,
  item: { import: importName, dependency, family: `${family}, ${fallback}` },
})

export const shippedFonts: ShippedFont[] = [
  google("dm-sans", "DM Sans", "DM_Sans", "@fontsource-variable/dm-sans", "'DM Sans Variable'", "sans-serif"),
  google("manrope", "Manrope", "Manrope", "@fontsource-variable/manrope", "'Manrope Variable'", "sans-serif"),
  google("geist", "Geist", "Geist", "@fontsource-variable/geist", "'Geist Variable'", "sans-serif"),
  google("inter", "Inter", "Inter", "@fontsource-variable/inter", "'Inter Variable'", "sans-serif"),
  google("plex-sans", "IBM Plex Sans", "IBM_Plex_Sans", "@fontsource/ibm-plex-sans", "'IBM Plex Sans'", "sans-serif"),
  google("archivo", "Archivo", "Archivo", "@fontsource-variable/archivo", "'Archivo Variable'", "sans-serif"),
  google("space-grotesk", "Space Grotesk", "Space_Grotesk", "@fontsource-variable/space-grotesk", "'Space Grotesk Variable'", "sans-serif"),
  {
    id: "graphik",
    label: "Graphik",
    family: '"Graphik", ui-sans-serif, system-ui, sans-serif',
    item: null,
    licensed: true,
  },
  { id: "system", label: "System UI", family: "ui-sans-serif, system-ui, sans-serif", item: null },
  google("geist-mono", "Geist Mono", "Geist_Mono", "@fontsource-variable/geist-mono", "'Geist Mono Variable'", "monospace"),
  google("plex-mono", "IBM Plex Mono", "IBM_Plex_Mono", "@fontsource/ibm-plex-mono", "'IBM Plex Mono'", "monospace"),
  google("jetbrains-mono", "JetBrains Mono", "JetBrains_Mono", "@fontsource-variable/jetbrains-mono", "'JetBrains Mono Variable'", "monospace"),
  { id: "system-mono", label: "System mono", family: "ui-monospace, SFMono-Regular, Menlo, monospace", item: null },
]

export function fontById(id: string) {
  return shippedFonts.find((font) => font.id === id)
}

export const stockFonts = { sans: "dm-sans", heading: "manrope", mono: "geist-mono" } as const
