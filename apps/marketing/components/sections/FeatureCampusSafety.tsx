import Image from "next/image";
import Link from "next/link";

const FLOW_STEPS = [
  {
    title: "Scan or tap",
    body: "QR codes and NFC tags at campus locations open a browser report form — no app download required.",
  },
  {
    title: "Report in seconds",
    body: "Location context, situation type, and optional photo go straight to campus dispatch and security.",
  },
  {
    title: "Coordinate response",
    body: "Campus console consolidates reports, two-way text, and situational awareness alongside existing ops.",
  },
] as const;

/**
 * Campus Safety showcase for the homepage demos section.
 * Uses existing product messaging and marketing visuals only.
 */
export function FeatureCampusSafety() {
  return (
    <section
      id="campus-safety-demo"
      className="scroll-mt-28 bg-[#07090F] px-4 py-20 sm:px-6 md:py-28"
      aria-labelledby="campus-safety-demo-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(232, 25, 44, 0.1)",
                  border: "1px solid rgba(232, 25, 44, 0.3)",
                  color: "#E8192C",
                }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E8192C]" aria-hidden />
                Campus Safety
              </span>
            </div>

            <h2
              id="campus-safety-demo-heading"
              className="rc-title-gradient mb-4 text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl"
            >
              Campus safety reporting without an app download
            </h2>

            <p className="mb-10 text-base leading-relaxed text-[#6A7B9D] md:text-lg">
              NexCort iQ Campus enables QR and NFC incident reporting for universities and K-12 —
              so students, staff, and visitors can reach campus security without installing another
              app first.
            </p>

            <div className="flex flex-col gap-6">
              {FLOW_STEPS.map((step) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center"
                    style={{
                      background: "rgba(0, 200, 122, 0.10)",
                      border: "1px solid rgba(0, 200, 122, 0.25)",
                    }}
                  >
                    <div className="mx-auto h-1.5 w-1.5 rounded-full bg-[#00C87A]" />
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-medium text-[#E8EEF8]">{step.title}</div>
                    <div className="text-sm leading-relaxed text-[#6A7B9D]">{step.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/product/campus"
              className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-sky-400 hover:text-sky-300"
            >
              Explore Campus Safety →
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#1A2940] bg-[#0B1220] shadow-[0_20px_60px_-30px_rgba(14,165,233,0.35)]">
            <Image
              src="/CampusMarketing.png"
              alt="NexCort iQ Campus Safety product visual"
              width={1672}
              height={941}
              className="h-auto w-full object-contain"
              sizes="(max-width: 1024px) 100vw, 640px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
