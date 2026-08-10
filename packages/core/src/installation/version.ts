declare global {
  const PAIRBUILDR_VERSION: string
  const PAIRBUILDR_CHANNEL: string
}

export const InstallationVersion = typeof PAIRBUILDR_VERSION === "string" ? PAIRBUILDR_VERSION : "local"
export const InstallationChannel = typeof PAIRBUILDR_CHANNEL === "string" ? PAIRBUILDR_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
