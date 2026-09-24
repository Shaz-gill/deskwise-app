import * as React from 'react';
import {
   type ColumnDef,
   type ColumnFiltersState,
   type OnChangeFn,
   type PaginationState,
   type SortingState,
   type VisibilityState,
   flexRender,
   getCoreRowModel,
   getFilteredRowModel,
   getPaginationRowModel,
   useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Button } from './ui/button';
import { Input } from './ui/input';
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from './ui/table';

// Generic shadcn/TanStack Table wrapper — column definitions and data stay
// with whichever page uses it (see UsersPage.tsx). Owns column-visibility
// toggling always internally. Filtering and pagination are each either
// server-controlled (pass the state + change-handler pair, `data` is
// trusted to already be the correct filtered page) or left to an internal
// `useState` fallback (omit them — UsersPage.tsx's case, fully local like
// before this was added). Unlike sorting (fully on or fully off — see
// `sorting`/`onSortingChange` below), filtering/pagination are *always*
// active, just server- or client-driven, so there's no "off" state for
// them, only "who owns it."
interface DataTableProps<TData, TValue> {
   columns: ColumnDef<TData, TValue>[];
   data: TData[];
   // Column id to filter on via the search input, and its placeholder —
   // optional and generic (not hardcoded to "email") so this stays
   // reusable for a future table filtering a different column. Omit to
   // skip rendering the search input entirely. Describes *which* column
   // is filterable and how the input looks — independent of whether the
   // resulting filter state (below) is server- or client-owned.
   filterColumn?: string;
   filterPlaceholder?: string;
   // Extra toolbar content (e.g. a "Create User" button) rendered next to
   // the Columns dropdown — keeps DataTable generic instead of hardcoding
   // page-specific actions here.
   toolbarActions?: React.ReactNode;
   // Controlled sorting state, provided together — when both are set,
   // `manualSorting` is enabled (rows are trusted to already be sorted by
   // the caller, e.g. via a server request) and sortable column headers
   // render as clickable buttons. Omit both to skip the sorting feature
   // entirely, same as before this was added.
   sorting?: SortingState;
   onSortingChange?: OnChangeFn<SortingState>;
   // Single-select dropdown filters (e.g. Status, Category) rendered next
   // to the search input — each is its own independent column filter, "All"
   // clears it. Optional/generic like `filterColumn`, so UsersPage.tsx
   // (which passes none) is unaffected.
   facetedFilters?: {
      columnId: string;
      title: string;
      options: { label: string; value: string }[];
   }[];
   // Controlled filter state — when provided (with the change handler),
   // `manualFiltering` is enabled and `data` is trusted to already be
   // filtered (e.g. by a server request driven by this same state).
   // Omitting both falls back to an internal `useState` and today's fully
   // local `getFilteredRowModel()` behavior.
   columnFilters?: ColumnFiltersState;
   onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
   // Controlled pagination state — same shape as columnFilters above.
   // `pageCount` is required alongside the other two since manual mode
   // can't derive it from `data.length` (data is just the current page).
   pagination?: PaginationState;
   onPaginationChange?: OnChangeFn<PaginationState>;
   pageCount?: number;
}

// header.column.getIsSorted() returns false | 'asc' | 'desc'.
function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
   if (direction === 'asc') return <ArrowUp className="ml-2 size-4" />;
   if (direction === 'desc') return <ArrowDown className="ml-2 size-4" />;
   return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
}

export function DataTable<TData, TValue>({
   columns,
   data,
   filterColumn,
   filterPlaceholder,
   toolbarActions,
   sorting,
   onSortingChange,
   facetedFilters,
   columnFilters: controlledColumnFilters,
   onColumnFiltersChange: controlledOnColumnFiltersChange,
   pagination: controlledPagination,
   onPaginationChange: controlledOnPaginationChange,
   pageCount,
}: DataTableProps<TData, TValue>) {
   const [internalColumnFilters, setInternalColumnFilters] =
      React.useState<ColumnFiltersState>([]);
   const [internalPagination, setInternalPagination] =
      React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
   const [columnVisibility, setColumnVisibility] =
      React.useState<VisibilityState>({});

   const sortingEnabled =
      sorting !== undefined && onSortingChange !== undefined;
   const manualFiltering =
      controlledColumnFilters !== undefined &&
      controlledOnColumnFiltersChange !== undefined;
   const manualPagination =
      controlledPagination !== undefined &&
      controlledOnPaginationChange !== undefined &&
      pageCount !== undefined;

   const columnFilters = manualFiltering
      ? controlledColumnFilters
      : internalColumnFilters;
   const onColumnFiltersChange = manualFiltering
      ? controlledOnColumnFiltersChange
      : setInternalColumnFilters;
   const pagination = manualPagination
      ? controlledPagination
      : internalPagination;
   const onPaginationChange = manualPagination
      ? controlledOnPaginationChange
      : setInternalPagination;

   const table = useReactTable({
      data,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      manualFiltering,
      manualPagination,
      pageCount: manualPagination ? pageCount : undefined,
      onColumnFiltersChange,
      onColumnVisibilityChange: setColumnVisibility,
      onPaginationChange,
      ...(sortingEnabled
         ? {
              manualSorting: true,
              onSortingChange,
              state: { columnFilters, columnVisibility, pagination, sorting },
           }
         : { state: { columnFilters, columnVisibility, pagination } }),
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
               {filterColumn && (
                  <Input
                     placeholder={
                        filterPlaceholder ?? `Filter ${filterColumn}...`
                     }
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
               {facetedFilters?.map(({ columnId, title, options }) => {
                  const column = table.getColumn(columnId);
                  const selectedValue = column?.getFilterValue() as
                     string | undefined;
                  const selectedLabel = options.find(
                     (option) => option.value === selectedValue
                  )?.label;

                  return (
                     <DropdownMenu key={columnId}>
                        <DropdownMenuTrigger
                           render={
                              <Button variant="outline">
                                 {selectedLabel
                                    ? `${title}: ${selectedLabel}`
                                    : title}
                              </Button>
                           }
                        />
                        <DropdownMenuContent align="start">
                           <DropdownMenuRadioGroup
                              value={selectedValue ?? ''}
                              onValueChange={(value) =>
                                 column?.setFilterValue(
                                    value === '' ? undefined : value
                                 )
                              }
                           >
                              <DropdownMenuRadioItem value="">
                                 All
                              </DropdownMenuRadioItem>
                              {options.map((option) => (
                                 <DropdownMenuRadioItem
                                    key={option.value}
                                    value={option.value}
                                 >
                                    {option.label}
                                 </DropdownMenuRadioItem>
                              ))}
                           </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  );
               })}
            </div>
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
                           {header.isPlaceholder ? null : sortingEnabled &&
                             header.column.getCanSort() ? (
                              <Button
                                 variant="ghost"
                                 size="sm"
                                 className="-ml-3 h-8"
                                 onClick={header.column.getToggleSortingHandler()}
                              >
                                 {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                 )}
                                 <SortIcon
                                    direction={header.column.getIsSorted()}
                                 />
                              </Button>
                           ) : (
                              flexRender(
                                 header.column.columnDef.header,
                                 header.getContext()
                              )
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
