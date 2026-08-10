import path from "path"

process.env.PAIRBUILDR_DB = ":memory:"
process.env.PAIRBUILDR_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.PAIRBUILDR_DISABLE_MODELS_FETCH = "true"
