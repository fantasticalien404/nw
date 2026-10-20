import type { Metadata } from "next";
import { CashflowDashboard } from "@/components/cashflow/cashflow-dashboard";
import { today } from "@/lib/dates";
import { connection } from "next/server";
import { resolveMultiplier } from "@/lib/auth/access";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadCashflowPage } from "./cashflow/load-cashflow-page";
import { loadCachedAppSettings } from "./load-app-settings";

// The root layout template does not apply to the page of its own segment, so the home page builds its full title.
export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await loadCachedAppSettings();
  return { title: { absolute: `${appName} Cashflow` } };
}

export const instant = false;

export default async function CashflowPage() {
  await connection();
  const { currency, reports, error } = await loadCashflowPage(loadCashflowWorkbook, resolveMultiplier);

  if (error || !reports || !currency) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Cashflow</h1>
        <p className="mt-3 border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-2 pb-2">
        <h1 className="text-3xl font-semibold tracking-tight text-black">Cashflow</h1>
      </header>
      <CashflowDashboard reports={reports} currency={currency} reportingDate={today()} />
    </main>
  );
}
