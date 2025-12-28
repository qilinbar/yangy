'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require fs';
'require ui';
'require poll';

var callServiceList = rpc.declare({
        object: 'service',
        method: 'list',
        params: ['name'],
        expect: { '': {} }
});

var callTestConnectivity = rpc.declare({
        object: 'singbox',
        method: 'test_connectivity',
        expect: { '': {} }
});

var callGetLogs = rpc.declare({
        object: 'singbox',
        method: 'get_logs',
        params: ['lines'],
        expect: { '': {} }
});

var callReadConfig = rpc.declare({
        object: 'singbox',
        method: 'read_config',
        params: ['path'],
        expect: { '': {} }
});

var callWriteConfig = rpc.declare({
        object: 'singbox',
        method: 'write_config',
        params: ['path', 'content'],
        expect: { '': {} }
});

function getServiceStatus() {
        return L.resolveDefault(callServiceList('sing-box'), {}).then(function(res) {
                var isRunning = false;
                try {
                        isRunning = res['sing-box']['instances']['sing-box.main']['running'];
                } catch(e) {}
                return isRunning;
        });
}
function decodeJsonString(str) {
	if (!str) return '';
	return str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
return view.extend({
        statusSection: null,
        logSection: null,
        configEditor: null,
        latencyText: null,

        load: function() {
                return Promise.all([
                        uci.load('sing-box'),
                        getServiceStatus()
                ]);
        },

        pollStatus: function() {
                var self = this;

                poll.add(L.bind(function() {
                        return getServiceStatus().then(function(running) {
                                var statusText = self.statusSection?.querySelector('.service-status-text');
                                if (statusText) {
                                        statusText.textContent = running ? _('Running') : _('Stopped');
                                        statusText.style.color = running ? 'green' : 'red';
                                }
                        });
                }, this), 3);
        },

        render: function(data) {
                var self = this;
                var isRunning = data[1];

                var m, s, o;

                m = new form.Map('sing-box', _('Sing-box'),
                        _('Sing-box is a universal proxy platform.'));

                // 基本设置
                s = m.section(form.NamedSection, 'main', 'sing-box', _('Basic Settings'));

                o = s.option(form.Flag, 'enabled', _('Enable'));
                o.default = '0';
                o.rmempty = false;

                o = s.option(form.Value, 'config_file', _('Config File Path'));
                o.default = '/etc/sing-box/config.json';
                o.rmempty = false;

                o = s.option(form.Value, 'log_file', _('Log File Path'));
                o.default = '/var/log/singbox.log';
                o.rmempty = false;


                // 服务状态和控制
                s = m.section(form.TypedSection, 'sing-box', _('Service Control'));
                s.anonymous = true;
                s.render = L.bind(function(view, section_id) {
                        var root =  E('div', { 'class': 'cbi-section' }, [
                                E('h3', _('Service Status & Control')),

                                // 状态显示
                                E('div', { 'class': 'cbi-value' }, [
                                        E('label', { 'class': 'cbi-value-title' }, _('Status')),
                                        E('div', { 'class': 'cbi-value-field' }, [
                                                E('span', {
                                                        'class': 'service-status-text',
                                                        'style': 'font-weight: bold; color: ' + (isRunning ? 'green' : 'red')
                                                }, isRunning ? _('Running') : _('Stopped'))
                                        ])
                                ]),

                                // Google 连通性测试
                                E('div', { 'class': 'cbi-value' }, [
                                        E('label', { 'class': 'cbi-value-title' }, _('Google Connectivity')),
                                        E('div', { 'class': 'cbi-value-field' }, [
                                                E('span', { 'id': 'latency-display' }, _('Click test button')),
                                                E('span', { 'style': 'margin-left: 10px' }),
                                                E('button', {
                                                        'class': 'cbi-button cbi-button-action',
                                                        'click': ui.createHandlerFn(this, function() {
                                                                var btn = this;
                                                                var display = document.getElementById('latency-display');
                                                                btn.disabled = true;
                                                                btn.textContent = _('Testing...');
                                                                display.textContent = _('Testing...');
                                                                display.style.color = 'orange';

                                                                return callTestConnectivity().then(function(result) {
                                                                        btn.disabled = false;
                                                                        btn.textContent = _('Test Connection');
                                                                        if (result.success) {
                                                                                display.textContent = _('Connected') + ' - ' + result.latency;
                                                                                display.style.color = 'green';
                                                                        } else {
                                                                                display.textContent = result.status;
                                                                                display.style.color = 'red';
                                                                        }
                                                                }).catch(function(err) {
                                                                        btn.disabled = false;
                                                                        btn.textContent = _('Test Connection');
                                                                        display.textContent = _('Test failed: ') + err;
                                                                        display.style.color = 'red';
                                                                });
                                                        })
                                                }, _('Test Connection'))
                                        ])
                                ]),

                                // 控制按钮
                                E('div', { 'class': 'cbi-value' }, [
                                        E('label', { 'class': 'cbi-value-title' }, _('Actions')),
                                        E('div', { 'class': 'cbi-value-field' }, [
                                                E('button', {
                                                        'class': 'cbi-button cbi-button-apply',
                                                        'click': ui.createHandlerFn(this, function() {
                                                                return fs.exec('/etc/init.d/sing-box', ['start']).then(function() {
                                                                        var note = ui.addNotification(null, E('p', _('Service started')), 'info');
                                                                        // 3秒后自动移除
                                                                        setTimeout(function() {
                                                                            if(note && note.parentNode) 
                                                                                note.parentNode.removeChild(note);
                                                                        }, 3000);
                                                                }).catch(function(err) {
                                                                        ui.addNotification(null, E('p', _('Failed to start: %s').format(err)), 'error');
                                                                });
                                                        })
                                                }, _('Start')),
                                                ' ',
                                                E('button', {
                                                        'class': 'cbi-button cbi-button-reset',
                                                        'click': ui.createHandlerFn(this, function() {
                                                                return fs.exec('/etc/init.d/sing-box', ['stop']).then(function() {
                                                                        var note = ui.addNotification(null, E('p', _('Service stopped')), 'info');
                                                                        setTimeout(function() {                                                         
                                                                            if(note && note.parentNode)                                                 
                                                                                note.parentNode.removeChild(note);
                                                                        }, 3000);   
                                                                }).catch(function(err) {
                                                                        ui.addNotification(null, E('p', _('Failed to stop: %s').format(err)), 'error');
                                                                });
                                                        })
                                                }, _('Stop')),
                                                ' ',
                                                E('button', {
                                                        'class': 'cbi-button cbi-button-action',
                                                        'click': ui.createHandlerFn(this, function() {
                                                                return fs.exec('/etc/init.d/sing-box', ['restart']).then(function() {
                                                                        var note = ui.addNotification(null, E('p', _('Service restarted')), 'info');
                                                                        setTimeout(function() {                                                        
                                                                            if(note && note.parentNode)                                                   
                                                                                note.parentNode.removeChild(note);                                        
                                                                        }, 3000); 
                                                                }).catch(function(err) {
                                                                        ui.addNotification(null, E('p', _('Failed to restart: %s').format(err)), 'error');
                                                                });
                                                        })
                                                }, _('Restart'))
                                        ])
                                ])
                        ]);
                      this.statusSection = root;
                      return root;
                }, this);


                // 日志查看器
                s = m.section(form.TypedSection, 'sing-box', _('Log Viewer'));
                s.anonymous = true;
                s.render = L.bind(function(view, section_id) {
                        var logContainer = E('pre', {
                                'id': 'log-container',
                                'style': 'background: #f5f5f5; padding: 10px; border: 1px solid #ddd; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px;'
                        }, _('Loading logs...'));

                        var loadLogs = function() {
                                return callGetLogs(50).then(function(result) {
                                        logContainer.textContent = result.logs || _('No logs available');
                                        logContainer.scrollTop = logContainer.scrollHeight;
                                }).catch(function(err) {
                                        logContainer.textContent = _('Error loading logs: ') + err;
                                });
                        };

                        loadLogs();

                        return E('div', { 'class': 'cbi-section' }, [
                                E('h3', _('Recent Logs (Last 50 lines)')),
                                E('div', { 'class': 'cbi-value-field' }, [
                                        E('button', {
                                                'class': 'cbi-button cbi-button-action',
                                                'style': 'margin-bottom: 10px;',
                                                'click': function() {
                                                        loadLogs();
                                                }
                                        }, _('Refresh Logs')),
                                        ' ',
                                        E('button', {
                                                'class': 'cbi-button cbi-button-reset',
                                                'style': 'margin-bottom: 10px;',
                                                'click': function() {
                                                        if (confirm(_('Clear log file?'))) {
                                                                fs.exec('/bin/sh', ['-c', 'echo > /var/log/singbox.log']).then(function() {
                                                                        ui.addNotification(null, E('p', _('Logs cleared')), 'info');
                                                                        loadLogs();
                                                                });
                                                        }
                                                }
                                        }, _('Clear Logs'))
                                ]),
                                logContainer
                        ]);
                }, this);

                // 配置编辑器
		s = m.section(form.TypedSection, 'sing-box', _('Configuration Editor'));
		s.anonymous = true;
		s.render = L.bind(function(view, section_id) {
			var configPath = '/etc/sing-box/config.json';
			
			self.configEditor = E('textarea', {
				'id': 'config-editor',
				'style': 'width: 100%; min-height: 500px; font-family: "Courier New", monospace; font-size: 13px; padding: 10px; border: 1px solid #ccc; border-radius: 3px;',
				'spellcheck': 'false'
			}, _('Loading configuration...'));

			var loadConfig = function() {
				callReadConfig(configPath).then(function(result) {
					var content = result.content || '';
					// 解码 \n 为真实换行
					content = decodeJsonString(content);
					
					if (result.error) {
						self.configEditor.value = '// ' + result.error + '\n' + content;
					} else {
						// 尝试格式化 JSON
						try {
							var parsed = JSON.parse(content);
							self.configEditor.value = JSON.stringify(parsed, null, 2);
						} catch(e) {
							self.configEditor.value = content;
						}
					}
				}).catch(function(err) {
					self.configEditor.value = '// Error: ' + err.message;
				});
			};

			var saveConfig = function() {
				var content = self.configEditor.value;
				if (!content.trim()) {
					ui.addNotification(null, E('p', _('Configuration cannot be empty')), 'error');
					return;
				}

				// 验证 JSON
				try {
					JSON.parse(content);
				} catch(e) {
					ui.addNotification(null, E('p', _('Invalid JSON: %s').format(e.message)), 'error');
					return;
				}

				ui.showModal(_('Saving Configuration'), [
					E('p', { 'class': 'spinning' }, _('Saving configuration...'))
				]);

				callWriteConfig(configPath, content).then(function(result) {
					ui.hideModal();
					if (result.success) {
						ui.addNotification(null, E('p', _('Configuration saved successfully')), 'info');
					} else {
						ui.addNotification(null, E('p', _('Failed to save: %s').format(result.error || 'Unknown error')), 'error');
					}
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, E('p', _('Error: %s').format(err.message)), 'error');
				});
			};

			var formatConfig = function() {
				try {
					var json = JSON.parse(self.configEditor.value);
					self.configEditor.value = JSON.stringify(json, null, 2);
					ui.addNotification(null, E('p', _('Configuration formatted')), 'info');
				} catch(e) {
					ui.addNotification(null, E('p', _('Invalid JSON: %s').format(e.message)), 'error');
				}
			};

			loadConfig();

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Edit Configuration File')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('div', { 'style': 'margin-bottom: 10px;' }, [
						E('button', {
							'class': 'cbi-button cbi-button-save',
							'click': function() {
								saveConfig();
							}
						}, _('Save Configuration')),
						' ',
						E('button', {
							'class': 'cbi-button cbi-button-action',
							'click': function() {
								formatConfig();
							}
						}, _('Format JSON')),
						' ',
						E('button', {
							'class': 'cbi-button cbi-button-reset',
							'click': function() {
								if (confirm(_('Reload configuration from file? Unsaved changes will be lost.'))) {
									loadConfig();
								}
							}
						}, _('Reload')),
						' ',
						E('span', { 'style': 'color: #666; margin-left: 10px;' }, 
							_('File: ') + configPath)
					]),
					self.configEditor
				])
			]);
		}, this);

		this.pollStatus();

		return m.render();
	},

//	handleSaveApply: null,
//	handleSave: null,
//	handleReset: null

});
