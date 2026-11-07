// Real customer components and native Tailwind; synthetic HTTP/store/permission data.
// No live Panel, Steam account, Workshop item or node is accessed by this harness.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const output = process.env.GMOD_TOOLKIT_BROWSER_OUTPUT;
assert(output && fs.existsSync(path.join(output, 'public/fixture.js')), 'Build the disposable browser fixture first');
const cover = fs.readFileSync(path.join(__dirname, '../addon/payload/cover.jpg'));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const items = Array.from({ length: 12 }, (_, index) => ({
    id: String(1001 + index),
    title: `Workshop asset ${index + 1}`,
    description:
        index === 0
            ? '<img src=x onerror="window.injected=true"> escaped test description'
            : 'Materials, models and resources used by this example server. Preview data only.',
    bytes: (index + 1) * 1048576,
    updated: Math.floor(Date.now() / 1000) - (index + 1) * 86400,
    subscribers: 1000 * (index + 1),
    image: `/thumbs/${index}.jpg`,
}));
const collection = {
    collection: '99999',
    title: 'Example server content',
    items,
    bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    knownSizes: 12,
    duplicates: 3,
    collections: 2,
};
const preview = {
    preview: 'a'.repeat(64),
    files: 2,
    bytes: 15000,
    skipped: 4,
    added: ['maps/test.bsp', 'materials/example.vmt'],
    changed: [],
    removed: [],
    resources: ['maps/test.bsp', 'materials/example.vmt'],
};
const state = {
    phase: '',
    polls: 0,
    saved: false,
    selection: '',
    refreshes: 0,
    url: null,
    export: null,
    scanner: '',
    scanPolls: 0,
    requests: [],
};
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/thumbs/') || url.pathname.endsWith('/workshop/cover')) {
        response.setHeader('Content-Type', 'image/jpeg');
        response.end(cover);
        return;
    }
    if (url.pathname === '/ui/fixture.js') {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(fs.readFileSync(path.join(output, 'public/fixture.js')));
        return;
    }
    if (!url.pathname.startsWith('/api/')) {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(
            '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GMod Toolkit browser fixture</title></head><body style="margin:0;background:#0e1116;color:#edf0f5;font-family:system-ui,sans-serif"><div id="app"></div><script src="/ui/fixture.js"></script></body></html>'
        );
        return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    state.requests.push({ method: request.method, path: url.pathname, body });
    const send = (data) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(data));
    };
    if (url.pathname.endsWith('/scanner/start')) {
        state.scanner = 'running';
        state.scanPolls = 0;
        send({ status: 'running' });
        return;
    }
    if (url.pathname.endsWith('/scanner/cancel')) {
        state.scanner = 'cancelled';
        send({ status: 'cancelled' });
        return;
    }
    if (url.pathname.endsWith('/scanner')) {
        ++state.scanPolls;
        if (state.scanner === 'running' && state.scanPolls > 1) state.scanner = 'complete';
        const done = state.scanner === 'complete';
        const findings = [
            {
                file: '/garrysmod/addons/example/lua/server.lua',
                member: '',
                line: 27,
                rule: 'network-execution',
                severity: 'critical',
                title: 'Network input is executed as Lua',
                description: 'A network read feeds Lua execution. Review the server receiver and sender authorization.',
                evidence: 'net.ReadString → RunString',
                context: [
                    { line: 26, text: '-- synthetic fixture' },
                    { line: 27, text: 'RunString(net.ReadString()) -- <img src=x onerror="window.injected=true">' },
                    { line: 28, text: 'end)' },
                ],
            },
            {
                file: '/garrysmod/addons/packed.gma',
                member: 'lua/autorun/server/privileges.lua',
                line: 12,
                rule: 'identity-privilege',
                severity: 'high',
                title: 'Hardcoded identity near a privilege grant',
                description:
                    'Review this fixed identity and rank grant. This may be an intended whitelist or hidden author access.',
                evidence: 'SetUserGroup',
                context: [{ line: 12, text: 'player:SetUserGroup("superadmin")' }],
            },
            {
                file: '/garrysmod/lua/library.lua',
                member: '',
                line: 8,
                rule: 'environment-access',
                severity: 'low',
                title: 'Global or debug environment access',
                description: 'Normal Lua libraries use these APIs too.',
                evidence: '',
                context: [{ line: 8, text: 'local value = _G[name]' }],
            },
        ];
        send({
            rulesVersion: '2026.11.07.1',
            scan: state.scanner
                ? {
                      id: 'c'.repeat(64),
                      status: state.scanner,
                      phase: done ? 'inspect' : 'discover',
                      started: new Date().toISOString(),
                      finished: done ? new Date().toISOString() : null,
                      current: '/garrysmod/addons/example/lua/server.lua',
                      completed: done ? 3 : 0,
                      total: 3,
                      pendingDirectories: done ? 0 : 2,
                      visited: 123,
                      filesScanned: done ? 3 : 0,
                      scripts: done ? 7 : 0,
                      archives: done ? 1 : 0,
                      bytes: 123456,
                      uninspected: 1,
                      issues: [
                          { file: '/garrysmod/lua/bin/native.so', reason: 'Native binary cannot be inspected as Lua.' },
                      ],
                      findings: done ? findings : [],
                      findingCount: done ? 3 : 0,
                      truncated: false,
                      partial: true,
                      waiting: false,
                      message: done
                          ? 'Scan finished. Findings need review; no static scanner can prove that a server is safe.'
                          : '',
                      rulesVersion: '2026.11.07.1',
                  }
                : null,
        });
        return;
    }
    if (url.pathname.endsWith('/workshop/selection')) {
        state.selection = body.collection;
        send({ input: state.selection });
        return;
    }
    if (url.pathname.endsWith('/workshop/preview')) {
        send({
            ...collection,
            preview: 'b'.repeat(64),
            before: '-- previous file',
            lua: 'resource.AddWorkshop("1001")',
            added: ['1001'],
            removed: [],
        });
        return;
    }
    if (url.pathname.endsWith('/workshop/apply')) {
        state.saved = true;
        send({ message: 'Download Lua saved. Restart the game server.' });
        return;
    }
    if (url.pathname.endsWith('/workshop')) {
        ++state.refreshes;
        send({
            input: state.selection,
            refreshedAt: state.selection ? new Date().toISOString() : null,
            refreshError: null,
            backups: [],
            target: '/garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua',
            collection: state.selection ? collection : null,
        });
        return;
    }
    if (url.pathname.endsWith('/fastdl/prepare')) {
        send({ message: 'Upload folders are ready in /fastdl.' });
        return;
    }
    if (url.pathname.endsWith('/fastdl/preview')) {
        state.phase = 'preview';
        state.polls = 0;
        send({ status: 'running' });
        return;
    }
    if (url.pathname.endsWith('/fastdl/publish')) {
        state.phase = 'publish';
        state.polls = 0;
        send({ status: 'running' });
        return;
    }
    if (url.pathname.endsWith('/fastdl/addon')) {
        state.export = body;
        state.phase = 'addon';
        state.polls = 0;
        send({ status: 'running' });
        return;
    }
    if (url.pathname.endsWith('/fastdl')) {
        state.polls += 1;
        const running = state.phase && state.polls < 2;
        if (state.phase === 'publish' && !running)
            state.url = 'https://panel.example.test/fastdl/' + 'c'.repeat(64) + '/';
        send({
            fastdl: {
                url: state.url,
                files: state.url ? 2 : 0,
                preview: state.phase === 'preview' && !running ? preview : null,
                addon:
                    state.phase === 'addon' && !running
                        ? {
                              id: 'e'.repeat(64),
                              name: state.export.name,
                              filename: 'demo-workshop.zip',
                              bytes: 15555,
                              expires: Math.floor(Date.now() / 1000) + 3600,
                          }
                        : null,
                job: state.phase
                    ? {
                          status: running
                              ? 'running'
                              : state.phase === 'addon'
                              ? 'addon-ready'
                              : state.phase === 'preview'
                              ? 'preview-ready'
                              : 'complete',
                          phase:
                              state.phase === 'addon' ? 'addon-write' : state.phase === 'publish' ? 'compress' : 'scan',
                          completed: 1,
                          total: 2,
                          inspected: 4,
                          pendingDirectories: 1,
                          waiting: false,
                          message: '',
                      }
                    : null,
            },
        });
        return;
    }
    response.statusCode = 404;
    send({ message: 'Unknown synthetic endpoint' });
});
(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const chrome = spawn(
        process.env.CHROMIUM_BIN || '/usr/bin/chromium',
        [
            '--headless',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--remote-debugging-port=0',
            '--remote-allow-origins=*',
            `--user-data-dir=${path.join(output, 'profile')}`,
            'about:blank',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let stderr = '';
    chrome.stderr.on('data', (chunk) => (stderr += chunk));
    let endpoint;
    for (let index = 0; index < 150; index++) {
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
            endpoint = match[1];
            break;
        }
        await pause(50);
    }
    assert(endpoint, 'Chromium did not start');
    const tabs = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
    const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    let sequence = 0;
    const waiting = new Map();
    ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (!message.id || !waiting.has(message.id)) return;
        const waiter = waiting.get(message.id);
        waiting.delete(message.id);
        message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
    });
    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const id = ++sequence;
            waiting.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const waitFor = async (expression) => {
        for (let index = 0; index < 150; index++) {
            if (await evaluate(expression)) return;
            await pause(100);
        }
        throw new Error(`Timed out: ${expression}`);
    };
    const click = async (text) => {
        await waitFor(
            `(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(
                text
            )});return !!button&&!button.disabled;})()`
        );
        assert(
            await evaluate(
                `(()=>{const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(
                    text
                )});if(!button||button.disabled)return false;button.click();return true;})()`
            ),
            `Missing/enabled button: ${text}`
        );
    };
    const value = (selector, text) =>
        evaluate(
            `(()=>{const field=document.querySelector(${JSON.stringify(
                selector
            )});const setter=Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(field,${JSON.stringify(
                text
            )});field.dispatchEvent(new Event('input',{bubbles:true}));})()`
        );
    const screenshot = async (name) => {
        const height = Math.min(await evaluate('document.documentElement.scrollHeight'), 3000);
        const result = await send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: await evaluate('window.innerWidth'), height, scale: 1 },
        });
        fs.writeFileSync(path.join(output, name), Buffer.from(result.data, 'base64'));
    };
    const load = async (page, width = 1600) => {
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: width < 600,
        });
        const loaded = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Navigation did not finish')), 10000);
            const listener = (event) => {
                if (JSON.parse(event.data).method !== 'Page.loadEventFired') return;
                clearTimeout(timeout);
                ws.removeEventListener('message', listener);
                resolve();
            };
            ws.addEventListener('message', listener);
        });
        await send('Page.navigate', { url: `${origin}/?page=${page}` });
        await loaded;
        await waitFor('!!document.querySelector("h1")');
    };
    const results = [];
    try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('DOM.enable');
        await load('workshop');
        await value('#workshop-collection', '99999');
        await waitFor('document.querySelectorAll("article").length===12');
        await waitFor(
            '[...document.querySelectorAll("article img")].slice(0,6).every(e=>e.complete&&e.naturalWidth>0)'
        );
        assert.equal(
            await evaluate(
                'getComputedStyle(document.querySelector("article").parentElement).gridTemplateColumns.split(" ").length'
            ),
            6
        );
        assert.equal(await evaluate('!!window.injected'), false);
        await screenshot('workshop-desktop.png');
        results.push('desktop collection cards: 6 columns, artwork, metadata, escaped text');
        assert.equal(state.selection, '99999');
        assert.equal(
            state.requests.some((r) => r.path.endsWith('/workshop/preview') || r.path.endsWith('/workshop/apply')),
            false
        );
        results.push('collection input autosaves and loads cards without a Lua preview or file write');
        const opened = state.refreshes;
        await load('workshop');
        await waitFor('document.querySelectorAll("article").length===12');
        assert.equal(await evaluate('document.querySelector("#workshop-collection").value'), '99999');
        assert(state.refreshes > opened);
        const manual = state.refreshes;
        await click('Refresh collection');
        await waitFor(
            '[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Refresh collection"&&!e.disabled)'
        );
        assert(state.refreshes > manual);
        assert.equal(
            state.requests.some((r) => r.path.endsWith('/workshop/apply')),
            false
        );
        results.push(
            'reopening restores saved input and refreshes cards; manual Refresh fetches again without applying Lua'
        );
        await click('Preview download Lua');
        await click('Back up and apply download Lua');
        await waitFor('document.body.textContent.includes("Download Lua saved")');
        assert.equal(await evaluate('document.querySelectorAll("article").length'), 12);
        results.push('collection artwork stays visible after apply');
        await load('workshop', 390);
        await waitFor('document.querySelectorAll("article").length===12');
        assert.equal(
            await evaluate(
                'getComputedStyle(document.querySelector("article").parentElement).gridTemplateColumns.split(" ").length'
            ),
            2
        );
        assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
        await screenshot('workshop-mobile.png');
        results.push('mobile collection cards: 2 columns, no horizontal overflow');
        await load('fastdl');
        assert(
            await evaluate('document.body.textContent.includes("Uploading or publishing files does not enable FastDL")')
        );
        await click('Prepare upload folders');
        await waitFor('document.body.textContent.includes("Upload folders are ready")');
        assert.equal(
            await evaluate(
                '[...document.querySelectorAll("a")].find(e=>e.textContent.includes("Open upload folder")).getAttribute("href")'
            ),
            '/server/demo/files#/fastdl'
        );
        await click('Preview uploaded assets');
        await waitFor(
            '[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Publish FastDL downloads"&&!e.disabled)'
        );
        results.push('dedicated-folder preparation and asynchronous asset preview');
        await evaluate('document.querySelector("input[value=workshop]").click()');
        await waitFor('!!document.querySelector("#addon-name")');
        await value('#addon-name', 'My custom assets');
        await value('#addon-description', 'My chosen description');
        const documentRoot = (await send('DOM.getDocument')).root.nodeId;
        const input = await send('DOM.querySelector', { nodeId: documentRoot, selector: 'input[type=file]' });
        await send('DOM.setFileInputFiles', {
            nodeId: input.nodeId,
            files: [process.env.GMOD_TOOLKIT_BROWSER_IMAGE || path.join(__dirname, '../addon/payload/cover.jpg')],
        });
        await waitFor(
            'document.querySelector("img[alt=\\"Workshop addon cover\\"]").src.startsWith("data:image/jpeg")'
        );
        await click('Build Workshop addon package');
        await waitFor('document.body.textContent.includes("Your Workshop addon package is ready")');
        assert.equal(state.export.name, 'My custom assets');
        assert.equal(state.export.description, 'My chosen description');
        assert(state.export.cover.length > 1000);
        assert(
            await evaluate(
                '[...document.querySelectorAll("a")].some(e=>e.getAttribute("href").includes("/gmod-toolkit/fastdl/addon/"))'
            )
        );
        await screenshot('fastdl-workshop-desktop.png');
        results.push('custom name/description/image and protected Workshop package handoff');
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: true,
        });
        assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
        await screenshot('fastdl-mobile.png');
        results.push('mobile FastDL/export form: no horizontal overflow');
        await load('fastdl&readonly');
        await waitFor('document.body.textContent.includes("Upload your download assets")');
        assert.equal(
            await evaluate(
                '[...document.querySelectorAll("button")].some(e=>e.textContent.includes("Prepare upload folders")||e.textContent.includes("Publish FastDL downloads"))'
            ),
            false
        );
        results.push('read-only customers do not see mutating controls');
        await load('scanner');
        await click('Start scan');
        await waitFor('document.body.textContent.includes("Scan finished")');
        assert(await evaluate('document.body.textContent.includes("CRITICAL")'));
        assert(await evaluate('document.body.textContent.includes("line 27")'));
        assert(await evaluate('document.body.textContent.includes("Coverage is incomplete")'));
        assert.equal(await evaluate('!!window.injected'), false);
        assert.equal(await evaluate('document.body.textContent.includes("Global or debug environment access")'), false);
        await screenshot('scanner-desktop.png');
        results.push('scanner progress, severity, file/line context, escaped code and incomplete coverage');
        await evaluate('document.querySelector("input[type=checkbox]").click()');
        await waitFor('document.body.textContent.includes("Global or debug environment access")');
        await value('#scan-filter', 'packed.gma');
        await waitFor('document.body.textContent.includes("1 matching files")');
        const scansStarted = state.requests.filter((r) => r.path.endsWith('/scanner/start')).length;
        await load('scanner', 390);
        await waitFor('document.body.textContent.includes("Scan finished")');
        await click('Refresh results');
        assert.equal(state.requests.filter((r) => r.path.endsWith('/scanner/start')).length, scansStarted);
        assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
        await screenshot('scanner-mobile.png');
        results.push('scanner filters, optional low indicators, saved report/manual refresh and mobile overflow');
        await click('Run a new scan');
        await click('Cancel scan');
        await waitFor('document.body.textContent.includes("cancelled")');
        assert(state.requests.every((r) => !/delete|quarantine|execute/.test(r.path)));
        results.push('scanner cancellation and no automatic code execution, deletion or quarantine endpoints');
        assert(state.requests.every((request) => !request.path.includes('/files/write')));
        results.push('workflow never changes server.cfg automatically');
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: true, checks: results }, null, 2));
        console.log(JSON.stringify({ passed: true, checks: results, output }));
    } finally {
        ws.close();
        chrome.kill('SIGTERM');
        server.close();
    }
})().catch((error) => {
    console.error(error);
    server.close();
    process.exitCode = 1;
});
