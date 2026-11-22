"use client"

import * as React from "react"
import {
  ArrowRightLeftIcon,
  BellIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  EllipsisIcon,
  MessageSquareIcon,
  MoonIcon,
  PlusIcon,
  SendIcon,
  SunIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AgentTrace, type AgentStep } from "@/registry/unending/agent-trace/agent-trace"
import { FileToolbar, type FileStatus } from "@/registry/unending/file-toolbar/file-toolbar"

import { Section } from "./section"

const T0 = new Date(2026, 10, 20, 17, 0).getTime()
const steps: AgentStep[] = [
  { id: "a", kind: "search", title: "Searched the rota", status: "done", result: "2 schedules", startedAt: T0, endedAt: T0 + 2100 },
  { id: "b", kind: "read", title: "Checked overrides", status: "done", result: "1 found", startedAt: T0 + 2100, endedAt: T0 + 4600 },
  { id: "c", kind: "command", title: "Ran the coverage check", status: "error", detail: "The rota service timed out.", startedAt: T0 + 4600, endedAt: T0 + 9600 },
]

const people = [
  { initials: "AM", name: "Alex Moreno", note: "Primary · override until Sat 03:07", badge: "On call" },
  { initials: "JL", name: "Jules Lee", note: "Secondary · until Sat 04:00", badge: "On call" },
  { initials: "PR", name: "Priya Rao", note: "Primary · from Sun 08:00", badge: "Next" },
]

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function ComposedSection() {
  const { resolvedTheme, setTheme } = useTheme()
  const [status, setStatus] = React.useState<FileStatus>({ state: "unsaved" })
  const [addOpen, setAddOpen] = React.useState(false)
  const [assignee, setAssignee] = React.useState("Priya Rao")

  const save = () => {
    setStatus({ state: "saving" })
    void pause(700).then(() => {
      setStatus({ state: "saved", savedAt: Date.now() })
      toast.success("Rotation saved", {
        action: { label: "Undo", onClick: () => setStatus({ state: "unsaved" }) },
      })
    })
  }

  const publish = () =>
    toast.promise(pause(1600), {
      loading: "Publishing rotation…",
      success: "Rotation published. Six people notified.",
      error: "Couldn’t publish",
    })

  return (
    <Section
      id="composed"
      title="Composed"
      description="One realistic screen built only from stock components and two catalog entries. Everything on it works: Publish, Add shift, Notify, Save, Preview, Cancel, the person menus and Assign all open the real overlays and toasts. Tune any token and watch it here first."
      aside={
        <Button variant="outline" size="sm" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          <SunIcon data-icon="inline-start" className="dark:hidden" />
          <MoonIcon data-icon="inline-start" className="hidden dark:block" />
          {/* CSS picks the label, so the server and client render the same text. */}
          <span className="dark:hidden">Switch to dark</span>
          <span className="hidden dark:inline">Switch to light</span>
        </Button>
      }
    >
      <div
        className="grid gap-4 rounded-2xl bg-muted/40 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        onKeyDown={(event) => {
          if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            save()
          }
        }}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <FileToolbar
            name="primary-rotation.rota"
            status={status}
            actions={[
              { id: "add", label: "Add shift", icon: PlusIcon, onSelect: () => setAddOpen(true) },
              { id: "notify", label: "Notify", icon: BellIcon, onSelect: () => toast("Handoff announced in #support-rota") },
            ]}
            primaryAction={{ id: "publish", label: "Publish", icon: SendIcon, onSelect: publish }}
          />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add a shift</DialogTitle>
                <DialogDescription>Adds a shift to the primary rotation.</DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="add-person">Person</FieldLabel>
                  <Input id="add-person" defaultValue="Mateo Cruz" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="add-start">Starts</FieldLabel>
                    <Input id="add-start" defaultValue="Mon 08:00" className="font-mono" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="add-end">Ends</FieldLabel>
                    <Input id="add-end" defaultValue="Wed 08:00" className="font-mono" />
                  </Field>
                </div>
              </FieldGroup>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <DialogClose
                  render={<Button />}
                  onClick={() => {
                    setStatus({ state: "unsaved" })
                    toast.success("Shift added for Mateo Cruz")
                  }}
                >
                  Add shift
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>Rotation settings</CardTitle>
              <CardDescription>Who covers primary, and how handoffs are announced.</CardDescription>
              <CardAction>
                <Badge variant="secondary">{status.state === "saved" ? "Saved" : "Draft"}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="general">
                <TabsList>
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
                  <TabsTrigger value="people">People</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="pt-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="composed-name">Rotation name</FieldLabel>
                      <Input id="composed-name" defaultValue="Primary support" onChange={() => setStatus({ state: "unsaved" })} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="composed-length">Shift length</FieldLabel>
                        <Select defaultValue="48" onValueChange={() => setStatus({ state: "unsaved" })}>
                          <SelectTrigger id="composed-length" className="w-full">
                            <SelectValue>{(value: string) => `${value} hours`}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12">12 hours</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="48">48 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="composed-start">Starts</FieldLabel>
                        <Input id="composed-start" defaultValue="Mon 08:00" className="font-mono" onChange={() => setStatus({ state: "unsaved" })} />
                      </Field>
                    </div>
                    <Field orientation="horizontal">
                      <Switch id="composed-notify" defaultChecked onCheckedChange={() => setStatus({ state: "unsaved" })} />
                      <FieldLabel htmlFor="composed-notify">Announce handoffs in #support-rota</FieldLabel>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="composed-note">Note for the person on call</FieldLabel>
                      <Textarea id="composed-note" placeholder="Anything they should know before their shift" onChange={() => setStatus({ state: "unsaved" })} />
                      <FieldDescription>Shown in the handoff message.</FieldDescription>
                    </Field>
                  </FieldGroup>
                </TabsContent>
                <TabsContent value="handoffs" className="pt-4 text-sm text-muted-foreground">
                  Handoffs happen at 08:00 local time.
                </TabsContent>
                <TabsContent value="people" className="pt-4 text-sm text-muted-foreground">
                  Six people in the rotation.
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Save <Kbd>⌘S</Kbd>
              </span>
              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="ghost" />}>Cancel</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The rotation goes back to how it was when you opened it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep editing</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                          setStatus({ state: "saved" })
                          toast("Changes discarded")
                        }}
                      >
                        Discard
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Sheet>
                  <SheetTrigger render={<Button variant="outline" />}>Preview</SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Handoff message preview</SheetTitle>
                      <SheetDescription>What #support-rota sees at each handoff.</SheetDescription>
                    </SheetHeader>
                    <div className="mx-4 rounded-lg border bg-muted/40 p-3 text-sm">
                      <p className="font-medium">Primary support · handoff</p>
                      <p className="text-muted-foreground">Alex hands back to Mateo at Sat 03:07. Two incidents still open.</p>
                    </div>
                    <SheetFooter>
                      <Button onClick={() => toast("Test message sent to you")}>Send me a test</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
                <Button onClick={save} disabled={status.state === "saving"}>
                  {status.state === "saving" ? "Saving…" : "Save rotation"}
                </Button>
              </div>
            </CardFooter>
          </Card>
          <div className="flex flex-wrap gap-2">
            {(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map((variant) => (
              <Button key={variant} variant={variant} onClick={() => toast(`${variant} button`)} className="capitalize">
                {variant}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Secondary has a 4-hour gap</AlertTitle>
            <AlertDescription>Tue 24 Nov, 04:00 to 08:00. Assign someone or accept the gap.</AlertDescription>
            <AlertAction>
              <Popover>
                <PopoverTrigger render={<Button size="xs" variant="outline" />}>Assign</PopoverTrigger>
                <PopoverContent align="end" className="w-64">
                  <PopoverHeader>
                    <PopoverTitle>Cover the gap</PopoverTitle>
                    <PopoverDescription>Tue 24 Nov, 04:00 to 08:00</PopoverDescription>
                  </PopoverHeader>
                  <Select value={assignee} onValueChange={(value) => value && setAssignee(value)}>
                    <SelectTrigger className="w-full" aria-label="Person">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Priya Rao", "Jules Lee", "Mateo Cruz"].map((person) => (
                        <SelectItem key={person} value={person}>{person}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => toast.success(`${assignee} covers the gap`)}>
                    Assign {assignee.split(" ")[0]}
                  </Button>
                </PopoverContent>
              </Popover>
            </AlertAction>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClockIcon className="size-4 text-muted-foreground" />
                On call now
              </CardTitle>
              <CardDescription>Coverage for the next 7 days</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>Covered</span>
                  <span className="font-mono text-muted-foreground tabular-nums">164 / 168h</span>
                </div>
                <Progress value={97} aria-label="Coverage" />
              </div>
              <Separator />
              <ItemGroup>
                {people.map((person) => (
                  <Item key={person.name} size="sm" className="px-0">
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback>{person.initials}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{person.name}</ItemTitle>
                      <ItemDescription>{person.note}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant={person.badge === "Next" ? "outline" : "default"}>{person.badge}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${person.name}`} />}
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => toast(`Message sent to ${person.name.split(" ")[0]}`)}>
                            <MessageSquareIcon />
                            Message
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`${person.name.split(" ")[0]}’s shift handed to Mateo`)}>
                            <ArrowRightLeftIcon />
                            Hand off shift
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => toast.error(`${person.name.split(" ")[0]} removed from the rotation`)}>
                            Remove from rotation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Agent activity</CardTitle>
              <CardDescription>The last check, as the agent ran it.</CardDescription>
            </CardHeader>
            <CardContent>
              <AgentTrace steps={steps} defaultOpen />
            </CardContent>
          </Card>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
