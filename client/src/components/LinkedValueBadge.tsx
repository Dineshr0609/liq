import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Link2, AlertCircle } from "lucide-react";

interface LinkedValueBadgeProps {
  value: string;
  entityType: 'item' | 'vendor' | 'location' | 'category';
  linkedRecordId?: string | null;
  linkedRecordCode?: string | null;
  isLinked?: boolean;
  linkStatus?: 'linked' | 'pending' | 'unlinked';
  variant?: 'default' | 'compact' | 'inline';
  showValue?: boolean;
}

const ENTITY_CONFIG = {
  item: {
    label: 'Item',
    entity: 'Items',
    color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-700',
    unlinkedColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  },
  vendor: {
    label: 'Partner',
    entity: 'Partner Master',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700',
    unlinkedColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  },
  location: {
    label: 'Location',
    entity: 'Locations',
    color: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    unlinkedColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  },
  category: {
    label: 'Category',
    entity: 'Items',
    color: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    unlinkedColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  },
};

export function LinkedValueBadge({
  value,
  entityType,
  linkedRecordId,
  linkedRecordCode,
  isLinked = false,
  linkStatus = 'pending',
  variant = 'default',
  showValue = true,
}: LinkedValueBadgeProps) {
  const config = ENTITY_CONFIG[entityType];
  const hasLink = isLinked || linkedRecordId;
  const effectiveStatus = hasLink ? 'linked' : linkStatus;
  
  if (variant === 'compact') {
    // For pending status, just show the value without any badge - cleaner UX
    if (effectiveStatus === 'pending') {
      return <span>{value}</span>;
    }
    
    // For linked status, show value with green checkmark
    if (effectiveStatus === 'linked') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1">
                {showValue && <span>{value}</span>}
                <Badge variant="outline" className={`text-xs px-1 py-0 ${config.color}`}>
                  <Check className="h-3 w-3" />
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                <span>Linked to {config.entity}: {linkedRecordCode || linkedRecordId || value}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    // For unlinked status, show warning
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1">
              {showValue && <span>{value}</span>}
              <Badge variant="outline" className={`text-xs px-1 py-0 ${config.unlinkedColor}`}>
                <AlertCircle className="h-3 w-3" />
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span>Not linked to {config.entity} master data</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1">
        {showValue && <span>{value}</span>}
        {hasLink && (
          <span className="text-xs text-green-600 dark:text-green-400">
            [Linked: {linkedRecordCode || config.entity}]
          </span>
        )}
      </span>
    );
  }
  
  // Default variant
  return (
    <div className="flex items-center gap-2">
      {showValue && <span>{value}</span>}
      {hasLink ? (
        <Badge variant="outline" className={`text-xs ${config.color}`}>
          <Check className="h-3 w-3 mr-1" />
          Linked: {linkedRecordCode || linkedRecordId || config.entity}
        </Badge>
      ) : (
        <Badge variant="outline" className={`text-xs ${config.unlinkedColor}`}>
          <Link2 className="h-3 w-3 mr-1" />
          Not linked
        </Badge>
      )}
    </div>
  );
}

// Helper function to check if a value might be linked (simple heuristic)
export function checkValueLinkStatus(value: string, entityType: 'item' | 'vendor' | 'location' | 'category'): {
  isLinked: boolean;
  confidence: 'high' | 'medium' | 'low';
} {
  // This is a placeholder - in production, you would check against actual master data
  // For now, assume plant variety names that look like proper names are linked
  const hasProperFormat = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(value.trim());
  
  return {
    isLinked: hasProperFormat,
    confidence: hasProperFormat ? 'high' : 'low',
  };
}
