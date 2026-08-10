// The PairBuildr wordmark: two lines, no figlet banner.
//
//   ┌─ PairBuildr
//   └─ build alongside
//
// Degrades truecolor -> 256 -> 16 -> none. "None" covers both NO_COLOR and a
// non-TTY stdout, so piping the output never emits escape codes.

import { LINES as PARTS } from "./logo"

const BRAND = {
  rule: "#2A3A52",
  ink: "#C8D4E4",
  muted: "#6B7C93",
  accent: "#F2A93B",
}

// Text comes from the TUI logo module so the CLI banner and the TUI startup
// screen cannot drift apart.
export const LINES = [PARTS.rule + PARTS.name, PARTS.corner + PARTS.tagline] as const

export type ColorMode = "truecolor" | "256" | "16" | "none"

export function colorMode(stream: { isTTY?: boolean } = process.stdout): ColorMode {
  if (process.env["NO_COLOR"] !== undefined && process.env["NO_COLOR"] !== "") return "none"
  if (!stream.isTTY) return "none"
  const colorterm = process.env["COLORTERM"] ?? ""
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor"
  const term = process.env["TERM"] ?? ""
  if (term.includes("256color")) return "256"
  if (term === "" || term === "dumb") return "none"
  return "16"
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

// xterm-256 palette: 16 system colors are terminal-defined, so only the 6x6x6 cube
// (16-231) and the greyscale ramp (232-255) are searched for a nearest match.
function nearest256(hex: string) {
  const [r, g, b] = rgb(hex)
  const levels = [0, 95, 135, 175, 215, 255]
  const index = (v: number) => levels.reduce((best, l, i) => (Math.abs(l - v) < Math.abs(levels[best] - v) ? i : best), 0)
  const cube = 16 + 36 * index(r) + 6 * index(g) + index(b)
  const cubeDist = distance([levels[index(r)], levels[index(g)], levels[index(b)]], [r, g, b])

  const grey = Math.round((r + g + b) / 3)
  const step = Math.min(23, Math.max(0, Math.round((grey - 8) / 10)))
  const greyValue = 8 + step * 10
  const greyDist = distance([greyValue, greyValue, greyValue], [r, g, b])

  return greyDist < cubeDist ? 232 + step : cube
}

const distance = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0)

// Basic ANSI fallbacks, chosen by role rather than by nearest colour: amber is the
// only warm accent, everything structural collapses to dim.
const ANSI_16: Record<keyof typeof BRAND, string> = {
  rule: "\x1b[90m",
  ink: "\x1b[37m",
  muted: "\x1b[90m",
  accent: "\x1b[33m",
}

function paint(text: string, role: keyof typeof BRAND, mode: ColorMode) {
  if (mode === "none") return text
  if (mode === "16") return `${ANSI_16[role]}${text}\x1b[0m`
  if (mode === "256") return `\x1b[38;5;${nearest256(BRAND[role])}m${text}\x1b[0m`
  const [r, g, b] = rgb(BRAND[role])
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`
}

export function wordmark(options: { pad?: string; mode?: ColorMode } = {}) {
  const mode = options.mode ?? colorMode(process.stderr.isTTY ? process.stderr : process.stdout)
  const pad = options.pad ?? ""
  return [
    pad + paint(PARTS.rule, "rule", mode) + paint(PARTS.name, "accent", mode),
    pad + paint(PARTS.corner, "rule", mode) + paint(PARTS.tagline, "muted", mode),
  ].join("\n")
}
