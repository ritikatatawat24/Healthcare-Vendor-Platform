"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { clearToken, getCurrentUser, isAuthSessionError } from "@/services/authService"
import { createProduct } from "@/services/vendorService"

export default function NewProductPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [createMessage, setCreateMessage] = useState("")
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    product_type: "product" as "product" | "service",
    price: "",
    stock: "0",
  })

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const me = await getCurrentUser()
        setUsername(me.username)
        if (me.role !== "supplier") {
          router.replace(me.role === "buyer" ? "/buyer/products" : "/login")
          return
        }
      } catch (error) {
        if (isAuthSessionError(error)) {
          clearToken()
          router.push(pathname ? `/login?next=${encodeURIComponent(pathname)}` : "/login")
          return
        }

        setCreateMessage("Could not verify your supplier session right now.
          ")
      }
    }
    checkAccess()
  }, [pathname, router])

  const handleCreateProduct = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setCreateMessage("Name and description are required.")
      return
    }

    const price = Number(formData.price)
    const stock = Number(formData.stock)

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
      await createProduct({
        name: formData.name.trim(),
        description: formData.description.trim(),
        product_type: formData.product_type,
        price,
        stock,
        is_active: true,
      })
      router.push("/supplier/products")
    } catch {
      setCreateMessage("Could not add product/service. Check inputs and try again.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="py-8 md:py-12">
      <div className="health-container space-y-6">
        <header className="glass-card rounded-[22px] p-6 md:p-8">
          <p className="text-xs font-semibold tracking-[0.1em] text-[var(--brand)] uppercase">Supplier Panel</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Add Product or Service</h1>
          <p className="mt-3 text-sm text-[#2f5660]">Signed in as: {username || "..."}</p>
          <div className="mt-4">
            <Link
              href="/supplier/products"
              className="rounded-xl border border-[#d3e4e7] bg-white px-4 py-2 text-sm font-semibold text-[#3a616b] transition hover:bg-[#f3fbfc]"
            >
              Back to Catalog
            </Link>
          </div>
        </header>

        <section className="soft-panel rounded-[22px] p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-[#375a63]">Name</span>
              <input
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-lg border border-[#cde2e5] bg-white px-3 py-2 outline-none focus:border-[var(--brand)]"
              />
            </label>

            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-semibold text-[#375a63]">Description</span>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                className="rounded-lg border border-[#cde2e5] bg-white px-3 py-2 outline-none focus:border-[var(--brand)]"
                rows={3}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#375a63]">Type</span>
              <select
                value={formData.product_type}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    product_type: event.target.value as "product" | "service",
                  }))
                }
                className="rounded-lg border border-[#cde2e5] bg-white px-3 py-2 outline-none focus:border-[var(--brand)]"
              >
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#375a63]">Price (INR)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={formData.price}
                onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
                className="rounded-lg border border-[#cde2e5] bg-white px-3 py-2 outline-none focus:border-[var(--brand)]"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#375a63]">Stock</span>
              <input
                type="number"
                min={0}
                value={formData.stock}
                onChange={(event) => setFormData((prev) => ({ ...prev, stock: event.target.value }))}
                className="rounded-lg border border-[#cde2e5] bg-white px-3 py-2 outline-none focus:border-[var(--brand)]"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateProduct}
              disabled={creating}
              className="rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Saving..." : "Add to Catalog"}
            </button>
            {createMessage ? <p className="text-sm text-[#365e69]">{createMessage}</p> : null}
          </div>
        </section>
      </div>
    </main>
  )
}
