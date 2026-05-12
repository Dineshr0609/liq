import { useState } from "react";
import { PublicNavigation } from "@/components/public-navigation";
import { PublicFooter } from "@/components/public-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, CheckCircle2, Clock, Users, BarChart3, Shield } from "lucide-react";

export default function ScheduleDemo() {
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
        email, name, company, position, phone, message,
        planTier: 'schedule_demo',
      });
      setSubmitted(true);
      (e.target as HTMLFormElement).reset();
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

  const benefits = [
    { icon: Clock, title: "30-Minute Walkthrough", desc: "See the entire platform in action with a personalized demo" },
    { icon: Users, title: "Tailored to Your Needs", desc: "We focus on the features that matter most to your team" },
    { icon: BarChart3, title: "Live Data Examples", desc: "See real contract analysis with sample data from your industry" },
    { icon: Shield, title: "No Commitment Required", desc: "Learn at your own pace with zero pressure" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <PublicNavigation />

      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Calendar className="h-4 w-4" />
                Schedule a Demo
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                See LicenseIQ in Action
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
                Get a personalized walkthrough of LicenseIQ's AI-native contract intelligence platform. 
                See how we can transform your contract management workflow.
              </p>

              <div className="grid sm:grid-cols-2 gap-6">
                {benefits.map((b, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                      <b.icon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{b.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Demo Request Received!</h3>
                  <p className="text-slate-600 dark:text-slate-400">Thank you for your interest. Our team will reach out within 24 hours to schedule your personalized demo.</p>
                  <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-6">
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Request Your Demo</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Fill out the form below and we'll be in touch within 24 hours.</p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="name" placeholder="Full Name *" className="h-11 bg-white dark:bg-slate-800" data-testid="input-demo-name" />
                      <Input name="email" type="email" placeholder="Work Email *" className="h-11 bg-white dark:bg-slate-800" data-testid="input-demo-email" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="company" placeholder="Company Name *" className="h-11 bg-white dark:bg-slate-800" data-testid="input-demo-company" />
                      <Input name="position" placeholder="Your Role" className="h-11 bg-white dark:bg-slate-800" data-testid="input-demo-position" />
                    </div>
                    <Input name="phone" placeholder="Phone Number" className="h-11 bg-white dark:bg-slate-800" data-testid="input-demo-phone" />
                    <Textarea name="message" placeholder="Tell us about your contract management needs (optional)" rows={4} className="bg-white dark:bg-slate-800 resize-none" data-testid="input-demo-message" />
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-medium text-base" data-testid="button-submit-demo">
                      {isSubmitting ? "Submitting..." : "Request Demo"}
                    </Button>
                    <p className="text-xs text-center text-slate-400">No commitment required. We'll reach out within 24 hours.</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
