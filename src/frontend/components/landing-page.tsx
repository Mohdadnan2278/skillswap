import Link from "next/link";

const steps = [
  { number: "01", title: "Share what you know", description: "Offer a skill you enjoy, from coding and design to music and languages." },
  { number: "02", title: "Find your next skill", description: "Discover students who can help you learn something new." },
  { number: "03", title: "Make time for each other", description: "The exchange uses time credits: one hour of learning equals one credit." },
];
export function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-6">
        <Link href="/" className="text-2xl font-bold tracking-tight" aria-label="SkillSwap home">Skill<span className="text-emerald-700">Swap</span></Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-3"><Link href="/login" className="px-3 py-3 text-sm font-semibold">Sign in</Link><Link href="/signup" className="rounded-full bg-emerald-800 px-4 py-3 text-sm font-semibold text-white">Join SkillSwap</Link></nav>
      </header>
      <main>
        <section className="grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-2" aria-labelledby="hero-title">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-emerald-700">For students, by students</p>
            <h1 id="hero-title" className="max-w-xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">Everyone has something to teach.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">Trade your know-how for a new skill. Meet fellow students, learn together, and make your time count.</p>
            <a href="#how-it-works" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900">Explore the idea <span aria-hidden="true" className="ml-3">↗</span></a>
            <p className="mt-4 text-sm text-slate-600">In development. Accounts, matching, bookings and credits are available when configured. Jitsi demos, Google Meet links and community feedback are available.</p>
          </div>
          <aside className="rounded-3xl bg-emerald-900 p-7 text-white sm:p-10" aria-label="Examples of skill exchanges">
            <p className="text-sm uppercase tracking-widest text-emerald-200">A little time. A new possibility.</p>
            <div className="my-8 space-y-4">
              <div className="rounded-2xl bg-white/10 p-5"><p className="text-sm text-emerald-200">You could share</p><p className="mt-2 text-2xl font-semibold">Python basics</p></div>
              <p className="text-center text-2xl" aria-label="Exchange for">↕</p>
              <div className="rounded-2xl bg-white/10 p-5"><p className="text-sm text-emerald-200">You could learn</p><p className="mt-2 text-2xl font-semibold">Guitar chords</p></div>
            </div>
            <p className="text-sm leading-6 text-emerald-100">Illustrative exchange. Everyone can teach and learn; your role depends on the session.</p>
          </aside>
        </section>
        <section id="how-it-works" className="border-t border-emerald-900/15 py-12" aria-labelledby="steps-title">
          <h2 id="steps-title" className="text-3xl font-bold tracking-tight">Grow together, one skill at a time.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">{steps.map(step => <article key={step.number} className="rounded-2xl border border-emerald-900/15 bg-white p-6"><p className="text-sm font-bold text-emerald-700">{step.number}</p><h3 className="mt-4 text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-7 text-slate-600">{step.description}</p></article>)}</div>
        </section>
      </main>
      <footer className="border-t border-emerald-900/15 py-6 text-sm text-slate-600">SkillSwap · A college semester project · Learn by sharing your skills</footer>
    </div>
  );
}
