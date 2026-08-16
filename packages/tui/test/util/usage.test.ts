import { describe, expect, test } from "bun:test"
import { isSubscriptionModel } from "../../src/util/usage"

describe("isSubscriptionModel", () => {
  test("recognizes subscription billing metadata", () => {
    expect(isSubscriptionModel({ options: { billingMode: "subscription" } })).toBe(true)
  })

  test("does not treat unmarked or missing models as subscriptions", () => {
    expect(isSubscriptionModel({ options: {} })).toBe(false)
    expect(isSubscriptionModel(undefined)).toBe(false)
  })
})
