import { Select as SelectPrimitive } from '@base-ui/react/select';

import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

function Select<Value, Multiple extends boolean | undefined = false>({
   ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
   return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
   return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
   return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
   className,
   children,
   size = 'default',
   ...props
}: SelectPrimitive.Trigger.Props & { size?: 'default' | 'sm' }) {
   return (
      <SelectPrimitive.Trigger
         data-slot="select-trigger"
         data-size={size}
         className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 data-placeholder:text-muted-foreground data-[size=sm]:h-8 data-[size=sm]:py-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 dark:bg-input/30 dark:disabled:bg-input/80',
            className
         )}
         {...props}
      >
         {children}
         <SelectPrimitive.Icon>
            <ChevronDownIcon className="text-muted-foreground" />
         </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
   );
}

function SelectContent({
   className,
   children,
   sideOffset = 4,
   align = 'start',
   ...props
}: SelectPrimitive.Popup.Props &
   Pick<SelectPrimitive.Positioner.Props, 'align' | 'sideOffset'>) {
   return (
      <SelectPrimitive.Portal>
         <SelectPrimitive.Positioner
            className="isolate z-50 outline-none"
            align={align}
            sideOffset={sideOffset}
         >
            <SelectPrimitive.Popup
               data-slot="select-content"
               className={cn(
                  'z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                  className
               )}
               {...props}
            >
               <SelectScrollUpArrow />
               <SelectPrimitive.List className="p-1">
                  {children}
               </SelectPrimitive.List>
               <SelectScrollDownArrow />
            </SelectPrimitive.Popup>
         </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
   );
}

function SelectItem({
   className,
   children,
   ...props
}: SelectPrimitive.Item.Props) {
   return (
      <SelectPrimitive.Item
         data-slot="select-item"
         className={cn(
            "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-disabled:pointer-events-none data-disabled:opacity-50",
            className
         )}
         {...props}
      >
         <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
         <span className="pointer-events-none absolute right-2 flex items-center justify-center">
            <SelectPrimitive.ItemIndicator>
               <CheckIcon />
            </SelectPrimitive.ItemIndicator>
         </span>
      </SelectPrimitive.Item>
   );
}

function SelectGroupLabel({
   className,
   ...props
}: SelectPrimitive.GroupLabel.Props) {
   return (
      <SelectPrimitive.GroupLabel
         data-slot="select-group-label"
         className={cn(
            'px-1.5 py-1 text-xs font-medium text-muted-foreground',
            className
         )}
         {...props}
      />
   );
}

function SelectSeparator({
   className,
   ...props
}: SelectPrimitive.Separator.Props) {
   return (
      <SelectPrimitive.Separator
         data-slot="select-separator"
         className={cn('-mx-1 my-1 h-px bg-border', className)}
         {...props}
      />
   );
}

function SelectScrollUpArrow({
   className,
   ...props
}: SelectPrimitive.ScrollUpArrow.Props) {
   return (
      <SelectPrimitive.ScrollUpArrow
         data-slot="select-scroll-up-arrow"
         className={cn(
            'flex cursor-default items-center justify-center py-1',
            className
         )}
         {...props}
      >
         <ChevronUpIcon className="size-4" />
      </SelectPrimitive.ScrollUpArrow>
   );
}

function SelectScrollDownArrow({
   className,
   ...props
}: SelectPrimitive.ScrollDownArrow.Props) {
   return (
      <SelectPrimitive.ScrollDownArrow
         data-slot="select-scroll-down-arrow"
         className={cn(
            'flex cursor-default items-center justify-center py-1',
            className
         )}
         {...props}
      >
         <ChevronDownIcon className="size-4" />
      </SelectPrimitive.ScrollDownArrow>
   );
}

export {
   Select,
   SelectGroup,
   SelectValue,
   SelectTrigger,
   SelectContent,
   SelectItem,
   SelectGroupLabel,
   SelectSeparator,
   SelectScrollUpArrow,
   SelectScrollDownArrow,
};
