import { Link } from "wouter";
import licenseIQLogoDark from "@assets/licenseiq-logo-dark-bg_1772668276821.png";
import { Twitter, Instagram, Linkedin } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center mb-4">
              <img src={licenseIQLogoDark} alt="LicenseIQ" className="h-10 w-auto" />
            </div>
            <p className="text-slate-400 text-sm">
              AI-native contract-to-cash execution platform for finance teams.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link href="/"><span className="hover:text-white cursor-pointer">Home</span></Link></li>
              <li><Link href="/about"><span className="hover:text-white cursor-pointer">About Us</span></Link></li>
              <li><Link href="/solutions"><span className="hover:text-white cursor-pointer">Solutions</span></Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-slate-400">
              <li><Link href="/privacy"><span className="hover:text-white cursor-pointer">Privacy Policy</span></Link></li>
              <li><Link href="/privacy"><span className="hover:text-white cursor-pointer">Terms of Service</span></Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li>info@licenseiq.ai</li>
              <li>+1 (214) 685-3536</li>
            </ul>
            <div className="flex gap-4 mt-4">
              <a href="https://x.com/LicenseiqA24033" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" data-testid="link-twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/licenseiq.ai/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" data-testid="link-instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.linkedin.com/company/licenseiq" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" data-testid="link-linkedin">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 text-center text-slate-400 text-sm">
          <p>A Cimpleit product &nbsp;·&nbsp; <a href="mailto:info@licenseiq.ai" className="hover:text-white transition-colors" data-testid="link-footer-email">info@licenseiq.ai</a> &nbsp;·&nbsp; <a href="https://www.licenseiq.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" data-testid="link-footer-website">www.licenseiq.ai</a> &nbsp;·&nbsp; &copy; 2026 All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
