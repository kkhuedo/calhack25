import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
}

export function ConfirmationDialog({ open, onOpenChange, title, message }: ConfirmationDialogProps) {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-confirmation">
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2" data-testid="text-confirmation-title">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-confirmation-message">
            {message}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
