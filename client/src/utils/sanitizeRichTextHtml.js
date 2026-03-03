export const sanitizeRichTextHtml = (rawHtml) => {
  let html = String(rawHtml ?? "");
  if (!html.trim()) return "";

  // Remove full script/style/iframe/object/embed blocks.
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, "");
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, "");
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gis, "");
  html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gis, "");
  html = html.replace(/<embed\b[^>]*>/gis, "");

  // Remove inline event handlers.
  html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // Neutralize javascript: in href/src.
  html = html.replace(
    /\s(href|src)\s*=\s*"javascript:[^"]*"/gi,
    (_match, attrName) => ` ${String(attrName || "").toLowerCase()}="#"`
  );
  html = html.replace(
    /\s(href|src)\s*=\s*'javascript:[^']*'/gi,
    (_match, attrName) => ` ${String(attrName || "").toLowerCase()}='#'`
  );
  html = html.replace(
    /\s(href|src)\s*=\s*javascript:[^\s>]+/gi,
    (_match, attrName) => ` ${String(attrName || "").toLowerCase()}="#"`
  );

  // Force safe anchor attributes.
  html = html.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
    const cleanedAttrs = String(attrs ?? "")
      .replace(/\srel\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
      .replace(/\starget\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
    return `<a${cleanedAttrs} target="_blank" rel="noopener noreferrer">`;
  });

  return html;
};

export default sanitizeRichTextHtml;
