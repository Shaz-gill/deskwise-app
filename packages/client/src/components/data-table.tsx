import {
   type ColumnDef,
   type ColumnFiltersState,
   type VisibilityState,
   flexRender,
   getCoreRowModel,
   getFilteredRowModel,
   getPaginationRowModel,
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

// Generic shadcn/TanStack Table wrapper — column definitions and data stay
// with whichever page uses it (see UsersPage.tsx). Owns filtering (single
// column, via `filterColumn`), column-visibility toggling, and pagination
// (Previous/Next, default page size). No sorting yet; add via TanStack
// Table's `getSortedRowModel()` when a page needs it.
interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   // Column id to filter on via the search input, and its placeholder —
   // optional and generic (not hardcoded to "email") so this stays
   // reusable for a future table filtering a different column. Omit to
   // skip rendering the search input entirely.
   filterColumn?: string;
   filterPlaceholder?: string;
   // Extra toolbar content (e.g. a "Create User" button) rendered next to
   // the Columns dropdown — keeps DataTable generic instead of hardcoding
   // page-specific actions here.
   toolbarActions?: React.ReactNode;
}

export function DataTable<TData, TValue>({
   columns,
   data,
   filterColumn,
   filterPlaceholder,
   toolbarActions,
}: DataTableProps<TData, TValue>) {
   const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
      []
   );
   const [columnVisibility, setColumnVisibility] =
      React.useState<VisibilityState>({});

   const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      onColumnFiltersChange: setColumnFilters,
      onColumnVisibilityChange: setColumnVisibility,
      state: { columnFilters, columnVisibility },
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between gap-2">
            {filterColumn && (
               <Input
                  placeholder={filterPlaceholder ?? `Filter ${filterColumn}...`}
                  value={
                     (table.getColumn(filterColumn)?.getFilterValue() as
                        string | undefined) ?? ''
                  }
                  onChange={(e) =>
                     table
                        .getColumn(filterColumn)
                        ?.setFilterValue(e.target.value)
                  }
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

         <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
               Page {table.getState().pagination.pageIndex + 1} of{' '}
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
   );
}
