import type { Metadata } from "next";
import { JurisdictionProvider } from "@/lib/jurisdiction-context";

type Props = {
  children: React.ReactNode;
  params: Promise<{ jurisdiction: string }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function JurisdictionLayout({ children, params }: Props) {
  const { jurisdiction } = await params;
  return (
    <JurisdictionProvider slug={jurisdiction}>{children}</JurisdictionProvider>
  );
}
