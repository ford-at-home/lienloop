import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from '@/components/ui/button';
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import lienloopCss from "@/lienloop/lienloop.css?url";
import cloudCss from "@/lienloop/cloud.css?url";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) throw redirect({ to: '/', replace: true });
  },
  head: () => ({
    meta: [
      { title: "Sign in · LienLoop" },
      { name: "description", content: "Sign in to run LienLoop's hosted Lovable Cloud AI mode on a synthetic total-loss file." },
      { property: "og:title", content: "Sign in · LienLoop" },
      { property: "og:description", content: "Operator sign-in for the hosted LienLoop demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: lienloopCss },
      { rel: "stylesheet", href: cloudCss },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setNote({ text: "Unable to sign in. Check your credentials or try again later.", err: true });
    } finally {
      setBusy(false);
    }
  }

  async function lovableSignIn() {
    setNote(null);
    const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
    if (result.error) {
      setNote({ text: result.error instanceof Error ? result.error.message : "Sign-in failed.", err: true });
      return;
    }
    if (result.redirected) return;
    await navigate({ to: "/" });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">lienloop<span className="brand-dot">.</span></div>
        <h1>Operator sign-in</h1>
        <p>Access is limited to invited operators.</p>
        <Button variant="outline" type="button" className="lovable-auth-button" disabled={busy} onClick={lovableSignIn}>Continue with Lovable</Button>
        <div className="auth-divider">or with email</div>
        <form onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <Button className="button primary" disabled={busy} type="submit">{busy ? "Please wait…" : "Sign in"}</Button>
        </form>
        {note && <div className={`auth-note ${note.err ? "err" : ""}`} role="status">{note.text}</div>}
      </div>
    </div>
  );
}
