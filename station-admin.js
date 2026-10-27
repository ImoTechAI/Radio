'use strict';
const $=id=>document.getElementById(id);
const KEY='tune-african-admin-draft-v1';
const API=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
let candidates=[],draft=[];
try{const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(parsed))draft=parsed}catch{}
function showWorkspace(open){$('gate').hidden=open;$('workspace').hidden=!open;sessionStorage.setItem('tune-admin-preview',open?'1':'0');if(open)renderDraft()}
$('enter').addEventListener('click',()=>showWorkspace(true));
$('exit').addEventListener('click',()=>showWorkspace(false));
if(sessionStorage.getItem('tune-admin-preview')==='1')showWorkspace(true);
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n}
function status(text,isError=false){$('status').textContent=text;$('status').className=isError?'error':''}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(draft))}catch{status('Browser storage unavailable. Export your draft now.',true)}renderDraft()}
function key(s){return (s.stationuuid||s.id||((s.name||'')+'|'+(s.countrycode||s.countryCode||''))).toLowerCase()}
function validUrl(value){try{const u=new URL(value);return u.protocol==='https:'}catch{return false}}
function card(s,fromDraft=false){const node=el('article',undefined,'card');node.append(el('strong',s.name||'Unnamed station'),el('p',[s.country||s.countrycode||s.countryCode,s.state||s.city].filter(Boolean).join(' · ')),el('p',(s.tags||((s.genres||[]).join(', '))||'No tags').slice(0,160),'muted'));const url=s.url_resolved||s.url||s.streamUrl;node.append(el('p',validUrl(url)?'HTTPS stream listed — not playback verified':'No verified HTTPS stream','muted'));const actions=el('div',undefined,'card-actions');if(validUrl(s.homepage)){const link=el('a','Official site');link.href=s.homepage;link.target='_blank';link.rel='noopener noreferrer';actions.append(link)}if(fromDraft){const state=el('select');for(const value of ['pending-review','approved']){const option=el('option',value);option.value=value;state.append(option)}state.value=s.approvalStatus||'pending-review';state.addEventListener('change',()=>{s.approvalStatus=state.value;persist()});actions.append(state);const remove=el('button','Remove','secondary');remove.addEventListener('click',()=>{draft=draft.filter(x=>key(x)!==key(s));persist()});actions.append(remove)}else{const add=el('button',draft.some(x=>key(x)===key(s))?'In draft':'Add to draft');add.disabled=draft.some(x=>key(x)===key(s));add.addEventListener('click',()=>{if(draft.some(x=>key(x)===key(s)))return;draft.push({id:s.stationuuid||key(s),stationuuid:s.stationuuid,name:s.name,countryCode:s.countrycode,country:s.country,city:s.state||'',genres:(s.tags||'').split(',').map(x=>x.trim()).filter(Boolean),homepage:validUrl(s.homepage)?s.homepage:'',streamUrl:validUrl(url)?url:null,source:'Radio Browser (requires independent verification)',approvalStatus:'pending-review',streamStatus:'unverified-live',priority:50});persist();renderResults()});actions.append(add)}node.append(actions);return node}
function renderResults(){$('results').replaceChildren(...candidates.map(s=>card(s)));$('count').textContent=candidates.length+' candidates'}
function renderDraft(){$('draft').replaceChildren(...draft.map(s=>card(s,true)));$('draft-count').textContent=String(draft.length)}
let searchRequest=0;
$('search-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const request=++searchRequest,q=$('query').value.trim(),country=$('country').value,by=$('search-by').value;
 if(!q){status('Enter a station name or genre.',true);return}
 status('Searching the public station directory…');$('results').replaceChildren();candidates=[];
 const searches=by==='all'?['name','tag']: [by];
 const found=new Map();let succeeded=false;
 for(const field of searches){
  const params=new URLSearchParams({limit:'100',hidebroken:'true',order:'clickcount',reverse:'true'});
  params.set(field,q);if(country)params.set('countrycode',country);
  for(const host of API){
   try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    let response;try{response=await fetch(host+'/json/stations/search?'+params,{signal:controller.signal})}finally{clearTimeout(timeout)}
    if(!response.ok)throw Error('Directory unavailable');
    const data=await response.json();if(!Array.isArray(data))throw Error('Invalid response');
    if(request!==searchRequest)return;
    succeeded=true;
    for(const s of data){if(s.name&&validUrl(s.url_resolved||s.url))found.set(key(s),s)}
    break;
   }catch{}
  }
 }
 if(request!==searchRequest)return;
 candidates=[...found.values()];
 status(succeeded?candidates.length+' candidate stations found. Verify cultural relevance and streams before approval.':'Directory unavailable. Please retry.',!succeeded);
 renderResults();
});
$('manual-form').addEventListener('submit',event=>{
 event.preventDefault();
 const name=$('manual-name').value.trim(),countryCode=$('manual-country').value,city=$('manual-city').value.trim();
 const homepage=$('manual-homepage').value.trim(),stream=$('manual-stream').value.trim();
 if(!name){$('manual-status').textContent='Station name required.';return}
 if((homepage&&!validUrl(homepage))||(stream&&!validUrl(stream))){$('manual-status').textContent='Website and stream URLs must start with https://';return}
 const id='manual-'+countryCode.toLowerCase()+'-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(draft.some(s=>s.id===id||((s.name||'').toLowerCase()===name.toLowerCase()&&s.countryCode===countryCode))){$('manual-status').textContent='This station is already in the draft.';return}
 draft.push({id,name,countryCode,country:$('manual-country').selectedOptions[0].textContent,city,genres:$('manual-genres').value.split(',').map(x=>x.trim()).filter(Boolean),homepage:homepage||'',streamUrl:stream||null,source:'Manual submission — independent verification required',approvalStatus:'pending-review',streamStatus:'unverified-live',priority:50});
 persist();$('manual-form').reset();$('manual-status').textContent=name+' added to your local draft for review.';
});
$('export').addEventListener('click',()=>{const data=JSON.stringify({schemaVersion:1,stations:draft},null,2);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='tune-african-station-draft.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('clear').addEventListener('click',()=>{if(confirm('Clear all draft candidates in this browser?')){draft=[];persist()}});
