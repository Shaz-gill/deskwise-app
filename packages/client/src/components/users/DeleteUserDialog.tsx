import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from 'axios';
import type { ApiUser } from '../../pages/UsersPage';
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

async function deleteUser(id: string): Promise<void> {
   await axios.delete(`/api/users/${id}`, { withCredentials: true });
}

interface DeleteUserDialogProps {
   user: ApiUser;
   // Controlled the same externally-driven way as EditUserDialog — opened
   // by UserRowActions.tsx's dropdown "Delete" item, not its own trigger.
   open: boolean;
   onOpenChange: (open: boolean) => void;
}

// Confirmation dialog for deleting a user (soft delete server-side — see
// DELETE /api/users/:id). Built directly from the ui/dialog.tsx primitives
// rather than UserFormDialog: there's no form here, just a Cancel/Delete
// choice, and UserFormDialog's shell is form-specific (hardcoded <form
// onSubmit>, no destructive-variant submit button).
export function DeleteUserDialog({
   user,
   open,
   onOpenChange: setOpen,
}: DeleteUserDialogProps) {
   const queryClient = useQueryClient();

   const mutation = useMutation({
      mutationFn: () => deleteUser(user.id),
      onSuccess: async () => {
         await queryClient.invalidateQueries({ queryKey: ['users'] });
         setOpen(false);
      },
   });

   // Lighter version of EditUserDialog's open-effect — no form to reset,
   // just clear a stale error so it doesn't linger into the next open.
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
               <DialogTitle>Delete user?</DialogTitle>
               <DialogDescription>
                  Delete {user.name}'s account? This action cannot be undone.
               </DialogDescription>
            </DialogHeader>

            {mutation.isError && (
               <Alert variant="destructive">
                  <AlertDescription>Failed to delete user</AlertDescription>
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
