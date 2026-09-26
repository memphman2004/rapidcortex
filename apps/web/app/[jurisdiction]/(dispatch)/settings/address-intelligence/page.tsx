import { AddressIntelligenceClient } from "./address-intelligence-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function AddressIntelligencePage({ params }: Props) {
  return <AddressIntelligenceClient params={params} />;
}
