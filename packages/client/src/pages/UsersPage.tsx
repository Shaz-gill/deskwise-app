import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import axios from 'axios';
import { Role } from 'core';
import moment from 'moment';
import { useState } from 'react';
import { DataTable } from '../components/data-table';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
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

type UsersResponse = {
   users: ApiUser[];
   total: number;
   page: number;
   pageSize: number;
};

async function fetchUsers(params: {
   page: number;
   pageSize: number;
   search: string;
}): Promise<UsersResponse> {
   const { data } = await axios.get<UsersResponse>('/api/users', {
      withCredentials: true,
      params: {
         page: params.page,
         pageSize: params.pageSize,
         ...(params.search && { search: params.search }),
      },
   });

   return data;
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
      cell: ({ row }) => {
         const role = row.getValue<Role>('role');
         return (
            <Badge
               variant={role === Role.admin ? 'default' : 'secondary'}
               className="capitalize"
            >
               {role}
            </Badge>
         );
      },
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
const DEFAULT_PAGE_SIZE = 10;

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
   const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: DEFAULT_PAGE_SIZE,
   });
   const [search, setSearch] = useState('');

   const { data, isPending, isError } = useQuery({
      queryKey: ['users', pagination.pageIndex, pagination.pageSize, search],
      queryFn: () =>
         fetchUsers({
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
            search,
         }),
      placeholderData: keepPreviousData,
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

         {data && (
            <DataTable
               columns={columns}
               data={data.users}
               total={data.total}
               pagination={pagination}
               onPaginationChange={setPagination}
               onSearchChange={(value) => {
                  setSearch(value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
               }}
               searchPlaceholder="Search emails..."
               toolbarActions={<CreateUserDialog />}
            />
         )}
      </div>
   );
}
