import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// Takes a buffer rather than a file path so it works the same whether the
// doc came off local disk or was downloaded from S3 (see storage.ts) —
// dispatches on filename extension, not MIME type, since by the time this
// runs, the upload route's multer fileFilter/extension check has already
// restricted uploads to these four types.
export async function extractText(
   buffer: Buffer,
   filename: string
): Promise<string> {
   const extension = path.extname(filename).toLowerCase();

   switch (extension) {
      case '.txt':
      case '.md':
         return buffer.toString('utf-8');

      case '.pdf': {
         const parser = new PDFParse({ data: buffer });
         try {
            const result = await parser.getText();
            return result.text;
         } finally {
            await parser.destroy();
         }
      }

      case '.docx': {
         const result = await mammoth.extractRawText({ buffer });
         return result.value;
      }

      default:
         throw new Error(`Unsupported file extension: ${extension}`);
   }
}
