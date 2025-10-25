import { useEffect, useRef, useState } from "react";
import type { ParkingSlot } from "@shared/schema";
import L from "leaflet";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ParkingMapProps {
  slots: ParkingSlot[];
  userLocation: { lat: number; lng: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onSlotClick?: (slot: ParkingSlot) => void;
  centerOnUser?: boolean;
}

export function ParkingMap({ slots, userLocation, onMapClick, onSlotClick, centerOnUser }: ParkingMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([37.7749, -122.4194], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    if (onMapClick) {
      map.on("click", (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapClick]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: `<div class="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
      }).addTo(mapRef.current);
    }

    if (centerOnUser) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, centerOnUser]);

  useEffect(() => {
    if (!mapRef.current) return;

    const currentMarkers = new Set(markersRef.current.keys());

    slots.forEach((slot) => {
      currentMarkers.delete(slot.id);

      if (markersRef.current.has(slot.id)) {
        const marker = markersRef.current.get(slot.id)!;
        marker.setLatLng([slot.latitude, slot.longitude]);
      } else {
        const isAvailable = slot.status === "available";
        const markerIcon = L.divIcon({
          className: "custom-parking-marker",
          html: `
            <div class="flex items-center justify-center w-10 h-10 ${
              isAvailable ? "bg-primary" : "bg-muted"
            } rounded-full border-2 border-white shadow-lg ${
              isAvailable ? "animate-pulse" : "opacity-50"
            }">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        const marker = L.marker([slot.latitude, slot.longitude], {
          icon: markerIcon,
        }).addTo(mapRef.current);

        marker.on("click", () => {
          setSelectedSlot(slot);
          if (onSlotClick) {
            onSlotClick(slot);
          }
        });

        markersRef.current.set(slot.id, marker);
      }
    });

    currentMarkers.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [slots, onSlotClick]);

  const handleCenterOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  };

  const handleCloseInfo = () => {
    setSelectedSlot(null);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" data-testid="map-container" />
      
      {userLocation && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-20 right-4 shadow-lg z-[1000]"
          onClick={handleCenterOnUser}
          data-testid="button-center-location"
        >
          <Navigation className="w-5 h-5" />
        </Button>
      )}

      {selectedSlot && (
        <Card className="absolute bottom-4 left-4 right-4 md:left-auto md:max-w-sm p-4 z-[1000] shadow-xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-start gap-2 flex-1">
              <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" data-testid="text-slot-address">
                  {selectedSlot.address}
                </p>
                {selectedSlot.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedSlot.notes}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 flex-shrink-0"
              onClick={handleCloseInfo}
              data-testid="button-close-info"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <span data-testid="text-slot-time">
              {new Date(selectedSlot.postedAt).toLocaleTimeString([], { 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </span>
            <span className={selectedSlot.status === "available" ? "text-primary font-medium" : ""}>
              {selectedSlot.status === "available" ? "Available" : "Taken"}
            </span>
          </div>
          {selectedSlot.status === "available" && (
            <Button className="w-full" size="sm" data-testid="button-navigate">
              Navigate Here
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
