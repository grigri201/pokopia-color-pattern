export type CsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
  issues: string[];
};

export function parseCsv(input: string): CsvParseResult {
  const records: string[][] = [];
  const recordStartLines: number[] = [];
  const issues: string[] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let lineNumber = 1;
  let recordStartLine = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      record.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      record.push(field);
      field = "";

      if (record.some((value) => value !== "")) {
        records.push(record);
        recordStartLines.push(recordStartLine);
      }

      record = [];
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      lineNumber += 1;
      recordStartLine = lineNumber;
      continue;
    }

    if (char === "\n") {
      lineNumber += 1;
    }
    field += char;
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((value) => value !== "")) {
      records.push(record);
      recordStartLines.push(recordStartLine);
    }
  }

  if (inQuotes) {
    issues.push(`Unclosed quoted CSV field starting at row ${recordStartLine}`);
  }

  const [headers = [], ...body] = records;
  const seenHeaders = new Set<string>();

  headers.forEach((header) => {
    if (seenHeaders.has(header)) {
      issues.push(`Duplicate CSV header: ${header}`);
    }
    seenHeaders.add(header);
  });

  const rows = body.map((values, index) => {
    const row: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
    });

    if (values.length !== headers.length) {
      issues.push(
        `Row ${recordStartLines[index + 1] ?? index + 2} has ${values.length} cells but header has ${headers.length}`,
      );
    }

    return {
      rowNumber: recordStartLines[index + 1] ?? index + 2,
      values: row,
    };
  });

  return { headers, rows, issues };
}
