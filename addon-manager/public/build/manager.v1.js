/* Addon Manager: prebuilt, dependency-free admin client. */
(() => {
    'use strict';

    const root = document.getElementById('addon-manager');
    if (!root) return;
    const byId = (id) => document.getElementById(id);
    const apiBase = root.dataset.apiBase.replace(/\/$/, '');
    const csrf = root.dataset.csrfToken;
    const storageKey = `addon-manager:v1:${location.origin}:${root.dataset.actor || ''}:${apiBase}`;
    const actions = new Set(['install', 'update', 'enable', 'disable', 'delete']);
    const terminalStatuses = new Set(['succeeded', 'failed', 'recovered']);
    const statusLabels = { queued: 'Queued', running: 'In progress', succeeded: 'Completed', failed: 'Failed', recovery_required: 'Recovery required', recovered: 'Recovered' };
    const phaseLabels = { queued: 'Waiting for the worker', download: 'Downloading package', downloading: 'Downloading package', package: 'Verifying package', validate: 'Verifying package', validating: 'Verifying package', validation: 'Validating the installation', verification: 'Verifying package', plan: 'Checking dependencies', planning: 'Checking dependencies', staging: 'Preparing installation', stage: 'Preparing installation', build: 'Building assets', building: 'Building assets', backup: 'Preparing recovery backups', maintenance: 'Panel maintenance', activate: 'Activating changes', activation: 'Activating changes', migration: 'Applying additive database changes', health: 'Checking Panel health', health_check: 'Checking Panel health', complete: 'Finished', completed: 'Finished', failed: 'Failed', recovery: 'Recovering files', recovered: 'Files recovered', rollback: 'Restoring files' };
    const state = { addons: [], loaded: false, registryAvailable: false, loading: false, reloadRequested: false, pending: null, operation: null, modal: null, dialogRevision: 0, submitting: false, recovering: false, polling: false, pollTimer: null, retryCount: 0, storageWarning: false, previousFocus: null, previousOverflow: '' };

    // Every package-controlled string is inserted as text, never as markup.
    function element(tag, className, value) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined && value !== null) node.textContent = String(value);
        return node;
    }
    function textValue(value, fallback = '') {
        return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
    }
    function truncate(value, max = 700) {
        const text = textValue(value);
        return text.length > max ? `${text.slice(0, max)}…` : text;
    }
    function prettyLabel(value) {
        return textValue(value).replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
    }
    function button(label, handler, options = {}) {
        const node = element('button', `am-button am-button--small ${options.className || ''}`, label);
        node.type = 'button';
        node.disabled = Boolean(options.disabled);
        if (options.label) node.setAttribute('aria-label', options.label);
        node.addEventListener('click', handler);
        return node;
    }
    function notice(message = '') {
        byId('am-notice').textContent = message;
        byId('am-notice').hidden = !message;
    }
    function connection(connected, message) {
        byId('am-connection').dataset.state = connected ? 'connected' : 'disconnected';
        byId('am-connection').textContent = message || (connected ? 'Connected to your Panel' : 'Connection interrupted — retrying');
    }
    function busy() {
        return state.submitting || Boolean(state.pending) || Boolean(state.operation && !terminalStatuses.has(state.operation.status));
    }
    function mutationAvailable() {
        return state.loaded && state.registryAvailable && !state.loading && !busy();
    }
    function selectionIsCurrent(modal) {
        if (!modal.addon) return true;
        const current = state.addons.find((addon) => addon.id === modal.addon.id);
        const signature = (addon) => [addon.id, addon.name, addon.version, addon.enabled, addon.packageDigest, addon.dependencies];
        if (!current || JSON.stringify(signature(current)) !== JSON.stringify(signature(modal.addon))) return false;
        if (modal.action !== 'disable' && modal.action !== 'delete') return true;
        const signatures = (addons) => JSON.stringify(addons.map(signature).sort((a, b) => a[0].localeCompare(b[0])));
        return signatures(dependents(current.id, modal.action !== 'delete')) === signatures(modal.affected);
    }
    function syncButtons() {
        byId('am-install').disabled = !mutationAvailable();
        byId('am-empty-install').disabled = !mutationAvailable();
        byId('am-refresh').disabled = state.loading;
        root.querySelectorAll('[data-mutation]').forEach((node) => { node.disabled = !mutationAvailable(); });
        if (state.modal && state.modal.type === 'action') {
            const current = selectionIsCurrent(state.modal);
            const cascade = byId('am-cascade');
            byId('am-dialog-submit').disabled = !mutationAvailable() || !current || Boolean(cascade && !cascade.checked);
            if (!current) {
                byId('am-dialog-error').textContent = 'Installed addons changed while this dialog was open. Close it and review the action again.';
                byId('am-dialog-error').hidden = false;
            }
        }
    }
    function persistence() {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ pending: state.pending, operationId: state.operation && state.operation.id, operationStatus: state.operation && state.operation.status }));
        } catch (_) {
            if (!state.storageWarning) {
                state.storageWarning = true;
                notice('This browser cannot save operation progress. Keep this page open until the operation finishes and save its operation ID.');
            }
        }
    }
    function validGitHubUrl(value, packageRequired = true) {
        try {
            if (typeof value !== 'string' || value.length > 2048) return false;
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.hash) return false;
            // Previously submitted requests must keep their exact arguments on replay.
            if (!packageRequired) return url.pathname.split('/').filter(Boolean).length >= 2;
            if (url.href.includes('?') || url.href.includes('#')) return false;
            const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
            if (parts.length < 4 || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(parts[0]) || !/^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]) || ['.', '..'].includes(parts[1])) return false;
            if (parts[2] === 'tree') return parts.slice(3).every(Boolean);
            if (parts[2] === 'commit') return parts.length === 4 && /^[a-fA-F0-9]{40}$/.test(parts[3]);
            if (parts[2] === 'archive') return parts.slice(3).every(Boolean) && /\.zip$/.test(parts[parts.length - 1]);
            return parts[2] === 'releases' && parts[3] === 'download' && parts.length === 6 && Boolean(parts[4]) && /\.zip$/i.test(parts[5]);
        } catch (_) { return false; }
    }
    function requestId() {
        if (crypto.randomUUID) return crypto.randomUUID();
        return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    function restore() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (!saved || typeof saved !== 'object') return;
            state.pending = null;
            state.operation = null;
            if (saved.pending && saved.pending.body) {
                const body = saved.pending.body;
                if (actions.has(body.action) && typeof body.requestId === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(body.requestId)
                    && (!body.url || validGitHubUrl(body.url, false)) && (!body.addonId || typeof body.addonId === 'string')
                    && (body.expectedAffectedIds === undefined || (Array.isArray(body.expectedAffectedIds) && body.expectedAffectedIds.every((id) => typeof id === 'string')))) {
                    state.pending = { body: { action: body.action, requestId: body.requestId, ...(body.addonId ? { addonId: body.addonId } : {}), ...(body.url ? { url: body.url } : {}), ...(typeof body.cascade === 'boolean' ? { cascade: body.cascade } : {}), ...(body.expectedAffectedIds ? { expectedAffectedIds: body.expectedAffectedIds } : {}) }, createdAt: saved.pending.createdAt, ambiguous: true };
                }
            }
            if (typeof saved.operationId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(saved.operationId)) {
                state.operation = { id: saved.operationId, status: 'queued', message: 'Reconnecting to the recorded operation…' };
                // An acknowledged operation must never be submitted again.
                state.pending = null;
            }
        } catch (_) { /* Private browsing and expired browser state do not prevent use. */ }
    }
    function flattenErrors(errors, output = []) {
        if (output.length >= 30 || errors === undefined || errors === null) return output;
        if (typeof errors === 'string') output.push(truncate(errors, 1800));
        else if (Array.isArray(errors)) errors.slice(0, 30).forEach((error) => flattenErrors(error, output));
        else if (typeof errors === 'object') Object.entries(errors).slice(0, 30).forEach(([key, error]) => {
            if (typeof error === 'string') output.push(`${prettyLabel(key)}: ${truncate(error, 1800)}`);
            else flattenErrors(error, output);
        });
        return output;
    }
    function errorMessage(status, message) {
        if (status === 400) return `${truncate(message, 1800) || 'The Panel blocked this request.'} Check your administrator session and two-factor authentication, then reload this page.`;
        if (status === 401 || status === 403) return 'Your administrator session is unavailable or access was denied. Sign in as a root administrator, then reload this page.';
        if (status === 419) return 'Your session has expired. Reload this page to renew it before submitting another change.';
        if (status === 429) return 'The manager is receiving too many requests. Wait a moment and try again.';
        if (status >= 500) return 'The Panel is temporarily unavailable. The manager will reconnect using the same operation request.';
        return truncate(message, 2400) || 'The manager could not complete this request. Check the details and try again.';
    }
    async function api(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`${apiBase}${path}`, {
                method: options.body ? 'POST' : 'GET',
                credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(options.body ? { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, 'X-Addon-Manager-Actor': root.dataset.actor || '' } : {}) },
                ...(options.body ? { body: JSON.stringify(options.body) } : {})
            });
            let payload;
            try { payload = await response.json(); } catch (_) { payload = {}; }
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
            if (!response.ok) {
                const error = new Error(errorMessage(response.status, payload.message));
                error.status = response.status;
                error.details = flattenErrors(payload.errors);
                error.uncertain = response.status >= 500 || Boolean(options.body && ![400, 401, 403, 419, 422, 429].includes(response.status));
                throw error;
            }
            if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
                const error = new Error('The Panel returned an unexpected response. Reconnecting to the same operation request.');
                error.uncertain = true;
                throw error;
            }
            connection(true);
            return payload.data;
        } catch (error) {
            if (!error.status) {
                error.uncertain = true;
                error.message = 'Unable to reach the Panel. Your operation is retained; reconnecting will not create another request.';
            }
            throw error;
        } finally { clearTimeout(timeout); }
    }
    function normalizeAddon(record, key) {
        if (!record || typeof record !== 'object') return null;
        const manifest = record.manifest && typeof record.manifest === 'object' ? record.manifest : {};
        return { ...record, manifest, id: textValue(record.id || manifest.id || key), name: textValue(record.name || manifest.name || record.id || key, 'Unnamed addon'), version: textValue(record.version || manifest.version, 'Unknown'), enabled: record.enabled === true, dependencies: Array.isArray(record.dependencies) ? record.dependencies : (Array.isArray(manifest.dependencies) ? manifest.dependencies : []) };
    }
    async function loadAddons() {
        if (state.loading) { state.reloadRequested = true; return; }
        state.loading = true;
        syncButtons();
        try {
            const data = await api('/addons');
            const records = data && data.addons ? data.addons : data;
            if (!records || typeof records !== 'object') throw new Error('The manager returned an invalid addon registry.');
            state.addons = Object.entries(records).map(([key, record]) => normalizeAddon(record, key)).filter((addon) => addon && addon.id).sort((a, b) => a.name.localeCompare(b.name));
            state.loaded = true;
            state.registryAvailable = true;
            byId('am-loading').hidden = true;
            if (!state.storageWarning) notice();
            renderAddons();
        } catch (error) {
            state.registryAvailable = false;
            connection(false, 'Cannot reach the addon registry');
            notice(error.message);
            byId('am-loading').hidden = true;
            if (!state.loaded) {
                byId('am-empty').hidden = false;
                byId('am-empty-title').textContent = 'The addon registry is unavailable';
                byId('am-empty-copy').textContent = 'Use Refresh to reconnect. Existing operations remain recorded.';
                byId('am-empty-install').hidden = true;
            }
        } finally {
            state.loading = false; syncButtons();
            if (state.reloadRequested) { state.reloadRequested = false; loadAddons(); }
        }
    }
    function dependents(addonId, enabledOnly = false) {
        const found = new Set();
        const queue = [addonId];
        for (let index = 0; index < queue.length; index++) {
            const dependencyId = queue[index];
            state.addons.forEach((addon) => {
                if (addon.id !== addonId && !found.has(addon.id) && addon.dependencies.some((dep) => dep && dep.id === dependencyId)) {
                    found.add(addon.id); queue.push(addon.id);
                }
            });
        }
        return state.addons.filter((addon) => found.has(addon.id) && (!enabledOnly || addon.enabled));
    }
    function dependencyWarnings(addon) {
        return addon.dependencies.flatMap((dependency) => {
            if (!dependency || !dependency.id) return [];
            const installed = state.addons.find((item) => item.id === dependency.id);
            if (!installed) return [`Missing dependency: ${textValue(dependency.id)}`];
            if (!installed.enabled) return [`Dependency is disabled: ${installed.name}`];
            return [];
        });
    }
    function compatibilityText(addon) {
        const compatibility = addon.manifest.compatibility || {};
        return ['panel', 'arix', 'addonPack', 'php', 'manager'].filter((key) => typeof compatibility[key] === 'string').map((key) => `${({ panel: 'Panel', arix: 'Arix', addonPack: 'Addon Pack', php: 'PHP', manager: 'Manager' })[key]} ${compatibility[key]}`);
    }
    function renderAddons() {
        const search = byId('am-search').value.trim().toLocaleLowerCase();
        const filter = byId('am-filter').value;
        const visible = state.addons.filter((addon) => (!search || `${addon.name} ${addon.id}`.toLocaleLowerCase().includes(search)) && (filter === 'all' || (filter === 'enabled') === addon.enabled));
        byId('am-count-total').textContent = state.addons.length;
        byId('am-count-enabled').textContent = state.addons.filter((addon) => addon.enabled).length;
        byId('am-count-disabled').textContent = state.addons.filter((addon) => !addon.enabled).length;
        byId('am-result-count').textContent = `${visible.length} ${visible.length === 1 ? 'addon' : 'addons'}`;
        byId('am-table-wrap').hidden = visible.length === 0;
        byId('am-empty').hidden = visible.length > 0;
        const filtered = state.addons.length > 0;
        byId('am-empty-title').textContent = filtered ? 'No addons match your filters' : 'Ready for your first addon';
        byId('am-empty-copy').textContent = filtered ? 'Try another name or show all statuses.' : 'Install an addon using its public GitHub package URL.';
        byId('am-empty-install').hidden = filtered;
        const tbody = byId('am-addons');
        tbody.replaceChildren();
        visible.forEach((addon) => {
            const row = element('tr');
            const info = element('td');
            const title = element('div', 'am-addon-title');
            title.append(element('span', 'am-addon-avatar', addon.name.slice(0, 2).toLocaleUpperCase()));
            title.lastChild.setAttribute('aria-hidden', 'true');
            const name = element('div');
            name.append(element('span', 'am-addon-name', addon.name), element('span', 'am-addon-id', addon.id));
            title.append(name); info.append(title);
            if (addon.manifest.description) info.append(element('p', 'am-addon-description', truncate(addon.manifest.description, 220)));
            const targets = compatibilityText(addon);
            if (targets.length) info.append(element('p', 'am-addon-description', `Targets: ${targets.slice(0, 2).join(' · ')}${targets.length > 2 ? ' · more in details' : ''}`));
            const version = element('td');
            version.append(element('span', 'am-version', addon.version), element('span', `am-badge ${addon.enabled ? 'am-badge--success' : ''}`, addon.enabled ? 'Enabled' : 'Disabled'));
            if (addon.lastOperation && addon.lastOperation.status) version.append(element('div', 'am-last-result', `Last change: ${statusLabels[addon.lastOperation.status] || prettyLabel(addon.lastOperation.status)}`));
            const relations = element('td', 'am-relationships');
            const required = addon.dependencies.filter((dep) => dep && dep.id);
            relations.append(element('span', '', required.length ? `Requires ${required.map((dep) => textValue(dep.id)).join(', ')}` : 'No dependencies'));
            const usedBy = dependents(addon.id);
            if (usedBy.length) relations.append(element('span', '', `${usedBy.length} dependent ${usedBy.length === 1 ? 'addon' : 'addons'}`));
            dependencyWarnings(addon).forEach((warning) => relations.append(element('p', 'am-warning', warning)));
            const actionCell = element('td');
            const actionGroup = element('div', 'am-actions');
            const addAction = (label, action, className) => {
                const node = button(label, () => openAction(action, addon), { className, disabled: !mutationAvailable(), label: `${label} ${addon.name}` });
                node.dataset.mutation = action; actionGroup.append(node);
            };
            actionGroup.append(button('Details', () => openAddonDetails(addon), { label: `View details for ${addon.name}` }));
            addAction('Update', 'update');
            addAction(addon.enabled ? 'Disable' : 'Enable', addon.enabled ? 'disable' : 'enable');
            addAction('Delete', 'delete', 'am-button--delete');
            actionCell.append(actionGroup);
            row.append(info, version, relations, actionCell); tbody.append(row);
        });
        syncButtons();
    }
    function openDialog(title, description, modal, submitLabel = '') {
        if (byId('am-dialog').open) closeDialog();
        state.dialogRevision++;
        state.modal = modal;
        state.previousFocus = document.activeElement;
        byId('am-dialog-title').textContent = title;
        byId('am-dialog-description').textContent = description;
        byId('am-dialog-body').replaceChildren();
        byId('am-dialog-error').hidden = true;
        byId('am-dialog-submit').hidden = !submitLabel;
        byId('am-dialog-submit').disabled = false;
        byId('am-dialog-submit').textContent = submitLabel;
        byId('am-dialog-submit').className = `am-button ${modal.action === 'delete' ? 'am-button--danger' : 'am-button--primary'}`;
        byId('am-dialog-cancel').textContent = submitLabel ? 'Cancel' : 'Close';
        const dialog = byId('am-dialog');
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else { dialog.setAttribute('open', ''); dialog.setAttribute('aria-modal', 'true'); }
        state.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    function closeDialog() {
        state.dialogRevision++;
        const dialog = byId('am-dialog');
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        document.body.style.overflow = state.previousOverflow;
        state.modal = null;
        if (state.previousFocus && state.previousFocus.isConnected) state.previousFocus.focus();
        else byId('am-refresh').focus();
    }
    function infoNotice(message, type = 'info') {
        return element('div', `am-notice am-notice--${type}`, message);
    }
    function openAction(action, addon = null) {
        if (!mutationAvailable()) return;
        const affected = addon ? dependents(addon.id, action !== 'delete') : [];
        const title = action === 'install' ? 'Install an addon' : `${prettyLabel(action)} ${addon.name}`;
        const descriptions = {
            install: 'Paste a public GitHub release ZIP or a package URL pinned to a tag or commit.',
            update: 'Provide the GitHub package URL for the new version. The package must keep the same addon ID.',
            enable: 'Restore this addon’s code and registrations after checking its dependencies.',
            disable: 'Remove this addon from the active Panel while keeping it installed.',
            delete: 'Remove the selected addon’s managed code and registrations from the Panel.'
        };
        openDialog(title, descriptions[action], { type: 'action', action, addon, affected }, ({ install: 'Install addon', update: 'Update addon', enable: 'Enable addon', disable: 'Disable addon', delete: 'Delete addon' })[action]);
        const body = byId('am-dialog-body');
        if (addon && action !== 'delete') body.append(detailGrid([['Addon ID', addon.id], ['Installed version', addon.version]]));
        if (action === 'install' || action === 'update') {
            const label = element('label', '', 'GitHub package URL'); label.htmlFor = 'am-package-url';
            const input = element('input'); input.id = 'am-package-url'; input.name = 'url'; input.type = 'url'; input.required = true; input.maxLength = 2048; input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'https://github.com/owner/addon/releases/download/v1.0.0/addon.zip';
            input.setAttribute('aria-describedby', 'am-url-help');
            const help = element('p', 'am-field-help', 'Public HTTPS GitHub URLs only. Prefer a release, tag, or commit for a reviewed version. Private packages and credentials in URLs are not supported.'); help.id = 'am-url-help';
            body.append(label, input, help);
            const trust = infoNotice('Install packages only from authors you trust. Addons can run code with the Panel’s permissions.'); trust.style.marginTop = '18px'; body.append(trust);
            input.focus();
        } else {
            if (action === 'disable' || action === 'delete') {
                body.append(infoNotice(action === 'delete' ? 'Database tables and stored data are retained for every affected addon. Deleting addons does not purge their data.' : 'Addon database tables and stored data are retained. You can enable this addon again later.'));
                if (action === 'delete') {
                    body.append(element('p', '', `This action deletes ${affected.length + 1} installed ${affected.length ? 'addons' : 'addon'}:`));
                    const deleted = element('ul', 'am-impact-list');
                    [addon, ...affected].forEach((item) => deleted.append(element('li', '', `${item.name} (${item.id}) — ${item.enabled ? 'enabled' : 'disabled'}`)));
                    body.append(deleted);
                    byId('am-dialog-submit').textContent = `Delete ${affected.length + 1} ${affected.length ? 'addons' : 'addon'}`;
                }
                if (affected.length) {
                    if (action === 'disable') {
                        body.append(element('p', '', 'These enabled addons depend on this addon and must also be disabled:'));
                        const list = element('ul', 'am-impact-list'); affected.forEach((item) => list.append(element('li', '', `${item.name} (${item.id})`))); body.append(list);
                    }
                    const checkboxLabel = element('label', 'am-checkbox');
                    const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.id = 'am-cascade'; checkbox.required = true;
                    checkboxLabel.append(checkbox, element('span', '', `Also ${action === 'delete' ? 'delete' : 'disable'} these ${affected.length} dependent ${affected.length === 1 ? 'addon' : 'addons'}.`));
                    body.append(checkboxLabel);
                    byId('am-dialog-submit').disabled = true;
                    checkbox.addEventListener('change', syncButtons);
                }
            } else {
                const warnings = dependencyWarnings(addon);
                if (warnings.length) body.append(infoNotice(`${warnings.join('. ')}. The worker will verify all version requirements before enabling.`, 'warning'));
                else body.append(infoNotice('The worker will verify compatibility and dependency versions before making this addon available.'));
            }
            byId('am-dialog-cancel').focus();
        }
        body.append(element('p', 'am-field-help', 'The Panel may briefly enter maintenance while the worker activates changes.'));
        syncButtons();
    }
    function detailGrid(entries) {
        const grid = element('dl', 'am-detail-grid');
        entries.forEach(([label, value]) => { grid.append(element('dt', '', label), element('dd', '', value)); });
        return grid;
    }
    function detailSection(title, values) {
        const section = element('section', 'am-detail-section'); section.append(element('h4', '', title));
        const list = element('ul'); values.forEach((value) => list.append(element('li', '', value))); section.append(list); return section;
    }
    function openAddonDetails(addon) {
        openDialog(addon.name, textValue(addon.manifest.description, 'Installed package details and declared requirements.'), { type: 'addon', addon });
        const body = byId('am-dialog-body');
        body.append(detailGrid([['Addon ID', addon.id], ['Version', addon.version], ['Status', addon.enabled ? 'Enabled' : 'Disabled']]));
        const targets = compatibilityText(addon);
        body.append(detailSection('Declared compatibility', targets.length ? targets : ['No compatibility information was returned.']));
        const requirements = addon.dependencies.filter((dep) => dep && dep.id).map((dep) => {
            const installed = state.addons.find((item) => item.id === dep.id);
            return `${textValue(dep.id)} ${textValue(dep.version, '*')} — ${installed ? `${installed.version}, ${installed.enabled ? 'enabled' : 'disabled'}` : 'not installed'}`;
        });
        body.append(detailSection('Dependencies', requirements.length ? requirements : ['This addon has no declared dependencies.']));
        const usedBy = dependents(addon.id);
        body.append(detailSection('Dependent addons', usedBy.length ? usedBy.map((item) => `${item.name} (${item.id}) — ${item.enabled ? 'enabled' : 'disabled'}`) : ['No installed addons depend on this addon.']));
        const incompatible = addon.manifest.incompatible;
        if (Array.isArray(incompatible) && incompatible.length) body.append(detailSection('Declared incompatibilities', incompatible.filter((item) => item && item.id).map((item) => `${item.id} ${textValue(item.version, '*')}`)));
        if (addon.lastOperation && addon.lastOperation.id) {
            const section = element('section', 'am-detail-section');
            section.append(element('h4', '', 'Last operation'), element('p', '', `${statusLabels[addon.lastOperation.status] || prettyLabel(addon.lastOperation.status)} · ${prettyLabel(addon.lastOperation.action)}`));
            if (addon.lastOperation.message) section.append(element('p', 'am-muted', truncate(addon.lastOperation.message, 1500)));
            if (addon.lastOperation.error) section.append(infoNotice(truncate(addon.lastOperation.error, 2400), 'error'));
            section.append(button('View operation details', () => fetchOperationDetails(addon.lastOperation.id))); body.append(section);
        }
        if (addon.source) {
            const sourceUrl = typeof addon.source === 'string' ? addon.source : addon.source.url;
            if (validGitHubUrl(sourceUrl)) {
                const section = element('section', 'am-detail-section'); section.append(element('h4', '', 'Package source'));
                const link = element('a', '', truncate(sourceUrl, 400)); link.href = sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; section.append(link); body.append(section);
            }
        }
        byId('am-dialog-cancel').focus();
    }
    function dateLabel(value) {
        const date = new Date(value);
        return value && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Not available';
    }
    function renderOperation() {
        const operation = state.operation;
        byId('am-operation').hidden = !operation && !state.pending;
        if (!operation && !state.pending) return;
        const action = operation ? operation.action : state.pending.body.action;
        byId('am-operation-title').textContent = action ? `${prettyLabel(action)} operation` : 'Operation progress';
        const status = operation ? operation.status : 'queued';
        const badge = byId('am-operation-status');
        badge.textContent = operation ? (statusLabels[status] || prettyLabel(status)) : 'Connecting';
        badge.className = `am-badge ${status === 'succeeded' || status === 'recovered' ? 'am-badge--success' : status === 'failed' ? 'am-badge--error' : status === 'recovery_required' ? 'am-badge--warning' : ''}`;
        const recoveryMessage = 'Recovery is required before another change. Follow the standalone recovery instructions in the administrator guide, then reconnect here. Database changes may require separate recovery.';
        byId('am-operation-message').textContent = status === 'recovery_required' ? recoveryMessage : truncate(operation ? (operation.error || operation.message || phaseLabels[operation.phase] || 'Waiting for worker progress…') : 'Confirming your submitted request. Reconnecting uses the same request ID.', 2400);
        const progress = byId('am-progress');
        progress.dataset.state = status;
        const numeric = operation && typeof operation.progress === 'number' && Number.isFinite(operation.progress);
        const finished = terminalStatuses.has(status);
        progress.dataset.indeterminate = String(!numeric && !finished && status !== 'recovery_required');
        if (numeric || finished) {
            const value = numeric ? Math.max(0, Math.min(100, operation.progress)) : status === 'failed' ? 0 : 100;
            progress.setAttribute('aria-valuenow', String(value)); byId('am-progress-bar').style.width = `${value}%`;
        } else { progress.removeAttribute('aria-valuenow'); byId('am-progress-bar').style.width = ''; }
        progress.setAttribute('aria-valuetext', status === 'recovery_required' ? 'Waiting for recovery' : (operation && (phaseLabels[operation.phase] || operation.message)) || 'Connecting');
        byId('am-operation-meta').textContent = operation ? `${phaseLabels[operation.phase] || prettyLabel(operation.phase) || statusLabels[status]} · Operation ${operation.id}` : `Request ${state.pending.body.requestId}`;
        byId('am-operation-details').disabled = !operation;
        syncButtons();
    }
    function openOperationDetails(operation) {
        openDialog('Operation details', 'Recorded worker progress, affected addons, and diagnostic information.', { type: 'operation', operation });
        const body = byId('am-dialog-body');
        body.append(detailGrid([['Operation ID', operation.id], ['Action', prettyLabel(operation.action) || 'Not available'], ['Status', statusLabels[operation.status] || prettyLabel(operation.status)], ['Stage', phaseLabels[operation.phase] || prettyLabel(operation.phase) || 'Not available'], ['Started', dateLabel(operation.createdAt)], ['Updated', dateLabel(operation.updatedAt)]]));
        if (operation.error) body.append(infoNotice(truncate(operation.error, 5000), 'error'));
        else if (operation.message) body.append(infoNotice(truncate(operation.message, 2400)));
        if (operation.status === 'recovery_required') body.append(infoNotice('Further changes are blocked until recovery completes. Save this operation ID and use the administrator guide’s standalone recovery procedure. Filesystem recovery does not undo committed database changes.', 'warning'));
        if (Array.isArray(operation.affectedAddons) && operation.affectedAddons.length) body.append(detailSection('Affected addons', operation.affectedAddons.map((item) => typeof item === 'string' ? item : textValue(item.id, 'Unknown addon'))));
        const validation = flattenErrors(operation.validation);
        if (validation.length) body.append(detailSection('Validation details', validation));
        if (Array.isArray(operation.logs) && operation.logs.length) {
            const details = element('details', 'am-detail-section'); details.append(element('summary', '', 'Worker diagnostics'));
            const logs = operation.logs.slice(-150).map((entry) => typeof entry === 'string' ? truncate(entry, 2400) : `${dateLabel(entry.time)} · ${phaseLabels[entry.phase] || prettyLabel(entry.phase)}\n${truncate(entry.message, 2400)}`);
            details.append(element('pre', 'am-log', logs.join('\n\n'))); body.append(details);
        }
        body.append(element('p', 'am-field-help', 'The progress panel continues reconnecting while this dialog is open. Reopen details to see the latest diagnostics.'));
        byId('am-dialog-cancel').focus();
    }
    async function fetchOperationDetails(id) {
        const revision = state.dialogRevision;
        try {
            const operation = await api(`/operations/${encodeURIComponent(id)}`);
            if (state.dialogRevision === revision) openOperationDetails(operation);
        }
        catch (error) { notice(error.message); }
    }
    function scheduleReconnect() {
        clearTimeout(state.pollTimer);
        const delay = Math.min(30000, 2000 * (2 ** Math.min(state.retryCount, 4)));
        state.pollTimer = setTimeout(() => state.pending ? recoverSubmission() : pollOperation(), delay);
    }
    function acceptOperation(operation) {
        if (!operation || typeof operation.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(operation.id) || !Object.prototype.hasOwnProperty.call(statusLabels, operation.status)) {
            const error = new Error('The manager returned an incomplete operation response. Reconnecting with the same request ID.'); error.uncertain = true; throw error;
        }
        const previousStatus = state.operation && state.operation.status;
        state.operation = operation; state.pending = null; state.retryCount = 0;
        byId('am-reconnect').hidden = true;
        persistence(); renderOperation();
        if (terminalStatuses.has(operation.status)) {
            clearTimeout(state.pollTimer);
            if (previousStatus !== operation.status || !state.loaded) loadAddons();
        } else scheduleReconnect();
    }
    async function recoverSubmission() {
        if (!state.pending || state.recovering) return;
        clearTimeout(state.pollTimer); state.recovering = true;
        const wasAmbiguous = state.pending.ambiguous === true;
        // Persist before sending: a tab can close before any response or catch handler runs.
        state.pending.ambiguous = true; persistence();
        try { acceptOperation(await api('/operations', { body: state.pending.body })); }
        catch (error) {
            if (error.uncertain || [400, 401, 403, 419, 429].includes(error.status) || (error.status === 422 && wasAmbiguous)) {
                state.retryCount++; connection(false); byId('am-reconnect').hidden = false;
                renderOperation(); byId('am-operation-message').textContent = error.status === 422 ? [error.message, ...(error.details || []), 'An earlier submission may already be recorded. This request remains saved; resolve the validation issue, then reconnect using the same request ID.'].join(' ') : error.message;
                if (error.uncertain || error.status === 429) scheduleReconnect();
            } else {
                state.pending = null; persistence(); notice([error.message, ...(error.details || [])].join(' ')); renderOperation(); syncButtons();
            }
        } finally { state.recovering = false; }
    }
    async function pollOperation() {
        if (!state.operation || state.polling) return;
        const requestedOperation = state.operation;
        let superseded = false;
        clearTimeout(state.pollTimer); state.polling = true;
        try {
            const operation = await api(`/operations/${encodeURIComponent(requestedOperation.id)}`);
            if (state.operation !== requestedOperation) { superseded = true; return; }
            if (!operation || operation.id !== requestedOperation.id) {
                const error = new Error('The Panel returned a different operation. Reconnecting to the recorded operation.'); error.uncertain = true; throw error;
            }
            acceptOperation(operation);
        }
        catch (error) {
            if (state.operation !== requestedOperation) { superseded = true; return; }
            state.retryCount++; connection(false); byId('am-reconnect').hidden = false;
            byId('am-operation-message').textContent = error.status === 404 ? 'This operation is no longer available. Check the installed addons and manager diagnostics before making another change. Save the operation ID below.' : error.message;
            if (!error.status || error.status >= 500 || error.status === 429) scheduleReconnect();
            // Access errors need a new session; never submit a replacement operation.
        } finally { state.polling = false; if (superseded) scheduleReconnect(); }
    }
    async function submitAction(event) {
        event.preventDefault();
        const modal = state.modal;
        if (!modal || modal.type !== 'action' || !mutationAvailable() || !selectionIsCurrent(modal)) { syncButtons(); return; }
        const errorBox = byId('am-dialog-error'); errorBox.hidden = true;
        const body = { action: modal.action, requestId: requestId() };
        if (modal.addon) body.addonId = modal.addon.id;
        if (modal.action === 'install' || modal.action === 'update') {
            body.url = byId('am-package-url').value.trim();
            if (!validGitHubUrl(body.url)) {
                errorBox.textContent = 'Use a public HTTPS github.com release ZIP, tree folder, archive, or full commit URL without credentials, a custom port, a query, or a fragment.'; errorBox.hidden = false; byId('am-package-url').focus(); return;
            }
        }
        if ((modal.action === 'disable' || modal.action === 'delete') && modal.affected.length) {
            if (!byId('am-cascade').checked) return;
            body.cascade = true;
        }
        if (modal.action === 'disable' || modal.action === 'delete') {
            // The worker must reject a changed graph rather than expand this approval.
            body.expectedAffectedIds = [modal.addon.id, ...modal.affected.map((addon) => addon.id)];
        }
        state.submitting = true; state.operation = null; state.pending = { body, createdAt: new Date().toISOString() }; state.retryCount = 0;
        persistence(); closeDialog(); notice(state.storageWarning ? 'Keep this page open until the operation finishes; this browser cannot save progress.' : ''); renderOperation(); syncButtons();
        byId('am-operation').focus();
        await recoverSubmission();
        state.submitting = false; syncButtons();
    }
    function healthSection(title, data) {
        const section = element('section', 'am-detail-section');
        section.append(element('h4', '', title));
        const passed = typeof data.ok === 'boolean' ? data.ok : data.ready;
        if (typeof passed === 'boolean') section.append(element('span', `am-badge ${passed ? 'am-badge--success' : 'am-badge--warning'}`, passed ? 'Checks passed' : 'Needs attention'));
        const checks = data.checks || data;
        const list = element('ul', 'am-health-checks');
        Object.entries(checks).slice(0, 80).forEach(([key, value]) => {
            if (['ok', 'ready', 'checks', 'runner', 'warnings', 'stateRoot', 'worker', 'sourceProfile', 'hostReady'].includes(key)) return;
            const item = element('li');
            if (value && typeof value === 'object') {
                const ok = typeof value.ok === 'boolean' ? value.ok : value.passed;
                item.append(element('strong', '', prettyLabel(value.name || value.label || value.check || key)));
                if (typeof ok === 'boolean') item.append(element('span', `am-badge ${ok ? 'am-badge--success' : 'am-badge--warning'}`, ok ? 'Passed' : 'Needs attention'));
                const message = textValue(value.message || value.status || value.error);
                if (message) item.append(element('p', 'am-muted', truncate(message, 3000)));
            } else item.append(element('p', '', `${prettyLabel(key)}: ${typeof value === 'boolean' ? value ? 'Passed' : 'Needs attention' : truncate(value, 2400) || 'Not available'}`));
            list.append(item);
        });
        if (list.children.length) section.append(list);
        if (data.message && data.checks) section.append(element('p', 'am-field-help', truncate(data.message, 2400)));
        if (Array.isArray(data.warnings) && data.warnings.length) {
            const warnings = element('section', 'am-detail-section');
            warnings.append(element('h4', '', 'Existing Panel warnings'), element('p', 'am-field-help', 'These existing feature warnings are informational.'));
            data.warnings.slice(0, 80).forEach((warning) => {
                const message = typeof warning === 'string' ? warning : warning && textValue(warning.message);
                if (message) {
                    const panelWarning = infoNotice(truncate(message, 4000), 'warning');
                    if (warning && typeof warning === 'object') {
                        if (warning.path) panelWarning.append(element('p', 'am-field-help', `Affected file: ${truncate(warning.path, 1200)}`));
                        if (warning.sha256) panelWarning.append(element('p', 'am-field-help', `Baseline SHA256: ${truncate(warning.sha256, 128)}`));
                    }
                    warnings.append(panelWarning);
                }
            });
            section.append(warnings);
        }
        return section;
    }
    async function checkDoctor() {
        const node = byId('am-doctor'); node.disabled = true;
        const revision = state.dialogRevision;
        try {
            const data = await api('/doctor');
            if (state.dialogRevision !== revision) return;
            openDialog('Manager health', 'Read-only checks of the registry and manager environment.', { type: 'doctor' });
            const body = byId('am-dialog-body');
            if (data && typeof data === 'object') {
                if (data.manager || data.host) {
                    if (data.manager) body.append(healthSection('Manager checks', data.manager));
                    if (data.host) body.append(healthSection('Panel checks', data.host));
                    const runner = (data.host && data.host.runner) || (data.manager && data.manager.runner);
                    if (runner) body.append(healthSection('Isolated runner', runner));
                } else body.append(healthSection('Checks', data));
            } else body.append(infoNotice('No health check details were returned.', 'warning'));
            byId('am-dialog-cancel').focus();
        } catch (error) { notice(error.message); }
        finally { node.disabled = false; }
    }
    function reconnectNow() {
        state.retryCount = 0; clearTimeout(state.pollTimer);
        if (state.pending) recoverSubmission();
        else if (state.operation) pollOperation();
        else loadAddons();
    }
    function updateTheme() {
        const probe = element('span'); probe.style.background = 'var(--am-surface)'; probe.hidden = true; root.append(probe);
        const color = getComputedStyle(probe).backgroundColor; probe.remove();
        const components = color.match(/[\d.]+/g);
        if (components && components.length >= 3) root.dataset.dark = String((Number(components[0]) * .299 + Number(components[1]) * .587 + Number(components[2]) * .114) < 135);
    }

    byId('am-install').addEventListener('click', () => openAction('install'));
    byId('am-empty-install').addEventListener('click', () => openAction('install'));
    byId('am-refresh').addEventListener('click', loadAddons);
    byId('am-doctor').addEventListener('click', checkDoctor);
    byId('am-search').addEventListener('input', () => { if (state.loaded) renderAddons(); });
    byId('am-filter').addEventListener('change', () => { if (state.loaded) renderAddons(); });
    byId('am-dialog-form').addEventListener('submit', submitAction);
    byId('am-dialog-close').addEventListener('click', closeDialog);
    byId('am-dialog-cancel').addEventListener('click', closeDialog);
    byId('am-dialog').addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
    byId('am-dialog').addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
        if (event.key !== 'Tab') return;
        const nodes = Array.from(byId('am-dialog').querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary')).filter((node) => !node.hidden && node.getClientRects().length > 0);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    byId('am-operation-details').addEventListener('click', () => { if (state.operation) openOperationDetails(state.operation); });
    byId('am-reconnect').addEventListener('click', reconnectNow);
    window.addEventListener('online', reconnectNow);
    window.addEventListener('storage', (event) => {
        if (event.key !== storageKey || state.submitting || state.recovering) return;
        restore(); renderOperation(); syncButtons(); reconnectNow();
    });
    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    restore(); updateTheme(); renderOperation(); loadAddons();
    if (state.pending) recoverSubmission();
    else if (state.operation) pollOperation();
})();
