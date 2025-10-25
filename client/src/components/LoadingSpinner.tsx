import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-6">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground" data-testid="text-loading">
        {message}
      </p>
    </div>
  );
}
