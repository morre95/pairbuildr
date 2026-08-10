import { getComponentCatalogue } from "@opentui/solid/components"
import { registerSpinner } from "opentui-spinner/solid"

export function registerPairbuildrSpinner() {
  if (!getComponentCatalogue().spinner) registerSpinner()
}
