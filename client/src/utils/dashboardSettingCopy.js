const toText = (value, fallback) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export const normalizeDashboardSettingCopy = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? source.dashboard : {};
  const updateProfile =
    source.updateProfile && typeof source.updateProfile === "object"
      ? source.updateProfile
      : {};

  return {
    dashboard: {
      sectionTitle: toText(
        dashboard.sectionTitle,
        toText(dashboard.dashboardLabel, "Dashboard")
      ),
      invoiceMessageFirstPartLabel: toText(
        dashboard.invoiceMessageFirstPartLabel,
        "Invoice Message First Part"
      ),
      invoiceMessageFirstPartValue: toText(
        dashboard.invoiceMessageFirstPartValue,
        "Thank You"
      ),
      invoiceMessageLastPartLabel: toText(
        dashboard.invoiceMessageLastPartLabel,
        "Invoice Message Last Part"
      ),
      invoiceMessageLastPartValue: toText(
        dashboard.invoiceMessageLastPartValue,
        "Your order have been received !"
      ),
      printButtonLabel: toText(dashboard.printButtonLabel, "Print Button"),
      printButtonValue: toText(
        dashboard.printButtonValue,
        toText(dashboard.printButtonLabel, "Print Invoice")
      ),
      downloadButtonLabel: toText(dashboard.downloadButtonLabel, "Download Button"),
      downloadButtonValue: toText(
        dashboard.downloadButtonValue,
        toText(dashboard.downloadButtonLabel, "Download Invoice")
      ),
      dashboardLabel: toText(dashboard.dashboardLabel, "Dashboard"),
      totalOrdersLabel: toText(dashboard.totalOrdersLabel, "Total Orders"),
      pendingOrderLabel: toText(dashboard.pendingOrderLabel, "Pending Order"),
      pendingOrderValue: toText(dashboard.pendingOrderValue, "Pending Orders"),
      processingOrderLabel: toText(dashboard.processingOrderLabel, "Processing Order"),
      processingOrderValue: toText(dashboard.processingOrderValue, "Processing Order"),
      completeOrderLabel: toText(dashboard.completeOrderLabel, "Complete Order"),
      completeOrderValue: toText(dashboard.completeOrderValue, "Complete Orders"),
      recentOrderLabel: toText(dashboard.recentOrderLabel, "Recent Order"),
      recentOrderValue: toText(dashboard.recentOrderValue, "Recent Orders"),
      myOrderLabel: toText(dashboard.myOrderLabel, "My Order"),
      myOrderValue: toText(dashboard.myOrderValue, "My Orders"),
    },
    updateProfile: {
      sectionTitleLabel: toText(updateProfile.sectionTitleLabel, "Update Profile"),
      sectionTitleValue: toText(
        updateProfile.sectionTitleValue,
        toText(updateProfile.sectionTitleLabel, "Update Profile")
      ),
      fullNameLabel: toText(updateProfile.fullNameLabel, "Full Name"),
      addressLabel: toText(updateProfile.addressLabel, "Address"),
      phoneMobileLabel: toText(updateProfile.phoneMobileLabel, "Phone/Mobile"),
      emailAddressLabel: toText(updateProfile.emailAddressLabel, "Email Address"),
      updateButtonLabel: toText(updateProfile.updateButtonLabel, "Update Button"),
      updateButtonValue: toText(
        updateProfile.updateButtonValue,
        toText(updateProfile.updateButtonLabel, "Update Profile")
      ),
      currentPasswordLabel: toText(updateProfile.currentPasswordLabel, "Current Password"),
      newPasswordLabel: toText(updateProfile.newPasswordLabel, "New Password"),
      changePasswordLabel: toText(
        updateProfile.changePasswordLabel,
        "Change Password"
      ),
    },
  };
};
