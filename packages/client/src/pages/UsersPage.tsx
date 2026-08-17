// Only reachable via ProtectedRoute + AdminRoute + Layout (see
// App.tsx), so an admin session is guaranteed and the nav bar/shell is
// already provided.
export function UsersPage() {
   return (
      <h1 className="font-heading text-2xl font-semibold text-foreground">
         Users
      </h1>
   );
}
