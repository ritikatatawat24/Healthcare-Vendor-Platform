
"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getToken } from "@/services/authService"
import { getPublicRfqs } from "@/services/vendorService"
import { VendorRfq } from "@/types/vendor"
import {
  buyerBenefits,
  formatCompactCurrency,
  heroImage,
  lifecycleSteps,
  mapRfqToTender,
  marketplaceImage,
  navLinks,
  supplierBenefits,
  trustBrands,
} from "@/components/home/landingData"
import {
  AnalyticsIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  GavelIcon,
  GlobeIcon,
  HospitalIcon,
  InventoryIcon,
  InventoryStackIcon,
  PublicGridIcon,
  ShieldIcon,
  VerifiedIcon,
} from "@/components/home/HomeIcons"

export default function PublicLandingPage() {
  const [rfqs, setRfqs] = useState<VendorRfq[]>([])
  const [loadingRfqs, setLoadingRfqs] = useState(true)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadRfqs = async () => {
      try {
        const data = await getPublicRfqs()
        if (isActive) setRfqs(data)
      } catch {
        if (isActive) setRfqs([])
      } finally {
        if (isActive) setLoadingRfqs(false)
      }
    }

    loadRfqs()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    setHasToken(Boolean(getToken()))
  }, [])

  const activeRfqs = useMemo(
    () => rfqs.filter((rfq) => rfq.status === "open" || rfq.status === "under_review"),
    [rfqs]
  )

  const activeBuyerCount = useMemo(
    () => new Set(activeRfqs.map((rfq) => (rfq.buyer_company || rfq.buyer_name).trim().toLowerCase())).size,
    [activeRfqs]
  )

  const totalPipelineValue = useMemo(
    () => activeRfqs.reduce((sum, rfq) => sum + (Number.isFinite(rfq.target_budget) ? rfq.target_budget : 0), 0),
    [activeRfqs]
  )

  const displayedTenders = useMemo(() => activeRfqs.slice(0, 3).map(mapRfqToTender), [activeRfqs])

  const protectedHref = (path: string) =>
    hasToken ? path : `/login?next=${encodeURIComponent(path)}`

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#191c1e] selection:bg-[#dae2ff] selection:text-[#001847]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dbe1ea]/80 bg-white/80 shadow-[0_6px_24px_rgba(25,28,30,0.04)] backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8" aria-label="Primary">
          <div className="flex items-center gap-8 lg:gap-12">
            <Link href="/" className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.04em] text-[#133b81]">
              MedLedger
            </Link>
            <div className="hidden items-center gap-7 text-sm font-medium text-[#6a7284] md:flex">
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href} className="transition-colors duration-200 hover:text-[#0056d2]">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-[#5a6477] transition-colors hover:text-[#0056d2]">
              Login
            </Link>
            <Link href="/register" className="rounded-lg bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,86,210,0.22)] transition hover:opacity-95">
              Register
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-28 md:grid-cols-12 md:items-center md:pb-24 md:pt-32 md:px-8">
        <div className="md:col-span-7">
          <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[1.05] tracking-[-0.05em] md:text-7xl">
            The Future of{" "}
            <span className="bg-gradient-to-r from-[#0040a1] to-[#0056d2] bg-clip-text text-transparent">
              Clinical Sourcing
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[#5d6577] md:text-xl">
            MedLedger transforms healthcare procurement into a seamless, high-performance operation.
            Navigate the marketplace with verified suppliers, live RFQs, and buyer-supplier workflows
            that feel enterprise-ready from day one.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/register?role=buyer" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-8 py-4 text-sm font-bold text-white shadow-[0_18px_38px_rgba(0,86,210,0.22)] transition hover:scale-[1.02]">
              Register as Buyer
            </Link>
            <Link href="/register?role=supplier" className="inline-flex items-center justify-center rounded-xl bg-[#e6e8ea] px-8 py-4 text-sm font-bold text-[#191c1e] transition hover:bg-[#dde1e5]">
              Join as Supplier
            </Link>
          </div>
        </div>

        <div className="relative md:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#0d1b2e] shadow-[0_30px_60px_rgba(0,0,0,0.18)]">
            <Image
              src={heroImage}
              alt="Modern clinical sourcing center with blue illuminated interface panels"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0040a1]/35 via-[#0d1b2e]/30 to-transparent" />
            <div className="absolute inset-x-10 top-8 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              Sourcing Center
            </div>
          </div>

          <div className="absolute -bottom-6 left-4 rounded-2xl border border-[#dbe1ea] bg-white px-5 py-4 shadow-[0_20px_45px_rgba(20,27,45,0.12)] md:-left-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dae2ff] text-[#0040a1]">
                <VerifiedIcon />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8790a1]">
                  Verified Leads
                </p>
                <p className="mt-1 text-lg font-extrabold text-[#191c1e]">
                  {loadingRfqs ? "Loading..." : `${activeRfqs.length} Active`}
                </p>
                <p className="text-xs text-[#6a7284]">
                  {loadingRfqs
                    ? "Updating market feed"
                    : activeRfqs.length > 0
                      ? `${activeBuyerCount} buyers | INR ${formatCompactCurrency(totalPipelineValue)} pipeline`
                      : "No live tender activity yet"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f2f4f6] py-12">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <p className="text-center font-[family-name:var(--font-display)] text-[11px] font-black uppercase tracking-[0.32em] text-[#8a90a0]">
            Trusted by 500+ Healthcare Providers
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-xl font-extrabold tracking-[-0.03em] text-[#9aa1af] md:gap-16">
            {trustBrands.map((brand) => (
              <Link key={brand} href={protectedHref("/buyer/dashboard")} className="transition hover:text-[#6f7888]">
                {brand}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="suppliers" className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-24">
        <div className="grid gap-8 md:grid-cols-2">
          <article className="rounded-[2rem] border border-[#eaedf2] bg-white p-10 shadow-[0_20px_45px_rgba(20,27,45,0.05)] transition hover:shadow-[0_24px_60px_rgba(20,27,45,0.08)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0056d2] text-white">
              <HospitalIcon />
            </div>
            <h2 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.03em]">
              For Buyers
            </h2>
            <ul className="mt-6 space-y-4">
              {buyerBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-[#596171]">
                  <span className="text-[#0056d2]">
                    <CheckCircleIcon />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <Link href={protectedHref("/buyer/dashboard")} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#0056d2] transition hover:gap-3">
              Explore Buyer Solutions
              <ArrowRightIcon />
            </Link>
          </article>

          <article className="rounded-[2rem] border border-[#eaedf2] bg-white p-10 shadow-[0_20px_45px_rgba(20,27,45,0.05)] transition hover:shadow-[0_24px_60px_rgba(20,27,45,0.08)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#d5e3fc] text-[#334155]">
              <InventoryIcon />
            </div>
            <h2 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.03em]">
              For Suppliers
            </h2>
            <ul className="mt-6 space-y-4">
              {supplierBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-[#596171]">
                  <span className="text-[#515f74]">
                    <CheckCircleIcon />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <Link href={protectedHref("/supplier/dashboard")} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#515f74] transition hover:gap-3">
              Join Supplier Network
              <ArrowRightIcon />
            </Link>
          </article>
        </div>
      </section>

      <section id="marketplace" className="bg-[#f2f4f6] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-14">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em]">
              Platform Capabilities
            </h2>
            <p className="mt-4 max-w-2xl text-[#5d6577]">
              A comprehensive ecosystem designed to handle every facet of clinical procurement with
              architectural precision.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-4 md:grid-rows-2 md:[grid-auto-rows:minmax(160px,auto)]">
            <article className="relative overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_18px_40px_rgba(20,27,45,0.05)] md:col-span-2 md:row-span-2">
              <div className="relative z-10 max-w-sm">
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-[-0.03em]">
                  B2C Marketplace
                </h3>
                <p className="mt-4 text-sm leading-7 text-[#5d6577]">
                  Instant access to standardized supplies with direct ordering, transparent pricing,
                  and ready-to-ship catalog visibility.
                </p>
              </div>
              <div className="absolute bottom-0 right-0 h-[66%] w-[72%] overflow-hidden rounded-tl-[2rem]">
                <Image
                  src={marketplaceImage}
                  alt="Organized medical marketplace shelves in a modern supply warehouse"
                  fill
                  sizes="(max-width: 768px) 100vw, 35vw"
                  className="object-cover opacity-35 transition duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
              </div>
              <span className="absolute bottom-6 left-6 inline-flex rounded-full bg-[#dae2ff] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#0040a1]">
                Active Now
              </span>
            </article>

            <article className="flex items-center justify-between gap-6 rounded-[2rem] bg-[#e6e8ea] p-8 shadow-[0_18px_40px_rgba(20,27,45,0.04)] md:col-span-2">
              <div className="max-w-sm">
                <h3 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[-0.03em]">
                  RFQ Tendering
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#5d6577]">
                  Complex bidding made simple with multi-vendor comparison, live quotation review,
                  and tender workflows that feel operationally real.
                </p>
              </div>
              <div className="hidden text-[#0056d2]/25 md:block">
                <GavelIcon />
              </div>
            </article>

            <article className="rounded-[1.6rem] bg-white p-8 shadow-[0_18px_40px_rgba(20,27,45,0.04)]">
              <span className="text-[#0056d2]">
                <AnalyticsIcon />
              </span>
              <h3 className="mt-4 font-bold">Compliance Analytics</h3>
              <p className="mt-3 text-xs leading-6 text-[#5d6577]">
                Real-time tracking of sourcing ethics, documentation status, and regulatory signals.
              </p>
            </article>

            <article className="rounded-[1.6rem] bg-white p-8 shadow-[0_18px_40px_rgba(20,27,45,0.04)]">
              <span className="text-[#515f74]">
                <InventoryStackIcon />
              </span>
              <h3 className="mt-4 font-bold">Inventory Control</h3>
              <p className="mt-3 text-xs leading-6 text-[#5d6577]">
                Predictive stock management and supply continuity planning for multi-facility teams.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em]">
              Live Public Tenders
            </h2>
            <p className="mt-4 max-w-2xl text-[#5d6577]">
              Ongoing procurement opportunities across the MedLedger network.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-full bg-[#eef3fb] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#51617a]">
              {loadingRfqs ? "Refreshing" : activeRfqs.length > 0 ? "Live Market Feed" : "Waiting for Live RFQs"}
            </span>
            <Link href={protectedHref("/vendor/rfq")} className="inline-flex items-center gap-2 text-sm font-bold text-[#0056d2] hover:underline">
              View All Active RFQs
              <ArrowRightIcon />
            </Link>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {loadingRfqs ? (
            <div className="rounded-[1.4rem] border border-[#dbe1ea] bg-white px-6 py-8 text-sm text-[#6a7284] shadow-[0_14px_30px_rgba(20,27,45,0.04)]">
              Loading live public tenders...
            </div>
          ) : displayedTenders.length === 0 ? (
            <div className="rounded-[1.4rem] border border-[#dbe1ea] bg-white px-6 py-8 text-sm text-[#6a7284] shadow-[0_14px_30px_rgba(20,27,45,0.04)]">
              No live public tenders are available right now. Real tenders will appear here when
              buyers publish open RFQs.
            </div>
          ) : (
            displayedTenders.map((tender) => (
              <article key={tender.id} className="flex flex-col gap-6 rounded-[1.4rem] border border-transparent bg-white p-6 shadow-[0_14px_30px_rgba(20,27,45,0.04)] transition hover:border-[#d4daea] hover:bg-[#fdfefe] md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#ffefe8] text-sm font-black text-[#a93802]">
                    {tender.initials}
                  </div>
                  <div>
                    <Link href={protectedHref("/vendor/rfq")} className="font-bold transition hover:text-[#0056d2]">
                      {tender.title}
                    </Link>
                    <p className="mt-1 text-sm text-[#6a7284]">
                      Ref: {tender.reference} | {tender.buyer}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8a90a0]">
                      Estimated Value
                    </p>
                    <p className="mt-1 font-bold">{tender.budget}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8a90a0]">
                      Ends In
                    </p>
                    <p className={`mt-1 font-bold ${tender.urgent ? "text-[#ba1a1a]" : "text-[#191c1e]"}`}>
                      {tender.endsIn}
                    </p>
                  </div>
                  <Link href={protectedHref("/vendor/rfq")} className="inline-flex items-center justify-center rounded-lg border-2 border-[#0056d2] px-6 py-2.5 text-sm font-bold text-[#0056d2] transition hover:bg-[#0056d2] hover:text-white">
                    Place Bid
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section id="solutions" className="bg-[#d8dadc] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="text-center">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em]">
              The Procurement Lifecycle
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#5d6577]">
              Three steps to a more efficient, compliant, and cost-effective clinical supply chain.
            </p>
          </div>
          <div className="relative mt-14 grid gap-12 md:grid-cols-3">
            <div className="pointer-events-none absolute left-0 right-0 top-10 hidden border-t-2 border-dashed border-[#a8adbb]/40 md:block" />
            {lifecycleSteps.map((item) => (
              <article key={item.step} className="relative z-10 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#0056d2] text-2xl font-black text-white shadow-[0_18px_35px_rgba(0,86,210,0.2)]">
                  {item.step}
                </div>
                <h3 className="mt-8 font-bold">{item.title}</h3>
                <p className="mx-auto mt-4 max-w-xs text-sm leading-7 text-[#5d6577]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-24">
        <div className="relative overflow-hidden rounded-[2.4rem] bg-[#0056d2] px-8 py-14 text-center text-white shadow-[0_25px_60px_rgba(0,86,210,0.26)] md:px-16 md:py-16">
          <div className="relative z-10">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em] md:text-5xl">
              Ready to Modernize Your
              <br />
              Clinical Supply Chain?
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-5">
              <Link href="/login" className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-black text-[#0040a1] transition hover:scale-[1.02]">
                Create Free Account
              </Link>
              <Link href="mailto:demo@medledger.in?subject=Schedule%20a%20MedLedger%20Demo" className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-[#0040a1] px-8 py-4 text-sm font-black text-white transition hover:bg-[#0b4bbb]">
                Schedule Demo
              </Link>
            </div>
          </div>
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-[family-name:var(--font-display)] text-[9rem] font-black tracking-[-0.08em] text-white/6 md:text-[18rem]">
            MED
          </span>
        </div>
      </section>

      <footer id="resources" className="border-t border-[#d7dce6] bg-[#f2f4f6] px-6 py-12 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-4">
          <div>
            <span className="block font-[family-name:var(--font-display)] text-lg font-black tracking-[-0.03em]">
              MedLedger
            </span>
            <p className="mt-6 text-sm leading-7 text-[#6a7284]">
              Architectural procurement for modern healthcare. Streamlining the global supply chain
              through transparency and verified intelligence.
            </p>
          </div>
          <FooterColumn
            title="Platform"
            links={[
              { href: protectedHref("/vendor/products"), label: "Marketplace" },
              { href: protectedHref("/vendor/rfq"), label: "Tendering System" },
              { href: "#marketplace", label: "Compliance Hub" },
              { href: protectedHref("/supplier/dashboard"), label: "Supplier Verification" },
            ]}
          />
          <FooterColumn
            title="Resources"
            links={[
              { href: "/login", label: "Help Center" },
              { href: protectedHref("/buyer/dashboard"), label: "Buyer Workspace" },
              { href: "#solutions", label: "Sourcing Guide" },
              { href: protectedHref("/supplier/dashboard"), label: "Case Studies" },
            ]}
          />
          <FooterColumn
            title="Legal"
            compact
            links={[
              { href: "mailto:legal@medledger.in?subject=Privacy%20Policy", label: "Privacy Policy" },
              { href: "mailto:legal@medledger.in?subject=Terms%20of%20Service", label: "Terms of Service" },
              { href: "mailto:legal@medledger.in?subject=Compliance", label: "Compliance" },
              { href: "mailto:legal@medledger.in?subject=Global%20Sourcing", label: "Global Sourcing" },
            ]}
          />
        </div>
        <div className="mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-6 border-t border-[#d7dce6] pt-8 md:flex-row">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8a90a0]">
            (c) 2024 MedLedger Architectural Procurement. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-[#9aa1af]">
            <Link href="#resources" className="transition hover:text-[#0056d2]" aria-label="Resources">
              <GlobeIcon />
            </Link>
            <Link href="#marketplace" className="transition hover:text-[#0056d2]" aria-label="Platform">
              <PublicGridIcon />
            </Link>
            <Link href="mailto:security@medledger.in" className="transition hover:text-[#0056d2]" aria-label="Security">
              <ShieldIcon />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

function FooterColumn({
  title,
  links,
  compact = false,
}: {
  title: string
  links: { href: string; label: string }[]
  compact?: boolean
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0056d2]">{title}</h3>
      <div className={`mt-6 space-y-4 ${compact ? "text-xs font-semibold uppercase tracking-[0.16em]" : "text-sm"} text-[#6a7284]`}>
        {links.map((link) => (
          <Link key={link.label} href={link.href} className="block transition hover:text-[#0056d2]">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
