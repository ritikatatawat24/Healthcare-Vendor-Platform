"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import BuyerSidebar from "@/components/buyer/BuyerSidebar"
import SupplierSidebar from "@/components/supplier/SupplierSidebar"
import {
  acceptPo,
  clearToken,
  createSubcontractRfq,
  getApiErrorMessage,
  getCurrentUser,
  getOrders,
  getProducts,
  isAuthSessionError,
  makeDummyPayment,
  markOrderReceived,
  markPaymentOverdue,
  logoutUser,
  reorderFromOrder,
  updateOrderTracking,
} from "@/services"
import type { VendorOrder, VendorProductService } from "@/services"

type SupplierOrderFilter = "all" | "pending" | "in_progress" | "shipped" | "completed"

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(toNumber(value))

const shortDate = (value?: string | null) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })
}

const shortDateTime = (value?: string | null) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const readable = (value: string) => value.replaceAll("_", " ")

const orderBucket = (order: VendorOrder): SupplierOrderFilter => {
  if (order.status === "completed" || order.status === "goods_received" || order.delivery_status === "delivered") return "completed"
  if (order.status === "shipped" || order.status === "delivered" || order.delivery_status === "in_transit" || order.delivery_status === "out_for_delivery") return "shipped"
  if (order.status === "processing" || order.status === "ready_to_dispatch" || order.status === "po_accepted" || order.delivery_status === "loaded") return "in_progress"
  return "pending"
}

const orderStatusLabel = (order: VendorOrder) => {
  if (order.status === "po_released") return "Pending"
  if (order.status === "po_accepted") return "Accepted"
  if (order.status === "partially_subcontracted") return "Processing"
  if (order.status === "ready_to_dispatch") return "Ready"
  if (order.status === "goods_received") return "Completed"
  return readable(order.status)
}

const statusChipClass = (order: VendorOrder) => {
  const bucket = orderBucket(order)
  if (bucket === "completed") return "bg-[#dbeafe] text-[#0f4fb6]"
  if (bucket === "shipped") return "bg-[#e0ecff] text-[#1d4ed8]"
  if (bucket === "in_progress") return "bg-[#eef4ff] text-[#2459c4]"
  return "bg-[#f3f7ff] text-[#3b5fb8]"
}

const nextTrackingPayload = (order: VendorOrder): Partial<Pick<VendorOrder, "status" | "delivery_status" | "tracking_note">> | null => {
  if (order.status === "po_accepted") return { status: "processing", delivery_status: "loaded", tracking_note: "Order is being processed by supplier." }
  if (order.status === "processing" || order.status === "partially_subcontracted") return { status: "ready_to_dispatch", delivery_status: "loaded", tracking_note: "Order packed and ready to dispatch." }
  if (order.status === "ready_to_dispatch") return { status: "shipped", delivery_status: "in_transit", tracking_note: "Shipment is in transit." }
  if (order.status === "shipped") return { status: "delivered", delivery_status: "delivered", tracking_note: "Shipment delivered to buyer location." }
  return null
}

const nextActionLabel = (order: VendorOrder) => {
  if (order.status === "po_released") return "Accept PO"
  if (order.status === "po_accepted") return "Start Processing"
  if (order.status === "processing" || order.status === "partially_subcontracted") return "Ready to Dispatch"
  if (order.status === "ready_to_dispatch") return "Mark Shipped"
  if (order.status === "shipped") return "Mark Delivered"
  return ""
}

const orderProductSummary = (order: VendorOrder, products: VendorProductService[]) =>
  order.items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.product)
      return `${product?.name || `Product #${item.product}`} x ${item.quantity}`
    })
    .join(", ") || "No items"

const canMarkReceived = (order: VendorOrder) =>
  order.delivery_status === "delivered" && order.status !== "goods_received" && order.status !== "completed"

const canMakePayment = (order: VendorOrder) => order.payment_status !== "paid"

const canSubcontract = (order: VendorOrder, products: VendorProductService[]) => {
  if (["completed", "cancelled", "shipped", "delivered", "goods_received", "ready_to_dispatch", "partially_subcontracted"].includes(order.status)) return false
  return order.items.some((item) => {
    const product = products.find((p) => p.id === item.product)
    // Show subcontract option only if we don't have enough stock for THIS item
    return product && product.stock < item.quantity
  })
}

const canFlagPaymentOverdue = (order: VendorOrder) =>
  order.payment_status !== "paid" && ["delivered", "goods_received", "completed"].includes(order.status)

const printOrderPdf = (order: VendorOrder, products: VendorProductService[]) => {
  const doc = window.open("", "_blank", "width=900,height=700")
  if (!doc) return

  const items = order.items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.product)
      return `<tr><td>${product?.name || `Product #${item.product}`}</td><td>${item.quantity}</td><td>${money(item.price)}</td><td>${money(item.quantity * item.price)}</td></tr>`
    })
    .join("")

  doc.document.write(`
    <html>
      <head>
        <title>Order HL-ORD-${order.id}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          .head { display: flex; justify-content: space-between; border-bottom: 2px solid #0f4fb6; padding-bottom: 16px; }
          h1 { margin: 0; font-size: 28px; }
          .chip { display: inline-block; margin-top: 10px; padding: 6px 10px; border-radius: 999px; background: #eef4ff; color: #0f4fb6; font-weight: 700; text-transform: capitalize; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 0; }
          .box { border: 1px solid #dbe4ef; border-radius: 12px; padding: 12px; background: #f8fbff; }
          .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
          .value { margin-top: 6px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border-bottom: 1px solid #e5e9f0; padding: 12px; text-align: left; }
          th { background: #f6f8fb; color: #475569; font-size: 12px; text-transform: uppercase; }
          .total { text-align: right; font-size: 22px; font-weight: 800; margin-top: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="float:right;padding:10px 14px;border:0;border-radius:8px;background:#0f4fb6;color:white;font-weight:700;">Download / Save PDF</button>
        <div class="head">
          <div>
            <h1>Supplier Order Report</h1>
            <div class="chip">${orderStatusLabel(order)}</div>
          </div>
          <div>
            <p><strong>Order:</strong> HL-ORD-${order.id}</p>
            <p><strong>Generated:</strong> ${shortDate(new Date().toISOString())}</p>
          </div>
        </div>
        <div class="grid">
          <div class="box"><div class="label">Buyer</div><div class="value">Buyer #${order.buyer}</div></div>
          <div class="box"><div class="label">Buyer Type</div><div class="value">${order.buyer_type || "-"}</div></div>
          <div class="box"><div class="label">Order Date</div><div class="value">${shortDate(order.created_at)}</div></div>
          <div class="box"><div class="label">Delivery Status</div><div class="value">${readable(order.delivery_status)}</div></div>
          <div class="box"><div class="label">Payment Status</div><div class="value">${readable(order.payment_status)}</div></div>
          <div class="box"><div class="label">Tracking Note</div><div class="value">${order.tracking_note || "No tracking note"}</div></div>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <div class="total">Total Amount: ${money(order.total_amount)}</div>
      </body>
    </html>
  `)
  doc.document.close()
  doc.focus()
}

export default function OrderPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [products, setProducts] = useState<VendorProductService[]>([])
  const [orders, setOrders] = useState<VendorOrder[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [username, setUsername] = useState<string>("")
  const [userRole, setUserRole] = useState<"supplier" | "buyer" | "admin" | "">("")
  const [buyerType, setBuyerType] = useState<string>("")
  const [feedback, setFeedback] = useState<string>("")
  const [orderFilter, setOrderFilter] = useState<SupplierOrderFilter>("all")
  const [orderSearch, setOrderSearch] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [shortageQuantity, setShortageQuantity] = useState<number>(1)

  useEffect(() => {
    const loadData = async () => {
      try {
        const me = await getCurrentUser()
        if (pathname?.startsWith("/buyer") && me.role === "supplier") {
          router.replace("/supplier/orders")
          return
        }
        if (pathname?.startsWith("/supplier") && me.role === "buyer") {
          router.replace("/buyer/orders")
          return
        }
        setUserId(me.id)
        setUsername(me.username)
        setUserRole(me.role)
        setBuyerType(me.buyer_type || "")
        const [productList, orderList] = await Promise.all([getProducts(), getOrders()])
        setProducts(productList)
        setOrders(orderList)
      } catch (error) {
        if (isAuthSessionError(error)) {
          clearToken()
          setFeedback("You are not authenticated. Redirecting to login...")
          router.push(pathname ? `/login?next=${encodeURIComponent(pathname)}` : "/login")
          return
        }

        setFeedback("Could not load orders right now. Check the backend API and try again.")
      }
    }
    loadData()
  }, [pathname, router])

  const signOut = async () => {
    try {
      await logoutUser()
    } finally {
      clearToken()
      router.push("/")
    }
  }

  const isBuyerRoute = pathname?.startsWith("/buyer") || userRole === "buyer"
  const isSupplierRoute = pathname?.startsWith("/supplier") || userRole === "supplier"
  const userOrders = useMemo(() => {
    if (userRole === "buyer") return orders.filter((order) => order.buyer === userId)
    if (userRole === "supplier") return orders.filter((order) => order.vendor_user_id === userId)
    return orders
  }, [orders, userId, userRole])
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? null, [orders, selectedOrderId])
  const orderTabs: Array<{ key: SupplierOrderFilter; label: string; count: number }> = useMemo(
    () => [
      { key: "all", label: "All Orders", count: orders.length },
      { key: "pending", label: "Pending", count: orders.filter((order) => orderBucket(order) === "pending").length },
      { key: "in_progress", label: "In Progress", count: orders.filter((order) => orderBucket(order) === "in_progress").length },
      { key: "shipped", label: "Shipped", count: orders.filter((order) => orderBucket(order) === "shipped").length },
      { key: "completed", label: "Completed", count: orders.filter((order) => orderBucket(order) === "completed").length },
    ],
    [orders]
  )
  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesFilter = orderFilter === "all" || orderBucket(order) === orderFilter
      const searchable = [
        `HL-ORD-${order.id}`,
        `ORD-${order.id}`,
        `Buyer #${order.buyer}`,
        order.buyer_type || "",
        order.status,
        order.delivery_status,
        order.payment_status,
        order.tracking_note,
        orderProductSummary(order, products),
      ]
        .join(" ")
        .toLowerCase()
      return matchesFilter && (!query || searchable.includes(query))
    })
  }, [orderFilter, orderSearch, orders, products])
  const moveOrderForward = async (order: VendorOrder) => {
    try {
      setUpdatingOrderId(order.id)
      setFeedback("")
      const updated =
        order.status === "po_released"
          ? await acceptPo(order.id)
          : await updateOrderTracking(order.id, nextTrackingPayload(order) ?? {})
      setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setFeedback(`Order HL-ORD-${updated.id} updated to ${orderStatusLabel(updated)}.`)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Could not update order tracking."))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const replaceOrder = (updated: VendorOrder) => {
    setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  const runOrderMutation = async (
    order: VendorOrder,
    request: () => Promise<VendorOrder>,
    successMessage: (updated: VendorOrder) => string,
    errorMessage: string
  ) => {
    try {
      setUpdatingOrderId(order.id)
      setFeedback("")
      const updated = await request()
      replaceOrder(updated)
      setFeedback(successMessage(updated))
    } catch (error) {
      setFeedback(getApiErrorMessage(error, errorMessage))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleBuyerReceive = async (order: VendorOrder) => {
    await runOrderMutation(
      order,
      () => markOrderReceived(order.id),
      (updated) => `Order HL-ORD-${updated.id} marked as goods received.`,
      "Could not mark goods as received."
    )
  }

  const handleDummyPayment = async (order: VendorOrder) => {
    await runOrderMutation(
      order,
      () => makeDummyPayment(order.id),
      (updated) => `Dummy payment recorded for order HL-ORD-${updated.id}.`,
      "Could not record dummy payment."
    )
  }

  const handleReorder = async (order: VendorOrder) => {
    try {
      setUpdatingOrderId(order.id)
      setFeedback("")
      const created = await reorderFromOrder(order.id)
      setOrders((prev) => [created, ...prev])
      setSelectedOrderId(created.id)
      setFeedback(`Reorder created as order HL-ORD-${created.id}.`)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Could not create reorder."))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleSubcontract = async (order: VendorOrder) => {
    if (!Number.isInteger(shortageQuantity) || shortageQuantity < 1) {
      setFeedback("Shortage quantity must be a whole number greater than 0.")
      return
    }

    try {
      setUpdatingOrderId(order.id)
      setFeedback("")
      const result = await createSubcontractRfq(order.id, shortageQuantity)
      const refreshed = await getOrders()
      setOrders(refreshed)
      setFeedback(
        `Subcontract RFQ #${result.subcontract_rfq_id} created for order HL-ORD-${order.id}.`
      )
    } catch (error) {
      setFeedback(getApiErrorMessage(error, "Could not create subcontract RFQ."))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleMarkPaymentOverdue = async (order: VendorOrder) => {
    await runOrderMutation(
      order,
      () => markPaymentOverdue(order.id),
      (updated) => `Payment marked overdue for order HL-ORD-${updated.id}.`,
      "Could not mark payment overdue."
    )
  }

  return (
    <>
      {isBuyerRoute ? (
        <BuyerSidebar
          active="orders"
          username={username}
          buyerType={buyerType || null}
          onSignOut={signOut}
        />
      ) : isSupplierRoute ? (
        <SupplierSidebar
          active="orders"
          username={username}
          onSignOut={signOut}
        />
      ) : null}
      <main className={`px-4 py-8 md:px-6 md:py-12 ${(isBuyerRoute || isSupplierRoute) ? "pb-24 lg:pl-[calc(18rem+2.5rem)]" : ""}`}>
        <div className="health-container space-y-6">
          {isSupplierRoute ? (
            <>
              <header>
                <h1 className="text-3xl font-black tracking-[-0.04em] text-[#0f172a]">Supplier Order Management List</h1>
              </header>

              {feedback ? (
                <p className="rounded-xl border border-[#dbe8ff] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#355860]">{feedback}</p>
              ) : null}

              <section className="supplier-orders-panel rounded-xl border border-[#dbe4ef] bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {orderTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setOrderFilter(tab.key)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${orderFilter === tab.key
                          ? "bg-[#dbe8ff] text-[#0f4fb6]"
                          : "text-[#0f172a] hover:bg-[#f6f8fb]"
                          }`}
                      >
                        {tab.label} <span className="text-xs text-[#64748b]">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="flex min-w-0 items-center gap-3 rounded-full border border-[#dbe4ef] bg-white px-4 py-2.5 text-sm text-[#94a3b8] xl:min-w-[360px]">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder="Search by Order ID or Hospital Name..."
                      className="w-full border-0 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                    />
                  </label>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-[#e5e9f0]">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-[#0f172a]">
                      <tr>
                        <th className="px-5 py-4 font-bold">Order ID</th>
                        <th className="px-5 py-4 font-bold">Buyer Name (Hospital)</th>
                        <th className="px-5 py-4 font-bold">Order Date</th>
                        <th className="px-5 py-4 font-bold">Total Amount</th>
                        <th className="px-5 py-4 font-bold">Status</th>
                        <th className="px-5 py-4 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef2f6]">
                      {filteredOrders.map((order) => {
                        return (
                          <tr key={order.id} className="supplier-order-row transition hover:bg-[#fbfcff]">
                            <td className="px-5 py-4 font-bold text-[#0f172a]">HL-ORD-{String(order.id).padStart(4, "0")}</td>
                            <td className="px-5 py-4 font-semibold text-[#0f172a]">Buyer #{order.buyer}</td>
                            <td className="px-5 py-4 text-[#475569]">{shortDate(order.created_at)}</td>
                            <td className="px-5 py-4 text-[#0f172a]">{money(order.total_amount)}</td>
                            <td className="px-5 py-4">
                              <span className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${statusChipClass(order)}`}>
                                {orderStatusLabel(order)}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                {nextActionLabel(order) && order.buyer !== userId ? (
                                  <button
                                    type="button"
                                    onClick={() => moveOrderForward(order)}
                                    disabled={updatingOrderId === order.id}
                                    className="flex items-center gap-2 rounded-lg bg-[#0f4fb6] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1d72ff] disabled:opacity-60"
                                  >
                                    {updatingOrderId === order.id ? "..." : nextActionLabel(order)}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderId(order.id)}
                                  className="rounded-lg border border-[#dbe4ef] bg-white p-2 text-[#64748b] transition hover:border-[#0f4fb6] hover:text-[#0f4fb6]"
                                  aria-label={`View order ${order.id}`}
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => printOrderPdf(order, products)}
                                  className="rounded-lg border border-[#dbe4ef] bg-white p-2 text-[#64748b] transition hover:border-[#0f4fb6] hover:text-[#0f4fb6]"
                                  aria-label={`Download order ${order.id} PDF`}
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M12 3v12" />
                                    <path d="m7 10 5 5 5-5" />
                                    <path d="M5 21h14" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-[#64748b]">No orders matched this filter or search.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

            </>
          ) : (
            <>
              <section className="soft-panel rounded-[20px] p-5">
                <h2 className="text-xl font-bold">My Orders</h2>
                {userOrders.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-[#d8ecee] bg-[#fbfeff] px-3 py-4 text-sm text-[#4d6972]">
                    No orders returned from API yet.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b border-[#d9e9eb] text-left text-[#4a6872]">
                          <th className="px-2 py-2">Order</th>
                          <th className="px-2 py-2">Vendor</th>
                          <th className="px-2 py-2">Buyer</th>
                          <th className="px-2 py-2">Amount</th>
                          <th className="px-2 py-2">Order Status</th>
                          <th className="px-2 py-2">Delivery</th>
                          <th className="px-2 py-2">Payment</th>
                          <th className="px-2 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userOrders.map((order) => (
                          <tr key={order.id} className="border-b border-[#edf5f6]">
                            <td className="px-2 py-2 font-semibold">#{order.id}</td>
                            <td className="px-2 py-2">{order.vendor}</td>
                            <td className="px-2 py-2">{order.buyer}</td>
                            <td className="px-2 py-2">INR {Number(order.total_amount).toLocaleString()}</td>
                            <td className="px-2 py-2">
                              <span className="rounded-full bg-[#e7f8f7] px-2 py-1 text-xs font-semibold text-[#0a6d72] capitalize">
                                {orderStatusLabel(order)}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-xs font-semibold text-[#1d4ed8] capitalize">
                                {readable(order.delivery_status)}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <span className="rounded-full bg-[#fff4e8] px-2 py-1 text-xs font-semibold text-[#b45309] capitalize">
                                {readable(order.payment_status)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderId(order.id)}
                                className="rounded-lg border border-[#dbe4ef] bg-white px-3 py-2 text-xs font-semibold text-[#0f4fb6]"
                              >
                                View Lifecycle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        {selectedOrder ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.48)] px-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#dbe4ef] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f4fb6]">Order Lifecycle</p>
                  <h2 className="mt-1 text-2xl font-black text-[#0f172a]">HL-ORD-{String(selectedOrder.id).padStart(4, "0")}</h2>
                </div>
                <button type="button" onClick={() => setSelectedOrderId(null)} className="rounded-lg border border-[#dbe4ef] px-3 py-2 text-sm font-bold text-[#64748b]">Close</button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoBox label="Buyer" value={`Buyer #${selectedOrder.buyer}`} />
                <InfoBox label="Buyer Type" value={selectedOrder.buyer_type || "Institution"} />
                <InfoBox label="Order Date" value={shortDate(selectedOrder.created_at)} />
                <InfoBox label="Amount" value={money(selectedOrder.total_amount)} />
                <InfoBox label="Order Status" value={orderStatusLabel(selectedOrder)} />
                <InfoBox label="Delivery Status" value={readable(selectedOrder.delivery_status)} />
                <InfoBox label="Payment Status" value={readable(selectedOrder.payment_status)} />
                <InfoBox label="Items" value={orderProductSummary(selectedOrder, products)} />
              </div>

              <div className="mt-4 rounded-xl border border-[#dbe4ef] bg-[#f8fbff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#64748b]">Tracking Note</p>
                <p className="mt-2 text-sm leading-6 text-[#0f172a]">{selectedOrder.tracking_note || "No tracking note yet."}</p>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-2xl border border-[#dbe4ef] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#64748b]">Timeline</h3>
                    <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#0f4fb6]">
                      {selectedOrder.events.length} events
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedOrder.events.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#dbe4ef] px-4 py-5 text-sm text-[#64748b]">
                        Timeline will appear here as the order moves through PO, shipping, receipt, and payment.
                      </p>
                    ) : (
                      selectedOrder.events.map((event) => (
                        <div key={event.id} className="rounded-xl border border-[#e7edf5] bg-[#fbfdff] px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-[#0f172a]">{event.message}</p>
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                              {shortDateTime(event.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#64748b]">
                            {event.actor_name || "System"} {event.actor_role ? `(${readable(event.actor_role)})` : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#dbe4ef] bg-white p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#64748b]">Actions</h3>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => printOrderPdf(selectedOrder, products)} className="rounded-xl bg-[#0f4fb6] px-4 py-3 text-sm font-black text-white">
                      Download PDF
                    </button>

                    {isSupplierRoute && nextActionLabel(selectedOrder) && (selectedOrder.vendor_user_id === userId || selectedOrder.buyer !== userId) ? (
                      <button
                        type="button"
                        onClick={() => moveOrderForward(selectedOrder)}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm font-black text-[#0f4fb6] disabled:opacity-60"
                      >
                        {updatingOrderId === selectedOrder.id ? "Updating..." : nextActionLabel(selectedOrder)}
                      </button>
                    ) : null}

                    {selectedOrder.buyer === userId && canMarkReceived(selectedOrder) ? (
                      <button
                        type="button"
                        onClick={() => handleBuyerReceive(selectedOrder)}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="rounded-xl border border-[#d9e7d1] bg-[#f6fff0] px-4 py-3 text-sm font-black text-[#2d6a2d] disabled:opacity-60"
                      >
                        {updatingOrderId === selectedOrder.id ? "Updating..." : "Mark Goods Received"}
                      </button>
                    ) : null}

                    {selectedOrder.buyer === userId && canMakePayment(selectedOrder) ? (
                      <button
                        type="button"
                        onClick={() => handleDummyPayment(selectedOrder)}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="rounded-xl border border-[#e0dafc] bg-[#f7f3ff] px-4 py-3 text-sm font-black text-[#5b3cc4] disabled:opacity-60"
                      >
                        {updatingOrderId === selectedOrder.id ? "Updating..." : "Make Dummy Payment"}
                      </button>
                    ) : null}

                    {selectedOrder.buyer === userId ? (
                      <button
                        type="button"
                        onClick={() => handleReorder(selectedOrder)}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="rounded-xl border border-[#dbe4ef] bg-white px-4 py-3 text-sm font-black text-[#0f4fb6] disabled:opacity-60"
                      >
                        {updatingOrderId === selectedOrder.id ? "Updating..." : "Reorder"}
                      </button>
                    ) : null}

                    {isSupplierRoute && canFlagPaymentOverdue(selectedOrder) ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaymentOverdue(selectedOrder)}
                        disabled={updatingOrderId === selectedOrder.id}
                        className="rounded-xl border border-[#f7c9c9] bg-[#fff6f6] px-4 py-3 text-sm font-black text-[#b42318] disabled:opacity-60"
                      >
                        {updatingOrderId === selectedOrder.id ? "Updating..." : "Payment Not Received"}
                      </button>
                    ) : null}
                  </div>

                  {isSupplierRoute && canSubcontract(selectedOrder, products) ? (
                    <div className="mt-5 rounded-xl border border-[#dbe4ef] bg-[#f8fbff] p-4">
                      <p className="text-sm font-bold text-[#0f172a]">Need subcontract support?</p>
                      <p className="mt-1 text-sm text-[#64748b]">
                        If you cannot fulfill the full quantity, create a fresh RFQ for the shortage and continue the cycle.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          value={shortageQuantity}
                          onChange={(event) => setShortageQuantity(Number(event.target.value))}
                          className="w-32 rounded-xl border border-[#cde2e5] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f4fb6]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubcontract(selectedOrder)}
                          disabled={updatingOrderId === selectedOrder.id}
                          className="rounded-xl border border-[#dbe4ef] bg-white px-4 py-3 text-sm font-black text-[#0f4fb6] disabled:opacity-60"
                        >
                          {updatingOrderId === selectedOrder.id ? "Creating..." : "Create Subcontract RFQ"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        ) : null}
        <style jsx>{`
        .supplier-orders-hero,
        .supplier-orders-panel {
          position: relative;
          overflow: hidden;
          animation: orders-rise 420ms ease both;
        }

        .supplier-orders-hero::before,
        .supplier-orders-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 0%, rgba(15, 79, 182, 0.05) 45%, transparent 74%);
          opacity: 0;
          transform: translateX(-45%);
          transition: opacity 220ms ease, transform 760ms ease;
        }

        .supplier-orders-hero:hover::before,
        .supplier-orders-panel:hover::before {
          opacity: 1;
          transform: translateX(45%);
        }

        .supplier-orders-panel,
        .supplier-orders-hero,
        .supplier-order-row,
        button,
        input {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease;
        }

        .supplier-orders-panel:hover,
        .supplier-orders-hero:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 54px rgba(15, 23, 42, 0.1);
        }

        .supplier-order-row:hover {
          transform: translateX(2px);
        }

        button:hover {
          transform: translateY(-1px);
        }

        input:focus {
          box-shadow: 0 0 0 4px rgba(15, 79, 182, 0.08);
        }

        @keyframes orders-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      </main>
    </>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe4ef] bg-[#f8fbff] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">{label}</p>
      <p className="mt-2 text-sm font-bold capitalize text-[#0f172a]">{value}</p>
    </div>
  )
}
