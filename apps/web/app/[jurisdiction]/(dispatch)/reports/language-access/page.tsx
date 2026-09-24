import { LanguageAccessClient } from "./language-access-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default function LanguageAccessPage({ params }: Props) {
  return <LanguageAccessClient params={params} />;
}
