import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect } from 'react';
import type { ApiKnowledgeDoc } from './KnowledgeDocsList';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '../ui/dialog';

async function deleteKnowledgeDoc(id: number): Promise<void> {
   await axios.delete(`/api/knowledge-docs/${id}`, { withCredentials: true });
}

interface DeleteKnowledgeDocDialogProps {
   doc: ApiKnowledgeDoc;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}

// Confirmation dialog for deleting a knowledge base document — removes the
// file, the DB row, and its Pinecone vectors server-side (see DELETE
// /api/knowledge-docs/:id). Mirrors DeleteUserDialog's shape: built
// directly from the ui/dialog.tsx primitives, no form.
export function DeleteKnowledgeDocDialog({
   doc,
   open,
   onOpenChange: setOpen,
}: DeleteKnowledgeDocDialogProps) {
   const queryClient = useQueryClient();

   const mutation = useMutation({
      mutationFn: () => deleteKnowledgeDoc(doc.id),
      onSuccess: async () => {
         await queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] });
         setOpen(false);
      },
   });

   useEffect(() => {
      if (!open) {
         mutation.reset();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [open]);

   return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Delete document?</DialogTitle>
               <DialogDescription>
                  Delete "{doc.filename}"? This removes the file and all of its
                  embeddings from the knowledge base. This action cannot be
                  undone.
               </DialogDescription>
            </DialogHeader>

            {mutation.isError && (
               <Alert variant="destructive">
                  <AlertDescription>Failed to delete document</AlertDescription>
               </Alert>
            )}

            <DialogFooter>
               <DialogClose render={<Button variant="outline" type="button" />}>
                  Cancel
               </DialogClose>
               <Button
                  variant="destructive"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
               >
                  {mutation.isPending ? 'Deleting…' : 'Delete'}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
