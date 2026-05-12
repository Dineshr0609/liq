import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, CheckCircle2 } from "lucide-react";

interface ScheduleDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleDemoModal({ open, onOpenChange }: ScheduleDemoModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const company = formData.get('company') as string;
    const position = formData.get('position') as string;
    const phone = formData.get('phone') as string;
    const message = formData.get('message') as string;

    if (!name?.trim()) {
      toast({ title: "Name Required", description: "Please enter your name.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    if (!email || !email.includes('@')) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    if (!company?.trim()) {
      toast({ title: "Company Required", description: "Company name is required.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    try {
      await apiRequest('POST', '/api/demo-request', {
        email,
        name,
        company,
        position,
        phone,
        message,
        planTier: 'schedule_demo',
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onOpenChange(false);
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) setSubmitted(false);
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Demo Request Received!</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Thank you for your interest. Our team will reach out within 24 hours to schedule your personalized demo.</p>
          </div>
        ) : (
          <>
            <div className="bg-black px-6 py-5">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-white text-lg">Schedule a Demo</DialogTitle>
                    <DialogDescription className="text-slate-400 text-sm mt-0.5">
                      See LicenseIQ in action with a personalized walkthrough
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    name="name"
                    placeholder="Full Name *"
                    className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    data-testid="input-demo-name"
                  />
                </div>
                <div>
                  <Input
                    name="email"
                    type="email"
                    placeholder="Work Email *"
                    className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    data-testid="input-demo-email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    name="company"
                    placeholder="Company Name *"
                    className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    data-testid="input-demo-company"
                  />
                </div>
                <div>
                  <Input
                    name="position"
                    placeholder="Your Role"
                    className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    data-testid="input-demo-position"
                  />
                </div>
              </div>
              <Input
                name="phone"
                placeholder="Phone Number"
                className="h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                data-testid="input-demo-phone"
              />
              <Textarea
                name="message"
                placeholder="Tell us about your contract management needs (optional)"
                rows={3}
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 resize-none"
                data-testid="input-demo-message"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                data-testid="button-submit-demo"
              >
                {isSubmitting ? "Submitting..." : "Request Demo"}
              </Button>
              <p className="text-[11px] text-center text-slate-400">No commitment required. We'll reach out within 24 hours.</p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
