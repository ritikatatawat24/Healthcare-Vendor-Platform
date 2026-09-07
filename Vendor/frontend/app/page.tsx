import Link from "next/link"

const workflow = [
  "Vendor registers as organization type Vendor",
  "Admin verifies licenses and tax documents",
  "Vendor publishes products and services",
  "Buyer chooses B2C buy-now or B2B RFQ tender flow",
  "Suppliers respond with quotations for RFQs",
  "Payment is processed in secure payment module",
  "Vendor confirms dispatch and completes delivery",
  "Payout is initiated after buyer confirmation",
]

const capabilities = [
  {
    title: "B2C Marketplace",
    desc: "Medical equipment, medicines, and ambulance support through instant purchase flow.",
    href: "/vendor/products",
  },
  {
    title: "B2C Orders",
    desc: "Track status from placement to dispatch and delivery handoff.",
    href: "/vendor/orders",
  },
  {
    title: "RFQ Tendering",
    desc: "Create buyer RFQs and collect supplier quotations for negotiated B2B procurement.",
    href: "/vendor/rfq",
  },
  {
    title: "Inventory and Compliance",
    desc: "Stock-ready listings with verification states for safer procurement.",
    href: "/vendor/products",
  },
]

export default function Home() {
  return (
    <main className="py-10 md:py-14">
      <div className="health-container space-y-8">
        <section className="glass-card pulse-entry overflow-hidden rounded-[24px] p-8 md:p-12">
          <p className="inline-flex rounded-full border border-[#dbe7ff] bg-[#edf3ff] px-3 py-1 text-xs font-semibold tracking-[0.1em] text-[#2563eb] uppercase">
            Healthcare Procurement
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-tight font-extrabold md:text-6xl">
            Vendor Module
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--text-muted)]">
            Build and operate a verified medical marketplace with compliance-aware onboarding,
            product and service listings, RFQ tendering, and complete B2B order lifecycle visibility.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth" className="blue-btn px-5 py-3 text-sm">
              Login or Register
            </Link>
            <Link
              href="/auth?next=%2Fvendor%2Forders"
              className="rounded-xl border border-[#cdd9f4] bg-white px-5 py-3 text-sm font-semibold text-[#1e40af] transition hover:bg-[#f1f5ff]"
            >
              Manage Orders
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {capabilities.map((item, idx) => (
            <Link
              key={item.title}
              href={item.href}
              className="soft-panel pulse-entry block p-5 transition hover:border-[#c2d6ff] hover:shadow-[0_8px_24px_rgba(59,130,246,0.12)]"
              style={{ animationDelay: `${idx * 90}ms` }}
            >
              <h2 className="text-xl font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.desc}</p>
            </Link>
          ))}
        </section>

        <section className="soft-panel rounded-[22px] p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Vendor Workflow</h2>
            <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
              End-to-End
            </span>
          </div>
          <ol className="mt-5 grid gap-3">
            {workflow.map((step, index) => (
              <li key={step} className="rounded-xl border border-[#e0e8f8] bg-[#f8faff] px-4 py-3 text-sm">
                <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e6eeff] text-xs font-bold text-[#1e40af]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  )
}
