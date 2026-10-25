import { CadConsoleGate } from "@/components/dispatch/cad-console-gate";

export const metadata = {
  title: "CAD",
  robots: { index: false, follow: false },
};

export default function CadModulePage() {
  return <CadConsoleGate />;
}
