import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Play, Upload, ChevronDown, ChevronRight } from "lucide-react";

interface EvaluationResult {
  calculatedAmount: number;
  ruleName: string;
  confidence: number;
  specificity: number;
  conditionMatched: string;
  calculationSteps: string[];
  alternativesConsidered: Array<{
    ruleName: string;
    skipReason: string;
  }>;
}

interface CsvRowResult {
  product: string;
  territory: string;
  quantity: number;
  amount: number;
  calculatedFee: number;
  ruleApplied: string;
}

export default function RulePlayground() {
  const [contractId, setContractId] = useState("");
  const [productName, setProductName] = useState("");
  const [territory, setTerritory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [channel, setChannel] = useState("");
  const [customerSegment, setCustomerSegment] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [csvResults, setCsvResults] = useState<CsvRowResult[]>([]);
  const [alternativesOpen, setAlternativesOpen] = useState(false);
  const [csvProcessing, setCsvProcessing] = useState(false);

  const { data: contractsData, isLoading: contractsLoading } = useQuery<any>({
    queryKey: ["/api/contracts"],
  });
  const contracts = Array.isArray(contractsData) ? contractsData : contractsData?.contracts || [];

  const evaluateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/evaluate", payload);
      return res.json();
    },
    onSuccess: (data: EvaluationResult) => {
      setResult(data);
    },
  });

  const handleEvaluate = () => {
    evaluateMutation.mutate({
      contractId,
      productName,
      territory,
      quantity: Number(quantity),
      grossAmount: Number(grossAmount),
      netAmount: Number(netAmount),
      channel: channel || undefined,
      customerSegment: customerSegment || undefined,
      transactionDate,
    });
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvProcessing(true);
    setCsvResults([]);

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });

    const results: CsvRowResult[] = [];

    for (const row of rows) {
      try {
        const payload = {
          contractId,
          productName: row["product"] || row["productname"] || row["product_name"] || "",
          territory: row["territory"] || "",
          quantity: Number(row["quantity"] || row["qty"] || 0),
          grossAmount: Number(row["grossamount"] || row["gross_amount"] || row["gross"] || 0),
          netAmount: Number(row["netamount"] || row["net_amount"] || row["net"] || row["amount"] || 0),
          channel: row["channel"] || undefined,
          customerSegment: row["customersegment"] || row["customer_segment"] || undefined,
          transactionDate: row["transactiondate"] || row["transaction_date"] || row["date"] || "",
        };

        const res = await apiRequest("POST", "/api/evaluate", payload);
        const data = await res.json();

        results.push({
          product: payload.productName,
          territory: payload.territory,
          quantity: payload.quantity,
          amount: payload.netAmount,
          calculatedFee: data.calculatedAmount ?? 0,
          ruleApplied: data.ruleName ?? "N/A",
        });
      } catch {
        results.push({
          product: row["product"] || row["productname"] || row["product_name"] || "",
          territory: row["territory"] || "",
          quantity: Number(row["quantity"] || row["qty"] || 0),
          amount: Number(row["netamount"] || row["net_amount"] || row["net"] || row["amount"] || 0),
          calculatedFee: 0,
          ruleApplied: "Error",
        });
      }
    }

    setCsvResults(results);
    setCsvProcessing(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div data-testid="header-section">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Rule Testing Playground</h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-description">
          Test rules against sample transaction data and see detailed evaluation results.
        </p>
      </div>

      <Card data-testid="card-evaluation-form">
        <CardHeader>
          <CardTitle>Transaction Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract-select">Contract</Label>
              <Select value={contractId} onValueChange={setContractId} data-testid="select-contract">
                <SelectTrigger id="contract-select" data-testid="select-trigger-contract">
                  <SelectValue placeholder={contractsLoading ? "Loading..." : "Select a contract"} />
                </SelectTrigger>
                <SelectContent data-testid="select-content-contract">
                  {contracts?.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)} data-testid={`select-item-contract-${c.id}`}>
                      {c.displayName || c.display_name || c.name || `Contract ${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-product">Product Name</Label>
              <Input
                id="input-product"
                data-testid="input-product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-territory">Territory</Label>
              <Input
                id="input-territory"
                data-testid="input-territory"
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="Enter territory"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-quantity">Quantity</Label>
              <Input
                id="input-quantity"
                data-testid="input-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-gross">Gross Amount</Label>
              <Input
                id="input-gross"
                data-testid="input-gross-amount"
                type="number"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-net">Net Amount</Label>
              <Input
                id="input-net"
                data-testid="input-net-amount"
                type="number"
                value={netAmount}
                onChange={(e) => setNetAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-channel">Channel (optional)</Label>
              <Input
                id="input-channel"
                data-testid="input-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Enter channel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-segment">Customer Segment (optional)</Label>
              <Input
                id="input-segment"
                data-testid="input-customer-segment"
                value={customerSegment}
                onChange={(e) => setCustomerSegment(e.target.value)}
                placeholder="Enter customer segment"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-date">Transaction Date</Label>
              <Input
                id="input-date"
                data-testid="input-transaction-date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            data-testid="button-evaluate"
            onClick={handleEvaluate}
            disabled={evaluateMutation.isPending || !contractId}
            className="mt-4"
          >
            {evaluateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Evaluate
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="card-evaluation-results">
          <CardHeader>
            <CardTitle>Evaluation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Calculated Amount</p>
              <p className="text-4xl font-bold" data-testid="text-calculated-amount">
                ${result.calculatedAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-center">
              <Badge variant="secondary" data-testid="badge-rule-applied">
                Rule: {result.ruleName}
              </Badge>
              <Badge variant="outline" data-testid="badge-confidence">
                Confidence: {(result.confidence * 100).toFixed(0)}%
              </Badge>
              <Badge variant="outline" data-testid="badge-specificity">
                Specificity: {result.specificity}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Condition Matched</p>
              <p className="text-sm text-muted-foreground" data-testid="text-condition-matched">
                {result.conditionMatched}
              </p>
            </div>

            {result.calculationSteps && result.calculationSteps.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Calculation Steps</p>
                <ol className="list-decimal list-inside space-y-1" data-testid="list-calculation-steps">
                  {result.calculationSteps.map((step, i) => (
                    <li key={i} className="text-sm text-muted-foreground" data-testid={`text-step-${i}`}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.alternativesConsidered && result.alternativesConsidered.length > 0 && (
              <div>
                <button
                  data-testid="button-toggle-alternatives"
                  className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                  onClick={() => setAlternativesOpen(!alternativesOpen)}
                >
                  {alternativesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Alternatives Considered ({result.alternativesConsidered.length})
                </button>
                {alternativesOpen && (
                  <div className="mt-2 space-y-2" data-testid="section-alternatives">
                    {result.alternativesConsidered.map((alt, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded bg-muted/50"
                        data-testid={`card-alternative-${i}`}
                      >
                        <Badge variant="outline" className="shrink-0" data-testid={`badge-alt-rule-${i}`}>
                          {alt.ruleName}
                        </Badge>
                        <span className="text-sm text-muted-foreground" data-testid={`text-skip-reason-${i}`}>
                          {alt.skipReason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-csv-batch">
        <CardHeader>
          <CardTitle>CSV Batch Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4" />
                <span>Upload CSV</span>
              </div>
            </Label>
            <Input
              id="csv-upload"
              data-testid="input-csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvUpload}
              disabled={!contractId || csvProcessing}
            />
            {csvProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>

          {csvResults.length > 0 && (
            <Table data-testid="table-csv-results">
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Calculated Fee</TableHead>
                  <TableHead>Rule Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvResults.map((row, i) => (
                  <TableRow key={i} data-testid={`row-csv-result-${i}`}>
                    <TableCell data-testid={`text-csv-product-${i}`}>{row.product}</TableCell>
                    <TableCell data-testid={`text-csv-territory-${i}`}>{row.territory}</TableCell>
                    <TableCell data-testid={`text-csv-qty-${i}`}>{row.quantity}</TableCell>
                    <TableCell data-testid={`text-csv-amount-${i}`}>
                      ${row.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell data-testid={`text-csv-fee-${i}`}>
                      ${row.calculatedFee?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell data-testid={`text-csv-rule-${i}`}>{row.ruleApplied}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
