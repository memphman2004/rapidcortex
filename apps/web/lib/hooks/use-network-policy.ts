"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchAgencyNetworkPolicyBody } from "rapid-cortex-shared";
import {
  addAgencyNetworkCidr,
  fetchAgencyNetworkPolicy,
  fetchAgencyNetworkPolicyAudit,
  patchAgencyNetworkPolicy,
  removeAgencyNetworkCidr,
  triggerAgencyNetworkPolicyResync,
} from "@/lib/network-policy-api";

export function useNetworkPolicy(agencyId: string) {
  return useQuery({
    queryKey: ["network-policy", agencyId],
    queryFn: () => fetchAgencyNetworkPolicy(agencyId),
    enabled: Boolean(agencyId),
  });
}

export function useNetworkPolicyAudit(agencyId: string) {
  return useQuery({
    queryKey: ["network-policy-audit", agencyId],
    queryFn: () => fetchAgencyNetworkPolicyAudit(agencyId),
    enabled: Boolean(agencyId),
  });
}

export function useNetworkPolicyMutation(agencyId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["network-policy", agencyId] });
    void qc.invalidateQueries({ queryKey: ["network-policy-audit", agencyId] });
  };
  return {
    patch: useMutation({
      mutationFn: (body: PatchAgencyNetworkPolicyBody) => patchAgencyNetworkPolicy(agencyId, body),
      onSuccess: invalidate,
    }),
    addCidr: useMutation({
      mutationFn: (body: { cidr: string; label: string }) => addAgencyNetworkCidr(agencyId, body),
      onSuccess: invalidate,
    }),
    removeCidr: useMutation({
      mutationFn: (cidr: string) => removeAgencyNetworkCidr(agencyId, cidr),
      onSuccess: invalidate,
    }),
    resyncWaf: useMutation({
      mutationFn: () => triggerAgencyNetworkPolicyResync(agencyId),
      onSuccess: invalidate,
    }),
  };
}
