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
    const event=row.payload.event,venue=row.payload.venue,proposal=venue.proposal,s=event.schedule;
    const detail=$('detail');detail.replaceChildren(tag(row.status),element('h2',event.title,'detail-title'),element('p',event.description,'event-description'));
    const facts=element('div',undefined,'facts');
    facts.append(fact('VENUE',proposal?proposal.name+'\n'+proposal.address+', '+proposal.city+'\nProposed venue · '+(proposal.latitude??'Location needed')+', '+(proposal.longitude??''):row.business?row.business.name+'\n'+row.business.address+', '+row.business.city+(row.business.isActive?'':'\nInactive venue'):venue.businessId+'\nVenue unavailable'));
    facts.append(fact('YOUR LOCAL TIME',row.occurrence?(s.allDay?'All Day at venue · ':'')+new Date(row.occurrence.startsAt).toLocaleString('en-US',{hour12:true})+' – '+new Date(row.occurrence.endsAt).toLocaleString('en-US',{hour12:true}):'Verify the venue location to preview local times.'));
    if(event.sourceUrl) {
        const link=sourceLink(event.sourceUrl);
        if(link) detail.append(link);
    }
    facts.append(fact('PRICE',event.priceAmount===null?'Price unknown':event.priceAmount+' '+event.currency),fact('CATEGORIES',event.categoryIds.map(x=>categoryNames.get(x)||x).join(', ')));
    if(event.offer)facts.append(fact('OFFER',event.offer));if(event.requirements)facts.append(fact('REQUIREMENTS',event.requirements));detail.append(facts,element('p','Reference '+row.id,'muted'));
    if(row.status!=='PENDING'){detail.append(element('p','Reviewed by '+row.reviewedBy+' · '+new Date(row.reviewedAt).toLocaleString('en-US',{hour12:true}),'muted'));if(row.reviewNote)detail.append(fact('REVIEW NOTE',row.reviewNote));if(row.experienceId){const link=element('a','View published API entry');link.href='/api/v1/experiences/'+encodeURIComponent(row.experienceId);link.target='_blank';link.rel='noopener';detail.append(link);}return;}
    const actions=element('div',undefined,'review-actions');actions.append(element('h3','Review decision'));
    const venueSelect=element('select');venueSelect.append(new Option(proposal?'Create proposed venue':'Keep submitted venue',''));
    let latitude,longitude;
    const needsCoordinates=!!proposal||!row.business||row.business.latitude==null||row.business.longitude==null;
    if(proposal){
        const label=element('label','Venue match');label.append(venueSelect);actions.append(label,element('p','Check for an existing venue before creating one. Verify the coordinates before publishing. The venue location determines its schedule automatically.','muted'));
    }
    if(needsCoordinates){
        const coords=element('div',undefined,'coordinates');latitude=element('input');latitude.type='number';latitude.step='any';latitude.min='-90';latitude.max='90';longitude=element('input');longitude.type='number';longitude.step='any';longitude.min='-180';longitude.max='180';
        latitude.value=proposal?.latitude??'';longitude.value=proposal?.longitude??'';
        const latLabel=element('label','Venue latitude'),lonLabel=element('label','Venue longitude');latLabel.append(latitude);lonLabel.append(longitude);coords.append(latLabel,lonLabel);actions.append(coords);
    }
    if(proposal){
        venueSelect.addEventListener('change',()=>{latitude.disabled=longitude.disabled=!!venueSelect.value;});
        api('/api/v1/businesses?'+new URLSearchParams({q:proposal.name.slice(0,100),searchAll:'true'})).then(data=>{if(selectedId===id)data.items.forEach(x=>venueSelect.append(new Option(x.name+' · '+x.address,x.id)));}).catch(()=>notice('Venue matches could not load. Refresh before approving a new venue.'));
    }
    const note=element('textarea');note.maxLength=2000;note.placeholder='Required for rejection; optional for approval.';const noteLabel=element('label','Review note');noteLabel.append(note);actions.append(noteLabel);
    const approve=element('button','Approve & publish','primary'),reject=element('button','Reject submission','danger');
    async function decision(action){
        if(busy)return;if(action==='reject'&&!note.value.trim()){notice('Enter a reason before rejecting.');note.focus();return;}
        const body={note:note.value.trim()};if(action==='approve'&&needsCoordinates){if(venueSelect.value)body.businessId=venueSelect.value;else {if(!latitude.checkValidity()||!longitude.checkValidity()||latitude.value===''||longitude.value===''){notice('Enter valid latitude and longitude together.');return;}body.latitude=Number(latitude.value);body.longitude=Number(longitude.value);}}
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
        const time = schedule.allDay ? 'All day' : schedule.startTime.slice(0, 5) + '–' +
            schedule.endTime.slice(0, 5) + (schedule.endsNextDay ? ' (next day)' : '') + ' Mountain time';
        card.append(element('p', schedule.startDate + ' · ' + time));
    }
    card.append(element('p', item.venue || 'Venue missing from feed'));
    const link = sourceLink(item.url);
    if (link) card.append(link);
    if (item.issue) card.append(element('p', item.issue));
    if (item.queuedStatus) card.append(element('p', 'Already imported · ' + item.queuedStatus));
    if (item.issue || item.queuedStatus) return card;

    const form = element('form');
    const category = element('select');
    category.required = true;
    category.append(new Option('Choose category', ''));
    for (const [id, name] of categoryNames) category.append(new Option(name, id));
    const categoryLabel = element('label', 'Category');
    categoryLabel.append(category);
    form.append(categoryLabel);

    const query = importField(form, 'Find an existing venue');
    const search = element('button', 'Find venue');
    search.type = 'button';
    const venue = element('select');
    venue.append(new Option('Use new venue details below', ''));
    const venueLabel = element('label', 'Existing venue');
    venueLabel.append(venue);
    form.append(search, venueLabel);
    const proposal = element('fieldset');
    proposal.append(element('legend', 'New venue · verify the address and coordinates'));
    const name = importField(proposal, 'Venue name');
    const address = importField(proposal, 'Address', item.venue);
    const city = importField(proposal, 'City', item.city);
    const latitude = importField(proposal, 'Latitude', item.latitude ?? '', 'number');
    const longitude = importField(proposal, 'Longitude', item.longitude ?? '', 'number');
    venue.addEventListener('change', () => { proposal.disabled = Boolean(venue.value); });
    search.addEventListener('click', async () => {
        search.disabled = true;
        try {
            const data = await api('/api/v1/businesses?searchAll=true&q=' + encodeURIComponent(query.value.trim()));
            venue.replaceChildren(new Option('Use new venue details below', ''));
            for (const match of data.items) venue.append(new Option(match.name + ' · ' + match.address, match.id));
            proposal.disabled = false;
            if (!data.items.length) notice('No matching venues. Enter verified venue details below.');
        } catch (error) { notice(error.message); }
        finally { search.disabled = false; }
    });
    const queue = element('button', 'Add to Pending', 'primary');
    form.append(proposal, element('p', 'Imported price starts as Unknown.'), queue);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!venue.value && [name, address, city, latitude, longitude].some(input => !input.value.trim())) {
            notice('Choose an existing venue or fill in all new venue details.');
            return;
        }
        const choice = venue.value ? { businessId: venue.value } : { proposal: {
            name: name.value, address: address.value, city: city.value,
            latitude: Number(latitude.value), longitude: Number(longitude.value)
        } };
        queue.disabled = true;
        try {
            await api('/admin/api/event-imports', { method: 'POST', body: JSON.stringify({
                source: feed.source, id: item.id, categoryId: category.value, venue: choice
            }) });
            form.replaceWith(element('p', 'Added to Pending'));
            notice('Imported event is ready for review.', true);
            if (status === 'PENDING') await loadQueue();
        } catch (error) { notice(error.message); queue.disabled = false; }
    });
    card.append(form);
    return card;
}

$('imports-preview').addEventListener('click', async () => {
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
            section.append(element('p', feed.error || (feed.records
                ? feed.format + ' · ' + feed.records + ' records fetched · ' + feed.items.length + ' in preview'
                : feed.format + ' · Feed returned zero event records')));
            feed.items.forEach(item => section.append(renderImport(feed, item)));
            $('imports').append(section);
        }
    } catch (error) {
        if (generation === authGeneration) $('imports').replaceChildren(element('p', error.message));
    } finally { button.disabled = false; }
});
