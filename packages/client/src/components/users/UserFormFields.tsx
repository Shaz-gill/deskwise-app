import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import axios from 'axios';
import { Alert, AlertDescription } from '../ui/alert';
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field';
import { Input } from '../ui/input';

type UserFormValues = {
   name: string;
   email: string;
   password?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
   const message = axios.isAxiosError<{ error?: string }>(error)
      ? error.response?.data?.error
      : undefined;

   return message ?? fallback;
}

interface UserFormFieldsProps<T extends UserFormValues> {
   register: UseFormRegister<T>;
   errors: FieldErrors<T>;
   idPrefix: string;
   error?: unknown;
   errorFallback: string;
   passwordPlaceholder?: string;
}

export function UserFormFields<T extends UserFormValues>({
   register,
   errors,
   idPrefix,
   error,
   errorFallback,
   passwordPlaceholder,
}: UserFormFieldsProps<T>) {
   const registerField = register as unknown as UseFormRegister<UserFormValues>;
   const fieldErrors = errors as FieldErrors<UserFormValues>;

   return (
      <FieldGroup>
         {error != null && (
            <Alert variant="destructive">
               <AlertDescription>
                  {getErrorMessage(error, errorFallback)}
               </AlertDescription>
            </Alert>
         )}

         <Field data-invalid={!!fieldErrors.name}>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
            <Input
               id={`${idPrefix}-name`}
               autoComplete="name"
               aria-invalid={!!fieldErrors.name}
               {...registerField('name')}
            />
            <FieldError errors={[fieldErrors.name]} />
         </Field>

         <Field data-invalid={!!fieldErrors.email}>
            <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
            <Input
               id={`${idPrefix}-email`}
               type="email"
               autoComplete="email"
               aria-invalid={!!fieldErrors.email}
               {...registerField('email')}
            />
            <FieldError errors={[fieldErrors.email]} />
         </Field>

         <Field data-invalid={!!fieldErrors.password}>
            <FieldLabel htmlFor={`${idPrefix}-password`}>Password</FieldLabel>
            <Input
               id={`${idPrefix}-password`}
               type="password"
               autoComplete="new-password"
               placeholder={passwordPlaceholder}
               aria-invalid={!!fieldErrors.password}
               {...registerField('password')}
            />
            <FieldError errors={[fieldErrors.password]} />
         </Field>
      </FieldGroup>
   );
}
