'use strict';
const $=id=>document.getElementById(id);
let authGeneration=0;
let csrf='',status='PENDING',rows=[],nextCursor=null,selectedId=null,busy=false,categoryNames=new Map();
function notice(message='',success=false){$('notice').textContent=message;$('notice').classList.toggle('success',success);}
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
async function api(path,options={}){
    const response=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
    let data;try{data=await response.json();}catch{throw Error('Unexpected server response. Check the backend deployment.');}
    if(!response.ok){if(response.status===401&&path!=='/admin/api/login')showLogin();throw Error(data.error?.message||'Request failed.');}
    return data;
}
function showLogin(){authGeneration++;csrf='';rows=[];selectedId=null;$('review-view').hidden=true;$('account').hidden=true;$('login-view').hidden=false;$('queue').replaceChildren();$('detail').replaceChildren();$('imports').replaceChildren();}
function showReview(session){authGeneration++;csrf=session.csrfToken;$('username').textContent=session.username;$('account').hidden=false;$('login-view').hidden=true;$('review-view').hidden=false;}
async function referenceData(){
    try{const categories=await api('/api/v1/categories');categoryNames=new Map(categories.items.map(x=>[x.id,x.name]));}
    catch{notice('Reference names could not load. IDs are shown where needed; refresh to retry.');}
}
function tag(state){return element('span',state.toLowerCase(),`tag ${state.toLowerCase()}`);}
function renderQueue(){
    $('queue-heading').textContent=status.charAt(0)+status.slice(1).toLowerCase()+' submissions';$('queue-count').textContent=String(rows.length);
    $('queue').replaceChildren();$('more').hidden=!nextCursor;
    if(!rows.length){$('queue').append(element('p','No '+status.toLowerCase()+' submissions.','queue-empty'));$('detail').replaceChildren(element('div','The queue is clear. Refresh to check for new submissions.','empty-state'));return;}
    rows.forEach(row=>{const button=element('button',undefined,'queue-item'+(row.id===selectedId?' selected':''));button.append(element('strong',row.payload.event.title),element('small',new Date(row.createdAt).toLocaleString('en-US',{hour12:true})),tag(row.status));button.addEventListener('click',()=>{if(!busy)select(row.id);});$('queue').append(button);});
}
async function loadQueue(append=false){
    if(busy)return;const generation=authGeneration;busy=true;$('refresh').disabled=true;$('more').disabled=true;
    try{const query=new URLSearchParams({status});if(append&&nextCursor)query.set('before',nextCursor);const data=await api('/admin/api/submissions?'+query);if(generation!==authGeneration)return;rows=append?[...rows,...data.items]:data.items;nextCursor=data.nextCursor;selectedId=rows.some(x=>x.id===selectedId)?selectedId:rows[0]?.id||null;renderQueue();if(selectedId)await select(selectedId);}
    catch(error){notice(error.message);}finally{busy=false;$('refresh').disabled=false;$('more').disabled=false;}
}
function fact(label,value){const box=element('div');box.append(element('span',label,'fact-label'),element('div',value,'fact-value'));return box;}
async function select(id){
    selectedId=id;renderQueue();const row=rows.find(x=>x.id===id);if(!row)return;
    const event=row.payload.event,venue=row.payload.venue,proposal=venue.proposal,s=event.schedule || {};
    const detail=$('detail');detail.replaceChildren(tag(row.status),element('h2',event.title,'detail-title'),element('p',event.description,'event-description'));
    const facts=element('div',undefined,'facts');
    facts.append(fact('VENUE',proposal?proposal.name+'\n'+[proposal.address,proposal.city,proposal.state].filter(Boolean).join(', ')+'\nProposed venue · '+(proposal.latitude??'Coordinates not provided')+', '+(proposal.longitude??''):row.business?row.business.name+'\n'+[row.business.address,row.business.city,row.business.state].filter(Boolean).join(', ')+(row.business.isActive?'':'\nInactive venue'):venue.businessId+'\nVenue unavailable'));
    facts.append(fact('YOUR LOCAL TIME',row.occurrence?(s.allDay?'All Day at venue · ':'')+new Date(row.occurrence.startsAt).toLocaleString('en-US',{hour12:true})+(s.endTime?' – '+new Date(row.occurrence.endsAt).toLocaleString('en-US',{hour12:true}):''):'Verify the venue location to preview local times.'));
    if(event.sourceUrl) {
        const link=sourceLink(event.sourceUrl);
        if(link) detail.append(link);
    }
    if(event.priceAmount!=null)facts.append(fact('PRICE',Number(event.priceAmount)===0?'Free':'$'+event.priceAmount));
    if(event.categoryIds?.length)facts.append(fact('CATEGORIES',event.categoryIds.map(x=>categoryNames.get(x)||x).join(', ')));
    detail.append(facts,element('p','Reference '+row.id,'muted'));
    if(row.status!=='PENDING'){
        const undo = element('button', 'Undo decision · return to Pending');
        undo.addEventListener('click', async () => {
            if (busy) return;
            busy = true;
            undo.disabled = true;
            try {
                await api('/admin/api/submissions/'+id+'/undo', { method:'POST', body:'{}' });
                notice('Decision undone. The event is back in Pending.', true);
                busy = false;
                await loadQueue();
            } catch(error) { notice(error.message); }
            finally { busy = false; undo.disabled = false; }
        });
        detail.append(undo);
detail.append(element('p','Reviewed by '+row.reviewedBy+' · '+new Date(row.reviewedAt).toLocaleString('en-US',{hour12:true}),'muted'));if(row.reviewNote)detail.append(fact('REVIEW NOTE',row.reviewNote));if(row.experienceId){const link=element('a','View published API entry');link.href='/api/v1/experiences/'+encodeURIComponent(row.experienceId);link.target='_blank';link.rel='noopener';detail.append(link);}return;}
    const actions=element('div',undefined,'review-actions');actions.append(element('h3','Review decision'));
    const eventFields=element('fieldset');
    eventFields.append(element('legend','Event details'));
    const eventTitle=importField(eventFields,'Title',event.title);
    const eventDate=importField(eventFields,'Start date',s.startDate || '','date');
    const eventEndDate=importField(eventFields,'End date',s.endDate || s.startDate || '','date');
    const eventStart=importField(eventFields,'Start time',s.startTime?.slice(0,5) || '','time');
    const eventEnd=importField(eventFields,'End time',s.endTime?.slice(0,5) || '','time');
    const allDayLabel=element('label','All day');
    const allDay=element('input');
    allDay.type='checkbox';
    allDay.checked=Boolean(s.allDay);
    allDayLabel.prepend(allDay);
    eventFields.append(allDayLabel);
    actions.append(eventFields);
    let editor;
    if (proposal || !row.business || row.business.latitude == null || row.business.longitude == null) {
        editor=venueEditor(actions, proposal || {name:row.business?.name,address:row.business?.address,city:row.business?.city});
    }
    const note=element('textarea');note.maxLength=2000;note.placeholder='Required for rejection; optional for approval.';const noteLabel=element('label','Review note');noteLabel.append(note);actions.append(noteLabel);
    const fromFeed = row.fromFeed === true;
    const approve=element('button','Approve & publish','primary');
    const reject=element('button',fromFeed ? 'Reject & hide from feed' : 'Reject submission','danger');
    async function decision(action){
        if(busy)return;if(action==='reject'&&!fromFeed&&!note.value.trim()){notice('Enter a reason before rejecting.');note.focus();return;}
        const body={note:note.value.trim() || (action==='reject' && fromFeed ? 'Dismissed from event feed' : '')};
        if(action==='approve') body.event={
            title:eventTitle.value,
            schedule:{...s,kind:s.kind || 'ONCE',startDate:eventDate.value,endDate:eventEndDate.value || eventDate.value,
                startTime:allDay.checked?null:eventStart.value || null,
                endTime:allDay.checked?null:eventEnd.value || null,
                timeZone:s.timeZone || 'America/Denver',weekdays:s.weekdays || [],
                allDay:allDay.checked}
        };
        if (action==='approve' && editor) {
            try { body.venue=editor.read(); }
            catch(error) { notice(error.message); return; }
        }
        busy=true;approve.disabled=reject.disabled=true;
        try{await api('/admin/api/submissions/'+id+'/'+action,{method:'POST',body:JSON.stringify(body)});notice(action==='approve'?'Approved. This experience is now public.':'Submission rejected.',true);busy=false;await loadQueue();}
        catch(error){notice(error.message);}finally{busy=false;approve.disabled=reject.disabled=false;}
    }
    approve.addEventListener('click',()=>decision('approve'));reject.addEventListener('click',()=>decision('reject'));const buttons=element('div',undefined,'button-row');buttons.append(approve,reject);actions.append(buttons);detail.append(actions);
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();$('login-button').disabled=true;notice();try{const session=await api('/admin/api/login',{method:'POST',body:JSON.stringify({username:$('login-username').value,password:$('login-password').value})});$('login-password').value='';showReview(session);await referenceData();await loadQueue();await loadReports();}catch(error){notice(error.message);}finally{$('login-button').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});showLogin();notice('Signed out.',true);}catch(error){notice(error.message);}});
$('refresh').addEventListener('click',async()=>{notice();await referenceData();await loadQueue();await loadReports();});$('more').addEventListener('click',()=>loadQueue(true));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;status=button.dataset.status;selectedId=null;document.querySelectorAll('[data-status]').forEach(x=>x.classList.toggle('active',x===button));notice();loadQueue();}));
(async()=>{try{const session=await api('/admin/api/session');showReview(session);await referenceData();await loadQueue();await loadReports();}catch(error){showLogin();if(!/Sign in|again/.test(error.message))notice(error.message);}})();

async function loadReports(){
 const generation=authGeneration;
 try { const data=await api('/admin/api/reports');if(generation!==authGeneration)return;
  $('reports').replaceChildren();
  if(!data.items.length)$('reports').append(element('p','No open corrections.'));
  data.items.forEach(report=>{const card=element('div',undefined,'queue-item');card.append(element('strong',report.title),element('p',report.businessName+' · '+report.reason.replaceAll('_',' ')),element('p',report.details||'No additional details'),element('small','Event ID: '+report.experienceId));const resolve=element('button','Mark reviewed and resolve');resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await api('/admin/api/reports/'+report.id+'/resolve',{method:'POST',body:'{}'});await loadReports();}catch(error){notice(error.message);resolve.disabled=false;}});card.append(resolve);$('reports').append(card);});
 }catch(error){notice(error.message);}
}
$('reports-refresh').addEventListener('click',loadReports);


function sourceLink(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        const link = element('a', 'View source event');
        link.href = parsed.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        return link;
    } catch { return null; }
}

function importField(form, labelText, value = '', type = 'text') {
    const label = element('label', labelText);
    const input = element('input');
    input.type = type;
    if (type === 'number') input.step = 'any';
    input.value = value;
    label.append(input);
    form.append(label);
    return input;
}

function renderImport(feed, item) {
    const card = element('details', undefined, 'queue-item');
    card.append(element('summary', item.title));
    const schedule = item.schedule;
    if (schedule) {
        const time = schedule.allDay ? 'All day' : (schedule.startTime?.slice(0,5) || 'Time needed') + (schedule.endTime?'–'+schedule.endTime.slice(0,5):'') + ' Mountain time';
        card.append(element('p', schedule.startDate + ' · ' + time));
    }
    card.append(element('p', item.venue || 'Venue missing from feed'));
    const link = sourceLink(item.url);
    if (link) card.append(link);
    if (item.issue) card.append(element('p', item.issue));
    if (item.queuedStatus) card.append(element('p', 'Already imported · ' + item.queuedStatus));
    if (item.queuedStatus !== 'APPROVED') {
        const dismiss = element('button', 'Dismiss from feed', 'danger');
        dismiss.type = 'button';
        dismiss.addEventListener('click', async () => {
            dismiss.disabled = true;
            try {
                await api('/admin/api/event-imports/dismiss', { method: 'POST', body: JSON.stringify({
                    source: feed.source, id: item.id
                }) });
                card.remove();
                notice('Event dismissed. Future feed checks will skip it.', true);
                await loadQueue();
            } catch (error) { notice(error.message); dismiss.disabled = false; }
        });
        card.append(dismiss);
    }
    if (item.issue || item.queuedStatus) return card;

    const form = element('form');
    const category = element('select');
    category.required = false;
    category.append(new Option('Other (default)', ''));
    for (const [id, name] of categoryNames) category.append(new Option(name, id));
    const categoryLabel = element('label', 'Category');
    categoryLabel.append(category);
    form.append(categoryLabel);

    const editor=venueEditor(form, {
        name:item.venueName || '', address:item.address || item.venue, city:item.city,state:'ID',
        latitude:item.latitude,longitude:item.longitude
    });
    const queue = element('button', 'Add to Pending', 'primary');
    form.append(element('p', 'Imported price starts as Unknown.'), queue);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        let choice;
        try { choice=editor.read(); }
        catch(error) { notice(error.message); return; }
        queue.disabled = true;
        try {
            await api('/admin/api/event-imports', { method: 'POST', body: JSON.stringify({
                source: feed.source, id: item.id, categoryId: category.value || undefined, venue: choice
            }) });
            form.replaceWith(element('p', 'Added to Pending'));
            notice('Imported event is ready for review.', true);
            if (status === 'PENDING') await loadQueue();
        } catch (error) { notice(error.message); queue.disabled = false; }
    });
    card.append(form);
    return card;
}

async function previewImports() {
    const generation = authGeneration;
    const button = $('imports-preview');
    button.disabled = true;
    $('imports').replaceChildren(element('p', 'Checking the event feeds…'));
    try {
        const { feeds } = await api('/admin/api/event-imports');
        if (generation !== authGeneration) return;
        $('imports').replaceChildren();
        for (const feed of feeds) {
            const section = element('section');
            section.append(element('h3', feed.name));
            if (feed.note) section.append(element('p', feed.note));
            section.append(element('p', feed.error || (feed.records
                ? feed.format + ' · ' + feed.records + ' records fetched · ' + feed.items.length + ' in preview · ' + (feed.hidden || 0) + ' filtered or dismissed'
                : feed.format + ' · Feed returned zero event records')));
            feed.items.forEach(item => section.append(renderImport(feed, item)));
            $('imports').append(section);
        }
    } catch (error) {
        if (generation === authGeneration) $('imports').replaceChildren(element('p', error.message));
    } finally { button.disabled = false; }
}
$('imports-preview').addEventListener('click', previewImports);
$('imports-sync').addEventListener('click', async () => {
    const button = $('imports-sync');
    button.disabled = true;
    try {
        const result = await api('/admin/api/event-imports/sync', { method: 'POST', body: '{}' });
        const detail = result.needsReview ? ' ' + result.needsReview + ' need a venue or category.' : '';
        const unavailable = result.unavailable ? ' ' + result.unavailable + ' feed(s) unavailable.' : '';
        notice((result.accepted || 0) + ' feed event(s) accepted. ' + result.queued + ' added to Pending.' + detail + unavailable, true);
        await loadQueue();
        await previewImports();
    } catch (error) { notice(error.message); }
    finally { button.disabled = false; }
});


function venueEditor(parent, initial = {}) {
    const fieldset=element('fieldset');
    fieldset.append(element('legend','Venue'));
    const query=importField(fieldset,'Search a venue or address');
    const results=element('div');
    results.setAttribute('aria-live','polite');
    fieldset.append(results);
    const credit=element('a','Venue search © OpenStreetMap contributors · Photon');
    credit.href='https://www.openstreetmap.org/copyright';
    credit.target='_blank';
    credit.rel='noopener noreferrer';
    fieldset.append(credit);
    const name=importField(fieldset,'Venue name (optional)',initial.name || '');
    name.maxLength=200;
    const address=importField(fieldset,'Address',initial.address || '');
    address.maxLength=300;
    const city=importField(fieldset,'City',initial.city || '');
    city.maxLength=100;
    const state=importField(fieldset,'State',initial.state || 'ID');
    state.maxLength=100;
    const toggleLabel=element('label','Enter latitude and longitude manually');
    const toggle=element('input');
    toggle.type='checkbox';
    toggleLabel.prepend(toggle);
    fieldset.append(toggleLabel);
    const coordinates=element('div',undefined,'coordinates');
    coordinates.hidden=true;
    const latitude=importField(coordinates,'Latitude',initial.latitude ?? '','number');
    const longitude=importField(coordinates,'Longitude',initial.longitude ?? '','number');
    latitude.min='-90';latitude.max='90';longitude.min='-180';longitude.max='180';
    fieldset.append(coordinates);
    let selected=Number.isFinite(initial.latitude) && Number.isFinite(initial.longitude);
    let selectedBusiness;
    for (const input of [name,address,city,state]) input.addEventListener('input',()=>{
        selected=false;
        selectedBusiness=null;
    });
    toggle.addEventListener('change',()=>{
        coordinates.hidden=!toggle.checked;
        selected=false;
        selectedBusiness=null;
    });
    let timer;
    let generation=0;
    let controller;
    query.addEventListener('input',()=>{
        clearTimeout(timer);
        controller?.abort();
        const current=++generation;
        const text=query.value.trim();
        results.replaceChildren();
        if(text.length<3)return;
        timer=setTimeout(async()=>{
            controller=new AbortController();
            try {
                const data=await api('/admin/api/venue-search?q='+encodeURIComponent(text),{signal:controller.signal});
                if(current!==generation || !fieldset.isConnected)return;
                results.replaceChildren();
                if(!data.items.length)results.append(element('p','No matching venues. Enter an address below.'));
                for(const place of data.items) {
                    const pick=element('button',place.label);
                    pick.type='button';
                    pick.addEventListener('click',()=>{
                        name.value=place.name;
                        address.value=place.address || '';
                        city.value=place.city || '';
                        state.value=place.state || 'ID';
                        latitude.value=place.latitude;
                        longitude.value=place.longitude;
                        selected=true;
                        selectedBusiness=place.businessId;
                        results.replaceChildren(element('p','Selected '+place.label));
                    });
                    results.append(pick);
                }
            } catch(error) {
                if(error.name!=='AbortError' && current===generation)results.replaceChildren(element('p',error.message));
            }
        },650);
    });
    parent.append(fieldset);
    return {
        read() {
            if(selectedBusiness)return {businessId:selectedBusiness};
            if(toggle.checked && (!latitude.value || !longitude.value || !latitude.checkValidity() || !longitude.checkValidity())) {
                throw Error('Enter valid latitude and longitude.');
            }
            if(!toggle.checked && !selected && (!city.value.trim() || !state.value.trim())) {
                throw Error('Enter city and state or select a venue.');
            }
            const proposal={
                name:name.value.trim() || address.value.trim() || 'Event venue',
                address:address.value.trim() || null,
                city:city.value.trim() || null,state:state.value.trim() || null
            };
            if(toggle.checked || selected) {
                proposal.latitude=Number(latitude.value);
                proposal.longitude=Number(longitude.value);
            }
            return {proposal};
        }
    };
}
