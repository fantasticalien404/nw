import { NetWorthPortfolio } from "@/components/net-worth/net-worth-portfolio";
import { connection } from "next/server";
import { loadNetWorthPage } from "./load-net-worth-page";

export const instant = false;

export default async function NetWorthPage() {
  await connection();
  const { report, benchmarkInputs, growthSeries, hallOfFame, error } = await loadNetWorthPage();

  if (error || !report) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Net worth</h1>
        <p className="mt-3 border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <NetWorthPortfolio report={report} benchmarkInputs={benchmarkInputs} growthSeries={growthSeries} hallOfFame={hallOfFame} />
    </main>
  );
}
