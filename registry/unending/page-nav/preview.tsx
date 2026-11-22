"use client"

import * as React from "react"
import {
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  ChevronsUpDownIcon,
  FlameIcon,
  LayoutDashboardIcon,
  RepeatIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  PageNav,
  type PageNavLink,
  type PageNavSection,
} from "@/registry/unending/page-nav/page-nav"

const sections: PageNavSection[] = [
  {
    items: [{ title: "Overview", href: "/", icon: LayoutDashboardIcon }],
  },
  {
    label: "Operate",
    items: [
      { title: "Coverage", href: "/coverage", icon: CalendarClockIcon, badge: 2 },
      { title: "Incidents", href: "/incidents", icon: FlameIcon, badge: 3 },
      {
        title: "Rotations",
        href: "/rotations",
        icon: RepeatIcon,
        items: [
          { title: "Primary", href: "/rotations/primary" },
          { title: "Secondary", href: "/rotations/secondary" },
          { title: "Holiday cover", href: "/rotations/holiday" },
        ],
      },
      { title: "Alerts", href: "/alerts", icon: BellIcon },
    ],
  },
  {
    label: "Reference",
    items: [
      {
        title: "Knowledge",
        href: "/knowledge",
        icon: BookOpenIcon,
        items: [
          { title: "Runbooks", href: "/knowledge/runbooks" },
          { title: "Escalation paths", href: "/knowledge/escalation" },
          { title: "Postmortems", href: "/knowledge/postmortems" },
        ],
      },
      { title: "People", href: "/people", icon: UsersIcon },
      { title: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
]

/** A whole app frame, so the nav can be tried at full size inside an iframe. */
export function PageNavPreview({
  collapsed = false,
  initialPath = "/rotations/primary",
  filterThreshold,
}: {
  collapsed?: boolean
  initialPath?: string
  filterThreshold?: number
}) {
  const [path, setPath] = React.useState(initialPath)
  const link: PageNavLink = ({ href, onClick, ...props }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
        setPath(href)
      }}
    />
  )
  const title = path === "/" ? "Overview" : path.split("/").filter(Boolean).join(" / ")
  return (
    <SidebarProvider defaultOpen={!collapsed}>
      <PageNav
        sections={sections}
        currentPath={path}
        renderLink={link}
        filterThreshold={filterThreshold}
        header={
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              B
            </div>
            <div className="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-medium">Bearing</span>
              <span className="truncate text-xs text-muted-foreground">Support</span>
            </div>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </div>
        }
        footer={
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm group-data-[collapsible=icon]:hidden">
            <span className="grid size-7 place-items-center rounded-full bg-muted text-xs">AE</span>
            <span className="truncate">Signed in</span>
          </div>
        }
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm capitalize">{title}</span>
        </header>
        <div className="grid flex-1 gap-3 p-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 rounded-xl bg-muted/60" />
          ))}
          <div className="h-64 rounded-xl bg-muted/60 sm:col-span-3" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
