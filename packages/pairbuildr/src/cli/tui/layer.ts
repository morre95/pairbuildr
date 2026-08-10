import { run as runTui, type TuiInput } from "@pairbuildr/tui"
import { Global } from "@pairbuildr/core/global"
import { AppNodeBuilder } from "@pairbuildr/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
