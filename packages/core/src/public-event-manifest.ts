export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@pairbuildr/schema/event"
import { EventManifest } from "@pairbuildr/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)
