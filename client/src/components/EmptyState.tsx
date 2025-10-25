import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAddSpot?: () => void;
}

export function EmptyState({ onAddSpot }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6 text-center">
      <div className="flex items-center justify-center w-20 h-20 bg-muted rounded-full mb-4">
        <MapPin className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">
        No Parking Spots Available
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        There are currently no available parking spots in your area. Be the first to share one!
      </p>
      {onAddSpot && (
        <Button onClick={onAddSpot} data-testid="button-empty-add-spot">
          <Plus className="w-4 h-4 mr-2" />
          Share Your Spot
        </Button>
      )}
    </div>
  );
}
