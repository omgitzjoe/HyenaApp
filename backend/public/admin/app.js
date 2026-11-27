'use strict';
const $=id=>document.getElementById(id);
let authGeneration=0;
const bulkSelection=new Map();
let csrf='',status='PENDING',rows=[],nextCursor=null,selectedId=null,busy=false,categoryNames=new Map();
function notice(message='',success=false){$('notice').textContent=message;$('notice').classList.toggle('success',success);}
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
async function api(path,options={}){
    const generation=authGeneration;
    const response=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
    let data;try{data=await response.json();}catch{throw Error('Unexpected server response. Check the backend deployment.');}
    if(!response.ok){
        if(response.status===401&&path!=='/admin/api/login'&&generation===authGeneration)showLogin();
        throw Object.assign(new Error(data.error?.message||'Request failed.'),data.error,{status:response.status});
    }
    return data;
}
function showLogin(){feedChanges=[];feedChangeErrors.clear();$('feed-changes').replaceChildren();$('feed-changes-status').textContent='';setFeedChangesBusy(false);bulkSelection.clear();authGeneration++;csrf='';rows=[];selectedId=null;$('review-view').hidden=true;$('account').hidden=true;$('login-view').hidden=false;$('queue').replaceChildren();$('detail').replaceChildren();$('imports').replaceChildren();}
function showReview(session){authGeneration++;csrf=session.csrfToken;$('username').textContent=session.username;$('account').hidden=false;$('login-view').hidden=true;$('review-view').hidden=false;}
async function referenceData(){
    try{const categories=await api('/api/v1/categories');categoryNames=new Map(categories.items.map(x=>[x.id,x.name]));}
    catch{notice('Reference names could not load. IDs are shown where needed; refresh to retry.');}
}
function tag(state){return element('span',state.toLowerCase(),`tag ${state.toLowerCase()}`);}
const weekdayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function listingTime(row) {
    const schedule=row.payload.event.schedule || {};
    if(!row.occurrence)return 'Time needs review';
    if(schedule.allDay)return (row.occurrence.localDate || schedule.startDate)+' · All day';
    return new Date(row.occurrence.startsAt).toLocaleString('en-US',{hour12:true});
}
function renderQueue(){
    $('queue-heading').textContent=status.charAt(0)+status.slice(1).toLowerCase()+' listings';
    $('queue-count').textContent=rows.length+(nextCursor?'+':'');
    $('queue').replaceChildren();$('more').hidden=!nextCursor;
    if(!rows.length){$('queue').append(element('p','No matching listings.','queue-empty'));$('detail').replaceChildren(element('div','Choose another status or adjust the filters.','empty-state'));return;}
    let group;
    rows.forEach(row=>{
        const label=row.fromFeed?'Feed imports':'Community submissions';
        if(group!==label){$('queue').append(element('h3',label,'queue-group'));group=label;}
        const button=element('button',undefined,'queue-item'+(row.id===selectedId?' selected':''));
        button.setAttribute('aria-pressed',String(row.id===selectedId));
        const event=row.payload.event;
        button.append(element('strong',event.title),element('span',listingTime(row),'listing-time'));
        button.append(element('small',row.business?.name || row.payload.venue.proposal?.name || 'Venue needs review'));
        const categories=(event.categoryIds || []).map(id=>categoryNames.get(id)).filter(Boolean);
        const extra=[categories.join(', '),event.priceAmount==null?'':Number(event.priceAmount)===0?'Free':'$'+event.priceAmount].filter(Boolean).join(' · ');
        if(extra)button.append(element('small',extra));
        if(row.past || !row.listingActive)button.append(element('span',row.past?'Past event':'Withdrawn','tag archived'));
        if(row.duplicateOf)button.append(element('span','Duplicate','tag archived'));
        button.addEventListener('click',()=>{if(!busy)select(row.id);});
        const wrap=element('div',undefined,'queue-row');
        if(status!=='REJECTED'){
            const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=bulkSelection.has(row.id);checkbox.setAttribute('aria-label','Select '+event.title);
            checkbox.addEventListener('change',()=>{if(checkbox.checked)bulkSelection.set(row.id,row.revision);else bulkSelection.delete(row.id);renderBulk();});wrap.append(checkbox);
        }
        wrap.append(button);$('queue').append(wrap);
    });
}
let queueRequest=0,queueController;
async function loadQueue(append=false){
    if(!append){bulkSelection.clear();renderBulk();}
    const request=++queueRequest,generation=authGeneration;
    queueController?.abort();queueController=new AbortController();
    busy=true;$('refresh').disabled=true;$('more').disabled=true;
    try{
        const query=new URLSearchParams({status,q:$('listing-search').value,origin:$('listing-origin').value,includePast:String($('include-past').checked)});
        if(append&&nextCursor)query.set('before',nextCursor);
        const data=await api('/admin/api/submissions?'+query,{signal:queueController.signal});
        if(generation!==authGeneration || request!==queueRequest)return;
        rows=append?[...rows,...data.items]:data.items;nextCursor=data.nextCursor;
        selectedId=rows.some(x=>x.id===selectedId)?selectedId:rows[0]?.id||null;
        renderQueue();if(selectedId)await select(selectedId);
    }catch(error){if(error.name!=='AbortError')notice(error.message);}
    finally{if(request===queueRequest){busy=false;$('refresh').disabled=false;$('more').disabled=false;}}
}
function fact(label,value){const box=element('div');box.append(element('span',label,'fact-label'),element('div',value,'fact-value'));return box;}
async function select(id){
    selectedId=id;renderQueue();const row=rows.find(x=>x.id===id);if(!row)return;
    const event=row.payload.event,venue=row.payload.venue,proposal=venue.proposal,s=event.schedule || {};
    const detail=$('detail');detail.replaceChildren(tag(row.status),element('h2',event.title,'detail-title'),element('p',event.description,'event-description'));
    const facts=element('div',undefined,'facts');
    facts.append(fact('VENUE',proposal?proposal.name+'\n'+[proposal.address,proposal.city,proposal.state].filter(Boolean).join(', ')+'\nProposed venue · '+(proposal.latitude??'Coordinates not provided')+', '+(proposal.longitude??''):row.business?row.business.name+'\n'+[row.business.address,row.business.city,row.business.state].filter(Boolean).join(', ')+(row.business.isActive?'':'\nInactive venue'):venue.businessId+'\nVenue unavailable'));
    if(s.kind==='WEEKLY')facts.append(fact('REPEATS WEEKLY',(s.weekdays || []).map(day=>weekdayNames[day-1]).filter(Boolean).join(', ') || 'Choose weekdays'));
    facts.append(fact(s.kind==='WEEKLY'?'NEXT OCCURRENCE · YOUR LOCAL TIME':'YOUR LOCAL TIME',row.occurrence?(s.allDay?'All Day at venue · ':'')+new Date(row.occurrence.startsAt).toLocaleString('en-US',{hour12:true})+(s.endTime?' – '+new Date(row.occurrence.endsAt).toLocaleString('en-US',{hour12:true}):''):'Verify the venue location to preview local times.'));
    if(event.sourceUrl) {
        const link=sourceLink(event.sourceUrl);
        if(link) detail.append(link);
    }
    if(event.priceAmount!=null)facts.append(fact('PRICE',Number(event.priceAmount)===0?'Free':'$'+event.priceAmount));
    if(event.categoryIds?.length)facts.append(fact('CATEGORIES',event.categoryIds.map(x=>categoryNames.get(x)||x).join(', ')));
    detail.append(facts,element('p','Reference '+row.id,'muted'));
    if(row.duplicateOf){const link=element('a','View the existing event');link.href='/api/v1/experiences/'+encodeURIComponent(row.duplicateOf);link.target='_blank';link.rel='noopener';detail.append(link);}
    if(row.status!=='PENDING'){
        const undo = element('button', 'Undo decision · return to Pending');
        undo.addEventListener('click', async () => {
            if (busy) return;
            busy = true;
            undo.disabled = true;
            try {
                await api('/admin/api/submissions/'+id+'/undo', { method:'POST', body:JSON.stringify({revision:row.revision}) });
                notice('Decision undone. The event is back in Pending.', true);
                busy = false;
                await loadQueue();
            } catch(error) { notice(error.message); }
            finally { busy = false; undo.disabled = false; }
        });
        detail.append(undo);
detail.append(element('p','Reviewed by '+row.reviewedBy+' · '+new Date(row.reviewedAt).toLocaleString('en-US',{hour12:true}),'muted'));if(row.experienceId){const link=element('a','View published API entry');link.href='/api/v1/experiences/'+encodeURIComponent(row.experienceId);link.target='_blank';link.rel='noopener';detail.append(link);}
        if(row.status==='REJECTED')return;
    }
    const actions=element('div',undefined,'review-actions');actions.append(element('h3',row.status==='APPROVED'?'Edit published listing':'Edit submission'));
    const eventFields=element('fieldset');
    eventFields.append(element('legend','Event details'));
    const eventTitle=importField(eventFields,'Title',event.title);
    const descriptionLabel=element('label','Description (optional)');
    const description=element('textarea');description.value=event.description || '';description.maxLength=10000;descriptionLabel.append(description);eventFields.append(descriptionLabel);
    const repeatsLabel=element('label','Repeat');
    const repeat=element('select');
    for(const [value,label] of [['ONCE','Does not repeat'],['WEEKLY','Weekly']]){
        const option=element('option',label);option.value=value;repeat.append(option);
    }
    repeat.value=s.kind==='WEEKLY'?'WEEKLY':'ONCE';
    let mode=repeat.value;
    repeatsLabel.append(repeat);eventFields.append(repeatsLabel);
    const eventDate=importField(eventFields,'Start date',s.startDate || '','date');
    const eventEndDate=importField(eventFields,'End date',s.endDate || '','date');
    const repeatDays=element('fieldset',undefined,'category-options');
    repeatDays.append(element('legend','Repeat on'));
    const dayInputs=weekdayNames.map((name,index)=>{
        const label=element('label',name),input=element('input');
        input.type='checkbox';input.value=String(index+1);input.checked=(s.weekdays || []).includes(index+1);
        label.prepend(input);repeatDays.append(label);return input;
    });
    const repeatHelp=element('p','The first selected weekday on or after the start date is the first occurrence. Leave the end date blank to keep repeating.','muted time-help');
    eventFields.append(repeatDays,repeatHelp);
    const endDates={ONCE:'',WEEKLY:'',[mode]:eventEndDate.value};
    function showRepeatMode(){
        const weekly=repeat.value==='WEEKLY';
        repeatDays.hidden=repeatHelp.hidden=!weekly;
        eventEndDate.parentElement.firstChild.textContent=weekly?'End date (optional, last day of the series)':'End date';
    }
    repeat.addEventListener('change',()=>{
        endDates[mode]=eventEndDate.value;
        mode=repeat.value;eventEndDate.value=endDates[mode];
        if(mode==='WEEKLY' && !dayInputs.some(input=>input.checked) && eventDate.value){
            const day=new Date(eventDate.value+'T00:00:00Z').getUTCDay();
            if(Number.isInteger(day))dayInputs[(day+6)%7].checked=true;
        }
        showRepeatMode();showTimeMode();
    });
    showRepeatMode();
    const eventStart=importField(eventFields,'Start time',s.startTime?.slice(0,5) || '','time');
    const eventEnd=importField(eventFields,'End time',s.endTime?.slice(0,5) || '','time');
    const allDayLabel=element('label','All day');
    const allDay=element('input');
    allDay.type='checkbox';
    allDay.checked=Boolean(s.allDay);
    allDayLabel.prepend(allDay);
    eventFields.append(allDayLabel);
    const timeHelp=element('p',undefined,'muted time-help');
    eventFields.append(timeHelp);
    function showTimeMode(){
        eventStart.disabled=eventEnd.disabled=allDay.checked;
        timeHelp.textContent=allDay.checked
            ? 'Uncheck All day to set a start or end time.'
            : repeat.value==='WEEKLY'
                ? 'Times are local to the venue. If the end time is earlier than the start time, the event ends the next day.'
                : 'Times are local to the venue. For a one-time event that ends after midnight, select the next day as the end date.';
    }
    allDay.addEventListener('change',showTimeMode);
    showTimeMode();
    const price=importField(eventFields,'Price in USD (optional; 0 = Free)',event.priceAmount ?? '','number');
    price.min='0';price.step='0.01';
    const website=importField(eventFields,'Event website (optional)',event.sourceUrl || '','url');
    const categories=element('fieldset',undefined,'category-options');categories.append(element('legend','Categories (optional)'));
    const categoryInputs=[];
    for(const [categoryId,name] of categoryNames){
        const label=element('label',name),input=element('input');input.type='checkbox';input.value=categoryId;
        input.checked=(event.categoryIds || []).includes(categoryId);label.prepend(input);categories.append(label);categoryInputs.push(input);
    }
    eventFields.append(categories);
    actions.append(eventFields);
    const editor=venueEditor(actions, proposal || row.business || {}, Boolean(proposal));
    const fromFeed = row.fromFeed === true;
    const approve=element('button',row.status==='APPROVED'?'Save published changes':'Approve & publish','primary');
    const reject=element('button',fromFeed ? 'Reject & hide from feed' : 'Reject submission','danger');
    const errors=element('div',undefined,'review-errors');
    errors.setAttribute('role','alert');errors.tabIndex=-1;
    const progress=element('div',undefined,'review-progress');
    progress.setAttribute('role','status');
    const fields=new Map([
        ['event.title',['Title',eventTitle]],['event.description',['Description',description]],
        ['event.schedule.startDate',['Start date',eventDate]],['event.schedule.endDate',['End date',eventEndDate]],
        ['event.schedule.startTime',['Start time',eventStart]],['event.schedule.endTime',['End time',eventEnd]],
        ['event.schedule.kind',['Repeat',repeat]],['event.schedule.weekdays',['Repeat on',dayInputs[0]]],['event.priceAmount',['Price',price]],
        ['event.sourceUrl',['Event website',website]],['event.categoryIds',['Categories']],
        ...editor.fields
    ]);
    function clearErrors(){
        errors.replaceChildren();
        for(const [,input] of fields.values())input?.removeAttribute('aria-invalid');
    }
    function showErrors(message,issues=[]){
        if(!errors.isConnected){notice(message);return;}
        clearErrors();
        errors.append(element('strong',message));
        if(issues.length){
            const list=element('ul');
            for(const issue of issues){
                const [label,input]=fields.get(issue.field) || [issue.field?.startsWith('venue')?'Venue':'Event details'];
                input?.setAttribute('aria-invalid','true');
                list.append(element('li',label+': '+issue.message));
            }
            errors.append(list);
        }
        errors.focus();
    }
    const issueForCode={
        INVALID_BUSINESS:'venue.businessId',VENUE_INVALID:'venue.proposal',
        VENUE_REQUIRED:'venue.proposal.name',VENUE_AMBIGUOUS:'venue.proposal',
        LOOKUP_BUSY:'venue.proposal',LOOKUP_UNAVAILABLE:'venue.proposal',INVALID_CATEGORIES:'event.categoryIds'
    };
    async function decision(action){
        if(busy)return;
        clearErrors();notice();
        const body={revision:row.revision};
        const publishing=action==='approve';
        if(action!=='reject'){
            if(price.validity.badInput || (price.value.trim() && !/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(price.value.trim()))){
                showErrors('Nothing changed.',[{field:'event.priceAmount',message:'Enter a nonnegative price with up to two decimal places, or leave it blank.'}]);
                return;
            }
            body.event={
                sourceUrl:website.value.trim() || null,
                title:eventTitle.value,description:description.value.trim() || null,priceAmount:price.value.trim() || null,categoryIds:categoryNames.size?categoryInputs.filter(x=>x.checked).map(x=>x.value):(event.categoryIds || []),
                schedule:{kind:repeat.value,startDate:eventDate.value,endDate:eventEndDate.value || null,
                    startTime:allDay.checked?null:eventStart.value || null,
                    endTime:allDay.checked?null:eventEnd.value || null,
                    weekdays:repeat.value==='WEEKLY'?dayInputs.filter(input=>input.checked).map(input=>Number(input.value)):[],allDay:allDay.checked}
            };
            try { const venueChange=editor.readChange(); if(venueChange) body.venue=venueChange; }
            catch(error) { showErrors('Nothing changed.',[{field:error.field || 'venue.proposal',message:error.message}]);return; }
        }
        busy=true;approve.disabled=reject.disabled=true;
        eventFields.disabled=editor.fieldset.disabled=true;
        progress.textContent=publishing?'Publishing…':action==='edit'?'Saving…':'Rejecting…';
        let result;
        try {
            result=await api('/admin/api/submissions/'+id+'/'+action,{method:'POST',body:JSON.stringify(body)});
            const expected=action==='reject'?'REJECTED':'APPROVED';
            if(result.item?.status!==expected || (expected==='APPROVED' && !result.item.experienceId)){
                throw Error('Could not confirm the result. Refresh the queue before retrying.');
            }
        } catch(error) {
            eventFields.disabled=editor.fieldset.disabled=false;
            const key=issueForCode[error.code];
            const issues=error.fields?.length?error.fields:key?[{field:key,message:error.message}]:[];
            const clearFailure=error.status>=400&&error.status<500 || Boolean(issues.length);
            showErrors(issues.length
                ? (publishing?'Not published. Correct the fields below and try again.':'Changes were not saved. Correct the fields below and try again.')
                : clearFailure ? error.message : 'Could not confirm the result. Refresh the queue before retrying.',issues);
            if(error.code==='DUPLICATE_EVENT' && error.experienceId && errors.isConnected){
                const link=element('a','View existing event');
                link.href='/api/v1/experiences/'+encodeURIComponent(error.experienceId);
                link.target='_blank';link.rel='noopener';
                errors.append(element('br'),link);
            }
            return;
        } finally {
            busy=false;approve.disabled=reject.disabled=false;
            eventFields.disabled=editor.fieldset.disabled=false;progress.textContent='';
        }
        if(publishing || action==='reject'){
            rows=rows.filter(item=>item.id!==id);selectedId=rows[0]?.id||null;
            renderQueue();if(selectedId)await select(selectedId);
        }
        const outcome=publishing?'Published. This event moved from Pending to Approved.':action==='edit'?'Published changes saved.':'Submission rejected.';
        await loadQueue();
        notice(outcome,true);$('notice').focus();
    }
    approve.addEventListener('click',()=>decision(row.status==='APPROVED'?'edit':'approve'));
    reject.addEventListener('click',()=>decision('reject'));
    const buttons=element('div',undefined,'button-row');buttons.append(approve);
    if(row.status==='PENDING'){
        actions.append(element('p','Edits are applied only when the event is published.','muted time-help'));
        buttons.append(reject);
    }
    actions.append(errors,buttons,progress);detail.append(actions);
}

$('login-form').addEventListener('submit',async event=>{event.preventDefault();$('login-button').disabled=true;notice();try{const session=await api('/admin/api/login',{method:'POST',body:JSON.stringify({username:$('login-username').value,password:$('login-password').value})});$('login-password').value='';showReview(session);await referenceData();await loadQueue();await loadReports();await loadFeedChanges();}catch(error){notice(error.message);}finally{$('login-button').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});showLogin();notice('Signed out.',true);}catch(error){notice(error.message);}});
$('refresh').addEventListener('click',async()=>{notice();await referenceData();await loadQueue();await loadReports();await loadFeedChanges();});$('more').addEventListener('click',()=>loadQueue(true));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{status=button.dataset.status;selectedId=null;document.querySelectorAll('[data-status]').forEach(x=>x.classList.toggle('active',x===button));notice();loadQueue();}));
(async()=>{const generation=authGeneration;try{const session=await api('/admin/api/session');if(generation!==authGeneration)return;showReview(session);await referenceData();await loadQueue();await loadReports();await loadFeedChanges();}catch(error){if(generation!==authGeneration)return;showLogin();if(!/Sign in|again/.test(error.message))notice(error.message);}})();

async function loadReports(){
 const generation=authGeneration;
 try { const data=await api('/admin/api/reports');if(generation!==authGeneration)return;
  $('reports').replaceChildren();
  if(!data.items.length)$('reports').append(element('p','No open corrections.'));
  data.items.forEach(report=>{const card=element('div',undefined,'queue-item');card.append(element('strong',report.title),element('p',report.businessName+' · '+report.reason.replaceAll('_',' ')),element('p',report.details||'No additional details'),element('small','Event ID: '+report.experienceId));const resolve=element('button','Mark reviewed and resolve');resolve.addEventListener('click',async()=>{resolve.disabled=true;try{await api('/admin/api/reports/'+report.id+'/resolve',{method:'POST',body:'{}'});await loadReports();await loadFeedChanges();}catch(error){notice(error.message);resolve.disabled=false;}});card.append(resolve);$('reports').append(card);});
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
            card.remove();
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
                ? feed.records + ' events received · ' + feed.items.length + ' new in preview · ' +
                    (feed.records - feed.items.length) + ' already imported or filtered'
                : 'The source returned no events.')));
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
        const detail = result.needsReview ? ' ' + result.needsReview + ' need their details reviewed.' : '';
        const unavailable = result.unavailable ? ' ' + result.unavailable + ' feed(s) unavailable.' : '';
        notice((result.accepted || 0) + ' feed event(s) accepted. ' + result.queued + ' added to Pending.' + (result.duplicates?' '+result.duplicates+' duplicate(s) skipped.':'') + detail + unavailable, true);
        await loadQueue();
        await previewImports();
        await loadFeedChanges();
    } catch (error) { notice(error.message); }
    finally { button.disabled = false; }
});


function venueEditor(parent, initial = {}, proposedVenue = false) {
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
    latitude.min='-90';latitude.max='90';latitude.step='any';
    longitude.min='-180';longitude.max='180';longitude.step='any';
    fieldset.append(coordinates);
    let selected=Number.isFinite(initial.latitude) && Number.isFinite(initial.longitude);
    let selectedBusiness=initial.id;
    let edited=false;
    for (const input of [name,address,city,state]) input.addEventListener('input',()=>{
        edited=true;selected=false;
        selectedBusiness=null;
    });
    toggle.addEventListener('change',()=>{
        coordinates.hidden=!toggle.checked;
        edited=true;selected=false;
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
                        edited=true;selected=true;
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
    const fields=[
        ['venue.proposal.name',['Venue name',name]],['venue.name',['Venue name',name]],
        ['venue.proposal',['Venue',query]],['venue',['Venue',query]],['venue.businessId',['Venue',query]],
        ['venue.latitude',['Latitude',latitude]],['venue.longitude',['Longitude',longitude]],
        ['venue.city',['City',city]],['venue.state',['State',state]]
    ];
    function invalid(field,message){throw Object.assign(new Error(message),{field});}
    return {
        fields,fieldset,readChange(){
            if (edited) return this.read();
            // Keep resolving unlocated proposals as before, without redoing a confirmed venue.
            return proposedVenue && !selected ? {proposal:initial} : undefined;
        },
        read() {
            if(selectedBusiness)return {businessId:selectedBusiness};
            if(toggle.checked && (!latitude.value || !longitude.value || !latitude.checkValidity() || !longitude.checkValidity())) {
                invalid(!latitude.value || !latitude.checkValidity()?'venue.latitude':'venue.longitude','Enter valid latitude and longitude.');
            }
            if(!toggle.checked && !selected && (!city.value.trim() || !state.value.trim())) {
                invalid(!city.value.trim()?'venue.city':'venue.state','Enter city and state or select a venue.');
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

let searchTimer;
$('listing-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadQueue(),300);});
for(const id of ['listing-origin','include-past'])$(id).addEventListener('change',()=>loadQueue());

function renderBulk(){
    $('selection-count').textContent=bulkSelection.size+' selected';$('bulk-editor').hidden=!bulkSelection.size;
    $('select-visible').disabled=status==='REJECTED';
    if(bulkSelection.size && !$('bulk-categories').children.length){
        for(const [id,name] of categoryNames){const label=element('label',name),input=element('input');input.type='checkbox';input.value=id;label.prepend(input);$('bulk-categories').append(label);}
    }
}
$('select-visible').addEventListener('click',()=>{if(status==='REJECTED')return;rows.slice(0,50).forEach(row=>bulkSelection.set(row.id,row.revision));renderQueue();renderBulk();});
$('clear-selection').addEventListener('click',()=>{bulkSelection.clear();renderQueue();renderBulk();});
$('bulk-save').addEventListener('click',async()=>{
    if(busy)return;
    const event={};
    if($('bulk-use-categories').checked)event.categoryIds=[...$('bulk-categories').querySelectorAll('input:checked')].map(input=>input.value);
    if($('bulk-use-price').checked)event.priceAmount=$('bulk-price').value.trim() || null;
    if(!Object.keys(event).length){notice('Choose categories or price to apply.');return;}
    if(!bulkSelection.size || bulkSelection.size>50){notice('Select between 1 and 50 listings.');return;}
    busy=true;$('bulk-save').disabled=true;
    try{
        const entries=[...bulkSelection].map(([id,revision])=>({id,revision}));
        await api('/admin/api/submissions/bulk-edit',{method:'POST',body:JSON.stringify({entries,event})});
        notice('Updated '+entries.length+' listings.',true);busy=false;await loadQueue();
    }catch(error){notice(error.message);}finally{busy=false;$('bulk-save').disabled=false;}
});
function sourceSummary(value){
    const s=value.schedule || {},v=value.venue || {};
    const clock=time=>{const match=/^(\d{2}):(\d{2})/.exec(time || '');if(!match)return '';const hour=Number(match[1]);return (hour%12 || 12)+':'+match[2]+(hour<12?' AM':' PM');};
    const lastDate=s.endDate && s.endDate!==s.startDate?s.endDate:'';
    const when=s.allDay?[s.startDate,lastDate?'through '+lastDate:'','All day'].filter(Boolean).join(' · ')
        :[s.startDate,clock(s.startTime),lastDate?'through '+lastDate:'',clock(s.endTime)].filter(Boolean).join(' · ');
    return [value.title,when,[v.name,v.address,v.city].filter(Boolean).join(', ')].filter(Boolean).join('\n');
}

let feedChanges = [], feedChangesBusy = false, feedChangesRequest = 0;
const feedChangeErrors = new Map();

function setFeedChangesBusy(value) {
    feedChangesBusy = value;
    $('feed-changes-refresh').disabled = value;
    $('feed-changes-apply-all').disabled = value || !feedChanges.length;
    for (const button of $('feed-changes').querySelectorAll('button')) button.disabled = value;
}

async function reviewFeedChanges(items, action) {
    if (feedChangesBusy) return;
    const generation = authGeneration;
    setFeedChangesBusy(true);
    const status = $('feed-changes-status');
    let completed = 0;
    try {
        for (const [index, item] of items.entries()) {
            status.textContent = action === 'dismiss'
                ? 'Dismissing alert…'
                : `Applying update ${index + 1} of ${items.length}…`;
            try {
                await api('/admin/api/feed-changes/' + item.id + '/' + action, {
                    method: 'POST', body: JSON.stringify({submissionRevision: item.submissionRevision})
                });
                if (generation !== authGeneration) return;
                completed++;
                feedChangeErrors.delete(item.id);
            } catch (error) {
                if (generation !== authGeneration) return;
                feedChangeErrors.set(item.id, error.message);
                if (items.length === 1) status.textContent = error.message;
            }
        }
        const failed = items.length - completed;
        if (items.length > 1) {
            status.textContent = `Applied ${completed} of ${items.length} updates.`
                + (failed ? ` ${failed} could not be applied. Open the remaining updates for details.` : '');
        } else if (completed) {
            status.textContent = action === 'dismiss' ? 'Source alert dismissed.' : 'Source update applied.';
        }
        await loadFeedChanges();
        if (completed && generation === authGeneration) await loadQueue();
    } finally {
        setFeedChangesBusy(false);
    }
}

async function loadFeedChanges() {
    const generation = authGeneration;
    const request = ++feedChangesRequest;
    try {
        const data = await api('/admin/api/feed-changes');
        if (generation !== authGeneration || request !== feedChangesRequest) return;
        feedChanges = data.items;
        for (const id of feedChangeErrors.keys()) {
            if (!feedChanges.some(item => item.id === id)) feedChangeErrors.delete(id);
        }
        $('feed-change-count').textContent = String(feedChanges.length);
        $('feed-changes').replaceChildren();
        if (feedChanges.length) $('feed-changes-panel').open = true;
        else $('feed-changes').append(element('p', 'No source changes need review.'));
        for (const item of feedChanges) {
            const card = element('section', undefined, 'feed-change');
            card.append(element('h3', item.kind === 'CANCELLATION' ? 'Source cancellation' : item.kind === 'RESCHEDULE' ? 'Schedule changed' : 'Source details changed'));
            card.append(fact('Current source baseline', sourceSummary(item.previous)), fact('Latest source update', sourceSummary(item.incoming)));
            const apply = element('button', item.kind === 'CANCELLATION' ? 'Withdraw canceled event' : 'Apply source update', 'primary');
            const dismiss = element('button', 'Dismiss alert');
            apply.addEventListener('click', () => reviewFeedChanges([item], 'apply'));
            dismiss.addEventListener('click', () => reviewFeedChanges([item], 'dismiss'));
            const buttons = element('div', undefined, 'button-row');
            buttons.append(apply, dismiss);
            card.append(buttons);
            if (feedChangeErrors.has(item.id)) card.append(element('p', feedChangeErrors.get(item.id), 'feed-change-error'));
            $('feed-changes').append(card);
        }
        setFeedChangesBusy(feedChangesBusy);
    } catch (error) {
        if (generation === authGeneration && request === feedChangesRequest) {
            $('feed-changes-status').textContent += ' ' + error.message;
        }
    }
}
$('feed-changes-refresh').addEventListener('click', () => {
    $('feed-changes-status').textContent = '';
    feedChangeErrors.clear();
    loadFeedChanges();
});
$('feed-changes-apply-all').addEventListener('click', () => {
    if (!feedChanges.length || feedChangesBusy) return;
    if (window.confirm(`Apply all ${feedChanges.length} source updates, including any cancellations?`)) {
        reviewFeedChanges(feedChanges, 'apply');
    }
});
