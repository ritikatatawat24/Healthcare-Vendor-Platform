"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, type ChangeEvent, useEffect, useMemo, useState } from "react"
import BuyerSidebar from "@/components/buyer/BuyerSidebar"
import SupplierSidebar from "@/components/supplier/SupplierSidebar"
import {
  awardQuotation,
  clearToken,
  closeRfq,
  createOrder,
  createRfq,
  deleteRfq,
  editQuotation,
  getApiErrorMessage,
  getCurrentUser,
  getPublicRfqs,
  getProducts,
  getRfqs,
  getToken,
  getUniqueVendorsFromProducts,
  isAuthSessionError,
  rejectQuotation,
  reopenRfq,
  submitQuotation,
  updateRfq,
  logoutUser,
} from "@/services"
import type { VendorProductService, VendorQuotationInput, VendorRfq, VendorRfqInput } from "@/services"
import { notifyUser } from "@/services/utils/notificationService"

const emptyRfqForm: VendorRfqInput = {
  title: "",
  description: "",
  product_type: "product",
  quantity: 1,
  target_budget: 0,
  delivery_location: "",
  expected_delivery_date: "",
  quote_deadline: "",
  tender_document: null,
  tender_document_note: "",
  remove_tender_document: false,
  tender_type: "open",
  invited_vendors: [],
}

const emptyQuoteForm: VendorQuotationInput = {
  product_id: 0,
  unit_price: 0,
  lead_time_days: 7,
  validity_days: 15,
  notes: "",
}

const getToday = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const formatDisplayDate = (value: string) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatDisplayDateTime = (value?: string | null) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatBuyerType = (value: VendorRfq["buyer_type"]) => {
  if (!value) return "Institution"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const formatTenderType = (value: VendorRfq["tender_type"]) => {
  if (value === "open") return "Open Tender"
  if (value === "limited") return "Limited Tender"
  return "Reverse Auction"
}

const formatRfqStatus = (value: VendorRfq["status"]) => {
  if (value === "under_review") return "Under Review"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const getDeadlineLabel = (value: string, status: VendorRfq["status"]) => {
  if (status === "closed") return "Closed by buyer"
  if (status === "awarded") return "Award completed"
  if (!value) return "Deadline not set"
  const today = new Date(getToday())
  const deadline = new Date(value)
  if (Number.isNaN(deadline.getTime())) return `Closes ${value}`

  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return "Closed"
  if (diffDays === 0) return "Closes today"
  if (diffDays === 1) return "Closes in 1 day"
  return `Closes in ${diffDays} days`
}



export default function RfqPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f9fa]" />}>
      <RfqPageContent />
    </Suspense>
  )
}

function RfqPageContent() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [userRole, setUserRole] = useState<"supplier" | "buyer" | "admin" | "">("")
  const [buyerType, setBuyerType] = useState<"hospital" | "pharmacy" | "ngo" | "clinic" | null>(null)
  const [products, setProducts] = useState<VendorProductService[]>([])
  const [rfqs, setRfqs] = useState<VendorRfq[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeQuoteRfqId, setActiveQuoteRfqId] = useState<number | null>(null)
  const [recentlyPublishedRfqId, setRecentlyPublishedRfqId] = useState<number | null>(null)
  const [expandedRfqIds, setExpandedRfqIds] = useState<number[]>([])
  const [requestFilter, setRequestFilter] = useState<"all" | "my_rfqs" | VendorRfq["status"]>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [tenderTypeFilter, setTenderTypeFilter] = useState<"all" | VendorRfq["tender_type"]>("all")
  const [sortBy, setSortBy] = useState<"latest" | "oldest" | "budget_high" | "budget_low" | "deadline_nearest">("latest")
  const [rfqForm, setRfqForm] = useState<VendorRfqInput>(emptyRfqForm)
  const [quoteForm, setQuoteForm] = useState<VendorQuotationInput>(emptyQuoteForm)
  const [editingRfqId, setEditingRfqId] = useState<number | null>(null)
  const [editingQuotationContext, setEditingQuotationContext] = useState<{ rfqId: number; quotationId: number } | null>(null)
  const [editingQuoteForm, setEditingQuoteForm] = useState<VendorQuotationInput>(emptyQuoteForm)
  const [rejectModal, setRejectModal] = useState<{
    open: boolean
    rfqId: number | null
    quotationId: number | null
    reason: string
  }>({
    open: false,
    rfqId: null,
    quotationId: null,
    reason: '',
  })

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    rfqId: number | null
  }>({
    open: false,
    rfqId: null,
  })
  const hasAuthToken = () => Boolean(getToken())

  const handleTenderDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) {
      setRfqForm((prev) => ({ ...prev, tender_document: null }))
      return
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Only PDF files are allowed for tender documents.")
      event.target.value = ""
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("Tender PDF must be 10 MB or smaller.")
      event.target.value = ""
      return
    }

    setMessage("")
    setRfqForm((prev) => ({ ...prev, tender_document: file, remove_tender_document: false }))
  }

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getCurrentUser()
        if (pathname?.startsWith("/buyer") && me.role === "supplier") {
          router.replace("/supplier/rfq")
          return
        }
        if (pathname?.startsWith("/supplier") && me.role === "buyer") {
          router.replace("/buyer/rfq")
          return
        }
        setUsername(me.username)
        setUserRole(me.role)
        setBuyerType(me.buyer_type)
      } catch (error) {
        if (!isAuthSessionError(error)) {
          setMessage("Could not verify your session right now. Check whether the backend API is running.")
          setLoading(false)
          return
        }

        clearToken()
        if (pathname?.startsWith("/buyer")) {
          router.push("/login?next=%2Fbuyer%2Frfq")
          return
        }
        setUsername("")
        setUserRole("")
        setBuyerType(null)
        setProducts([])
        try {
          const rfqData = await getPublicRfqs()
          setRfqs(rfqData)
        } catch {
          setRfqs([])
        } finally {
          setLoading(false)
        }
        return
      }

      try {
        const [rfqData, productData] = await Promise.all([getRfqs(), getProducts()])
        setRfqs(rfqData)
        setProducts(productData)
      } catch (error) {
        setMessage(getApiErrorMessage(error, "Could not load the RFQ workspace. Your login is still active; please refresh or try again."))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [pathname, router])

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const data = hasAuthToken() ? await getRfqs() : await getPublicRfqs()
        setRfqs(data)
      } catch {
        // Keep silent during background refresh.
      }
    }, 20000)

    return () => window.clearInterval(interval)
  }, [userRole])

  // Handle highlight parameter from search
  useEffect(() => {
    const highlightId = searchParams.get("highlight")
    if (highlightId && rfqs.length > 0) {
      const id = Number(highlightId)
      if (!isNaN(id) && rfqs.some((r) => r.id === id)) {
        setExpandedRfqIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        // Scroll to the item
        setTimeout(() => {
          const element = document.getElementById(`rfq-${id}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 100)
      }
    }
  }, [searchParams, rfqs])

  // Handle rfqId parameter from dashboard search - auto-open quote form
  useEffect(() => {
    const rfqIdParam = searchParams.get("rfqId")
    if (rfqIdParam && rfqs.length > 0) {
      const id = Number(rfqIdParam)
      if (!isNaN(id) && rfqs.some((r) => r.id === id)) {
        setActiveQuoteRfqId(id)
        setExpandedRfqIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        // Scroll to the item
        setTimeout(() => {
          const element = document.getElementById(`rfq-${id}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 100)
      }
    }
  }, [searchParams, rfqs])

  const signOut = async () => {
    try {
      await logoutUser()
    } finally {
      clearToken()
      router.push("/")
    }
  }

  const vendorDirectory = useMemo(() => getUniqueVendorsFromProducts(products), [products])

  const supplierListings = useMemo(
    () => products.filter((item) => item.vendor_username === username && item.is_active && item.stock > 0),
    [products, username]
  )

  const supplierVendorProfile = useMemo(() => supplierListings[0]?.vendor ?? null, [supplierListings])

  const supplierCompanyName = useMemo(
    () => supplierListings[0]?.vendor_company_name || undefined,
    [supplierListings]
  )

  const isSupplierQuoteOwner = (quote: VendorRfq["quotations"][number]) => {
    const quoteVendorId = quote.supplier_vendor_id
    if (supplierVendorProfile && quoteVendorId && quoteVendorId === supplierVendorProfile) return true
    if (quote.supplier_name?.trim().toLowerCase() === username.trim().toLowerCase()) return true
    if (supplierCompanyName && quote.supplier_company?.trim().toLowerCase() === supplierCompanyName.trim().toLowerCase()) return true
    return false
  }

  const supplierInviteKeys = useMemo(() => {
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedCompany = supplierCompanyName?.trim().toLowerCase() || ""

    return {
      username: normalizedUsername,
      company: normalizedCompany,
      vendorId: supplierVendorProfile,
    }
  }, [supplierCompanyName, supplierVendorProfile, username])

  const visibleSupplierRfqs = useMemo(
    () =>
      rfqs.filter((item) => {
        // Always show RFQs created by the supplier (subcontracting)
        if (item.buyer_name === username) return true

        // For other RFQs, show if open or if invited
        if (item.invited_vendors.length === 0) return true
        return item.invited_vendors.some((vendor) => {
          const vendorUsername = vendor.vendor_username?.trim().toLowerCase() || ""
          const vendorName = vendor.vendor_name.trim().toLowerCase()

          if (supplierInviteKeys.vendorId && vendor.vendor_id === supplierInviteKeys.vendorId) {
            return true
          }

          if (supplierInviteKeys.username && vendorUsername === supplierInviteKeys.username) {
            return true
          }

          if (supplierInviteKeys.company && vendorName === supplierInviteKeys.company) {
            return true
          }

          return false
        })
      }),
    [rfqs, username, supplierInviteKeys]
  )

  const matchingSupplierListings = useMemo(() => {
    const activeRfq = visibleSupplierRfqs.find((item) => item.id === activeQuoteRfqId)
    if (!activeRfq) return []
    return supplierListings.filter((item) => item.product_type === activeRfq.product_type)
  }, [activeQuoteRfqId, supplierListings, visibleSupplierRfqs])

  const editingMatchingSupplierListings = useMemo(() => {
    if (!editingQuotationContext) return []
    const editRfq = visibleSupplierRfqs.find((item) => item.id === editingQuotationContext.rfqId)
    if (!editRfq) return []
    return supplierListings.filter((item) => item.product_type === editRfq.product_type)
  }, [editingQuotationContext, supplierListings, visibleSupplierRfqs])

  const activeQuoteRfq = useMemo(
    () => visibleSupplierRfqs.find((item) => item.id === activeQuoteRfqId) ?? null,
    [activeQuoteRfqId, visibleSupplierRfqs]
  )

  const refreshRfqs = async () => {
    const data = hasAuthToken() ? await getRfqs() : await getPublicRfqs()
    setRfqs(data)
  }

  const startEditingRfq = (rfq: VendorRfq) => {
    setEditingRfqId(rfq.id)
    setRfqForm({
      title: rfq.title,
      description: rfq.description,
      product_type: rfq.product_type,
      quantity: rfq.quantity,
      target_budget: rfq.target_budget,
      delivery_location: rfq.delivery_location,
      expected_delivery_date: rfq.expected_delivery_date,
      quote_deadline: rfq.quote_deadline,
      tender_document: null,
      tender_document_note: rfq.tender_document_note || "",
      remove_tender_document: false,
      tender_type: rfq.tender_type,
      invited_vendors: rfq.invited_vendors,
    })
    setMessage("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const cancelEditingRfq = () => {
    setEditingRfqId(null)
    setRfqForm(emptyRfqForm)
    setMessage("")
  }

  const clearSelectedTenderDocument = () => {
    setRfqForm((prev) => ({ ...prev, tender_document: null }))
  }

  const removeExistingTenderDocument = () => {
    setRfqForm((prev) => ({
      ...prev,
      tender_document: null,
      tender_document_note: "",
      remove_tender_document: true,
    }))
  }

  const toggleRfqExpansion = (rfqId: number) => {
    setExpandedRfqIds((prev) => (prev.includes(rfqId) ? prev.filter((id) => id !== rfqId) : [...prev, rfqId]))
  }

  const handleVendorToggle = (vendorId: number) => {
    const vendor = vendorDirectory.find((item) => item.vendor_id === vendorId)
    if (!vendor) return

    setRfqForm((prev) => {
      const exists = prev.invited_vendors.some((item) => item.vendor_id === vendorId)
      return {
        ...prev,
        invited_vendors: exists
          ? prev.invited_vendors.filter((item) => item.vendor_id !== vendorId)
          : [...prev.invited_vendors, vendor],
      }
    })
  }

  const setAllVendorsOption = () => {
    setRfqForm((prev) => ({
      ...prev,
      tender_type: "open",
      invited_vendors: [],
    }))
    setMessage("")
  }

  const handleSaveRfq = async () => {
    if (!hasAuthToken() || userRole !== "buyer") {
      setMessage("Please login as a buyer to publish an RFQ.")
      router.push("/login?next=%2Fbuyer%2Frfq")
      return
    }

    if (!rfqForm.title.trim() || !rfqForm.description.trim() || !rfqForm.delivery_location.trim()) {
      setMessage("Title, description, and delivery location are required.")
      return
    }

    if (!rfqForm.expected_delivery_date || !rfqForm.quote_deadline) {
      setMessage("Expected delivery date and quote deadline are required.")
      return
    }

    if (rfqForm.quantity < 1) {
      setMessage("Quantity must be at least 1.")
      return
    }

    const today = getToday()
    if (rfqForm.quote_deadline < today) {
      setMessage("Quote deadline cannot be in the past.")
      return
    }

    if (rfqForm.expected_delivery_date < rfqForm.quote_deadline) {
      setMessage("Expected delivery date must be on or after the quote deadline.")
      return
    }

    if (rfqForm.tender_type === "limited" && rfqForm.invited_vendors.length === 0) {
      setMessage("Select at least one vendor for a limited tender.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      if (editingRfqId) {
        const updated = await updateRfq(editingRfqId, rfqForm)
        setRfqs((prev) => prev.map((item) => (item.id === editingRfqId ? updated : item)))
        setEditingRfqId(null)
        setRfqForm(emptyRfqForm)
        const updMsg = `RFQ #${updated.id} updated successfully.`
        setMessage(updMsg)
        notifyUser({ type: "success", title: "RFQ Updated", message: updMsg })
      } else {
        const created = await createRfq(rfqForm)
        setRfqs((prev) => [created, ...prev])
        setRecentlyPublishedRfqId(created.id)
        setRfqForm(emptyRfqForm)
        const pubMsg = `RFQ #${created.id} published successfully to the vendor market.`
        setMessage(pubMsg)
        notifyUser({ type: "success", title: "RFQ Published! 🎉", message: pubMsg })
      }
    } catch (error) {
      const errMsg = getApiErrorMessage(error, editingRfqId ? "Could not update RFQ. Please try again." : "Could not create RFQ. Please try again.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Action Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitQuotation = async (rfq: VendorRfq) => {
    const selectedListing = matchingSupplierListings.find((item) => item.id === quoteForm.product_id)

    if (!supplierListings.length) {
      setMessage("Add an active product or service listing before submitting a quotation.")
      return
    }

    if (!selectedListing) {
      setMessage("Select the product or service you want to quote from your listings.")
      return
    }

    if (quoteForm.unit_price <= 0 || quoteForm.lead_time_days <= 0 || quoteForm.validity_days <= 0) {
      setMessage("Enter valid quote price, lead time, and validity period.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      await submitQuotation(rfq.id, quoteForm)
      await refreshRfqs()
      setQuoteForm(emptyQuoteForm)
      setActiveQuoteRfqId(null)
      const qMsg = `Quotation submitted against RFQ #${rfq.id}.`
      setMessage(qMsg)
      notifyUser({ type: "success", title: "Quotation Submitted", message: qMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not submit quotation. Check RFQ eligibility, deadline, and duplicate quote rules.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Submission Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const startEditingQuotation = (rfq: VendorRfq, quote: VendorRfq["quotations"][number]) => {
    setEditingQuotationContext({ rfqId: rfq.id, quotationId: quote.id })
    setEditingQuoteForm({
      product_id: quote.product_id,
      unit_price: quote.unit_price,
      lead_time_days: quote.lead_time_days,
      validity_days: quote.validity_days,
      notes: quote.notes || "",
    })
    setMessage("")
  }

  const cancelEditingQuotation = () => {
    setEditingQuotationContext(null)
    setEditingQuoteForm(emptyQuoteForm)
  }

  const handleUpdateQuotation = async (rfq: VendorRfq) => {
    if (!editingQuotationContext || editingQuotationContext.rfqId !== rfq.id) return

    const selectedListing = editingMatchingSupplierListings.find((item) => item.id === editingQuoteForm.product_id)
    if (!selectedListing) {
      setMessage("Select a valid listing for your updated quotation.")
      return
    }
    if (editingQuoteForm.unit_price <= 0 || editingQuoteForm.lead_time_days <= 0 || editingQuoteForm.validity_days <= 0) {
      setMessage("Enter valid quote price, lead time, and validity period.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      await editQuotation(rfq.id, editingQuotationContext.quotationId, editingQuoteForm)
      await refreshRfqs()
      cancelEditingQuotation()
      const uqMsg = `Quotation for RFQ #${rfq.id} updated successfully.`
      setMessage(uqMsg)
      notifyUser({ type: "success", title: "Quotation Updated", message: uqMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not update quotation.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Update Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAwardQuotation = async (rfq: VendorRfq, quotationId: number) => {
    const selectedQuote = rfq.quotations.find((item) => item.id === quotationId)
    if (!selectedQuote) {
      setMessage("Quotation not found.")
      return
    }

    if (!selectedQuote.supplier_vendor_id) {
      setMessage("This quotation is missing a vendor profile mapping.")
      return
    }

    try {
      setSubmitting(true)
      setMessage("")
      const createdOrder = await createOrder({
        vendor: selectedQuote.supplier_vendor_id,
        total_amount: rfq.quantity * selectedQuote.unit_price,
        items: [
          {
            product: selectedQuote.product_id,
            quantity: rfq.quantity,
            price: selectedQuote.unit_price,
          },
        ],
      })
      await awardQuotation(rfq.id, quotationId, {
        vendorId: selectedQuote.supplier_vendor_id,
        supplierName: selectedQuote.supplier_name,
        supplierCompany: selectedQuote.supplier_company,
        orderId: createdOrder.id,
      })
      await refreshRfqs()
      const awardMsg = `RFQ #${rfq.id} awarded to ${selectedQuote.supplier_company || selectedQuote.supplier_name}. Order #${createdOrder.id} created.`
      setMessage(awardMsg)
      notifyUser({ type: "success", title: "RFQ Awarded", message: awardMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not award the quotation or create the order.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Award Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const openRejectQuotationModal = (rfqId: number, quotationId: number) => {
    setRejectModal({
      open: true,
      rfqId,
      quotationId,
      reason: "",
    })
  }

  const closeRejectQuotationModal = () => {
    if (submitting) return
    setRejectModal({
      open: false,
      rfqId: null,
      quotationId: null,
      reason: "",
    })
  }

  const handleRejectQuotation = async () => {
    if (!rejectModal.rfqId || !rejectModal.quotationId) return

    try {
      setSubmitting(true)
      setMessage("")
      await rejectQuotation(rejectModal.rfqId, rejectModal.quotationId, rejectModal.reason)
      await refreshRfqs()
      const rejMsg = `Quotation #${rejectModal.quotationId} rejected for RFQ #${rejectModal.rfqId}.`
      setMessage(rejMsg)
      notifyUser({ type: "info", title: "Quotation Rejected", message: rejMsg })
      closeRejectQuotationModal()
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not reject quotation.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Rejection Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }
  const handleCloseRfq = async (rfqId: number) => {
    try {
      setSubmitting(true)
      setMessage("")
      await closeRfq(rfqId)
      await refreshRfqs()
      const clMsg = `RFQ #${rfqId} has been closed.`
      setMessage(clMsg)
      notifyUser({ type: "info", title: "RFQ Closed", message: clMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not close RFQ.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Close Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopenRfq = async (rfqId: number) => {
    try {
      setSubmitting(true)
      setMessage("")
      await reopenRfq(rfqId)
      await refreshRfqs()
      const roMsg = `RFQ #${rfqId} has been reopened.`
      setMessage(roMsg)
      notifyUser({ type: "success", title: "RFQ Reopened", message: roMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not reopen RFQ.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Reopen Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteRfqModal = (rfqId: number) => {
    setDeleteModal({
      open: true,
      rfqId,
    })
  }

  const closeDeleteRfqModal = () => {
    if (submitting) return
    setDeleteModal({
      open: false,
      rfqId: null,
    })
  }

  const handleDeleteRfq = async () => {
    if (!deleteModal.rfqId) return

    try {
      setSubmitting(true)
      setMessage("")
      const rfqIdToDelete = deleteModal.rfqId
      await deleteRfq(rfqIdToDelete)
      await refreshRfqs()
      const delMsg = `RFQ #${rfqIdToDelete} has been deleted.`
      setMessage(delMsg)
      notifyUser({ type: "info", title: "RFQ Deleted", message: delMsg })
      closeDeleteRfqModal()
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not delete RFQ.")
      setMessage(errMsg)
      notifyUser({ type: "error", title: "Delete Failed", message: errMsg })
    } finally {
      setSubmitting(false)
    }
  }
  const baseRecords = userRole === "buyer" ? rfqs : userRole === "supplier" ? visibleSupplierRfqs : rfqs
  const records = useMemo(
    () => {
      const filtered = baseRecords.filter((item) => {
        const matchesStatus =
          requestFilter === "all"
            ? true
            : requestFilter === "my_rfqs"
              ? item.buyer_name === username
              : item.status === requestFilter
        const matchesTenderType = tenderTypeFilter === "all" || item.tender_type === tenderTypeFilter
        const normalizedQuery = searchQuery.trim().toLowerCase()
        const matchesQuery =
          normalizedQuery.length === 0 ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          (item.buyer_company || item.buyer_name).toLowerCase().includes(normalizedQuery) ||
          item.delivery_location.toLowerCase().includes(normalizedQuery)

        return matchesStatus && matchesTenderType && matchesQuery
      })

      return [...filtered].sort((a, b) => {
        if (sortBy === "oldest") return a.id - b.id
        if (sortBy === "budget_high") return b.target_budget - a.target_budget
        if (sortBy === "budget_low") return a.target_budget - b.target_budget
        if (sortBy === "deadline_nearest") {
          const aTime = new Date(a.quote_deadline).getTime()
          const bTime = new Date(b.quote_deadline).getTime()
          return aTime - bTime
        }
        return b.id - a.id
      })
    },
    [baseRecords, requestFilter, tenderTypeFilter, searchQuery, sortBy]
  )
  const supplierCanQuote = supplierListings.length > 0
  const latestPublishedRfq =
    recentlyPublishedRfqId !== null ? rfqs.find((item) => item.id === recentlyPublishedRfqId) ?? null : null
  const editingRfq = editingRfqId !== null ? rfqs.find((item) => item.id === editingRfqId) ?? null : null
  const showCreateForm = (userRole === "buyer" || userRole === "supplier") && (searchParams.get("view") === "new" || editingRfqId !== null)
  const isBuyerRoute = pathname?.startsWith("/buyer") || userRole === "buyer"
  const isSupplierRoute = pathname?.startsWith("/supplier") || userRole === "supplier"
  const supplierRfqAuthNext = encodeURIComponent("/supplier/rfq")

  const filterTabs: Array<{ key: "all" | "my_rfqs" | VendorRfq["status"]; label: string; count: number }> = [
    { key: "all", label: userRole === "buyer" ? "All RFQs" : "All Requests", count: baseRecords.length },
    ...(userRole === "supplier"
      ? [{ key: "my_rfqs" as const, label: "My Subcontracting", count: baseRecords.filter((item) => item.buyer_name === username).length }]
      : []),
    { key: "open", label: "Open", count: baseRecords.filter((item) => item.status === "open").length },
    { key: "under_review", label: "Under Review", count: baseRecords.filter((item) => item.status === "under_review").length },
    { key: "closed", label: "Closed", count: baseRecords.filter((item) => item.status === "closed").length },
    { key: "awarded", label: "Awarded", count: baseRecords.filter((item) => item.status === "awarded").length },
  ]

  return (
    <>
      {isBuyerRoute ? (
        <BuyerSidebar
          active="rfqs"
          username={username}
          buyerType={buyerType}
          onSignOut={signOut}
        />
      ) : isSupplierRoute ? (
        <SupplierSidebar
          active="rfqs"
          username={username}
          onSignOut={signOut}
        />
      ) : null}
      <main className={`rfq-experience-page py-8 md:py-12 ${(isBuyerRoute || isSupplierRoute) ? "pb-24 lg:pl-[calc(18rem+2.5rem)]" : ""}`}>
        <div className="health-container space-y-6">
          <section>
            {showCreateForm ? (
              <article className="soft-panel rounded-[20px] p-5">
                <h2 className="text-2xl font-extrabold">{editingRfqId ? `Edit RFQ #${editingRfqId}` : "Publish New RFQ"}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Publish a hospital procurement request with technical scope, required quantity, quote deadline, and delivery expectation.
                  {editingRfqId
                    ? "Update scope, vendors, document note, or replace/remove the tender PDF."
                    : "Create a procurement notice with scope, quantity, budget ceiling, quote deadline, and delivery commitment."}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-semibold text-[#2f5560]">Requirement Title</span>
                    <input
                      value={rfqForm.title}
                      onChange={(event) => setRfqForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Patient monitor procurement"
                      className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-semibold text-[#2f5560]">Specification / Scope</span>
                    <textarea
                      value={rfqForm.description}
                      onChange={(event) => setRfqForm((prev) => ({ ...prev, description: event.target.value }))}
                      rows={4}
                      placeholder="Specs, compliance, warranty, support, packaging."
                      className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-semibold text-[#2f5560]">Tender PDF</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handleTenderDocumentChange}
                      className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f7f6] file:px-3 file:py-2 file:font-semibold file:text-[#0f766e]"
                    />
                    <span className="text-xs text-[#607881]">
                      Optional. Upload buyer specifications or tender terms as a PDF up to 10 MB.
                    </span>
                    {editingRfq?.tender_document_url && !rfqForm.remove_tender_document && !rfqForm.tender_document ? (
                      <div className="rounded-xl border border-[#d8e8f6] bg-[#f8fbff] px-4 py-3 text-sm text-[#355860]">
                        <p className="font-semibold">Current PDF: {editingRfq.tender_document_name || "Tender document"}</p>
                        <p className="mt-1 text-xs text-[#607881]">
                          Uploaded: {formatDisplayDateTime(editingRfq.tender_document_uploaded_at)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={editingRfq.tender_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-xs font-semibold text-[#155e57]"
                          >
                            Open PDF
                          </a>
                          <a
                            href={editingRfq.tender_document_url}
                            download={editingRfq.tender_document_name || `rfq-${editingRfq.id}.pdf`}
                            className="rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-xs font-semibold text-[#155e57]"
                          >
                            Download PDF
                          </a>
                          <button
                            type="button"
                            onClick={removeExistingTenderDocument}
                            className="rounded-lg border border-[#f1d7d7] bg-white px-3 py-2 text-xs font-semibold text-[#934848]"
                          >
                            Remove PDF
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {rfqForm.remove_tender_document ? (
                      <div className="rounded-xl border border-[#f1d7d7] bg-[#fff7f7] px-4 py-3 text-sm text-[#934848]">
                        Current tender PDF will be removed when you save this RFQ.
                      </div>
                    ) : null}
                    {rfqForm.tender_document ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#155e57]">
                          Selected: {rfqForm.tender_document.name}
                        </span>
                        <button
                          type="button"
                          onClick={clearSelectedTenderDocument}
                          className="rounded-lg border border-[#d3e4e7] bg-white px-3 py-1 text-xs font-semibold text-[#3a616b]"
                        >
                          Clear Selected PDF
                        </button>
                      </div>
                    ) : null}
                  </label>

                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-semibold text-[#2f5560]">Tender Document Note</span>
                    <textarea
                      rows={2}
                      value={rfqForm.tender_document_note}
                      onChange={(event) => setRfqForm((prev) => ({ ...prev, tender_document_note: event.target.value }))}
                      placeholder="BOQ attached, compliance checklist, installation terms, etc."
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
                          invited_vendors:
                            event.target.value === "limited" ? prev.invited_vendors : [],
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

                  <div className="rounded-xl border border-[#d8e8f6] bg-[#f8fbff] px-4 py-3 text-sm text-[#355860]">
                    <p className="font-semibold text-[#214752]">Commercial note</p>
                    <p className="mt-1 text-xs leading-5 text-[#5c7780]">
                      Pricing is collected from supplier quotations. Budget is not mandatory for publishing this RFQ.
                    </p>
                  </div>

                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-semibold text-[#2f5560]">Delivery Location</span>
                    <input
                      value={rfqForm.delivery_location}
                      onChange={(event) =>
                        setRfqForm((prev) => ({ ...prev, delivery_location: event.target.value }))
                      }
                      placeholder="Hospital store, Kolkata"
                      className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[#2f5560]">Quote Deadline</span>
                    <input
                      type="date"
                      value={rfqForm.quote_deadline}
                      onChange={(event) => setRfqForm((prev) => ({ ...prev, quote_deadline: event.target.value }))}
                      min={getToday()}
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
                      min={rfqForm.quote_deadline || getToday()}
                      className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                    />
                  </label>

                  <div className="grid gap-2 text-sm md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#2f5560]">Select Vendors</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {rfqForm.tender_type === "open"
                          ? "Optional for open tender"
                          : "Required for limited tender"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={setAllVendorsOption}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${rfqForm.tender_type === "open" && rfqForm.invited_vendors.length === 0
                          ? "border-[#2563eb] bg-[#edf3ff] text-[#1d4ed8]"
                          : "border-[#d0e0e8] bg-white text-[#355860] hover:border-[#9fc6ff]"
                          }`}
                      >
                        All Vendors
                      </button>
                    </div>
                    <p className="text-xs text-[#607881]">
                      Use `All Vendors` to publish the tender to the full supplier market. Selecting a vendor only shortlists them. The RFQ is created only after you click
                      `{editingRfqId ? "Save RFQ Changes" : "Publish RFQ"}`.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {vendorDirectory.map((vendor) => {
                        const selected = rfqForm.invited_vendors.some((item) => item.vendor_id === vendor.vendor_id)
                        return (
                          <button
                            key={vendor.vendor_id}
                            type="button"
                            onClick={() => handleVendorToggle(vendor.vendor_id)}
                            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${selected
                              ? "border-[#3b82f6] bg-[#eaf1ff] text-[#1d4ed8]"
                              : "border-[#d0e0e8] bg-white text-[#355860] hover:border-[#9fc6ff]"
                              }`}
                          >
                            <p className="font-semibold">{vendor.vendor_name}</p>
                            <p className="text-xs opacity-80">{vendor.vendor_username || `Vendor ID ${vendor.vendor_id}`}</p>
                          </button>
                        )
                      })}
                    </div>
                    {rfqForm.invited_vendors.length > 0 ? (
                      <div className="rounded-xl border border-[#d8e8f6] bg-[#f8fbff] px-4 py-3">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-[#5a7480] uppercase">
                          Selected Vendors ({rfqForm.invited_vendors.length})
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#214752]">
                          {rfqForm.invited_vendors.map((vendor) => vendor.vendor_name).join(", ")}
                        </p>
                      </div>
                    ) : null}
                    {rfqForm.tender_type === "limited" && vendorDirectory.length === 0 ? (
                      <p className="text-xs text-[#8a5a2f]">
                        No supplier listings are available yet, so limited tenders cannot be targeted.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveRfq}
                    disabled={submitting}
                    className="rounded-2xl bg-[linear-gradient(90deg,#0f766e_0%,#115e59_100%)] px-4 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(15,118,110,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? editingRfqId
                        ? "Saving..."
                        : "Publishing..."
                      : editingRfqId
                        ? "Save RFQ Changes"
                        : rfqForm.tender_type === "limited" && rfqForm.invited_vendors.length > 0
                          ? `Publish RFQ to ${rfqForm.invited_vendors.length} Vendor${rfqForm.invited_vendors.length > 1 ? "s" : ""}`
                          : "Publish RFQ"}
                  </button>
                  {editingRfqId ? (
                    <button
                      type="button"
                      onClick={cancelEditingRfq}
                      className="rounded-2xl border border-[#d3e4e7] bg-white px-4 py-3 text-base font-bold text-[#3a616b]"
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>

                {latestPublishedRfq ? (
                  <div className="mt-4 rounded-2xl border border-[#d4ead9] bg-[#f6fff8] p-4 text-sm text-[#305a45]">
                    <p className="font-bold">Latest Published Requirement</p>
                    <p className="mt-1">
                      RFQ #{latestPublishedRfq.id} for {latestPublishedRfq.quantity}{" "}
                      {latestPublishedRfq.product_type === "product" ? "units / machines" : "service slots"} has been
                      issued to the supplier network.
                    </p>
                    <p className="mt-1">
                      Quote deadline: {formatDisplayDate(latestPublishedRfq.quote_deadline)} | Delivery required by:{" "}
                      {formatDisplayDate(latestPublishedRfq.expected_delivery_date)}
                    </p>
                    {latestPublishedRfq.tender_document_url ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        <a
                          href={latestPublishedRfq.tender_document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-semibold text-[#155e57] underline-offset-4 hover:underline"
                        >
                          View Tender PDF
                        </a>
                        <a
                          href={latestPublishedRfq.tender_document_url}
                          download={latestPublishedRfq.tender_document_name || `rfq-${latestPublishedRfq.id}.pdf`}
                          className="inline-flex text-sm font-semibold text-[#155e57] underline-offset-4 hover:underline"
                        >
                          Download Tender PDF
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ) : null}

          </section>

          {message ? (
            <section className="soft-panel rounded-[20px] p-4">
              <p className="rounded-lg border border-[#d9e8ea] bg-[#f8fdff] px-3 py-2 text-sm text-[#355860]">
                {message}
              </p>
            </section>
          ) : null}

          <section className="soft-panel rounded-[20px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {userRole === "buyer" || (userRole === "supplier" && requestFilter === "my_rfqs") ? "My RFQs" : "Buyer Procurement Requests"}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {userRole === "buyer" || (userRole === "supplier" && requestFilter === "my_rfqs")
                    ? "Track vendor reach, quotation activity, and award decisions across active RFQs."
                    : "Review buyer demand, validate scope and timelines, respond to active tenders, and keep a record of closed or awarded requirements."}
                </p>
              </div>
              <span className="rounded-full bg-[#edf3ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
                {loading ? "Loading..." : `${records.length} records`}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRequestFilter(tab.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${requestFilter === tab.key
                    ? "bg-[#2563eb] text-white shadow-[0_8px_20px_rgba(37,99,235,0.20)]"
                    : "border border-[#cdd9f4] bg-white text-[#51617a] hover:border-[#9db7f5]"
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tender title, buyer, description, location..."
                className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb]"
              />
              <select
                value={tenderTypeFilter}
                onChange={(event) => setTenderTypeFilter(event.target.value as "all" | VendorRfq["tender_type"])}
                className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb]"
              >
                <option value="all">All Tender Types</option>
                <option value="open">Open Tender</option>
                <option value="limited">Limited Tender</option>
                <option value="reverse">Reverse Auction</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as "latest" | "oldest" | "budget_high" | "budget_low" | "deadline_nearest"
                  )
                }
                className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb]"
              >
                <option value="latest">Sort: Latest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="budget_high">Sort: Budget High to Low</option>
                <option value="budget_low">Sort: Budget Low to High</option>
                <option value="deadline_nearest">Sort: Nearest Deadline</option>
              </select>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={refreshRfqs}
                disabled={submitting}
                className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 text-xs font-semibold text-[#51617a] disabled:opacity-60"
              >
                Refresh Requests
              </button>
            </div>

            {!loading && records.length === 0 ? (
              <p className="mt-4 rounded-lg border border-[#e0e8f8] bg-[#f8faff] px-3 py-4 text-sm text-[#51617a]">
                No RFQ records available yet.
              </p>
            ) : null}

            <div className="mt-4 grid gap-4">
              {records.map((rfq) => {
                const awardedQuote = rfq.awarded_quote_id
                  ? rfq.quotations.find((quote) => quote.id === rfq.awarded_quote_id)
                  : null
                const isExpanded = expandedRfqIds.includes(rfq.id)
                const isOwner = rfq.buyer_name === username
                const statusTone =
                  rfq.status === "closed"
                    ? "bg-[#fff2f2] text-[#a53c3c]"
                    : rfq.status === "awarded"
                      ? "bg-[#eefaf2] text-[#0f7a54]"
                      : rfq.status === "under_review"
                        ? "bg-[#edf4ff] text-[#2459c4]"
                        : "bg-[#edf7f6] text-[#0f766e]"

                return (
                  <article
                    id={`rfq-${rfq.id}`}
                    key={rfq.id}
                    className={`rfq-record-card rounded-2xl border bg-white p-5 ${recentlyPublishedRfqId === rfq.id ? "border-[#57a56d] shadow-[0_10px_26px_rgba(47,92,69,0.10)]" : "border-[#dbe8ea]"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRfqExpansion(rfq.id)}
                      className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{rfq.title}</h3>
                          <span className="rounded-full bg-[#edf7f6] px-2 py-1 text-[11px] font-semibold uppercase text-[#0f766e]">
                            Type: {formatTenderType(rfq.tender_type)}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${statusTone}`}>
                            {formatRfqStatus(rfq.status)}
                          </span>
                          <span className="rounded-full bg-[#fff4de] px-2 py-1 text-[11px] font-semibold uppercase text-[#9a6700]">
                            {getDeadlineLabel(rfq.quote_deadline, rfq.status)}
                          </span>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{rfq.description}</p>
                      </div>
                      <div className="text-right text-sm text-[#4b6670]">
                        <p>RFQ #{rfq.id}</p>
                        <p>Buyer: {rfq.buyer_company || rfq.buyer_name}</p>
                        <p>Institution Type: {formatBuyerType(rfq.buyer_type)}</p>
                        <p>Published: {formatDisplayDate(rfq.created_at)}</p>
                      </div>
                    </button>

                    {isExpanded ? (
                      <>
                        <div className="mt-4 rounded-2xl border border-[#d7e7ea] bg-[#f9fcfc] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#607881] uppercase">
                              Requirement Snapshot
                            </p>
                            <p className="text-xs font-semibold text-[#56707a]">
                              {rfq.product_type === "product" ? "Machine / Product Requirement" : "Service Requirement"}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <InfoPill label="Requested Quantity" value={`${rfq.quantity} ${rfq.product_type === "product" ? "units" : "slots"}`} />
                            <InfoPill label="Tender Type" value={formatTenderType(rfq.tender_type)} />
                            <InfoPill label="Quote Due" value={formatDisplayDate(rfq.quote_deadline)} />
                            <InfoPill label="Delivery Timeline" value={formatDisplayDate(rfq.expected_delivery_date)} />
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <InfoPill label="Delivery Location" value={rfq.delivery_location} />
                            <InfoPill
                              label="Requirement Type"
                              value={rfq.product_type === "product" ? "Equipment / Product Procurement" : "Vendor Service Procurement"}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <InfoPill label="Quantity" value={rfq.quantity} />
                          <InfoPill label="Tender Type" value={formatTenderType(rfq.tender_type)} />
                          <InfoPill label="Delivery Required By" value={formatDisplayDate(rfq.expected_delivery_date)} />
                          <InfoPill label="Location" value={rfq.delivery_location} />
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <InfoPill label="Quote Submission Deadline" value={formatDisplayDate(rfq.quote_deadline)} />
                          <InfoPill label="Requirement Type" value={rfq.product_type === "product" ? "Product Procurement" : "Service Procurement"} />
                          <InfoPill label="Quotations Received" value={rfq.quotations.length} />
                        </div>

                        <div className="mt-4 rounded-xl border border-[#e2ecee] bg-[#fbfeff] px-4 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#67818a] uppercase">Scope / Buyer Need</p>
                          <p className="mt-1 text-sm leading-6 text-[#355860]">{rfq.description}</p>
                          {rfq.tender_document_url ? (
                            <div className="mt-3 rounded-xl border border-[#d8e8f6] bg-[#f8fbff] px-4 py-3">
                              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#5a7480] uppercase">Tender Document</p>
                              <p className="mt-2 text-sm font-semibold text-[#214752]">
                                {rfq.tender_document_name || `RFQ-${rfq.id}.pdf`}
                              </p>
                              <p className="mt-1 text-xs text-[#607881]">
                                Uploaded: {formatDisplayDateTime(rfq.tender_document_uploaded_at)}
                              </p>
                              {rfq.tender_document_note ? (
                                <p className="mt-2 text-sm text-[#355860]">{rfq.tender_document_note}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <a
                                  href={rfq.tender_document_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-sm font-semibold text-[#155e57] transition hover:bg-[#f4fbfa]"
                                >
                                  Open PDF
                                </a>
                                <a
                                  href={rfq.tender_document_url}
                                  download={rfq.tender_document_name || `rfq-${rfq.id}.pdf`}
                                  className="inline-flex rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-sm font-semibold text-[#155e57] transition hover:bg-[#f4fbfa]"
                                >
                                  Download PDF
                                </a>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 rounded-xl border border-[#e2ecee] bg-[#fbfeff] px-4 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#67818a] uppercase">Invited Vendors</p>
                          <p className="mt-1 text-sm font-semibold text-[#284851]">
                            {rfq.invited_vendors.length > 0
                              ? rfq.invited_vendors.map((vendor) => vendor.vendor_name).join(", ")
                              : "Open market request for all eligible vendors"}
                          </p>
                        </div>

                        {awardedQuote ? (
                          <div className="mt-4 rounded-xl border border-[#d6eadb] bg-[#f6fff8] px-4 py-3 text-sm text-[#2f5c45]">
                            Awarded to {awardedQuote.supplier_company || awardedQuote.supplier_name}
                            {rfq.awarded_order_id ? ` | Order #${rfq.awarded_order_id}` : ""}
                          </div>
                        ) : null}

                        {rfq.status === "closed" ? (
                          <div className="mt-4 rounded-xl border border-[#f1d7d7] bg-[#fff7f7] px-4 py-3 text-sm text-[#934848]">
                            This RFQ is currently closed. Quotations are locked until the buyer reopens it.
                          </div>
                        ) : null}

                        {!userRole ? (
                          <div className="mt-4 rounded-xl border border-[#d8e8f6] bg-[#f8fbff] px-4 py-3 text-sm text-[#476673]">
                            <p className="font-semibold text-[#24454f]">Want to participate in this tender?</p>
                            <p className="mt-1">
                              Register as a vendor to submit quotations, view buyer interactions, and access the live tender desk.
                            </p>
                            <Link
                              href={`/register?next=${supplierRfqAuthNext}`}
                              className="mt-3 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
                            >
                              Register to Apply
                            </Link>
                          </div>
                        ) : null}

                        {userRole === "supplier" && !isOwner && rfq.status !== "awarded" && rfq.status !== "closed" ? (
                          <div className="mt-5">
                            {activeQuoteRfqId === rfq.id ? (
                              <div className="grid gap-3 rounded-xl border border-[#dce9f3] bg-[#f8fbff] p-4 md:grid-cols-2">
                                {!activeQuoteRfq || matchingSupplierListings.length === 0 ? (
                                  <div className="rounded-lg border border-[#f0dfc4] bg-[#fff9f1] px-3 py-2 text-sm text-[#8a5a2f] md:col-span-2">
                                    No matching {rfq.product_type} listings are available in your active catalog for this RFQ.
                                  </div>
                                ) : null}
                                <label className="grid gap-1 text-sm md:col-span-2">
                                  <span className="font-semibold text-[#2f5560]">Select Your Listing</span>
                                  <select
                                    value={quoteForm.product_id}
                                    onChange={(event) =>
                                      setQuoteForm((prev) => ({ ...prev, product_id: Number(event.target.value) }))
                                    }
                                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                  >
                                    <option value={0}>Choose listing</option>
                                    {matchingSupplierListings.map((listing) => (
                                      <option key={listing.id} value={listing.id}>
                                        {listing.name} | INR {Number(listing.price).toLocaleString()} | Stock {listing.stock}
                                      </option>
                                    ))}
                                  </select>
                                </label>

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
                                    placeholder="Warranty, installation, payment terms."
                                    className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                  />
                                </label>

                                <div className="flex gap-2 md:col-span-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitQuotation(rfq)}
                                    disabled={submitting || matchingSupplierListings.length === 0}
                                    className="rounded-xl bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {submitting ? "Submitting..." : "Submit Commercial Quote"}
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
                                disabled={!supplierCanQuote}
                                className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)]"
                              >
                                Respond to Request
                              </button>
                            )}
                          </div>
                        ) : null}

                        <div className="mt-5">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-bold text-[#24454f]">
                              Quotations Received ({rfq.quotations.length})
                            </h4>
                            {isOwner ? (
                              <div className="flex flex-wrap gap-2">
                                {rfq.status !== "awarded" ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditingRfq(rfq)}
                                    disabled={submitting}
                                    className="rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-xs font-semibold text-[#155e57] disabled:opacity-60"
                                  >
                                    Edit RFQ
                                  </button>
                                ) : null}
                                {rfq.status === "closed" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleReopenRfq(rfq.id)}
                                    disabled={submitting}
                                    className="rounded-lg bg-[#123f49] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    Reopen RFQ
                                  </button>
                                ) : rfq.status !== "awarded" ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCloseRfq(rfq.id)}
                                      disabled={submitting}
                                      className="rounded-lg border border-[#d3e4e7] bg-white px-3 py-2 text-xs font-semibold text-[#3a616b] disabled:opacity-60"
                                    >
                                      Close RFQ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openDeleteRfqModal(rfq.id)}
                                      disabled={submitting}
                                      className="rounded-lg border border-[#efcaca] bg-white px-3 py-2 text-xs font-semibold text-[#b42318] disabled:opacity-60"
                                    >
                                      Delete RFQ
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {rfq.quotations.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--text-muted)]">No quotations submitted yet.</p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[860px] text-sm">
                                <thead>
                                  <tr className="border-b border-[#d9e9eb] text-left text-[#4a6872]">
                                    <th className="px-2 py-2">Supplier</th>
                                    <th className="px-2 py-2">Listing</th>
                                    <th className="px-2 py-2">Unit Price</th>
                                    <th className="px-2 py-2">Lead Time</th>
                                    <th className="px-2 py-2">Validity</th>
                                    <th className="px-2 py-2">Notes</th>
                                    {isOwner || userRole === "supplier" ? <th className="px-2 py-2">Action</th> : null}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rfq.quotations.map((quote) => {
                                    const isAwarded = rfq.awarded_quote_id === quote.id
                                    return (
                                      <tr key={quote.id} className="border-b border-[#edf5f6] align-top">
                                        <td className="px-2 py-2 font-semibold">
                                          {quote.supplier_company || quote.supplier_name}
                                        </td>
                                        <td className="px-2 py-2">{quote.product_name}</td>
                                        <td className="px-2 py-2">INR {quote.unit_price.toLocaleString()}</td>
                                        <td className="px-2 py-2">{quote.lead_time_days} days</td>
                                        <td className="px-2 py-2">{quote.validity_days} days</td>
                                        <td className="px-2 py-2 text-[#4d6972]">{quote.notes || "-"}</td>
                                        {isOwner ? (
                                          <td className="px-2 py-2">
                                            {isAwarded || quote.status === "awarded" ? (
                                              <span className="rounded-full bg-[#e8fbf1] px-2 py-1 text-xs font-semibold text-[#0a7c57]">
                                                Awarded
                                              </span>
                                            ) : quote.status === "rejected" ? (
                                              <span className="rounded-full bg-[#fff1f1] px-2 py-1 text-xs font-semibold text-[#b42318]" title={quote.rejection_reason || "Rejected"}>
                                                Rejected
                                              </span>
                                            ) : rfq.status === "awarded" || rfq.status === "closed" ? (
                                              <span className="text-xs text-[#6b7f86]">Locked</span>
                                            ) : (
                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => handleAwardQuotation(rfq, quote.id)}
                                                  disabled={submitting}
                                                  className="rounded-lg bg-[#155e57] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                                >
                                                  Award Quote and Create PO
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => openRejectQuotationModal(rfq.id, quote.id)}
                                                  disabled={submitting}
                                                  className="rounded-lg border border-[#efcaca] bg-white px-3 py-2 text-xs font-semibold text-[#b42318] disabled:opacity-60"
                                                >
                                                  Reject Quote
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        ) : userRole === "supplier" ? (
                                          <td className="px-2 py-2">
                                            {isSupplierQuoteOwner(quote) ? (
                                              rfq.status === "awarded" || rfq.status === "closed" ? (
                                                <span className="text-xs text-[#6b7f86]">Locked</span>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => startEditingQuotation(rfq, quote)}
                                                  disabled={submitting}
                                                  className="rounded-lg border border-[#cfe2e4] bg-white px-3 py-2 text-xs font-semibold text-[#155e57] disabled:opacity-60"
                                                >
                                                  Edit Quote
                                                </button>
                                              )
                                            ) : (
                                              <span className="text-xs text-[#6b7f86]">-</span>
                                            )}
                                          </td>
                                        ) : null}
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {userRole === "supplier" && editingQuotationContext?.rfqId === rfq.id ? (
                            <div className="mt-4 grid gap-3 rounded-xl border border-[#dce9f3] bg-[#f8fbff] p-4 md:grid-cols-2">
                              {editingMatchingSupplierListings.length === 0 ? (
                                <div className="rounded-lg border border-[#f0dfc4] bg-[#fff9f1] px-3 py-2 text-sm text-[#8a5a2f] md:col-span-2">
                                  No matching active listings available for this RFQ.
                                </div>
                              ) : null}

                              <label className="grid gap-1 text-sm md:col-span-2">
                                <span className="font-semibold text-[#2f5560]">Select Your Listing</span>
                                <select
                                  value={editingQuoteForm.product_id}
                                  onChange={(event) =>
                                    setEditingQuoteForm((prev) => ({ ...prev, product_id: Number(event.target.value) }))
                                  }
                                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                >
                                  <option value={0}>Choose listing</option>
                                  {editingMatchingSupplierListings.map((listing) => (
                                    <option key={listing.id} value={listing.id}>
                                      {listing.name} | INR {Number(listing.price).toLocaleString()} | Stock {listing.stock}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="grid gap-1 text-sm">
                                <span className="font-semibold text-[#2f5560]">Unit Price (INR)</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={editingQuoteForm.unit_price}
                                  onChange={(event) =>
                                    setEditingQuoteForm((prev) => ({ ...prev, unit_price: Number(event.target.value) }))
                                  }
                                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                />
                              </label>

                              <label className="grid gap-1 text-sm">
                                <span className="font-semibold text-[#2f5560]">Lead Time (days)</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={editingQuoteForm.lead_time_days}
                                  onChange={(event) =>
                                    setEditingQuoteForm((prev) => ({ ...prev, lead_time_days: Number(event.target.value) }))
                                  }
                                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                />
                              </label>

                              <label className="grid gap-1 text-sm">
                                <span className="font-semibold text-[#2f5560]">Quote Validity (days)</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={editingQuoteForm.validity_days}
                                  onChange={(event) =>
                                    setEditingQuoteForm((prev) => ({ ...prev, validity_days: Number(event.target.value) }))
                                  }
                                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                />
                              </label>

                              <label className="grid gap-1 text-sm md:col-span-2">
                                <span className="font-semibold text-[#2f5560]">Commercial Notes</span>
                                <textarea
                                  rows={3}
                                  value={editingQuoteForm.notes}
                                  onChange={(event) => setEditingQuoteForm((prev) => ({ ...prev, notes: event.target.value }))}
                                  placeholder="Warranty, installation, payment terms."
                                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[var(--brand)]"
                                />
                              </label>

                              <div className="flex gap-2 md:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuotation(rfq)}
                                  disabled={submitting || editingMatchingSupplierListings.length === 0}
                                  className="rounded-xl bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_100%)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {submitting ? "Updating..." : "Update Quote"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingQuotation}
                                  className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-3 text-sm font-semibold text-[#3a616b]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleRfqExpansion(rfq.id)}
                        className="mt-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0ecee] bg-[#fbfeff] px-4 py-3 text-left text-sm text-[#48666f] hover:border-[#9db7f5] hover:bg-[#f8faff]"
                      >
                        <p>
                          {rfq.quantity} units | {formatTenderType(rfq.tender_type)} | Quote due {formatDisplayDate(rfq.quote_deadline)}
                        </p>
                        <p className="font-semibold text-[#123f49]">
                          {rfq.status === "closed" || rfq.status === "awarded"
                            ? "Read-only record"
                            : userRole === "supplier"
                              ? "View details"
                              : "View details"}
                        </p>
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        </div>
        {deleteModal.open ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,20,38,0.55)] px-4">
            <div className="w-full max-w-md rounded-2xl border border-[#f0d3d3] bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.25)]">
              <h3 className="text-lg font-bold text-[#0b1426]">Delete RFQ</h3>
              <p className="mt-2 text-sm text-[#4d6972]">
                This will permanently delete RFQ #{deleteModal.rfqId}. This action cannot be undone.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteRfqModal}
                  disabled={submitting}
                  className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-2 text-sm font-semibold text-[#3a616b] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRfq}
                  disabled={submitting}
                  className="rounded-xl bg-[#b42318] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Deleting..." : "Delete RFQ"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {rejectModal.open ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,20,38,0.55)] px-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#d9e6f2] bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.25)]">
              <h3 className="text-lg font-bold text-[#0b1426]">Reject Quotation</h3>
              <p className="mt-2 text-sm text-[#4d6972]">
                You are rejecting quotation #{rejectModal.quotationId} for RFQ #{rejectModal.rfqId}.
              </p>
              <label className="mt-4 grid gap-1 text-sm">
                <span className="font-semibold text-[#2f5560]">Reason (optional)</span>
                <textarea
                  rows={4}
                  value={rejectModal.reason}
                  onChange={(event) =>
                    setRejectModal((prev) => ({
                      ...prev,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Add reason for supplier reference."
                  className="rounded-xl border border-[#cde2e5] bg-white px-4 py-3 outline-none transition focus:border-[#b42318]"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRejectQuotationModal}
                  disabled={submitting}
                  className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-2 text-sm font-semibold text-[#3a616b] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectQuotation}
                  disabled={submitting}
                  className="rounded-xl bg-[#b42318] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Rejecting..." : "Reject Quote"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <style jsx>{`
        .rfq-experience-page {
          position: relative;
          overflow: hidden;
        }

        .rfq-experience-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(15, 79, 182, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 79, 182, 0.035) 1px, transparent 1px),
            radial-gradient(circle at 82% 18%, rgba(15, 79, 182, 0.08), transparent 28%),
            radial-gradient(circle at 8% 82%, rgba(29, 114, 255, 0.06), transparent 30%);
          background-size:
            42px 42px,
            42px 42px,
            auto,
            auto;
          animation: rfq-grid-drift 18s linear infinite;
        }

        .rfq-experience-page :global(.soft-panel) {
          position: relative;
          overflow: hidden;
          transform: translateZ(0);
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.07);
          animation: rfq-panel-rise 420ms ease both;
        }

        .rfq-experience-page :global(.soft-panel::before),
        .rfq-record-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 0%, rgba(15, 79, 182, 0.045) 45%, transparent 74%);
          opacity: 0;
          transform: translateX(-45%);
          transition:
            opacity 220ms ease,
            transform 760ms ease;
        }

        .rfq-experience-page :global(.soft-panel:hover::before),
        .rfq-record-card:hover::before {
          opacity: 1;
          transform: translateX(45%);
        }

        .rfq-record-card {
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.045);
          transition:
            transform 220ms ease,
            box-shadow 220ms ease,
            border-color 220ms ease;
          animation: rfq-panel-rise 460ms ease both;
        }

        .rfq-record-card:hover {
          transform: translateY(-3px);
          border-color: rgba(15, 79, 182, 0.24);
          box-shadow: 0 22px 54px rgba(15, 23, 42, 0.1);
        }

        .rfq-record-card :global(button:first-child) {
          position: relative;
          z-index: 1;
        }

        .rfq-record-card :global(button:first-child::after) {
          content: "";
          position: absolute;
          right: 0;
          bottom: -10px;
          left: 0;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(15, 79, 182, 0.42), transparent);
          opacity: 0;
          transform: scaleX(0.35);
          transition:
            opacity 220ms ease,
            transform 300ms ease;
        }

        .rfq-record-card:hover :global(button:first-child::after) {
          opacity: 1;
          transform: scaleX(1);
        }

        .rfq-experience-page :global(input),
        .rfq-experience-page :global(select),
        .rfq-experience-page :global(textarea) {
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            transform 180ms ease,
            background-color 180ms ease;
        }

        .rfq-experience-page :global(input:focus),
        .rfq-experience-page :global(select:focus),
        .rfq-experience-page :global(textarea:focus) {
          transform: translateY(-1px);
          box-shadow: 0 0 0 4px rgba(15, 79, 182, 0.08);
        }

        .rfq-experience-page :global(.blue-btn),
        .rfq-experience-page :global(button),
        .rfq-experience-page :global(a) {
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            background-color 180ms ease,
            border-color 180ms ease,
            color 180ms ease;
        }

        .rfq-experience-page :global(button:hover),
        .rfq-experience-page :global(a:hover) {
          transform: translateY(-1px);
        }

        .rfq-experience-page :global(table tbody tr) {
          transition:
            background-color 160ms ease,
            transform 160ms ease;
        }

        .rfq-experience-page :global(table tbody tr:hover) {
          transform: translateX(2px);
          background-color: rgba(248, 251, 255, 0.92);
        }

        .rfq-experience-page :global(.rounded-full) {
          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .rfq-record-card:hover :global(.rounded-full) {
          transform: translateY(-1px);
        }

        @keyframes rfq-grid-drift {
          from {
            background-position:
              0 0,
              0 0,
              0 0,
              0 0;
          }
          to {
            background-position:
              42px 42px,
              42px 42px,
              0 0,
              0 0;
          }
        }

        @keyframes rfq-panel-rise {
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

function InfoPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#e0e8f8] bg-[#f8faff] px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#5b6b85] uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0b1426]">{value}</p>
    </div>
  )
}






