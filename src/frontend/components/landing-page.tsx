import Link from "next/link";
import { ThemeControl } from "@/frontend/components/theme-control";

const steps = [
  { number: "01", title: "Share what you know", description: "Offer a skill you enjoy, from coding and design to music and languages." },
  { number: "02", title: "Find your next skill", description: "Connect with people who can help you learn something new." },
  { number: "03", title: "Make time for each other", description: "The exchange uses time credits: one hour of learning equals one credit." },
];
export function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <header className="grid grid-cols-[1fr_auto] items-center gap-3 py-4 sm:flex sm:justify-between sm:py-6">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight sm:text-2xl" aria-label="SkillSwap home">Skill<span className="text-accent">Swap</span></Link>
        <div className="sm:ml-auto"><ThemeControl/></div>
        <nav aria-label="Main navigation" className="col-span-2 flex items-center justify-end gap-1 sm:gap-3"><Link href="/login" className="inline-flex min-h-11 items-center px-2 py-3 text-sm font-semibold sm:px-3">Sign in</Link><Link href="/signup" className="inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-3 py-3 text-sm font-semibold text-white sm:px-4">Join now</Link></nav>
      </header>
      <main>
        <section className="grid items-center gap-8 py-8 sm:gap-10 sm:py-20 lg:grid-cols-2" aria-labelledby="hero-title">
          <div className="min-w-0">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">Learn more. Share what you know.</p>
            <h1 id="hero-title" className="max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Everyone has something to teach.</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-muted">Trade your know-how for a new skill. Find a learning partner, share your experience, and make your time count.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"><Link href="/signup" className="primary-button">Start learning <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-3 h-5 w-5 shrink-0"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link><a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center px-4 py-3 font-semibold text-accent-strong">How it works</a></div>
            <p className="mt-4 text-sm leading-6 text-muted">Start with 3 credits. Teach to earn more, learn through Jitsi or Google Meet, and share feedback after your session.</p>
          </div>
          <aside className="min-w-0 rounded-3xl bg-emerald-900 p-5 text-white sm:p-10" aria-label="Examples of skill exchanges">
            <p className="text-sm uppercase tracking-widest text-emerald-200">A little time. A new possibility.</p>
            <div className="my-8 space-y-4">
              <div className="rounded-2xl bg-white/10 p-5"><p className="text-sm text-emerald-200">You could share</p><p className="mt-2 text-2xl font-semibold">Python basics</p></div>
              <p className="text-center text-2xl" aria-label="Exchange for">↕</p>
              <div className="rounded-2xl bg-white/10 p-5"><p className="text-sm text-emerald-200">You could learn</p><p className="mt-2 text-2xl font-semibold">Guitar chords</p></div>
            </div>
            <p className="text-sm leading-6 text-emerald-100">Illustrative exchange. Everyone can teach and learn; your role depends on the session.</p>
          </aside>
        </section>
        <section id="how-it-works" className="border-t border-line py-12" aria-labelledby="steps-title">
          <h2 id="steps-title" className="text-3xl font-bold tracking-tight">Grow together, one skill at a time.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">{steps.map(step => <article key={step.number} className="rounded-2xl border border-line bg-surface p-6"><p className="text-sm font-bold text-accent">{step.number}</p><h3 className="mt-4 text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-7 text-muted">{step.description}</p></article>)}</div>
        </section>
      </main>
      <footer className="border-t border-line py-6 text-sm leading-6 text-muted">SkillSwap · Learn by sharing your skills</footer>
    </div>
  );
}
