import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { editUserSchema, type EditUserFormValues } from 'core';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { ApiUser } from '../../pages/UsersPage';
import { UserFormDialog } from './UserFormDialog';
import { UserFormFields } from './UserFormFields';

async function editUser(
   id: string,
   values: EditUserFormValues
): Promise<ApiUser> {
   const { data } = await axios.patch<{ user: ApiUser }>(
      `/api/users/${id}`,
      { ...values, password: values.password || undefined },
      { withCredentials: true }
   );

   return data.user;
}

interface EditUserDialogProps {
   user: ApiUser;
   open: boolean;
   onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({
   user,
   open,
   onOpenChange: setOpen,
}: EditUserDialogProps) {
   const queryClient = useQueryClient();

   const {
      register,
      handleSubmit,
      reset,
      formState: { errors },
   } = useForm<EditUserFormValues>({
      resolver: zodResolver(editUserSchema),
   });

   const mutation = useMutation({
      mutationFn: (values: EditUserFormValues) => editUser(user.id, values),
      onSuccess: async () => {
         await queryClient.invalidateQueries({ queryKey: ['users'] });
         setOpen(false);
      },
   });

   useEffect(() => {
      if (open) {
         reset({ name: user.name, email: user.email, password: '' });
      } else {
         mutation.reset();
      }
   }, [open]);

   function onSubmit(values: EditUserFormValues) {
      mutation.mutate(values);
   }

   return (
      <UserFormDialog
         title="Edit User"
         description={`Update ${user.name}'s account details. Leave the password blank to keep it unchanged.`}
         open={open}
         onOpenChange={setOpen}
         onFormSubmit={handleSubmit(onSubmit)}
         submitLabel="Save Changes"
         submitPendingLabel="Saving…"
         isPending={mutation.isPending}
      >
         <UserFormFields
            register={register}
            errors={errors}
            idPrefix={`edit-user-${user.id}`}
            error={mutation.error}
            errorFallback="Failed to update user"
            passwordPlaceholder="Leave blank to keep current password"
         />
      </UserFormDialog>
   );
}
