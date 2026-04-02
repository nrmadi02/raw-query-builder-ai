import ExcelJS from "exceljs";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportToCSV(
  rows: Record<string, unknown>[],
  filename: string,
) {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(columns.map(escapeCSV).join(","));

  // Data rows
  for (const row of rows) {
    csvRows.push(columns.map((col) => escapeCSV(row[col])).join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportToExcel(
  rows: Record<string, unknown>[],
  columns: string[],
  filename: string,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  // Header row
  worksheet.addRow(columns);

  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  // Data rows
  for (const row of rows) {
    worksheet.addRow(
      columns.map((col) => {
        const val = row[col];
        return val === undefined ? "" : val;
      }),
    );
  }

  // Auto-fit columns (approximate)
  worksheet.columns.forEach((column, i) => {
    const header = columns[i] || "";
    let maxLen = header.length;
    for (const row of rows) {
      const val = String(row[columns[i]] ?? "");
      if (val.length > maxLen) maxLen = val.length;
    }
    column.width = Math.min(maxLen + 2, 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
