import * as React from "react"
import { cn } from "cn"

/** One live state of a catalog entry, framed for the showcase. */
export function Example({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{title}</h2>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "min-w-0 rounded-xl border bg-background p-6 max-sm:p-4",
          className
        )}
      >
        {children}
      </div>
    </section>
  )
}
