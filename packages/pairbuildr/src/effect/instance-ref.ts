import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@pairbuildr/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~pairbuildr/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~pairbuildr/WorkspaceRef", {
  defaultValue: () => undefined,
})
