"use client"

import { Suspense, type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import BuyerSidebar from "@/components/buyer/BuyerSidebar"
import SupplierSidebar from "@/components/supplier/SupplierSidebar"
import {
  clearToken,
  getCurrentUser,
  isAuthSessionError,
  logoutUser,
  createProduct,
  deleteProduct,
  getApiErrorMessage,
  getProducts,
  updateProduct,
} from "@/services"
import type { VendorProductService } from "@/services"
import { notifyUser } from "@/services/utils/notificationService"

export default function ProductsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f4f9fa]" />}>
      <ProductsPageContent />
    </Suspense>
  )
}

function ProductsPageContent() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<VendorProductService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState<string>("")
  const [userRole, setUserRole] = useState<"supplier" | "buyer" | "admin" | "">("")
  const [buyerType, setBuyerType] = useState<string>("")
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VendorProductService | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionMessage, setActionMessage] = useState<string>("")
  const [createMessage, setCreateMessage] = useState<string>("")
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    product_type: "product" as "product" | "service",
    price: "",
    stock: "0",
  })
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    product_type: "product" as "product" | "service",
    price: "",
    stock: "0",
  })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<"all" | "product" | "service">("all")
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const me = await getCurrentUser()
        if (pathname?.startsWith("/buyer") && me.role === "supplier") {
          router.replace("/supplier/products")
          return
        }
        if (pathname?.startsWith("/supplier") && me.role === "buyer") {
          router.replace("/buyer/products")
          return
        }
        setUsername(me.username)
        setUserRole(me.role)
        setBuyerType(me.buyer_type || "")
        const data = await getProducts()
        setProducts(data)
      } catch (error) {
        if (isAuthSessionError(error)) {
          clearToken()
          setError("You are not authenticated. Redirecting to login...")
          router.push(pathname ? `/login?next=${encodeURIComponent(pathname)}` : "/login")
          return
        }

        setError("Could not load the marketplace right now. Check the backend API and try again.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [pathname, router])

  // Handle highlight parameter from search
  useEffect(() => {
    const highlightId = searchParams.get("highlight")
    if (highlightId && products.length > 0) {
      const id = Number(highlightId)
      if (!isNaN(id) && products.some((p) => p.id === id)) {
        setHighlightedProductId(id)
        // Scroll to the item
        setTimeout(() => {
          const element = document.getElementById(`product-${id}`)
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 100)
      }
    }
  }, [searchParams, products])

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

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      product_type: "product",
      price: "",
      stock: "0",
    })
  }

  const openCreateModal = () => {
    setActionMessage("")
    setCreateMessage("")
    resetCreateForm()
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    if (creating) return
    setShowCreateModal(false)
    setCreateMessage("")
    resetCreateForm()
  }

  const handleCreateProduct = async () => {
    if (!createForm.name.trim() || !createForm.description.trim()) {
      setCreateMessage("Name and description are required.")
      return
    }

    const price = Number(createForm.price)
    const stock = Number(createForm.stock)

    if (!Number.isFinite(price) || price <= 0) {
      setCreateMessage("Enter a valid price greater than 0.")
      return
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setCreateMessage("Stock must be a non-negative integer.")
      return
    }

    try {
      setCreating(true)
      setCreateMessage("")
      const created = await createProduct({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        product_type: createForm.product_type,
        price,
        stock,
        is_active: true,
      })
      setProducts((prev) => [created, ...prev])
      setShowCreateModal(false)
      resetCreateForm()
      const successMsg = "Product added to catalog successfully."
      setActionMessage(successMsg)
      notifyUser({ type: "success", title: "Product Created", message: successMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not add product/service. Check inputs and try again.")
      setCreateMessage(errMsg)
      notifyUser({ type: "error", title: "Addition Failed", message: errMsg })
    } finally {
      setCreating(false)
    }
  }

  const startEditing = (product: VendorProductService) => {
    setActionMessage("")
    setEditingProductId(product.id)
    setEditForm({
      name: product.name,
      description: product.description,
      product_type: product.product_type,
      price: String(Number(product.price)),
      stock: String(product.stock),
    })
  }

  const cancelEditing = () => {
    setEditingProductId(null)
    setActionMessage("")
  }

  const saveProductEdits = async (productId: number) => {
    const price = Number(editForm.price)
    const stock = Number(editForm.stock)

    if (!editForm.name.trim() || !editForm.description.trim()) {
      setActionMessage("Name and description are required.")
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      setActionMessage("Enter a valid price greater than 0.")
      return
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setActionMessage("Stock must be a non-negative integer.")
      return
    }

    try {
      setUpdating(true)
      const updated = await updateProduct(productId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        product_type: editForm.product_type,
        price,
        stock,
        is_active: true,
      })
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)))
      setEditingProductId(null)
      const successMsg = "Product updated successfully."
      setActionMessage(successMsg)
      notifyUser({ type: "success", title: "Product Updated", message: successMsg })
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Could not update product. Please try again.")
      setActionMessage(errMsg)
      notifyUser({ type: "error", title: "Update Failed", message: errMsg })
    } finally {
      setUpdating(false)
      // Auto-clear message after 5 seconds
      setTimeout(() => setActionMessage(""), 5000)
    }
  }

  const requestDeleteProduct = (product: VendorProductService) => {
    setDeleteTarget(product)
    setActionMessage("")
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setDeleteTarget(null)
  }

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteProduct(deleteTarget.id)
      setProducts((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      const successMsg = `Product "${deleteTarget.name}" deleted.`
      setActionMessage(successMsg)
      notifyUser({ type: "info", title: "Product Deleted", message: successMsg })
      setDeleteTarget(null)
    } catch {
      const errMsg = "Could not delete product. Please try again."
      setActionMessage(errMsg)
      notifyUser({ type: "error", title: "Delete Failed", message: errMsg })
    } finally {
      setDeleting(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchType = category === "all" || product.product_type === category
      const matchQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery)
      return matchType && matchQuery
    })
  }, [products, query, category])

  const groupedBuyerProducts = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string
        name: string
        description: string
        product_type: "product" | "service"
        minPrice: number
        totalStock: number
        sellerCount: number
      }
    >()

    filteredProducts.forEach((product) => {
      const key = `${product.name.trim().toLowerCase()}::${product.product_type}`
      const current = grouped.get(key)
      const price = Number(product.price)
      if (!current) {
        grouped.set(key, {
          key,
          name: product.name,
          description: product.description,
          product_type: product.product_type,
          minPrice: price,
          totalStock: product.stock,
          sellerCount: 1,
        })
        return
      }

      current.minPrice = Math.min(current.minPrice, price)
      current.totalStock += product.stock
      current.sellerCount += 1
    })

    return Array.from(grouped.values())
  }, [filteredProducts])

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((p) => p.is_active).length,
      inStock: products.filter((p) => p.stock > 0).length,
    }),
    [products]
  )

  return (
    <>
      {isBuyerRoute ? (
        <BuyerSidebar
          active="marketplace"
          username={username}
          buyerType={buyerType || null}
          onSignOut={signOut}
        />
      ) : isSupplierRoute ? (
        <SupplierSidebar
          active="supplies"
          username={username}
          onSignOut={signOut}
        />
      ) : null}
      <main className={`px-4 py-8 md:px-6 md:py-12 ${(isBuyerRoute || isSupplierRoute) ? "pb-24 lg:pl-[calc(18rem+2.5rem)]" : ""}`}>
        <div className="health-container space-y-6">
          <header className="glass-card pulse-entry rounded-[18px] p-4 md:p-5">
            <h1 className="max-w-full whitespace-nowrap text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[#0f172a] md:text-3xl">
              {userRole === "supplier" ? "Supplier Product Catalog Management" : "Marketplace"}
            </h1>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <StatCard label="Listings" value={stats.total} />
              <StatCard label="Active" value={stats.active} />
              <StatCard label="In Stock" value={stats.inStock} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search oxygen, monitor, medicine..."
                className="w-full rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] sm:max-w-md"
              />
              <div className="flex overflow-hidden rounded-xl border border-[#cdd9f4] bg-white">
                {(["all", "product", "service"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`px-4 py-3 text-sm font-semibold capitalize transition ${category === item ? "bg-[#edf3ff] text-[#1d4ed8]" : "text-[#5b6b85]"
                      }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {userRole === "supplier" ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="blue-btn px-4 py-3 text-sm"
                >
                  Add Product or Service
                </button>
              ) : (
                <>
                  <Link
                    href="/buyer/orders"
                    className="blue-btn px-4 py-3 text-sm"
                  >
                    B2C Buy Now
                  </Link>
                  <Link
                    href="/buyer/rfq"
                    className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm font-semibold text-[#1e40af] transition hover:bg-[#f1f5ff]"
                  >
                    Create RFQ
                  </Link>
                  <Link
                    href="/buyer/rfq?view=my"
                    className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm font-semibold text-[#1e40af] transition hover:bg-[#f1f5ff]"
                  >
                    My RFQs
                  </Link>
                </>
              )}
            </div>
          </header>

          <section>
            {!isLoading && !error && userRole === "supplier" ? (
              <div className="mb-4">
                <h2 className="text-2xl font-bold">My Products & Services</h2>
              </div>
            ) : null}
            {actionMessage ? (
              <StateCard message={actionMessage} isError={actionMessage.toLowerCase().includes("could not") || actionMessage.toLowerCase().includes("required") || actionMessage.toLowerCase().includes("valid")} />
            ) : null}
            {isLoading ? <StateCard message="Loading vendor catalog..." /> : null}
            {!isLoading && error ? <StateCard message={error} isError /> : null}
            {!isLoading && !error && filteredProducts.length === 0 ? (
              <StateCard message="No matching products or services found." />
            ) : null}

            {!isLoading && !error && userRole === "buyer" && groupedBuyerProducts.length > 0 ? (
              <>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupedBuyerProducts.map((product, index) => (
                    <article
                      key={product.key}
                      className="soft-panel pulse-entry rounded-[18px] p-5"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg leading-6 font-bold">{product.name}</h3>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${product.product_type === "service"
                            ? "bg-[#f5f1ff] text-[#7c3aed]"
                            : "bg-[#edf3ff] text-[#1d4ed8]"
                            }`}
                        >
                          {product.product_type}
                        </span>
                      </div>
                      <p className="mt-2 min-h-14 text-sm leading-6 text-[var(--text-muted)]">{product.description}</p>

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-2xl font-extrabold text-[var(--brand-strong)]">
                          From INR {product.minPrice.toLocaleString()}
                        </p>
                        <p className="text-xs font-semibold text-[#0f766e]">{product.totalStock} total stock</p>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#5b6b85]">{product.sellerCount} seller(s) available</p>
                    </article>
                  ))}
                </div>
              </>
            ) : null}

            {!isLoading && !error && userRole !== "buyer" && filteredProducts.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product, index) => (
                    <article
                      id={`product-${product.id}`}
                      key={product.id}
                      className={`soft-panel pulse-entry rounded-[18px] p-5 ${highlightedProductId === product.id ? "ring-2 ring-[#0f4fb6] shadow-[0_0_0_3px_rgba(15,79,182,0.1)]" : ""
                        }`}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {editingProductId === product.id ? (
                          <input
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-lg border border-[#cde2e5] bg-white px-2 py-1 text-base font-bold outline-none"
                          />
                        ) : (
                          <h3 className="text-lg leading-6 font-bold">{product.name}</h3>
                        )}
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${product.product_type === "service"
                            ? "bg-[#f5f1ff] text-[#7c3aed]"
                            : "bg-[#edf3ff] text-[#1d4ed8]"
                            }`}
                        >
                          {product.product_type}
                        </span>
                      </div>
                      {editingProductId === product.id ? (
                        <textarea
                          value={editForm.description}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                          className="mt-2 min-h-14 w-full rounded-lg border border-[#cde2e5] bg-white px-2 py-1 text-sm leading-6 text-[var(--text-muted)] outline-none"
                          rows={2}
                        />
                      ) : (
                        <p className="mt-2 min-h-14 text-sm leading-6 text-[var(--text-muted)]">{product.description}</p>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        {editingProductId === product.id ? (
                          <div className="grid w-full gap-2 sm:grid-cols-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editForm.price}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                              className="rounded-lg border border-[#cde2e5] bg-white px-2 py-1 text-sm outline-none"
                            />
                            <input
                              type="number"
                              min={0}
                              value={editForm.stock}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, stock: event.target.value }))}
                              className="rounded-lg border border-[#cde2e5] bg-white px-2 py-1 text-sm outline-none"
                            />
                            <select
                              value={editForm.product_type}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  product_type: event.target.value as "product" | "service",
                                }))
                              }
                              className="rounded-lg border border-[#cde2e5] bg-white px-2 py-1 text-sm outline-none sm:col-span-2"
                            >
                              <option value="product">Product</option>
                              <option value="service">Service</option>
                            </select>
                          </div>
                        ) : (
                          <>
                            <p className="text-2xl font-extrabold text-[var(--brand-strong)]">
                              INR {Number(product.price).toLocaleString()}
                            </p>
                            <p
                              className={`text-xs font-semibold ${product.stock > 0 ? "text-[#0f766e]" : "text-[#b91c1c]"
                                }`}
                            >
                              {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
                            </p>
                          </>
                        )}
                      </div>
                      {userRole === "supplier" ? (
                        <div className="mt-4 flex gap-2">
                          {editingProductId === product.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveProductEdits(product.id)}
                                disabled={updating}
                                className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white"
                              >
                                {updating ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 text-xs font-semibold text-[#51617a]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(product)}
                                className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 text-xs font-semibold text-[#1e40af]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteProduct(product)}
                                className="rounded-lg border border-[#f4caca] bg-white px-3 py-2 text-xs font-semibold text-[#b91c1c]"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#d8e3f5] bg-white p-6 shadow-[0_20px_45px_rgba(16,35,74,0.22)]">
              <h2 className="text-xl font-bold">Delete Product</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget.name}</span>?
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className="rounded-lg border border-[#cdd9f4] bg-white px-4 py-2 text-sm font-semibold text-[#51617a] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProduct}
                  disabled={deleting}
                  className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {showCreateModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-[#d8e3f5] bg-white p-5 shadow-[0_24px_70px_rgba(16,35,74,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f4fb6]">Supplier Catalog</p>
                  <h2 className="mt-1 text-2xl font-black text-[#0f172a]">Add Product or Service</h2>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 text-sm font-semibold text-[#51617a] disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-semibold text-[#0f172a]">Name</span>
                  <input
                    value={createForm.name}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 outline-none transition focus:border-[#0f4fb6]"
                    placeholder="Oxygen cylinder, nebulizer..."
                  />
                </label>

                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="font-semibold text-[#0f172a]">Description</span>
                  <textarea
                    value={createForm.description}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-24 rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 outline-none transition focus:border-[#0f4fb6]"
                    placeholder="Add catalog details buyers should see"
                    rows={3}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#0f172a]">Type</span>
                  <select
                    value={createForm.product_type}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        product_type: event.target.value as "product" | "service",
                      }))
                    }
                    className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 outline-none transition focus:border-[#0f4fb6]"
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#0f172a]">Price (INR)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={createForm.price}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, price: event.target.value }))}
                    className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 outline-none transition focus:border-[#0f4fb6]"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[#0f172a]">Stock</span>
                  <input
                    type="number"
                    min={0}
                    value={createForm.stock}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, stock: event.target.value }))}
                    className="rounded-lg border border-[#cdd9f4] bg-white px-3 py-2 outline-none transition focus:border-[#0f4fb6]"
                  />
                </label>
              </div>

              {createMessage ? (
                <p className="mt-4 rounded-xl border border-[#f4caca] bg-[#fff7f7] px-4 py-3 text-sm font-semibold text-[#991b1b]">
                  {createMessage}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateProduct}
                  disabled={creating}
                  className="rounded-xl bg-[#0f4fb6] px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,79,182,0.2)] transition hover:bg-[#0d46a3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Saving..." : "Add to Catalog"}
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="rounded-xl border border-[#cdd9f4] bg-white px-4 py-3 text-sm font-semibold text-[#51617a] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  const iconMap: Record<string, ReactNode> = {
    Listings: <CubeIcon />,
    Active: <PulseIcon />,
    "In Stock": <CheckIcon />,
  }

  return (
    <div className="rounded-xl border border-[#e0e8f8] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.08em] text-[#5b6b85] uppercase">{label}</p>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e6eeff] text-[#1e40af]">
          {iconMap[label] ?? <CubeIcon />}
        </span>
      </div>
      <p className="mt-2 text-3xl font-extrabold text-[#0b1426]">{value}</p>
    </div>
  )
}

function StateCard({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-6 text-center text-sm ${isError ? "border-[#f4caca] bg-[#fff7f7] text-[#991b1b]" : "border-[#e0e8f8] bg-[#f8faff] text-[#51617a]"
        }`}
    >
      {message}
    </div>
  )
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 8 4.5v11L12 22l-8-4.5v-11L12 2Z" />
      <path d="M12 22V11" />
      <path d="M20 6.5 12 11 4 6.5" />
    </svg>
  )
}

function PulseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2.5-5 4 10 2.5-5H21" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}





