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
            <p style="font-size:0.9em; color:#ccc; margin-top:0;">Activate multiple plugins using the checkboxes. Drag to re-order. The last plugin in the list runs first.</p>
            <ul class="modal-list plugin-list" id="installed-list"><li>Loading...</li></ul>
            <div style="text-align: right; margin-top: 15px;">
                <button id="save-plugins-btn" class="modal-btn-confirm">Save Activation & Order</button>
            </div>
        </div>
        <div class="modal-buttons">
            <button id="load-local-plugin-btn" style="float: left; background-color: #6a0dad;">Test Local Plugin...</button>
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
        if (result === null) return; // User cancelled
        if (result.error) {
            alert(`Error loading local plugin:\n${result.error}`);
            return;
        }

        sessionStorage.setItem('temp_local_plugin_code', result);
        
        // Add to the active list instead of just setting it
        let activePlugins = lsGet('active_plugin_ids') || [];
        if (!activePlugins.includes('local-dev-plugin')) {
            activePlugins.push('local-dev-plugin');
            lsSet('active_plugin_ids', activePlugins);
        }

        openConfirmModal("Load Local Plugin", "Local plugin has been loaded and activated for this session. A reload is required. Continue?", (confirmed) => {
            if (confirmed) {
                window.dispatchEvent(new Event('beforeunload'));
                window.electronAPI.reloadApp();
            }
        });
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
        const installedPlugins = await window.electronAPI.pluginsGetInstalled();
        const activePluginIds = lsGet('active_plugin_ids') || [];
        installedListEl.innerHTML = '';

        // Sort installed plugins based on the active order
        const sortedInstalled = [...installedPlugins].sort((a, b) => {
            const indexA = activePluginIds.indexOf(a.id);
            const indexB = activePluginIds.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        if (activePluginIds.includes('local-dev-plugin')) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="plugin-info">
                    <strong>Local Development Plugin</strong>
                    <span>Loaded from your computer</span>
                    <p>Testing plugin.</p>
                </div>
                <div class="plugin-controls">
                    <label class="plugin-activation-toggle"><input type="checkbox" data-id="local-dev-plugin" checked> Active</label>
                    <button class="delete-local-btn modal-btn-reset">Deactivate</button>
                </div>
            `;
            const deleteBtn = li.querySelector('.delete-local-btn');
            if (deleteBtn) {
                 deleteBtn.onclick = () => {
                    let activeIds = lsGet('active_plugin_ids') || [];
                    lsSet('active_plugin_ids', activeIds.filter(id => id !== 'local-dev-plugin'));
                    sessionStorage.removeItem('temp_local_plugin_code');
                    alert("Local dev plugin deactivated. Save changes and reload to apply.");
                    renderInstalled();
                }
            }
            installedListEl.appendChild(li);
        }

        if (sortedInstalled.length === 0 && !activePluginIds.includes('local-dev-plugin')) {
            installedListEl.innerHTML = `<li class='no-sessions'>No plugins installed.</li>`;
            return;
        }

        sortedInstalled.forEach(plugin => {
            const li = document.createElement('li');
            li.dataset.id = plugin.id;
            li.draggable = true;
            const isActive = activePluginIds.includes(plugin.id);
            
            li.innerHTML = `
                <div class="plugin-drag-handle">::</div>
                <div class="plugin-info">
                    <strong>${plugin.name}</strong>
                    <span>v${plugin.version} by ${plugin.author || 'Unknown'}</span>
                    <p>${plugin.description}</p>
                </div>
                <div class="plugin-controls">
                    <label class="plugin-activation-toggle"><input type="checkbox" data-id="${plugin.id}" ${isActive ? 'checked' : ''}> Active</label>
                    <button class="details-btn">View Details</button>
                    <button class="delete-btn modal-btn-reset">Delete</button>
                </div>
            `;
            
            li.querySelector('.details-btn').onclick = async () => {
                const readmeContent = await window.electronAPI.pluginsFetchReadme(plugin.id);
                openPluginDocsModal(plugin.name, readmeContent);
            };
            
            li.querySelector('.delete-btn').onclick = () => {
                openConfirmModal("Delete Plugin", `Permanently delete "${plugin.name}"?`, async (confirmed) => {
                    if (confirmed) {
                        const result = await window.electronAPI.pluginsDelete(plugin.id);
                        if (result.success) {
                            if (isActive) {
                                let activeIds = lsGet('active_plugin_ids') || [];
                                lsSet('active_plugin_ids', activeIds.filter(id => id !== plugin.id));
                            }
                            await renderInstalled();
                            await renderMarketplace();
                        } else {
                            alert(`Error deleting plugin: ${result.error}`);
                        }
                    }
                });
            };
            
            installedListEl.appendChild(li);
        });
    };

    // Drag and Drop for reordering
    installedListEl.addEventListener('dragstart', (e) => {
        draggedPluginItem = e.target;
        setTimeout(() => e.target.classList.add('dragging'), 0);
    });
    installedListEl.addEventListener('dragend', (e) => {
        draggedPluginItem.classList.remove('dragging');
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
        installedListEl.querySelectorAll('li input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.checked) {
                newActiveOrder.push(checkbox.dataset.id);
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

    const handleInstall = async (pluginName) => {
        try {
            const manifestUrl = `https://api.github.com/repos/TheMaster1127/htvm-marketplace/contents/main/${pluginName}/plugin.json`;
            const manifestContent = await window.electronAPI.pluginsFetchFile(manifestUrl);
            const manifest = JSON.parse(manifestContent);

            const codeUrl = `https://api.github.com/repos/TheMaster1127/htvm-marketplace/contents/main/${pluginName}/${manifest.main}`;
            const codeContent = await window.electronAPI.pluginsFetchFile(codeUrl);
            
            const filesToInstall = [
                { name: 'plugin.json', content: manifestContent },
                { name: manifest.main, content: codeContent }
            ];

            try {
                const readmeContent = await window.electronAPI.pluginsFetchReadme(pluginName);
                if (!readmeContent.includes("No README.md found")) {
                    filesToInstall.push({ name: 'README.md', content: readmeContent });
                }
            } catch {}


            const result = await window.electronAPI.pluginsInstall(pluginName, filesToInstall);

            if (result.success) {
                alert(`Plugin "${manifest.name}" installed successfully! You can now activate it in the 'Installed' tab.`);
                await renderInstalled();
                await renderMarketplace();
            } else {
                alert(`Failed to install plugin: ${result.error}`);
            }

        } catch (e) {
            alert(`An error occurred during installation: ${e.message}`);
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
            const isInstalled = installedPlugins.some(p => p.id === plugin.name);
            const li = document.createElement('li');
            
            let installButtonHtml = isInstalled 
                ? '<button disabled>Installed</button>'
                : '<button class="install-btn modal-btn-confirm">Install</button>';

            li.innerHTML = `
                <div class="plugin-info">
                    <strong>${plugin.name}</strong>
                    <p>Fetching details...</p>
                </div>
                <div class="plugin-controls">
                    <button class="details-btn">View Details</button>
                    ${installButtonHtml}
                </div>
            `;
            marketplaceListEl.appendChild(li);

            li.querySelector('.details-btn').onclick = async () => {
                const readmeContent = await window.electronAPI.pluginsFetchReadme(plugin.name);
                openPluginDocsModal(plugin.name, readmeContent);
            };

            try {
                const manifestUrl = `https://api.github.com/repos/TheMaster1127/htvm-marketplace/contents/main/${plugin.name}/plugin.json`;
                const manifestContent = await window.electronAPI.pluginsFetchFile(manifestUrl);
                const manifest = JSON.parse(manifestContent);
                
                li.querySelector('.plugin-info').innerHTML = `
                    <strong>${manifest.name}</strong>
                    <span>v${manifest.version} by ${manifest.author || 'Unknown'}</span>
                    <p>${manifest.description}</p>
                `;
            } catch (e) {
                li.querySelector('p').textContent = 'Could not load plugin details.';
                li.querySelector('.details-btn').disabled = true;
                li.querySelector('.install-btn').disabled = true;
            }

            if (!isInstalled) {
                li.querySelector('.install-btn').onclick = () => handleInstall(plugin.name);
            }
        }
    };

    await renderInstalled();
    await renderMarketplace();
}