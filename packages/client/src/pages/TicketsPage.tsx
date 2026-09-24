import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   PaginationState,
   SortingState,
} from '@tanstack/react-table';
import axios from 'axios';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { TicketCategory, TicketStatus } from 'core';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { TableSkeleton } from '../components/ui/skeletons';
import { TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DataTable } from '../components/data-table';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { formatCategory, STATUS_BADGE_VARIANT } from '../lib/ticket-format';

export type ApiTicket = {
   id: number;
   subject: string;
   body: string;
   bodyHtml: string | null;
   senderName: string;
   senderEmail: string;
   status: TicketStatus;
   category: TicketCategory | null;
   createdAt: string; // ISO string over the wire
   updatedAt: string;
   assignedTo: { id: string; name: string; email: string } | null;
};

type TicketQueryParams = {
   sortBy?: string;
   sortOrder?: 'asc' | 'desc';
   subject?: string;
   status?: string;
   category?: string;
   page: number;
   pageSize: number;
};

type TicketsResponse = { tickets: ApiTicket[]; total: number };

async function fetchTickets(
   params: TicketQueryParams
): Promise<TicketsResponse> {
   const { data } = await axios.get<TicketsResponse>('/api/tickets', {
      withCredentials: true,
      params,
   });

   return data;
}

const UNCATEGORIZED_FILTER_VALUE = 'uncategorized';

const columns: ColumnDef<ApiTicket>[] = [
   {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
         <Link
            to={`/tickets/${row.original.id}`}
            className="font-medium text-foreground hover:underline"
         >
            {row.original.subject}
         </Link>
      ),
   },
   {
      id: 'sender',
      header: 'Sender',
      enableSorting: false,
      cell: ({ row }) => (
         <div className="flex flex-col">
            <span>{row.original.senderName}</span>
            <span className="text-xs text-muted-foreground">
               {row.original.senderEmail}
            </span>
         </div>
      ),
   },
   {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
         const status = row.getValue<TicketStatus>('status');
         return (
            <Badge
               variant={STATUS_BADGE_VARIANT[status]}
               className="capitalize"
            >
               {status}
            </Badge>
         );
      },
   },
   {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
         const category = row.getValue<TicketCategory | null>('category');
         return (
            <span className="capitalize">
               {category ? formatCategory(category) : '—'}
            </span>
         );
      },
   },
   {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) =>
         moment(row.getValue<string>('createdAt')).format('lll'),
   },
];

function TicketsTableHeader() {
   return (
      <TableHeader>
         <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Created</TableHead>
         </TableRow>
      </TableHeader>
   );
}

export function TicketsPage() {
   const [sorting, setSorting] = useState<SortingState>([
      { id: 'createdAt', desc: true },
   ]);
   const sortBy = sorting[0]?.id;
   const sortOrder = sorting[0]
      ? sorting[0].desc
         ? 'desc'
         : 'asc'
      : undefined;

   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [pagination, setPagination] = useState<PaginationState>({
      pageIndex: 0,
      pageSize: 10,
   });

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
      updater
   ) => {
      setColumnFilters(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
   };

   const rawSubjectFilter = columnFilters.find((f) => f.id === 'subject')
      ?.value as string | undefined;
   const statusFilter = columnFilters.find((f) => f.id === 'status')?.value as
      string | undefined;
   const categoryFilter = columnFilters.find((f) => f.id === 'category')
      ?.value as string | undefined;
   const subjectFilter = useDebouncedValue(rawSubjectFilter, 300);

   const { data, isPending, isError } = useQuery({
      queryKey: [
         'tickets',
         sortBy,
         sortOrder,
         subjectFilter,
         statusFilter,
         categoryFilter,
         pagination.pageIndex,
         pagination.pageSize,
      ],
      queryFn: () =>
         fetchTickets({
            sortBy,
            sortOrder,
            subject: subjectFilter,
            status: statusFilter,
            category: categoryFilter,
            page: pagination.pageIndex + 1,
            pageSize: pagination.pageSize,
         }),
   });
   const tickets = data?.tickets;
   const pageCount = data
      ? Math.max(Math.ceil(data.total / pagination.pageSize), 1)
      : 1;

   return (
      <div className="flex flex-col gap-4">
         <h1 className="font-heading text-2xl font-semibold text-foreground">
            Tickets
         </h1>

         {isPending && (
            <TableSkeleton
               header={<TicketsTableHeader />}
               columns={[
                  { width: 'w-40' },
                  { width: 'w-32' },
                  { width: 'w-14' },
                  { width: 'w-28' },
                  { width: 'w-32' },
               ]}
            />
         )}

         {isError && (
            <Alert variant="destructive">
               <AlertDescription>
                  Failed to load tickets. Please try again later.
               </AlertDescription>
            </Alert>
         )}

         {tickets && (
            <DataTable
               columns={columns}
               data={tickets}
               filterColumn="subject"
               filterPlaceholder="Filter subjects..."
               sorting={sorting}
               onSortingChange={setSorting}
               columnFilters={columnFilters}
               onColumnFiltersChange={handleColumnFiltersChange}
               pagination={pagination}
               onPaginationChange={setPagination}
               pageCount={pageCount}
               facetedFilters={[
                  {
                     columnId: 'status',
                     title: 'Status',
                     options: [
                        { label: 'Open', value: TicketStatus.Open },
                        { label: 'Resolved', value: TicketStatus.Resolved },
                        { label: 'Closed', value: TicketStatus.Closed },
                     ],
                  },
                  {
                     columnId: 'category',
                     title: 'Category',
                     options: [
                        {
                           label: 'General question',
                           value: TicketCategory.GeneralQuestion,
                        },
                        {
                           label: 'Technical question',
                           value: TicketCategory.TechnicalQuestion,
                        },
                        {
                           label: 'Refund request',
                           value: TicketCategory.RefundRequest,
                        },
                        {
                           label: 'Uncategorized',
                           value: UNCATEGORIZED_FILTER_VALUE,
                        },
                     ],
                  },
               ]}
            />
         )}
      </div>
   );
}
