import { afterEach, describe, expect, test } from "bun:test"
import { Option, Redacted } from "effect"
import { Flag } from "@pairbuildr/core/flag/flag"
import { ServerAuth } from "../../src/server/auth"

const original = {
  PAIRBUILDR_SERVER_PASSWORD: Flag.PAIRBUILDR_SERVER_PASSWORD,
  PAIRBUILDR_SERVER_USERNAME: Flag.PAIRBUILDR_SERVER_USERNAME,
}

afterEach(() => {
  Flag.PAIRBUILDR_SERVER_PASSWORD = original.PAIRBUILDR_SERVER_PASSWORD
  Flag.PAIRBUILDR_SERVER_USERNAME = original.PAIRBUILDR_SERVER_USERNAME
})

describe("ServerAuth", () => {
  test("does not emit auth headers without a password", () => {
    Flag.PAIRBUILDR_SERVER_PASSWORD = undefined
    Flag.PAIRBUILDR_SERVER_USERNAME = "alice"

    expect(ServerAuth.header()).toBeUndefined()
    expect(ServerAuth.headers()).toBeUndefined()
  })

  test("defaults to the pairbuildr username", () => {
    Flag.PAIRBUILDR_SERVER_PASSWORD = "secret"
    Flag.PAIRBUILDR_SERVER_USERNAME = undefined

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from("pairbuildr:secret").toString("base64")}`,
    })
  })

  test("uses the configured username", () => {
    Flag.PAIRBUILDR_SERVER_PASSWORD = "secret"
    Flag.PAIRBUILDR_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    })
  })

  test("prefers explicit credentials", () => {
    Flag.PAIRBUILDR_SERVER_PASSWORD = "secret"
    Flag.PAIRBUILDR_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers({ password: "cli-secret", username: "bob" })).toEqual({
      Authorization: `Basic ${Buffer.from("bob:cli-secret").toString("base64")}`,
    })
  })

  test("validates decoded credentials against effect config", () => {
    const config = { password: Option.some("secret"), username: "alice" }

    expect(ServerAuth.required(config)).toBe(true)
    expect(ServerAuth.authorized({ username: "alice", password: Redacted.make("secret") }, config)).toBe(true)
    expect(ServerAuth.authorized({ username: "pairbuildr", password: Redacted.make("secret") }, config)).toBe(false)
  })
})
