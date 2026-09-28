import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { KnowledgeDocStatus } from 'core';
import { EyeIcon, Trash2Icon } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '../ui/table';
import { DeleteKnowledgeDocDialog } from './DeleteKnowledgeDocDialog';
import { UploadDocumentDialog } from './UploadDocumentDialog';

export type ApiKnowledgeDoc = {
   id: number;
   filename: string;
   status: KnowledgeDocStatus;
   chunkCount: number;
   error: string | null;
   createdAt: string; // ISO string over the wire
   uploadedBy: { name: string };
};

async function fetchKnowledgeDocs(): Promise<ApiKnowledgeDoc[]> {
   const { data } = await axios.get<{ docs: ApiKnowledgeDoc[] }>(
      '/api/knowledge-docs',
      { withCredentials: true }
   );

   return data.docs;
}

const STATUS_BADGE_VARIANT: Record<
   KnowledgeDocStatus,
   'secondary' | 'default' | 'destructive'
> = {
   [KnowledgeDocStatus.Processing]: 'secondary',
   [KnowledgeDocStatus.Ready]: 'default',
   [KnowledgeDocStatus.Failed]: 'destructive',
};

function KnowledgeDocRowActions({ doc }: { doc: ApiKnowledgeDoc }) {
   const [deleteOpen, setDeleteOpen] = useState(false);

   return (
      <>
         <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={
               <a
                  href={`/api/knowledge-docs/${doc.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
               />
            }
         >
            <EyeIcon />
            <span className="sr-only">View {doc.filename}</span>
         </Button>
         <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteOpen(true)}
         >
            <Trash2Icon />
            <span className="sr-only">Delete {doc.filename}</span>
         </Button>
         <DeleteKnowledgeDocDialog
            doc={doc}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
         />
      </>
   );
}

export function KnowledgeDocsList() {
   const { data, isPending, isError } = useQuery({
      queryKey: ['knowledge-docs'],
      queryFn: fetchKnowledgeDocs,
      // Self-terminating poll: only keep refetching while something is
      // still ingesting, since that's the only state that changes on its
      // own (no other precedent for this in the codebase, so this follows
      // React Query's own recommended idiom for "poll until settled").
      refetchInterval: (query) =>
         query.state.data?.some(
            (doc) => doc.status === KnowledgeDocStatus.Processing
         )
            ? 2000
            : false,
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
               Documents used to ground AI-suggested replies.
            </p>
            <UploadDocumentDialog />
         </div>

         {isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to load documents. Please try again later.
               </AlertDescription>
            </Alert>
         )}

         {isPending && (
            <p className="text-sm text-muted-foreground">Loading…</p>
         )}

         {data && data.length === 0 && (
            <p className="text-sm text-muted-foreground">
               No documents uploaded yet.
            </p>
         )}

         {data && data.length > 0 && (
            <Table>
               <TableHeader>
                  <TableRow>
                     <TableHead>Filename</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Chunks</TableHead>
                     <TableHead>Uploaded by</TableHead>
                     <TableHead>Uploaded</TableHead>
                     <TableHead>Actions</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {data.map((doc) => (
                     <TableRow key={doc.id}>
                        <TableCell>{doc.filename}</TableCell>
                        <TableCell>
                           <div className="flex flex-col gap-0.5">
                              <Badge
                                 variant={STATUS_BADGE_VARIANT[doc.status]}
                                 className="w-fit capitalize"
                              >
                                 {doc.status}
                              </Badge>
                              {doc.status === KnowledgeDocStatus.Failed &&
                                 doc.error && (
                                    <span className="text-xs text-destructive">
                                       {doc.error}
                                    </span>
                                 )}
                           </div>
                        </TableCell>
                        <TableCell>{doc.chunkCount}</TableCell>
                        <TableCell>{doc.uploadedBy.name}</TableCell>
                        <TableCell>
                           {moment(doc.createdAt).format('ll')}
                        </TableCell>
                        <TableCell>
                           <KnowledgeDocRowActions doc={doc} />
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         )}
      </div>
   );
}
