"use client";

import { useState } from "react";
import { LOADOUT_FEATURES } from "rapid-cortex-shared/loadout";
import { CatalogFeatureCard } from "../_components/CatalogFeatureCard";
import { AddFeatureModal } from "../_components/AddFeatureModal";
import { EnterpriseRequestModal } from "../_components/EnterpriseRequestModal";
import type { FeatureCategory } from "rapid-cortex-shared/loadout";

interface CatalogClientProps {
  activeFeatures: string[];
  tenantId: string;
}

const CATEGORIES: FeatureCategory[] = ["core", "intelligence", "quality", "field", "automation", "enterprise"];

export function CatalogClient({ activeFeatures, tenantId }: CatalogClientProps) {
  const [activeCategory, setActiveCategory] = useState<FeatureCategory | "all">("all");
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [enterpriseTarget, setEnterpriseTarget] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const features = Object.values(LOADOUT_FEATURES).filter((f) =>
    activeCategory === "all" ? true : f.category === activeCategory,
  );

  const addFeature = LOADOUT_FEATURES[addTarget ?? ""];
  const enterpriseFeature = LOADOUT_FEATURES[enterpriseTarget ?? ""];

  return (
    <>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            activeCategory === "all"
              ? "border-violet-500 bg-violet-900/40 text-violet-300"
              : "border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              activeCategory === cat
                ? "border-violet-500 bg-violet-900/40 text-violet-300"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" key={refreshKey}>
        {features.map((feature) => (
          <CatalogFeatureCard
            key={feature.id}
            feature={feature}
            isActive={activeFeatures.includes(feature.id)}
            onAdd={setAddTarget}
            onEnterprise={setEnterpriseTarget}
          />
        ))}
      </div>

      {addTarget && addFeature && (
        <AddFeatureModal
          feature={addFeature}
          tenantId={tenantId}
          onClose={() => setAddTarget(null)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {enterpriseTarget && enterpriseFeature && (
        <EnterpriseRequestModal
          featureId={enterpriseTarget}
          featureName={enterpriseFeature.name}
          onClose={() => setEnterpriseTarget(null)}
        />
      )}
    </>
  );
}
