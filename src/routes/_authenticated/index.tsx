import { createFileRoute } from "@tanstack/react-router";
import { LienLoopApp } from "@/lienloop/LienLoopApp";
import lienloopCss from "@/lienloop/lienloop.css?url";
import cloudCss from "@/lienloop/cloud.css?url";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "LienLoop · The total-loss desk, connected" },
      { name: "description", content: "LienLoop: a synthetic, interactive total-loss desk for invited operators." },
      { property: "og:title", content: "LienLoop · The total-loss desk, connected" },
      { property: "og:description", content: "A synthetic total-loss desk: six mock systems, deterministic math, a person at every decision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: lienloopCss },
      { rel: "stylesheet", href: cloudCss },
    ],
  }),
  component: LienLoopApp,
});