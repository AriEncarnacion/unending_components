"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGridIcon, MoonIcon, PaletteIcon, SunIcon, SwatchBookIcon } from "lucide-react"
import { cn } from "cn"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { SystemHeader } from "@/components/showcase/design-systems/switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

type NavEntry = { name: string; title: string; status: string }

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  )
}

export function SiteShell({
  entries,
  children,
}: {
  entries: NavEntry[]
  children: React.ReactNode
}) {
  const { href } = useDesignSystems()
  // Paths within the system: "/<system>/palette" → "/palette".
  const pathname = "/" + usePathname().split("/").slice(2).join("/")
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/" className="px-2 py-1.5 font-semibold tracking-tight" aria-label="All design systems">
            Unending
            <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
              catalog
            </span>
          </Link>
          <SystemHeader />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href={href()} />} isActive={pathname === "/"}>
                    <LayoutGridIcon />
                    Entries
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href={href("/system")} />} isActive={pathname === "/system"}>
                    <SwatchBookIcon />
                    Design system
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href={href("/palette")} />} isActive={pathname === "/palette"}>
                    <PaletteIcon />
                    Palette
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Entries</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {entries.map((entry) => (
                  <SidebarMenuItem key={entry.name}>
                    <SidebarMenuButton
                      render={<Link href={href(`/c/${entry.name}`)} />}
                      isActive={pathname === `/c/${entry.name}`}
                    >
                      {entry.title}
                    </SidebarMenuButton>
                    {entry.status !== "stable" ? (
                      <SidebarMenuBadge className="font-mono text-[0.65rem] font-normal text-muted-foreground">
                        {entry.status}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-2 border-b bg-background/90 px-3 backdrop-blur">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <div
          className={cn(
            "mx-auto w-full px-4 py-10 sm:px-8",
            pathname === "/system" || pathname === "/palette"
              ? "max-w-[96rem]"
              : pathname.startsWith("/c/")
                ? "max-w-7xl"
                : "max-w-5xl"
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
