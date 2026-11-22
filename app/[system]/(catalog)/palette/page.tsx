import type { Metadata } from "next"

import { PalettePage } from "@/components/showcase/palette/palette-page"

export const metadata: Metadata = {
  title: "Palette",
  description: "Grade and refine the colour scales in OKLCH.",
}

export default function Page() {
  return <PalettePage />
}
