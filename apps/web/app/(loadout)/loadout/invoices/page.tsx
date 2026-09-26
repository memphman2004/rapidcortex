import type { LoadoutInvoice } from "rapid-cortex-shared/loadout";
import { InvoicePreviewPanel } from "../_components/InvoicePreviewPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Loadout Invoices",
  robots: { index: false, follow: false },
};

async function fetchInvoices(): Promise<LoadoutInvoice[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/loadout/invoice/preview`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    // Preview endpoint may return single or list
    if (data.invoices) return data.invoices as LoadoutInvoice[];
    if (data.invoice) return [data.invoice as LoadoutInvoice];
    return [];
  } catch {
    return [];
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function LoadoutInvoicesPage() {
  const invoices = await fetchInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Invoices</h1>
        <p className="mt-1 text-sm text-slate-400">
          View billing history and download invoice PDFs.
        </p>
      </div>

      {invoices.length === 0 ? (
        <InvoicePreviewPanel invoice={null} />
      ) : (
        <div className="space-y-4">
          {/* Latest preview at top */}
          <InvoicePreviewPanel invoice={invoices[0] ?? null} />

          {/* Historical list */}
          {invoices.length > 1 && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs">
                    <th className="text-left px-4 py-3 font-medium">Period</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-right px-4 py-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(1).map((inv) => (
                    <tr key={inv.invoiceId} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">{inv.period}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          inv.status === "sent" ? "bg-emerald-900 text-emerald-300" : "bg-slate-700 text-slate-300"
                        }`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCents(inv.totalDueCents)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{inv.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
