import Link from 'next/link';
import { AppFooter } from '@/components/shared/AppFooter';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Lock, Database, Shield, Zap, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: <Lock className="size-5" />,
    title: 'End-to-End Encrypted',
    desc: 'Sensitive fields are encrypted with Mysten Seal before leaving your browser.',
  },
  {
    icon: <Database className="size-5" />,
    title: 'Stored on Walrus',
    desc: 'Form configs and responses are stored permanently on decentralized Walrus storage.',
  },
  {
    icon: <Shield className="size-5" />,
    title: 'Own Your Data',
    desc: 'You control access. No middlemen. Data lives on-chain, not on our servers.',
  },
  {
    icon: <Zap className="size-5" />,
    title: 'Powered by Sui',
    desc: 'Form ownership and access control enforced by Sui Move smart contracts.',
  },
];

const STEPS = [
  { num: '01', title: 'Build your form', desc: 'Drag-and-drop fields, mark sensitive ones for encryption.' },
  { num: '02', title: 'Publish on-chain', desc: 'Sign once — form config is uploaded to Walrus & registered on Sui.' },
  { num: '03', title: 'Share the link', desc: 'Respondents need no wallet. Answers are Seal-encrypted on submit.' },
  { num: '04', title: 'Decrypt & review', desc: 'Only you (AdminCap holder) can decrypt responses in the dashboard.' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f4fcf7' }}>
      <DashboardHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-[24px] mt-8 px-8 py-20 text-center md:py-28"
          style={{
            background: 'linear-gradient(135deg, #eef8f4 0%, #d4f5ef 50%, #c2ede7 100%)',
            border: '1px solid rgba(145,224,218,0.45)',
          }}
        >
          {/* Decorative blob */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #91e0da 0%, transparent 70%)' }} />

          <div className="relative">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(145,224,218,0.5)', color: '#6c8289' }}>
              Built on Walrus · Sui · Seal
            </div>

            {/* Logo mark */}
            <div className="mt-8 flex justify-center">
              <BrandLogo showWordmark={false} markClassName="size-24" href={null} />
            </div>

            {/* Headline */}
            <h1
              className="mt-6 text-6xl leading-none text-[#124741] md:text-8xl"
              style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontWeight: 700,
                letterSpacing: '-0.055em',
              }}
            >
              WalForm
            </h1>

            <p className="mt-4 text-xl text-[#314e50]"
              style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
              Build forms. Collect responses. Store forever.
            </p>
            <p className="mt-2 text-lg font-bold text-[#124741]"
              style={{ fontFamily: 'var(--font-ui)' }}>
              Your data, encrypted end-to-end, on-chain.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 rounded-[14px] px-6 py-3 font-bold text-white shadow-md transition hover:opacity-90"
                style={{ background: '#124741', fontFamily: 'var(--font-ui)' }}
              >
                Create a Form
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(145,224,218,0.6)] bg-white/70 px-6 py-3 font-bold text-[#124741] backdrop-blur-sm transition hover:bg-white"
                style={{ fontFamily: 'var(--font-ui)' }}
              >
                My Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mt-16">
          <h2
            className="mb-2 text-center text-3xl text-[#124741] md:text-4xl"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.04em' }}
          >
            How it works
          </h2>
          <p className="mb-10 text-center text-sm text-[#6c8289]" style={{ fontFamily: 'var(--font-ui)' }}>
            From builder to encrypted response in four steps.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <article key={step.num} className="hub-card p-6" style={{ fontFamily: 'var(--font-ui)' }}>
                <div
                  className="mb-4 inline-flex items-center justify-center rounded-xl px-3 py-1 text-lg font-black"
                  style={{ background: 'rgba(145,224,218,0.18)', color: '#124741', letterSpacing: '-0.04em' }}
                >
                  {step.num}
                </div>
                <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800 }}>{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6c8289]">{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mt-16 pb-24">
          <h2
            className="mb-10 text-center text-3xl text-[#124741] md:text-4xl"
            style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.04em' }}
          >
            Why WalForm?
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="hub-card flex gap-5 p-6" style={{ fontFamily: 'var(--font-ui)' }}>
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={{ background: 'rgba(145,224,218,0.18)', color: '#124741' }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-[#124741]" style={{ fontWeight: 800 }}>{f.title}</h3>
                  <p className="mt-2 leading-7 text-[#6c8289]">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <AppFooter
        className="border-t !bg-[rgba(244,252,247,0.9)]"
        text="WalForm · Decentralized form platform for encrypted submissions and permanent storage."
      />
    </div>
  );
}
