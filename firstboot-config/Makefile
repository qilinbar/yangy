include $(TOPDIR)/rules.mk

PKG_NAME:=firstboot-config
PKG_VERSION:=1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/firstboot-config
  SECTION:=base
  CATEGORY:=Base system
  TITLE:=Firstboot Network Configuration
  PKGARCH:=all
endef

define Package/firstboot-config/description
  Set eth0 to 192.168.1.2 and DNS to 192.168.1.1 on first boot.
endef

define Build/Compile
endef

define Package/firstboot-config/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/99-firstboot-network $(1)/etc/uci-defaults/99-firstboot-network
endef

$(eval $(call BuildPackage,firstboot-config))
