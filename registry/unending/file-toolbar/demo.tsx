"use client"

import * as React from "react"
import {
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  HistoryIcon,
  PencilIcon,
  Redo2Icon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react"

import { Example } from "@/components/showcase/example"
import {
  FileToolbar,
  type FileAction,
  type FileStatus,
} from "@/registry/unending/file-toolbar/file-toolbar"


function useLog() {
  const [last, setLast] = React.useState("Nothing yet")
  return { last, log: (what: string) => () => setLast(what) }
}

function actionsFor(log: (what: string) => () => void): FileAction[] {
  return [
    { id: "undo", label: "Undo", icon: Undo2Icon, shortcut: "⌘Z", onSelect: log("Undo"), priority: 2 },
    { id: "redo", label: "Redo", icon: Redo2Icon, shortcut: "⇧⌘Z", onSelect: log("Redo"), priority: 3, disabled: true },
    { id: "history", label: "History", icon: HistoryIcon, onSelect: log("History"), priority: 4 },
    { id: "download", label: "Download", icon: DownloadIcon, shortcut: "⌘D", onSelect: log("Download"), priority: 1 },
    { id: "duplicate", label: "Duplicate", icon: CopyIcon, onSelect: log("Duplicate"), priority: 5 },
    { id: "delete", label: "Delete", icon: Trash2Icon, onSelect: log("Delete"), destructive: true, menuOnly: true },
  ]
}

function Resizable() {
  const [name, setName] = React.useState("coverage-q4-rotations.csv")
  // Two minutes before the page loaded, so the relative time reads naturally.
  const [savedAt] = React.useState(() => Date.now() - 2 * 60_000)
  const { last, log } = useLog()
  return (
    <div className="flex flex-col gap-4">
      <FileToolbar
        name={name}
        onRename={setName}
        icon={<FileSpreadsheetIcon />}
        status={{ state: "saved", savedAt }}
        actions={actionsFor(log)}
        primaryAction={{ id: "share", label: "Share", icon: SendIcon, onSelect: log("Share") }}
      />
      <p className="text-sm text-muted-foreground">Last action: {last}</p>
    </div>
  )
}

const statuses: { label: string; status: FileStatus }[] = [
  { label: "Unsaved", status: { state: "unsaved" } },
  { label: "Saving", status: { state: "saving" } },
  { label: "Error", status: { state: "error", message: "Offline. Changes kept locally.", onRetry: () => {} } },
]

export default function FileToolbarDemo() {
  const { log } = useLog()
  return (
    <>
      <Example
        title="Actions that make room for each other"
        description="Drag the frame's right edge to narrow it. Lower-priority actions move into More, starting with Duplicate and History, while Download and Undo hold on. Click the file name, or focus it and press F2, to rename. Arrow keys move between controls."
      >
        <Resizable />
      </Example>
      <Example title="Save states" description="Saved shows a relative time; saving, unsaved and failed saves read at a glance.">
        <div className="flex flex-col gap-3">
          {statuses.map(({ label, status }) => (
            <FileToolbar
              key={label}
              name="incident-review-2026-11.md"
              status={status}
              actions={actionsFor(log).slice(0, 2)}
              primaryAction={{ id: "publish", label: "Publish", icon: PencilIcon, onSelect: () => {} }}
            />
          ))}
        </div>
      </Example>
    </>
  )
}
