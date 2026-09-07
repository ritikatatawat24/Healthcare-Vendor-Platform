from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from vendor.models.vendor_product_service import VendorProductService
from vendor.models.vendor_profile import VendorProfile
from vendor.serializers.vendor_product_service_serializer import VendorProductServiceSerializer
from vendor.utils.account_role import get_or_create_account_role

class VendorProductServiceViewSet(viewsets.ModelViewSet):

    queryset = VendorProductService.objects.none()
    serializer_class = VendorProductServiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        role = get_or_create_account_role(self.request.user)
        if role == "supplier":
            return VendorProductService.objects.filter(vendor__user=self.request.user).order_by("-id")
        return VendorProductService.objects.filter(is_active=True).order_by("-id")

    def perform_create(self, serializer):
        user = self.request.user
        role = get_or_create_account_role(user)
        
        if role != "supplier" and not user.is_superuser:
            raise PermissionDenied("Permission Denied: Your account role is not 'supplier'. Only suppliers can manage the catalog.")

        try:
            vendor_profile, created = VendorProfile.objects.get_or_create(
                user=user,
                defaults={
                    "company_name": f"{user.username}'s Medical Supplies",
                    "gst_number": "PENDING",
                    "license_number": "PENDING",
                    "address": "Not Provided",
                    "verification_status": "pending"
                },
            )
            serializer.save(vendor=vendor_profile)
        except Exception as e:
            raise PermissionDenied(f"System Error: Could not link product to your vendor profile. Detail: {str(e)}")

    def perform_update(self, serializer):
        user = self.request.user
        role = get_or_create_account_role(user)
        is_owner = serializer.instance.vendor.user_id == user.id
        
        if not user.is_superuser and (role != "supplier" or not is_owner):
            raise PermissionDenied("Permission Denied: You can only edit your own products or services.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        role = get_or_create_account_role(user)
        is_owner = instance.vendor.user_id == user.id
        
        if not user.is_superuser and (role != "supplier" or not is_owner):
            raise PermissionDenied("Permission Denied: You can only delete your own products or services.")
        instance.delete()
