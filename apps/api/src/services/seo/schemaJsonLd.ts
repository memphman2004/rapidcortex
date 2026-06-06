/** Builds JSON-LD objects for common schema.org types used in marketing pages. */
export function generateJsonLd(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  const ctx = "https://schema.org";
  const base = { "@context": ctx };

  switch (type) {
    case "Organization":
      return {
        ...base,
        "@type": "Organization",
        name: payload.name ?? "Rapid Cortex",
        url: payload.url ?? "https://www.rapidcortex.us",
        logo: payload.logo,
        sameAs: payload.sameAs,
      };
    case "SoftwareApplication":
      return {
        ...base,
        "@type": "SoftwareApplication",
        name: payload.name ?? "Rapid Cortex",
        applicationCategory: payload.applicationCategory ?? "BusinessApplication",
        operatingSystem: payload.operatingSystem ?? "Web",
        offers: payload.offers,
      };
    case "Product":
      return {
        ...base,
        "@type": "Product",
        name: payload.name,
        description: payload.description,
        brand: payload.brand ?? { "@type": "Brand", name: "Rapid Cortex" },
      };
    case "FAQPage":
      return {
        ...base,
        "@type": "FAQPage",
        mainEntity: payload.mainEntity ?? [],
      };
    case "LocalBusiness":
      return {
        ...base,
        "@type": "LocalBusiness",
        name: payload.name,
        address: payload.address,
        geo: payload.geo,
        telephone: payload.telephone,
        url: payload.url,
      };
    case "Article":
      return {
        ...base,
        "@type": "Article",
        headline: payload.headline,
        author: payload.author,
        datePublished: payload.datePublished,
        image: payload.image,
      };
    case "BreadcrumbList":
      return {
        ...base,
        "@type": "BreadcrumbList",
        itemListElement: payload.itemListElement ?? [],
      };
    default:
      return { ...base, "@type": type, ...payload };
  }
}
