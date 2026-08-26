import {
   type ColumnDef,
   type OnChangeFn,
   type PaginationState,
   type VisibilityState,
   flexRender,
   getCoreRowModel,
   useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';

import { Button } from './ui/button';
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from './ui/table';

const SEARCH_DEBOUNCE_MS = 300;

// Generic shadcn/TanStack Table wrapper — column definitions and data stay
// with whichever page uses it (see UsersPage.tsx). Pagination and search
// are server-driven (manual mode): the caller owns `pagination`/`total`
// state and re-fetches `data` on change, this component just renders
// controls and debounces the search input. Also owns column-visibility
// toggling. No sorting yet; add via TanStack Table's `getSortedRowModel()`
// when a page needs it.
interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   total: number;
   pagination: PaginationState;
   onPaginationChange: OnChangeFn<PaginationState>;
   // Debounced free-text search sent to the server — omit to skip
   // rendering the search input entirely.
   onSearchChange?: (value: string) => void;
   searchPlaceholder?: string;
   // Extra toolbar content (e.g. a "Create User" button) rendered next to
   // the Columns dropdown — keeps DataTable generic instead of hardcoding
   // page-specific actions here.
   toolbarActions?: React.ReactNode;
}

export function DataTable<TData, TValue>({
   columns,
   data,
   total,
   pagination,
   onPaginationChange,
   onSearchChange,
   searchPlaceholder,
   toolbarActions,
}: DataTableProps<TData, TValue>) {
   const [columnVisibility, setColumnVisibility] =
      React.useState<VisibilityState>({});
   const [searchInput, setSearchInput] = React.useState('');

   // Ref, not a direct effect dependency — onSearchChange is typically an
   // inline arrow function that changes identity on every parent render
   // (e.g. every pagination change), which would otherwise retrigger this
   // debounce and reset the search on unrelated re-renders.
   const onSearchChangeRef = React.useRef(onSearchChange);
   React.useEffect(() => {
      onSearchChangeRef.current = onSearchChange;
   });

   React.useEffect(() => {
      if (!onSearchChangeRef.current) return;
      const handle = setTimeout(
         () => onSearchChangeRef.current?.(searchInput),
         SEARCH_DEBOUNCE_MS
      );
      return () => clearTimeout(handle);
   }, [searchInput]);

   const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      manualPagination: true,
      pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
      onPaginationChange,
      onColumnVisibilityChange: setColumnVisibility,
      state: { pagination, columnVisibility },
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between gap-2">
            {onSearchChange && (
               <Input
                  placeholder={searchPlaceholder ?? 'Search...'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="max-w-sm"
               />
            )}
            <div className="flex items-center gap-2">
               <DropdownMenu>
                  <DropdownMenuTrigger
                     render={<Button variant="outline">Columns</Button>}
                  />
                  <DropdownMenuContent align="end">
                     {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => (
                           <DropdownMenuCheckboxItem
                              key={column.id}
                              checked={column.getIsVisible()}
                              onCheckedChange={(checked) =>
                                 column.toggleVisibility(checked)
                              }
                           >
                              {/* Prefer the column's actual header label
                              (e.g. "Joined") over its raw id ("createdAt")
                              — falls back to the id for columns with a
                              non-string header (render function, icon,
                              etc). */}
                              {typeof column.columnDef.header === 'string'
                                 ? column.columnDef.header
                                 : column.id}
                           </DropdownMenuCheckboxItem>
                        ))}
                  </DropdownMenuContent>
               </DropdownMenu>
               {toolbarActions}
            </div>
         </div>

         <Table>
            <TableHeader>
               {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                     {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                           {header.isPlaceholder
                              ? null
                              : flexRender(
                                   header.column.columnDef.header,
                                   header.getContext()
                                )}
                        </TableHead>
                     ))}
                  </TableRow>
               ))}
            </TableHeader>
            <TableBody>
               {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                     <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                           <TableCell key={cell.id}>
                              {flexRender(
                                 cell.column.columnDef.cell,
                                 cell.getContext()
                              )}
                           </TableCell>
                        ))}
                     </TableRow>
                  ))
               ) : (
                  <TableRow>
                     <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                     >
                        No results.
                     </TableCell>
                  </TableRow>
               )}
            </TableBody>
         </Table>

         <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
               {total} row(s) total
            </span>
            <div className="flex items-center gap-2">
               <span className="text-sm text-muted-foreground">
                  Page {pagination.pageIndex + 1} of{' '}
                  {Math.max(table.getPageCount(), 1)}
               </span>
               <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
               >
                  Previous
               </Button>
               <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
               >
                  Next
               </Button>
            </div>
         </div>
      </div>
   );
}
