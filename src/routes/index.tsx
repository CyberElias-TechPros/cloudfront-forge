import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  CirclePlay,
  Eye,
  Gauge,
  ListChecks,
  MessageCircle,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/page-parts";
import { AdSlot } from "@/components/ad-slot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoopSquad — Real creator feedback, in a fair loop" },
      {
        name: "description",
        content:
          "LoopSquad is the fair, human-powered growth loop for YouTube creators: watch thoughtfully, give useful feedback, and build momentum together.",
      },
      { property: "og:title", content: "LoopSquad — Real creator feedback, in a fair loop" },
      {
        property: "og:description",
        content:
          "A human-powered creator feedback loop designed for real watch time, honest comments, and balanced growth.",
      },
    ],
  }),
  component: Landing,
});

const flow = [
  {
    number: "01",
    icon: ListChecks,
    title: "Bring your signal",
    short: "Submit one video and tell the squad what kind of feedback will move it forward.",
    detail:
      "Your video enters a deliberate rotation instead of disappearing into a noisy link dump.",
    label: "YOUR VIDEO",
  },
  {
    number: "02",
    icon: Eye,
    title: "Show up for theirs",
    short: "Watch with intention. The loop measures real attention, not empty clicks.",
    detail:
      "Player time, attention checks, and server-side claim rules protect the exchange for everyone.",
    label: "VERIFIED ATTENTION",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Leave something useful",
    short: "Add a genuine comment or structured review that a creator can actually use.",
    detail:
      "Feedback is a contribution, not a checkbox. The best loops make every creator sharper.",
    label: "HUMAN FEEDBACK",
  },
  {
    number: "04",
    icon: Trophy,
    title: "Compound the momentum",
    short: "Earn trust, unlock better rotation, and build a body of work with your people.",
    detail: "XP, streaks, missions, insights, and a transparent ledger make progress feel visible.",
    label: "SHARED MOMENTUM",
  },
] as const;

const principles = [
  {
    icon: ShieldCheck,
    kicker: "01 / TRUST",
    title: "Proof over promises.",
    body: "Every meaningful action is validated by the API. Rewards are ledgered once, permissions stay server-side, and the rules are visible before you commit.",
  },
  {
    icon: Gauge,
    kicker: "02 / RHYTHM",
    title: "A loop with balance.",
    body: "Fair rotation, give-to-take signals, and contribution-aware queues keep attention moving toward creators who keep showing up.",
  },
  {
    icon: Sparkles,
    kicker: "03 / CRAFT",
    title: "Feedback that compounds.",
    body: "Turn scattered reactions into a repeatable practice: learn what resonates, ship again, and let your squad see the arc.",
  },
];

function Landing() {
  const [activeStep, setActiveStep] = useState(1);
  const currentStep = flow[activeStep - 1] ?? flow[0];
  const CurrentIcon = currentStep.icon;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step % flow.length) + 1);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="landing-page">
      <section className="hero-stage">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-aurora hero-aurora-one" aria-hidden="true" />
        <div className="hero-aurora hero-aurora-two" aria-hidden="true" />
        <div className="hero-noise" aria-hidden="true" />

        <Shell className="relative z-10 pb-16 pt-8 sm:pb-24 sm:pt-12 lg:pb-28 lg:pt-20">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            <span className="signal-dot" aria-hidden="true" />
            Creator growth, with a conscience
            <span className="hidden h-px w-16 bg-border sm:block" aria-hidden="true" />
            <span className="hidden text-foreground/50 sm:inline">A / 01</span>
          </div>

          <div className="mt-12 grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.82fr)] lg:gap-16">
            <div className="max-w-3xl">
              <p className="hero-kicker">The fair feedback loop for creators</p>
              <h1 className="hero-title mt-5">
                Make work
                <br />
                <span className="hero-title-accent">worth showing.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                LoopSquad turns creator support into a practice: real watch time, useful feedback,
                and momentum you can feel. No empty clicks. No growth theater.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to="/auth/signin" className="button-primary group">
                  Enter the loop
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <a href="#how-it-works" className="button-quiet group">
                  <CirclePlay className="size-4 text-accent" />
                  See the rhythm
                  <ArrowDownRight className="size-4 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" />
                </a>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="size-4 text-accent" /> Server-verified actions
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4 text-accent" /> Built for small squads
                </span>
              </div>
            </div>

            <div className="hero-visual" aria-label="A preview of the LoopSquad feedback loop">
              <div className="hero-visual-glow" aria-hidden="true" />
              <div className="hero-orbit hero-orbit-outer" aria-hidden="true" />
              <div className="hero-orbit hero-orbit-inner" aria-hidden="true" />
              <div className="hero-core">
                <Zap className="size-6 text-primary-foreground" />
              </div>
              <div className="hero-pulse hero-pulse-one" aria-hidden="true" />
              <div className="hero-pulse hero-pulse-two" aria-hidden="true" />

              <div className="signal-card signal-card-top">
                <span className="signal-card-label">LIVE SIGNAL</span>
                <span className="mt-2 block font-display text-3xl leading-none text-foreground">
                  02:14
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  verified attention
                </span>
              </div>
              <div className="signal-card signal-card-bottom">
                <span className="grid size-8 place-items-center rounded-full bg-accent/15 text-accent">
                  <MessageCircle className="size-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-foreground">
                    Feedback landed
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    human, not hollow
                  </span>
                </span>
                <BadgeCheck className="ml-auto size-4 text-success" />
              </div>
              <div className="hero-visual-caption">
                <span>LOOP / 04</span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-accent">IN MOTION</span>
              </div>
            </div>
          </div>

          <div className="mt-20 border-y border-border/60 py-4 sm:mt-24">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <span className="text-accent">Attention is a currency</span>
              <span>watch thoughtfully</span>
              <span>feedback generously</span>
              <span>grow together</span>
              <span className="hidden text-foreground/50 sm:inline">loop / loop / loop</span>
            </div>
          </div>
        </Shell>
      </section>

      <Shell className="relative z-10 pb-10 pt-20 sm:pb-16 sm:pt-28">
        <section id="how-it-works" className="scroll-mt-28">
          <div className="section-intro max-w-3xl">
            <span className="section-index">A / 02 — THE LOOP</span>
            <h2 className="section-title mt-4">Support that leaves a trace.</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              A better creator community is not louder. It is more intentional. Every step below is
              designed to make the next one feel obvious.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="space-y-2" role="tablist" aria-label="Loop stages">
              {flow.map((step) => {
                const Icon = step.icon;
                const selected = step.number === currentStep.number;
                return (
                  <button
                    key={step.number}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveStep(Number(step.number))}
                    className={`flow-tab ${selected ? "flow-tab-active" : ""}`}
                  >
                    <span className="font-display text-xl text-accent/70">{step.number}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-base font-semibold text-foreground">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {step.short}
                      </span>
                    </span>
                    <Icon className="size-4 shrink-0" />
                  </button>
                );
              })}
            </div>

            <div className="flow-panel">
              <div className="flow-panel-topline">
                <span>{currentStep.label}</span>
                <span className="text-accent">{currentStep.number} / 04</span>
              </div>
              <div className="flow-panel-art" aria-hidden="true">
                <div className="flow-line flow-line-one" />
                <div className="flow-line flow-line-two" />
                <div className="flow-panel-orb">
                  <CurrentIcon className="size-8 text-accent" />
                </div>
                <span className="flow-panel-node node-one">01</span>
                <span className="flow-panel-node node-two">02</span>
                <span className="flow-panel-node node-three">03</span>
              </div>
              <div className="relative z-10 mt-auto max-w-xl">
                <h3 className="text-3xl sm:text-4xl">{currentStep.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                  {currentStep.detail}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-28 sm:mt-36">
          <div className="grid items-end gap-8 border-b border-border/70 pb-8 md:grid-cols-[1fr_auto]">
            <div>
              <span className="section-index">A / 03 — WHY IT HOLDS</span>
              <h2 className="section-title mt-4 max-w-2xl">Growth can feel human again.</h2>
            </div>
            <span className="hidden max-w-xs text-right text-xs uppercase leading-5 tracking-[0.16em] text-muted-foreground md:block">
              Less noise.
              <br />
              More signal.
              <br />
              Better work.
            </span>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[1.5rem] border border-border/70 bg-border/70 md:grid-cols-3">
            {principles.map((principle) => (
              <article key={principle.kicker} className="principle-card group">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-11 place-items-center rounded-full border border-border bg-background text-accent transition-transform duration-500 group-hover:rotate-12">
                    <principle.icon className="size-5" />
                  </span>
                  <span className="section-index">{principle.kicker}</span>
                </div>
                <h3 className="mt-12 text-3xl">{principle.title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{principle.body}</p>
                <MoveUpRight className="mt-10 size-4 text-accent transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </article>
            ))}
          </div>
        </section>

        <AdSlot className="mt-20" />

        <section className="cta-stage mt-20 overflow-hidden rounded-[1.5rem] p-8 sm:p-12 lg:p-16">
          <div className="cta-stage-grid" aria-hidden="true" />
          <div className="relative z-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <span className="section-index text-accent">A / 04 — BEGIN</span>
              <h2 className="mt-5 max-w-3xl text-4xl leading-[0.95] sm:text-6xl">
                Your next upload deserves a better room.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                Bring the work. Bring the curiosity. We will take care of the rhythm that turns a
                group of creators into a growth system.
              </p>
            </div>
            <Link to="/auth/signin" className="button-primary group shrink-0">
              Start your loop
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </Shell>
    </div>
  );
}
