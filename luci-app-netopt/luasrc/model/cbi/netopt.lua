local uci = require("luci.model.uci").cursor()
local sys = require("luci.sys")
local nixio = require("nixio")

m = Map("netopt", "网卡优化设置", "配置网卡节能和RPS/XPS优化")

-- 获取所有网络接口（包括虚拟接口，让用户自己选择）
local function get_all_interfaces()
    local interfaces = {}
    for iface in nixio.fs.dir("/sys/class/net") do
        interfaces[iface] = iface
    end
    return interfaces
end

-- 查找或创建配置section
local section_id
uci:foreach("netopt", "netopt", function(s)
    section_id = s[".name"]
end)

if not section_id then
    section_id = uci:add("netopt", "netopt")
    uci:commit("netopt")
end

s = m:section(NamedSection, section_id, "netopt", "")
s.anonymous = false

-- 关闭节能 (EEE/WOL)
local eee = s:option(Flag, "eee", "关闭节能 (EEE/WOL)", "禁用网卡的节能功能")
eee.rmempty = false
eee.default = "0"

-- 启用 RPS/XPS
local rpsxps = s:option(Flag, "rpsxps", "启用 RPS/XPS", "启用接收包steering和传输包steering")
rpsxps.rmempty = false
rpsxps.default = "0"

-- 网卡选择列表（多选）- 显示所有接口让用户选择
local interfaces = get_all_interfaces()
local iface_list = s:option(DynamicList, "interfaces", "选择要优化的网卡", 
    "建议选择物理网卡（如eth1, eth2），避免选择虚拟接口（wan, wan6, br-lan, eth0等）")

-- 按接口名称排序显示
local sorted_ifaces = {}
for iface in pairs(interfaces) do
    table.insert(sorted_ifaces, iface)
end
table.sort(sorted_ifaces)

for _, iface in ipairs(sorted_ifaces) do
    iface_list:value(iface)
end

-- 添加一个说明section
--local help_section = m:section(SimpleSection, nil, "接口说明")
--help_section.template = "netopt_help"

-- 提交时应用设置
function m.on_commit(self)
    local eee_val = uci:get("netopt", section_id, "eee") or "0"
    local rpsxps_val = uci:get("netopt", section_id, "rpsxps") or "0"
    local selected_ifaces = uci:get("netopt", section_id, "interfaces") or ""
  --local selected_ifaces = uci:get("netopt", section_id, "interfaces")
    if type(selected_ifaces) == "table" then
        selected_ifaces = table.concat(selected_ifaces, " ")
    else
        selected_ifaces = selected_ifaces or ""
    end

    -- 将选择的网卡转换为表
    local whitelist = {}
    if selected_ifaces and selected_ifaces ~= "" then
        for iface in selected_ifaces:gmatch("([^%s]+)") do
            whitelist[iface] = true
            sys.call("logger -t netopt '用户选择接口: " .. iface .. "'")
        end
    end

    -- 如果没有选择任何网卡，记录日志并返回
    if next(whitelist) == nil then
        sys.call("logger -t netopt '未选择任何网卡，跳过处理'")
        return
    end

    -- 处理每个选中的网卡
    for iface in pairs(whitelist) do
        -- 检查接口是否存在
        if nixio.fs.access("/sys/class/net/" .. iface) then
            sys.call("logger -t netopt '开始处理接口: " .. iface .. "'")
            
            -- 处理 EEE
            local eee_supported = sys.call("ethtool --show-eee " .. iface .. " >/dev/null 2>&1")
            if eee_supported == 0 then
                if eee_val == "1" then
                    sys.call("/usr/sbin/ethtool --set-eee " .. iface .. " eee off 2>/dev/null")
                    sys.call("logger -t netopt '关闭EEE: " .. iface .. "'")
                else
                    sys.call("/usr/sbin/ethtool --set-eee " .. iface .. " eee on 2>/dev/null")
                    sys.call("logger -t netopt '开启EEE: " .. iface .. "'")
                end
            else
                sys.call("logger -t netopt '接口 " .. iface .. " 不支持EEE'")
            end

            -- 设置 RPS/XPS
            if rpsxps_val == "1" then
                -- 获取 CPU 核心数 (兼容busybox)
		local cpu_count = 0
                if cpu_count == 0 then
                    -- 备用方法：读取/proc/cpuinfo
                    for line in io.lines("/proc/cpuinfo") do
                        if line:match("^processor") then
                            cpu_count = cpu_count + 1
                        end
                    end
                end
                
                if cpu_count == 0 then 
                    cpu_count = 1 
                end

                -- CPU掩码计算
                local function lshift(x, n)
                    return x * (2 ^ n)
                end
                local mask = string.format("%x", lshift(1, cpu_count) - 1)

                -- 遍历 RX 队列
                local queues_path = "/sys/class/net/" .. iface .. "/queues"
                if nixio.fs.access(queues_path) then
                    for queue in nixio.fs.dir(queues_path) do
                        if queue:match("^rx%-") then
                            -- 设置 RPS (接收队列)
                            local rps_file = queues_path .. "/" .. queue .. "/rps_cpus"
                            if nixio.fs.access(rps_file, "w") then
                                local fd = nixio.open(rps_file, "w")
                                if fd then
                                    fd:write(mask)
                                    fd:close()
                                    sys.call("logger -t netopt '设置 " .. iface .. "/" .. queue .. " RPS -> CPU_MASK=0x" .. mask .. "'")
                                end
                            end
                        elseif queue:match("^tx%-") then
                            -- 设置 XPS (发送队列)
                            local xps_file = queues_path .. "/" .. queue .. "/xps_cpus"
                            if nixio.fs.access(xps_file, "w") then
                                local fd = nixio.open(xps_file, "w")
                                if fd then
                                    fd:write(mask)
                                    fd:close()
                                    sys.call("logger -t netopt '设置 " .. iface .. "/" .. queue .. " XPS -> CPU_MASK=0x" .. mask .. "'")
                                end
                            end
                        end
                    end
                end
            else
                -- 如果RPS/XPS被禁用，恢复默认设置
                local queues_path = "/sys/class/net/" .. iface .. "/queues"
                if nixio.fs.access(queues_path) then
                    for queue in nixio.fs.dir(queues_path) do
                        if queue:match("^rx%-") then
                            local rps_file = queues_path .. "/" .. queue .. "/rps_cpus"
                            if nixio.fs.access(rps_file, "w") then
                                local fd = nixio.open(rps_file, "w")
                                if fd then
                                    fd:write("0")
                                    fd:close()
                                    sys.call("logger -t netopt '恢复 " .. iface .. "/" .. queue .. " RPS -> 默认'")
                                end
                            end
                        elseif queue:match("^tx%-") then
                            local xps_file = queues_path .. "/" .. queue .. "/xps_cpus"
                            if nixio.fs.access(xps_file, "w") then
                                local fd = nixio.open(xps_file, "w")
                                if fd then
                                    fd:write("0")
                                    fd:close()
                                    sys.call("logger -t netopt '恢复 " .. iface .. "/" .. queue .. " XPS -> 默认'")
                                end
                            end
                        end
                    end
                end
            end
        else
            sys.call("logger -t netopt '警告: 接口不存在: " .. iface .. "'")
        end
    end
end

return m
