"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  parseCampusInstitutionType,
  type CampusInstitutionType,
} from "rapid-cortex-shared";

type CampusInstitutionValue = {
  institutionType: CampusInstitutionType;
  loading: boolean;
};

const CampusInstitutionContext = createContext<CampusInstitutionValue>({
  institutionType: "higher_ed",
  loading: true,
});

export function CampusInstitutionProvider({
  agencyId,
  children,
  initialType,
}: {
  agencyId: string;
  children: ReactNode;
  initialType?: CampusInstitutionType;
}) {
  const [institutionType, setInstitutionType] = useState<CampusInstitutionType>(
    initialType ?? "higher_ed",
  );
  const [loading, setLoading] = useState(!initialType);

  useEffect(() => {
    if (!agencyId.trim()) {
      setInstitutionType("higher_ed");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/campus/${encodeURIComponent(agencyId)}/institution-type`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return { institutionType: "higher_ed" as const };
        return (await res.json()) as { institutionType?: string };
      })
      .then((body) => {
        if (cancelled) return;
        setInstitutionType(parseCampusInstitutionType(body.institutionType));
      })
      .catch(() => {
        if (!cancelled) setInstitutionType("higher_ed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const value = useMemo(
    () => ({ institutionType, loading }),
    [institutionType, loading],
  );

  return (
    <CampusInstitutionContext.Provider value={value}>
      {children}
    </CampusInstitutionContext.Provider>
  );
}

export function useCampusInstitutionType(): CampusInstitutionValue {
  return useContext(CampusInstitutionContext);
}
