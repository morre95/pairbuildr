/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizePairbuildrContent from "./skill/customize-pairbuildr.md" with { type: "text" }

export const CustomizePairbuildrContent = customizePairbuildrContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-pairbuildr",
            description:
              "Use ONLY when the user is editing or creating pairbuildr's own configuration: pairbuildr.json, pairbuildr.jsonc, files under .pairbuildr/, or files under ~/.config/pairbuildr/. Also use when creating or fixing pairbuildr agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring pairbuildr itself.",
            location: AbsolutePath.make("/builtin/customize-pairbuildr.md"),
            content: CustomizePairbuildrContent,
          }),
        }),
      )
    })
  }),
})
