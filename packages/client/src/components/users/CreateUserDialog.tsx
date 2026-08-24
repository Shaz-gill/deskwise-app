import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { createUserSchema, type CreateUserFormValues } from 'core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ApiUser } from '../../pages/UsersPage';
import { Button } from '../ui/button';
import { UserFormDialog } from './UserFormDialog';
import { UserFormFields } from './UserFormFields';

async function createUser(values: CreateUserFormValues): Promise<ApiUser> {
   const { data } = await axios.post<{ user: ApiUser }>('/api/users', values, {
      withCredentials: true,
   });

   return data.user;
}

// Trigger button + modal form for admin-created users — used as
// UsersPage's DataTable `toolbarActions`. New users always get the
// server's default role ('user') — there's no role picker here.
export function CreateUserDialog() {
   const queryClient = useQueryClient();
   const [open, setOpen] = useState(false);

   const {
      register,
      handleSubmit,
      reset,
      formState: { errors },
   } = useForm<CreateUserFormValues>({
      resolver: zodResolver(createUserSchema),
      defaultValues: {
         name: '',
         email: '',
         password: '',
      },
   });

   const mutation = useMutation({
      mutationFn: createUser,
      onSuccess: async () => {
         await queryClient.invalidateQueries({ queryKey: ['users'] });
         handleOpenChange(false);
      },
   });

   function handleOpenChange(nextOpen: boolean) {
      setOpen(nextOpen);
      if (!nextOpen) {
         // Clear stale error/values so the next open starts fresh,
         // whether closed via submit success, Cancel, Escape, or overlay
         // click.
         mutation.reset();
         reset();
      }
   }

   function onSubmit(values: CreateUserFormValues) {
      mutation.mutate(values);
   }

   return (
      <UserFormDialog
         trigger={<Button>Create User</Button>}
         title="Create User"
         description="Add a new user account. They'll be able to sign in immediately with the email and password you set here."
         open={open}
         onOpenChange={handleOpenChange}
         onFormSubmit={handleSubmit(onSubmit)}
         submitLabel="Create User"
         submitPendingLabel="Creating…"
         isPending={mutation.isPending}
      >
         <UserFormFields
            register={register}
            errors={errors}
            idPrefix="create-user"
            error={mutation.error}
            errorFallback="Failed to create user"
         />
      </UserFormDialog>
   );
}
