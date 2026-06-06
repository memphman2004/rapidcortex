"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchTenantAddonBody } from "rapid-cortex-shared";
import {
  fetchAdminTenantCurrentInvoice,
  fetchAdminTenantEntitlements,
  fetchAdminTenantEntitlementsAudit,
  fetchAgencyEntitlements,
  patchAdminTenantAddon,
} from "@/lib/api";

export function useAgencyEntitlements() {
  return useQuery({
    queryKey: ["agency-entitlements"],
    queryFn: () => fetchAgencyEntitlements(),
  });
}

export function useAddonEntitlements(tenantId: string) {
  return useQuery({
    queryKey: ["addon-entitlements", tenantId],
    queryFn: () => fetchAdminTenantEntitlements(tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useCurrentInvoice(tenantId: string) {
  return useQuery({
    queryKey: ["addon-current-invoice", tenantId],
    queryFn: () => fetchAdminTenantCurrentInvoice(tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useAddonMutation(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchTenantAddonBody) => patchAdminTenantAddon(tenantId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["addon-entitlements", tenantId] });
      void qc.invalidateQueries({ queryKey: ["addon-current-invoice", tenantId] });
      void qc.invalidateQueries({ queryKey: ["addon-audit", tenantId] });
    },
  });
}

export function useAddonEntitlementsAudit(tenantId: string, limit = 20) {
  return useQuery({
    queryKey: ["addon-audit", tenantId, limit],
    queryFn: () => fetchAdminTenantEntitlementsAudit(tenantId, limit),
    enabled: Boolean(tenantId),
  });
}
