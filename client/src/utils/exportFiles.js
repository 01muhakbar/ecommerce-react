const UTF8_BOM = "\uFEFF";

const escapeCsvValue = (value) => {
  const normalized =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const triggerBlobDownload = (blob, fileName) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export const downloadJsonFile = (payload, fileName) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json; charset=utf-8",
  });
  triggerBlobDownload(blob, fileName);
};

export const downloadCsvFile = (columns, rows, fileName) => {
  const headers = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => escapeCsvValue(row?.[column.key]))
        .join(",")
    )
    .join("\n");
  const csv = body ? `${headers}\n${body}` : headers;
  const blob = new Blob([UTF8_BOM, csv], {
    type: "text/csv; charset=utf-8",
  });
  triggerBlobDownload(blob, fileName);
};
