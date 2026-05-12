import { useState } from "react";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import Sidebar from "./sidebar";
import Header from "./header";
import { LiqAIPanel } from "@/components/liq-ai-panel";
import licenseIQLogoLight from "@assets/licenseiq-logo-transparent_1772668276822.png";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function MainLayout({ children, title, description, actions }: MainLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <div className={cn(
        "flex-1 flex transition-all duration-300 overflow-hidden",
        isCollapsed ? "md:ml-16" : "md:ml-64"
      )}>
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header 
            title={title} 
            description={description}
            onMenuClick={() => setIsSidebarOpen(true)}
            actions={actions}
          />
          <div className="p-4 md:p-6 flex-1 overflow-y-auto" data-testid="main-content">
            {children}
          </div>
          <footer className="border-t bg-background/50 px-4 md:px-6 py-3 flex-shrink-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <img src={licenseIQLogoLight} alt="LicenseIQ Logo" className="h-12" />
                <span className="hidden md:inline">•</span>
                <p>&copy; 2025 LicenseIQ. All rights reserved.</p>
              </div>
              <p>Agentic AI for Financial Contracts</p>
            </div>
          </footer>
        </main>
        <LiqAIPanel />
      </div>
    </div>
  );
}
