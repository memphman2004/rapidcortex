/**
 * Named datasets a person might ask to train on.
 * Every row refuses a download. A paper, a class list, or a public page is not a training file.
 */

export type PublishedDatasetStatus = "blocked" | "research" | "lead" | "agreement" | "closed";

export type PublishedDataset = {
  id: string;
  name: string;
  category: string;
  status: PublishedDatasetStatus;
  reason: string;
  page: string | null;
};

export const PUBLISHED_DATASET_STATUS_LABEL: Record<PublishedDatasetStatus, string> = {
  blocked: "Not eligible",
  research: "Research terms only",
  lead: "License still has to be read",
  agreement: "Agreement required",
  closed: "Not connected",
};

export const PUBLISHED_DATASETS: readonly PublishedDataset[] = [
  {
    id: "rwf-2000",
    name: "RWF-2000",
    category: "Physical altercation",
    status: "blocked",
    reason: "The clips were taken from YouTube. They are not imported.",
    page: null,
  },
  {
    id: "xd-violence",
    name: "XD-Violence",
    category: "Physical altercation",
    status: "blocked",
    reason: "The clips were taken from YouTube. They are not imported.",
    page: null,
  },
  {
    id: "hockey-fight",
    name: "Hockey Fight Dataset",
    category: "Physical altercation",
    status: "research",
    reason: "Broadcast sports clips. No commercial training license is on file. Not downloaded.",
    page: null,
  },
  {
    id: "ucf-crime",
    name: "UCF-Crime",
    category: "Physical altercation",
    status: "blocked",
    reason: "The clips were gathered from the web, including YouTube. A research paper is not a license to train this product. Not downloaded.",
    page: null,
  },
  {
    id: "ava",
    name: "AVA",
    category: "Physical altercation",
    status: "research",
    reason: "Movie clips. A research release is not a commercial training grant. Not downloaded.",
    page: null,
  },
  {
    id: "kinetics-700",
    name: "Kinetics-700",
    category: "Physical altercation",
    status: "blocked",
    reason: "The release lists YouTube videos. Those files are not downloaded.",
    page: null,
  },
  {
    id: "open-images-v7",
    name: "Open Images v7",
    category: "Firearm-like and blade-like objects",
    status: "lead",
    reason: "The label list includes handgun, knife, and rifle. Each photo keeps its own license. The images are not downloaded.",
    page: "https://storage.googleapis.com/openimages/web/index.html",
  },
  {
    id: "coco",
    name: "COCO",
    category: "People and everyday objects",
    status: "lead",
    reason: "COCO annotates people and everyday objects, including knife. It does not include firearm classes. Image rights vary, and the set is not downloaded.",
    page: "https://cocodataset.org/",
  },
  {
    id: "cadp",
    name: "CADP",
    category: "Vehicle collision",
    status: "research",
    reason: "Dashcam research footage. The terms are not a commercial training grant. Not downloaded.",
    page: null,
  },
  {
    id: "dota",
    name: "DoTA",
    category: "Vehicle collision",
    status: "research",
    reason: "Dashcam research footage. The terms are not a commercial training grant. Not downloaded.",
    page: null,
  },
  {
    id: "bdd100k",
    name: "BDD100K",
    category: "Vehicle collision",
    status: "research",
    reason: "Berkeley's terms are not an automatic commercial grant. Not downloaded.",
    page: "https://bdd-data.berkeley.edu/",
  },
  {
    id: "kitti",
    name: "KITTI",
    category: "Vehicle collision",
    status: "research",
    reason: "The license is non-commercial. Not downloaded.",
    page: "https://www.cvlibs.net/datasets/kitti/",
  },
  {
    id: "le2i",
    name: "Le2i Fall Detection",
    category: "Person down",
    status: "research",
    reason: "Indoor fall research videos. No commercial training license is on file. Not downloaded.",
    page: null,
  },
  {
    id: "urfd",
    name: "UR Fall Detection",
    category: "Person down",
    status: "research",
    reason: "Fall research videos. No commercial training license is on file. Not downloaded.",
    page: null,
  },
  {
    id: "fdd",
    name: "Fall Detection Dataset",
    category: "Person down",
    status: "research",
    reason: "Several releases share this name. None is imported until a person records that release's license.",
    page: null,
  },
  {
    id: "virat",
    name: "VIRAT",
    category: "Forced entry",
    status: "agreement",
    reason: "Distribution is controlled. Real surveillance footage is not pulled from a public link.",
    page: null,
  },
  {
    id: "pets",
    name: "PETS",
    category: "Forced entry",
    status: "research",
    reason: "A surveillance benchmark. The release terms are not a commercial training grant. Not downloaded.",
    page: null,
  },
  {
    id: "roboflow-universe",
    name: "Roboflow Universe",
    category: "Mixed community sets",
    status: "blocked",
    reason: "Community datasets do not share one license. A Universe page is not downloaded.",
    page: "https://universe.roboflow.com/",
  },
  {
    id: "omniverse",
    name: "NVIDIA Omniverse Replicator",
    category: "Synthetic scenes",
    status: "closed",
    reason: "Synthetic footage is not generated here. A later synthetic clip would be labeled synthetic and scored apart from real footage.",
    page: null,
  },
  {
    id: "state-dot",
    name: "State DOT traffic archives",
    category: "Vehicle collision",
    status: "agreement",
    reason: "Florida, Texas, California, New York, and 511 archives need a data agreement. Feeds are not scraped.",
    page: null,
  },
  {
    id: "commercial-footage",
    name: "Stock and news footage",
    category: "Licensed footage",
    status: "agreement",
    reason: "Shutterstock, Getty, Pond5, and news archives need a contract. Blurring a face does not replace that contract. None is connected.",
    page: null,
  },
  {
    id: "agency-archive",
    name: "Agency archive clips",
    category: "Agency cameras",
    status: "agreement",
    reason: "A signed data-sharing agreement comes first. Upload is closed. Faces are not a training label. Real-incident footage, if it is ever accepted, needs a written lineage in a restricted store.",
    page: null,
  },
];

export function publishedDatasetImport(id: string): { ok: false; downloaded: false; reason: string } {
  const row = PUBLISHED_DATASETS.find((item) => item.id === id);
  if (!row) {
    return { ok: false, downloaded: false, reason: "That dataset is not in the registry. Nothing was downloaded." };
  }
  return { ok: false, downloaded: false, reason: row.reason };
}
