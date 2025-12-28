include $(TOPDIR)/rules.mk

LUCI_TITLE:=Sing-box LuCI App
LUCI_PKGARCH:=all
PKG_NAME:=luci-app-singbox
PKG_VERSION:=1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=YourName <you@example.com>
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  DEPENDS:=+luci-base +rpcd +rpcd-mod-ucode +rpcd-mod-luci +rpcd-mod-file +luci-mod-admin-full
endef

define Package/$(PKG_NAME)/description
  LuCI interface for Sing-box with proper RPCD and ucode integration.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
	# No compilation needed, only file installation
endef

define Package/$(PKG_NAME)/install
	# 安装 init 脚本
#	$(INSTALL_DIR) $(1)/etc/init.d
#	$(INSTALL_BIN) ./root/etc/init.d/sing-box $(1)/etc/init.d/sing-box

	# 安装服务控制配置文件
#	$(INSTALL_DIR) $(1)/etc/config
#	$(INSTALL_CONF) ./root/etc/config/sing-box $(1)/etc/config/sing-box

	# 安装主要配置文件
#	$(INSTALL_DIR) $(1)/etc/sing-box
#	$(INSTALL_DATA) ./root/etc/sing-box/config.json $(1)/etc/sing-box/config.json

	# 安装后端 RPC 处理脚本
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/singbox $(1)/usr/libexec/rpcd/singbox

	# 安装前端 JS 页面
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/singbox
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/singbox/overview.js $(1)/www/luci-static/resources/view/singbox/

	# 安装菜单 JSON
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-singbox.json $(1)/usr/share/luci/menu.d/

	# 安装 RPC 权限文件
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-singbox.json $(1)/usr/share/rpcd/acl.d/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))

