import MainLayout from "@/components/layout/main-layout";
import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ComingSoonPageProps {
  title: string;
  description?: string;
  groupName?: string;
}

export default function ComingSoonPage({ title, description, groupName }: ComingSoonPageProps) {
  const [, navigate] = useLocation();

  return (
    <MainLayout title={title} description={description || `${title} — coming soon`}>
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="coming-soon-container">
        <div className="text-center max-w-md space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Construction className="w-10 h-10 text-orange-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-coming-soon-title">{title}</h2>
            {groupName && (
              <p className="text-sm text-muted-foreground font-medium" data-testid="text-coming-soon-group">{groupName}</p>
            )}
            <p className="text-muted-foreground" data-testid="text-coming-soon-description">
              This feature is currently under development and will be available soon.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/financial-control-center")}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
