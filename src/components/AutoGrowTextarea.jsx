import { useEffect, useRef } from 'react'

// A textarea that grows to fit its content automatically, instead of
// clipping text or relying on the user to notice they can manually drag
// a resize handle. Still respects the `style` prop for everything else
// (colors, border, font) — only height behavior changes.
export default function AutoGrowTextarea({ value, style, minHeight = 64, maxHeight = 400, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${next}px`
  }, [value, minHeight, maxHeight])

  return (
    <textarea
      ref={ref}
      value={value}
      style={{ ...style, minHeight, maxHeight, overflowY: 'auto', resize: 'vertical' }}
      {...props}
    />
  )
}
