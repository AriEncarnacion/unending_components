"use client"

import * as React from "react"
import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  CopyIcon,
  EllipsisIcon,
  InfoIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { Readout, Section } from "./section"

/** One overlay: what it is, how it moves, and the live control that opens it. */
function Tile({
  name,
  motion,
  children,
}: {
  name: string
  motion: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{name}</span>
        <Readout value={motion} className="text-pretty" />
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  const run = (label: string) => {
    setOpen(false)
    toast(label)
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SearchIcon data-icon="inline-start" />
        Search
        <Kbd className="ml-1">⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search the rota"
        description="Jump to a person, shift or action"
      >
        {/* The stock dialog doesn't supply the cmdk root, so the list needs its own Command. */}
        <Command>
          <CommandInput placeholder="Search people, shifts and actions" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup heading="People">
              {["Alex Moreno", "Jules Lee", "Priya Rao"].map((person) => (
                <CommandItem
                  key={person}
                  onSelect={() => run(`Opened ${person}`)}
                >
                  <UserRoundIcon />
                  {person}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run("New override started")}>
                <ArrowRightLeftIcon />
                New override
                <CommandShortcut>⌘O</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => run("Jumped to now")}>
                <CalendarClockIcon />
                Jump to now
                <CommandShortcut>⌘J</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export function OverlaysAndFeedback() {
  const [announce, setAnnounce] = React.useState(true)
  return (
    <Section
      id="overlays"
      title="Overlays and feedback"
      description="Every stock overlay and toast, live, so you can feel how things arrive and leave. Each tile says how it moves; every action ends in a toast. Press ⌘K anywhere on this page for the command palette."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile name="Dropdown menu" motion="fade + zoom 95% + 8px slide · 100ms">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              Shift actions
              <EllipsisIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Alex · Primary</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => toast("Editing shift")}>
                  <PencilIcon />
                  Edit shift
                  <DropdownMenuShortcut>E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Shift duplicated")}>
                  <CopyIcon />
                  Duplicate
                  <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightLeftIcon />
                    Hand to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {["Jules Lee", "Priya Rao", "Mateo Cruz"].map((person) => (
                      <DropdownMenuItem
                        key={person}
                        onClick={() => toast.success(`Handed to ${person}`)}
                      >
                        {person}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={announce}
                onCheckedChange={setAnnounce}
              >
                Announce handoff
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => toast.error("Shift removed")}
              >
                <Trash2Icon />
                Remove shift
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Tile>

        <Tile name="Popover" motion="fade + zoom 95% + 8px slide · 100ms">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" />}>
              Quick edit
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <PopoverHeader>
                <PopoverTitle>Handoff time</PopoverTitle>
                <PopoverDescription>
                  When Alex hands back to Mateo.
                </PopoverDescription>
              </PopoverHeader>
              <div className="flex gap-2">
                <Input
                  aria-label="Handoff time"
                  defaultValue="Sat 03:07"
                  className="font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => toast.success("Handoff moved")}
                >
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </Tile>

        <Tile
          name="Hover card and tooltip"
          motion="hover card 100ms after a delay · tooltip 150ms"
        >
          <HoverCard>
            <HoverCardTrigger
              render={<Button variant="link" size="sm" className="px-0" />}
            >
              @alex
            </HoverCardTrigger>
            <HoverCardContent className="w-64">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback>AM</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Alex Moreno</span>
                  <span className="text-xs text-muted-foreground">
                    Primary until Sat 03:07 · 3 overrides this month
                  </span>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="About overrides"
                />
              }
            >
              <InfoIcon />
            </TooltipTrigger>
            <TooltipContent>Overrides replace part of a shift</TooltipContent>
          </Tooltip>
        </Tile>

        <Tile
          name="Context menu"
          motion="fade + zoom 95% · 100ms, at the pointer"
        >
          <ContextMenu>
            <ContextMenuTrigger className="grid h-16 w-full place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Right-click a shift
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onClick={() => toast("Editing shift")}>
                <PencilIcon />
                Edit
                <ContextMenuShortcut>E</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toast("Shift duplicated")}>
                <CopyIcon />
                Duplicate
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => toast.error("Shift removed")}
              >
                <Trash2Icon />
                Remove
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </Tile>

        <Tile
          name="Dialog"
          motion="overlay fade · panel fade + zoom 95% · 100ms"
        >
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Edit shift
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit shift</DialogTitle>
                <DialogDescription>
                  Alex covers Primary on an override.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="dialog-start">Starts</FieldLabel>
                    <Input
                      id="dialog-start"
                      defaultValue="Fri 11:07"
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="dialog-end">Ends</FieldLabel>
                    <Input
                      id="dialog-end"
                      defaultValue="Sat 03:07"
                      className="font-mono"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="dialog-note">Note</FieldLabel>
                  <Textarea id="dialog-note" placeholder="Why the override" />
                </Field>
              </FieldGroup>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <DialogClose
                  render={<Button />}
                  onClick={() => toast.success("Shift saved")}
                >
                  Save
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Tile>

        <Tile name="Confirm" motion="alert dialog · fade + zoom 95% · 100ms">
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" size="sm" />}
            >
              Delete rotation
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete the primary rotation?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Six people lose their upcoming shifts. This can’t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => toast.error("Rotation deleted")}
                >
                  Delete rotation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Tile>

        <Tile name="Sheet" motion="slide 2.5rem + fade · 200ms ease-in-out">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="sm" />}>
              Shift details
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Alex Moreno</SheetTitle>
                <SheetDescription>
                  Primary · override, Fri 11:07 to Sat 03:07
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4 text-sm text-muted-foreground">
                <p>Covering part of Mateo’s shift. Mateo is back at 03:07.</p>
                <p>Announced in #support-rota at 11:02.</p>
              </div>
              <SheetFooter>
                <Button onClick={() => toast("Override extended by 2h")}>
                  Extend 2 hours
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="sm" />}>
              From left
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Rotations</SheetTitle>
                <SheetDescription>
                  Primary, Secondary, Holiday cover
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </Tile>

        <Tile name="Drawer" motion="slides up · drag the handle to dismiss">
          <Drawer showSwipeHandle>
            <DrawerTrigger render={<Button variant="outline" size="sm" />}>
              Handoff notes
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-md">
                <DrawerHeader>
                  <DrawerTitle>Handoff notes</DrawerTitle>
                  <DrawerDescription>
                    What Mateo should know at 03:07.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4">
                  <Textarea
                    aria-label="Handoff notes"
                    defaultValue="Two incidents still open; both are waiting on the vendor."
                  />
                </div>
                <DrawerFooter>
                  <Button onClick={() => toast.success("Notes saved")}>
                    Save notes
                  </Button>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </Tile>

        <Tile name="Toasts" motion="slide in and stack · hover to expand">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.success("Rotation published", {
                description: "Six people notified.",
              })
            }
          >
            Success
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.error("Couldn’t publish", {
                description: "The rota service timed out.",
              })
            }
          >
            Error
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast("Shift removed", {
                action: {
                  label: "Undo",
                  onClick: () => toast.success("Shift restored"),
                },
              })
            }
          >
            With undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.promise(
                new Promise((resolve) => setTimeout(resolve, 1800)),
                {
                  loading: "Publishing rotation…",
                  success: "Rotation published",
                  error: "Couldn’t publish",
                }
              )
            }
          >
            Progress
          </Button>
        </Tile>

        <Tile
          name="Command palette"
          motion="dialog motion · ⌘K anywhere on this page"
        >
          <CommandPalette />
        </Tile>

        <Tile name="Accordion" motion="height · 200ms">
          <Accordion className="w-full">
            <AccordionItem value="rules">
              <AccordionTrigger>Handoff rules</AccordionTrigger>
              <AccordionContent>
                Handoffs happen at 08:00 local time; overrides can start any
                hour.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="gaps">
              <AccordionTrigger>Gaps</AccordionTrigger>
              <AccordionContent>
                A gap is flagged when a lane is empty for more than an hour.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Tile>
      </div>
    </Section>
  )
}
