// js/7_modals_4_plugins.js
'use strict';

function openPluginDocsModal(pluginName, readmeMarkdown) {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '800px';
    modalInstance.style.height = '80vh';
    modalInstance.style.display = 'flex';
    modalInstance.style.flexDirection = 'column';

    const converter = new showdown.Converter();
    const readmeHtml = converter.makeHtml(readmeMarkdown);

    modalInstance.innerHTML = `
        <h3>${pluginName} - Documentation</h3>
        <div class="plugin-docs-content" style="flex-grow: 1; overflow-y: auto; border: 1px solid var(--modal-border-color); padding: 15px; background-color: #222; line-height: 1.6;">
            ${readmeHtml}
        </div>
        <div class="modal-buttons">
            <button class="modal-btn-cancel">Close</button>
        </div>
    `;

    const closeModal = () => {
        if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;

    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}


async function openPluginsModal() {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box plugins-modal';
    
    modalInstance.innerHTML = `
        <h3>HTVM Plugin Manager</h3>
        <div class="plugin-tabs">
            <button class="plugin-tab-btn active" data-pane="marketplace-pane">Marketplace</button>
            <button class="plugin-tab-btn" data-pane="installed-pane">Installed</button>
        </div>
        <div id="marketplace-pane" class="plugin-tab-pane active">
            <p style="font-size:0.9em; color:#ccc; margin-top:0;">Discover and install plugins from the official HTVM Marketplace.</p>
            <ul class="modal-list plugin-list" id="marketplace-list"><li>Loading...</li></ul>
        </div>
        <div id="installed-pane" class="plugin-tab-pane">
            <p style="font-size:0.9em; color:#ccc; margin-top:0;">Activate one version per plugin. Drag to re-order execution (last in list runs first).</p>
            <ul class="modal-list plugin-list" id="installed-list"><li>Loading...</li></ul>
            <div style="text-align: right; margin-top: 15px;">
                <button id="save-plugins-btn" class="modal-btn-confirm">Save Activation & Order</button>
            </div>
        </div>
        <div class="modal-buttons">
            <button id="load-local-plugin-btn" style="float: left; background-color: #6a0dad;">Test Local Plugin(s)...</button>
            <button class="modal-btn-cancel">Close</button>
        </div>
    `;

    const closeModal = () => {
        if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if (overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;
    
    modalInstance.querySelector('#load-local-plugin-btn').onclick = async () => {
        const result = await window.electronAPI.pluginsLoadLocal();
        if (!result.success || !result.plugins || result.plugins.length === 0) {
            if (result.error !== 'User cancelled.') {
                alert(`Error loading local plugins:\n${result.error || 'No valid plugins were selected.'}`);
            }
            return;
        }

        let activePlugins = lsGet('active_plugin_ids') || [];
        let addedCount = 0;
        
        result.plugins.forEach(pluginData => {
            const localId = `local-dev-plugin|${pluginData.path}`;
            sessionStorage.setItem(localId, pluginData.codeContent);
            if (!activePlugins.includes(localId)) {
                activePlugins.push(localId);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            lsSet('active_plugin_ids', activePlugins);
            openConfirmModal("Load Local Plugins", `${addedCount} local plugin(s) have been loaded and activated for this session. A reload is required. Continue?`, (confirmed) => {
                if (confirmed) {
                    window.dispatchEvent(new Event('beforeunload'));
                    window.electronAPI.reloadApp();
                }
            });
        } else {
            alert("The selected local plugin(s) are already loaded for this session.");
        }
    };


    const tabs = modalInstance.querySelectorAll('.plugin-tab-btn');
    const panes = modalInstance.querySelectorAll('.plugin-tab-pane');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            modalInstance.querySelector(`#${tab.dataset.pane}`).classList.add('active');
        };
    });

    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');

    const installedListEl = modalInstance.querySelector('#installed-list');
    const marketplaceListEl = modalInstance.querySelector('#marketplace-list');
    let draggedPluginItem = null;

    const renderInstalled = async () => {
        const installedPlugins = await window.electronAPI.pluginsGetInstalled(); // This is now a flat list of {id, version, ...}
        const activePluginIds = lsGet('active_plugin_ids') || [];
        installedListEl.innerHTML = '';

        const groupedPlugins = installedPlugins.reduce((acc, p) => {
            (acc[p.id] = acc[p.id] || []).push(p);
            return acc;
        }, {});
        
        // Also group local dev plugins
        activePluginIds.filter(id => id.startsWith('local-dev-plugin|')).forEach(localId => {
            const fakeManifest = { id: localId, name: `Local Plugin`, version: 'dev', description: localId.split('|')[1] };
            (groupedPlugins[localId] = groupedPlugins[localId] || []).push(fakeManifest);
        });

        const sortedGroupKeys = Object.keys(groupedPlugins).sort((a,b) => a.localeCompare(b));

        if (sortedGroupKeys.length === 0) {
            installedListEl.innerHTML = `<li class='no-sessions'>No plugins installed.</li>`;
            return;
        }

        sortedGroupKeys.forEach(pluginId => {
            const versions = groupedPlugins[pluginId];
            const activeVersion = versions.find(v => activePluginIds.includes(pluginId === v.id ? v.id : `${pluginId}|${v.version}`));

            let versionsHtml = versions.map(v => {
                const isLocal = v.id.startsWith('local-dev-plugin|');
                const uniqueId = isLocal ? v.id : `${pluginId}|${v.version}`;
                const isChecked = activePluginIds.includes(uniqueId);
                return `
                    <div class="plugin-version-item" style="padding-left: 30px; margin: 5px 0;">
                        <label class="plugin-activation-toggle" title="Activate this version">
                            <input type="radio" name="active-version-${pluginId}" data-unique-id="${uniqueId}" ${isChecked ? 'checked' : ''}>
                            Version ${v.version}
                        </label>
                        ${isLocal ? `<button class="delete-local-btn" data-unique-id="${uniqueId}">Deactivate</button>` : ''}
                    </div>
                `;
            }).join('');
            
            const firstVersion = versions[0];
            const li = document.createElement('li');
            li.dataset.id = pluginId;
            li.draggable = true;

            li.innerHTML = `
                <div class="plugin-drag-handle">::</div>
                <div class="plugin-info">
                    <strong>${firstVersion.name}</strong>
                    <span>by ${firstVersion.author || 'Unknown'}</span>
                    <p>${firstVersion.description}</p>
                    <div class="plugin-versions-container">${versionsHtml}</div>
                </div>
                <div class="plugin-controls">
                    <button class="details-btn">View Details</button>
                    <button class="delete-btn modal-btn-reset">Delete</button>
                </div>
            `;
            
            if (pluginId.startsWith('local-dev-plugin')) {
                li.querySelector('.details-btn').style.display = 'none';
                li.querySelector('.delete-btn').style.display = 'none';
            }

            li.querySelector('.details-btn').onclick = async () => {
                // The new marketplace structure requires a folder name per version.
                // For installed plugins, the folder name IS the version string.
                const version = activeVersion?.version || firstVersion.version;
                const readmeContent = await window.electronAPI.pluginsFetchReadme(pluginId, version, version);
                openPluginDocsModal(firstVersion.name, readmeContent);
            };

            li.querySelector('.delete-btn').onclick = () => {
                openConfirmModal("Delete All Versions", `Permanently delete "${firstVersion.name}" and all its installed versions?`, async (confirmed) => {
                    if (confirmed) {
                        await window.electronAPI.pluginsDelete(pluginId);
                        let currentActive = lsGet('active_plugin_ids') || [];
                        lsSet('active_plugin_ids', currentActive.filter(id => !id.startsWith(pluginId + '|')));
                        await renderInstalled();
                        await renderMarketplace();
                    }
                });
            };
            
            li.querySelectorAll('.delete-local-btn').forEach(btn => {
                btn.onclick = () => {
                    let activeIds = lsGet('active_plugin_ids') || [];
                    const uniqueId = btn.dataset.uniqueId;
                    lsSet('active_plugin_ids', activeIds.filter(id => id !== uniqueId));
                    sessionStorage.removeItem(uniqueId);
                    alert("Local dev plugin deactivated. Save changes and reload to apply.");
                    renderInstalled();
                };
            });
            
            installedListEl.appendChild(li);
        });
    };

    // Drag and Drop for reordering
    installedListEl.addEventListener('dragstart', (e) => {
        if(e.target.tagName === 'LI') {
            draggedPluginItem = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });
    installedListEl.addEventListener('dragend', (e) => {
        if(draggedPluginItem) draggedPluginItem.classList.remove('dragging');
        draggedPluginItem = null;
    });
    installedListEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = [...installedListEl.querySelectorAll('li:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        
        if (afterElement == null) {
            installedListEl.appendChild(draggedPluginItem);
        } else {
            installedListEl.insertBefore(draggedPluginItem, afterElement);
        }
    });

    modalInstance.querySelector('#save-plugins-btn').onclick = () => {
        const newActiveOrder = [];
        installedListEl.querySelectorAll('li').forEach(li => {
            const checkedRadio = li.querySelector('input[type="radio"]:checked');
            if(checkedRadio) {
                newActiveOrder.push(checkedRadio.dataset.uniqueId);
            }
        });
        
        const currentActive = lsGet('active_plugin_ids') || [];
        const isSame = currentActive.length === newActiveOrder.length && currentActive.every((v, i) => v === newActiveOrder[i]);

        if (isSame) {
            return alert("No changes to save.");
        }

        lsSet('active_plugin_ids', newActiveOrder);
        openConfirmModal("Reload Required", "Plugin activation and order have been saved. A reload is required to apply changes. Reload now?", (confirmed) => {
            if (confirmed) {
                window.dispatchEvent(new Event('beforeunload'));
                window.electronAPI.reloadApp();
            }
        });
    };

    const handleInstall = async (pluginId, version, versionFolderName, installButton) => {
        installButton.textContent = 'Installing...';
        installButton.disabled = true;
    
        try {
            const result = await window.electronAPI.pluginsInstall(pluginId, version, versionFolderName);
    
            if (result.success) {
                alert(`Plugin "${pluginId}" v${version} installed successfully! You can now activate it in the 'Installed' tab.`);
                await renderInstalled();
                await renderMarketplace();
            } else {
                alert(`Failed to install plugin: ${result.error}`);
                installButton.textContent = 'Install';
                installButton.disabled = false;
            }
    
        } catch (e) {
            alert(`An error occurred during installation: ${e.message}`);
            installButton.textContent = 'Install';
            installButton.disabled = false;
        }
    };
    
    const renderMarketplace = async () => {
        const marketplacePlugins = await window.electronAPI.pluginsFetchMarketplace();
        const installedPlugins = await window.electronAPI.pluginsGetInstalled();
        marketplaceListEl.innerHTML = '';

        if (marketplacePlugins.error) {
            marketplaceListEl.innerHTML = `<li class='no-sessions'>Error: Could not load marketplace. ${marketplacePlugins.error}</li>`;
            return;
        }
        if (marketplacePlugins.length === 0) {
            marketplaceListEl.innerHTML = `<li class='no-sessions'>Marketplace is empty.</li>`;
            return;
        }

        for (const plugin of marketplacePlugins) {
            const installedVersions = installedPlugins.filter(p => p.id === plugin.id).map(p => p.version);
            
            const li = document.createElement('li');
            
            const versionOptions = plugin.allVersions.map(v => `<option value="${v}">${v}${installedVersions.includes(v) ? ' (installed)' : ''}</option>`).join('');

            li.innerHTML = `
                <div class="plugin-info">
                    <strong>${plugin.name}</strong>
                    <span>Latest: v${plugin.latestVersion} by ${plugin.author || 'Unknown'}</span>
                    <p>${plugin.description}</p>
                </div>
                <div class="plugin-controls">
                    <button class="details-btn" style="background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text);">Details</button>
                    <select class="version-select" style="margin: 0 8px;">${versionOptions}</select>
                    <button class="install-btn modal-btn-confirm">Install</button>
                </div>
            `;
            marketplaceListEl.appendChild(li);

            const installBtn = li.querySelector('.install-btn');
            const versionSelect = li.querySelector('.version-select');
            const detailsBtn = li.querySelector('.details-btn');
            
            detailsBtn.onclick = async () => {
                const selectedVersion = versionSelect.value;
                const versionData = plugin._versionsData[selectedVersion];
                if (!versionData || !versionData.folderName) {
                    alert(`Error: Could not find folder name for version ${selectedVersion}.`);
                    return;
                }
                detailsBtn.textContent = 'Loading...';
                detailsBtn.disabled = true;
                const readmeContent = await window.electronAPI.pluginsFetchReadme(plugin.id, selectedVersion, versionData.folderName);
                openPluginDocsModal(plugin.name, readmeContent);
                detailsBtn.textContent = 'Details';
                detailsBtn.disabled = false;
            };
            
            const updateInstallButton = () => {
                const selectedVersion = versionSelect.value;
                if(installedVersions.includes(selectedVersion)) {
                    installBtn.textContent = 'Installed';
                    installBtn.disabled = true;
                } else {
                    installBtn.textContent = 'Install';
                    installBtn.disabled = false;
                }
            };
            
            versionSelect.onchange = updateInstallButton;
            installBtn.onclick = () => {
                const selectedVersion = versionSelect.value;
                const versionData = plugin._versionsData[selectedVersion];
                if (!versionData || !versionData.folderName) {
                    alert(`Error: Could not find folder name for version ${selectedVersion}. The marketplace manifest might be malformed.`);
                    return;
                }
                handleInstall(plugin.id, selectedVersion, versionData.folderName, installBtn);
            };

            updateInstallButton(); // Initial check
        }
    };

    await renderInstalled();
    await renderMarketplace();
}