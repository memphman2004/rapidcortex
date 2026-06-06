"use client";

import type { CadVendor } from "rapid-cortex-shared";
import type { CadAdminIntegration } from "@/lib/api";
import { CAD_VENDOR_CARDS } from "./cad-admin-ui-helpers";
import { VendorSetupInstructions } from "./VendorSetupInstructions";

type Props = {
  open: boolean;
  onClose: () => void;
  wizardStep: number;
  setWizardStep: (n: number) => void;
  selectedVendor: CadVendor | null;
  setSelectedVendor: (v: CadVendor | null) => void;
  integrationName: string;
  setIntegrationName: (s: string) => void;
  connectionType: "webhook_inbound" | "api_poll";
  setConnectionType: (c: "webhook_inbound" | "api_poll") => void;
  createdIntegration: CadAdminIntegration | null;
  createdSecret: string | null;
  tokenRevealed: boolean;
  setTokenRevealed: (v: boolean | ((b: boolean) => boolean)) => void;
  onCreate: () => void;
  onSendTest: (id: string) => void;
  onCopy: (text: string) => void;
  createPending: boolean;
  testPending: boolean;
  vendorPlaceholder: string;
};

export function AddIntegrationWizard({
  open,
  onClose,
  wizardStep,
  setWizardStep,
  selectedVendor,
  setSelectedVendor,
  integrationName,
  setIntegrationName,
  connectionType,
  setConnectionType,
  createdIntegration,
  createdSecret,
  tokenRevealed,
  setTokenRevealed,
  onCreate,
  onSendTest,
  onCopy,
  createPending,
  testPending,
  vendorPlaceholder,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div
        role="dialog"
        aria-modal
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Add integration</h2>
          <button type="button" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-6 px-5 py-5">
          {wizardStep === 1 ? (
            <>
              <p className="text-sm text-slate-400">Step 1 — Select vendor</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CAD_VENDOR_CARDS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVendor(v.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      selectedVendor === v.id ? "border-sky-500 bg-sky-500/10" : "border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="font-semibold text-white">{v.title}</div>
                    <p className="mt-1 text-xs text-slate-400">{v.blurb}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        v.badge === "self-configure" ?
                          "bg-emerald-500/15 text-emerald-200"
                        : v.badge === "license" ?
                          "bg-amber-500/15 text-amber-100"
                        : "bg-amber-600/20 text-amber-100"
                      }`}
                    >
                      {v.badge === "self-configure" ?
                        "Self-configure"
                      : v.badge === "license" ?
                        "License add-on"
                      : "Requires vendor support"}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedVendor}
                onClick={() => setWizardStep(2)}
                className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
              >
                Continue
              </button>
            </>
          ) : null}

          {wizardStep === 2 ? (
            <>
              <p className="text-sm text-slate-400">Step 2 — Configure</p>
              <label className="block text-xs font-medium text-slate-400">
                Integration name
                <input
                  value={integrationName}
                  onChange={(e) => setIntegrationName(e.target.value)}
                  placeholder={vendorPlaceholder}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>
              <fieldset>
                <legend className="text-xs font-medium text-slate-400">Connection type</legend>
                <div className="mt-2 flex rounded-lg border border-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => setConnectionType("webhook_inbound")}
                    className={`flex-1 rounded-md px-2 py-2 text-xs font-medium ${
                      connectionType === "webhook_inbound" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Webhook (CAD pushes to RC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectionType("api_poll")}
                    className={`flex-1 rounded-md px-2 py-2 text-xs font-medium ${
                      connectionType === "api_poll" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    API poll (RC pulls from CAD)
                  </button>
                </div>
              </fieldset>
              <button
                type="button"
                onClick={onCreate}
                disabled={createPending || !integrationName.trim()}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {createPending ? "Creating…" : "Create integration"}
              </button>
            </>
          ) : null}

          {wizardStep === 3 && createdIntegration && createdSecret ? (
            <>
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 px-3 py-3 text-sm text-emerald-100">
                Integration created successfully
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Webhook URL</p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px] text-slate-200">
                    {createdIntegration.webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void onCopy(createdIntegration.webhookUrl)}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Security token</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-200">
                    {tokenRevealed ? createdSecret : "••••••••••••••••••••••••••••••••"}
                  </code>
                  <button
                    type="button"
                    onClick={() => setTokenRevealed((x) => !x)}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    {tokenRevealed ? "Hide token" : "Show token"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCopy(createdSecret)}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Copy token
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-3 text-xs leading-relaxed text-rose-100">
                This token will not be shown again. Copy it now and store it securely in a password manager before closing this
                dialog.
              </div>
              <VendorSetupInstructions text={createdIntegration.setupInstructions} title="Setup instructions" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onSendTest(createdIntegration.id)}
                  disabled={testPending}
                  className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                >
                  Send test incident
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
