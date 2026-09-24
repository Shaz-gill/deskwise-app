import { Contact, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import {
   Role,
   TicketCategory,
   TicketReplySenderType,
   TicketStatus,
} from 'core';

export function formatCategory(category: TicketCategory): string {
   return category.replace(/_/g, ' ');
}

export const STATUS_BADGE_VARIANT: Record<
   TicketStatus,
   'default' | 'secondary' | 'outline'
> = {
   [TicketStatus.Open]: 'default',
   [TicketStatus.Resolved]: 'secondary',
   [TicketStatus.Closed]: 'outline',
};

// `senderType` alone (user | customer) can't distinguish an admin's reply
// from a regular user's — both are stored as `senderType: 'user'` — so this
// also takes the author's account role into account.
export function getReplySenderInfo(
   senderType: TicketReplySenderType,
   authorRole: Role
): {
   label: string;
   icon: LucideIcon;
   badgeVariant: 'default' | 'secondary' | 'outline';
} {
   if (senderType === TicketReplySenderType.customer) {
      return { label: 'Customer', icon: Contact, badgeVariant: 'secondary' };
   }
   if (authorRole === Role.admin) {
      return { label: 'Admin', icon: ShieldCheck, badgeVariant: 'default' };
   }
   return { label: 'User', icon: User, badgeVariant: 'outline' };
}
