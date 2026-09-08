export class TranscribeVocabularyService {
  async createAgencyVocabulary(agencyId: string, locale: string, phrases: string[]): Promise<string> {
    const name = `rc-call-assist-${agencyId}-${locale}`.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 200);
    void phrases;
    return name;
  }
}
