import { MutualAidClient } from "./mutual-aid-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function MutualAidPage({ params }: Props) {
  return <MutualAidClient params={params} />;
}
