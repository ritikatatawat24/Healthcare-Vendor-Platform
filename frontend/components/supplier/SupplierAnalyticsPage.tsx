"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import SupplierSidebar from "@/components/supplier/SupplierSidebar"
import {
  clearToken,
  getCurrentUser,
  getOrders,
  getProducts,
  getRfqs,
  isAuthSessionError,
  logoutUser,
} from "@/services"
import type { VendorOrder, VendorProductService, VendorRfq } from "@/services"

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const monthLabel = (date: Date) => date.toLocaleDateString("en-IN", { month: "short" })

const orderComplete = (order: VendorOrder) =>
  order.status === "completed" ||
  order.status === "goods_received" ||
  order.status === "delivered" ||
  order.delivery_status === "delivered"

const orderProductName = (productId: number, products: VendorProductService[]) =>
  products.find((product) => product.id === productId)?.name || `Product #${productId}`

const buildPiePath = (cx: number, cy: number, radius: number, start: number, end: number) => {
  const startAngle = (start - 90) * (Math.PI / 180)
  const endAngle = (end - 90) * (Math.PI / 180)
  const x1 = cx + radius * Math.cos(startAngle)
  const y1 = cy + radius * Math.sin(startAngle)
  const x2 = cx + radius * Math.cos(endAngle)
  const y2 = cy + radius * Math.sin(endAngle)
  const largeArc = end - start > 180 ? 1 : 0

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

export default function AnalyticsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [products, setProducts] = useState<VendorProductService[]>([])
  const [rfqs, setRfqs] = useState<VendorRfq[]>([])
  const [username, setUsername] = useState("")
  const [userRole, setUserRole] = useState<"supplier" | "buyer" | "admin" | "">("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setIsLoading(true)
        setError("")
        const me = await getCurrentUser()
        if (me.role === "buyer") {
          router.replace("/buyer/dashboard")
          return
        }
        if (!pathname?.startsWith("/supplier")) {
          router.replace("/supplier/analytics")
          return
        }

        setUsername(me.username)
        setUserRole(me.role)
        const [orderData, productData, rfqData] = await Promise.all([getOrders(), getProducts(), getRfqs()])
        setOrders(orderData)
        setProducts(productData)
        setRfqs(rfqData)
      } catch (error) {
        if (isAuthSessionError(error)) {
          clearToken()
          router.push(pathname ? `/login?next=${encodeURIComponent(pathname)}` : "/login")
          return
        }

        setError("Could not load analytics from backend right now.")
      } finally {
        setIsLoading(false)
      }
    }

    loadAnalytics()
  }, [pathname, router])

  const signOut = async () => {
    try {
      await logoutUser()
    } finally {
      clearToken()
      router.push("/")
    }
  }

  const isSupplierRoute = pathname?.startsWith("/supplier") || userRole === "supplier"

  const spendingTrend = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return { key: monthKey(date), label: monthLabel(date), value: 0 }
    })

    orders.forEach((order) => {
      const created = new Date(order.created_at)
      if (Number.isNaN(created.getTime())) return
      const month = months.find((item) => item.key === monthKey(created))
      if (month) month.value += toNumber(order.total_amount)
    })

    return months
  }, [orders])

  const maxTrend = Math.max(...spendingTrend.map((item) => item.value), 1)
  const trendPoints = spendingTrend.map((item, index) => {
    const x = 36 + index * 118
    const y = 144 - (item.value / maxTrend) * 104
    return { ...item, x, y }
  })
  const trendLine = trendPoints.map((item) => `${item.x},${item.y}`).join(" ")

  const performanceRows = useMemo(() => {
    const revenueByProduct = new Map<number, { name: string; revenue: number; total: number; complete: number }>()

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const current =
          revenueByProduct.get(item.product) ?? {
            name: orderProductName(item.product, products),
            revenue: 0,
            total: 0,
            complete: 0,
          }
        current.revenue += toNumber(item.price) * item.quantity
        current.total += 1
        current.complete += orderComplete(order) ? 1 : 0
        revenueByProduct.set(item.product, current)
      })
    })

    products.forEach((product) => {
      if (!revenueByProduct.has(product.id)) {
        revenueByProduct.set(product.id, {
          name: product.name,
          revenue: 0,
          total: 0,
          complete: 0,
        })
      }
    })

    return Array.from(revenueByProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((item) => {
        const onTime = item.total ? Math.round((item.complete / item.total) * 100) : 0
        const revenueScore = maxTrend ? Math.min(100, Math.round((item.revenue / maxTrend) * 100)) : 0
        return {
          name: item.name,
          onTime,
          quality: Math.max(revenueScore, item.revenue > 0 ? 35 : 0),
        }
      })
  }, [maxTrend, orders, products])

  const categoryBreakdown = useMemo(() => {
    const productCount = products.filter((product) => product.product_type === "product").length
    const serviceCount = products.filter((product) => product.product_type === "service").length
    const tenderCount = rfqs.length
    const orderCount = orders.length
    const base = [
      { label: "Products", value: productCount, color: "#0f4fb6" },
      { label: "Services", value: serviceCount, color: "#7fb2ff" },
      { label: "RFQs", value: tenderCount, color: "#b7cdfa" },
      { label: "Orders", value: orderCount, color: "#dbe8ff" },
    ]
    return base.filter((item) => item.value > 0)
  }, [orders.length, products, rfqs.length])

  const pieTotal = categoryBreakdown.reduce((sum, item) => sum + item.value, 0)
  let pieStart = 0
  const pieSegments = categoryBreakdown.map((item) => {
    const size = pieTotal ? (item.value / pieTotal) * 360 : 0
    const segment = { ...item, start: pieStart, end: pieStart + size }
    pieStart += size
    return segment
  })

  const completedOrders = orders.filter(orderComplete).length
  const totalRevenue = orders.reduce((sum, order) => sum + toNumber(order.total_amount), 0)

  return (
    <>
      {isSupplierRoute ? (
        <SupplierSidebar active="analytics" username={username} onSignOut={signOut} />
      ) : null}
      <main className={`px-4 py-8 md:px-6 md:py-12 ${isSupplierRoute ? "pb-24 lg:pl-[calc(18rem+2.5rem)]" : ""}`}>
        <div className="health-container space-y-5">
          <header className="analytics-card rounded-xl border border-[#dbe4ef] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h1 className="text-2xl font-black tracking-[-0.03em] text-[#0f172a] md:text-3xl">
              Procurement Analytics Dashboard
            </h1>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Total Value" value={money(totalRevenue)} />
              <Metric label="Completed Orders" value={String(completedOrders)} />
              <Metric label="Active RFQs" value={String(rfqs.filter((rfq) => rfq.status === "open" || rfq.status === "under_review").length)} />
            </div>
          </header>

          {error ? (
            <p className="rounded-xl border border-[#fee2e2] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#991b1b]">{error}</p>
          ) : null}

          <section className="analytics-card rounded-xl border border-[#dbe4ef] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h2 className="text-lg font-black text-[#0f172a]">Spending Trends (Last 6 Months)</h2>
            <div className="mt-3 overflow-x-auto">
              <svg viewBox="0 0 670 205" className="min-h-[205px] w-full min-w-[620px]" role="img" aria-label="Spending trends">
                {[0, 1, 2, 3].map((row) => (
                  <line key={row} x1="36" x2="626" y1={40 + row * 35} y2={40 + row * 35} stroke="#e8eef7" strokeWidth="1" />
                ))}
                <path d={`M36 144 L626 144`} stroke="#dbe4ef" strokeWidth="1.4" />
                <polygon points={`36,144 ${trendLine} 626,144`} fill="rgba(15,79,182,0.08)" />
                <polyline points={trendLine} fill="none" stroke="#0f4fb6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="analytics-line" />
                {trendPoints.map((point) => (
                  <g key={point.key}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#0f4fb6" strokeWidth="3" />
                    <text x={point.x} y={point.y - 12} textAnchor="middle" className="fill-[#334155] text-[11px] font-bold">
                      {point.value ? `${Math.round(point.value / 1000)}k` : "0"}
                    </text>
                    <text x={point.x} y="174" textAnchor="middle" className="fill-[#475569] text-[11px] font-bold">
                      {point.label}
                    </text>
                  </g>
                ))}
                <text x="8" y="96" transform="rotate(-90 8 96)" className="fill-[#475569] text-[11px] font-bold">
                  Value
                </text>
                <text x="320" y="198" textAnchor="middle" className="fill-[#475569] text-[11px] font-bold">
                  Months
                </text>
              </svg>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <article className="analytics-card rounded-xl border border-[#dbe4ef] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-black text-[#0f172a]">Supplier Performance</h2>
              <div className="mt-4 h-[250px] overflow-x-auto">
                <div className="flex h-full min-w-[560px] items-end gap-5 border-b border-[#dbe4ef] px-2 pb-8">
                  {performanceRows.length ? performanceRows.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-[170px] items-end gap-2">
                        <span className="w-5 rounded-t-md bg-[#0f4fb6] transition-all duration-700" style={{ height: `${Math.max(item.onTime, 4)}%` }} title={`On-time ${item.onTime}%`} />
                        <span className="w-5 rounded-t-md bg-[#9fc5ff] transition-all duration-700" style={{ height: `${Math.max(item.quality, 4)}%` }} title={`Quality ${item.quality}%`} />
                      </div>
                      <p className="line-clamp-2 h-8 max-w-[82px] text-center text-[11px] font-bold text-[#0f172a]">{item.name}</p>
                    </div>
                  )) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#64748b]">
                      No product movement available yet.
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-center gap-5 text-xs font-bold text-[#475569]">
                <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#0f4fb6]" /> On-Time Delivery (%)</span>
                <span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#9fc5ff]" /> Value Score</span>
              </div>
            </article>

            <article className="analytics-card rounded-xl border border-[#dbe4ef] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-black text-[#0f172a]">Category Breakdown</h2>
              <div className="mt-3 flex justify-center">
                <svg viewBox="0 0 220 220" className="h-[220px] w-[220px]" role="img" aria-label="Category breakdown">
                  {pieSegments.length ? pieSegments.map((segment) => (
                    <path key={segment.label} d={buildPiePath(110, 110, 78, segment.start, segment.end)} fill={segment.color} className="analytics-pie" />
                  )) : (
                    <circle cx="110" cy="110" r="78" fill="#edf3ff" />
                  )}
                  <circle cx="110" cy="110" r="38" fill="white" />
                  <text x="110" y="106" textAnchor="middle" className="fill-[#0f172a] text-[18px] font-black">{pieTotal}</text>
                  <text x="110" y="124" textAnchor="middle" className="fill-[#64748b] text-[10px] font-bold">records</text>
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(categoryBreakdown.length ? categoryBreakdown : [{ label: "No data", value: 0, color: "#edf3ff" }]).map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    {item.label} {item.value}
                  </div>
                ))}
              </div>
            </article>
          </section>

          {isLoading ? (
            <div className="rounded-xl border border-[#dbe4ef] bg-[#f8fbff] px-4 py-6 text-center text-sm font-semibold text-[#64748b]">
              Loading live analytics...
            </div>
          ) : null}
        </div>
        <style jsx>{`
          .analytics-card {
            position: relative;
            overflow: hidden;
            animation: analytics-rise 420ms ease both;
            transition: transform 180ms ease, box-shadow 180ms ease;
          }

          .analytics-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(110deg, transparent 0%, rgba(15, 79, 182, 0.05) 46%, transparent 78%);
            opacity: 0;
            transform: translateX(-42%);
            transition: opacity 220ms ease, transform 760ms ease;
          }

          .analytics-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 22px 54px rgba(15, 23, 42, 0.1);
          }

          .analytics-card:hover::before {
            opacity: 1;
            transform: translateX(42%);
          }

          .analytics-line {
            stroke-dasharray: 900;
            stroke-dashoffset: 900;
            animation: draw-line 1100ms ease forwards;
          }

          .analytics-pie {
            transition: transform 180ms ease, filter 180ms ease;
            transform-origin: center;
          }

          .analytics-pie:hover {
            transform: scale(1.025);
            filter: drop-shadow(0 8px 12px rgba(15, 79, 182, 0.16));
          }

          @keyframes analytics-rise {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes draw-line {
            to {
              stroke-dashoffset: 0;
            }
          }
        `}</style>
      </main>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe8ff] bg-[#f8fbff] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5b6b85]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#0f172a]">{value}</p>
    </div>
  )
}
