import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// Dispatches on file extension (not MIME type — by the time this runs, the
// upload route's multer fileFilter/extension check has already restricted
// uploads to these four types).
export async function extractText(filePath: string): Promise<string> {
   const extension = path.extname(filePath).toLowerCase();

   switch (extension) {
      case '.txt':
      case '.md':
         return fs.readFile(filePath, 'utf-8');

      case '.pdf': {
         const data = await fs.readFile(filePath);
         const parser = new PDFParse({ data });
         try {
            const result = await parser.getText();
            return result.text;
         } finally {
            await parser.destroy();
         }
      }

      case '.docx': {
         const result = await mammoth.extractRawText({ path: filePath });
         return result.value;
      }

      default:
         throw new Error(`Unsupported file extension: ${extension}`);
   }
}
