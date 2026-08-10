// @ts-nocheck

import { PairBuildr } from "@pairbuildr/core"
import { ReadTool } from "@pairbuildr/core/tools"

const pairbuildr = PairBuildr.make({})

pairbuildr.tool.add(ReadTool)

pairbuildr.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

pairbuildr.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

pairbuildr.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await pairbuildr.session.create({
  agent: "build",
})

pairbuildr.subscribe((event) => {
  console.log(event)
})

await pairbuildr.session.prompt({
  sessionID,
  text: "hey what is up",
})

await pairbuildr.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await pairbuildr.session.wait()

console.log(await pairbuildr.session.messages(sessionID))
