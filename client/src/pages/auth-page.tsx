import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, type LoginData, type RegisterData } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Lock, Mail, User, ArrowRight, Sparkles, CheckCircle, TrendingUp, Clock, FileCheck, Shield, Zap, Globe } from "lucide-react";
import licenseIQLogoLight from "@assets/licenseiq-logo-transparent_1772668276822.png";
import { PublicNavigation } from "@/components/public-navigation";

const animationOptions = [
  { id: "none", label: "None", class: "" },
  { id: "pulse", label: "Pulse/Glow", class: "animate-pulse" },
  { id: "float", label: "Float/Bob", class: "animate-float" },
  { id: "spin-hover", label: "Spin on Hover", class: "hover:animate-spin transition-transform duration-700" },
  { id: "fade-scale", label: "Fade & Scale", class: "animate-fade-scale" },
  { id: "shimmer", label: "Shimmer/Shine", class: "animate-shimmer" },
];

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [selectedAnimation, setSelectedAnimation] = useState("pulse");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
    },
  });

  const onLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  if (user) {
    return null; // Redirecting...
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-orange-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800" data-testid="auth-page">
      <PublicNavigation />
      <div className="flex-1 flex">
      {/* Left side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="w-full max-w-md space-y-6 relative z-10">
          {/* Logo and Title */}
          <div className="text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center justify-center mb-6">
              <img 
                src={licenseIQLogoLight} 
                alt="LicenseIQ Logo" 
                className={`h-20 ${animationOptions.find(a => a.id === selectedAnimation)?.class || ""}`}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              AI-native licensing management platform
            </p>
            
          </div>

          {/* Login Only - Create Account hidden */}
          <Tabs value="login" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-1 h-12 p-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg">
              <TabsTrigger 
                value="login" 
                data-testid="tab-login"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-700 data-[state=active]:to-orange-800 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
              >
                <Lock className="h-4 w-4 mr-2" />
                Sign In
              </TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-slate-200 dark:border-slate-700 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="email"
                                  placeholder="Enter your email" 
                                  {...field} 
                                  data-testid="input-username"
                                  className="pl-10 h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="password" 
                                  placeholder="Enter your password" 
                                  {...field} 
                                  data-testid="input-password"
                                  className="pl-10 h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full h-11 bg-gradient-to-r from-orange-700 to-orange-900 hover:from-orange-800 hover:to-orange-900 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold" 
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing In...
                          </>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Form - Hidden */}
            <TabsContent value="register" className="hidden space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-slate-200 dark:border-slate-700 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
                  <p className="text-sm text-muted-foreground">Get started with LicenseIQ today</p>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">First Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="First name" 
                                  {...field} 
                                  data-testid="input-firstname"
                                  className="h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold">Last Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Last name" 
                                  {...field} 
                                  data-testid="input-lastname"
                                  className="h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Username</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  placeholder="Choose a username" 
                                  {...field} 
                                  data-testid="input-register-username"
                                  className="pl-10 h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Email (Optional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="email" 
                                  placeholder="your@email.com" 
                                  {...field} 
                                  data-testid="input-email"
                                  className="pl-10 h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold">Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="password" 
                                  placeholder="Choose a password (min 6 characters)" 
                                  {...field} 
                                  data-testid="input-register-password"
                                  className="pl-10 h-11 border-slate-300 dark:border-slate-600 focus-visible:ring-orange-700"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full h-11 bg-gradient-to-r from-orange-700 to-orange-900 hover:from-orange-800 hover:to-orange-900 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold" 
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          <>
                            Create Account
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="text-center space-y-2 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-muted-foreground">&copy; 2025 LicenseIQ. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Right side - Business Benefits Section - Dark Professional Theme */}
      <div className="hidden lg:flex flex-1 bg-black p-8 lg:p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"></div>

        <div className="max-w-xl relative z-10 space-y-8">
          <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="inline-flex items-center space-x-2 bg-orange-600 px-4 py-2 rounded-full shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Financial Intelligence Layer</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight text-white">
              Enterprise Contract Intelligence with{" "}
              <span className="text-orange-500">Financial Precision</span>
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Transform complex licensing agreements into actionable insights. LicenseIQ delivers AI-native contract analysis, automated payment calculations, and audit-ready compliance—eliminating manual errors while ensuring financial accuracy at enterprise scale.
            </p>
          </div>

          <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <h3 className="text-2xl font-bold text-white">Key Benefits</h3>
            
            <div className="grid gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base text-white">AI Contract Intelligence</h4>
                    <p className="text-sm text-slate-300 mt-1">
                      Automatically extracts licensing terms and understands complex fee structures
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base text-white">Eliminate Payment Errors</h4>
                    <p className="text-sm text-slate-300 mt-1">
                      Prevent $10K-$100K+ disputes with automated accuracy and audit-ready calculations
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base text-white">95% Time Savings</h4>
                    <p className="text-sm text-slate-300 mt-1">
                      Turn 10-40 hours of work into just 30 minutes per agreement per quarter
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/15 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base text-white">Professional Reporting</h4>
                    <p className="text-sm text-slate-300 mt-1">
                      Generate branded audit-ready reports and compliance documentation instantly
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-600 p-5 rounded-xl shadow-xl animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
            <h4 className="font-semibold text-lg mb-3 flex items-center text-white">
              <TrendingUp className="h-5 w-5 mr-2" />
              Quick Implementation & ROI
            </h4>
            <ul className="space-y-2 text-sm text-orange-50">
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-orange-200" />
                <span>4-week implementation vs 18-month solutions</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-orange-200" />
                <span>Save $50K-$200K annually in labor costs</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-orange-200" />
                <span>Immediate ROI with CSV imports</span>
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between pt-4 animate-in fade-in slide-in-from-right-8 duration-700 delay-400">
            <div className="flex items-center space-x-2 text-sm text-white font-medium">
              <div className="w-8 h-8 rounded-lg bg-orange-900/50 flex items-center justify-center">
                <Zap className="h-4 w-4 text-orange-400" />
              </div>
              <span>ERP Integration</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-white font-medium">
              <div className="w-8 h-8 rounded-lg bg-orange-900/50 flex items-center justify-center">
                <Globe className="h-4 w-4 text-orange-400" />
              </div>
              <span>Multi-Currency</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-white font-medium">
              <div className="w-8 h-8 rounded-lg bg-orange-900/50 flex items-center justify-center">
                <Shield className="h-4 w-4 text-orange-400" />
              </div>
              <span>Audit Compliance</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
