import { redirect } from '@tanstack/react-router';

// Only a server-validated identity grants access; cached tokens are not enough.
export async function requireOperator<T>(validate: () => Promise<{ data: { user: T | null }; error: unknown }>): Promise<T> {
  try {
    const { data, error } = await validate();
    if (!error && data.user) return data.user;
  } catch {
    // Network/auth failures must fail closed.
  }
  throw redirect({ to: '/auth', replace: true });
}