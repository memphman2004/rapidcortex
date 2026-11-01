import { describe, expect, it } from "vitest";
import {
  candidateFromArtic,
  candidateFromCleveland,
  candidateFromDataverse,
  candidateFromFigshare,
  candidateFromFinna,
  candidateFromLibraryOfCongress,
  candidateFromNasa,
  candidateFromSmk,
  candidateFromWellcome,
  candidateFromZenodo,
} from "./discovery-catalogs";
import { discoveryMediaRefusal, discoverySourceAllowed } from "./model-studio";

describe("additional discovery catalogs", () => {
  it("keeps a Library of Congress record with no stated license out of training", () => {
    const candidate = candidateFromLibraryOfCongress({
      id: "http://www.loc.gov/item/2002705732/",
      title: "Gallop ambulance",
      url: "https://www.loc.gov/item/2002705732/",
      online_format: ["image"],
      image_url: ["https://tile.loc.gov/storage-services/service/pnp/example.jpg#h=100&w=100"],
      item: { rights_advisory: "No known restrictions on publication." },
    }, "image");
    expect(candidate?.trainable).toBe(false);
    expect(candidate?.previewUrl).toBe("https://tile.loc.gov/storage-services/service/pnp/example.jpg");
    expect(candidate?.playbackUrl).toBeNull();
  });

  it("does not treat an unmarked NASA record as public domain", () => {
    const candidate = candidateFromNasa({
      data: [{ nasa_id: "ABC 1", title: "Street", description: "A NASA photograph.", media_type: "image", center: "HQ" }],
      links: [{ href: "https://images-assets.nasa.gov/image/ABC/thumb.jpg", rel: "preview" }],
    });
    expect(candidate?.trainable).toBe(false);
    expect(candidate?.sourceUrl).toContain("images.nasa.gov/details/");
  });

  it("accepts a Wellcome image only when the record license is open", () => {
    const candidate = candidateFromWellcome({
      id: "x4xgvpmf",
      source: { title: "View of a broad street" },
      locations: [{
        license: { label: "Attribution 4.0 International (CC BY 4.0)" },
        credit: "Wellcome Collection",
        url: "https://iiif.wellcomecollection.org/image/L0009277/info.json",
      }],
    });
    expect(candidate?.trainable).toBe(true);
    expect(candidate?.previewUrl).toContain("/full/480,/0/default.jpg");
    expect(candidateFromWellcome({
      id: "closed",
      source: { title: "Restricted" },
      locations: [{ license: { label: "Restricted" }, url: "https://iiif.wellcomecollection.org/image/L1/info.json" }],
    })?.previewUrl).toBeNull();
  });

  it("uses the museum license and does not copy demographic artist tags", () => {
    const cleveland = candidateFromCleveland({
      id: 196494,
      title: "Street characters",
      url: "https://clevelandart.org/art/1964.94",
      share_license_status: "CC0",
      images: { web: { url: "https://openaccess-cdn.clevelandart.org/1964.94/1964.94_web.jpg", width: "900", height: "600" } },
    });
    expect(cleveland?.trainable).toBe(true);
    expect(cleveland?.creator).toBe("Cleveland Museum of Art");
    expect(candidateFromArtic({ id: 1, title: "Studio", artist_display: "Ada Lovelace\nBritish", image_id: "abc", is_public_domain: false })?.trainable).toBe(false);
    expect(candidateFromSmk({
      id: "1170012150_object",
      titles: [{ title: "Beer Street" }],
      public_domain: true,
      frontend_url: "https://open.smk.dk/artwork/image/KKSgb12783a",
    })?.trainable).toBe(true);
  });

  it("reads Finna image rights and refuses a non-commercial Zenodo license", () => {
    const finna = candidateFromFinna({
      id: "hkm.d59656d8-5cf9-4a9f-9ae6-0be1bbf1d0b4",
      title: "Street Bar",
      images: ["/Cover/Show?source=Solr&id=hkm.example&index=0&size=large"],
      imageRights: { copyright: "CC BY 4.0" },
      nonPresenterAuthors: [{ name: "Henriksson, Marit" }],
    });
    expect(finna?.trainable).toBe(true);
    expect(finna?.sourceUrl).toContain("finna.fi/Record/");
    expect(candidateFromZenodo({
      id: 10,
      metadata: { title: "Camera set", license: { id: "cc-by-nc-4.0" }, resource_type: { type: "dataset" } },
      links: { self_html: "https://zenodo.org/records/10" },
    })?.trainable).toBe(false);
    expect(candidateFromFigshare({
      id: 20,
      title: "Street set",
      defined_type_name: "dataset",
      url_public_html: "https://figshare.com/articles/dataset/street/20",
      license: { name: "CC BY 4.0" },
    })?.trainable).toBe(true);
    expect(candidateFromFigshare({ id: 21, title: "Paper", defined_type_name: "preprint", url_public_html: "https://figshare.com/articles/preprint/x/21" })).toBeNull();
    expect(candidateFromDataverse({
      global_id: "doi:10.7910/DVN/SV9N9F",
      name: "Road CCTV images",
      url: "https://doi.org/10.7910/DVN/SV9N9F",
      license: null,
    })?.trainable).toBe(false);
  });

  it("blocks YouTube and mismatched media", () => {
    expect(discoverySourceAllowed("finna")).toBe(true);
    expect(discoverySourceAllowed("youtube")).toBe(false);
    expect(discoveryMediaRefusal("finna", "video")).toMatch(/does not supply video/);
    expect(discoveryMediaRefusal("zenodo", "image")).toMatch(/Datasets/);
  });
});
