import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { type FormEvent, useState } from 'react';
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
   DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

async function uploadDocument(file: File): Promise<ApiKnowledgeDoc> {
   const formData = new FormData();
   formData.append('file', file);

   // Let axios set the multipart Content-Type/boundary itself — don't set
   // it manually.
   const { data } = await axios.post<{ doc: ApiKnowledgeDoc }>(
      '/api/knowledge-docs',
      formData,
      { withCredentials: true }
   );

   return data.doc;
}

// Trigger button + modal for admin document uploads — used as
// KnowledgeDocsList's toolbar action. No react-hook-form/Zod here (unlike
// CreateUserDialog) since there's no structured form data, just a file.
export function UploadDocumentDialog() {
   const queryClient = useQueryClient();
   const [open, setOpen] = useState(false);
   const [file, setFile] = useState<File | null>(null);

   const mutation = useMutation({
      mutationFn: uploadDocument,
      onSuccess: async () => {
         await queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] });
         handleOpenChange(false);
      },
   });

   function handleOpenChange(nextOpen: boolean) {
      setOpen(nextOpen);
      if (!nextOpen) {
         mutation.reset();
         setFile(null);
      }
   }

   function onSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (file) mutation.mutate(file);
   }

   return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
         <DialogTrigger render={<Button>Upload Document</Button>} />
         <DialogContent>
            <form
               onSubmit={onSubmit}
               noValidate
               className="flex flex-col gap-4"
            >
               <DialogHeader>
                  <DialogTitle>Upload Document</DialogTitle>
                  <DialogDescription>
                     Add a PDF, DOCX, TXT, or MD file to the knowledge base. It
                     will be processed in the background.
                  </DialogDescription>
               </DialogHeader>

               <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-document-file">File</Label>
                  <Input
                     id="upload-document-file"
                     type="file"
                     accept=".pdf,.docx,.txt,.md"
                     onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                     }
                  />
               </div>

               {mutation.isError && (
                  <Alert variant="destructive">
                     <AlertDescription>
                        {axios.isAxiosError(mutation.error) &&
                        mutation.error.response?.data?.error
                           ? mutation.error.response.data.error
                           : 'Failed to upload document'}
                     </AlertDescription>
                  </Alert>
               )}

               <DialogFooter>
                  <DialogClose
                     render={<Button variant="outline" type="button" />}
                  >
                     Cancel
                  </DialogClose>
                  <Button type="submit" disabled={!file || mutation.isPending}>
                     {mutation.isPending ? 'Uploading…' : 'Upload'}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
