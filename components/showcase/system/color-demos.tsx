"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CopyIcon,
  FileIcon,
  HomeIcon,
  InfoIcon,
  PencilIcon,
  SettingsIcon,
  TrashIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type Scheme = "light" | "dark"

const floatingChrome = "h-auto w-48 shadow-md ring-1 ring-foreground/10"

function Menu({ items, highlighted }: { items: { label: string; Icon?: React.ComponentType }[]; highlighted?: string }) {
  return (
    <Command value={highlighted ?? ""} className={floatingChrome}>
      <CommandList>
        <CommandGroup>
          {items.map(({ label, Icon }) => (
            <CommandItem key={label} value={label}>
              {Icon ? <Icon /> : null}
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function SurfacesDemo() {
  return (
    <div className="relative flex flex-col gap-3 bg-background p-4 pb-24 text-foreground">
      <p className="text-sm">The page, with its text.</p>
      <Card className="w-[75%]">
        <CardHeader>
          <CardTitle>A card</CardTitle>
          <CardDescription>Raised, bounded content.</CardDescription>
        </CardHeader>
      </Card>
      <div className="absolute right-4 bottom-4">
        <Menu items={[{ label: "A popover" }, { label: "floats above" }]} />
      </div>
    </div>
  )
}

function ActionsDemo() {
  return (
    <div className="flex flex-col gap-4 bg-background p-4 text-foreground">
      <div className="flex flex-wrap gap-2">
        <Button tabIndex={-1}>Save</Button>
        <Button tabIndex={-1} variant="secondary">
          Cancel
        </Button>
      </div>
      <Menu
        highlighted="Duplicate"
        items={[
          { label: "Rename", Icon: PencilIcon },
          { label: "Duplicate", Icon: CopyIcon },
          { label: "Delete", Icon: TrashIcon },
        ]}
      />
    </div>
  )
}

const statuses = [
  { tone: "", variant: "destructive", Icon: CircleAlertIcon, text: "Couldn't save" },
  { tone: "text-success", variant: "default", Icon: CircleCheckIcon, text: "Saved" },
  { tone: "text-warning", variant: "default", Icon: TriangleAlertIcon, text: "Draft expires soon" },
  { tone: "text-info", variant: "default", Icon: InfoIcon, text: "Shared with 3 people" },
] as const

function StatusDemo() {
  return (
    <div className="flex flex-col gap-2 bg-background p-4 text-foreground">
      {statuses.map(({ tone, variant, Icon, text }) => (
        <Alert key={text} variant={variant} className={tone}>
          <Icon />
          <AlertTitle>{text}</AlertTitle>
        </Alert>
      ))}
    </div>
  )
}

function QuietDemo() {
  return (
    <div className="flex flex-col gap-3 bg-background p-4 text-foreground">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">Quarterly report</p>
        <p className="text-sm text-muted-foreground">Updated 2 hours ago</p>
      </div>
      <div className="flex h-20 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No comments yet</div>
    </div>
  )
}

function LinesDemo() {
  return (
    <div className="flex flex-col gap-4 bg-background p-4 text-foreground">
      <Input tabIndex={-1} readOnly placeholder="Email address" />
      <Separator />
      <Button tabIndex={-1} variant="outline" className="w-fit border-ring ring-3 ring-ring/50">
        Focused
      </Button>
    </div>
  )
}

const series = [
  { fill: "bg-chart-1", height: "h-[80%]" },
  { fill: "bg-chart-2", height: "h-[60%]" },
  { fill: "bg-chart-3", height: "h-[90%]" },
  { fill: "bg-chart-4", height: "h-[45%]" },
  { fill: "bg-chart-5", height: "h-[70%]" },
]

function ChartsDemo() {
  return (
    <div className="bg-background p-4 text-foreground">
      <div className="flex h-36 items-end gap-3 border-b border-border">
        {series.map(({ fill, height }) => (
          <span key={fill} className={cn("flex-1 rounded-t-md", fill, height)} />
        ))}
      </div>
    </div>
  )
}

const sidebarItems = [
  { label: "Home", Icon: HomeIcon, active: false },
  { label: "Files", Icon: FileIcon, active: true },
  { label: "Settings", Icon: SettingsIcon, active: false },
]

function SidebarDemo() {
  return (
    <SidebarProvider className="min-h-0" style={{ "--sidebar-width": "13rem" } as React.CSSProperties}>
      <Sidebar collapsible="none" className="border-r border-sidebar-border">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tabIndex={-1}>
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <HomeIcon className="size-4" />
                </span>
                <span className="font-medium">Acme</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarSeparator className="mx-0" />
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {sidebarItems.map(({ label, Icon, active }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton isActive={active} tabIndex={-1}>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <div className="flex-1 bg-background p-4 text-sm text-muted-foreground">Page</div>
    </SidebarProvider>
  )
}

const demos: Record<string, () => React.ReactNode> = {
  Surfaces: SurfacesDemo,
  Actions: ActionsDemo,
  Status: StatusDemo,
  Quiet: QuietDemo,
  "Lines and focus": LinesDemo,
  Charts: ChartsDemo,
  Sidebar: SidebarDemo,
}

export function ColorDemo({ group, scheme }: { group: string; scheme: Scheme }) {
  const Demo = demos[group]
  if (!Demo) return null
  return (
    <div inert className={cn(scheme === "dark" ? "dark ds-dark" : "ds-light", "overflow-hidden rounded-xl border border-border")}>
      <Demo />
    </div>
  )
}
