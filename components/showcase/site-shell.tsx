"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGridIcon, PaletteIcon, SwatchBookIcon } from "lucide-react"
import { cn } from "cn"

import { useDesignSystems } from "@/components/showcase/design-systems/provider"
import { BackButton, SystemMenu, SystemName } from "@/components/showcase/design-systems/switcher"
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
  return (
    <SidebarProvider>
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
        <header className="sticky top-0 z-10 grid h-12 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
          <SidebarTrigger />
          <SystemName />
          <div className="justify-self-end">
            <SystemMenu />
          </div>
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
