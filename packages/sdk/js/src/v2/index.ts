export * from "./client.js"
export * from "./server.js"

import { createPairbuildrClient } from "./client.js"
import { createPairbuildrServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createPairbuildr(options?: ServerOptions) {
  const server = await createPairbuildrServer({
    ...options,
  })

  const client = createPairbuildrClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
