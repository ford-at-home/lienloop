import { createFileRoute } from "@tanstack/react-router";
import { LienLoopApp } from "@/lienloop/LienLoopApp";
import lienloopCss from "@/lienloop/lienloop.css?url";
import cloudCss from "@/lienloop/cloud.css?url";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "LienLoop · Settle a car loan after a total loss" },
      { name: "description", content: "A fictional car-loan settlement demo: review insurance payments, cover the unpaid balance and approve removal of the lender’s lien." },
      { property: "og:title", content: "LienLoop · Settle a car loan after a total loss" },
      { property: "og:description", content: "Review a fictional case where insurance pays less than the loan balance. Check the documents, payments and approvals before releasing the lien." },
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