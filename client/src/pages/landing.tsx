import { Link } from "wouter";
import { PublicNavigation } from "@/components/public-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { LandingChatbot } from "@/components/landing-chatbot";
import { PublicFooter } from "@/components/public-footer";
import licenseIQIcon from "@assets/licenseiq-icon-transparent_1772668276821.png";
import { 
  Brain, Shield, FileText, BarChart3, 
  CheckCircle, ArrowRight, Sparkles, 
  Clock, TrendingUp, Zap, Globe,
  FileCheck, Search, Calculator, Upload,
  Users, Lock, FileSpreadsheet, MessageSquare,
  DollarSign, Target, Building2, Settings,
  Layers, PieChart, Receipt, FileOutput,
  ChevronRight, ChevronDown, Star, Award, Rocket, Mail, Menu, X
} from "lucide-react";
import { 
  SiSap, SiOracle, SiSalesforce, SiQuickbooks,
  SiSnowflake
} from "react-icons/si";
import { Twitter, Facebook, Instagram, Linkedin } from "lucide-react";

export default function Landing() {
  const { toast } = useToast();
  const [isSubmittingEarlyAccess, setIsSubmittingEarlyAccess] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState<Record<string, boolean>>({});
  const [demoEmails, setDemoEmails] = useState<Record<string, string>>({
    basic: '',
    plus: '',
    ultra: ''
  });
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show header at the top
      if (currentScrollY < 10) {
        setIsHeaderVisible(true);
      } 
      // Hide when scrolling down
      else if (currentScrollY > lastScrollY) {
        setIsHeaderVisible(false);
      } 
      // Show when scrolling up
      else {
        setIsHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);

      // Clear existing timeout
      clearTimeout(scrollTimeout);

      // Show header after scrolling stops (200ms delay)
      scrollTimeout = setTimeout(() => {
        setIsHeaderVisible(true);
      }, 200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [lastScrollY]);

  const handleEarlyAccessSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingEarlyAccess(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const company = formData.get('company') as string;
    const position = formData.get('position') as string;
    const message = formData.get('message') as string;

    // Client-side validation
    if (!name || name.trim().length === 0) {
      toast({
        title: "Name Required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      setIsSubmittingEarlyAccess(false);
      return;
    }

    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      setIsSubmittingEarlyAccess(false);
      return;
    }

    if (!company.trim()) {
      toast({
        title: "Company Required",
        description: "Company name is required.",
        variant: "destructive",
      });
      setIsSubmittingEarlyAccess(false);
      return;
    }

    if (!position.trim()) {
      toast({
        title: "Position Required",
        description: "Position is required.",
        variant: "destructive",
      });
      setIsSubmittingEarlyAccess(false);
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Use Case Required",
        description: "Please tell us about your use case.",
        variant: "destructive",
      });
      setIsSubmittingEarlyAccess(false);
      return;
    }

    try {
      await apiRequest('POST', '/api/early-access-signup', { email, name, company, position, message });

      toast({
        title: "Success!",
        description: "Thank you for your interest! We'll be in touch soon.",
      });

      // Reset form
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEarlyAccess(false);
    }
  };

  const handleDemoRequest = async (planTier: string, buttonId: string) => {
    const email = demoEmails[buttonId as keyof typeof demoEmails];
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingDemo(prev => ({ ...prev, [buttonId]: true }));

    try {
      await apiRequest('POST', '/api/demo-request', { email, planTier });

      toast({
        title: "Success!",
        description: "Thank you! We'll contact you soon to schedule your demo.",
      });

      // Clear the input field using state
      setDemoEmails(prev => ({ ...prev, [buttonId]: '' }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingDemo(prev => ({ ...prev, [buttonId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation Bar - Compact Floating Header */}
      <nav 
        className={`border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-20 md:h-28">
            <div className="flex items-center">
              <div className="flex items-center gap-0">
                <img src={licenseIQIcon} alt="LicenseIQ Icon" className="h-9 md:h-12 w-auto" />
                <div className="flex flex-col items-end">
                  <span className="text-xl md:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight md:leading-[36px]">License<span className="text-orange-500">IQ</span></span>
                  <span className="text-[7px] md:text-[9px] text-slate-400 tracking-wide leading-none">by Cimpleit</span>
                </div>
              </div>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden lg:flex items-center gap-8">
              <Link href="/">
                <span className="text-orange-700 dark:text-orange-500 font-medium cursor-pointer">Home</span>
              </Link>
              
              {/* Solutions Dropdown */}
              <div className="relative group">
                <Link href="/solutions">
                  <span className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer flex items-center gap-1">
                    Solutions
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </span>
                </Link>
                
                {/* Dropdown Menu */}
                <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 min-w-[320px]">
                    {/* By Industry */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">By Industry</p>
                      <div className="space-y-1">
                        <Link href="/solutions/hightech">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">High-Tech & Manufacturing</span>
                        </Link>
                        <Link href="/solutions/licensing">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Intellectual Property & Licensing</span>
                        </Link>
                        <Link href="/solutions/cpg">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Branded Manufacturing & Consumer Packaged Goods</span>
                        </Link>
                        <Link href="/solutions/saas">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Software as a Service & Platform</span>
                        </Link>
                        <Link href="/solutions/pe">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Private Equity-Backed & Multi-Entity</span>
                        </Link>
                      </div>
                    </div>
                    
                    {/* By Revenue Flow */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">By Revenue Flow</p>
                      <div className="space-y-1">
                        <Link href="/solutions/distributor-programs">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Distributor & Reseller Programs</span>
                        </Link>
                        <Link href="/solutions/licensing-royalties">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Licensing & Royalties</span>
                        </Link>
                        <Link href="/solutions/rebates">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Rebates & Incentives</span>
                        </Link>
                        <Link href="/solutions/price-protection">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Price Protection & Chargebacks</span>
                        </Link>
                        <Link href="/solutions/revenue-share">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Revenue Share & Marketplace</span>
                        </Link>
                      </div>
                    </div>
                    
                    {/* View All */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                      <Link href="/solutions">
                        <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                          View All Solutions
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Resources Dropdown */}
              <div className="relative group">
                <span className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer flex items-center gap-1">
                  Resources
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                </span>
                
                {/* Resources Dropdown Menu */}
                <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 min-w-[280px]">
                    <div className="space-y-1 mb-4">
                      <Link href="/early-adopter">
                        <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer font-medium">Early Adopter</span>
                      </Link>
                      <Link href="/faq">
                        <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer font-medium">Auditor FAQ's</span>
                      </Link>
                    </div>
                    
                    {/* Resource Center */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Resource Center</p>
                      <div className="space-y-1">
                        <Link href="/resources/audit">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Audit</span>
                        </Link>
                        <Link href="/resources/blogs">
                          <span className="block px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">Blogs</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Link href="/about">
                <span className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer">About Us</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/schedule-demo">
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-5" data-testid="button-schedule-demo-nav">
                  Schedule a Demo
                </Button>
              </Link>
              <Link href="/auth">
                <Button 
                  variant="outline" 
                  className="border-slate-900 dark:border-white text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium px-4 md:px-6 text-sm md:text-base h-9 md:h-10"
                  data-testid="button-login-nav"
                >
                  Login
                </Button>
              </Link>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-slate-700 dark:text-white" /> : <Menu className="h-6 w-6 text-slate-700 dark:text-white" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg">
            <div className="container mx-auto px-6 py-4 space-y-3">
              <Link href="/">
                <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-orange-700 dark:text-orange-500 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Home</span>
              </Link>
              <Link href="/solutions">
                <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Solutions</span>
              </Link>
              <div className="pl-6 space-y-1">
                <Link href="/solutions/hightech">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">High-Tech & Manufacturing</span>
                </Link>
                <Link href="/solutions/licensing">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">IP & Licensing</span>
                </Link>
                <Link href="/solutions/licensing-royalties">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">Licensing & Royalties</span>
                </Link>
              </div>
              <Link href="/faq">
                <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Resources</span>
              </Link>
              <Link href="/about">
                <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">About Us</span>
              </Link>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <Link href="/auth">
                  <Button
                    variant="outline"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full border-slate-900 dark:border-white text-slate-900 dark:text-white font-medium"
                    data-testid="button-login-mobile"
                  >
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-black">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto px-4 pt-36 pb-20 md:pt-40 md:pb-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="flex justify-center items-center animate-in fade-in slide-in-from-top-2 duration-700">
              <span className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">License<span className="text-orange-500">IQ</span></span>
            </div>

            <div className="inline-flex items-center space-x-2 bg-orange-600 px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">AI-Native Contract Intelligence</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white animate-in fade-in slide-in-from-top-6 duration-700 delay-100">
              Financial Intelligence Layer for{" "}
              <span className="text-orange-500">
                Sales-Based
              </span>
              <br />
              <span className="text-orange-500">
                Contract Automation
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto animate-in fade-in slide-in-from-top-8 duration-700 delay-200">
              <strong className="text-white">"From contract to cash — automated, accurate, and audit-ready."</strong>
              <br /><br />
              LicenseIQ turns complex contracts into executable rules. It reads agreements, extracts terms, calculates payments, and generates audit-ready reports — automating incentive contracts, contract fees and royalties, rebates, commissions, and service fees with finance-grade accuracy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-in fade-in slide-in-from-top-10 duration-700 delay-300">
              <Link href="/early-adopter">
                <Button 
                  size="lg" 
                  className="px-8 h-14 text-lg bg-orange-600 hover:bg-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300"
                  data-testid="button-get-started"
                >
                  Early Adopter
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                size="lg"
                className="px-8 h-14 text-lg border-2 border-white bg-transparent text-white hover:bg-white hover:text-black"
              >
                Watch Demo
              </Button>
            </div>

            <div className="pt-8 animate-in fade-in duration-700 delay-400">
              <p className="text-sm text-slate-400 mb-4">AI-native features that drive results</p>
              <div className="flex items-center justify-center gap-8 flex-wrap">
                <div className="flex items-center gap-2 text-white">
                  <Brain className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold">Intelligent Contract Analysis</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Calculator className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold">Automated Calculations</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-orange-500" />
                  <span className="font-semibold">Risk Detection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              liQ Contract to Cash{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                Execution Flows
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8">
              LicenseIQ operates after pricing, quoting, and order execution. We don't decide what prices should be — we ensure the money tied to signed contracts is calculated, accrued, settled, and defensible.
            </p>
            
            {/* Supported Flows - Beautiful Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
              {/* Flow 1 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Licensing & fee execution</h4>
                </div>
              </div>

              {/* Flow 2 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Channel rebates, MDF & incentives</h4>
                </div>
              </div>

              {/* Flow 3 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Distributor chargebacks & price protection</h4>
                </div>
              </div>

              {/* Flow 4 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Commissions & referral revenue</h4>
                </div>
              </div>

              {/* Flow 5 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Globe className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Marketplace & usage-based splits</h4>
                </div>
              </div>

              {/* Flow 6 */}
              <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 p-4 shadow-md hover:shadow-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  </div>
                  <h4 className="text-slate-800 dark:text-slate-200 font-semibold text-sm leading-tight">Audit-ready settlement & intelligence</h4>
                </div>
              </div>
            </div>
          </div>
          
          {/* liQ Contract Orchestration Suite */}
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              liQ Contract Orchestration Suite
            </h3>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-6">
            {/* Feature 1 - AI Contract Ingestion */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Upload className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    AI Contract Ingestion
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Automatically extracts licensing terms, payment rates, territories, and exclusions from any PDF contract
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 2 - Sales Matching */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    AI Sales Matching
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Upload sales data and AI automatically matches transactions to the correct contracts with confidence scoring
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 3 - Payment Calculator */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-700 to-orange-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Calculator className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Automated Payment Calculator
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Generates rules as determined from the contract with volume tiers, seasonal adjustments, minimums, and multi-party splits
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 4 - PDF Invoices */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-900 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Receipt className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Settlement
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Settlements directly from contract logic and validated data — AR/AP transactions, accrual journals, credit memos, full calculation lineage
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 5 - liQ AI */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <MessageSquare className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    liQ AI
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Ask questions about your contracts in plain English. RAG-powered AI provides accurate answers with citations
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 6 - Rules Management */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-250">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Settings className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Rules Management
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    View, edit, and create payment calculation rules with full source attribution to contract clauses
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 7 - Risk Assessment */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-red-200 dark:hover:border-red-800">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Risk Assessment
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    AI identifies compliance issues, missing clauses, and potential legal risks before they become problems
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Feature 8 - Analytics Dashboard */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-200 dark:hover:border-orange-800">
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Analytics Dashboard
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Financial, compliance, strategic, and performance insights with interactive charts and trend analysis
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Advanced Capabilities Section */}
      <section className="py-20 md:py-32 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-700 text-white">Advanced Features</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Enterprise-grade{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                automation
              </span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Cut out manual work and refocus on strategic analysis that drives growth
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Multi-Entity Support */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">Multi-Entity Support</h4>
                  <p className="text-sm text-slate-400">
                    Manage contracts across multiple entities with territory-based calculations and multi-currency support
                  </p>
                </div>
              </div>
            </div>

            {/* User Management & RBAC */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">User Management</h4>
                  <p className="text-sm text-slate-400">
                    5-tier role-based access control: Owner, Admin, Editor, Viewer, Auditor with granular permissions
                  </p>
                </div>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-700 to-orange-800 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">Complete Audit Trail</h4>
                  <p className="text-sm text-slate-400">
                    SOX-compliant activity logging tracks every action, calculation, and change for full accountability
                  </p>
                </div>
              </div>
            </div>

            {/* Contract Numbering */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center flex-shrink-0 shadow-md">
                  <FileCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">Smart Organization</h4>
                  <p className="text-sm text-slate-400">
                    Auto-generated contract numbers (CNT-YYYY-NNN), version tracking, and amendment management
                  </p>
                </div>
              </div>
            </div>

            {/* Data Import/Export */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">Flexible Data Import</h4>
                  <p className="text-sm text-slate-400">
                    CSV and Excel imports for sales data with automatic validation and cleansing
                  </p>
                </div>
              </div>
            </div>

            {/* ERP Integration Ready */}
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-orange-600/50 transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Layers className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-white mb-2">ERP Integration Ready</h4>
                  <p className="text-sm text-slate-400">
                    Built for integration with SAP, Oracle, NetSuite, QuickBooks, and custom systems via API
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Content */}
              <div className="space-y-8">
                <div>
                  <Badge className="mb-4 bg-orange-700 text-white">Proven Results</Badge>
                  <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                    Achieve more in{" "}
                    <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                      less time
                    </span>
                  </h2>
                  <p className="text-xl text-slate-600 dark:text-slate-300">
                    Eliminate manual errors that cost $10K-$100K+ in disputes and free your team for strategic work
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-lg text-slate-900 dark:text-white">95% Time Savings</h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        Manual calculations: 10-40 hours per quarter. With LicenseIQ: 30 minutes per quarter
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-lg text-slate-900 dark:text-white">Eliminate Payment Errors</h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        Prevent underpayments and overpayments with automated accuracy and audit-ready documentation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-lg text-slate-900 dark:text-white">Instant Compliance Reports</h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        Generate audit-ready reports with full calculation breakdowns and historical tracking
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-lg text-slate-900 dark:text-white">Quick Implementation</h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        4-week setup vs 18-month enterprise solutions. Start with CSV imports, scale to full automation
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold text-lg text-slate-900 dark:text-white">Immediate ROI</h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        Save $50K-$200K+ annually in labor costs and dispute resolution
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Stats Card */}
              <div className="bg-gradient-to-br from-orange-700 to-orange-900 p-8 rounded-2xl shadow-2xl text-white">
                <h3 className="text-2xl font-bold mb-8">Enterprise Impact</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                      <DollarSign className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">$200K+</div>
                      <div className="text-orange-100">Annual savings</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                      <Clock className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">95%</div>
                      <div className="text-orange-100">Time reduction</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                      <Zap className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">4 weeks</div>
                      <div className="text-orange-100">To full deployment</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                      <Shield className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold">100%</div>
                      <div className="text-orange-100">Audit compliance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 md:py-32 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Built for{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                enterprise
              </span>
              {" "}leaders
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Trusted by companies across industries managing complex licensing agreements
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-semibold text-lg text-white mb-2">Consumer Products</h4>
              <p className="text-sm text-slate-300">Brand licensing and payment management</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Globe className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-semibold text-lg text-white mb-2">Automotive Original Equipment Manufacturers</h4>
              <p className="text-sm text-slate-300">Multi-tier supplier licensing</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-semibold text-lg text-white mb-2">Electronics</h4>
              <p className="text-sm text-slate-300">High-volume patent licensing</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Settings className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="font-semibold text-lg text-white mb-2">Industrial Equipment</h4>
              <p className="text-sm text-slate-300">Machinery component licensing</p>
            </div>
          </div>
        </div>
      </section>

      {/* liQ Agent - AI Copilot Section */}
      <section className="py-20 md:py-32 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-gradient-to-r from-orange-700 to-orange-800 text-white">AI Copilot</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Meet{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-800 bg-clip-text text-transparent">
                liQ Agent
              </span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Your intelligent AI assistant available across the entire platform — ask questions, get instant answers, and work smarter
            </p>
          </div>

          {/* liQ Agent Visual */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="relative">
              {/* Central liQ Agent */}
              <div className="flex flex-col items-center text-center mb-12">
                <div className="w-32 h-32 bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl animate-pulse">
                  <Sparkles className="h-16 w-16 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">liQ Agent</h3>
                <p className="text-lg text-slate-300">Available everywhere you work</p>
              </div>

              {/* Example Questions */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-700 hover:border-orange-600/50 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <MessageSquare className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-white mb-1">Contextual Q&A</p>
                      <p className="text-sm text-slate-400">"What payment rate applies to Product X in EMEA?"</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-700 hover:border-orange-600/50 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <Search className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-white mb-1">Smart Search</p>
                      <p className="text-sm text-slate-400">"Find all contracts with volume discounts"</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-700 hover:border-orange-600/50 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <FileCheck className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-white mb-1">Instant Insights</p>
                      <p className="text-sm text-slate-400">"What are the payment terms in Contract ABC?"</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-700 hover:border-orange-600/50 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <Brain className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-semibold text-white mb-1">Always Learning</p>
                      <p className="text-sm text-slate-400">"Show me similar clauses across all contracts"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="inline-flex p-4 bg-orange-900/30 rounded-xl mb-4">
                <Sparkles className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-bold text-white mb-2">Omnipresent</h4>
              <p className="text-sm text-slate-300">Access liQ Agent from any page — always ready to help</p>
            </div>

            <div className="text-center">
              <div className="inline-flex p-4 bg-orange-900/30 rounded-xl mb-4">
                <Target className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-bold text-white mb-2">Context-Aware</h4>
              <p className="text-sm text-slate-300">Understands your contracts and provides accurate answers</p>
            </div>

            <div className="text-center">
              <div className="inline-flex p-4 bg-orange-900/30 rounded-xl mb-4">
                <Rocket className="h-8 w-8 text-orange-700" />
              </div>
              <h4 className="font-bold text-white mb-2">Instant Responses</h4>
              <p className="text-sm text-slate-300">Get answers in seconds with confidence scores and sources</p>
            </div>
          </div>
        </div>
      </section>

      {/* Automation Workflow Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-700 text-white">End-to-End Automation</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              From{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                Contract to Cash
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Fully automated workflow that transforms PDFs into payments
            </p>
          </div>

          {/* Automation Flow Diagram */}
          <div className="max-w-6xl mx-auto">
            {/* Top Row - Contract to Rules (All in one box) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-lg border border-slate-200 dark:border-slate-700 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                {/* Contract */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="h-10 w-10 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">Contract</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Upload PDF</p>
                </div>

                <div className="flex justify-center items-center">
                  <ArrowRight className="h-8 w-8 text-orange-400 md:block hidden" />
                  <ChevronDown className="h-8 w-8 text-orange-400 md:hidden" />
                </div>

                {/* AI */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-2xl flex items-center justify-center mb-4">
                    <Brain className="h-10 w-10 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">AI Analysis</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Extract Terms</p>
                </div>

                <div className="flex justify-center items-center">
                  <ArrowRight className="h-8 w-8 text-orange-400 md:block hidden" />
                  <ChevronDown className="h-8 w-8 text-orange-400 md:hidden" />
                </div>

                {/* Rules */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-2xl flex items-center justify-center mb-4">
                    <Settings className="h-10 w-10 text-orange-600" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white mb-1">Rules</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Auto-Generated</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-8">
              <ChevronDown className="h-10 w-10 text-orange-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ERP/CRM Integration */}
              <div className="flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-orange-600" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">ERP/CRM Sync</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Connects to SAP, Oracle, NetSuite, Salesforce</p>
              </div>

              {/* Payment Calculation */}
              <div className="flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-center mb-4">
                  <DollarSign className="h-8 w-8 text-orange-600" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Payment Calculation</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Automated payment, rebate & commission processing</p>
              </div>

              {/* Audit Report */}
              <div className="flex flex-col items-center text-center bg-white dark:bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl flex items-center justify-center mb-4">
                  <FileOutput className="h-8 w-8 text-orange-600" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">Audit Report</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Complete audit trail & compliance documentation</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-700 text-white">Flexible Solutions</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Find the{" "}
              <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                right fit
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Schedule a personalized demo to see how LicenseIQ can transform your contract workflows
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* LicenseIQ */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">LicenseIQ</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 min-h-[48px]">For finance teams needing control, live visibility, and audit-readiness</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">AI contract reading & term extraction</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Automated payment calculations</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Complete audit trail & compliance</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Shield className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300"><strong>SOC 2 & GDPR compliance ready</strong></span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Basic ERP/CRM integrations</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">5 contracts included</span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <Input 
                    type="email" 
                    placeholder="Enter your work email" 
                    className="bg-white dark:bg-slate-950"
                    data-testid="input-email-basic"
                    value={demoEmails.basic}
                    onChange={(e) => setDemoEmails(prev => ({ ...prev, basic: e.target.value }))}
                  />
                  <Button 
                    className="w-full bg-orange-700 hover:bg-orange-800 text-white"
                    data-testid="button-schedule-demo-basic"
                    disabled={isSubmittingDemo['basic']}
                    onClick={() => handleDemoRequest('licenseiq', 'basic')}
                  >
                    {isSubmittingDemo['basic'] ? "Submitting..." : "Schedule demo"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* LicenseIQ Plus */}
            <Card className="border-2 border-orange-600 dark:border-orange-700 relative shadow-xl bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-orange-700 text-white px-4 py-1">Most popular</Badge>
              </div>
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">LicenseIQ <span className="text-orange-700">Plus</span></h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 min-h-[48px]">For growing teams scaling across <span className="text-orange-700 font-semibold">international entities</span> and preparing for <span className="text-orange-700 font-semibold">IPO readiness</span></p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300"><strong>Everything in LicenseIQ, plus:</strong></span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Shield className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300"><strong>SOC 2 & GDPR compliance ready</strong></span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Multi-entity & multi-currency support</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Advanced workflow automation</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Priority support & onboarding</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Custom integrations (SAP, Oracle, NetSuite)</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">15 contracts included</span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <Input 
                    type="email" 
                    placeholder="Enter your work email" 
                    className="bg-white dark:bg-slate-950"
                    data-testid="input-email-plus"
                    value={demoEmails.plus}
                    onChange={(e) => setDemoEmails(prev => ({ ...prev, plus: e.target.value }))}
                  />
                  <Button 
                    className="w-full bg-orange-700 hover:bg-orange-800 text-white"
                    data-testid="button-schedule-demo-plus"
                    disabled={isSubmittingDemo['plus']}
                    onClick={() => handleDemoRequest('licenseiq_plus', 'plus')}
                  >
                    {isSubmittingDemo['plus'] ? "Submitting..." : "Schedule demo"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* LicenseIQ Ultra */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">LicenseIQ <span className="text-orange-700">Ultra</span></h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 min-h-[48px]">For larger teams preparing for IPO, handling more finance complexity</p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300"><strong>Everything in Plus, plus:</strong></span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Shield className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300"><strong>SOC 2 & GDPR compliance ready</strong></span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Dedicated account manager</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Custom AI model training</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">White-glove implementation & training</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Unlimited contracts</span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <Input 
                    type="email" 
                    placeholder="Enter your work email" 
                    className="bg-white dark:bg-slate-950"
                    data-testid="input-email-ultra"
                    value={demoEmails.ultra}
                    onChange={(e) => setDemoEmails(prev => ({ ...prev, ultra: e.target.value }))}
                  />
                  <Button 
                    className="w-full bg-orange-700 hover:bg-orange-800 text-white"
                    data-testid="button-schedule-demo-ultra"
                    disabled={isSubmittingDemo['ultra']}
                    onClick={() => handleDemoRequest('licenseiq_ultra', 'ultra')}
                  >
                    {isSubmittingDemo['ultra'] ? "Submitting..." : "Schedule demo"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-20 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                Works with your systems —{" "}
                <span className="bg-gradient-to-r from-orange-700 to-orange-900 bg-clip-text text-transparent">
                  no new interface required
                </span>
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mt-4">
                LicenseIQ connects seamlessly with your ERP, CRM, and CLM tools — transforming static contracts into live financial intelligence.
              </p>
            </div>

            {/* Integration Logos Scrolling Marquee */}
            <div className="overflow-hidden">
              <div className="flex animate-scroll-right gap-12 py-4">
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiSap className="h-16 w-16 transition-transform duration-300" style={{ color: '#0070F2' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">SAP</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiOracle className="h-16 w-16 transition-transform duration-300" style={{ color: '#F80000' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Oracle</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <div className="h-16 flex items-center justify-center transition-transform duration-300">
                    <svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 8h4v18l12-18h4v24h-4V14L8 32H4V8z" fill="#BBBCBC"/>
                      <text x="30" y="27" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#BBBCBC">Net</text>
                      <text x="65" y="27" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#E87511">Suite</text>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">NetSuite</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <div className="h-16 flex items-center justify-center transition-transform duration-300">
                    <svg width="140" height="44" viewBox="0 0 140 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="16" r="7" fill="#F5A623"/>
                      <path d="M18 5a11 11 0 0 1 0 22" stroke="#EA6A2B" strokeWidth="2.5" fill="none"/>
                      <circle cx="18" cy="16" r="3.5" fill="#EA6A2B"/>
                      <text x="34" y="23" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="16" fill="#333333">workday</text>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Workday</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiSalesforce className="h-16 w-16 transition-transform duration-300" style={{ color: '#00A1E0' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Salesforce</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiQuickbooks className="h-16 w-16 transition-transform duration-300" style={{ color: '#2CA01C' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">QuickBooks</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiSnowflake className="h-16 w-16 transition-transform duration-300" style={{ color: '#29B5E8' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Snowflake</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <div className="h-16 flex items-center justify-center transition-transform duration-300">
                    <svg width="130" height="40" viewBox="0 0 130 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <text x="5" y="26" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="19" fill="#1A4789">Docu</text>
                      <text x="58" y="26" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="19" fill="#1A4789">Sign</text>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">DocuSign</span>
                </div>
                {/* Duplicate for seamless loop */}
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiSap className="h-16 w-16 transition-transform duration-300" style={{ color: '#0070F2' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">SAP</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <SiOracle className="h-16 w-16 transition-transform duration-300" style={{ color: '#F80000' }} />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Oracle</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <div className="h-16 flex items-center justify-center transition-transform duration-300">
                    <svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 8h4v18l12-18h4v24h-4V14L8 32H4V8z" fill="#BBBCBC"/>
                      <text x="30" y="27" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#BBBCBC">Net</text>
                      <text x="65" y="27" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="17" fill="#E87511">Suite</text>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">NetSuite</span>
                </div>
                <div className="flex flex-col items-center space-y-2 p-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-300 hover:scale-110 flex-shrink-0">
                  <div className="h-16 flex items-center justify-center transition-transform duration-300">
                    <svg width="140" height="44" viewBox="0 0 140 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="16" r="7" fill="#F5A623"/>
                      <path d="M18 5a11 11 0 0 1 0 22" stroke="#EA6A2B" strokeWidth="2.5" fill="none"/>
                      <circle cx="18" cy="16" r="3.5" fill="#EA6A2B"/>
                      <text x="34" y="23" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="16" fill="#333333">workday</text>
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Workday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beta Program Section */}
      <section id="early-access" className="py-20 md:py-32 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center space-x-2 bg-orange-700/20 px-4 py-2 rounded-full">
              <Rocket className="h-5 w-5 text-orange-400" />
              <span className="text-sm font-medium text-orange-300">Early Adopter Program</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Be among the first to experience LicenseIQ
            </h2>
            <p className="text-xl text-slate-300">
              Join our exclusive Early Adopter program and help shape the future of contract intelligence
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
              <div className="flex items-start space-x-3">
                <Award className="h-6 w-6 flex-shrink-0 mt-1 text-orange-400" />
                <div>
                  <h4 className="font-semibold mb-1 text-white">Free Trial Period</h4>
                  <p className="text-sm text-slate-300">Extended trial with full feature access</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <DollarSign className="h-6 w-6 flex-shrink-0 mt-1 text-orange-400" />
                <div>
                  <h4 className="font-semibold mb-1 text-white">Early Bird Discount</h4>
                  <p className="text-sm text-slate-300">Exclusive pricing for beta participants</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="h-6 w-6 flex-shrink-0 mt-1 text-orange-400" />
                <div>
                  <h4 className="font-semibold mb-1 text-white">Direct Design Input</h4>
                  <p className="text-sm text-slate-300">Shape features based on your needs</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Star className="h-6 w-6 flex-shrink-0 mt-1 text-orange-400" />
                <div>
                  <h4 className="font-semibold mb-1 text-white">Case Study Partnership</h4>
                  <p className="text-sm text-slate-300">Featured success story opportunity</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <p className="text-slate-300 mb-4 text-sm">Fill out the form below to join our beta program:</p>
              
              {/* Early Access Form Inline */}
              <div className="max-w-xl mx-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-8 border border-orange-200 dark:border-orange-900 shadow-xl">
                <form 
                  id="beta-form" 
                  className="space-y-4"
                  onSubmit={handleEarlyAccessSubmit}
                >
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    data-testid="input-name"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Work Email"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    data-testid="input-email"
                  />
                  <input
                    type="text"
                    name="company"
                    placeholder="Company Name"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    data-testid="input-company"
                  />
                  <input
                    type="text"
                    name="position"
                    placeholder="Position in your company"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    data-testid="input-position"
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    required
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    data-testid="input-phone"
                  />
                  <textarea
                    name="message"
                    placeholder="Tell us about your use case"
                    required
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600 resize-none"
                    data-testid="input-message"
                  />
                  <Button 
                    type="submit"
                    size="lg" 
                    disabled={isSubmittingEarlyAccess}
                    className="w-full px-10 h-14 text-lg bg-gradient-to-r from-orange-700 to-orange-900 hover:from-orange-800 hover:to-orange-900 text-white shadow-xl hover:shadow-2xl transition-all duration-300"
                    data-testid="button-submit-access"
                  >
                    {isSubmittingEarlyAccess ? "Submitting..." : "Schedule a Demo"}
                    {!isSubmittingEarlyAccess && <ChevronRight className="ml-2 h-5 w-5" />}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-20 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
              Get in Touch
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Have questions or want to learn more about LicenseIQ? We'd love to hear from you.
            </p>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 md:p-12 shadow-xl">
              <div className="flex flex-col items-center space-y-4">
                <Mail className="h-12 w-12 text-orange-700 dark:text-orange-500" />
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Email Us
                </h3>
                <a 
                  href="mailto:info@licenseiq.ai"
                  className="text-2xl md:text-3xl font-bold text-orange-700 dark:text-orange-500 hover:text-orange-800 dark:hover:text-orange-300 transition-colors duration-200"
                  data-testid="link-contact-email"
                >
                  info@licenseiq.ai
                </a>
                <p className="text-slate-600 dark:text-slate-400 mt-4">
                  Our team will be in touch shortly
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />

      {/* AI Chatbot */}
      <LandingChatbot />

    </div>
  );
}
