import {
  getCampusStats,
  getCampusZonesSummary,
  getCampusBuildingsSummary,
  getCampusThreatLevel,
  patchCampusThreatLevel,
  getCampusOnDuty,
  postCampusNotification,
  postCampusBroadcast,
} from "./campus-dashboard-service.js";
import {
  campusGetHandler,
  campusSupervisorPatchHandler,
  campusSupervisorPostHandler,
} from "./handler-factory.js";

export const getStats = campusGetHandler("campus.dashboard.view", getCampusStats);
export const getZones = campusGetHandler("campus.dashboard.view", getCampusZonesSummary);
export const getBuildings = campusGetHandler("campus.buildings.view", getCampusBuildingsSummary);
export const getThreatLevel = campusGetHandler("campus.dashboard.view", getCampusThreatLevel);
export const patchThreatLevel = campusSupervisorPatchHandler((agencyId, actorId, body) =>
  patchCampusThreatLevel({ agencyId, actorId, body }),
);
export const getOnDuty = campusGetHandler("campus.dashboard.view", getCampusOnDuty);
export const postNotification = campusSupervisorPostHandler(
  (agencyId, actorId, body) => postCampusNotification({ agencyId, actorId, body }),
  "notification",
);
export const postBroadcast = campusSupervisorPostHandler(
  (agencyId, actorId, body) => postCampusBroadcast({ agencyId, actorId, body }),
  "broadcast",
);
