import {
  Archivo,
  DM_Sans,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Manrope,
  Space_Grotesk,
} from "next/font/google"

import type { FontOption } from "@/components/showcase/token-overrides"
import { stockFonts } from "@/lib/design-systems/fonts"

export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-heading" })
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

const geist = Geist({ subsets: ["latin"], variable: "--font-option-geist", preload: false })
const inter = Inter({ subsets: ["latin"], variable: "--font-option-inter", preload: false })
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-option-plex-sans", preload: false })
const archivo = Archivo({ subsets: ["latin"], variable: "--font-option-archivo", preload: false })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-option-space-grotesk", preload: false })
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-option-plex-mono", preload: false })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-option-jetbrains-mono", preload: false })

export const fontVariables = [
  dmSans,
  manrope,
  geistMono,
  geist,
  inter,
  plexSans,
  archivo,
  spaceGrotesk,
  plexMono,
  jetbrainsMono,
].map((font) => font.variable)

const proportional: FontOption[] = [
  { id: "dm-sans", label: "DM Sans", family: dmSans.style.fontFamily },
  { id: "manrope", label: "Manrope", family: manrope.style.fontFamily },
  { id: "geist", label: "Geist", family: geist.style.fontFamily },
  { id: "inter", label: "Inter", family: inter.style.fontFamily },
  { id: "plex-sans", label: "IBM Plex Sans", family: plexSans.style.fontFamily },
  { id: "archivo", label: "Archivo", family: archivo.style.fontFamily },
  { id: "space-grotesk", label: "Space Grotesk", family: spaceGrotesk.style.fontFamily },
  { id: "graphik", label: "Graphik (local)", family: '"Graphik", ui-sans-serif, system-ui, sans-serif' },
  { id: "system", label: "System UI", family: "ui-sans-serif, system-ui, sans-serif" },
]

const monospace: FontOption[] = [
  { id: "geist-mono", label: "Geist Mono", family: geistMono.style.fontFamily },
  { id: "plex-mono", label: "IBM Plex Mono", family: plexMono.style.fontFamily },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: jetbrainsMono.style.fontFamily },
  { id: "system-mono", label: "System mono", family: "ui-monospace, SFMono-Regular, Menlo, monospace" },
]

const first = (options: FontOption[], id: string) => [
  ...options.filter((font) => font.id === id),
  ...options.filter((font) => font.id !== id),
]

export const fontOptions: { sans: FontOption[]; heading: FontOption[]; mono: FontOption[] } = {
  sans: first(proportional, stockFonts.sans),
  heading: first(proportional, stockFonts.heading),
  mono: first(monospace, stockFonts.mono),
}
