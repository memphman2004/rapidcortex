"use client";

import { useEffect, useRef } from "react";
import type { HospitalCapacity, HospitalProfile, HospitalRecommendationLevel } from "rapid-cortex-shared";
import mapboxgl from "mapbox-gl";

import {
  formatTraumaLevel,
  parseAddressCityState,
  RECOMMENDATION_COLORS,
  RECOMMENDATION_ICONS,
  recommendationLabel,
} from "./hospital-utils";

export interface HospitalMarkerProps {
  map: mapboxgl.Map;
  hospital: HospitalProfile;
  capacity: HospitalCapacity;
  recommendation: HospitalRecommendationLevel;
  isSelected?: boolean;
  onClick?: () => void;
}

export function HospitalMarker({
  map,
  hospital,
  capacity,
  recommendation,
  isSelected = false,
  onClick,
}: HospitalMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const color = RECOMMENDATION_COLORS[recommendation];
    const { city, state } = parseAddressCityState(hospital.address);
    const trauma = formatTraumaLevel(hospital.traumaLevel);

    const el = document.createElement("div");
    el.className = "hospital-marker";
    el.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: ${color};
      border: ${isSelected ? "4px" : "3px"} solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: system-ui, sans-serif;
      transition: transform 0.2s, border-width 0.2s;
      transform: ${isSelected ? "scale(1.2)" : "scale(1)"};
    `;
    el.innerHTML = `<div style="font-size: 24px; line-height: 1;">🏥</div>`;

    const handleClick = () => onClick?.();
    el.addEventListener("click", handleClick);
    el.addEventListener("mouseenter", () => {
      el.style.transform = isSelected ? "scale(1.2)" : "scale(1.1)";
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = isSelected ? "scale(1.2)" : "scale(1)";
    });

    const capabilityTags = [
      trauma ? `<span style="background:#DBEAFE;color:#1E40AF;padding:2px 6px;border-radius:4px;">Trauma ${trauma}</span>` : "",
      hospital.strokeCenter
        ? `<span style="background:#FCE7F3;color:#BE185D;padding:2px 6px;border-radius:4px;">Stroke</span>`
        : "",
      hospital.cardiacCenter
        ? `<span style="background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:4px;">STEMI</span>`
        : "",
      hospital.pediatricCapable
        ? `<span style="background:#D1FAE5;color:#065F46;padding:2px 6px;border-radius:4px;">Pediatric</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const popupContent = `
      <div style="font-family:system-ui;padding:12px;min-width:280px;">
        <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">🏥 ${hospital.name}</div>
        <div style="font-size:13px;color:#666;margin-bottom:8px;">
          ${hospital.address}${city && state ? `<br/>${city}, ${state}` : ""}
        </div>
        <div style="border-top:1px solid #e5e7eb;padding-top:8px;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Capacity</div>
          <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div>ER: <strong>${capacity.availability.erBeds.available}/${capacity.availability.erBeds.total}</strong></div>
            <div>ICU: <strong>${capacity.availability.icuBeds.available}/${capacity.availability.icuBeds.total}</strong></div>
          </div>
          ${
            capacity.waitTimes.erWaitMinutes > 0
              ? `<div style="font-size:12px;margin-top:4px;">Wait: <strong>~${capacity.waitTimes.erWaitMinutes} min</strong></div>`
              : ""
          }
        </div>
        ${
          capacity.diversion.isOnDiversion
            ? `<div style="background:#FEE2E2;border:1px solid #DC2626;border-radius:6px;padding:6px;margin-bottom:8px;">
                <div style="color:#DC2626;font-size:12px;font-weight:600;">
                  ⚠️ ON DIVERSION${capacity.diversion.diversionType ? `: ${capacity.diversion.diversionType}` : ""}
                </div>
                ${
                  capacity.diversion.diversionReason
                    ? `<div style="color:#991B1B;font-size:11px;margin-top:2px;">${capacity.diversion.diversionReason}</div>`
                    : ""
                }
              </div>`
            : ""
        }
        ${
          capabilityTags
            ? `<div style="border-top:1px solid #e5e7eb;padding-top:8px;">
                <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Capabilities</div>
                <div style="font-size:11px;display:flex;flex-wrap:wrap;gap:4px;">${capabilityTags}</div>
              </div>`
            : ""
        }
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:11px;color:#666;">Recommendation</div>
            <div style="font-size:14px;font-weight:600;color:${color};text-transform:capitalize;">
              ${RECOMMENDATION_ICONS[recommendation]} ${recommendationLabel(recommendation)}
            </div>
          </div>
          <div style="font-size:11px;color:#666;">
            ${new Date(capacity.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 30, maxWidth: "320px" }).setHTML(popupContent);
    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([hospital.coordinates.longitude, hospital.coordinates.latitude])
      .setPopup(popup)
      .addTo(map);

    markerRef.current = marker;
    if (isSelected) popup.addTo(map);

    return () => {
      el.removeEventListener("click", handleClick);
      marker.remove();
      markerRef.current = null;
    };
  }, [map, hospital, capacity, recommendation, isSelected, onClick]);

  return null;
}
