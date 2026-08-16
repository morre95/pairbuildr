export function isSubscriptionModel(model: { options: Record<string, unknown> } | undefined) {
  return model?.options.billingMode === "subscription"
}
