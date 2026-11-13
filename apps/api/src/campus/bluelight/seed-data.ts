/**
 * Simulation seed poles for campus_state_u_demo.
 * Used when BLUELIGHT_USE_SEED=true. Never connects to live infrastructure.
 */

import type { BlueLightPole } from "rapid-cortex-shared";

const NOW = new Date().toISOString();

export const SEED_CAMPUS_ID = "campus_state_u_demo";

export const SEED_POLES: BlueLightPole[] = [
  {
    poleId: "BLP-001",
    campusId: SEED_CAMPUS_ID,
    label: "Library East Entrance",
    zone: "North Campus",
    buildingId: "bldg_library",
    location: { lat: 35.3083, lng: -80.7347 },
    vendor: "code_blue",
    sipExtension: "7001",
    status: "active",
    installedAt: "2024-08-15",
    linkedCameras: [
      {
        cameraId: "cam_lib_east_01",
        label: "Library East Door — Wide",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-lib-east-01",
        distanceMeters: 8,
      },
      {
        cameraId: "cam_lib_east_02",
        label: "Library Courtyard",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-lib-east-02",
        distanceMeters: 22,
      },
      {
        cameraId: "cam_lib_stairs_01",
        label: "Library Stairwell North",
        streamPreference: "hls",
        streamRef: "nexcortiq-campus-lib-stairs-01",
        distanceMeters: 35,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    poleId: "BLP-027",
    campusId: SEED_CAMPUS_ID,
    label: "Student Union South Walkway",
    zone: "Central Campus",
    buildingId: "bldg_student_union",
    location: { lat: 35.3071, lng: -80.7332 },
    vendor: "talkaphone",
    sipExtension: "7027",
    status: "active",
    installedAt: "2023-05-10",
    linkedCameras: [
      {
        cameraId: "cam_su_south_01",
        label: "Student Union South — Entrance",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-su-south-01",
        distanceMeters: 5,
      },
      {
        cameraId: "cam_su_south_02",
        label: "Student Union Parking Lot B",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-su-south-02",
        distanceMeters: 18,
      },
      {
        cameraId: "cam_su_walkway_01",
        label: "South Walkway — Mid",
        streamPreference: "hls",
        streamRef: "nexcortiq-campus-su-walkway-01",
        distanceMeters: 30,
      },
      {
        cameraId: "cam_su_walkway_02",
        label: "South Walkway — North End",
        streamPreference: "hls",
        streamRef: "nexcortiq-campus-su-walkway-02",
        distanceMeters: 55,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    poleId: "BLP-043",
    campusId: SEED_CAMPUS_ID,
    label: "Recreation Center Parking Deck",
    zone: "West Campus",
    buildingId: "bldg_rec_center",
    location: { lat: 35.3065, lng: -80.7389 },
    vendor: "rath",
    sipExtension: "7043",
    status: "active",
    installedAt: "2022-11-01",
    linkedCameras: [
      {
        cameraId: "cam_rec_deck_01",
        label: "Parking Deck Level 1 — North",
        streamPreference: "vms",
        streamRef: "milestone://rec-deck-cam-01",
        distanceMeters: 12,
      },
      {
        cameraId: "cam_rec_deck_02",
        label: "Parking Deck Level 1 — South",
        streamPreference: "vms",
        streamRef: "milestone://rec-deck-cam-02",
        distanceMeters: 15,
      },
      {
        cameraId: "cam_rec_ext_01",
        label: "Rec Center West Entrance",
        streamPreference: "vms",
        streamRef: "milestone://rec-ext-cam-01",
        distanceMeters: 28,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    poleId: "BLP-058",
    campusId: SEED_CAMPUS_ID,
    label: "Science Building Quad",
    zone: "East Campus",
    buildingId: "bldg_science",
    location: { lat: 35.3092, lng: -80.7301 },
    vendor: "code_blue",
    sipExtension: "7058",
    status: "active",
    installedAt: "2024-01-20",
    linkedCameras: [
      {
        cameraId: "cam_sci_quad_01",
        label: "Science Quad — North",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-sci-quad-01",
        distanceMeters: 10,
      },
      {
        cameraId: "cam_sci_quad_02",
        label: "Science Quad — Fountain",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-sci-quad-02",
        distanceMeters: 20,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    poleId: "BLP-072",
    campusId: SEED_CAMPUS_ID,
    label: "Residence Hall Row — Building C",
    zone: "South Campus",
    buildingId: "bldg_res_c",
    location: { lat: 35.3049, lng: -80.7355 },
    vendor: "alertus",
    sipExtension: "7072",
    status: "active",
    installedAt: "2023-08-05",
    notes: "High-traffic late-night zone — priority camera response",
    linkedCameras: [
      {
        cameraId: "cam_res_c_front_01",
        label: "Res Hall C — Front Door",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-res-c-front-01",
        distanceMeters: 6,
      },
      {
        cameraId: "cam_res_c_path_01",
        label: "Res Hall Row — South Path",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-res-c-path-01",
        distanceMeters: 25,
      },
      {
        cameraId: "cam_res_c_lot_01",
        label: "Res Hall Lot C — East End",
        streamPreference: "hls",
        streamRef: "nexcortiq-campus-res-c-lot-01",
        distanceMeters: 40,
      },
      {
        cameraId: "cam_res_c_laundry_01",
        label: "Res Hall C — Laundry Exit",
        streamPreference: "webrtc",
        streamRef: "nexcortiq-campus-res-c-laundry-01",
        distanceMeters: 18,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export function findPoleBySipExtension(extension: string): BlueLightPole | undefined {
  return SEED_POLES.find((p) => p.sipExtension === extension);
}

export function findPoleById(poleId: string): BlueLightPole | undefined {
  return SEED_POLES.find((p) => p.poleId === poleId);
}
