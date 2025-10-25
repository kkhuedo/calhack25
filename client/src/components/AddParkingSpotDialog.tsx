import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { insertParkingSlotSchema, type InsertParkingSlot } from "@shared/schema";
import { Card } from "@/components/ui/card";

interface AddParkingSpotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertParkingSlot) => void;
  isPending?: boolean;
}

export function AddParkingSpotDialog({ open, onOpenChange, onSubmit, isPending }: AddParkingSpotDialogProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const form = useForm<InsertParkingSlot>({
    resolver: zodResolver(insertParkingSlotSchema),
    defaultValues: {
      latitude: 0,
      longitude: 0,
      address: "",
      notes: "",
      status: "available",
    },
  });

  useEffect(() => {
    if (open && !location && !isLoadingLocation) {
      detectLocation();
    }
  }, [open]);

  const detectLocation = () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          setLocation({ lat, lng, address });
          form.setValue("latitude", lat);
          form.setValue("longitude", lng);
          form.setValue("address", address);
        } catch (error) {
          const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setLocation({ lat, lng, address: fallbackAddress });
          form.setValue("latitude", lat);
          form.setValue("longitude", lng);
          form.setValue("address", fallbackAddress);
        }

        setIsLoadingLocation(false);
      },
      (error) => {
        setLocationError(error.message || "Unable to retrieve your location");
        setIsLoadingLocation(false);
      },
      {
        timeout: 10000,
        maximumAge: 0,
        enableHighAccuracy: false,
      }
    );
  };

  const handleSubmit = (data: InsertParkingSlot) => {
    onSubmit(data);
    form.reset();
    setLocation(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
    setLocation(null);
    setLocationError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-spot">
        <DialogHeader>
          <DialogTitle>Share Your Parking Spot</DialogTitle>
          <DialogDescription>
            Help others find parking by sharing your spot when you leave
          </DialogDescription>
        </DialogHeader>

        {isLoadingLocation && (
          <Card className="p-6">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Detecting your location...</p>
            </div>
          </Card>
        )}

        {locationError && (
          <Card className="p-4 bg-destructive/10 border-destructive/20">
            <p className="text-sm text-destructive">{locationError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={detectLocation}
              data-testid="button-retry-location"
            >
              Try Again
            </Button>
          </Card>
        )}

        {location && !isLoadingLocation && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <Card className="p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 text-primary rounded-full flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Detected Location</p>
                    <p className="text-sm font-medium line-clamp-2" data-testid="text-detected-address">
                      {location.address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </Card>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Next to the blue building, near entrance 2..."
                        className="resize-none"
                        rows={3}
                        data-testid="input-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isPending}
                  data-testid="button-submit-spot"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    "Share Spot"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
