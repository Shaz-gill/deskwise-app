import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from 'core';
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
         <div className="mb-8">
            <Logo size="lg" />
         </div>
         <Card className="w-full max-w-sm shadow-lg">
            <CardHeader>
               <CardTitle className="text-2xl">Welcome back</CardTitle>
               <CardDescription>
                  Sign in to your Deskwise account to continue
               </CardDescription>
            </CardHeader>
            <CardContent>
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
