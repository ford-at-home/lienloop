// Server-only: original rasterized source fixtures, bundled so the hosted model can view them.
import settlementLetter from "./fixtures/settlement-letter.png?inline";
import payoffLetter from "./fixtures/payoff-letter.png?inline";
import expiredPayoffLetter from "./fixtures/expired-payoff-letter.png?inline";
import gapAddendum from "./fixtures/gap-addendum.png?inline";
import serviceContract from "./fixtures/service-contract.png?inline";
import valuationReport from "./fixtures/valuation-report.png?inline";
import loanHistory from "./fixtures/loan-history.png?inline";
import faxRequest from "./fixtures/fax-request.png?inline";

const images: Record<string, string> = {
  "settlement-letter": settlementLetter,
  "payoff-letter": payoffLetter,
  "expired-payoff-letter": expiredPayoffLetter,
  "gap-addendum": gapAddendum,
  "service-contract": serviceContract,
  "valuation-report": valuationReport,
  "loan-history": loanHistory,
  "fax-request": faxRequest,
};

export function sourceImageBase64(name: string): string {
  const dataUrl = images[name];
  if (!dataUrl) throw new Error("Unknown source image.");
  const comma = dataUrl.indexOf(",");
  return dataUrl.slice(comma + 1);
}
