import { CitizenRegistryClient } from "./citizen-registry-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function CitizenRegistryPage({ params }: Props) {
  return <CitizenRegistryClient params={params} />;
}
