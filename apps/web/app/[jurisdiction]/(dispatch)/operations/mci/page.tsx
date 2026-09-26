import { MciClient } from "./mci-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function MciPage({ params }: Props) {
  return <MciClient params={params} />;
}
