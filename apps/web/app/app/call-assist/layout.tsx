import { notFound } from "next/navigation";
import { CallAssistProductLayout } from "@/components/call-assist/call-assist-product-layout";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

export default function CallAssistAppLayout({ children }: { children: React.ReactNode }) {
  if (!isCallAssistEnabled()) notFound();
  return <CallAssistProductLayout>{children}</CallAssistProductLayout>;
}
