import { MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ParkingSlot } from "@shared/schema";

interface ParkingSlotCardProps {
  slot: ParkingSlot;
  distance?: number;
  onNavigate?: (slot: ParkingSlot) => void;
  onMarkTaken?: (slot: ParkingSlot) => void;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ParkingSlotCard({ slot, distance, onNavigate, onMarkTaken }: ParkingSlotCardProps) {
  const isAvailable = slot.status === "available";

  return (
    <Card 
      className={`p-4 hover-elevate ${!isAvailable ? "opacity-60" : ""}`}
      data-testid={`card-slot-${slot.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex items-center justify-center w-10 h-10 ${
            isAvailable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          } rounded-full flex-shrink-0`}>
            <MapPin className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm" data-testid={`text-address-${slot.id}`}>
                {slot.address}
              </h3>
              {isAvailable && (
                <Badge variant="default" className="text-xs" data-testid={`badge-available-${slot.id}`}>
                  Available
                </Badge>
              )}
            </div>
            {slot.notes && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {slot.notes}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getTimeAgo(slot.postedAt)}
              </span>
              {distance !== undefined && (
                <span data-testid={`text-distance-${slot.id}`}>
                  {distance < 1 
                    ? `${Math.round(distance * 1000)}m away`
                    : `${distance.toFixed(1)}km away`
                  }
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {isAvailable && onNavigate && (
            <Button 
              size="sm" 
              variant="default"
              onClick={() => onNavigate(slot)}
              data-testid={`button-navigate-${slot.id}`}
            >
              Navigate
            </Button>
          )}
          {isAvailable && onMarkTaken && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onMarkTaken(slot)}
              data-testid={`button-mark-taken-${slot.id}`}
            >
              Mark Taken
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
