// Only reachable via ProtectedRoute + Layout (see App.tsx), so a
// session is guaranteed and the nav bar/shell is already provided.
// Body content is a placeholder — this page exists to prove the
// authenticated app shell works end to end.
export function HomePage() {
   return (
      <h1 className="font-heading text-2xl font-semibold text-foreground">
         Welcome to Deskwise
      </h1>
   );
}
