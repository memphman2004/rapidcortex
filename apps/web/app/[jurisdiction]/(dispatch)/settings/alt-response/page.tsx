import { AltResponseClient } from "./alt-response-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function AltResponsePage({ params }: Props) {
  return <AltResponseClient params={params} />;
}
