import type { Metadata } from "next"

import "./globals.css"
import "./graphik.css"
import { fontVariables } from "@/app/fonts"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { default: "Unending catalog", template: "%s · Unending" },
  description: "A personal catalog of intent-level components, built on shadcn.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased font-sans", ...fontVariables)}
    >
      {/* Scrollbars without a track background, everywhere (scrollbar-color is inherited). */}
      <body className="[scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_40%,transparent)_transparent]">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
