# Test fixtures

`models-api.json` is a verbatim snapshot of the third-party models.dev catalog
(`https://models.dev/api.json`). It is deliberately **not** rebranded: it is upstream
data, and editing it would make the fixture stop being a faithful snapshot of what the
catalog actually serves.

That is why it still contains `opencode` provider entries — models.dev lists OpenCode Zen
as one of many providers, exactly as it lists every other vendor. Those strings describe
someone else's product, not this one.

Regenerate with `curl -s https://models.dev/api.json > models-api.json`.
