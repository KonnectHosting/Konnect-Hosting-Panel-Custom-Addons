const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
assert(typeof WebSocket === 'function', 'Use Node.js 22 or newer with global WebSocket support.');
const packageRoot = path.resolve(__dirname, '..');
const outputRoot = process.env.ADDON_MANAGER_BROWSER_OUTPUT ? path.resolve(process.env.ADDON_MANAGER_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'addon-manager-browser-'));
fs.mkdirSync(outputRoot, { recursive: true });
const apiBase = '/admin/addon-manager/api';
const pagePath = '/admin/addon-manager';
const assetBase = '/addon-manager/build';
const assetVersion = fs.readFileSync(`${packageRoot}/bootstrap.php`,'utf8').match(/define\('ADDON_MANAGER_VERSION', '([^']+)'\)/)[1];
const apiRequests = [];
let html = fs.readFileSync(`${packageRoot}/resources/views/index.blade.php`, 'utf8');
assert(html.includes("url('/admin/addon-manager/api')"), 'Blade API fallback is not neutral');
assert(html.includes("asset('addon-manager/build')"), 'Blade asset fallback is not neutral');
for(const extension of ['js','css'])assert(html.includes(`manager.v1.${extension}?v={{ ADDON_MANAGER_VERSION }}`),'Blade asset lacks manager-version cache key');
assert(!/konnect|hosting|\bkam[-\s]/i.test(html), 'Branded markup remains');
html = html.slice(html.indexOf('<div class="am"'), html.indexOf('\n@endsection', html.indexOf('<div class="am"')))
    .replace(/{{ \$apiBase[^}]+}}/g, apiBase).replace(/{{ csrf_token\(\) }}/g, 'test-csrf').replace(/{{ auth\(\)->id\(\) }}/g, '42');
html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${assetBase}/manager.v1.css?v=${encodeURIComponent(assetVersion)}"><style>body{background:#f0f3f8;margin:24px;font-family:Arial,sans-serif}dialog{font-family:inherit}</style></head><body>${html}<script src="${assetBase}/manager.v1.js?v=${encodeURIComponent(assetVersion)}" defer></script></body></html>`;
let addons = [
    { id: 'base', name: 'Base addon', version: '1.0.0', enabled: true, manifest: { compatibility: { panel: '^1.15', php: '^8.2' } }, dependencies: [] },
    { id: 'child', name: 'Dependent addon', version: '1.0.0', enabled: true, manifest: {}, dependencies: [{ id: 'base', version: '^1.0' }] },
    { id: 'grandchild', name: 'Transitive addon', version: '1.0.0', enabled: true, manifest: {}, dependencies: [{ id: 'child', version: '^1.0' }] },
    { id: 'disabled', name: 'Disabled dependent', version: '1.0.0', enabled: false, manifest: {}, dependencies: [{ id: 'base', version: '^1.0' }] },
    { id: 'text-test', name: '<img src=x onerror="window.packageExecuted=true">', version: '1.0.0', enabled: false, manifest: { description: '<script>window.packageExecuted=true</script>' }, dependencies: [{id:'missing',version:'^1'}] }
];
const requests = [];
const operations = new Map();
let lostFirstResponse = false;
let manualRecovery = false;
const auditHooks = {};
const requestedAssets = [];
const server = http.createServer(async (req, res) => {
    if (req.url === pagePath || req.url.startsWith(pagePath+'?')) { res.setHeader('Content-Type', 'text/html'); res.end(req.url.endsWith('?actor=43') ? html.replace('data-actor="42"', 'data-actor="43"') : html); return; }
    const assetPath=req.url.split('?')[0];
    if (assetPath === `${assetBase}/manager.v1.js` || assetPath === `${assetBase}/manager.v1.css`) {requestedAssets.push(req.url);res.setHeader('Content-Type',assetPath.endsWith('js')?'application/javascript':'text/css');res.end(fs.readFileSync(`${packageRoot}/public/build/${assetPath.split('/').pop()}`));return;}
    if (req.url === '/favicon.ico') { res.statusCode=204;res.end();return; }
    apiRequests.push({ method: req.method, path: req.url });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === `${apiBase}/addons`) { if(auditHooks.addons){auditHooks.addons(res);return;} res.end(JSON.stringify({data:addons})); return; }
    if (req.url === `${apiBase}/doctor` && auditHooks.doctor) {auditHooks.doctor(res);return;}
    if (req.url === `${apiBase}/doctor`) { res.end(JSON.stringify({data:{manager:{ok:true,checks:[{name:'Registry integrity',ok:true,message:'All retained packages match.'}]},host:{ready:false,checks:[{name:'management-worker',passed:false,message:'Start the dedicated worker service.'}],warnings:[{message:'Known Arix preset feature issue retained from the installed baseline.'},'<img src=x onerror="window.warningExecuted=true">'],runner:{ready:true,checks:[{name:'Container isolation',passed:true,message:'Configured.'}]}}}})); return; }
    if (req.url === `${apiBase}/operations` && req.method === 'POST') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw); requests.push({ body, csrf: req.headers['x-csrf-token'], actor: req.headers['x-addon-manager-actor'] });
        if(body.action==='enable'&&body.addonId==='text-test'){res.statusCode=422;res.end(JSON.stringify({message:'Dependency version mismatch.',errors:{addonId:['Required base version ^2.0 is unavailable.']}}));return;}
        let operation = operations.get(body.requestId);
        if(operation&&JSON.stringify(operation.arguments)!==JSON.stringify(body)){res.statusCode=422;res.end(JSON.stringify({message:'requestId was reused with different arguments.'}));return;}
        if (!operation) { operation = {id:`op-${operations.size+1}`,status:'queued',action:body.action,arguments:body,phase:'queued',progress:0,message:'Waiting for the worker',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),logs:[],reads:0}; operations.set(body.requestId,operation); }
        if (auditHooks.post && auditHooks.post(res,operation,body)) return;
        if (body.action === 'install' && !lostFirstResponse) { lostFirstResponse = true; res.statusCode=503;res.end(JSON.stringify({message:'Maintenance interrupted the acknowledgement.'}));return; }
        res.end(JSON.stringify({data:operation})); return;
    }
    if (req.url.startsWith(`${apiBase}/operations/`)) {
        if(auditHooks.operation && auditHooks.operation(req.url,res))return;
        const operation = Array.from(operations.values()).find(op => req.url.endsWith(op.id));
        if (!operation) {res.statusCode=404;res.end(JSON.stringify({message:'Unknown operation'}));return;}
        operation.reads++; operation.status = operation.action==='disable' ? (manualRecovery?'recovered':'recovery_required') : operation.reads > 1 ? 'succeeded' : 'running'; operation.progress = operation.reads > 1 ? 100 : 65; operation.phase = operation.reads > 1 ? 'complete' : 'activation'; operation.message = operation.reads > 1 ? 'Changes installed successfully' : 'Activating changes';
        operation.logs.push({time:new Date().toISOString(),phase:operation.phase,message:'<img src=x onerror="window.packageExecuted=true">'});
        if (operation.status === 'succeeded' && !operation.applied) {
            operation.applied = true;
            if (operation.action === 'install') addons.push({id:'new-addon',name:'Installed addon',version:'1.0.0',enabled:true,manifest:{},dependencies:[]});
            if (operation.action === 'update') addons.find(addon=>addon.id===operation.arguments.addonId).version='1.1.0';
            if (operation.action === 'enable') addons.find(addon=>addon.id===operation.arguments.addonId).enabled=true;
            if (operation.action === 'delete') addons = addons.filter(addon=>!['base','child','grandchild','disabled'].includes(addon.id));
        }
        res.end(JSON.stringify({data:operation})); return;
    }
    res.statusCode=404;res.end('{}');
});
const sleep = ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const port=server.address().port;
    const chrome=spawn(process.env.CHROMIUM_BIN || '/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--remote-allow-origins=*',`--user-data-dir=${path.join(outputRoot, 'chromium-profile')}`, 'about:blank'],{stdio:['ignore','ignore','pipe']});
    let stderr=''; chrome.stderr.on('data',chunk=>stderr+=chunk);
    let endpoint;
    for(let i=0;i<100;i++){ const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if(match){endpoint=match[1];break;}await sleep(50); }
    assert(endpoint,'Chromium did not start');
    const debugPort=new URL(endpoint).port;
    const tabs=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const ws=new WebSocket(tabs[0].webSocketDebuggerUrl);
    await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
    let sequence=0;const waiting=new Map();
    ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&waiting.has(message.id)){const waiter=waiting.get(message.id);waiting.delete(message.id);message.error?waiter.reject(new Error(JSON.stringify(message.error))):waiter.resolve(message.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const nextPageLoad=()=>new Promise((resolve,reject)=>{
        const listener=event=>{if(JSON.parse(event.data).method!=='Page.loadEventFired')return;clearTimeout(timeout);ws.removeEventListener('message',listener);resolve();};
        const timeout=setTimeout(()=>{ws.removeEventListener('message',listener);reject(new Error('Reload did not load a new document'));},15000);
        ws.addEventListener('message',listener);
    });
    const evaluate=async(expression)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
    try {
        await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
        await send('Page.navigate',{url:`http://127.0.0.1:${port}${pagePath}`});await sleep(500);
        const results=await evaluate(`(async()=>{
            const wait=async(fn)=>{for(let i=0;i<1000;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Wait timed out');};
            const check=(condition,label)=>{if(!condition)throw new Error(label);};
            await wait(()=>document.getElementById('am-count-total').textContent==='5');
            check(document.getElementById('addon-manager').dataset.apiBase==='/admin/addon-manager/api','Neutral API base absent');
            check(document.getElementById('addon-manager').dataset.actor==='42','Actor identity not rendered');
            check(!document.querySelector('[id^=kam], [id*=konnect]'),'Branded DOM identifiers remain');
            check(document.querySelectorAll('[id^=am-]').length>35,'Neutral DOM identifiers absent');
            check(!window.packageExecuted,'Package HTML executed');check(!document.querySelector('#am-addons img, #am-addons script'),'Package markup inserted');
            check(document.getElementById('am-addons').textContent.includes('Missing dependency: missing'),'Missing dependency warning absent');
            const row=()=>Array.from(document.querySelectorAll('#am-addons tr')).find(node=>node.querySelector('.am-addon-id').textContent==='base');
            row().querySelector('[data-mutation="disable"]').focus();row().querySelector('[data-mutation="disable"]').click();
            check(document.getElementById('am-dialog-submit').disabled,'Cascade confirmation was not required');
            check(document.querySelectorAll('#am-dialog-body .am-impact-list li').length===2,'Disable cascade includes wrong dependents');
            document.getElementById('am-cascade').click();check(!document.getElementById('am-dialog-submit').disabled,'Cascade checkbox failed');document.getElementById('am-dialog-cancel').click();
            check(document.activeElement.dataset.mutation==='disable','Dialog did not restore keyboard focus');
            row().querySelector('[data-mutation="delete"]').click();
            check(document.getElementById('am-dialog-submit').textContent==='Delete 4 addons','Delete count omitted disabled/transitive dependents');
            check(document.querySelectorAll('#am-dialog-body .am-impact-list li').length===4,'Delete impact list incomplete');
            check(document.getElementById('am-dialog-body').textContent.includes('stored data are retained'),'Data-retention copy missing');document.getElementById('am-dialog-cancel').click();
            document.getElementById('am-search').value='No such addon';document.getElementById('am-search').dispatchEvent(new Event('input'));check(!document.getElementById('am-empty').hidden,'Search empty state absent');
            document.getElementById('am-search').value='';document.getElementById('am-search').dispatchEvent(new Event('input'));
            document.getElementById('am-filter').value='disabled';document.getElementById('am-filter').dispatchEvent(new Event('change'));check(document.querySelectorAll('#am-addons tr').length===2,'Disabled filter returned wrong rows');document.getElementById('am-filter').value='all';document.getElementById('am-filter').dispatchEvent(new Event('change'));
            document.getElementById('am-install').click();document.getElementById('am-package-url').value='https://github.com/owner/addon#fragment';document.getElementById('am-dialog-form').requestSubmit();check(!document.getElementById('am-dialog-error').hidden&&document.getElementById('am-dialog').open,'Unsupported URL was not rejected before submit');
            document.getElementById('am-package-url').value='https://github.com/owner/addon/releases/download/v1.0.0/addon.zip';document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>document.getElementById('am-operation-message').textContent.includes('temporarily unavailable'));
            check(document.getElementById('am-install').disabled,'Mutations remained available during operation');
            check(document.activeElement.id==='am-operation','Submission did not focus operation progress');
            const progressKey='addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api';
            const saved=JSON.parse(localStorage.getItem(progressKey)||'null');
            check(saved&&saved.pending&&saved.pending.body.action==='install'&&saved.pending.body.requestId,'Pending request absent from neutral storage key');
            check(!Object.keys(localStorage).some(key=>/konnect/i.test(key)),'Legacy progress storage key created');
            return ['Neutral API base and actor','Neutral DOM identifiers','Neutral pending-operation storage key','Safe package rendering','Dependency warnings','Explicit disable cascade','Delete cascade includes disabled/transitive addons','Retained-data confirmation','Search/filter state','Unsupported URL rejected before submission','Dialog focus restoration','Submission focuses operation progress','Lost response preserved'];
        })()`);
        assert.equal(requests.length,1,'Expected the first ambiguous request');
        await send('Page.reload');await sleep(500);
        await evaluate(`(async()=>{for(let i=0;i<300;i++){if(document.getElementById('am-operation-meta').textContent.includes('op-1'))return;await new Promise(r=>setTimeout(r,25));}throw new Error('Unacknowledged request did not recover after reload');})()`);
        assert.equal(requests.length,2,'Lost response should retry once');assert.equal(requests[0].body.requestId,requests[1].body.requestId,'Retry changed request identity');assert.equal(requests[0].csrf,'test-csrf');assert.equal(requests[1].csrf,'test-csrf');
        assert.deepEqual(requests[0].body,requests[1].body,'Refresh changed submitted arguments');
        assert.equal(requests[0].actor,'42');assert.equal(requests[1].actor,'42');
        await send('Page.reload');await sleep(500);
        const resumed=await evaluate(`(async()=>{for(let i=0;i<500;i++){if(document.getElementById('am-count-total').textContent==='6'&&document.getElementById('am-operation-status').textContent==='Completed')break;await new Promise(r=>setTimeout(r,25));}if(document.getElementById('am-count-total').textContent!=='6')throw new Error('Operation did not complete after reload');document.getElementById('am-operation-details').click();if(document.querySelector('#am-dialog-body img'))throw new Error('Log markup inserted');document.getElementById('am-dialog-cancel').click();const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(saved.pending!==null||saved.operationId!=='op-1')throw new Error('Acknowledged operation storage was not retained');return ['Neutral acknowledged-operation storage','Refresh reconnects to operation','No resubmission after acknowledgement','Terminal registry refresh','Safe diagnostic text'];})()`);
        assert.equal(requests.length,2,'Reload resubmitted operation');
        assert(apiRequests.every(request=>request.path.startsWith(apiBase+'/')),'Request escaped neutral API URL');
        assert(apiRequests.some(request=>request.path===apiBase+'/addons'),'Neutral addon endpoint not requested');
        assert(apiRequests.some(request=>request.path===apiBase+'/operations/op-1'),'Neutral operation endpoint not requested');
        await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
        const responsive=await evaluate(`(()=>{document.body.style.margin='12px';if(document.documentElement.scrollWidth>390)throw new Error('Mobile page overflows');document.getElementById('am-install').click();if(document.getElementById('am-dialog').getBoundingClientRect().width>390)throw new Error('Mobile dialog overflows');return ['Responsive mobile layout'];})()`);
        const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(outputRoot, 'mobile.png'),Buffer.from(shot.data,'base64'));
        await evaluate(`document.getElementById('am-dialog-cancel').click();document.documentElement.style.setProperty('--box','#202938');document.documentElement.style.setProperty('--text','#e6edf7');document.documentElement.style.setProperty('--text-secondary','#a9b6c9');document.documentElement.style.setProperty('--input','#283447');document.documentElement.style.setProperty('--input-border','#3a485e');`);
        await sleep(100);
        assert.equal(await evaluate(`document.getElementById('addon-manager').dataset.dark`),'true','Arix dark colors undetected');
        const darkshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(outputRoot, 'dark.png'),Buffer.from(darkshot.data,'base64'));
        const lifecycle=await evaluate(`(async()=>{
            const wait=async(fn)=>{for(let i=0;i<800;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('Lifecycle wait timed out');};
            const check=(condition,label)=>{if(!condition)throw new Error(label);};
            const row=id=>Array.from(document.querySelectorAll('#am-addons tr')).find(node=>node.querySelector('.am-addon-id').textContent===id);
            document.getElementById('am-doctor').click();await wait(()=>document.getElementById('am-dialog').open);
            check(Array.from(document.querySelectorAll('#am-dialog-body .am-notice--warning')).some(node=>node.textContent==='Known Arix preset feature issue retained from the installed baseline.'),'Existing vendor warning text absent');
            check(Array.from(document.querySelectorAll('#am-dialog-body .am-notice--warning')).some(node=>node.textContent.includes('<img src=x'))&&!document.querySelector('#am-dialog-body img')&&!window.warningExecuted,'Vendor warning markup executed');
            check(document.getElementById('am-dialog-body').textContent.includes('Needs attention'),'Nested health checks lost failures');check(document.getElementById('am-dialog-body').textContent.includes('Start the dedicated worker service.'),'Health check diagnostic missing');document.getElementById('am-dialog-cancel').click();
            check(!document.getElementById('am-install').disabled,'Informational vendor warning blocked operations');
            row('new-addon').querySelector('[data-mutation="update"]').click();document.getElementById('am-package-url').value='https://github.com/owner/addon/releases/download/v1.1.0/addon.zip';document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>row('new-addon').textContent.includes('1.1.0')&&document.getElementById('am-operation-status').textContent==='Completed');
            check(!document.getElementById('am-install').disabled,'Update did not release mutation guard');
            row('disabled').querySelector('[data-mutation="enable"]').click();document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>row('disabled').querySelector('[data-mutation="disable"]')&&document.getElementById('am-operation-status').textContent==='Completed');
            row('text-test').querySelector('[data-mutation="enable"]').click();document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>!document.getElementById('am-notice').hidden);check(document.getElementById('am-notice').textContent.includes('Required base version ^2.0'),'Validation error details missing');check(!document.getElementById('am-install').disabled,'Known rejection blocked further work');
            row('base').querySelector('[data-mutation="delete"]').click();document.getElementById('am-cascade').click();document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>document.getElementById('am-count-total').textContent==='2'&&document.getElementById('am-operation-status').textContent==='Completed');
            check(!row('base')&&!row('disabled'),'Delete cascade did not update registry');
            row('new-addon').querySelector('[data-mutation="disable"]').click();document.getElementById('am-dialog-form').requestSubmit();
            await wait(()=>document.getElementById('am-operation-status').textContent==='Recovery required');check(document.getElementById('am-install').disabled,'Recovery did not block mutations');document.getElementById('am-operation-details').click();check(document.getElementById('am-dialog-body').textContent.includes('Filesystem recovery does not undo committed database changes'),'Recovery consequences missing');document.getElementById('am-dialog-cancel').click();
            return ['Update submits and refreshes version','Enable submits and refreshes status','Nested manager/host health checks','Informational vendor warning text','Escaped vendor warning markup','Warnings retain operation availability','Human-readable validation errors','Known rejection releases submit guard','Cascade delete submits and refreshes registry','Recovery-required blocks mutations','Database recovery consequences'];
        })()`);
        const updating=requests.find(request=>request.body.action==='update');assert.equal(updating.body.addonId,'new-addon');assert.equal(updating.body.url,'https://github.com/owner/addon/releases/download/v1.1.0/addon.zip');assert.equal(updating.csrf,'test-csrf');
        const enabling=requests.find(request=>request.body.action==='enable'&&request.body.addonId==='disabled');assert.equal(enabling.csrf,'test-csrf');
        const deletion=requests.find(request=>request.body.action==='delete');assert.equal(deletion.body.cascade,true,'Explicit cascade not sent');assert.equal(deletion.csrf,'test-csrf');
        assert.deepEqual(deletion.body.expectedAffectedIds,['base','child','disabled','grandchild'],'Confirmed deletion impact differs from preview');
        const disabling=requests.find(request=>request.body.action==='disable');assert.deepEqual(disabling.body.expectedAffectedIds,['new-addon'],'Noncascade impact omits selected addon');
        manualRecovery=true;
        await evaluate(`(async()=>{document.getElementById('am-reconnect').click();for(let i=0;i<300;i++){if(document.getElementById('am-operation-status').textContent==='Recovered'&&!document.getElementById('am-install').disabled)return;await new Promise(r=>setTimeout(r,25));}throw new Error('Recovery did not release mutation guard');})()`);
        const audit=[];
        const waitBrowser=expression=>evaluate(`(async()=>{for(let i=0;i<1000;i++){if(${expression})return;await new Promise(r=>setTimeout(r,25));}throw new Error('Audit wait timed out: '+${JSON.stringify(expression)});})()`);
        const waitHost=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await sleep(25);}throw new Error('Audit host wait timed out');};
        const rowExpression=`Array.from(document.querySelectorAll('#am-addons tr')).find(node=>node.querySelector('.am-addon-id').textContent==='new-addon')`;
        await evaluate(`(()=>{document.body.style.overflow='clip';document.getElementById('am-install').click();for(const url of ['https://github.com/owner/addon','https://github.com/owner/addon/archive/v1.zip?token=secret','https://github.com/owner/addon/archive/v1.zip#']){document.getElementById('am-package-url').value=url;document.getElementById('am-dialog-form').requestSubmit();if(document.getElementById('am-dialog-error').hidden||!document.getElementById('am-dialog').open)throw new Error('Unsupported package URL submitted: '+url);}document.getElementById('am-dialog-cancel').click();if(document.body.style.overflow!=='clip')throw new Error('Dialog changed the previous scroll lock');document.body.style.overflow='';})()`);
        audit.push('Repository/query/empty-fragment URLs rejected locally','Dialog restores existing body scroll state');
        auditHooks.addons=res=>{res.statusCode=503;res.end('null');};
        await evaluate(`document.getElementById('am-refresh').click();`);await waitBrowser(`!document.getElementById('am-refresh').disabled`);
        await evaluate(`if(!document.getElementById('am-install').disabled||document.getElementById('am-notice').hidden)throw new Error('Failed registry refresh left stale mutations available');`);
        delete auditHooks.addons;
        await evaluate(`document.getElementById('am-refresh').click();`);await waitBrowser(`!document.getElementById('am-install').disabled`);
        audit.push('Failed registry refresh blocks stale mutations');
        let heldAddons;
        auditHooks.addons=res=>{heldAddons=res;};
        await evaluate(`(()=>{(${rowExpression}).querySelector('[data-mutation="update"]').click();document.getElementById('am-refresh').click();if(!document.getElementById('am-install').disabled||!document.getElementById('am-dialog-submit').disabled)throw new Error('Refreshing registry left mutations available');})()`);
        await waitHost(()=>heldAddons);
        addons.find(addon=>addon.id==='new-addon').version='1.2.0';
        delete auditHooks.addons;heldAddons.end(JSON.stringify({data:addons}));
        await waitBrowser(`(${rowExpression}).querySelector('.am-version').textContent==='1.2.0'`);
        const beforeStaleSubmit=requests.length;
        await evaluate(`(()=>{if(!document.getElementById('am-dialog-submit').disabled||document.getElementById('am-dialog-error').hidden)throw new Error('Changed confirmation stayed usable');document.getElementById('am-package-url').value='https://github.com/owner/addon/archive/v1.zip';document.getElementById('am-dialog-form').requestSubmit();document.getElementById('am-dialog-cancel').click();})()`);
        assert.equal(requests.length,beforeStaleSubmit,'Stale addon selection submitted a mutation');
        audit.push('Registry refresh disables open mutations','Changed addon invalidates confirmation');
        let heldDoctor;
        auditHooks.doctor=res=>{heldDoctor=res;};
        await evaluate(`document.getElementById('am-doctor').click();document.getElementById('am-install').click();`);
        await waitHost(()=>heldDoctor);heldDoctor.end(JSON.stringify({data:{ok:true,checks:[]}}));delete auditHooks.doctor;
        await waitBrowser(`!document.getElementById('am-doctor').disabled`);
        await evaluate(`if(document.getElementById('am-dialog-title').textContent!=='Install an addon')throw new Error('Late health response replaced confirmation');document.getElementById('am-dialog-cancel').click();`);
        audit.push('Delayed health result preserves newer dialog');
        addons.find(addon=>addon.id==='new-addon').lastOperation={id:'op-5',status:'recovered',action:'disable'};
        await evaluate(`document.getElementById('am-refresh').click();`);await waitBrowser(`!document.getElementById('am-refresh').disabled`);
        let heldDetails;
        auditHooks.operation=(url,res)=>{if(url.endsWith('/op-5')){heldDetails=res;return true;}return false;};
        await evaluate(`(()=>{Array.from((${rowExpression}).querySelectorAll('button')).find(node=>node.textContent==='Details').click();Array.from(document.querySelectorAll('#am-dialog-body button')).find(node=>node.textContent==='View operation details').click();document.getElementById('am-dialog-cancel').click();document.getElementById('am-install').click();})()`);
        await waitHost(()=>heldDetails);heldDetails.end(JSON.stringify({data:{id:'op-5',status:'recovered',action:'disable',logs:[]}}));delete auditHooks.operation;
        await sleep(150);
        await evaluate(`if(document.getElementById('am-dialog-title').textContent!=='Install an addon')throw new Error('Late details replaced confirmation');document.getElementById('am-dialog-cancel').click();`);
        audit.push('Delayed operation details preserve newer dialog');
        let heldOldPoll;
        auditHooks.operation=(url,res)=>{if(url.endsWith('/op-5')){heldOldPoll=res;return true;}if(url.endsWith('/audit-new')){res.end(JSON.stringify({data:{id:'audit-new',status:'recovery_required',action:'disable'}}));return true;}return false;};
        await evaluate(`window.dispatchEvent(new Event('online'));`);await waitHost(()=>heldOldPoll);
        await evaluate(`(()=>{const key='addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api';const saved=JSON.stringify({pending:null,operationId:'audit-new',operationStatus:'succeeded'});localStorage.setItem(key,saved);window.dispatchEvent(new StorageEvent('storage',{key,newValue:saved}));if(!document.getElementById('am-install').disabled)throw new Error('Saved terminal status released mutation guard before verification');})()`);
        heldOldPoll.end(JSON.stringify({data:{id:'op-5',status:'recovered',action:'disable'}}));
        await waitBrowser(`document.getElementById('am-operation-meta').textContent.includes('audit-new')&&document.getElementById('am-operation-status').textContent==='Recovery required'`);
        await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(saved.operationId!=='audit-new')throw new Error('Old poll overwrote the shared operation');})()`);
        audit.push('Saved terminal status waits for verification','Superseded poll preserves shared operation');
        auditHooks.operation=(url,res)=>{if(url.endsWith('/audit-new')){res.end(JSON.stringify({data:{id:'audit-new',status:'recovered',action:'disable'}}));return true;}if(url.endsWith('/audit-terminal')){res.end(JSON.stringify({data:{id:'audit-terminal',status:'succeeded',action:'update'}}));return true;}return false;};
        await evaluate(`document.getElementById('am-reconnect').click();`);await waitBrowser(`!document.getElementById('am-install').disabled`);
        heldAddons=null;
        const staleRegistry=JSON.parse(JSON.stringify(addons));
        auditHooks.addons=res=>{heldAddons=res;};
        await evaluate(`document.getElementById('am-refresh').click();`);await waitHost(()=>heldAddons);
        addons.find(addon=>addon.id==='new-addon').version='1.3.0';
        await evaluate(`(()=>{const key='addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api';const saved=JSON.stringify({pending:null,operationId:'audit-terminal',operationStatus:'queued'});localStorage.setItem(key,saved);window.dispatchEvent(new StorageEvent('storage',{key,newValue:saved}));})()`);
        await waitBrowser(`document.getElementById('am-operation-status').textContent==='Completed'`);
        delete auditHooks.addons;heldAddons.end(JSON.stringify({data:staleRegistry}));
        await waitBrowser(`(${rowExpression}).querySelector('.am-version').textContent==='1.3.0'&&!document.getElementById('am-install').disabled`);
        delete auditHooks.operation;
        audit.push('Completion during registry refresh requests fresh state');
        const beforeAuthRequests=requests.length;
        let acknowledgementCount=0;
        auditHooks.post=(res)=>{acknowledgementCount++;if(acknowledgementCount>4)return false;res.statusCode=[503,404,419,403][acknowledgementCount-1];res.end(acknowledgementCount===3?'null':JSON.stringify({message:'Interrupted acknowledgement'}));return true;};
        await evaluate(`(()=>{(${rowExpression}).querySelector('[data-mutation="update"]').click();document.getElementById('am-package-url').value='https://github.com/owner/addon/archive/v1.zip';document.getElementById('am-dialog-form').requestSubmit();})()`);
        await waitBrowser(`document.getElementById('am-operation-message').textContent.includes('session has expired')`);
        await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(!saved.pending||!document.getElementById('am-install').disabled)throw new Error('Session error discarded an ambiguous operation');document.getElementById('am-reconnect').click();})()`);
        await waitBrowser(`document.getElementById('am-operation-message').textContent.includes('root administrator')`);
        await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(!saved.pending||!document.getElementById('am-install').disabled)throw new Error('Actor/session access denial discarded an ambiguous operation');document.getElementById('am-reconnect').click();})()`);
        await waitBrowser(`document.getElementById('am-operation-status').textContent==='Completed'&&!document.getElementById('am-install').disabled`);
        delete auditHooks.post;
        const authRequests=requests.slice(beforeAuthRequests);assert.equal(authRequests.length,5,'Session recovery changed retry count');for(const request of authRequests)assert.deepEqual(authRequests[0].body,request.body);
        audit.push('Session failure retains ambiguous submission','Session reconnect replays original request ID and body');
        audit.push('Malformed HTTP error body preserves session diagnostics');
        audit.push('Unexpected POST route error retains ambiguous submission');
        audit.push('Changed administrator response retains ambiguous submission');
        const beforeTwoFactorRequests=requests.length;
        let twoFactorAttempts=0;
        auditHooks.post=(res)=>{twoFactorAttempts++;if(twoFactorAttempts>2)return false;res.statusCode=twoFactorAttempts===1?503:400;res.end(JSON.stringify({message:twoFactorAttempts===1?'Acknowledgement lost':'Two-factor authentication is required.'}));return true;};
        await evaluate(`(()=>{(${rowExpression}).querySelector('[data-mutation="update"]').click();document.getElementById('am-package-url').value='https://github.com/owner/addon/archive/v1.zip';document.getElementById('am-dialog-form').requestSubmit();})()`);
        await waitBrowser(`document.getElementById('am-operation-message').textContent.includes('two-factor authentication')`);
        await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(!saved.pending||saved.pending.ambiguous!==true||!document.getElementById('am-install').disabled)throw new Error('Two-factor HTTP 400 erased pending operation');})()`);
        await sleep(8500);assert.equal(twoFactorAttempts,2,'Two-factor failure automatically retried');
        await evaluate(`document.getElementById('am-reconnect').click();`);
        await waitBrowser(`document.getElementById('am-operation-status').textContent==='Completed'&&!document.getElementById('am-install').disabled`);
        delete auditHooks.post;
        const twoFactorRequests=requests.slice(beforeTwoFactorRequests);assert.equal(twoFactorRequests.length,3);for(const request of twoFactorRequests)assert.deepEqual(twoFactorRequests[0].body,request.body);
        audit.push('Lost acknowledgement then HTTP 400 retains request','Two-factor failure waits for manual session repair','Two-factor repair replays original request ID and body');
        const beforeValidationRequests=requests.length;
        const beforeValidationOperations=operations.size;
        let validationAttempts=0,heldSubmission;
        auditHooks.post=(res)=>{validationAttempts++;if(validationAttempts===1){heldSubmission=res;return true;}if(validationAttempts===2){res.statusCode=422;res.end(JSON.stringify({message:'Server validation changed.',errors:{url:['Repair the changed validator before retrying.']}}));return true;}return false;};
        await evaluate(`(()=>{(${rowExpression}).querySelector('[data-mutation="update"]').click();document.getElementById('am-package-url').value='https://github.com/owner/addon/archive/v1.zip';document.getElementById('am-dialog-form').requestSubmit();})()`);
        await waitHost(()=>heldSubmission);
        await evaluate(`(()=>{const key='addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api';const saved=JSON.parse(localStorage.getItem(key));if(!saved.pending||saved.pending.ambiguous!==true)throw new Error('Ambiguity was not recorded before dispatch');delete saved.pending.ambiguous;localStorage.setItem(key,JSON.stringify(saved));})()`);
        const validationReload=nextPageLoad();await send('Page.reload');await validationReload;heldSubmission.destroy();
        await waitBrowser(`document.getElementById('am-operation-message').textContent.includes('An earlier submission may already be recorded')`);
        await evaluate(`(()=>{const saved=JSON.parse(localStorage.getItem('addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api'));if(!saved.pending||saved.pending.ambiguous!==true||!document.getElementById('am-install').disabled)throw new Error('Ambiguous validation rejection erased restored request');if(!document.getElementById('am-operation-message').textContent.includes('Repair the changed validator'))throw new Error('Retained validation diagnostics are missing');})()`);
        await sleep(4500);assert.equal(validationAttempts,2,'Ambiguous validation rejection automatically retried');
        await evaluate(`document.getElementById('am-reconnect').click();`);
        await waitBrowser(`document.getElementById('am-operation-status').textContent==='Completed'&&!document.getElementById('am-install').disabled`);
        delete auditHooks.post;
        const validationRequests=requests.slice(beforeValidationRequests);assert.equal(validationRequests.length,3);for(const request of validationRequests)assert.deepEqual(validationRequests[0].body,request.body);assert.equal(operations.size,beforeValidationOperations+1,'Validation recovery created a replacement operation');
        audit.push('Ambiguity persists before response acknowledgement','Legacy restored pending is conservatively ambiguous','Later HTTP 422 retains original request and diagnostics','Ambiguous validation failure waits for manual repair','Validation repair replays one original durable operation');
        const beforeActorRequests=requests.length;
        await evaluate(`(()=>{const key='addon-manager:v1:'+location.origin+':42:/admin/addon-manager/api';localStorage.setItem(key,JSON.stringify({pending:{body:{action:'install',requestId:'actor42-request-identity',url:'https://github.com/owner/addon/archive/v1.zip'}}}));})()`);
        await send('Page.navigate',{url:`http://127.0.0.1:${port}${pagePath}?actor=43`});await waitBrowser(`document.getElementById('am-count-total').textContent==='2'&&!document.getElementById('am-install').disabled`);
        assert.equal(requests.length,beforeActorRequests,'Actor 43 replayed actor 42 pending request');
        await evaluate(`if(!document.getElementById('am-operation').hidden||document.getElementById('addon-manager').dataset.actor!=='43')throw new Error('Actor progress state leaked');`);
        audit.push('Operation persistence is scoped to administrator');
        const restoredBody={action:'update',addonId:'new-addon',requestId:'A_'.repeat(64),url:'https://github.com/owner/addon?previously-accepted=value'};
        await evaluate(`localStorage.setItem('addon-manager:v1:'+location.origin+':43:/admin/addon-manager/api',JSON.stringify({pending:{body:${JSON.stringify(restoredBody)}}}));`);
        await send('Page.reload');await waitHost(()=>requests.length>beforeActorRequests);
        assert.deepEqual(requests[requests.length-1].body,restoredBody,'Restoration changed a previously submitted body');
        assert.equal(requests[requests.length-1].actor,'43','Restored request did not bind to rendered administrator');
        await waitBrowser(`document.getElementById('am-operation-status').textContent==='Completed'&&!document.getElementById('am-install').disabled`);
        audit.push('Full-length underscored request ID restores','URL validation changes preserve previously submitted body');
        assert(requests.slice(0,-1).every(request=>request.actor==='42'),'A mutation lost its rendered administrator binding');
        assert(requestedAssets.every(path=>path.endsWith('?v='+encodeURIComponent(assetVersion))),'Browser requested unversioned manager assets');
        const passed=[...results,...resumed,...responsive,...lifecycle,...audit,'Refresh before acknowledgement replays exact body','CSRF mutation headers','Rendered administrator mutation headers','Versioned manager browser assets','Stable request ID on retry','Optional theme dark colors','Recovery completion releases guard','HTTP uses neutral API endpoints'];
        assert(apiRequests.every(request=>request.path.startsWith(apiBase+'/')),'Request escaped neutral API URL');
        const report={outputRoot,passed,count:passed.length,requests:requests.length,operations:operations.size,apiPaths:[...new Set(apiRequests.map(request=>request.path))],screenshots:['mobile.png','dark.png']};
        fs.writeFileSync(path.join(outputRoot, 'results.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify(report,null,2));
    } catch(error) {
        let page;
        try {page=await evaluate(`(()=>({actor:document.getElementById('addon-manager')?.dataset.actor,message:document.getElementById('am-operation-message')?.textContent,status:document.getElementById('am-operation-status')?.textContent,notice:document.getElementById('am-notice')?.textContent,progress:localStorage.getItem('addon-manager:v1:'+location.origin+':'+document.getElementById('addon-manager')?.dataset.actor+':/admin/addon-manager/api')}))()`);} catch(_) {}
        fs.writeFileSync(path.join(outputRoot,'failure.json'),JSON.stringify({message:error.message,page,requests,apiRequests},null,2)+'\n');
        throw error;
    } finally {ws.close();chrome.kill('SIGTERM');server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
