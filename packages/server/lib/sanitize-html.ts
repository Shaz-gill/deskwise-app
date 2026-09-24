import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const purify = DOMPurify(new JSDOM('').window);

export function sanitizeHtml(html: string): string {
   return purify.sanitize(html);
}
