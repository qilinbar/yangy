'use strict';

return L.view.extend({
        interfaceCache: {},
        load: function() {
                return L.uci.load('netopt').then(function() {
                        var sections = L.uci.sections('netopt');
                        console.log('UCI sections:', sections);
                        if (!sections.length || !sections.find(s => s['.name'] === 'config')) {
                                console.log('Creating default config section');
                                L.uci.add('netopt', 'netopt', 'config');
                        }
                        return L.rpc.declare({
                                object: 'netopt',
                                method: 'get_interfaces',
                                expect: { '': {} }
                        })();
                }).then(function(interfacesData) {
                        return [null, interfacesData];  // data[0] UCI dummy, data[1] interfaces
                }).catch(function(err) {
                        console.error('Load error:', err);
                        return [null, {interfaces: []}];
                });
        },
        render: function(data) {
                console.log('===== DEBUG =====');
                console.log('data:', data);
                var self = this;
                var interfacesData = data[1] || {};
                var interfaces = Array.isArray(interfacesData.interfaces) ? interfacesData.interfaces : [];
                var m, s, o;
                console.log('interfaces:', interfaces);
                console.log('interfaces.length:', interfaces.length);
                m = new L.form.Map('netopt',
                        _('网卡优化设置'),
                        _('通过禁用节能和启用 RPS/XPS 优化网卡性能'));
                // ========== 基本配置 ==========
                s = m.section(L.form.GridSection, 'netopt', _('优化选项'));
                s.anonymous = true;
                s.addremove = false; // 不允许添加/删除 section
                s.nodescriptions = true; // 无描述头

                o = s.option(L.form.Flag, 'eee',
                        _('关闭节能功能 (EEE/WOL)'));
                o.default = '0';
                o.rmempty = false;

                o = s.option(L.form.Flag, 'rpsxps',
                        _('启用 RPS/XPS'));
                o.default = '0';
                o.rmempty = false;
		o = s.option(L.form.Flag, 'enable',
   			 _('开机自动优化'),
   			 _('启用后，重启路由器自动应用选中的网卡优化'));
		o.default = '0';
		o.rmempty = false;
//		o.modalonly = false;  // 添加这行
//		o.readonly = false;
//		o.optional = false;
//		o.depends({});
                o = s.option(L.form.MultiValue, 'interfaces',
                        _('选择要优化的网卡'));
                o.multiple = true;
                o.size = 10;
                o.optional = false;
                o.rmempty = false;
                console.log('开始添加接口选项, o=', o);
                console.log('interfaces=', interfaces);
                interfaces.sort();
                interfaces.forEach(function(iface) {
                         var isVirtual = iface.match(/^(br-|wan|wan6|@|veth|docker|tunl)/);
                         var label = isVirtual ? (iface + ' (虚拟接口，不建议)') : iface;
                         o.value(iface, label);
                });
                console.log('MultiValue options added:', interfaces);
                console.log('transformed choices:', o.transformChoices());

                // ========== 接口详情查看 ==========
                s = m.section(L.form.TypedSection, 'netopt', _('接口详细信息'));
                s.anonymous = true;
                s.render = function() {
                        console.log('Rendering 接口详细信息 section');
                        var infoContainer = E('div', {
                                'id': 'netopt-interface-info',
                                'style': 'background: #f9f9f9; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 15px;'
                        }, [
                                E('p', {
                                        'style': 'color: #666; margin: 0;'
                                }, _('选择网卡后，点击下方按钮查看接口的硬件信息'))
                        ]);
                        var refreshButton = E('button', {
                                'class': 'cbi-button cbi-button-action',
                                'click': function() {
                                        var selectedIfaces = L.uci.get('netopt', 'config', 'interfaces') || [];
                                        if (typeof selectedIfaces === 'string') {
                                                selectedIfaces = [selectedIfaces];
                                        }
                                        if (!selectedIfaces.length) {
                                                L.ui.addNotification(null,
                                                        E('p', _('请先在上方选择要查看的网卡')),
                                                        'warning');
                                                return;
                                        }
                                        infoContainer.innerHTML = '<div class="spinning">' + _('正在获取接口信息...') + '</div>';
                                        var promises = selectedIfaces.map(function(iface) {
                                                return L.rpc.declare({
                                                        object: 'netopt',
                                                        method: 'get_interface_info',
                                                        params: ['interface']
                                                })(iface).catch(function() {
                                                        return { exists: false, name: iface };
                                                });
                                        });
                                        Promise.all(promises).then(function(results) {
                                                var table = E('table', {
                                                        'class': 'table',
                                                        'style': 'width: 100%; margin-bottom: 10px;'
                                                }, [
                                                        E('thead', {}, [
                                                                E('tr', {}, [
                                                                        E('th', { 'style': 'text-align: left; padding: 8px;' }, _('接口名称')),
                                                                        E('th', { 'style': 'text-align: center; padding: 8px;' }, _('EEE 支持')),
                                                                        E('th', { 'style': 'text-align: center; padding: 8px;' }, _('RX 队列')),
                                                                        E('th', { 'style': 'text-align: center; padding: 8px;' }, _('TX 队列')),
                                                                        E('th', { 'style': 'text-align: center; padding: 8px;' }, _('状态'))
                                                                ])
                                                        ]),
                                                        E('tbody', {}, results.map(function(info) {
                                                                if (!info.exists) {
                                                                        return E('tr', {}, [
                                                                                E('td', { 'colspan': '5', 'style': 'color: red; padding: 8px;' },
                                                                                        _('接口 %s 不存在或无法访问').format(info.name))
                                                                        ]);
                                                                }
                                                                return E('tr', {}, [
                                                                        E('td', { 'style': 'padding: 8px; font-weight: bold;' }, info.name),
                                                                        E('td', { 'style': 'text-align: center; padding: 8px;' },
                                                                                info.eee_support ?
                                                                                        E('span', { 'style': 'color: green;' }, '✓ 支持') :
                                                                                        E('span', { 'style': 'color: #999;' }, '✗ 不支持')
                                                                        ),
                                                                        E('td', { 'style': 'text-align: center; padding: 8px;' },
                                                                                String(info.rx_queues || 0)
                                                                        ),
                                                                        E('td', { 'style': 'text-align: center; padding: 8px;' },
                                                                                String(info.tx_queues || 0)
                                                                        ),
                                                                        E('td', { 'style': 'text-align: center; padding: 8px; color: green;' },
                                                                                '在线'
                                                                        )
                                                                ]);
                                                        }))
                                                ]);
                                                var helpText = E('div', {
                                                        'style': 'font-size: 12px; color: #666; margin-top: 10px; padding: 10px; background: #fff; border-left: 3px solid #5bc0de; border-radius: 3px;'
                                                }, [
                                                        E('p', { 'style': 'margin: 0 0 5px 0; font-weight: bold;' }, _('说明：')),
                                                        E('ul', { 'style': 'margin: 5px 0 0 20px; padding: 0;' }, [
                                                                E('li', {}, _('EEE：Energy-Efficient Ethernet，节能以太网功能')),
                                                                E('li', {}, _('RX 队列：接收队列数量，RPS 会应用于这些队列')),
                                                                E('li', {}, _('TX 队列：发送队列数量，XPS 会应用于这些队列')),
                                                                E('li', {}, _('队列数量越多，多核 CPU 优化效果越明显'))
                                                        ])
                                                ]);
                                                infoContainer.innerHTML = '';
                                                infoContainer.appendChild(table);
                                                infoContainer.appendChild(helpText);
                                        }).catch(function(err) {
                                                infoContainer.innerHTML = '<p style="color: red;">' +
                                                        _('获取接口信息失败: %s').format(err.message) + '</p>';
                                        });
                                }
                        }, _('🔍 查看接口信息'));
                        return E('div', { 'class': 'cbi-section' }, [
                                E('h3', _('选中接口的硬件信息')),
                                infoContainer,
                                refreshButton
                        ]);
                };
                // ========== 应用优化 ==========
                s = m.section(L.form.TypedSection, 'netopt', _('应用设置'));
                s.anonymous = true;
                s.render = function() {
                        var applyButton = E('button', {
                                'class': 'cbi-button cbi-button-save',
                                'style': 'font-size: 16px; padding: 10px 20px;',
                                'click': function(ev) {
                                        var btn = ev.target;
                                        btn.disabled = true;
                                        btn.textContent = _('正在应用...');
                                        // 先保存 UCI 配置
                                        m.save().then(function() {
                                                var eee = L.uci.get('netopt', 'config', 'eee') || '0';
                                                var rpsxps = L.uci.get('netopt', 'config', 'rpsxps') || '0';
                                                var interfaces = L.uci.get('netopt', 'config', 'interfaces') || [];
                                                if (typeof interfaces === 'string') {
                                                        interfaces = [interfaces];
                                                }
                                                if (!interfaces.length) {
                                                        btn.disabled = false;
                                                        btn.textContent = _('💾 保存并应用优化');
                                                        L.ui.addNotification(null,
                                                                E('p', _('请先选择要优化的网卡')),
                                                                'warning');
                                                        return;
                                                }
                                                L.ui.showModal(_('正在应用优化设置'), [
                                                        E('p', { 'class': 'spinning' },
                                                                _('正在对 %d 个网卡应用优化设置，请稍候...').format(interfaces.length))
                                                ]);
                                                return L.rpc.declare({
                                                        object: 'netopt',
                                                        method: 'apply_optimization',
                                                        params: ['eee', 'rpsxps', 'interfaces']
                                                })(eee, rpsxps, interfaces.join(' ')).then(function(result) {
                                                        L.uci.apply('netopt').then(function() {
                           					console.log('UCI committed to file');
                       					 });
                                                        L.ui.hideModal();
                                                        btn.disabled = false;
                                                        btn.textContent = _('💾 保存并应用优化');
                                                        if (result.success) {
                                                                var messages = (result.message || '').replace(/\\n/g, '\n').trim();
                                                                var messageLines = messages.split('\n').filter(function(line) {
                                                                        return line.trim() !== '';
                                                                });
                                                                var messageDiv = E('div', {
                                                                        'style': 'max-height: 300px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px;'
                                                                });
                                                                messageLines.forEach(function(line) {
                                                                        messageDiv.appendChild(E('div', {
                                                                                'style': 'padding: 2px 0; border-bottom: 1px solid #e0e0e0;'
                                                                        }, line));
                                                                });
                                                                L.ui.showModal(_('✓ 优化应用成功'), [
                                                                        E('p', {}, _('已成功应用以下优化：')),
                                                                        messageDiv,
                                                                        E('div', {
                                                                                'style': 'margin-top: 15px; padding: 10px; background: #d9edf7; border-left: 4px solid #31708f; border-radius: 3px;'
                                                                        }, [
                                                                                E('strong', {}, _('注意：')),
                                                                                E('span', {}, _('优化设置在系统重启后会失效。如需开机自动应用，请在 系统 → 启动项 中添加启动脚本。'))
                                                                        ]),
                                                                        E('button', {
                                                                                'class': 'cbi-button cbi-button-primary',
                                                                                'style': 'margin-top: 10px;',
                                                                                'click': L.ui.hideModal
                                                                        }, _('确定'))
                                                                ]);
                                                        } else {
                                                                L.ui.addNotification(null,
                                                                        E('p', _('应用失败: %s').format(result.error || 'Unknown error')),
                                                                        'error');
                                                        }
                                                }).catch(function(err) {
                                                        L.ui.hideModal();
                                                        btn.disabled = false;
                                                        btn.textContent = _('💾 保存并应用优化');
                                                        L.ui.addNotification(null,
                                                                E('p', _('应用失败: %s').format(err.message)),
                                                                'error');
                                                });
                                        }).catch(function(err) {
                                                btn.disabled = false;
                                                btn.textContent = _('💾 保存并应用优化');
                                                L.ui.addNotification(null,
                                                        E('p', _('保存配置失败: %s').format(err.message)),
                                                        'error');
                                        });
                                }
                        }, _('💾 保存并应用优化'));
                        var resetButton = E('button', {
                                'class': 'cbi-button cbi-button-reset',
                                'style': 'margin-left: 10px;',
                                'click': function() {
                                        if (confirm(_('确定要重置所有设置为默认值吗？'))) {
                                                L.uci.set('netopt', 'config', 'eee', '0');
                                                L.uci.set('netopt', 'config', 'rpsxps', '0');
                                                L.uci.set('netopt', 'config', 'interfaces', []);
                                                L.ui.addNotification(null,
                                                        E('p', _('设置已重置，请点击"保存并应用"生效')),
                                                        'info');
                                                setTimeout(function() {
                                                        window.location.reload();
                                                }, 1000);
                                        }
                                }
                        }, _('🔄 重置为默认'));
                        return E('div', { 'class': 'cbi-section' }, [
                                E('h3', _('立即应用优化')),
                                E('div', {
                                        'style': 'background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 5px; margin-bottom: 15px;'
                                }, [
                                        E('strong', { 'style': 'color: #856404;' }, _('⚠️ 重要提示：')),
                                        E('ul', { 'style': 'margin: 10px 0 0 20px; color: #856404;' }, [
                                                E('li', {}, _('点击下方按钮会立即将优化应用到选中的网卡')),
                                                E('li', {}, _('建议先在测试环境验证，避免影响生产网络')),
                                                E('li', {}, _('优化会在系统重启后失效，需要重新应用')),
                                                E('li', {}, _('如果网络出现问题，可以通过重启路由器恢复'))
                                        ])
                                ]),
                                E('div', { 'class': 'cbi-value-field' }, [
                                        applyButton,
                                        resetButton
                                ])
                        ]);
                };
                // ========== 功能说明 ==========
                return m.render();
        },
        handleSaveApply: null,
        handleSave: null,
        handleReset: null
});
