"use client"

import * as React from "react"
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar"
import { cn } from "cn"
import { CircleAlertIcon, EllipsisIcon, FileIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEntryTuning } from "@/lib/tuning"

export type FileAction = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: () => void
  /** Shown in the tooltip and menu. Display only; bind keys in your app. */
  shortcut?: string
  /** Lower stays visible longer as the toolbar narrows. Defaults to list order. */
  priority?: number
  disabled?: boolean
  destructive?: boolean
  /** Always in the More menu, e.g. Delete. */
  menuOnly?: boolean
}

export type FileStatus =
  | { state: "saved"; savedAt?: number }
  | { state: "saving" }
  | { state: "unsaved" }
  | { state: "error"; message?: string; onRetry?: () => void }

export type FileToolbarProps = Omit<React.ComponentProps<"div">, "children"> & {
  name: string
  /** Allow renaming in place. Called with the trimmed new name. */
  onRename?: (name: string) => void
  status?: FileStatus
  icon?: React.ReactNode
  actions?: FileAction[]
  /** The one main thing to do with the file, e.g. Share or Publish. */
  primaryAction?: Omit<FileAction, "priority" | "menuOnly" | "destructive">
}

// A minute-resolution clock for "Saved 2 min ago". Null on the server, so
// the first client render matches and the relative time fills in after.
let minute = Date.now()
function subscribeMinute(notify: () => void) {
  minute = Date.now()
  const interval = window.setInterval(() => {
    minute = Date.now()
    notify()
  }, 30_000)
  return () => window.clearInterval(interval)
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" })

function savedLabel(savedAt: number | undefined, now: number | null) {
  if (savedAt === undefined || now === null) return "Saved"
  const minutes = Math.round((savedAt - now) / 60_000)
  if (minutes > -1) return "Saved just now"
  if (minutes > -60) return `Saved ${relative.format(minutes, "minute")}`
  return `Saved ${relative.format(Math.round(minutes / 60), "hour")}`
}

function StatusLine({ status }: { status: FileStatus }) {
  const now = React.useSyncExternalStore<number | null>(subscribeMinute, () => minute, () => null)
  const content = (() => {
    switch (status.state) {
      case "saving":
        return (
          <>
            <Spinner className="size-3" />
            Saving…
          </>
        )
      case "unsaved":
        return (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
            Unsaved changes
          </>
        )
      case "error":
        return (
          <span className="flex items-center gap-1.5 text-destructive">
            <CircleAlertIcon className="size-3" />
            {status.message ?? "Couldn’t save"}
            {status.onRetry ? (
              <ToolbarPrimitive.Button
                render={<Button variant="link" size="xs" className="h-auto p-0 text-destructive" />}
                onClick={status.onRetry}
              >
                Retry
              </ToolbarPrimitive.Button>
            ) : null}
          </span>
        )
      default:
        return savedLabel(status.savedAt, now)
    }
  })()
  return (
    <span role="status" className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
      {content}
    </span>
  )
}

function FileName({ name, onRename }: { name: string; onRename?: (name: string) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(name)
  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== name) onRename?.(next)
  }
  if (editing)
    return (
      <ToolbarPrimitive.Input
        render={<Input className="h-7 w-full max-w-72 px-1.5 text-sm font-medium" />}
        aria-label="File name"
        autoFocus
        value={draft}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onFocus={(event: React.FocusEvent<HTMLInputElement>) => {
          // Select the name without its extension, as file managers do.
          const dot = event.target.value.lastIndexOf(".")
          event.target.setSelectionRange(0, dot > 0 ? dot : event.target.value.length)
        }}
        onBlur={commit}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") commit()
          if (event.key === "Escape") {
            setDraft(name)
            setEditing(false)
          }
        }}
      />
    )
  return (
    <ToolbarPrimitive.Button
      render={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 max-w-full min-w-0 justify-start px-1.5 text-sm font-medium"
        />
      }
      disabled={!onRename}
      focusableWhenDisabled={false}
      title={onRename ? "Rename" : undefined}
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          setDraft(name)
          setEditing(true)
        }
      }}
      className="disabled:opacity-100"
    >
      <span className="truncate">{name}</span>
    </ToolbarPrimitive.Button>
  )
}

function FileToolbar({
  name,
  onRename,
  status,
  icon,
  actions = [],
  primaryAction,
  className,
  ...props
}: FileToolbarProps) {
  const tuning = useEntryTuning("file-toolbar", { actionVariant: "ghost" })
  const actionVariant = tuning.actionVariant as "ghost" | "outline" | "secondary"
  const ordered = React.useMemo(
    () =>
      actions
        .map((action, index) => ({ action, rank: action.priority ?? index }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ action }) => action),
    [actions]
  )
  const inline = ordered.filter((action) => !action.menuOnly)
  const needsMenu = ordered.some((action) => action.menuOnly)
  // Re-measure when the set of actions changes, not on every render: `actions`
  // is often a fresh array. Label and font changes resize the ruler instead.
  const layoutKey = ordered.map((action) => `${action.id}:${action.menuOnly ? 1 : 0}`).join("|")

  // Two layers, after Primer's ActionBar and Fluent's overflow manager:
  // - CSS guarantees nothing overlaps. Actions sit in a one-row, clipped,
  //   wrapping strip, so one that doesn't fit drops onto a hidden second row.
  //   That holds in the server HTML, before measuring, mid-resize and inside a
  //   scaled or zooming parent.
  // - JS picks which actions show, by priority, from layout sizes
  //   (offsetWidth / clientWidth, which transforms don't change) and the
  //   measured gap, padding and More button rather than fixed pixels.
  const slot = React.useRef<HTMLDivElement>(null)
  const strip = React.useRef<HTMLDivElement>(null)
  const ruler = React.useRef<HTMLDivElement>(null)
  const [fit, setFit] = React.useState(inline.length)
  React.useLayoutEffect(() => {
    const slotEl = slot.current
    const stripEl = strip.current
    const rulerEl = ruler.current
    if (!slotEl || !stripEl || !rulerEl) return
    const px = (value: string) => parseFloat(value) || 0
    const update = () => {
      const items = Array.from(rulerEl.querySelectorAll<HTMLElement>("[data-measure=action]"))
      const more = rulerEl.querySelector<HTMLElement>("[data-measure=more]")
      // offsetWidth rounds to whole pixels; +1 keeps a rounded-down action
      // from being clipped by the strip.
      const widths = items.map((item) => item.offsetWidth + 1)
      const stripStyle = getComputedStyle(stripEl)
      const gap = px(stripStyle.columnGap)
      const padding = px(stripStyle.paddingLeft) + px(stripStyle.paddingRight)
      const slotGap = px(getComputedStyle(slotEl).columnGap)
      const room = slotEl.clientWidth - padding
      const fitIn = (space: number) => {
        let used = 0
        let count = 0
        for (const width of widths) {
          const next = used + (count ? gap : 0) + width
          if (next > space) break
          used = next
          count += 1
        }
        return count
      }
      const moreSpace = room - (more?.offsetWidth ?? 0) - slotGap
      const all = fitIn(needsMenu ? moreSpace : room)
      setFit(all === widths.length ? all : fitIn(moreSpace))
    }
    // Observing reports the first size right away, before paint. The ruler
    // too: its actions grow when the web font loads, with no resize of the slot.
    const observer = new ResizeObserver(update)
    observer.observe(slotEl)
    observer.observe(rulerEl)
    return () => observer.disconnect()
  }, [layoutKey, needsMenu])

  const visible = inline.slice(0, fit)
  const overflow = [...inline.slice(fit), ...ordered.filter((action) => action.menuOnly)]
  const restoreOrder = (list: FileAction[]) =>
    actions.filter((action) => list.includes(action))

  return (
    <ToolbarPrimitive.Root
      data-slot="file-toolbar"
      aria-label={`${name} actions`}
      className={cn(
        // A size container: below 20rem the primary action shows just its icon.
        "@container/file-toolbar flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border bg-background px-2",
        className
      )}
      {...props}
    >
      <span className="grid size-8 shrink-0 place-items-center text-muted-foreground [&_svg]:size-4">
        {icon ?? <FileIcon />}
      </span>
      {/* The name is the identifier: it truncates before anything overlaps. */}
      <div className="flex min-w-12 shrink flex-col justify-center leading-none">
        <FileName name={name} onRename={onRename} />
        {status ? (
          <span className="px-1.5">
            <StatusLine status={status} />
          </span>
        ) : null}
      </div>

      {/* Always room for More, so it never lands on the name. */}
      <div ref={slot} className="relative flex min-w-8 flex-1 items-center justify-end gap-1">
        {/* Off-screen copy of every inline action and of More, measured to decide what fits. */}
        <div
          ref={ruler}
          aria-hidden="true"
          inert
          className="pointer-events-none invisible absolute top-0 right-0 flex"
        >
          {inline.map((action) => (
            <Button key={action.id} data-measure="action" variant={actionVariant} size="sm" tabIndex={-1}>
              {action.icon ? <action.icon data-icon="inline-start" /> : null}
              {action.label}
            </Button>
          ))}
          <Button data-measure="more" variant="ghost" size="icon-sm" tabIndex={-1}>
            <EllipsisIcon />
          </Button>
        </div>

        {/* One clipped row: an action that doesn't fit wraps out of sight rather
            than overlapping. Padded so focus rings aren't clipped; the second
            row starts below the clip. */}
        <div
          ref={strip}
          data-slot="file-toolbar-actions"
          className="flex h-10 min-w-0 flex-1 flex-wrap content-start items-center justify-end gap-x-1 gap-y-3 overflow-hidden px-1 py-1.5"
        >
          {restoreOrder(visible).map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger
                render={
                  <ToolbarPrimitive.Button
                    render={<Button variant={actionVariant} size="sm" />}
                    disabled={action.disabled}
                    onClick={action.onSelect}
                    // Toolbar keeps disabled buttons focusable via aria-disabled.
                    className={cn("aria-disabled:opacity-50", action.destructive && "text-destructive")}
                  />
                }
              >
                {action.icon ? <action.icon data-icon="inline-start" /> : null}
                {action.label}
              </TooltipTrigger>
              {action.shortcut ? (
                <TooltipContent>
                  {action.label} <span className="ml-1 opacity-70">{action.shortcut}</span>
                </TooltipContent>
              ) : null}
            </Tooltip>
          ))}
        </div>

        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <ToolbarPrimitive.Button
                  render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {restoreOrder(overflow.filter((action) => !action.menuOnly)).map((action) => (
                <OverflowItem key={action.id} action={action} />
              ))}
              {overflow.some((action) => action.menuOnly) && overflow.some((action) => !action.menuOnly) ? (
                <DropdownMenuSeparator />
              ) : null}
              {restoreOrder(overflow.filter((action) => action.menuOnly)).map((action) => (
                <OverflowItem key={action.id} action={action} />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {primaryAction ? (
        <>
          <Separator orientation="vertical" className="h-5" />
          <ToolbarPrimitive.Button
            render={<Button size="sm" className="aria-disabled:opacity-50 @max-xs/file-toolbar:px-2" />}
            disabled={primaryAction.disabled}
            onClick={primaryAction.onSelect}
          >
            {primaryAction.icon ? <primaryAction.icon data-icon="inline-start" /> : null}
            {/* Icon only in a narrow toolbar; the label stays for screen readers. */}
            <span className={primaryAction.icon ? "@max-xs/file-toolbar:sr-only" : undefined}>{primaryAction.label}</span>
          </ToolbarPrimitive.Button>
        </>
      ) : null}
    </ToolbarPrimitive.Root>
  )
}

function OverflowItem({ action }: { action: FileAction }) {
  return (
    <DropdownMenuItem
      disabled={action.disabled}
      variant={action.destructive ? "destructive" : "default"}
      onClick={action.onSelect}
    >
      {action.icon ? <action.icon /> : null}
      {action.label}
      {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  )
}

export { FileToolbar }
