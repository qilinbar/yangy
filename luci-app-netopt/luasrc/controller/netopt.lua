module("luci.controller.netopt", package.seeall)

function index()

    entry({"admin", "network", "netopt"}, cbi("netopt"), _("网卡优化"), 80).dependent = true
end

