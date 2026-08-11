/** CSV parsing is deliberately deferred until a sanitized Trading 212 export is observed. */
export function parseTrading212Csv(): never {
  throw new Error('CSV normalization requires a validated sanitized export fixture.');
}
