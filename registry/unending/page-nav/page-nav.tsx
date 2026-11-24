"use client"

import * as React from "react"
import { ChevronRightIcon, SearchIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useEntryTuning } from "@/lib/tuning"

export type PageNavItem = {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
  items?: PageNavItem[]
}

export type PageNavSection = {
  label?: string
  items: PageNavItem[]
}

export type PageNavLink = (
  props: React.ComponentProps<"a"> & { href: string }
) => React.ReactElement

export type PageNavProps = Omit<
  React.ComponentProps<typeof Sidebar>,
  "children"
> & {
  sections: PageNavSection[]
  currentPath: string
  renderLink?: PageNavLink
  header?: React.ReactNode
  footer?: React.ReactNode
  filterThreshold?: number
}

const defaultLink: PageNavLink = (props) => <a {...props} />

function isCurrent(href: string, path: string) {
  return path === href || (href !== "/" && path.startsWith(`${href}/`))
}

function contains(item: PageNavItem, path: string): boolean {
  return (
    isCurrent(item.href, path) ||
    (item.items ?? []).some((child) => contains(child, path))
  )
}

function matches(item: PageNavItem, query: string): boolean {
  return (
    item.title.toLowerCase().includes(query) ||
    (item.items ?? []).some((child) => matches(child, query))
  )
}

function countPages(sections: PageNavSection[]) {
  const count = (items: PageNavItem[]): number =>
    items.reduce((total, item) => total + 1 + count(item.items ?? []), 0)
  return sections.reduce((total, section) => total + count(section.items), 0)
}

function PageNav({
  sections,
  currentPath,
  renderLink = defaultLink,
  header,
  footer,
  filterThreshold: filterThresholdProp,
  collapsible: collapsibleProp,
  ...props
}: PageNavProps) {
  const tuning = useEntryTuning("page-nav", {
    filterThreshold: 12,
    collapsible: "icon",
  })
  const filterThreshold = filterThresholdProp ?? tuning.filterThreshold
  const collapsible =
    collapsibleProp ??
    (tuning.collapsible as NonNullable<PageNavProps["collapsible"]>)
  const [query, setQuery] = React.useState("")
  const filterId = React.useId()
  const showFilter = countPages(sections) >= filterThreshold
  const needle = query.trim().toLowerCase()
  const Link = renderLink

  const visible = sections
    .map((section) => ({
      ...section,
      items: needle
        ? section.items.filter((item) => matches(item, needle))
        : section.items,
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div data-slot="page-nav" className="contents">
      <Sidebar collapsible={collapsible} {...props}>
        {header || showFilter ? (
          <SidebarHeader>
            {header}
            {showFilter ? (
              <div className="relative group-data-[collapsible=icon]:hidden">
                <label htmlFor={filterId} className="sr-only">
                  Filter pages
                </label>
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
                <SidebarInput
                  id={filterId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setQuery("")
                  }}
                  placeholder="Filter pages"
                  className="pl-8"
                />
              </div>
            ) : null}
          </SidebarHeader>
        ) : null}
        <SidebarContent>
          {visible.length === 0 ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">
              No pages match “{query.trim()}”.
            </p>
          ) : null}
          {visible.map((section, index) => (
            <SidebarGroup key={section.label ?? index}>
              {section.label ? (
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) =>
                    item.items?.length ? (
                      <Collapsible
                        key={`${item.href}:${needle ? "filtering" : "browsing"}`}
                        defaultOpen={
                          Boolean(needle) || contains(item, currentPath)
                        }
                        render={<SidebarMenuItem />}
                      >
                        <CollapsibleTrigger
                          render={
                            <SidebarMenuButton
                              tooltip={item.title}
                              isActive={!needle && contains(item, currentPath)}
                            />
                          }
                          className="group/page-nav-trigger"
                        >
                          {item.icon ? <item.icon /> : null}
                          <span>{item.title}</span>
                          <ChevronRightIcon className="ml-auto transition-transform group-aria-expanded/page-nav-trigger:rotate-90" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items
                              .filter(
                                (child) =>
                                  !needle ||
                                  matches(child, needle) ||
                                  matches(item, needle)
                              )
                              .map((child) => (
                                <SidebarMenuSubItem key={child.href}>
                                  <SidebarMenuSubButton
                                    isActive={isCurrent(
                                      child.href,
                                      currentPath
                                    )}
                                    render={
                                      <Link
                                        href={child.href}
                                        aria-current={
                                          isCurrent(child.href, currentPath)
                                            ? "page"
                                            : undefined
                                        }
                                      >
                                        <span>{child.title}</span>
                                      </Link>
                                    }
                                  />
                                </SidebarMenuSubItem>
                              ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isCurrent(item.href, currentPath)}
                          render={
                            <Link
                              href={item.href}
                              aria-current={
                                isCurrent(item.href, currentPath)
                                  ? "page"
                                  : undefined
                              }
                            >
                              {item.icon ? <item.icon /> : null}
                              <span>{item.title}</span>
                            </Link>
                          }
                        />
                        {item.badge !== undefined ? (
                          <SidebarMenuBadge className="tabular-nums">
                            {item.badge}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
        <SidebarRail />
      </Sidebar>
    </div>
  )
}

export { PageNav }
