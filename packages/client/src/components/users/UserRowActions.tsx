import { useState } from 'react';
import { MoreVerticalIcon } from 'lucide-react';
import { Role } from 'core';
import type { ApiUser } from '../../pages/UsersPage';
import { Button } from '../ui/button';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { DeleteUserDialog } from './DeleteUserDialog';
import { EditUserDialog } from './EditUserDialog';

export function UserRowActions({ user }: { user: ApiUser }) {
   const [editOpen, setEditOpen] = useState(false);
   const [deleteOpen, setDeleteOpen] = useState(false);

   return (
      <>
         <DropdownMenu>
            <DropdownMenuTrigger
               render={
                  <Button variant="ghost" size="icon-sm">
                     <MoreVerticalIcon />
                     <span className="sr-only">Actions for {user.name}</span>
                  </Button>
               }
            />
            <DropdownMenuContent align="end">
               <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Edit
               </DropdownMenuItem>
               <DropdownMenuItem
                  variant="destructive"
                  disabled={user.role === Role.admin}
                  onClick={() => setDeleteOpen(true)}
               >
                  Delete
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>

         <EditUserDialog
            user={user}
            open={editOpen}
            onOpenChange={setEditOpen}
         />
         <DeleteUserDialog
            user={user}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
         />
      </>
   );
}
