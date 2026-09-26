import { MciCommandClient } from "./mci-command-client";

type Props = { params: Promise<{ jurisdiction: string; mciId: string }> };

export default function MciCommandPage({ params }: Props) {
  return <MciCommandClient params={params} />;
}
