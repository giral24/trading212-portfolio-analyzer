export type CsvRow = Record<string, string>;

function parseRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = content.startsWith('\uFEFF') ? content.slice(1) : content;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      if (field.length > 0) throw new Error('CSV quote must start at the beginning of a field.');
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

/**
 * Parses CSV syntax only. Provider columns remain literal until a sanitized
 * Trading 212 export establishes their stable semantic meaning.
 */
export function parseTrading212Csv(content: string): CsvRow[] {
  const [header, ...rows] = parseRows(content);
  if (header === undefined || header.length === 0) throw new Error('CSV must contain a header row.');
  if (header.some((column) => column.trim().length === 0)) throw new Error('CSV header contains an empty column name.');
  if (new Set(header).size !== header.length) throw new Error('CSV header contains duplicate column names.');

  return rows.map((row, index) => {
    if (row.length !== header.length) {
      throw new Error(`CSV row ${index + 2} expected ${header.length} columns but received ${row.length}.`);
    }
    return Object.fromEntries(header.map((column, columnIndex) => [column, row[columnIndex] ?? '']));
  });
}
