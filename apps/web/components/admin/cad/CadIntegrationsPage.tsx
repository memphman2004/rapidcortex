"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CadVendor } from "rapid-cortex-shared";
import { Plug } from "lucide-react";
import {
  deleteCadIntegration,
  fetchCadIncidents,
  fetchCadIntegrations,
  patchCadIntegration,
  postCadIntegration,
  postCadIntegrationTest,
  type CadAdminIntegration,
} from "@/lib/api";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";
import { AddIntegrationWizard } from "./AddIntegrationWizard";
import { CadIntegrationCard } from "./CadIntegrationCard";
import type { CadTestResult } from "./IntegrationDetailDrawer";
import { IntegrationDetailDrawer } from "./IntegrationDetailDrawer";
import { vendorTitle, vendorTroubleshootingBullets } from "./cad-admin-ui-helpers";
import { CadWritebackApprovals } from "./CadWritebackApprovals";

export function CadIntegrationsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const writebackUi = isCadWritebackUiEnabled();
  const [hubTab, setHubTab] = useState<"integrations" | "writeback">("integrations");

  useEffect(() => {
    if (!writebackUi) return;
    if (searchParams.get("tab") === "writeback") {
      setHubTab("writeback");
    }
  }, [searchParams, writebackUi]);

  const setTab = useCallback(
    (next: "integrations" | "writeback") => {
      setHubTab(next);
      if (!writebackUi) return;
      const nextUrl = next === "writeback" ? `${pathname}?tab=writeback` : pathname.split("?")[0] ?? pathname;
      router.replace(nextUrl);
    },
    [pathname, router, writebackUi],
  );
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedVendor, setSelectedVendor] = useState<CadVendor | null>(null);
  const [integrationName, setIntegrationName] = useState("");
  const [connectionType, setConnectionType] = useState<"webhook_inbound" | "api_poll">("webhook_inbound");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdIntegration, setCreatedIntegration] = useState<CadAdminIntegration | null>(null);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [detail, setDetail] = useState<CadAdminIntegration | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "incidents" | "troubleshoot">("overview");
  const [expandedRawId, setExpandedRawId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [drawerTestResult, setDrawerTestResult] = useState<CadTestResult | null>(null);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["cad-integrations"],
    queryFn: fetchCadIntegrations,
  });

  const incidentsQuery = useQuery({
    queryKey: ["cad-incidents", detail?.id],
    queryFn: () =>
      fetchCadIncidents({
        integrationId: detail!.id,
        limit: 50,
        since: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      }),
    enabled: Boolean(detail && detailTab === "incidents"),
    refetchInterval: detail && detailTab === "incidents" ? 30_000 : false,
  });

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ tone: "info", text: "Copied to clipboard." });
    } catch {
      setBanner({ tone: "error", text: "Copy failed — select and copy manually." });
    }
  }, []);

  const createMut = useMutation({
    mutationFn: () => {
      if (!selectedVendor || !integrationName.trim()) {
        return Promise.reject(new Error("Choose a vendor and enter a name."));
      }
      return postCadIntegration({
        vendor: selectedVendor,
        connectionType,
        name: integrationName.trim(),
        config: {},
      });
    },
    onSuccess: (res) => {
      setCreatedIntegration(res.integration);
      setCreatedSecret(res.webhookSecret);
      setWizardStep(3);
      setBanner(null);
      void qc.invalidateQueries({ queryKey: ["cad-integrations"] });
    },
    onError: (e: Error) => setBanner({ tone: "error", text: e.message }),
  });

  const patchMut = useMutation({
    mutationFn: (args: {
      id: string;
      body: {
        status?: "active" | "inactive" | "error" | "testing";
        regenerateToken?: boolean;
      };
    }) => patchCadIntegration(args.id, args.body),
    onSuccess: async (res, vars) => {
      if (vars.body.regenerateToken && res.webhookSecret) {
        await copy(res.webhookSecret);
        setRegenMessage("New token copied to clipboard. Update your CAD configuration immediately.");
      } else {
        setRegenMessage(null);
      }
      setBanner({ tone: "info", text: "Integration updated." });
      await qc.invalidateQueries({ queryKey: ["cad-integrations"] });
      if (detail?.id === vars.id && res.integration) {
        setDetail(res.integration);
      }
    },
    onError: (e: Error) => setBanner({ tone: "error", text: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCadIntegration(id),
    onSuccess: async () => {
      setBanner({ tone: "info", text: "Integration deleted." });
      setDetail(null);
      await qc.invalidateQueries({ queryKey: ["cad-integrations"] });
    },
    onError: (e: Error) => setBanner({ tone: "error", text: e.message }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) => postCadIntegrationTest(id),
    onSuccess: (res) => {
      setBanner({
        tone: res.success ? "info" : "error",
        text: `Test ${res.success ? "ok" : "finished"} — ${res.message} (${typeof res.latencyMs === "number" ? `${res.latencyMs} ms` : "latency n/a"})`,
      });
    },
    onError: (e: Error) => setBanner({ tone: "error", text: e.message }),
  });

  const drawerTestMut = useMutation({
    mutationFn: (id: string) => postCadIntegrationTest(id),
    onSuccess: (res) => {
      setDrawerTestResult({
        ok: Boolean(res.success),
        message: res.message,
        latencyMs: res.latencyMs,
      });
    },
    onError: (e: Error) => {
      setDrawerTestResult({ ok: false, message: e.message });
    },
  });

  const openWizard = useCallback(() => {
    setWizardOpen(true);
    setWizardStep(1);
    setSelectedVendor(null);
    setIntegrationName("");
    setConnectionType("webhook_inbound");
    setCreatedSecret(null);
    setCreatedIntegration(null);
    setTokenRevealed(false);
    setBanner(null);
  }, []);

  const closeWizard = useCallback(() => {
    setWizardOpen(false);
  }, []);

  const items = listQuery.data?.items ?? [];

  const vendorPlaceholder = useMemo(() => {
    const v = selectedVendor ? vendorTitle(selectedVendor) : "Vendor";
    return `Primary CAD — ${v}`;
  }, [selectedVendor]);

  const troubleshootingBullets = useMemo(() => {
    if (!detail) return [];
    return vendorTroubleshootingBullets(detail.vendor);
  }, [detail]);

  const openDetail = useCallback((row: CadAdminIntegration) => {
    setDetail(row);
    setDetailTab("overview");
    setExpandedRawId(null);
    setDrawerTestResult(null);
    setRegenMessage(null);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-100">
      {writebackUi ? (
        <div className="flex gap-2 border-b border-slate-800 pb-4">
          <button
            type="button"
            onClick={() => setTab("integrations")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              hubTab === "integrations" ? "bg-slate-800 text-white ring-1 ring-slate-600" : "text-slate-400 hover:text-white"
            }`}
          >
            Integrations
          </button>
          <button
            type="button"
            onClick={() => setTab("writeback")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              hubTab === "writeback" ? "bg-slate-800 text-white ring-1 ring-slate-600" : "text-slate-400 hover:text-white"
            }`}
          >
            Write-back approvals
          </button>
        </div>
      ) : null}

      {hubTab === "writeback" && writebackUi ? (
        <CadWritebackApprovals />
      ) : (
        <>
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">Admin</p>
          <h1 className="text-2xl font-semibold text-white">CAD Integrations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Connect your agency&apos;s CAD system to receive live incident data, verify webhooks, and review raw receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={openWizard}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Add integration
        </button>
      </header>

      {banner ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.tone === "error" ? "border-rose-800/60 bg-rose-950/30 text-rose-100" : "border-slate-700 bg-slate-900/80 text-slate-200"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {listQuery.isError ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">
          Failed to load integrations.{" "}
          <button type="button" className="text-sky-400 underline hover:text-sky-300" onClick={() => void listQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-6 py-16 text-center">
          <Plug className="h-12 w-12 text-slate-600" aria-hidden />
          <p className="mt-4 text-lg font-medium text-white">No CAD integrations configured</p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Connect your agency&apos;s CAD system to receive live incident data in Rapid Cortex.
          </p>
          <button
            type="button"
            onClick={openWizard}
            className="mt-8 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            Add your first integration
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((row) => (
            <CadIntegrationCard
              key={row.id}
              row={row}
              onTest={() => testMut.mutate(row.id)}
              onConfigure={() => openDetail(row)}
              onToggleActive={(next) => {
                void patchMut.mutateAsync({
                  id: row.id,
                  body: { status: next ? "active" : "inactive" },
                });
              }}
              onDelete={() => {
                if (window.confirm(`Delete integration “${row.name}”? This cannot be undone.`)) {
                  void deleteMut.mutateAsync(row.id);
                }
              }}
              isTestPending={testMut.isPending}
              isPatchPending={patchMut.isPending}
            />
          ))}
        </div>
      )}

      <AddIntegrationWizard
        open={wizardOpen}
        onClose={() => {
          closeWizard();
          void qc.invalidateQueries({ queryKey: ["cad-integrations"] });
        }}
        wizardStep={wizardStep}
        setWizardStep={setWizardStep}
        selectedVendor={selectedVendor}
        setSelectedVendor={setSelectedVendor}
        integrationName={integrationName}
        setIntegrationName={setIntegrationName}
        connectionType={connectionType}
        setConnectionType={setConnectionType}
        createdIntegration={createdIntegration}
        createdSecret={createdSecret}
        tokenRevealed={tokenRevealed}
        setTokenRevealed={setTokenRevealed}
        onCreate={() => createMut.mutate()}
        onSendTest={(id) => testMut.mutate(id)}
        onCopy={copy}
        createPending={createMut.isPending}
        testPending={testMut.isPending}
        vendorPlaceholder={vendorPlaceholder}
      />

      {detail ? (
        <IntegrationDetailDrawer
          detail={detail}
          vendorTitleText={vendorTitle(detail.vendor)}
          onClose={() => setDetail(null)}
          detailTab={detailTab}
          setDetailTab={(t) => {
            setDetailTab(t);
            if (t !== "troubleshoot") setDrawerTestResult(null);
          }}
          incidents={incidentsQuery.data?.items ?? []}
          incidentsLoading={incidentsQuery.isLoading}
          incidentsFetching={incidentsQuery.isFetching}
          expandedRawId={expandedRawId}
          onToggleRaw={(id) => setExpandedRawId((x) => (x === id ? null : id))}
          onRefreshIncidents={() => void incidentsQuery.refetch()}
          onRunTest={() => {
            setDrawerTestResult(null);
            drawerTestMut.mutate(detail.id);
          }}
          testPending={drawerTestMut.isPending}
          testResult={drawerTestResult}
          onRegenerateToken={() => {
            setRegenMessage(null);
            void patchMut.mutateAsync({ id: detail.id, body: { regenerateToken: true } });
          }}
          regeneratePending={patchMut.isPending}
          regenMessage={regenMessage}
          onCopy={copy}
          troubleshootingBullets={troubleshootingBullets}
        />
      ) : null}
        </>
      )}
    </div>
  );
}