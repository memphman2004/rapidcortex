import { InfrastructureClient } from "./infrastructure-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function InfrastructurePage({ params }: Props) {
  return <InfrastructureClient params={params} />;
}
