from django.contrib import admin
from .models.account_profile import AccountProfile
from .models.buyer_profile import BuyerProfile
from .models.vendor_profile import VendorProfile
from .models.vendor_product_service import VendorProductService
from .models.vendor_rfq import VendorRfq
from .models.vendor_quotation import VendorQuotation
from .models.vendor_order import VendorOrder
from .models.vendor_order_item import VendorOrderItem
from .models.vendor_order_event import VendorOrderEvent

@admin.register(AccountProfile)
class AccountProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "status", "buyer_type")
    list_filter = ("role", "status")
    search_fields = ("user__username", "user__email")

@admin.register(BuyerProfile)
class BuyerProfileAdmin(admin.ModelAdmin):
    list_display = ("organization_name", "buyer_type", "city")
    search_fields = ("organization_name", "gst_number")

@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ("company_name", "verification_status", "city")
    list_filter = ("verification_status",)
    search_fields = ("company_name", "gst_number")

@admin.register(VendorProductService)
class VendorProductServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "vendor", "product_type", "price", "stock", "is_active")
    list_filter = ("product_type", "is_active")
    search_fields = ("name", "vendor__company_name")

@admin.register(VendorRfq)
class VendorRfqAdmin(admin.ModelAdmin):
    list_display = ("id", "buyer", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("id", "buyer__username")

@admin.register(VendorQuotation)
class VendorQuotationAdmin(admin.ModelAdmin):
    list_display = ("id", "rfq", "supplier_vendor", "total_amount", "status")
    list_filter = ("status",)

    def total_amount(self, obj):
        return obj.unit_price * obj.rfq.quantity
    total_amount.short_description = "Total Amount"

@admin.register(VendorOrder)
class VendorOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "buyer", "vendor", "total_amount", "status", "delivery_status")
    list_filter = ("status", "delivery_status", "payment_status")
    search_fields = ("id", "buyer__username", "vendor__company_name")

admin.site.register(VendorOrderItem)
admin.site.register(VendorOrderEvent)
