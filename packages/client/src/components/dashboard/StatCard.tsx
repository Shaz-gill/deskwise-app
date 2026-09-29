import type { LucideIcon } from 'lucide-react';
import { Card, CardAction, CardContent, CardHeader } from '../ui/card';

export function StatCard({
   label,
   value,
   icon: Icon,
}: {
   label: string;
   value: string | number;
   icon?: LucideIcon;
}) {
   return (
      <Card className="h-full justify-center">
         <CardHeader>
            <span className="text-sm text-muted-foreground">{label}</span>
            {Icon && (
               <CardAction>
                  <Icon className="size-5 text-muted-foreground" />
               </CardAction>
            )}
         </CardHeader>
         <CardContent>
            <span className="font-heading text-5xl font-semibold text-foreground [font-variant-numeric:proportional-nums]">
               {value}
            </span>
         </CardContent>
      </Card>
   );
}
