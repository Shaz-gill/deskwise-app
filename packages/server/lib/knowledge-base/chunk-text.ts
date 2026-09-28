// Splits text into overlapping windows — plain string slicing rather than a
// LangChain text splitter, since chunking itself isn't an AI feature and
// this is a handful of lines (see CLAUDE.md's Simplicity section).
export function chunkText(
   text: string,
   chunkSize = 1000,
   overlap = 200
): string[] {
   const trimmed = text.trim();
   if (!trimmed) return [];

   const step = chunkSize - overlap;
   const chunks: string[] = [];

   for (let start = 0; start < trimmed.length; start += step) {
      const chunk = trimmed.slice(start, start + chunkSize).trim();
      if (chunk) chunks.push(chunk);
      if (start + chunkSize >= trimmed.length) break;
   }

   return chunks;
}
