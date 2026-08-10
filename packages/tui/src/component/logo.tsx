import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { LINES } from "../logo"

// Two-line wordmark. Thin rules, amber for the name, muted for the tagline.
// opentui resolves theme colors down to whatever the terminal supports, so the
// truecolor -> 256 -> 16 ladder is handled below this component.
export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <box flexDirection="row">
        <text fg={theme.border} selectable={false}>
          {LINES.rule}
        </text>
        <text fg={theme.primary} attributes={TextAttributes.BOLD} selectable={false}>
          {LINES.name}
        </text>
      </box>
      <box flexDirection="row">
        <text fg={theme.border} selectable={false}>
          {LINES.corner}
        </text>
        <text fg={theme.textMuted} selectable={false}>
          {LINES.tagline}
        </text>
      </box>
    </box>
  )
}
