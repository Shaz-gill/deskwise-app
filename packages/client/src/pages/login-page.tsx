import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

export function LoginPage() {
   const navigate = useNavigate();
   const { data: session, isPending } = authClient.useSession();

   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [submitting, setSubmitting] = useState(false);

   if (!isPending && session) {
      return <Navigate to="/" replace />;
   }

   async function handleSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      setSubmitting(true);

      const { error: signInError } = await authClient.signIn.email({
         email,
         password,
      });

      setSubmitting(false);

      if (signInError) {
         setError(signInError.message ?? 'Invalid email or password.');
         return;
      }

      navigate('/', { replace: true });
   }

   return (
      <div className="flex min-h-svh items-center justify-center p-4">
         <Card className="w-full max-w-sm">
            <CardHeader>
               <CardTitle>Sign in</CardTitle>
               <CardDescription>
                  Enter your email and password to access Deskwise.
               </CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="email">Email</Label>
                     <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                     />
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="password">Password</Label>
                     <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                     />
                  </div>
                  {error && (
                     <p role="alert" className="text-sm text-destructive">
                        {error}
                     </p>
                  )}
                  <Button
                     type="submit"
                     disabled={submitting}
                     className="w-full"
                  >
                     {submitting ? 'Signing in…' : 'Sign in'}
                  </Button>
               </form>
            </CardContent>
         </Card>
      </div>
   );
}
