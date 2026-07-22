/** Swift-compatible `.gustrashare` package (`SharePackage` / schemaVersion 2). */

export const SHARE_SCHEMA_VERSION = 2;
export const SHARE_FILE_EXTENSION = 'gustrashare';
/** Matches Swift `ShareInbox.utiIdentifier`. */
export const SHARE_UTI = 'com.philip.gustra.share';

/**
 * ISO-8601 suitable for Swift `JSONDecoder.dateDecodingStrategy = .iso8601`
 * (no fractional seconds).
 */
export function toShareIso8601(input: Date | string | number): string {
  const date =
    typeof input === 'string' || typeof input === 'number'
      ? new Date(input)
      : input;
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
