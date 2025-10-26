import { useState } from "react";
import { Filter, X, Shield, Zap, DollarSign, Accessibility, MapPin, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface FilterOptions {
  minSafety?: number;
  hasLighting?: boolean;
  hasSecurityCamera?: boolean;
  nearbyEvents?: boolean;
  highDemandArea?: boolean;
  demandLevel?: string;
  priceCategory?: string;
  maxHourlyRate?: number;
  handicapAccessible?: boolean;
  evCharging?: boolean;
  spotType?: string;
  verified?: boolean;
}

interface ParkingFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

export function ParkingFilters({ open, onOpenChange, onApplyFilters, currentFilters }: ParkingFiltersProps) {
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);

  const handleApply = () => {
    onApplyFilters(filters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const emptyFilters: FilterOptions = {};
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== null).length;

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
        className="gap-2"
        data-testid="button-open-filters"
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            <CardDescription>Refine your parking search</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-filters"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Safety Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Safety</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm mb-2 block">
                    Minimum Safety Score: {filters.minSafety || 1}/10
                  </Label>
                  <Slider
                    value={[filters.minSafety || 1]}
                    onValueChange={(value) => setFilters({ ...filters, minSafety: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="lighting" className="text-sm">
                    Well-lit areas only
                  </Label>
                  <Switch
                    id="lighting"
                    checked={filters.hasLighting || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, hasLighting: checked || undefined })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="security" className="text-sm">
                    Security cameras
                  </Label>
                  <Switch
                    id="security"
                    checked={filters.hasSecurityCamera || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, hasSecurityCamera: checked || undefined })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Event & Demand Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Events & Demand</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="events" className="text-sm">
                    <span className="flex items-center gap-1">
                      Near events
                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                    </span>
                  </Label>
                  <Switch
                    id="events"
                    checked={filters.nearbyEvents || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, nearbyEvents: checked || undefined })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="highDemand" className="text-sm">
                    High demand areas
                  </Label>
                  <Switch
                    id="highDemand"
                    checked={filters.highDemandArea || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, highDemandArea: checked || undefined })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="demandLevel" className="text-sm mb-2 block">
                    Demand Level
                  </Label>
                  <Select
                    value={filters.demandLevel || "any"}
                    onValueChange={(value) =>
                      setFilters({ ...filters, demandLevel: value === "any" ? undefined : value })
                    }
                  >
                    <SelectTrigger id="demandLevel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="very_high">Very High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pricing Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Pricing</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="priceCategory" className="text-sm mb-2 block">
                    Price Category
                  </Label>
                  <Select
                    value={filters.priceCategory || "any"}
                    onValueChange={(value) =>
                      setFilters({ ...filters, priceCategory: value === "any" ? undefined : value })
                    }
                  >
                    <SelectTrigger id="priceCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="metered">Metered</SelectItem>
                      <SelectItem value="paid">Paid Lot/Garage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filters.priceCategory !== "free" && (
                  <div>
                    <Label className="text-sm mb-2 block">
                      Max hourly rate: ${filters.maxHourlyRate?.toFixed(2) || "10.00"}
                    </Label>
                    <Slider
                      value={[filters.maxHourlyRate || 10]}
                      onValueChange={(value) => setFilters({ ...filters, maxHourlyRate: value[0] })}
                      min={0}
                      max={10}
                      step={0.5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Accessibility Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Accessibility</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="handicap" className="text-sm">
                    Handicap accessible
                  </Label>
                  <Switch
                    id="handicap"
                    checked={filters.handicapAccessible || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, handicapAccessible: checked || undefined })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="evCharging" className="text-sm flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    EV Charging
                  </Label>
                  <Switch
                    id="evCharging"
                    checked={filters.evCharging || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, evCharging: checked || undefined })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Spot Type Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Spot Type</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="spotType" className="text-sm mb-2 block">
                    Parking Type
                  </Label>
                  <Select
                    value={filters.spotType || "any"}
                    onValueChange={(value) =>
                      setFilters({ ...filters, spotType: value === "any" ? undefined : value })
                    }
                  >
                    <SelectTrigger id="spotType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="street">Street Parking</SelectItem>
                      <SelectItem value="metered">Metered</SelectItem>
                      <SelectItem value="public_lot">Public Lot</SelectItem>
                      <SelectItem value="garage">Garage</SelectItem>
                      <SelectItem value="user_discovered">User Discovered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="verified" className="text-sm">
                    Verified spots only
                  </Label>
                  <Switch
                    id="verified"
                    checked={filters.verified || false}
                    onCheckedChange={(checked) =>
                      setFilters({ ...filters, verified: checked || undefined })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1" data-testid="button-apply-filters">
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
