import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   PaginationState,
} from '@tanstack/react-table';
import axios from 'axios';
import { Role } from 'core';
import moment from 'moment';
import { useState } from 'react';
import { DataTable } from '../components/data-table';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeletons';
import { TableHead, TableHeader, TableRow } from '../components/ui/table';
import { CreateUserDialog } from '../components/users/CreateUserDialog';
import { UserRowActions } from '../components/users/UserRowActions';
import { useDebouncedValue } from '../hooks/use-debounced-value';

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
      cell: ({ row }) => moment(row.getValue<string>('createdAt')).format('ll'),
   },
   {
      id: 'actions',
      header: 'Actions',
      enableHiding: false, // hiding the only way to edit a user makes no sense
      cell: ({ row }) => <UserRowActions user={row.original} />,
   },
];

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
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
      updater
   ) => {
      setColumnFilters(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
   };

   const rawSearch = columnFilters.find((f) => f.id === 'email')?.value as
      string | undefined;
   const search = useDebouncedValue(rawSearch ?? '', 300);

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
   const pageCount = data
      ? Math.max(Math.ceil(data.total / pagination.pageSize), 1)
      : 1;

   return (
      <div className="flex flex-col gap-4">
         <h1 className="font-heading text-2xl font-semibold text-foreground">
            Users
         </h1>

         {isPending && (
            <TableSkeleton
               header={<UsersTableHeader />}
               columns={[
                  { width: 'w-24' },
                  { width: 'w-40' },
                  { width: 'w-14' },
                  { width: 'w-20' },
                  { width: 'w-8', height: 'h-8' },
               ]}
            />
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
               filterColumn="email"
               filterPlaceholder="Search emails..."
               columnFilters={columnFilters}
               onColumnFiltersChange={handleColumnFiltersChange}
               pagination={pagination}
               onPaginationChange={setPagination}
               pageCount={pageCount}
               toolbarActions={<CreateUserDialog />}
            />
         )}
      </div>
   );
}
