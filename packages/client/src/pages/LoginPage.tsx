import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from 'core';
import { Check, Copy, KeyRound, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from '../components/ui/card';
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from '../components/ui/field';
import { Input } from '../components/ui/input';
import { authClient } from '../lib/auth-client';

const DEMO_EMAIL = 'admin@deskwise.com';
const DEMO_PASSWORD = 'password123';

export function LoginPage() {
   const navigate = useNavigate();
   const { refetch } = authClient.useSession();
   const [serverError, setServerError] = useState<string | null>(null);
   const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(
      null
   );

   async function copyToClipboard(value: string, field: 'email' | 'password') {
      try {
         await navigator.clipboard.writeText(value);
      } catch {
         // Clipboard API can reject (denied permission, non-secure context,
         // older browser) — the credentials are still visible as plain text
         // right there to select manually, so just skip the "copied" feedback
         // instead of leaving an unhandled rejection.
         return;
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
   }

   const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
   } = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema),
      defaultValues: {
         email: '',
         password: '',
      },
   });

   async function onSubmit({ email, password }: LoginFormValues) {
      setServerError(null);

      const { error } = await authClient.signIn.email({ email, password });

      if (error) {
         setServerError(error.message ?? 'Invalid email or password');
         return;
      }

      await refetch();
      navigate('/', { replace: true });
   }

   return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4">
         <div className="login-ledger-lines pointer-events-none absolute inset-0" />
         <div className="login-margin-rule pointer-events-none absolute inset-y-0 left-[14%] w-px" />
         <div className="pointer-events-none absolute -top-40 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-primary/25 blur-[110px]" />
         <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-accent/50 blur-[100px]" />

         <div className="relative z-10 mb-8">
            <Logo size="lg" />
         </div>
         <Card className="relative z-10 w-full max-w-sm border-border/70 bg-card/95 shadow-lg backdrop-blur-sm">
            <CardHeader>
               <CardTitle className="text-2xl">Welcome back</CardTitle>
               <CardDescription>
                  Sign in to your Deskwise account to continue
               </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="mb-4 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                     Demo credentials
                  </p>
                  <button
                     type="button"
                     onClick={() => copyToClipboard(DEMO_EMAIL, 'email')}
                     className="flex w-full items-center gap-1.5 py-0.5 text-left hover:text-foreground"
                  >
                     <Mail className="size-3.5 shrink-0" />
                     <span className="font-mono">{DEMO_EMAIL}</span>
                     {copiedField === 'email' ? (
                        <Check className="size-3 shrink-0 text-primary" />
                     ) : (
                        <Copy className="size-3 shrink-0 opacity-50" />
                     )}
                  </button>
                  <button
                     type="button"
                     onClick={() => copyToClipboard(DEMO_PASSWORD, 'password')}
                     className="flex w-full items-center gap-1.5 py-0.5 text-left hover:text-foreground"
                  >
                     <KeyRound className="size-3.5 shrink-0" />
                     <span className="font-mono">{DEMO_PASSWORD}</span>
                     {copiedField === 'password' ? (
                        <Check className="size-3 shrink-0 text-primary" />
                     ) : (
                        <Copy className="size-3 shrink-0 opacity-50" />
                     )}
                  </button>
               </div>
               <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <FieldGroup>
                     {serverError && (
                        <Alert variant="destructive">
                           <AlertDescription>{serverError}</AlertDescription>
                        </Alert>
                     )}

                     <Field data-invalid={!!errors.email}>
                        <FieldLabel htmlFor="email">Email</FieldLabel>
                        <Input
                           id="email"
                           type="email"
                           placeholder="you@company.com"
                           autoComplete="email"
                           aria-invalid={!!errors.email}
                           {...register('email')}
                        />
                        <FieldError errors={[errors.email]} />
                     </Field>

                     <Field data-invalid={!!errors.password}>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                           id="password"
                           type="password"
                           autoComplete="current-password"
                           aria-invalid={!!errors.password}
                           {...register('password')}
                        />
                        <FieldError errors={[errors.password]} />
                     </Field>

                     <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitting}
                        className="w-full"
                     >
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                     </Button>
                  </FieldGroup>
               </form>
            </CardContent>
            <CardFooter>
               <p className="w-full text-center text-sm text-muted-foreground">
                  Don't have an account? Contact your administrator.
               </p>
            </CardFooter>
         </Card>
      </div>
   );
}
