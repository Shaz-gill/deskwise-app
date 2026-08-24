import type { FormEvent, ReactElement, ReactNode } from 'react';
import { Button } from '../ui/button';
import {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from '../ui/dialog';

interface UserFormDialogProps {
   trigger?: ReactElement;
   title: string;
   description: string;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
   submitLabel: string;
   submitPendingLabel: string;
   isPending: boolean;
   children: ReactNode;
}

export function UserFormDialog({
   trigger,
   title,
   description,
   open,
   onOpenChange,
   onFormSubmit,
   submitLabel,
   submitPendingLabel,
   isPending,
   children,
}: UserFormDialogProps) {
   return (
      <Dialog open={open} onOpenChange={onOpenChange}>
         {trigger && <DialogTrigger render={trigger} />}
         <DialogContent>
            <form
               onSubmit={onFormSubmit}
               noValidate
               className="flex flex-col gap-4"
            >
               <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
               </DialogHeader>

               {children}

               <DialogFooter>
                  <DialogClose
                     render={<Button variant="outline" type="button" />}
                  >
                     Cancel
                  </DialogClose>
                  <Button type="submit" disabled={isPending}>
                     {isPending ? submitPendingLabel : submitLabel}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
}
