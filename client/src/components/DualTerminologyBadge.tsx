import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Database, FileText } from 'lucide-react';

interface DualTerminologyBadgeProps {
  licenseiqField: string;
  licenseiqEntity?: string;
  erpField?: string | null;
  erpEntity?: string | null;
  contractValue?: string | null;
  linkedValue?: string | null;
  variant?: 'default' | 'compact' | 'inline' | 'erp-first';
  showIcon?: boolean;
}

export function DualTerminologyBadge({
  licenseiqField,
  licenseiqEntity,
  erpField,
  erpEntity,
  contractValue,
  linkedValue,
  variant = 'default',
  showIcon = true,
}: DualTerminologyBadgeProps) {
  const hasErpMapping = erpField && erpEntity;
  
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {hasErpMapping ? (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                  {erpEntity}.{erpField}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                  {licenseiqEntity ? `${licenseiqEntity}.${licenseiqField}` : licenseiqField}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm space-y-1">
              {hasErpMapping && (
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-orange-500" />
                  <span className="text-orange-600">ERP: {erpEntity}.{erpField}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-orange-600" />
                <span className="text-orange-700">LicenseIQ: {licenseiqEntity ? `${licenseiqEntity}.${licenseiqField}` : licenseiqField}</span>
              </div>
              {contractValue && (
                <div className="text-muted-foreground">
                  Contract: "{contractValue}"
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        {hasErpMapping ? (
          <>
            <span className="font-medium text-orange-700">{erpField}</span>
            <span className="text-muted-foreground text-xs">(LicenseIQ: {licenseiqField})</span>
          </>
        ) : (
          <span className="font-medium">{licenseiqField}</span>
        )}
      </span>
    );
  }

  if (variant === 'erp-first') {
    return (
      <div className="space-y-1">
        {hasErpMapping ? (
          <>
            <div className="flex items-center gap-1">
              {showIcon && <Database className="h-3 w-3 text-orange-500" />}
              <span className="font-medium text-orange-700">{erpEntity}.{erpField}</span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              LicenseIQ: {licenseiqEntity}.{licenseiqField}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1">
            {showIcon && <FileText className="h-3 w-3 text-orange-600" />}
            <span className="font-medium">{licenseiqEntity ? `${licenseiqEntity}.${licenseiqField}` : licenseiqField}</span>
          </div>
        )}
        {contractValue && (
          <div className="text-xs text-orange-700">
            Contract: "{contractValue}"
          </div>
        )}
        {linkedValue && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            Linked: {linkedValue}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-medium text-primary">{licenseiqField}</span>
        {licenseiqEntity && (
          <Badge variant="secondary" className="text-xs">{licenseiqEntity}</Badge>
        )}
      </div>
      {hasErpMapping && (
        <div className="flex items-center gap-1 text-xs text-orange-600">
          <ArrowRight className="h-3 w-3" />
          ERP: {erpEntity}.{erpField}
        </div>
      )}
      {contractValue && (
        <div className="text-xs text-orange-700">
          Contract: "{contractValue}"
        </div>
      )}
      {linkedValue && (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
          Linked: {linkedValue}
        </div>
      )}
    </div>
  );
}

export function ErpFieldLabel({ 
  fieldName, 
  erpMapping 
}: { 
  fieldName: string; 
  erpMapping?: { erpFieldName?: string; erpEntityName?: string } | null;
}) {
  if (!erpMapping?.erpFieldName) {
    return <span>{fieldName}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            <span className="text-orange-700 font-medium">{erpMapping.erpFieldName}</span>
            <span className="text-xs text-muted-foreground">({fieldName})</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="text-orange-600">ERP: {erpMapping.erpEntityName}.{erpMapping.erpFieldName}</div>
            <div className="text-muted-foreground">LicenseIQ: {fieldName}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
