import { useQuery, type UseMutationResult } from '@tanstack/react-query';
import axios from 'axios';
import { TicketCategory, TicketStatus } from 'core';
import type { ApiTicketDetail } from '../../pages/TicketDetailPage';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from '../ui/select';
import { formatCategory } from '../../lib/ticket-format';
import type { TicketUpdatePayload } from './TicketDetail';

const UNASSIGNED_VALUE = '__unassigned__';

type AssignableUser = { id: string; name: string; email: string };

async function fetchAssignableUsers(): Promise<AssignableUser[]> {
   const { data } = await axios.get<{ users: AssignableUser[] }>(
      '/api/users/assignable',
      { withCredentials: true }
   );

   return data.users;
}

const statusSelectItems = Object.values(TicketStatus).map((status) => ({
   value: status,
   label: status,
}));

const categorySelectItems = [
   { value: null, label: 'Uncategorized' },
   ...Object.values(TicketCategory).map((category) => ({
      value: category,
      label: formatCategory(category),
   })),
];

export function TicketDetailsPanel({
   ticket,
   updateMutation,
}: {
   ticket: ApiTicketDetail;
   updateMutation: UseMutationResult<
      ApiTicketDetail,
      Error,
      TicketUpdatePayload
   >;
}) {
   const assignableUsersQuery = useQuery({
      queryKey: ['users', 'assignable'],
      queryFn: fetchAssignableUsers,
   });

   const assigneeSelectItems = [
      { label: 'Unassigned', value: UNASSIGNED_VALUE },
      ...(assignableUsersQuery.data ?? []).map((user) => ({
         label: user.name,
         value: user.id,
      })),
   ];

   return (
      <Card>
         <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
         </CardHeader>
         <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
               <Label htmlFor="ticket-status">Status</Label>
               <Select
                  items={statusSelectItems}
                  value={ticket.status}
                  onValueChange={(value) => {
                     if (value) updateMutation.mutate({ status: value });
                  }}
                  disabled={updateMutation.isPending}
               >
                  <SelectTrigger
                     id="ticket-status"
                     className="w-full capitalize"
                     size="sm"
                  >
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {Object.values(TicketStatus).map((status) => (
                        <SelectItem
                           key={status}
                           value={status}
                           className="capitalize"
                        >
                           {status}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="flex flex-col gap-1.5">
               <Label htmlFor="ticket-category">Category</Label>
               <Select
                  items={categorySelectItems}
                  value={ticket.category}
                  onValueChange={(value) =>
                     updateMutation.mutate({ category: value })
                  }
                  disabled={updateMutation.isPending}
               >
                  <SelectTrigger
                     id="ticket-category"
                     className="w-full capitalize"
                     size="sm"
                  >
                     <SelectValue placeholder="Uncategorized" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value={null}>Uncategorized</SelectItem>
                     {Object.values(TicketCategory).map((category) => (
                        <SelectItem
                           key={category}
                           value={category}
                           className="capitalize"
                        >
                           {formatCategory(category)}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="flex flex-col gap-1.5">
               <Label htmlFor="ticket-assignee">Assigned to</Label>
               <Select
                  items={assigneeSelectItems}
                  value={ticket.assignedTo?.id ?? UNASSIGNED_VALUE}
                  onValueChange={(value) =>
                     updateMutation.mutate({
                        assignedToId: value === UNASSIGNED_VALUE ? null : value,
                     })
                  }
                  disabled={
                     updateMutation.isPending || assignableUsersQuery.isPending
                  }
               >
                  <SelectTrigger
                     id="ticket-assignee"
                     className="w-full"
                     size="sm"
                  >
                     <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value={UNASSIGNED_VALUE}>
                        Unassigned
                     </SelectItem>
                     {assignableUsersQuery.data?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                           {user.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {updateMutation.isError && (
               <Alert variant="destructive">
                  <AlertDescription>
                     Failed to update ticket. Please try again.
                  </AlertDescription>
               </Alert>
            )}
         </CardContent>
      </Card>
   );
}
