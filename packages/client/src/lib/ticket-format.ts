import { Bot, Contact, ShieldCheck, User, type LucideIcon } from 'lucide-react';
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
   // Never actually rendered — 'new'/'processing' tickets never reach the
   // client (see routes/tickets.ts's GET / and the auto-resolve pipeline) —
   // included only because TicketStatus's full union requires an
   // exhaustive Record.
   [TicketStatus.New]: 'outline',
   [TicketStatus.Processing]: 'outline',
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
   if (senderType === TicketReplySenderType.ai) {
      return { label: 'AI Assistant', icon: Bot, badgeVariant: 'default' };
   }
   if (senderType === TicketReplySenderType.customer) {
      return { label: 'Customer', icon: Contact, badgeVariant: 'secondary' };
   }
   if (authorRole === Role.admin) {
      return { label: 'Admin', icon: ShieldCheck, badgeVariant: 'default' };
   }
   return { label: 'User', icon: User, badgeVariant: 'outline' };
}
