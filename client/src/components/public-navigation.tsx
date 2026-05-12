import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import licenseIQIcon from "@assets/licenseiq-icon-transparent_1772668276821.png";
import { ChevronDown, ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

interface PublicNavigationProps {
  currentPage?: "home" | "solutions" | "pricing" | "early-adopter" | "faq" | "about" | "privacy";
}

export function PublicNavigation({ currentPage }: PublicNavigationProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const getActiveClass = (page: string) => {
    const isActive = currentPage === page || 
      (page === "home" && location === "/") ||
      (page === "solutions" && location === "/solutions") ||
      (page === "pricing" && location === "/pricing") ||
      (page === "early-adopter" && location === "/early-adopter") ||
      (page === "faq" && location === "/faq") ||
      (page === "about" && location === "/about") ||
      (page === "privacy" && location === "/privacy");
    
    return isActive 
      ? "text-orange-700 dark:text-orange-500 font-medium cursor-pointer"
      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer";
  };

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-20 md:h-28">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <div className="flex items-center gap-0">
                <img src={licenseIQIcon} alt="LicenseIQ Icon" className="h-9 md:h-12 w-auto" />
                <div className="flex flex-col items-end">
                  <span className="text-xl md:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-tight md:leading-[36px]">License<span className="text-orange-500">IQ</span></span>
                  <span className="text-[7px] md:text-[9px] text-slate-400 tracking-wide leading-none">by Cimpleit</span>
                </div>
              </div>
            </div>
          </Link>
          <div className="hidden lg:flex items-center gap-8">
            <Link href="/">
              <span className={getActiveClass("home")}>Home</span>
            </Link>
            
            {/* Solutions Dropdown */}
            <div className="relative group">
              <Link href="/solutions">
                <span className={`${getActiveClass("solutions")} flex items-center gap-1`}>
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
              <span className={getActiveClass("about")}>About Us</span>
            </Link>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/schedule-demo">
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-5 text-sm md:text-base h-9 md:h-10"
                data-testid="button-schedule-demo-nav"
              >
                Schedule a Demo
              </Button>
            </Link>
            <Link href="/auth">
              <Button
                variant="outline"
                className="border-slate-900 dark:border-white text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium px-4 md:px-6 text-sm md:text-base h-9 md:h-10"
                data-testid="button-login"
              >
                Login
              </Button>
            </Link>
          </div>
          <div className="flex lg:hidden items-center gap-2">
            <Link href="/schedule-demo">
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium px-3 text-xs h-8"
                data-testid="button-schedule-demo-nav-mobile"
              >
                Schedule a Demo
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-slate-700 dark:text-white" /> : <Menu className="h-6 w-6 text-slate-700 dark:text-white" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pb-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
            <div className="px-6 py-3 space-y-1">
              <Link href="/">
                <span onClick={() => setMobileMenuOpen(false)} className={`block px-3 py-2.5 rounded-lg ${currentPage === 'home' || location === '/' ? 'text-orange-700 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>Home</span>
              </Link>
              <Link href="/solutions">
                <span onClick={() => setMobileMenuOpen(false)} className={`block px-3 py-2.5 rounded-lg font-medium ${currentPage === 'solutions' || location.startsWith('/solutions') ? 'text-orange-700 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>Solutions</span>
              </Link>
              <div className="pl-4 space-y-0.5">
                <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">By Industry</p>
                <Link href="/solutions/hightech">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">High-Tech & Manufacturing</span>
                </Link>
                <Link href="/solutions/licensing">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">IP & Licensing</span>
                </Link>
                <Link href="/solutions/cpg">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Branded Manufacturing & CPG</span>
                </Link>
                <Link href="/solutions/saas">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">SaaS & Platform</span>
                </Link>
                <Link href="/solutions/pe">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Private Equity & Multi-Entity</span>
                </Link>
                <p className="px-3 py-1 pt-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">By Revenue Flow</p>
                <Link href="/solutions/distributor-programs">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Distributor & Reseller Programs</span>
                </Link>
                <Link href="/solutions/licensing-royalties">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Licensing & Royalties</span>
                </Link>
                <Link href="/solutions/rebates">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Rebates & Incentives</span>
                </Link>
                <Link href="/solutions/price-protection">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Price Protection & Chargebacks</span>
                </Link>
                <Link href="/solutions/revenue-share">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Revenue Share & Marketplace</span>
                </Link>
              </div>
              <span className="block px-3 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-300">Resources</span>
              <div className="pl-4 space-y-0.5">
                <Link href="/early-adopter">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Early Adopter</span>
                </Link>
                <Link href="/faq">
                  <span onClick={() => setMobileMenuOpen(false)} className={`block px-3 py-2 text-sm rounded-lg ${currentPage === 'faq' ? 'text-orange-700 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 font-medium' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>Auditor FAQ's</span>
                </Link>
                <Link href="/resources/audit">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Audit Resources</span>
                </Link>
                <Link href="/resources/blogs">
                  <span onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">Blogs</span>
                </Link>
              </div>
              <Link href="/about">
                <span onClick={() => setMobileMenuOpen(false)} className={`block px-3 py-2.5 rounded-lg ${currentPage === 'about' ? 'text-orange-700 dark:text-orange-500 bg-orange-50 dark:bg-orange-900/20 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>About Us</span>
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
      </div>
    </nav>
  );
}
