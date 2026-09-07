"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { clearToken, getCurrentUser, logoutUser } from "@/services/authService"
import { createRfq, getRfqs, submitQuotation } from "@/services/vendorService"
import { VendorQuotationInput, VendorRfq, VendorRfqInput } from "@/types/vendor"

const emptyRfqForm: VendorRfqInput = {
  title: "",
  description: "",
  product_type: "product",
  quantity: 1,
  target_budget: 0,
  delivery_location: "",
  expected_delivery_date: "",
  quote_deadline: "",
  tender_type: "open",
}

const emptyQuoteForm: VendorQuotationInput = {
  unit_price: 0,
  lead_time_days: 7,
  validity_days: 15,
  notes: "",
}

export default function RfqPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [userRole, setUserRole] = useState<"supplier" | "buyer" | "">("")
  const [buyerType, setBuyerType] = useState<"hospital" | "pharmacy" | "ngo" | "clinic" | null>(null)
  const [rfqs, setRfqs] = useState<VendorRfq[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeQuoteRfqId, setActiveQuoteRfqId] = useState<number | null>(null)
  const [rfqForm, setRfqForm] = useState<VendorRfqInput>(emptyRfqForm)
  const [quoteForm, setQuoteForm] = useState<VendorQuotationInput>(emptyQuoteForm)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getCurrentUser()
        setUsername(me.username)
        setUserRole(me.role)
        setBuyerType(me.buyer_type)
        const data = await getRfqs()
        setRfqs(data)
      } catch {
        clearToken()
        router.push("/auth")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const signOut = async () => {
    try {
      await logoutUser()
    } finally {
      clearToken()
      router.push("/auth")
    }
  }

  const myRfqs = useMemo(
    () => rfqs.filter((item) => item.buyer_name === username),
    [rfqs, username]
  )

  const openRfqs = useMemo(
    () => rfqs.filter((item) => item.status === "open" || item.status === "under_review"),
    [rfqs]
  )

  const handleCreateRfq = async () => {
    if (!rfqForm.title.trim() || !rfqForm.description.trim() || !rfqForm.delivery_location.trim()) {
      setMessage("Title, description, and delivery location are required.")
      return
    }

    if (!rfqForm.expected_delivery_date || !rfqForm.quote_deadline) {
      setMessage("Expected delivery date and quote deadline are required.")
      return
    }

    if (rfqForm.quantity < 1 || rfqForm.target_budget <= 0) {
      setMessage("Quantity must be at least 1 and budget must be greater than 0.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      const created = await createRfq(rfqForm, { username, buyerType })
      setRfqs((prev) => [created, ...prev])
      setRfqForm(emptyRfqForm)
      setMessage(`RFQ #${created.id} published for supplier quotation.`)
    } catch {
      setMessage("Could not create RFQ. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitQuotation = async (rfqId: number) => {
    if (quoteForm.unit_price <= 0 || quoteForm.lead_time_days <= 0 || quoteForm.validity_days <= 0) {
      setMessage("Enter valid quote price, lead time, and validity period.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      await submitQuotation(rfqId, quoteForm, { username })
      const data = await getRfqs()
      setRfqs(data)
      setQuoteForm(emptyQuoteForm)
      setActiveQuoteRfqId(null)
      setMessage(`Quotation submitted against RFQ #${rfqId}.`)
    } catch {
      setMessage("Could not submit quotation. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="py-8 md:py-12">
      <div className="health-container space-y-6">
        <header className="glass-card rounded-[22px] p-6 md:p-8">
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--brand)] uppercase">B2B Procurement</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">RFQ and Tender Workspace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)] md:text-base">
            Run institutional procurement with request-for-quotation workflows, deadline-based tendering,
            and supplier quote comparison alongside the existing B2C buy-now module.
          </p>
          <p className="mt-3 text-sm text-[#2f5660]">Signed in as: {username || "..."}</p>
          <p className="text-sm text-[#2f5660]">Role: {userRole || "..."}</p>
          {buyerType ? <p className="text-sm text-[#2f5660]">Buyer Type: {buyerType}</p> : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/vendor/products"
              className="rounded-xl border border-[#9dcdd0] bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-strong)] transition hover:bg-[#f3fcfd]"
            >
              Marketplace
            </Link>
            <Link
              href="/vendor/orders"
              className="rounded-xl border border-[#cbd9f0] bg-white px-4 py-3 text-sm font-semibold text-[#33556b] transition hover:bg-[#f5f9ff]"
            >
              B2C Buy Now
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-3 text-sm font-semibold text-[#3a616b] transition hover:bg-[#f3fbfc]"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {userRole === "buyer" ? (
            <article className="soft-panel rounded-[20px] p-5">
              <h2 className="text-2xl font-extrabold">Publish New RFQ</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Use this for tender-driven B2B procurement instead of the B2C instant-buy flow.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-semibold text-[#2f5560]">Requirement Title</span>
                  <input
                    value={rfqForm.title}
                    onChange={(event) => setRfqForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="ICU ventilator annual supply tender"
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-semibold text-[#2f5560]">Specification / Scope</span>
                  <textarea
                    value={rfqForm.description}
                    onChange={(event) => setRfqForm((prev) => ({ ...prev, description: event.target.value }))}
                    rows={4}
                    placeholder="Mention technical specs, certifications, packaging, service terms, and evaluation notes."
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Type</span>
                  <select
                    value={rfqForm.product_type}
                    onChange={(event) =>
                      setRfqForm((prev) => ({
                        ...prev,
                        product_type: event.target.value as "product" | "service",
                      }))
                    }
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Tender Type</span>
                  <select
                    value={rfqForm.tender_type}
                    onChange={(event) =>
                      setRfqForm((prev) => ({
                        ...prev,
                        tender_type: event.target.value as "open" | "limited" | "reverse",
                      }))
                      
                    }
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  >
                    <option value="open">Open Tender</option>
                    <option value="limited">Limited Tender</option>
                    <option value="reverse">Reverse Auction</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={rfqForm.quantity}
                    onChange={(event) => setRfqForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Target Budget (INR)</span>
                  <input
                    type="number"
                    min={0}
                    value={rfqForm.target_budget}
                    onChange={(event) =>
                      setRfqForm((prev) => ({ ...prev, target_budget: Number(event.target.value) }))
                    }
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-semibold text-[#2f5560]">Delivery Location</span>
                  <input
                    value={rfqForm.delivery_location}
                    onChange={(event) =>
                      setRfqForm((prev) => ({ ...prev, delivery_location: event.target.value }))
                    }
                    placeholder="Hospital central store, Kolkata"
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Quote Deadline</span>
                  <input
                    type="date"
                    value={rfqForm.quote_deadline}
                    onChange={(event) => setRfqForm((prev) => ({ ...prev, quote_deadline: event.target.value }))}
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#2f5560]">Expected Delivery</span>
                  <input
                    type="date"
                    value={rfqForm.expected_delivery_date}
                    onChange={(event) =>
                      setRfqForm((prev) => ({ ...prev, expected_delivery_date: event.target.value }))
                    }
                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleCreateRfq}
                disabled={submitting}
                className="mt-5 rounded-2xl bg-[linear-gradient(90deg,#0f766e_0%,#115e59_100%)] px-4 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(15,118,110,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Publishing..." : "Publish RFQ"}
              </button>
            </article>
          ) : (
            <article className="soft-panel rounded-[20px] p-5">
              <h2 className="text-2xl font-extrabold">Supplier Tender Desk</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Review active tenders, respond with commercial quotations, and compete on price, lead
                time, and quote validity.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Open RFQs" value={openRfqs.length} />
                <MetricCard
                  label="Quotes Submitted"
                  value={rfqs.reduce((sum, item) => sum + item.quotations.filter((quote) => quote.supplier_name === username).length, 0)}
                />
                <MetricCard
                  label="Tender Modes"
                  value={new Set(rfqs.map((item) => item.tender_type)).size}
                />
              </div>
            </article>
          )}

          <article className="soft-panel rounded-[20px] p-5">
            <h2 className="text-2xl font-extrabold">Procurement Modes</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-[#d9ece8] bg-[#f6fffc] p-4">
                <p className="text-sm font-semibold text-[#155e57]">B2B RFQ / Tender</p>
                <p className="mt-1 text-sm text-[#48666f]">
                  Best for institutional buying, negotiated pricing, multi-vendor comparison, and scheduled demand.
                </p>
              </div>
              <div className="rounded-xl border border-[#e4e8f7] bg-[#fafbff] p-4">
                <p className="text-sm font-semibold text-[#324777]">B2C Buy Now</p>
                <p className="mt-1 text-sm text-[#48666f]">
                  Best for repeat purchases and urgent spot buys where the buyer already knows the seller offer.
                </p>
              </div>
            </div>
            {message ? (
              <p className="mt-4 rounded-lg border border-[#d9e8ea] bg-[#f8fdff] px-3 py-2 text-sm text-[#355860]">
                {message}
              </p>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
              Current implementation stores RFQ data in browser storage for module demonstration. Backend tender APIs can replace these helpers later without changing the page structure.
            </p>
          </article>
        </section>

        <section className="soft-panel rounded-[20px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{userRole === "buyer" ? "My RFQs" : "Open Buyer RFQs"}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {userRole === "buyer"
                  ? "Track quotations received against the tenders you published."
                  : "Submit your commercial response to active buyer requirements."}
              </p>
            </div>
            <span className="rounded-full bg-[#eef8f8] px-3 py-1 text-xs font-semibold text-[#0f766e]">
              {loading ? "Loading..." : `${userRole === "buyer" ? myRfqs.length : openRfqs.length} records`}
            </span>
          </div>

          {!loading && (userRole === "buyer" ? myRfqs : openRfqs).length === 0 ? (
            <p className="mt-4 rounded-lg border border-[#d8ecee] bg-[#fbfeff] px-3 py-4 text-sm text-[#4d6972]">
              No RFQ records available yet.
            </p>
          ) : null}

          <div className="mt-4 grid gap-4">
            {(userRole === "buyer" ? myRfqs : openRfqs).map((rfq) => (
              <article key={rfq.id} className="rounded-2xl border border-[#dbe8ea] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{rfq.title}</h3>
                      <span className="rounded-full bg-[#edf7f6] px-2 py-1 text-[11px] font-semibold uppercase text-[#0f766e]">
                        {rfq.tender_type}
                      </span>
                      <span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[11px] font-semibold uppercase text-[#1d4ed8]">
                        {rfq.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{rfq.description}</p>
                  </div>
                  <div className="text-right text-sm text-[#4b6670]">
                    <p>RFQ #{rfq.id}</p>
                    <p>Buyer: {rfq.buyer_name}</p>
                    <p>Deadline: {rfq.quote_deadline}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <InfoPill label="Quantity" value={rfq.quantity} />
                  <InfoPill label="Budget" value={`INR ${rfq.target_budget.toLocaleString()}`} />
                  <InfoPill label="Delivery" value={rfq.expected_delivery_date} />
                  <InfoPill label="Location" value={rfq.delivery_location} />
                </div>

                {userRole === "supplier" ? (
                  <div className="mt-5">
                    {activeQuoteRfqId === rfq.id ? (
                      <div className="grid gap-3 rounded-xl border border-[#dce9f3] bg-[#f8fbff] p-4 md:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                          <span className="font-semibold text-[#2f5560]">Unit Price (INR)</span>
                          <input
                            type="number"
                            min={0}
                            value={quoteForm.unit_price}
                            onChange={(event) =>
                              setQuoteForm((prev) => ({ ...prev, unit_price: Number(event.target.value) }))
                            }
                            className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-semibold text-[#2f5560]">Lead Time (days)</span>
                          <input
                            type="number"
                            min={1}
                            value={quoteForm.lead_time_days}
                            onChange={(event) =>
                              setQuoteForm((prev) => ({ ...prev, lead_time_days: Number(event.target.value) }))
                            }
                            className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-semibold text-[#2f5560]">Quote Validity (days)</span>
                          <input
                            type="number"
                            min={1}
                            value={quoteForm.validity_days}
                            onChange={(event) =>
                              setQuoteForm((prev) => ({ ...prev, validity_days: Number(event.target.value) }))
                            }
                            className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm md:col-span-2">
                          <span className="font-semibold text-[#2f5560]">Commercial Notes</span>
                          <textarea
                            rows={3}
                            value={quoteForm.notes}
                            onChange={(event) => setQuoteForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder="Include payment terms, warranty, installation, or compliance notes."
                            className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                          />
                        </label>
                        <div className="flex gap-2 md:col-span-2">
                          <button
                            type="button"
                            onClick={() => handleSubmitQuotation(rfq.id)}
                            disabled={submitting}
                            className="rounded-xl bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submitting ? "Submitting..." : "Submit Quotation"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveQuoteRfqId(null)
                              setQuoteForm(emptyQuoteForm)
                            }}
                            className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-3 text-sm font-semibold text-[#3a616b]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQuoteRfqId(rfq.id)
                          setQuoteForm(emptyQuoteForm)
                          setMessage("")
                        }}
                        className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
                      >
                        Submit Quote
                      </button>
                    )}
                  </div>
                ) : null}

                <div className="mt-5">
                  <h4 className="text-sm font-bold text-[#24454f]">
                    Quotations Received ({rfq.quotations.length})
                  </h4>
                  {rfq.quotations.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">No quotations submitted yet.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-[#d9e9eb] text-left text-[#4a6872]">
                            <th className="px-2 py-2">Supplier</th>
                            <th className="px-2 py-2">Unit Price</th>
                            <th className="px-2 py-2">Lead Time</th>
                            <th className="px-2 py-2">Validity</th>
                            <th className="px-2 py-2">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rfq.quotations.map((quote) => (
                            <tr key={quote.id} className="border-b border-[#edf5f6] align-top">
                              <td className="px-2 py-2 font-semibold">{quote.supplier_company || quote.supplier_name}</td>
                              <td className="px-2 py-2">INR {quote.unit_price.toLocaleString()}</td>
                              <td className="px-2 py-2">{quote.lead_time_days} days</td>
                              <td className="px-2 py-2">{quote.validity_days} days</td>
                              <td className="px-2 py-2 text-[#4d6972]">{quote.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#d6eaed] bg-[#f8feff] p-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-[#5b7c84] uppercase">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-[#134750]">{value}</p>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#e2ecee] bg-[#fbfeff] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#67818a] uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#284851]">{value}</p>
    </div>
  )
}
