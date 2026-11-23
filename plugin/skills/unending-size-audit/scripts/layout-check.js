// eslint-disable-next-line @typescript-eslint/no-unused-expressions
;(function checkLayout(root) {
  const INTERACTIVE =
    "button, a[href], input:not([type=range]):not([type=hidden]), textarea, select, [role=button], [role=slider], [role=combobox], [role=tab]"
  const style = (element) => getComputedStyle(element)

  const shown = (element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 1 || rect.height <= 1) return false
    for (let node = element; node; node = node.parentElement) {
      const s = style(node)
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false
      if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("inert")) return false
      if (node.getAttribute("data-layout-check") === "ignore") return false
    }
    return true
  }

  const visibleBox = (element) => {
    const r = element.getBoundingClientRect()
    let box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    for (let node = element.parentElement; node && node !== root.parentElement; node = node.parentElement) {
      const s = style(node)
      if (s.overflowX === "visible" && s.overflowY === "visible") continue
      const c = node.getBoundingClientRect()
      box = {
        left: Math.max(box.left, c.left),
        right: Math.min(box.right, c.right),
        top: Math.max(box.top, c.top),
        bottom: Math.min(box.bottom, c.bottom),
      }
      if (box.right - box.left < 2 || box.bottom - box.top < 2) return null
    }
    return box
  }

  const ownText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join("")
      .trim()

  const textLines = (element) => {
    const tops = new Set()
    for (const node of element.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) if (rect.width > 1) tops.add(Math.round(rect.top))
    }
    return tops.size
  }

  const intersects = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3

  const fragments = (element) => {
    const clip = boxes.get(element)
    const rects = style(element).display === "inline" ? [...element.getClientRects()] : [element.getBoundingClientRect()]
    return rects
      .map((r) => ({
        left: Math.max(r.left, clip.left),
        right: Math.min(r.right, clip.right),
        top: Math.max(r.top, clip.top),
        bottom: Math.min(r.bottom, clip.bottom),
      }))
      .filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1)
  }
  const collide = (a, b) => {
    const fb = fragments(b)
    return fragments(a).some((ra) => fb.some((rb) => intersects(ra, rb)))
  }

  const label = (element) => {
    const slot = element.getAttribute("data-slot")
    const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)
    return `${slot || element.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`
  }

  const path = (element) => {
    const parts = []
    for (let node = element; node && node !== root && parts.length < 6; node = node.parentElement) {
      const slot = node.getAttribute("data-slot")
      if (slot) {
        parts.unshift(`[data-slot="${slot}"]`)
        if (parts.length > 1) break
        continue
      }
      parts.unshift(node.tagName.toLowerCase())
    }
    return parts.join(" > ")
  }

  const issues = []
  const report = (kind, element, detail) => {
    issues.push({ kind, detail, element: label(element), path: path(element) })
    element.setAttribute("data-layout-issue", kind)
  }

  document.querySelectorAll("[data-layout-issue]").forEach((element) => element.removeAttribute("data-layout-issue"))
  const boxes = new Map()
  const elements = [...root.querySelectorAll("*")].filter((element) => {
    if (!shown(element)) return false
    const box = visibleBox(element)
    if (box) boxes.set(element, box)
    return Boolean(box)
  })

  for (const element of elements) {
    const s = style(element)
    const rect = element.getBoundingClientRect()
    const text = ownText(element)

    if (text.length >= 6 && !element.closest("pre, code, kbd, input, textarea")) {
      const lines = textLines(element)
      if (lines >= 2 && text.length / lines < 7)
        report("crushed", element, `${lines} lines in ${Math.round(rect.width)}px`)
    }

    if (
      text.length > 2 &&
      /hidden|clip/.test(s.overflowX) &&
      s.textOverflow !== "ellipsis" &&
      element.scrollWidth > element.clientWidth + 1
    )
      report("clipped", element, `${element.scrollWidth}px of text in ${element.clientWidth}px`)

    if (s.position !== "absolute" && s.position !== "fixed") {
      for (let box = element.parentElement; box && box !== root; box = box.parentElement) {
        const b = style(box)
        if (b.overflowX !== "visible") break
        const drawn =
          parseFloat(b.borderTopLeftRadius) > 0 &&
          (parseFloat(b.borderLeftWidth) > 0 || b.backgroundColor !== "rgba(0, 0, 0, 0)")
        if (!drawn) continue
        const r = box.getBoundingClientRect()
        const out = Math.max(rect.right - r.right, r.left - rect.left)
        if (out > 1) report("spill", element, `${Math.round(out)}px outside ${label(box)}`)
        break
      }
    }
  }

  const controls = elements.filter((element) => element.matches(INTERACTIVE))
  const texts = elements.filter((element) => ownText(element).length > 1 && !element.matches(INTERACTIVE))
  for (let i = 0; i < controls.length; i++) {
    const a = controls[i]
    for (const b of [...controls.slice(i + 1), ...texts]) {
      if (a.contains(b) || b.contains(a) || b.closest(INTERACTIVE) === a) continue
      if (collide(a, b)) report("overlap", a, `on top of ${label(b)}`)
    }
  }
  for (let i = 0; i < texts.length; i++) {
    const a = texts[i]
    for (const b of texts.slice(i + 1)) {
      if (a.contains(b) || b.contains(a)) continue
      if (collide(a, b)) report("overlap", a, `on top of ${label(b)}`)
    }
  }

  return issues
})
