import { useState, useEffect } from "react";
import { useParams } from "wouter";
import licenseIQLogoLight from "@assets/licenseiq-logo-transparent_1772668276822.png";

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadInfo, setLeadInfo] = useState<{ name: string; company: string; email: string } | null>(null);

  const [form, setForm] = useState({
    websiteUrl: "",
    jobTitle: "",
    contractCount: "",
    goals: "",
    referralSource: "",
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/verify/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid verification link");
        }
        return res.json();
      })
      .then((data) => {
        setLeadInfo({ name: data.name, company: data.company, email: data.email });
        if (data.alreadyVerified) setAlreadyVerified(true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/verify/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <img src={licenseIQLogoLight} alt="LicenseIQ" className="h-10 mx-auto mb-6" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.27 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Not Valid</h2>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyVerified || submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <img src={licenseIQLogoLight} alt="LicenseIQ" className="h-10 mx-auto mb-6" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {submitted ? "Verification Complete!" : "Already Verified"}
            </h2>
            <p className="text-gray-500 mb-4">
              {submitted
                ? "Thank you for completing the verification form. Our team will review your details and set up your workspace within 1 business day."
                : "This verification form has already been submitted. Our team is reviewing your details."}
            </p>
            <p className="text-sm text-gray-400">
              Questions? Email us at{" "}
              <a href="mailto:info@licenseiq.ai" className="text-orange-600 hover:underline">info@licenseiq.ai</a>
            </p>
          </div>
          <p className="mt-6 text-xs text-gray-400">&copy; {new Date().getFullYear()} CimpleIT LLC. All rights reserved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <img src={licenseIQLogoLight} alt="LicenseIQ" className="h-10 mx-auto mb-2" />
          <p className="text-sm text-gray-400">AI-Native Contract Intelligence</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-black px-6 py-4">
            <h1 className="text-lg font-semibold text-white">Workspace Verification</h1>
            <p className="text-sm text-gray-400 mt-1">Complete this quick form so we can set up your workspace</p>
          </div>
          <div className="h-1 bg-orange-600" />

          {leadInfo && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Your Information</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400 block text-xs">Name</span>
                  <span className="text-gray-900 font-medium">{leadInfo.name || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Email</span>
                  <span className="text-gray-900 font-medium">{leadInfo.email}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Company</span>
                  <span className="text-gray-900 font-medium">{leadInfo.company || "—"}</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" data-testid="label-website">
                1. Company Website URL
              </label>
              <input
                type="url"
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://www.yourcompany.com"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                data-testid="input-website"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" data-testid="label-job-title">
                2. Your Role / Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="e.g. Finance Manager, VP of Licensing"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                data-testid="input-job-title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" data-testid="label-contracts">
                3. Number of Contracts You Manage <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.contractCount}
                onChange={(e) => setForm((f) => ({ ...f, contractCount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors bg-white"
                data-testid="select-contracts"
              >
                <option value="">Select a range...</option>
                <option value="1-10">1 - 10</option>
                <option value="10-50">10 - 50</option>
                <option value="50-200">50 - 200</option>
                <option value="200+">200+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" data-testid="label-goals">
                4. What Are You Hoping to Achieve with LicenseIQ? <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={form.goals}
                onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
                placeholder="e.g. Automate contract fee calculations, reduce audit risk, streamline contract review"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors resize-none"
                data-testid="textarea-goals"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" data-testid="label-referral">
                5. How Did You Hear About Us?
              </label>
              <select
                value={form.referralSource}
                onChange={(e) => setForm((f) => ({ ...f, referralSource: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors bg-white"
                data-testid="select-referral"
              >
                <option value="">Select...</option>
                <option value="Google">Google Search</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Referral">Referral / Word of Mouth</option>
                <option value="Conference">Conference / Event</option>
                <option value="Industry Publication">Industry Publication</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="button-submit-verify"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Submitting...
                  </>
                ) : (
                  "Submit Verification"
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Your information is securely processed and only used to set up your workspace.
            </p>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-gray-400">&copy; {new Date().getFullYear()} CimpleIT LLC. All rights reserved.</p>
      </div>
    </div>
  );
}
