import { getDeploymentEnvironment, isProductionLikeEnvironment } from "@/lib/runtime-env";

export function EnvironmentBadge() {
  const env = getDeploymentEnvironment();
  const prod = isProductionLikeEnvironment();
  return (
    <span
      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ${
        prod
          ? "bg-rose-950 text-rose-200 ring-1 ring-rose-800"
          : env === "preview"
            ? "bg-violet-950 text-violet-200 ring-1 ring-violet-800"
            : "bg-slate-800 text-slate-300 ring-1 ring-slate-600"
      }`}
      title="Deployment environment (NEXT_PUBLIC_APP_ENV or Vercel env)"
    >
      {env}
    </span>
  );
}
