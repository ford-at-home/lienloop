import { createFileRoute, Outlet } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireOperator } from '@/lienloop/access';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => ({ user: await requireOperator(() => supabase.auth.getUser()) }),
  component: Outlet,
});