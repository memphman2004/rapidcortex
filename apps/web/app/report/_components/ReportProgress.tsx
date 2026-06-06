"use client";

export function ReportProgress({ step, total }: { step: 1 | 2 | 3 | 4; total: 4 }) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex max-w-[220px] items-center justify-center">
        {[1, 2, 3, 4].map((dotStep, index) => {
          const isCurrent = dotStep === step;
          const isComplete = dotStep < step;
          return (
            <div key={dotStep} className="flex items-center">
              <span
                className={`rounded-full ${
                  isCurrent
                    ? "h-4 w-4 bg-blue-600"
                    : isComplete
                      ? "h-3 w-3 bg-slate-400"
                      : "h-3 w-3 border-2 border-slate-300 bg-white"
                }`}
              />
              {index < total - 1 ? <span className="mx-1 h-[1px] w-10 bg-slate-300" /> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Step {step} of {total}
      </p>
    </div>
  );
}
