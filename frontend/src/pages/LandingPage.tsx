import { Children, type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ImageIcon,
  MailCheck,
  Menu,
  Rocket,
  Send,
  Sparkles,
  Smartphone,
  Wifi
} from "lucide-react";
import logo from "@/assets/Dishpatch-logo-1.png";
import { publicApi } from "../lib/api";
import { cn } from "../lib/cn";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/Accordion";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const navItems = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "demo", label: "Demo" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" }
];

const trustChips = ["Paystack payments", "Delivery + Pickup", "Real-time orders", "Receipts + Email", "Multi-tenant SaaS"];

const features = [
  {
    icon: Send,
    title: "Shareable ordering link",
    description: "Create one menu link and share it across WhatsApp, Instagram, and bio pages."
  },
  {
    icon: CreditCard,
    title: "Paystack checkout",
    description: "Secure payment initialization, verification, and webhook handling built in."
  },
  {
    icon: Wifi,
    title: "Live orders dashboard",
    description: "Restaurant staff get real-time order updates with Socket.IO powered workflow."
  },
  {
    icon: MailCheck,
    title: "Receipts + confirmations",
    description: "Automatic receipt flow for customers with printable pages and email delivery."
  },
  {
    icon: Smartphone,
    title: "Delivery & pickup support",
    description: "Collect address only when needed and keep pickup checkout friction-free."
  },
  {
    icon: ImageIcon,
    title: "Menu with images",
    description: "Upload food images and show high-conversion item cards to customers."
  }
];

const faqs = [
  {
    question: "Do customers need an account?",
    answer: "No. Customers can browse, order, and pay without creating an account."
  },
  {
    question: "How does Paystack work?",
    answer: "Dishpatch initializes transactions and confirms payment server-side through verify/webhook before marking orders paid."
  },
  {
    question: "Delivery vs pickup?",
    answer: "Restaurants can accept both. Delivery asks for an address, pickup keeps checkout faster."
  },
  {
    question: "Do customers get receipts?",
    answer: "Yes. A receipt page is generated per payment reference and can be printed or shared."
  },
  {
    question: "Can I upload food images?",
    answer: "Yes. Admins can upload item images and customers see them directly on the public menu."
  },
  {
    question: "What happens if payment fails?",
    answer: "The order stays unpaid and can move to failed/expired states based on payment outcome and expiry rules."
  }
];

const heroTypeWords = ["delightful", "real-time", "Paystack-ready", "mobile-first"] as const;

const useAnimatedNumber = (value: number, durationMs = 550): number => {
  const reducedMotion = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      previousRef.current = value;
      return;
    }

    const start = previousRef.current;
    const delta = value - start;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + delta * eased;
      setDisplay(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previousRef.current = value;
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, reducedMotion, value]);

  return display;
};

export const LandingPage = () => {
  const reducedMotion = useReducedMotion() ?? false;
  const [scrolled, setScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [demoSlug, setDemoSlug] = useState<string | null>(null);
  const [demoChecked, setDemoChecked] = useState(false);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [heroWordTypedLength, setHeroWordTypedLength] = useState(reducedMotion ? heroTypeWords[0].length : 0);
  const [heroWordDeleting, setHeroWordDeleting] = useState(false);
  const [heroToastVisible, setHeroToastVisible] = useState(true);
  const [simCount, setSimCount] = useState(0);
  const [simSubtotal, setSimSubtotal] = useState(0);
  const [simToast, setSimToast] = useState<string | null>(null);
  const simToastTimerRef = useRef<number | null>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const rotateXSmooth = useSpring(rotateX, { stiffness: 80, damping: 18 });
  const rotateYSmooth = useSpring(rotateY, { stiffness: 80, damping: 18 });

  const heroActiveWord = heroTypeWords[heroWordIndex] ?? heroTypeWords[0];
  const heroTypedWord = reducedMotion ? heroTypeWords[0] : heroActiveWord.slice(0, heroWordTypedLength);

  const animatedOrderCount = useAnimatedNumber(simCount);
  const animatedSubtotal = useAnimatedNumber(simSubtotal);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const checkDemo = async () => {
      try {
        await publicApi.get("/public/restaurants/taste-of-lagos");
        setDemoSlug("taste-of-lagos");
      } catch {
        setDemoSlug(null);
      } finally {
        setDemoChecked(true);
      }
    };
    void checkDemo();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setHeroWordIndex(0);
      setHeroWordDeleting(false);
      setHeroWordTypedLength(heroTypeWords[0].length);
      return;
    }

    const isWordComplete = heroWordTypedLength === heroActiveWord.length;
    const isWordCleared = heroWordTypedLength === 0;

    const timeoutMs = heroWordDeleting ? 46 : isWordComplete ? 1150 : 78;
    const timeout = window.setTimeout(() => {
      if (!heroWordDeleting && isWordComplete) {
        setHeroWordDeleting(true);
        return;
      }

      if (heroWordDeleting && isWordCleared) {
        setHeroWordDeleting(false);
        setHeroWordIndex((prev) => (prev + 1) % heroTypeWords.length);
        return;
      }

      setHeroWordTypedLength((prev) => prev + (heroWordDeleting ? -1 : 1));
    }, timeoutMs);

    return () => window.clearTimeout(timeout);
  }, [heroActiveWord, heroWordDeleting, heroWordTypedLength, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const interval = window.setInterval(() => setHeroToastVisible((prev) => !prev), 2600);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const handleMockMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ratioX = (x - rect.width / 2) / rect.width;
    const ratioY = (y - rect.height / 2) / rect.height;
    rotateY.set(ratioX * 10);
    rotateX.set(-ratioY * 10);
  };

  const resetMockTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  const onNavClick = (id: string) => {
    setMobileNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  const addSimulationItem = (name: string, price: number) => {
    setSimCount((prev) => prev + 1);
    setSimSubtotal((prev) => prev + price);
    setSimToast(`Added ${name}`);
    if (simToastTimerRef.current) {
      window.clearTimeout(simToastTimerRef.current);
    }
    simToastTimerRef.current = window.setTimeout(() => setSimToast(null), 1600);
  };

  useEffect(() => {
    return () => {
      if (simToastTimerRef.current) {
        window.clearTimeout(simToastTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <motion.header
        initial={reducedMotion ? undefined : { y: -14, opacity: 0 }}
        animate={reducedMotion ? undefined : { y: 0, opacity: 1 }}
        transition={reducedMotion ? undefined : { duration: 0.35, ease: "easeOut" }}
        className={cn(
          "sticky top-0 z-50 border-b transition-all duration-200",
          scrolled ? "border-border bg-background/80 backdrop-blur-md" : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Dishpatch" className="h-8 w-auto" />
            <span className="text-base font-semibold tracking-tight">Dishpatch</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavClick(item.id)}
                className="group relative text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-accent transition-transform duration-200 group-hover:scale-x-100" />
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </div>

          <Button size="sm" variant="secondary" className="md:hidden" onClick={() => setMobileNavOpen((prev) => !prev)}>
            <Menu className="h-4 w-4" />
            Menu
          </Button>
        </div>

        <AnimatePresence>
          {mobileNavOpen ? (
            <motion.div
              initial={reducedMotion ? undefined : { opacity: 0, height: 0 }}
              animate={reducedMotion ? undefined : { opacity: 1, height: "auto" }}
              exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-border bg-card md:hidden"
            >
              <div className="space-y-2 px-4 py-3">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavClick(item.id)}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button asChild className="flex-1" variant="secondary">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link to="/register">Get started</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-10 pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <Reveal className="space-y-6">
            <Badge variant="info" className="text-[10px]">
              Built for Nigerian restaurants
            </Badge>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Online ordering for restaurants
              <span className="block text-primary">fast, secure, and</span>
              <span className="inline-flex min-h-[1.3em] min-w-[14ch] items-center text-primary">
                {heroTypedWord}
                {!reducedMotion ? (
                  <span aria-hidden className="ml-1 inline-block h-[1em] w-[2px] animate-pulse rounded-sm bg-primary" />
                ) : null}
              </span>
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Create a shareable menu link, accept Paystack payments, and manage orders in real time. Dishpatch is built for practical restaurant operations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Create your restaurant link
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {demoSlug ? (
                <Button asChild size="lg" variant="secondary">
                  <Link to={`/r/${demoSlug}`}>View demo menu</Link>
                </Button>
              ) : (
                <Button size="lg" variant="secondary" disabled={!demoChecked} title="Demo coming soon">
                  {demoChecked ? "Demo coming soon" : "Checking demo..."}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-4 pt-1 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Paystack-ready
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Real-time dashboard
              </div>
              <div className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Mobile-first ordering
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="relative">
            <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_top_right,rgba(59,146,52,0.22),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(1,82,146,0.25),transparent_54%)] blur-xl" />
            <motion.div
              onMouseMove={handleMockMouseMove}
              onMouseLeave={resetMockTilt}
              style={reducedMotion ? undefined : { rotateX: rotateXSmooth, rotateY: rotateYSmooth, transformPerspective: 1000 }}
              className="relative rounded-3xl border border-border bg-card p-5 shadow-card"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Dishpatch Dashboard</p>
                <Badge variant="success">Live</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <motion.div
                  animate={reducedMotion ? undefined : { y: [0, -6, 0] }}
                  transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.4, ease: "easeInOut" }}
                  className="rounded-2xl border border-border bg-muted/30 p-3"
                >
                  <p className="text-xs text-muted-foreground">Paid orders</p>
                  <p className="mt-1 text-xl font-bold text-primary">24</p>
                </motion.div>
                <motion.div
                  animate={reducedMotion ? undefined : { y: [0, 6, 0] }}
                  transition={reducedMotion ? undefined : { repeat: Infinity, duration: 3.8, ease: "easeInOut" }}
                  className="rounded-2xl border border-border bg-muted/30 p-3"
                >
                  <p className="text-xs text-muted-foreground">Revenue today</p>
                  <p className="mt-1 text-xl font-bold text-accent">₦128,400</p>
                </motion.div>
              </div>
              <div className="mt-3 rounded-2xl border border-border bg-muted/25 p-3">
                <p className="text-xs text-muted-foreground">Customer menu preview</p>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">Jollof Rice</p>
                    <p className="text-xs text-muted-foreground">Ready in 25 mins</p>
                  </div>
                  <p className="text-sm font-bold text-primary">₦3,200</p>
                </div>
              </div>
              <AnimatePresence>
                {heroToastVisible ? (
                  <motion.div
                    initial={reducedMotion ? undefined : { opacity: 0, y: 14 }}
                    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
                    className="absolute -right-2 -top-3 rounded-xl border border-primary/35 bg-primary/15 px-3 py-2 text-xs font-medium text-brand-100 shadow-soft"
                  >
                    New paid order received
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-10">
          <RevealStagger className="flex flex-wrap gap-2" stagger={0.1}>
            {trustChips.map((chip) => (
              <span key={chip} className="card-hover rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {chip}
              </span>
            ))}
          </RevealStagger>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 pb-14">
          <Reveal className="mb-6">
            <h2 className="text-3xl font-black tracking-tight">Features built for speed</h2>
            <p className="mt-2 text-sm text-muted-foreground">Everything needed to launch and run digital orders without operational noise.</p>
          </Reveal>
          <RevealStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" childClassName="h-full" stagger={0.1}>
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="card-hover h-full">
                  <div className="space-y-3">
                    <div className="inline-flex rounded-xl border border-border bg-muted/45 p-2">
                      <Icon className="h-5 w-5 text-primary transition-transform duration-200 group-hover:scale-105" />
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </Card>
              );
            })}
          </RevealStagger>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 pb-14">
          <Reveal className="mb-6">
            <h2 className="text-3xl font-black tracking-tight">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground">Launch in minutes, then let the workflow run itself.</p>
          </Reveal>

          <div className="relative pl-8">
            <Reveal className="pointer-events-none absolute left-[13px] top-0 h-full w-[2px]">
              <div className="h-full w-[2px] rounded-full bg-gradient-to-b from-primary via-accent to-primary" />
            </Reveal>
            <RevealStagger className="space-y-6" stagger={0.1}>
              {[
                { title: "Set up your menu", description: "Create categories, items, pricing, and food images from the admin dashboard." },
                { title: "Share your link", description: "Send your public order page on WhatsApp, Instagram, and customer broadcasts." },
                { title: "Get paid orders instantly", description: "Customers pay with Paystack and your team gets real-time updates immediately." }
              ].map((step, index) => (
                <div key={step.title} className="relative">
                <span className="absolute -left-8 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    {index < 2 ? <ChevronRight className="mt-1 h-5 w-5 text-accent" /> : null}
                  </div>
                </Card>
                </div>
              ))}
            </RevealStagger>
          </div>
        </section>

        <section id="demo" className="mx-auto w-full max-w-7xl px-4 pb-14">
          <Reveal className="mb-6">
            <h2 className="text-3xl font-black tracking-tight">Live demo simulation</h2>
            <p className="mt-2 text-sm text-muted-foreground">A quick interactive preview of how ordering feels in Dishpatch.</p>
          </Reveal>
          <Reveal>
            <Card>
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <RevealStagger className="grid gap-3 sm:grid-cols-2" stagger={0.1}>
                  <button
                    type="button"
                    onClick={() => addSimulationItem("Jollof Rice", 3200)}
                    className="card-hover rounded-2xl border border-border bg-muted/35 p-4 text-left"
                  >
                    <p className="font-semibold">Add Jollof</p>
                    <p className="text-sm text-muted-foreground">₦3,200</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => addSimulationItem("Suya Bowl", 2500)}
                    className="card-hover rounded-2xl border border-border bg-muted/35 p-4 text-left"
                  >
                    <p className="font-semibold">Add Suya</p>
                    <p className="text-sm text-muted-foreground">₦2,500</p>
                  </button>
                </RevealStagger>
                <Reveal>
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">Quick insight</p>
                    <p className="mt-1 text-sm">
                      Every add-to-cart interaction should feel instant and responsive, especially on mobile.
                    </p>
                  </div>
                </Reveal>
              </div>

              <Reveal className="relative rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Simulation status</p>
                <RevealStagger className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border bg-muted/35 p-3">
                    <p className="text-xs text-muted-foreground">Cart count</p>
                    <p className="text-2xl font-bold text-primary">{Math.round(animatedOrderCount)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/35 p-3">
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="text-2xl font-bold text-accent">₦{Math.round(animatedSubtotal).toLocaleString()}</p>
                  </div>
                </RevealStagger>
                <AnimatePresence>
                  {simToast ? (
                    <motion.div
                      initial={reducedMotion ? undefined : { opacity: 0, x: 14 }}
                      animate={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, x: 8 }}
                      className="absolute -top-3 right-3 rounded-lg border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-brand-100"
                    >
                      {simToast}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </Reveal>
            </div>
            </Card>
          </Reveal>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-7xl px-4 pb-14">
          <Reveal className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Pricing</h2>
              <p className="mt-2 text-sm text-muted-foreground">Simple now, scalable later.</p>
            </div>
            <PricingToggle reducedMotion={reducedMotion} />
          </Reveal>
          <RevealStagger className="grid gap-4 md:grid-cols-2" childClassName="h-full" stagger={0.1}>
            <Card className="card-hover h-full">
              <h3 className="text-xl font-semibold">Starter</h3>
              <p className="mt-1 text-sm text-muted-foreground">Portfolio / demo projects</p>
              <p className="mt-4 text-4xl font-black text-primary">₦0</p>
              <p className="mt-1 text-xs text-muted-foreground">Forever free for showcase use.</p>
              <Button className="mt-4 w-full" asChild>
                <Link to="/register">Get started free</Link>
              </Button>
            </Card>

            <Card className="card-hover h-full border-accent/35">
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="mt-1 text-sm text-muted-foreground">For real restaurants</p>
              <p className="mt-4 text-4xl font-black text-accent">Coming soon</p>
              <p className="mt-1 text-xs text-muted-foreground">Advanced onboarding and production billing.</p>
              <Button className="mt-4 w-full" variant="secondary" disabled>
                Join waitlist soon
              </Button>
            </Card>
          </RevealStagger>
          <p className="mt-4 text-sm text-muted-foreground">
            Dishpatch is currently in portfolio/demo mode. Real restaurant onboarding is coming soon.
          </p>
        </section>

        <section id="faq" className="mx-auto w-full max-w-4xl px-4 pb-14">
          <Reveal className="mb-6">
            <h2 className="text-3xl font-black tracking-tight">FAQ</h2>
          </Reveal>
          <Reveal className="rounded-2xl border border-border bg-card/70 p-3 sm:p-4">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-16">
          <Reveal
            className={cn(
              "rounded-3xl border border-border bg-[linear-gradient(130deg,rgba(59,146,52,0.20),rgba(1,82,146,0.18),rgba(59,146,52,0.20))] p-7 sm:p-10",
              reducedMotion ? "" : "animated-gradient"
            )}
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Launch your restaurant link in minutes</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start free, test the full ordering flow, and scale when you are ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link to="/register">
                    Get started free
                    <Rocket className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
};

const Reveal = ({
  children,
  className,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reducedMotion = useReducedMotion() ?? false;

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const RevealStagger = ({
  children,
  className,
  childClassName,
  stagger = 0.1,
  delayChildren = 0
}: {
  children: ReactNode;
  className?: string;
  childClassName?: string;
  stagger?: number;
  delayChildren?: number;
}) => {
  const reducedMotion = useReducedMotion() ?? false;

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const nodes = Children.toArray(children);

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren
          }
        }
      }}
      className={className}
    >
      {nodes.map((child, index) => (
        <motion.div
          key={(typeof child === "object" && child && "key" in child && child.key) ? String(child.key) : `reveal-${index}`}
          variants={{
            hidden: { opacity: 0, y: 18, scale: 0.98 },
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: 0.5,
                ease: "easeOut"
              }
            }
          }}
          className={childClassName}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

const PricingToggle = ({ reducedMotion }: { reducedMotion: boolean }) => {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="inline-flex items-center rounded-2xl border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => setYearly(false)}
        className={cn(
          "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
          !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => setYearly(true)}
        className={cn(
          "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
          yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Yearly
      </button>
      <motion.span
        key={yearly ? "yearly" : "monthly"}
        initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accentBlue-100"
      >
        <Sparkles className="h-3 w-3" />
        {yearly ? "2 months free soon" : "Start monthly"}
      </motion.span>
    </div>
  );
};
