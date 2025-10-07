include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-netopt
PKG_VERSION:=1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=Your Name <your@email.com>
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=luci
	CATEGORY:=LuCI
	SUBMENU:=3. Applications
	TITLE:=Network Interface Optimization
	DEPENDS:=+ethtool
	PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
	LuCI interface for network interface optimization including EEE and RPS/XPS.
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	# LuCI controller
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./luasrc/controller/netopt.lua $(1)/usr/lib/lua/luci/controller/netopt.lua
	
	# LuCI model CBI
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi
	$(INSTALL_DATA) ./luasrc/model/cbi/netopt.lua $(1)/usr/lib/lua/luci/model/cbi/netopt.lua
	
	# Init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/netopt $(1)/etc/init.d/netopt
	
	# Application script
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./root/usr/bin/netopt-apply $(1)/usr/bin/netopt-apply
	
	# Config file
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/netopt $(1)/etc/config/netopt
	
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
