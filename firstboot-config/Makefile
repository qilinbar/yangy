include $(TOPDIR)/rules.mk

PKG_NAME:=firstboot-policy
PKG_VERSION:=1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/firstboot-policy
  SECTION:=base
  CATEGORY:=Base system
  TITLE:=Firstboot policy package
  PKGARCH:=all
endef

define Package/firstboot-policy/description
  Apply firstboot network, sing-box, and other policies automatically
endef

define Build/Compile
endef

define Package/firstboot-policy/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/uci-defaults/* $(1)/etc/uci-defaults/
endef

$(eval $(call BuildPackage,firstboot-policy))

