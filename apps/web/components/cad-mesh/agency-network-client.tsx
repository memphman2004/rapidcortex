'use client';

/**
 * agency-network-client.tsx
 * Phases 1–4 — Complete Agency Network console.
 *
 * Tabs:
 *   Partners      — trust relationships, invite flow, MOU acceptance
 *   Shared intel  — live feed of incidents received from partners
 *   Mesh map      — Phase 4: geographic network visualization
 *
 * Per-partner drawer:
 *   Sharing policy, field toggles, CAD write-back toggle (Phase 3),
 *   audit log, suspend / revoke controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  AgencyTrustRelationship,
  AgencySharingPolicy,
  SharedIncident,
  IncidentType,
  Priority,
  TrustStatus,
  ShareFieldPolicy,
  WritebackFieldPolicy,
  AgencyMeshNode,
  AgencyMeshEdge,
} from 'rapid-cortex-shared';
import { useAgencyWebSocket } from '@/hooks/use-agency-websocket';

// ── Types ────────────────────────────────────────────────────────────────────

interface EnrichedRelationship extends AgencyTrustRelationship {
  policy: AgencySharingPolicy | null;
}

interface Props {
  agencyId: string;
  agencyName: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INCIDENT_TYPES: IncidentType[] = ['FIRE','EMS','LAW','HAZMAT','TRAFFIC','MCI','WELFARE','OTHER'];
const PRIORITIES: Priority[] = [1, 2, 3, 4, 5];
const PRIORITY_LABELS: Record<Priority, string> = { 1:'P1 — Critical', 2:'P2 — High', 3:'P3 — Moderate', 4:'P4 — Low', 5:'P5 — Routine' };
const STATUS_COLORS: Record<TrustStatus, string> = {
  active:             '#1D9E75',
  pending_initiator:  '#EF9F27',
  pending_acceptor:   '#EF9F27',
  suspended:          '#D85A30',
  revoked:            '#888780',
};
const FIELD_LABELS: Record<keyof ShareFieldPolicy, string> = {
  location:          'Location (lat/lon, address)',
  incidentType:      'Incident type',
  priority:          'Priority level',
  unitStatus:        'Unit status & positions',
  narrative:         'Narrative (PII scrubbed)',
  aiSummary:         'AI incident summary',
  transcript:        'Call transcript (PII scrubbed)',
  confidenceScore:   'AI confidence score',
  extractedEntities: 'Extracted entities',
};
const WRITEBACK_FIELD_LABELS: Record<keyof WritebackFieldPolicy, string> = {
  incidentType: 'Incident type',
  priority:     'Priority',
  location:     'Location',
  narrative:    'Narrative',
  unitStatus:   'Unit status',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0f1117',
    color: '#e2e4ea',
    minHeight: '100vh',
    padding: '24px',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,
  h1: { fontSize: '20px', fontWeight: 600, color: '#ffffff', margin: 0 } as React.CSSProperties,
  h2: { fontSize: '15px', fontWeight: 600, color: '#ffffff', margin: '0 0 16px' } as React.CSSProperties,
  h3: { fontSize: '13px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #1e2130' } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #1D9E75' : '2px solid transparent',
    color: active ? '#1D9E75' : '#6b7280',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
    marginBottom: '-1px',
    transition: 'all 0.15s',
  }),
  card: {
    background: '#161b2e',
    border: '1px solid #1e2130',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' } as React.CSSProperties,
  col: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    background: color + '22',
    border: `1px solid ${color}44`,
    borderRadius: '20px',
    fontSize: '12px',
    color,
    fontWeight: 500,
  }),
  dot: (color: string): React.CSSProperties => ({
    width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0,
  }),
  btn: (variant: 'primary'|'ghost'|'danger'|'warning' = 'primary'): React.CSSProperties => {
    const map = {
      primary: { bg:'#1D9E75', border:'#1D9E75', color:'#fff' },
      ghost:   { bg:'transparent', border:'#1e2130', color:'#9ca3af' },
      danger:  { bg:'transparent', border:'#D85A30', color:'#D85A30' },
      warning: { bg:'transparent', border:'#EF9F27', color:'#EF9F27' },
    };
    return {
      padding: '7px 14px', borderRadius: '7px', border: `1px solid ${map[variant].border}`,
      background: map[variant].bg, color: map[variant].color,
      fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    };
  },
  input: {
    width: '100%', padding: '8px 12px', background: '#0f1117',
    border: '1px solid #1e2130', borderRadius: '7px',
    color: '#e2e4ea', fontSize: '14px', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    padding: '7px 12px', background: '#0f1117', border: '1px solid #1e2130',
    borderRadius: '7px', color: '#e2e4ea', fontSize: '13px', cursor: 'pointer',
  } as React.CSSProperties,
  label: { fontSize: '12px', color: '#9ca3af', marginBottom: '4px' } as React.CSSProperties,
  divider: { borderTop: '1px solid #1e2130', margin: '16px 0' } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' } as React.CSSProperties,
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    zIndex: 999,
  },
  drawer: {
    background: '#161b2e', border: '1px solid #1e2130', width: '480px',
    height: '100vh', overflowY: 'auto' as const, padding: '24px',
  },
  priorityBar: (active: boolean, color: string): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
    background: active ? color + '22' : 'transparent',
    border: `1px solid ${active ? color : '#1e2130'}`,
    color: active ? color : '#6b7280',
    fontWeight: active ? 600 : 400,
  }),
  // Phase 3: Toggle switch
  toggleTrack: (on: boolean): React.CSSProperties => ({
    position: 'relative' as const, display: 'inline-block',
    width: '40px', height: '22px', borderRadius: '11px',
    background: on ? '#1D9E75' : '#1e2130',
    border: `1px solid ${on ? '#1D9E75' : '#374151'}`,
    cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
  }),
  toggleThumb: (on: boolean): React.CSSProperties => ({
    position: 'absolute' as const, top: '2px',
    left: on ? '20px' : '2px',
    width: '16px', height: '16px', borderRadius: '50%',
    background: '#ffffff',
    transition: 'left 0.2s',
    pointerEvents: 'none' as const,
  }),
  priorityColors: {
    1: '#E24B4A', 2: '#D85A30', 3: '#EF9F27', 4: '#1D9E75', 5: '#378ADD',
  } as Record<Priority, string>,
};

// ── Toggle Component (Phase 3) ───────────────────────────────────────────────

function Toggle({
  on, onChange, label, description, disabled,
}: {
  on: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', opacity: disabled ? 0.5 : 1 }}>
      <div>
        <div style={{ fontSize: '14px', color: '#e2e4ea', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{description}</div>}
      </div>
      <div
        style={s.toggleTrack(on)}
        onClick={() => !disabled && onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => !disabled && e.key === ' ' && onChange(!on)}
      >
        <div style={s.toggleThumb(on)} />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AgencyNetworkClient({ agencyId, agencyName }: Props) {
  const [tab, setTab] = useState<'partners' | 'shared' | 'map'>('partners');
  const [relationships, setRelationships] = useState<EnrichedRelationship[]>([]);
  const [sharedIncidents, setSharedIncidents] = useState<SharedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<EnrichedRelationship | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Data Loading ───────────────────────────────────────────────────────────

  const loadRelationships = useCallback(async () => {
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network`);
      const data = await res.json();
      setRelationships(data.relationships ?? []);
    } catch { /* handled silently */ }
  }, [agencyId]);

  const loadSharedIncidents = useCallback(async () => {
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network/shared-incidents`);
      const data = await res.json();
      setSharedIncidents(data.incidents ?? []);
    } catch { /* handled silently */ }
  }, [agencyId]);

  useEffect(() => {
    Promise.all([loadRelationships(), loadSharedIncidents()])
      .finally(() => setLoading(false));
  }, [loadRelationships, loadSharedIncidents]);

  useAgencyWebSocket((msg) => {
    if (msg.type !== 'SHARED_INCIDENT') return;
    const incident = msg.data.incident as SharedIncident | undefined;
    if (!incident?.shareId) return;
    setSharedIncidents(prev => [incident, ...prev.filter(row => row.shareId !== incident.shareId)].slice(0, 200));
  }, { enabled: Boolean(process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim()) });

  // ── Policy Updates ─────────────────────────────────────────────────────────

  const updatePolicy = async (partnerId: string, update: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network/${partnerId}/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRelationships(prev => prev.map(r =>
        r.partnerAgencyId === partnerId ? { ...r, policy: data.policy } : r
      ));
      if (selectedPartner?.partnerAgencyId === partnerId) {
        setSelectedPartner(prev => prev ? { ...prev, policy: data.policy } : null);
      }
      showToast('Policy saved');
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Phase 3: Write-back toggle
  const toggleWriteback = async (partnerId: string, enabled: boolean, mode?: 'assisted'|'automatic') => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network/${partnerId}/writeback-toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadRelationships();
      if (selectedPartner?.partnerAgencyId === partnerId) {
        setSelectedPartner(prev => prev && prev.policy
          ? { ...prev, policy: { ...prev.policy, writebackEnabled: enabled, writebackMode: mode ?? prev.policy.writebackMode } }
          : prev
        );
      }
      showToast(enabled ? `CAD write-back enabled (${mode ?? 'assisted'} mode)` : 'CAD write-back disabled');
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Phase 3: Approve / reject write-back
  const approveWriteback = async (shareId: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network/writeback-approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, approved }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSharedIncidents(prev => prev.map(i =>
        i.shareId === shareId
          ? { ...i, writebackStatus: approved ? 'approved' : 'rejected' }
          : i
      ));
      showToast(approved ? 'Write-back approved — CAD updating' : 'Write-back rejected');
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
  };

  // Trust lifecycle actions
  const revokePartnership = async (partnerId: string) => {
    if (!confirm('Revoke this partnership? This will immediately stop all data sharing.')) return;
    const res = await fetch(`/api/agencies/${agencyId}/network/${partnerId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin-initiated revocation' }),
    });
    if (res.ok) { setSelectedPartner(null); loadRelationships(); showToast('Partnership revoked'); }
  };

  const suspendPartnership = async (partnerId: string, suspend: boolean) => {
    const res = await fetch(`/api/agencies/${agencyId}/network/${partnerId}/suspend`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspend }),
    });
    if (res.ok) { loadRelationships(); showToast(suspend ? 'Partnership suspended' : 'Partnership resumed'); }
  };

  const acceptInvite = async (partnerId: string, mouVersion: string) => {
    const res = await fetch(`/api/agencies/${agencyId}/network/${partnerId}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mouVersion }),
    });
    if (res.ok) { setSelectedPartner(null); loadRelationships(); showToast('Partnership activated'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeCount   = relationships.filter(r => r.status === 'active').length;
  const pendingCount  = relationships.filter(r => r.status.startsWith('pending')).length;
  const todayCount    = sharedIncidents.filter(i =>
    new Date(i.sharedAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>Agency network</h1>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {agencyName} · CAD intelligence mesh
          </div>
        </div>
        <button style={s.btn('primary')} onClick={() => setShowInviteModal(true)}>
          + Invite partner agency
        </button>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <StatPill label="Active partners" value={activeCount} color="#1D9E75" />
        <StatPill label="Pending invites" value={pendingCount} color="#EF9F27" />
        <StatPill label="Incidents shared today" value={todayCount} color="#378ADD" />
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['partners','shared','map'] as const).map(t => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'partners' ? 'Partners' : t === 'shared' ? 'Shared intel' : 'Mesh map'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '48px' }}>Loading…</div>
      ) : (
        <>
          {tab === 'partners' && (
            <PartnersTab
              relationships={relationships}
              onSelect={setSelectedPartner}
              selectedId={selectedPartner?.partnerAgencyId}
            />
          )}
          {tab === 'shared' && (
            <SharedIntelTab
              incidents={sharedIncidents}
              onApproveWriteback={approveWriteback}
            />
          )}
          {tab === 'map' && (
            <MeshMapTab agencyId={agencyId} relationships={relationships} />
          )}
        </>
      )}

      {/* Partner drawer */}
      {selectedPartner && (
        <PartnerDrawer
          relationship={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onUpdatePolicy={(update) => updatePolicy(selectedPartner.partnerAgencyId, update)}
          onToggleWriteback={(enabled, mode) => toggleWriteback(selectedPartner.partnerAgencyId, enabled, mode)}
          onRevoke={() => revokePartnership(selectedPartner.partnerAgencyId)}
          onSuspend={(s) => suspendPartnership(selectedPartner.partnerAgencyId, s)}
          onAccept={(v) => acceptInvite(selectedPartner.partnerAgencyId, v)}
          saving={saving}
        />
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          agencyId={agencyId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => { setShowInviteModal(false); loadRelationships(); showToast('Invite sent'); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: '#1D9E75', color: '#fff', padding: '12px 20px',
          borderRadius: '8px', fontSize: '14px', fontWeight: 500, zIndex: 1000,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#161b2e', border: '1px solid #1e2130', borderRadius: '10px', padding: '12px 18px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

// ── Partners Tab ──────────────────────────────────────────────────────────────

function PartnersTab({
  relationships, onSelect, selectedId,
}: {
  relationships: EnrichedRelationship[];
  onSelect: (r: EnrichedRelationship) => void;
  selectedId?: string;
}) {
  if (relationships.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>
        No partner agencies yet. Invite one to start sharing CAD intelligence.
      </div>
    );
  }

  return (
    <div>
      {relationships.map(r => (
        <div
          key={r.partnerAgencyId}
          style={{
            ...s.card,
            cursor: 'pointer',
            border: selectedId === r.partnerAgencyId
              ? '1px solid #1D9E75'
              : '1px solid #1e2130',
          }}
          onClick={() => onSelect(r)}
        >
          <div style={s.row}>
            <div style={s.col}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                {r.partnerAgencyName}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Partner since {r.activatedAt ? new Date(r.activatedAt).toLocaleDateString() : '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {r.policy?.writebackEnabled && (
                <span style={{ ...s.badge('#378ADD'), fontSize: '11px' }}>
                  <div style={s.dot('#378ADD')} />
                  CAD write-back
                </span>
              )}
              <span style={s.badge(STATUS_COLORS[r.status])}>
                <div style={s.dot(STATUS_COLORS[r.status])} />
                {r.status.replace('_', ' ')}
              </span>
              <span style={{ color: '#6b7280', fontSize: '18px' }}>›</span>
            </div>
          </div>
          {r.status.startsWith('pending') && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#EF9F2711', borderRadius: '6px', fontSize: '12px', color: '#EF9F27' }}>
              {r.status === 'pending_acceptor'
                ? '⏳ Awaiting your acceptance — review MOU to activate'
                : '⏳ Invite sent — waiting for partner to accept'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared Intel Tab ─────────────────────────────────────────────────────────

function SharedIntelTab({
  incidents, onApproveWriteback,
}: {
  incidents: SharedIncident[];
  onApproveWriteback: (shareId: string, approved: boolean) => void;
}) {
  const priorityColor = (p: Priority) => s.priorityColors[p];

  if (incidents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>
        No shared incidents yet. Active partner agencies will appear here in real time.
      </div>
    );
  }

  return (
    <div>
      {incidents.map(incident => (
        <div key={incident.shareId} style={s.card}>
          <div style={s.row}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                background: priorityColor(incident.priority) + '22',
                border: `1px solid ${priorityColor(incident.priority)}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: priorityColor(incident.priority),
              }}>
                P{incident.priority}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                  {incident.incidentType} · {incident.location?.address ?? 'Location restricted'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  From {incident.sourceAgencyName} · {new Date(incident.sharedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              <span style={s.badge(priorityColor(incident.priority))}>
                {incident.status}
              </span>
            </div>
          </div>

          {/* AI Summary */}
          {incident.aiSummary && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#0f1117', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>AI SUMMARY</div>
              <div style={{ fontSize: '13px', color: '#c9cad3', lineHeight: 1.5 }}>{incident.aiSummary}</div>
              {incident.confidenceScore !== undefined && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  Confidence: {Math.round(incident.confidenceScore * 100)}%
                </div>
              )}
            </div>
          )}

          {/* Unit status */}
          {incident.units && incident.units.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {incident.units.map(u => (
                <span key={u.unitId} style={s.badge('#378ADD')}>
                  {u.unitId} · {u.status}
                </span>
              ))}
            </div>
          )}

          {/* Phase 3: Write-back controls */}
          {incident.writebackEnabled && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#378ADD11', border: '1px solid #378ADD33', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#378ADD' }}>CAD write-back</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    Status: {incident.writebackStatus ?? 'pending'}
                  </div>
                </div>
                {incident.writebackStatus === 'pending' && incident.writebackMode === 'assisted' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      style={s.btn('primary')}
                      onClick={() => onApproveWriteback(incident.shareId, true)}
                    >
                      Approve write
                    </button>
                    <button
                      style={s.btn('danger')}
                      onClick={() => onApproveWriteback(incident.shareId, false)}
                    >
                      Reject
                    </button>
                  </div>
                )}
                {incident.writebackStatus === 'written' && (
                  <span style={{ fontSize: '12px', color: '#1D9E75' }}>
                    ✓ Written to CAD {incident.writebackCADId ? `#${incident.writebackCADId}` : ''}
                  </span>
                )}
                {incident.writebackStatus === 'rejected' && (
                  <span style={{ fontSize: '12px', color: '#D85A30' }}>✕ Rejected</span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Partner Drawer ─────────────────────────────────────────────────────────

function PartnerDrawer({
  relationship, onClose, onUpdatePolicy, onToggleWriteback,
  onRevoke, onSuspend, onAccept, saving,
}: {
  relationship: EnrichedRelationship;
  onClose: () => void;
  onUpdatePolicy: (update: Record<string, unknown>) => void;
  onToggleWriteback: (enabled: boolean, mode?: 'assisted'|'automatic') => void;
  onRevoke: () => void;
  onSuspend: (suspend: boolean) => void;
  onAccept: (mouVersion: string) => void;
  saving: boolean;
}) {
  const { policy } = relationship;
  const [drawerSection, setDrawerSection] = useState<'overview'|'policy'|'writeback'>('overview');

  const MOU_VERSION = '1.0';

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.drawer} onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={s.h1}>{relationship.partnerAgencyName}</h2>
            <div style={{ marginTop: '6px' }}>
              <span style={s.badge(STATUS_COLORS[relationship.status])}>
                <div style={s.dot(STATUS_COLORS[relationship.status])} />
                {relationship.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button style={{ ...s.btn('ghost'), padding: '4px 8px', fontSize: '18px' }} onClick={onClose}>✕</button>
        </div>

        {/* Pending acceptor — MOU acceptance */}
        {relationship.status === 'pending_acceptor' && (
          <div style={{ padding: '16px', background: '#EF9F2711', border: '1px solid #EF9F2733', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#EF9F27', marginBottom: '8px' }}>
              Partnership invite received
            </div>
            <div style={{ fontSize: '13px', color: '#c9cad3', lineHeight: 1.6, marginBottom: '12px' }}>
              {relationship.initiatorAgencyName} has invited your agency to join the NexCortiQ CAD intelligence mesh.
              By accepting, you agree to the Mutual Aid Data Sharing Agreement (MOU v{MOU_VERSION}).
            </div>
            {relationship.inviteMessage && (
              <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px' }}>
                "{relationship.inviteMessage}"
              </div>
            )}
            <button style={s.btn('primary')} onClick={() => onAccept(MOU_VERSION)}>
              Accept + sign MOU v{MOU_VERSION}
            </button>
          </div>
        )}

        {/* Drawer sub-tabs */}
        {relationship.status === 'active' && (
          <>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #1e2130' }}>
              {(['overview','policy','writeback'] as const).map(sec => (
                <button
                  key={sec}
                  style={{
                    ...s.btn('ghost'),
                    borderBottom: drawerSection === sec ? '2px solid #1D9E75' : '2px solid transparent',
                    borderLeft: 'none', borderRight: 'none', borderTop: 'none',
                    borderRadius: 0, color: drawerSection === sec ? '#1D9E75' : '#6b7280',
                    fontWeight: drawerSection === sec ? 600 : 400,
                    paddingBottom: '8px',
                  }}
                  onClick={() => setDrawerSection(sec)}
                >
                  {sec === 'overview' ? 'Overview' : sec === 'policy' ? 'Sharing policy' : 'CAD write-back'}
                </button>
              ))}
            </div>

            {drawerSection === 'overview' && <DrawerOverview relationship={relationship} />}
            {drawerSection === 'policy' && policy && (
              <DrawerPolicy policy={policy} onUpdate={onUpdatePolicy} saving={saving} />
            )}
            {drawerSection === 'writeback' && policy && (
              <DrawerWriteback policy={policy} onToggle={onToggleWriteback} onUpdate={onUpdatePolicy} saving={saving} />
            )}
          </>
        )}

        {/* Danger zone */}
        {relationship.status !== 'revoked' && (
          <>
            <div style={s.divider} />
            <div style={s.h3}>Controls</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {relationship.status === 'active' && (
                <button style={s.btn('warning')} onClick={() => onSuspend(true)}>
                  Suspend sharing
                </button>
              )}
              {relationship.status === 'suspended' && (
                <button style={s.btn('primary')} onClick={() => onSuspend(false)}>
                  Resume sharing
                </button>
              )}
              <button style={s.btn('danger')} onClick={onRevoke}>
                Revoke partnership
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Drawer Sections ───────────────────────────────────────────────────────────

function DrawerOverview({ relationship }: { relationship: EnrichedRelationship }) {
  const { policy } = relationship;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <InfoRow label="Partner ID" value={relationship.partnerAgencyId} />
      <InfoRow label="Partnership since" value={relationship.activatedAt ? new Date(relationship.activatedAt).toLocaleDateString() : '—'} />
      <InfoRow label="MOU version" value={relationship.mouVersion} />
      <InfoRow label="MOU signed" value={
        relationship.acceptorMouSignedAt ? new Date(relationship.acceptorMouSignedAt).toLocaleDateString() : '—'
      } />
      {policy && (
        <>
          <div style={s.divider} />
          <InfoRow label="Sharing mode" value={policy.sharingMode} />
          <InfoRow label="Priority threshold" value={`P1–P${policy.sharePriorityThreshold}`} />
          <InfoRow label="Incident types" value={
            policy.shareIncidentTypes.includes('*' as any) ? 'All types' : policy.shareIncidentTypes.join(', ')
          } />
          <InfoRow label="CAD write-back" value={
            policy.writebackEnabled ? `Enabled (${policy.writebackMode} mode)` : 'Disabled'
          } />
        </>
      )}
    </div>
  );
}

function DrawerPolicy({
  policy, onUpdate, saving,
}: {
  policy: AgencySharingPolicy;
  onUpdate: (update: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState(policy);

  const setField = (field: keyof ShareFieldPolicy, val: boolean) =>
    setLocal(p => ({ ...p, shareFields: { ...p.shareFields, [field]: val } }));

  const setPriority = (val: Priority) =>
    setLocal(p => ({ ...p, sharePriorityThreshold: val }));

  const toggleType = (type: IncidentType) =>
    setLocal(p => {
      const types = p.shareIncidentTypes as IncidentType[];
      return {
        ...p,
        shareIncidentTypes: types.includes(type)
          ? types.filter(t => t !== type)
          : [...types, type],
      };
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Enable / mode */}
      <div>
        <Toggle
          on={local.enabled}
          onChange={v => setLocal(p => ({ ...p, enabled: v }))}
          label="Sharing enabled"
          description="Pause all outbound sharing to this partner without revoking the relationship"
        />
        <div style={{ marginTop: '12px' }}>
          <div style={s.label}>Sharing mode</div>
          <select
            style={s.select}
            value={local.sharingMode}
            onChange={e => setLocal(p => ({ ...p, sharingMode: e.target.value as any }))}
          >
            <option value="automatic">Automatic — share immediately</option>
            <option value="manual">Manual — dispatcher shares each incident</option>
            <option value="mutual_aid_only">Mutual aid only — when declared in CAD</option>
          </select>
        </div>
      </div>

      <div style={s.divider} />

      {/* Priority threshold */}
      <div>
        <div style={s.h3}>Priority threshold</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
          Share incidents at or above this priority level
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {PRIORITIES.map(p => (
            <button
              key={p}
              style={s.priorityBar(local.sharePriorityThreshold >= p, s.priorityColors[p])}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div style={s.divider} />

      {/* Incident types */}
      <div>
        <div style={s.h3}>Incident types</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            style={s.priorityBar(
              (local.shareIncidentTypes as string[]).includes('*'),
              '#1D9E75'
            )}
            onClick={() => setLocal(p => ({ ...p, shareIncidentTypes: ['*'] }))}
          >
            All types
          </button>
          {INCIDENT_TYPES.map(t => {
            const active = (local.shareIncidentTypes as string[]).includes(t) ||
              (local.shareIncidentTypes as string[]).includes('*');
            return (
              <button
                key={t}
                style={s.priorityBar(active, '#1D9E75')}
                onClick={() => {
                  if ((local.shareIncidentTypes as string[]).includes('*')) {
                    setLocal(p => ({ ...p, shareIncidentTypes: INCIDENT_TYPES.filter(x => x !== t) }));
                  } else {
                    toggleType(t);
                  }
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={s.divider} />

      {/* Field toggles */}
      <div>
        <div style={s.h3}>Shared fields</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(Object.keys(FIELD_LABELS) as (keyof ShareFieldPolicy)[]).map(field => (
            <Toggle
              key={field}
              on={local.shareFields[field]}
              onChange={v => setField(field, v)}
              label={FIELD_LABELS[field]}
              description={
                field === 'narrative' || field === 'transcript'
                  ? 'PII is automatically scrubbed before sharing'
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div style={s.divider} />

      {/* Geo boundary */}
      <div>
        <div style={s.h3}>Geographic boundary</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
          Only share incidents within this distance of the jurisdictional border (optional)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            style={{ ...s.input, width: '80px' }}
            value={local.geoBoundaryMiles ?? ''}
            placeholder="∞"
            min={1}
            max={200}
            onChange={e => setLocal(p => ({
              ...p,
              geoBoundaryMiles: e.target.value ? parseInt(e.target.value) : undefined,
            }))}
          />
          <span style={{ color: '#6b7280', fontSize: '13px' }}>miles</span>
        </div>
      </div>

      <button
        style={{ ...s.btn('primary'), opacity: saving ? 0.6 : 1 }}
        disabled={saving}
        onClick={() => onUpdate({
          enabled: local.enabled,
          sharingMode: local.sharingMode,
          shareIncidentTypes: local.shareIncidentTypes,
          sharePriorityThreshold: local.sharePriorityThreshold,
          shareFields: local.shareFields,
          geoBoundaryMiles: local.geoBoundaryMiles ?? null,
        })}
      >
        {saving ? 'Saving…' : 'Save policy'}
      </button>
    </div>
  );
}

// ── Phase 3: Drawer Write-back ───────────────────────────────────────────────

function DrawerWriteback({
  policy, onToggle, onUpdate, saving,
}: {
  policy: AgencySharingPolicy;
  onToggle: (enabled: boolean, mode?: 'assisted'|'automatic') => void;
  onUpdate: (update: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [wbFields, setWBFields] = useState<WritebackFieldPolicy>(policy.writebackFields);
  const [mode, setMode] = useState<'assisted'|'automatic'>(policy.writebackMode ?? 'assisted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Master toggle */}
      <div style={{ padding: '16px', background: policy.writebackEnabled ? '#1D9E7511' : '#161b2e', border: `1px solid ${policy.writebackEnabled ? '#1D9E7533' : '#1e2130'}`, borderRadius: '8px' }}>
        <Toggle
          on={policy.writebackEnabled}
          onChange={v => onToggle(v, mode)}
          label="CAD write-back"
          description="When enabled, incidents shared from this partner will populate into your CAD system"
        />
        {policy.writebackEnabled && (
          <div style={{ marginTop: '4px', fontSize: '12px', color: '#1D9E75' }}>
            ● Active in {policy.writebackMode} mode
          </div>
        )}
      </div>

      {/* Write-back mode */}
      <div>
        <div style={s.h3}>Write-back mode</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            style={{
              ...s.card,
              cursor: 'pointer',
              border: mode === 'assisted' ? '1px solid #1D9E75' : '1px solid #1e2130',
              textAlign: 'left' as const,
              marginBottom: 0,
            }}
            onClick={() => setMode('assisted')}
          >
            <div style={{ fontWeight: 600, color: mode === 'assisted' ? '#1D9E75' : '#e2e4ea', marginBottom: '4px', fontSize: '14px' }}>
              {mode === 'assisted' ? '● ' : '○ '}Assisted (recommended)
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
              Dispatcher reviews and approves each write before it enters your CAD.
              Full control, audit trail on every decision.
            </div>
          </button>
          <button
            style={{
              ...s.card,
              cursor: 'pointer',
              border: mode === 'automatic' ? '1px solid #EF9F27' : '1px solid #1e2130',
              textAlign: 'left' as const,
              marginBottom: 0,
            }}
            onClick={() => setMode('automatic')}
          >
            <div style={{ fontWeight: 600, color: mode === 'automatic' ? '#EF9F27' : '#e2e4ea', marginBottom: '4px', fontSize: '14px' }}>
              {mode === 'automatic' ? '● ' : '○ '}Automatic
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
              Incidents write directly into your CAD on delivery.
              Faster but requires trust in partner data quality.
            </div>
          </button>
        </div>
      </div>

      <div style={s.divider} />

      {/* Write-back fields */}
      <div>
        <div style={s.h3}>Fields written to CAD</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(Object.keys(WRITEBACK_FIELD_LABELS) as (keyof WritebackFieldPolicy)[]).map(field => (
            <Toggle
              key={field}
              on={wbFields[field]}
              onChange={v => setWBFields(f => ({ ...f, [field]: v }))}
              label={WRITEBACK_FIELD_LABELS[field]}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {policy.writebackEnabled && (
          <button
            style={{ ...s.btn('danger'), flex: 1 }}
            disabled={saving}
            onClick={() => onToggle(false)}
          >
            Disable write-back
          </button>
        )}
        <button
          style={{ ...s.btn('primary'), flex: 1, opacity: saving ? 0.6 : 1 }}
          disabled={saving}
          onClick={() => {
            onUpdate({ writebackFields: wbFields });
            if (!policy.writebackEnabled) onToggle(true, mode);
            else onToggle(true, mode);
          }}
        >
          {saving ? 'Saving…' : policy.writebackEnabled ? 'Update write-back' : 'Enable write-back'}
        </button>
      </div>

      <div style={{ padding: '10px 12px', background: '#0f1117', borderRadius: '6px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
        ⚠️ Write-back creates incidents in your live CAD system. Ensure your CAD vendor adapter is
        configured and tested in staging before enabling in production.
      </div>
    </div>
  );
}

// ── Phase 4: Mesh Map ─────────────────────────────────────────────────────────

function MeshMapTab({
  agencyId, relationships,
}: {
  agencyId: string;
  relationships: EnrichedRelationship[];
}) {
  const activePartners = relationships.filter(r => r.status === 'active');

  // SVG-based mesh visualization (placeholder for ALS map integration)
  // In production: use Amazon Location Service map + draw agency markers and edges
  const nodes = [
    { id: agencyId, name: 'Your agency', x: 300, y: 200, active: true, primary: true },
    ...activePartners.map((r, i) => {
      const angle = (i / activePartners.length) * Math.PI * 2;
      return {
        id: r.partnerAgencyId,
        name: r.partnerAgencyName,
        x: 300 + Math.cos(angle) * 180,
        y: 200 + Math.sin(angle) * 140,
        active: true,
        primary: false,
        writeback: r.policy?.writebackEnabled ?? false,
      };
    }),
  ];

  return (
    <div>
      <div style={{ ...s.card, padding: '0', overflow: 'hidden' }}>
        {/* Map header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e2130', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Agency mesh</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {activePartners.length} active partner{activePartners.length !== 1 ? 's' : ''} in network
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1D9E75' }} />
              Active share
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#378ADD' }} />
              + CAD write-back
            </div>
          </div>
        </div>

        {/* SVG mesh diagram */}
        <svg width="100%" viewBox="0 0 600 420" style={{ background: '#0a0d18' }}>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grid */}
          {[...Array(8)].map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 55} x2="600" y2={i * 55}
              stroke="#1e2130" strokeWidth="0.5" />
          ))}
          {[...Array(10)].map((_, i) => (
            <line key={`v${i}`} x1={i * 67} y1="0" x2={i * 67} y2="420"
              stroke="#1e2130" strokeWidth="0.5" />
          ))}

          {/* Edges (connections) */}
          {nodes.slice(1).map(n => {
            const writeback = (n as any).writeback;
            return (
              <g key={`edge-${n.id}`}>
                <line
                  x1={300} y1={200} x2={n.x} y2={n.y}
                  stroke={writeback ? '#378ADD' : '#1D9E75'}
                  strokeWidth={writeback ? 1.5 : 1}
                  strokeDasharray={writeback ? 'none' : '4 3'}
                  opacity={0.5}
                />
                {/* Animated dot on edge */}
                <circle r="3" fill={writeback ? '#378ADD' : '#1D9E75'} opacity="0.8">
                  <animateMotion
                    dur={`${1.5 + Math.random() * 1.5}s`}
                    repeatCount="indefinite"
                    path={`M ${300} ${200} L ${n.x} ${n.y}`}
                  />
                </circle>
              </g>
            );
          })}

          {/* Primary agency node */}
          <circle cx={300} cy={200} r={40} fill="url(#glow)" />
          <circle cx={300} cy={200} r={22} fill="#1D9E7522" stroke="#1D9E75" strokeWidth={2} />
          <text x={300} y={195} textAnchor="middle" fill="#1D9E75" fontSize={11} fontWeight={700}>YOUR</text>
          <text x={300} y={209} textAnchor="middle" fill="#1D9E75" fontSize={11} fontWeight={700}>AGENCY</text>

          {/* Partner nodes */}
          {nodes.slice(1).map(n => {
            const wb = (n as any).writeback;
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={18}
                  fill={wb ? '#378ADD22' : '#1D9E7511'}
                  stroke={wb ? '#378ADD' : '#1D9E75'}
                  strokeWidth={1.5}
                />
                {wb && (
                  <circle cx={n.x + 13} cy={n.y - 13} r={6}
                    fill="#378ADD" stroke="#0a0d18" strokeWidth={1.5} />
                )}
                <text x={n.x} y={n.y + 4} textAnchor="middle"
                  fill="#e2e4ea" fontSize={9} fontWeight={500}>
                  {n.name.slice(0, 10)}
                </text>
              </g>
            );
          })}

          {/* Empty state */}
          {nodes.length === 1 && (
            <text x={300} y={350} textAnchor="middle" fill="#374151" fontSize={13}>
              No active partners — invite an agency to see the mesh
            </text>
          )}
        </svg>

        {/* Partner list below map */}
        {activePartners.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1e2130' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {activePartners.map(r => (
                <span key={r.partnerAgencyId} style={s.badge(r.policy?.writebackEnabled ? '#378ADD' : '#1D9E75')}>
                  <div style={s.dot(r.policy?.writebackEnabled ? '#378ADD' : '#1D9E75')} />
                  {r.partnerAgencyName}
                  {r.policy?.writebackEnabled && ' · CAD↔'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ALS map note */}
      <div style={{ ...s.card, marginTop: '12px', fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
        <span style={{ color: '#378ADD', fontWeight: 500 }}>Phase 4 production:</span>{' '}
        Replace the SVG above with an Amazon Location Service map. Render agency HQ markers using ALS
        GeoJSON layers, draw mesh edges as GeoJSON LineStrings, and animate incident dots along the
        routes using the ALS tracker API. Agency positions load from your existing agency profile table.
      </div>
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({
  agencyId, onClose, onSuccess,
}: {
  agencyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [partnerId, setPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [message, setMessage] = useState('');
  const [mouAccepted, setMouAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!partnerId.trim()) { setError('Agency ID is required'); return; }
    if (!mouAccepted) { setError('You must accept the MOU to proceed'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/agencies/${agencyId}/network/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerAgencyId: partnerId.trim(),
          partnerAgencyName: partnerName.trim() || partnerId.trim(),
          inviteMessage: message.trim() || undefined,
          mouVersion: '1.0',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ ...s.overlay, justifyContent: 'center', alignItems: 'center' }} onClick={onClose}>
      <div
        style={{ background: '#161b2e', border: '1px solid #1e2130', borderRadius: '12px', padding: '28px', width: '480px', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ ...s.h1, marginBottom: '20px' }}>Invite partner agency</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={s.label}>Agency ID *</div>
            <input style={s.input} value={partnerId} onChange={e => setPartnerId(e.target.value)} placeholder="agency-uuid-here" />
          </div>
          <div>
            <div style={s.label}>Agency name</div>
            <input style={s.input} value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Hamilton County 911" />
          </div>
          <div>
            <div style={s.label}>Message (optional)</div>
            <textarea
              style={{ ...s.input, resize: 'vertical' as const, minHeight: '72px' }}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Brief message to the partner agency admin…"
            />
          </div>

          <div style={{ padding: '12px', background: '#0f1117', borderRadius: '8px', fontSize: '12px', color: '#6b7280', lineHeight: 1.7 }}>
            <strong style={{ color: '#e2e4ea' }}>Mutual Aid Data Sharing Agreement v1.0</strong><br />
            By sending this invite, your agency agrees to share CAD incident data
            with the partner agency subject to your configured sharing policy.
            Data shared is subject to PII scrubbing, field-level controls, and
            a complete audit trail. Either party may suspend or revoke sharing at any time.
            Partner must independently accept this MOU before sharing activates.
          </div>

          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={mouAccepted}
              onChange={e => setMouAccepted(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#1D9E75' }}
            />
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              I accept the Mutual Aid Data Sharing Agreement on behalf of my agency
            </span>
          </label>

          {error && (
            <div style={{ padding: '8px 12px', background: '#E24B4A11', border: '1px solid #E24B4A33', borderRadius: '6px', fontSize: '13px', color: '#E24B4A' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button style={s.btn('ghost')} onClick={onClose}>Cancel</button>
            <button
              style={{ ...s.btn('primary'), opacity: (submitting || !mouAccepted) ? 0.6 : 1 }}
              disabled={submitting || !mouAccepted}
              onClick={submit}
            >
              {submitting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#e2e4ea', fontWeight: 500, textAlign: 'right' as const }}>{value}</span>
    </div>
  );
}
