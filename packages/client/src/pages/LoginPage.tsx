import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from 'core';
import { KeyRound, Mail } from 'lucide-react';
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

export function LoginPage() {
   const navigate = useNavigate();
   const { refetch } = authClient.useSession();
   const [serverError, setServerError] = useState<string | null>(null);

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
                  <p className="flex items-center gap-1.5">
                     <Mail className="size-3.5" />
                     <span className="font-mono">admin@deskwise.com</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                     <KeyRound className="size-3.5" />
                     <span className="font-mono">password123</span>
                  </p>
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
