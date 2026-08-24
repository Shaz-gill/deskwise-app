import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import axios from 'axios';
import { Role } from 'core';
import moment from 'moment';
import { DataTable } from '../components/data-table';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Skeleton } from '../components/ui/skeleton';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from '../components/ui/table';
import { CreateUserDialog } from '../components/users/CreateUserDialog';
import { UserRowActions } from '../components/users/UserRowActions';

export type ApiUser = {
   id: string;
   name: string;
   email: string;
   role: Role;
   createdAt: string; // ISO string over the wire
};

async function fetchUsers(): Promise<ApiUser[]> {
   const { data } = await axios.get<{ users: ApiUser[] }>('/api/users', {
      withCredentials: true,
   });

   return data.users;
}

const columns: ColumnDef<ApiUser>[] = [
   {
      accessorKey: 'name',
      header: 'Name',
   },
   {
      accessorKey: 'email',
      header: 'Email',
   },
   {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
         <span className="capitalize">{row.getValue('role')}</span>
      ),
   },
   {
      accessorKey: 'createdAt',
      header: 'Joined',
      cell: ({ row }) =>
         moment(row.getValue<string>('createdAt')).format('MMM D, YYYY'),
   },
   {
      id: 'actions',
      header: 'Actions',
      enableHiding: false, // hiding the only way to edit a user makes no sense
      cell: ({ row }) => <UserRowActions user={row.original} />,
   },
];

const SKELETON_ROW_COUNT = 5;

function UsersTableHeader() {
   return (
      <TableHeader>
         <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
         </TableRow>
      </TableHeader>
   );
}

export function UsersPage() {
   const {
      data: users,
      isPending,
      isError,
   } = useQuery({
      queryKey: ['users'],
      queryFn: fetchUsers,
   });

   return (
      <div className="flex flex-col gap-4">
         <h1 className="font-heading text-2xl font-semibold text-foreground">
            Users
         </h1>

         {isPending && (
            <Table>
               <UsersTableHeader />
               <TableBody>
                  {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                     <TableRow key={i}>
                        <TableCell>
                           <Skeleton className="h-4 w-24 bg-muted-foreground/20" />
                        </TableCell>
                        <TableCell>
                           <Skeleton className="h-4 w-40 bg-muted-foreground/20" />
                        </TableCell>
                        <TableCell>
                           <Skeleton className="h-4 w-14 bg-muted-foreground/20" />
                        </TableCell>
                        <TableCell>
                           <Skeleton className="h-4 w-20 bg-muted-foreground/20" />
                        </TableCell>
                        <TableCell>
                           <Skeleton className="h-8 w-8 rounded-md bg-muted-foreground/20" />
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         )}

         {isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to load users. Please try again later.
               </AlertDescription>
            </Alert>
         )}

         {users && (
            <DataTable
               columns={columns}
               data={users}
               filterColumn="email"
               filterPlaceholder="Filter emails..."
               toolbarActions={<CreateUserDialog />}
            />
         )}
      </div>
   );
}
