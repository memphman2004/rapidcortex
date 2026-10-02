import {
  getVenueStats,
  getVenueSectionsSummary,
  getVenueEvents,
  getVenueOnDuty,
  postVenueNotification,
} from "./venue-dashboard-service.js";
import { venueGetHandler, venueSupervisorPostHandler } from "./handler-factory.js";

export const getStats = venueGetHandler("venue.dashboard.view", getVenueStats);
export const getSections = venueGetHandler("venue.sections.view", getVenueSectionsSummary);
export const getEvents = venueGetHandler("venue.dashboard.view", getVenueEvents);
export const getOnDuty = venueGetHandler("venue.dashboard.view", getVenueOnDuty);
export const postNotification = venueSupervisorPostHandler(
  (agencyId, actorId, body) => postVenueNotification({ agencyId, actorId, body }),
  "notification",
);
