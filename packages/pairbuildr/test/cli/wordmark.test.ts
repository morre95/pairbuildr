import { describe, expect, test } from "bun:test"
import { colorMode, LINES, wordmark } from "../../src/cli/wordmark"

describe("wordmark", () => {
  test("renders two lines with the rules and tagline", () => {
    expect(wordmark({ mode: "none" })).toBe("┌─ PairBuildr\n└─ build alongside")
    expect(LINES).toEqual(["┌─ PairBuildr", "└─ build alongside"])
  })

  test("emits no escape codes when color is off", () => {
    expect(wordmark({ mode: "none" })).not.toContain("\x1b")
  })

  test("uses 24-bit color in truecolor", () => {
    const out = wordmark({ mode: "truecolor" })
    expect(out).toContain("\x1b[38;2;242;169;59m") // accent amber on the name
    expect(out).toContain("\x1b[38;2;42;58;82m") // rule on the corners
  })

  test("falls back to indexed color at 256", () => {
    const out = wordmark({ mode: "256" })
    expect(out).toContain("\x1b[38;5;215m") // nearest cube entry to the amber accent
    expect(out).not.toContain("38;2;")
  })

  test("falls back to basic ANSI at 16", () => {
    const out = wordmark({ mode: "16" })
    expect(out).toContain("\x1b[33m") // yellow stands in for amber
    expect(out).not.toContain("38;5;")
    expect(out).not.toContain("38;2;")
  })

  test("applies padding to both lines", () => {
    expect(wordmark({ mode: "none", pad: "  " })).toBe("  ┌─ PairBuildr\n  └─ build alongside")
  })

  describe("colorMode", () => {
    const withEnv = <T>(env: Record<string, string | undefined>, body: () => T) => {
      const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
      for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      try {
        return body()
      } finally {
        for (const [k, v] of Object.entries(saved)) {
          if (v === undefined) delete process.env[k]
          else process.env[k] = v
        }
      }
    }

    test("NO_COLOR wins over a truecolor terminal", () => {
      withEnv({ NO_COLOR: "1", COLORTERM: "truecolor", TERM: "xterm-256color" }, () => {
        expect(colorMode({ isTTY: true })).toBe("none")
      })
    })

    test("an empty NO_COLOR does not disable color", () => {
      withEnv({ NO_COLOR: "", COLORTERM: "truecolor" }, () => {
        expect(colorMode({ isTTY: true })).toBe("truecolor")
      })
    })

    test("a non-TTY stream gets no color", () => {
      withEnv({ NO_COLOR: undefined, COLORTERM: "truecolor" }, () => {
        expect(colorMode({ isTTY: false })).toBe("none")
      })
    })

    test("COLORTERM selects truecolor", () => {
      withEnv({ NO_COLOR: undefined, COLORTERM: "24bit", TERM: "xterm" }, () => {
        expect(colorMode({ isTTY: true })).toBe("truecolor")
      })
    })

    test("a 256color TERM selects 256", () => {
      withEnv({ NO_COLOR: undefined, COLORTERM: undefined, TERM: "screen-256color" }, () => {
        expect(colorMode({ isTTY: true })).toBe("256")
      })
    })

    test("a plain TERM selects 16", () => {
      withEnv({ NO_COLOR: undefined, COLORTERM: undefined, TERM: "xterm" }, () => {
        expect(colorMode({ isTTY: true })).toBe("16")
      })
    })

    test("a dumb or missing TERM gets no color", () => {
      withEnv({ NO_COLOR: undefined, COLORTERM: undefined, TERM: "dumb" }, () => {
        expect(colorMode({ isTTY: true })).toBe("none")
      })
      withEnv({ NO_COLOR: undefined, COLORTERM: undefined, TERM: "" }, () => {
        expect(colorMode({ isTTY: true })).toBe("none")
      })
    })
  })
})
