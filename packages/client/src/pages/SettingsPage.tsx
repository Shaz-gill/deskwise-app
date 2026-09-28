import { KnowledgeDocsList } from '../components/knowledge-base/KnowledgeDocsList';

export function SettingsPage() {
   return (
      <div className="flex flex-col gap-6">
         <h1 className="font-heading text-2xl font-semibold text-foreground">
            Knowledge Base
         </h1>

         <KnowledgeDocsList />
      </div>
   );
}
