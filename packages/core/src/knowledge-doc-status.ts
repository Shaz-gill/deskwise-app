export const KnowledgeDocStatus = {
   Processing: 'processing',
   Ready: 'ready',
   Failed: 'failed',
} as const;

export type KnowledgeDocStatus =
   (typeof KnowledgeDocStatus)[keyof typeof KnowledgeDocStatus];
