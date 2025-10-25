import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Map, List, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParkingMap } from "@/components/ParkingMap";
import { ParkingSlotCard } from "@/components/ParkingSlotCard";
import { AddParkingSpotDialog } from "@/components/AddParkingSpotDialog";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ParkingSlot, InsertParkingSlot } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState({ title: "", message: "" });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();
  
  useWebSocket();

  const { data: slots = [], isLoading } = useQuery<ParkingSlot[]>({
    queryKey: ["/api/parking-slots"],
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: InsertParkingSlot) => {
      return await apiRequest("POST", "/api/parking-slots", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking-slots"] });
      setIsAddDialogOpen(false);
      setConfirmationMessage({
        title: "Success!",
        message: "Your parking spot has been shared with the community.",
      });
      setShowConfirmation(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to share parking spot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markTakenMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return await apiRequest("PATCH", `/api/parking-slots/${slotId}`, { status: "taken" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking-slots"] });
      setConfirmationMessage({
        title: "Updated",
        message: "Parking spot marked as taken.",
      });
      setShowConfirmation(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update parking spot.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const availableSlots = slots.filter((slot) => slot.status === "available");
  
  const slotsWithDistance: (ParkingSlot & { distance?: number })[] = userLocation
    ? availableSlots
        .map((slot) => ({
          ...slot,
          distance: calculateDistance(
            userLocation.lat,
            userLocation.lng,
            slot.latitude,
            slot.longitude
          ),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    : availableSlots;

  const handleNavigate = (slot: ParkingSlot) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${slot.latitude},${slot.longitude}`;
    window.open(url, "_blank");
  };

  const handleMarkTaken = (slot: ParkingSlot) => {
    markTakenMutation.mutate(slot.id);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-background z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 bg-primary rounded-md">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-app-title">
              ParkShare
            </h1>
            <p className="text-xs text-muted-foreground">
              {availableSlots.length} {availableSlots.length === 1 ? "spot" : "spots"} available
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "map" ? "default" : "ghost"}
            size="icon"
            onClick={() => setView("map")}
            data-testid="button-view-map"
          >
            <Map className="w-5 h-5" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="icon"
            onClick={() => setView("list")}
            data-testid="button-view-list"
          >
            <List className="w-5 h-5" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {view === "map" ? (
          <div className="w-full h-full">
            {isLoading ? (
              <LoadingSpinner message="Loading parking spots..." />
            ) : (
              <ParkingMap
                slots={slots}
                userLocation={userLocation}
                centerOnUser={!!userLocation}
                onSlotClick={handleNavigate}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto">
            {isLoading ? (
              <LoadingSpinner message="Loading parking spots..." />
            ) : availableSlots.length === 0 ? (
              <EmptyState onAddSpot={() => setIsAddDialogOpen(true)} />
            ) : (
              <div className="p-4 space-y-3 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold" data-testid="text-list-title">
                    Available Nearby
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {availableSlots.length} {availableSlots.length === 1 ? "spot" : "spots"}
                  </span>
                </div>
                {slotsWithDistance.map((slot) => (
                  <ParkingSlotCard
                    key={slot.id}
                    slot={slot}
                    distance={slot.distance}
                    onNavigate={handleNavigate}
                    onMarkTaken={handleMarkTaken}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl z-50"
        onClick={() => setIsAddDialogOpen(true)}
        data-testid="button-add-spot-fab"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <AddParkingSpotDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={(data) => createSlotMutation.mutate(data)}
        isPending={createSlotMutation.isPending}
      />

      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title={confirmationMessage.title}
        message={confirmationMessage.message}
      />
    </div>
  );
}
