import { JurisdictionWorkspacePlaceholder } from "@/components/dispatch/jurisdiction-workspace-placeholder";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function TranscriptionPage({ params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  return <JurisdictionWorkspacePlaceholder title="Transcription" />;
}
