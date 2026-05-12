import {
  SiSap, SiOracle, SiSalesforce, SiQuickbooks,
} from "react-icons/si";
import { Database, Cloud } from "lucide-react";

interface ErpLogosProps {
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

const erpList = [
  { name: "SAP", icon: SiSap, color: "text-orange-700" },
  { name: "Oracle", icon: SiOracle, color: "text-red-600" },
  { name: "NetSuite", icon: Database, color: "text-gray-700 dark:text-gray-300" },
  { name: "Salesforce", icon: SiSalesforce, color: "text-orange-600" },
  { name: "QuickBooks", icon: SiQuickbooks, color: "text-green-600" },
  { name: "Snowflake", icon: Cloud, color: "text-cyan-500" },
];

export function ErpLogos({ size = "md", showLabels = true }: ErpLogosProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {erpList.map((erp) => (
        <div
          key={erp.name}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all duration-300 group-hover:scale-110">
            <erp.icon className={`${sizeClasses[size]} ${erp.color} transition-transform duration-300`} />
          </div>
          {showLabels && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{erp.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}
