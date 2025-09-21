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
            <p style="font-size:0.9em; color:#ccc; margin-top:0;">Manage your installed plugins. Only one plugin can be active at a time.</p>
            <ul class="modal-list plugin-list" id="installed-list"><li>Loading...</li></ul>
        </div>
        <div class="modal-buttons">
            <button class="modal-btn-cancel">Close</button>
        </div>
    `;

    const closeModal = () => {
        if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if (overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;

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

    const renderInstalled = async () => {
        const installedPlugins = await window.electronAPI.pluginsGetInstalled();
        const activePluginId = lsGet('active_plugin_id');
        installedListEl.innerHTML = '';

        if (installedPlugins.length === 0) {
            installedListEl.innerHTML = `<li class='no-sessions'>No plugins installed.</li>`;
            return;
        }

        installedPlugins.forEach(plugin => {
            const li = document.createElement('li');
            const isActive = plugin.id === activePluginId;
            
            let actionButtonHtml = isActive 
                ? '<button class="deactivate-btn modal-btn-cancel">Deactivate</button>' 
                : '<button class="activate-btn modal-btn-confirm">Activate</button>';
            
            li.innerHTML = `
                <div class="plugin-info">
                    <strong>${plugin.name}</strong>
                    <!-- MODIFIED: Added author name -->
                    <span>v${plugin.version} by ${plugin.author || 'Unknown'}</span>
                    <p>${plugin.description}</p>
                </div>
                <div class="plugin-controls">
                    ${isActive ? '<span class="plugin-active-indicator">✔ Active</span>' : ''}
                    <button class="details-btn">View Details</button>
                    ${actionButtonHtml}
                    <button class="delete-btn modal-btn-reset">Delete</button>
                </div>
            `;
            
            li.querySelector('.details-btn').onclick = async () => {
                const readmeContent = await window.electronAPI.pluginsFetchReadme(plugin.id);
                openPluginDocsModal(plugin.name, readmeContent);
            };

            const activateBtn = li.querySelector('.activate-btn');
            if (activateBtn) {
                activateBtn.onclick = () => {
                    openConfirmModal("Activate Plugin", `Activating a plugin requires an IDE reload. Continue?`, (confirmed) => {
                        if (confirmed) {
                            lsSet('active_plugin_id', plugin.id);
                            window.dispatchEvent(new Event('beforeunload'));
                            window.electronAPI.reloadApp();
                        }
                    });
                };
            }
            
            const deactivateBtn = li.querySelector('.deactivate-btn');
            if (deactivateBtn) {
                deactivateBtn.onclick = () => {
                     openConfirmModal("Deactivate Plugin", `Deactivating this plugin requires an IDE reload. Continue?`, (confirmed) => {
                        if (confirmed) {
                            lsRemove('active_plugin_id');
                            window.dispatchEvent(new Event('beforeunload'));
                            window.electronAPI.reloadApp();
                        }
                    });
                }
            }
            
            li.querySelector('.delete-btn').onclick = () => {
                openConfirmModal("Delete Plugin", `Permanently delete "${plugin.name}"?`, async (confirmed) => {
                    if (confirmed) {
                        const result = await window.electronAPI.pluginsDelete(plugin.id);
                        if (result.success) {
                            if (isActive) {
                                lsRemove('active_plugin_id');
                                alert("The active plugin was deleted. The IDE will now reload.");
                                window.dispatchEvent(new Event('beforeunload'));
                                window.electronAPI.reloadApp();
                            } else {
                                await renderInstalled();
                                await renderMarketplace();
                            }
                        } else {
                            alert(`Error deleting plugin: ${result.error}`);
                        }
                    }
                });
            };
            
            installedListEl.appendChild(li);
        });
    };

    const handleInstall = async (pluginName, andActivate) => {
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
                if (andActivate) {
                    openConfirmModal("Install & Activate Plugin", `Plugin "${manifest.name}" was installed. Activating requires an IDE reload. Continue?`, (confirmed) => {
                        if (confirmed) {
                            lsSet('active_plugin_id', pluginName);
                            window.dispatchEvent(new Event('beforeunload'));
                            window.electronAPI.reloadApp();
                        }
                    });
                } else {
                    alert(`Plugin "${manifest.name}" installed successfully!`);
                    await renderInstalled();
                    await renderMarketplace();
                }
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
            
            // MODIFIED: Added new "Install & Activate" button
            let installButtonsHtml = '';
            if (isInstalled) {
                installButtonsHtml = '<button disabled>Installed</button>';
            } else {
                installButtonsHtml = `
                    <button class="install-btn modal-btn-confirm">Install</button>
                    <button class="install-activate-btn" style="background-color: #0e639c;">Install & Activate</button>
                `;
            }

            li.innerHTML = `
                <div class="plugin-info">
                    <strong>${plugin.name}</strong>
                    <p>Fetching details...</p>
                </div>
                <div class="plugin-controls">
                    <button class="details-btn">View Details</button>
                    ${installButtonsHtml}
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
                
                // MODIFIED: Added author name
                li.querySelector('.plugin-info').innerHTML = `
                    <strong>${manifest.name}</strong>
                    <span>v${manifest.version} by ${manifest.author || 'Unknown'}</span>
                    <p>${manifest.description}</p>
                `;
            } catch (e) {
                li.querySelector('p').textContent = 'Could not load plugin details.';
                li.querySelector('.details-btn').disabled = true;
                li.querySelectorAll('.install-btn, .install-activate-btn').forEach(b => b.disabled = true);
            }

            if (!isInstalled) {
                li.querySelector('.install-btn').onclick = () => handleInstall(plugin.name, false);
                li.querySelector('.install-activate-btn').onclick = () => handleInstall(plugin.name, true);
            }
        }
    };

    await renderInstalled();
    await renderMarketplace();
}