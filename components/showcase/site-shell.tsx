"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { LayoutGridIcon, PaletteIcon, SwatchBookIcon } from "lucide-react"
import { cn } from "cn"

import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { BackButton, SystemMenu, SystemName } from "@/components/showcase/design-systems/switcher"
import { SidebarResizer, useSidebarWidth } from "@/components/showcase/sidebar-resizer"
import { UnendingMark } from "@/components/showcase/unending-mark"
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
  const [sidebarWidth, setSidebarWidth, saveSidebarWidth] = useSidebarWidth()
  // The design system and entry pages lay out their own panes at full
  // height, each scrolling on its own.
  const split = pathname === "/system" || pathname.startsWith("/c/")
  return (
    <SidebarProvider
      style={sidebarWidth ? ({ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties) : undefined}
    >
      <Sidebar>
        <SidebarHeader className="flex-row items-center gap-2 px-4 pt-4 pb-2">
          <BackButton />
          <UnendingMark className="text-foreground" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-4">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
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
          <SidebarGroup className="px-4">
            <SidebarGroupLabel>Entries</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <React.Suspense fallback={<EntryLinks entries={entries} pathname={pathname} openEntry={null} />}>
                  <EntryLinksWithParams entries={entries} pathname={pathname} />
                </React.Suspense>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarResizer width={sidebarWidth} onWidthChange={setSidebarWidth} onWidthCommit={saveSidebarWidth} />
      <SidebarInset className={cn("min-w-0", split && "h-svh overflow-clip")}>
        <header className="sticky top-0 z-10 grid h-12 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
          <SidebarTrigger />
          <SystemName />
          <div className="justify-self-end">
            <SystemMenu />
          </div>
        </header>
        {split ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          <div
            className={cn(
              "mx-auto w-full px-4 py-10 sm:px-8",
              pathname === "/palette" ? "max-w-[96rem]" : "max-w-5xl"
            )}
          >
            {children}
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function EntryLinksWithParams({ entries, pathname }: { entries: NavEntry[]; pathname: string }) {
  const openEntry = useSearchParams().get("entry")
  return <EntryLinks entries={entries} pathname={pathname} openEntry={openEntry} />
}

/**
 * On the design system page, an entry opens in a pane
 * beside the system instead of replacing it. Everywhere else it navigates to
 * the entry's own page.
 */
function EntryLinks({
  entries,
  pathname,
  openEntry,
}: {
  entries: NavEntry[]
  pathname: string
  openEntry: string | null
}) {
  const { href } = useDesignSystems()
  const inPane = pathname === "/system"
  return entries.map((entry) => (
    <SidebarMenuItem key={entry.name}>
      <SidebarMenuButton
        render={
          <Link
            href={inPane ? href(`/system?entry=${entry.name}`) : href(`/c/${entry.name}`)}
            scroll={inPane ? false : undefined}
          />
        }
        isActive={inPane ? openEntry === entry.name : pathname === `/c/${entry.name}`}
      >
        {entry.title}
      </SidebarMenuButton>
      {entry.status !== "stable" ? (
        <SidebarMenuBadge className="font-mono text-[0.6875rem] font-normal text-muted-foreground">
          {entry.status}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  ))
}
