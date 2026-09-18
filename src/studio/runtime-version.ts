import metadata from '../../package.json'

/** Exported by the standalone player so host apps can verify their installed build. */
export const RUNTIME_VERSION: string = metadata.version
