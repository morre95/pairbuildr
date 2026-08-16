import type { AssistantMessage } from "@pairbuildr/sdk/v2"
import type { TuiPlugin, TuiPluginApi } from "@pairbuildr/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo } from "solid-js"
import { isSubscriptionModel } from "../../util/usage"

const id = "internal:sidebar-context"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const msg = createMemo(() => props.api.state.session.messages(props.session_id))
  const session = createMemo(() => props.api.state.session.get(props.session_id))
  const cost = createMemo(() => session()?.cost ?? 0)

  const state = createMemo(() => {
    const last = msg().findLast((item): item is AssistantMessage => item.role === "assistant" && item.tokens.output > 0)
    const providerID = last?.providerID ?? session()?.model?.providerID
    const modelID = last?.modelID ?? session()?.model?.id
    const model = props.api.state.provider.find((item) => item.id === providerID)?.models[modelID ?? ""]
    if (!last) {
      return {
        tokens: 0,
        percent: null,
        subscription: isSubscriptionModel(model),
      }
    }

    const tokens =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    return {
      tokens,
      percent: model?.limit.context ? Math.round((tokens / model.limit.context) * 100) : null,
      subscription: isSubscriptionModel(model),
    }
  })

  const costLabel = createMemo(() => {
    if (cost() > 0) return `${money.format(cost())} spent`
    if (state().subscription) return "included with subscription"
    return `${money.format(cost())} spent`
  })

  return (
    <box>
      <text fg={theme().text}>
        <b>Context</b>
      </text>
      <text fg={theme().textMuted}>{state().tokens.toLocaleString()} tokens</text>
      <text fg={theme().textMuted}>{state().percent ?? 0}% used</text>
      <text fg={theme().textMuted}>{costLabel()}</text>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
