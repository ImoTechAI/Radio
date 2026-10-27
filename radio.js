'use strict';
const AFRICA = ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'];
// Geographic discovery groups adapted from AfrOsint's wider country metadata.
// These countries contain diaspora communities; listing a station does not certify its audience.
const DIASPORA_REGIONS = {
  'Caribbean': ['AG','BS','BB','CU','DM','DO','GD','HT','JM','KN','LC','VC','TT'],
  'United Kingdom & Europe': ['GB','IE','FR','DE','NL','BE','PT','ES','IT','CH','SE','NO','DK'],
  'North America': ['US','CA','MX'],
  'Central & South America': ['BZ','CR','PA','CO','VE','GY','SR','BR','PE','EC','AR','UY'],
  'Middle East & Asia-Pacific': ['AE','SA','QA','TR','IN','CN','JP','AU','NZ']
};
const DIASPORA_CODES = [...new Set(Object.values(DIASPORA_REGIONS).flat())];
const API = ['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
const $ = id => document.getElementById(id);
const els = {search:$('search'),country:$('country'),genre:$('genre'),status:$('status'),stations:$('stations'),more:$('more'),audio:$('audio'),now:$('now'),playback:$('playback'),toggle:$('toggle'),volume:$('volume')};
const storeKey='african-radio-favourites-v1';
const recentKey='african-radio-recent-v1';
function recentStations(){try{const data=JSON.parse(localStorage.getItem(recentKey)||'[]');return Array.isArray(data)?data.filter(validStation).slice(0,12):[]}catch{return []}}
function clearRecentStations(){try{localStorage.removeItem(recentKey)}catch{els.status.textContent='Unable to clear recently played stations in this browser.';return}renderRecent()}
function rememberStation(s){try{localStorage.setItem(recentKey,JSON.stringify([s,...recentStations().filter(x=>x.stationuuid!==s.stationuuid)].slice(0,12)))}catch{}}
function renderRecent(){const box=$('recent-stations');if(!box)return;box.replaceChildren();const items=recentStations();$('recent-section').hidden=!items.length;for(const s of items){const b=make('button','btn',s.name);b.type='button';b.addEventListener('click',()=>playStation(s));box.append(b)}}
$('clear-recent').addEventListener('click',clearRecentStations);
let mode='africa', stations=[], offset=0, busy=false, current=null, requestId=0, timer, playbackState='idle', lastFocused=null;
const GENRES=[['','All'],['afrobeats','Afrobeats'],['gospel','Gospel'],['news','News'],['talk','Talk'],['jazz','Jazz'],['reggae','Reggae'],['music','Music']];
function updateGenreChips(){const box=$('genre-chips');box.replaceChildren();for(const [tag,label] of GENRES){const button=make('button','genre-chip',label);button.type='button';button.setAttribute('aria-pressed',String(els.genre.value===tag));button.addEventListener('click',()=>{els.genre.value=tag;updateGenreChips();load()});box.append(button)}}
// Preserve station DOM nodes while playback events change; recreating cards
// on every 'playing'/'waiting' event restarted CSS animations repeatedly.
function syncStationAnimations(animating){
  els.stations.classList.toggle('has-playing',animating);
  for(const card of els.stations.querySelectorAll('.station')){
    const active=card.dataset.stationId===current?.stationuuid;
    card.classList.toggle('is-current',active);
    card.classList.toggle('is-playing',active&&animating);
    const play=card.querySelector('.play');
    if(play){
      const isPlaying=active&&animating;
      play.textContent=isPlaying?'Ⅱ Pause':active&&playbackState==='connecting'?'Connecting…':'▶ Listen';
      play.setAttribute('aria-pressed',String(isPlaying));
      play.setAttribute('aria-label',(isPlaying?'Pause ':'Listen to ')+(card.dataset.stationName||'station'));
    }
  }
}
function setPlaybackState(state){playbackState=state;const animating=!!current&&!els.audio.paused&&(state==='playing'||state==='buffering');$('player-expanded').classList.toggle('is-live',animating);syncStationAnimations(animating);window.dispatchEvent(new CustomEvent('radio:playback',{detail:{state,code:current?.countrycode?.toUpperCase()||null,name:current?.name||''}}));const messages={idle:'Ready to listen',connecting:'Connecting…',buffering:'Buffering…',playing:'Live',paused:'Paused',unavailable:'Stream unavailable or blocked. Try again.'};els.playback.textContent=messages[state]||state;$('live-indicator').hidden=state!=='playing';$('retry-stream').hidden=state!=='unavailable';$('expanded-retry').hidden=state!=='unavailable';$('expanded-status').textContent=messages[state]||state;els.toggle.textContent=state==='playing'?'Ⅱ':'▶';$('expanded-toggle').textContent=els.toggle.textContent;}
function syncExpanded(){syncExpandedFavourite();const art=$('player-art');$('expanded-art').src=art.src;$('expanded-name').textContent=els.now.textContent;$('expanded-status').textContent=els.playback.textContent;$('expanded-toggle').textContent=els.toggle.textContent}
function sortStations(items){const sort=$('sort').value;if(sort==='name')return items.sort((a,b)=>a.name.localeCompare(b.name));if(sort==='recent')return items.sort((a,b)=>(Number(b.lastchangetime)||Date.parse(b.lastchangetime_iso8601||'')||0)-(Number(a.lastchangetime)||Date.parse(a.lastchangetime_iso8601||'')||0));return items.sort((a,b)=>(Number(b.clickcount)||0)-(Number(a.clickcount)||0))}

function favourites(){try{const data=JSON.parse(localStorage.getItem(storeKey)||'[]');return Array.isArray(data)?data.filter(x=>x&&typeof x.stationuuid==='string'):[]}catch{return []}}
function saveFavourites(items){try{localStorage.setItem(storeKey,JSON.stringify(items))}catch{els.status.textContent='Browser storage is unavailable; favourites cannot be saved.'}}
function isFavourite(s){return favourites().some(x=>x.stationuuid===s.stationuuid)}
function toggleFavourite(s){const saved=favourites();saveFavourites(isFavourite(s)?saved.filter(x=>x.stationuuid!==s.stationuuid):[...saved,s]);syncExpandedFavourite();if(mode==='favourites')load();else render()}
function syncExpandedFavourite(){const button=$('expanded-favourite');if(!button)return;const saved=!!current&&isFavourite(current);button.disabled=!current;button.textContent=saved?'★':'☆';button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'Remove from favourites: ':'Add to favourites: ')+(current?.name||'No station selected'));button.title=saved?'Remove from favourites':'Add to favourites'}
function validStation(s){return s&&typeof s.stationuuid==='string'&&typeof s.name==='string'&&/^https:\/\//i.test(s.url_resolved||s.url||'')}
function stationUrl(s){return s.url_resolved||s.url}
function make(tag,cls,txt){const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el}
function render(){
  els.stations.replaceChildren();
  els.stations.classList.toggle('has-playing',(playbackState==='playing'||playbackState==='buffering')&&!els.audio.paused&&!!current);
  const frag=document.createDocumentFragment();
  for(const s of sortStations([...stations])){
    const active=current?.stationuuid===s.stationuuid;
    const card=make('article','station'+(active?' is-current':'')+(active&&(playbackState==='playing'||playbackState==='buffering')&&!els.audio.paused?' is-playing':''));card.dataset.stationId=s.stationuuid;card.dataset.stationName=s.name;
    const top=make('div','station-top');
    const logo=make('img','fallback-art');
    logo.alt='';logo.loading='lazy';logo.referrerPolicy='no-referrer';
    logo.src=/^https:\/\//i.test(s.favicon||'')?s.favicon:'./ARPLogo.png';
    logo.onerror=()=>{logo.onerror=null;logo.src='./ARPLogo.png'};
    const meta=make('div');meta.style.minWidth='0';
    meta.append(make('h3','',s.name),make('p','',[s.country,s.tags?.split(',').slice(0,2).join(' · ')].filter(Boolean).join(' · ')));
    const equaliser=make('span','station-live-equaliser');
    equaliser.setAttribute('aria-hidden','true');
    for(let i=0;i<9;i++)equaliser.append(make('span'));
    meta.append(equaliser);
    const artWrap=make('div','station-art-wrap');
    artWrap.append(logo);
    top.append(artWrap,meta);
    const actions=make('div','actions');
    const playing=active&&(playbackState==='playing'||playbackState==='buffering')&&!els.audio.paused;
    const play=make('button','btn play',playing?'Ⅱ Pause':active&&playbackState==='connecting'?'Connecting…':'▶ Listen');
    play.type='button';play.setAttribute('aria-pressed',String(playing));play.setAttribute('aria-label',(playing?'Pause ':'Listen to ')+s.name);
    play.addEventListener('click',()=>playStation(s));
    const saved=isFavourite(s);
    const fav=make('button','btn fav',saved?'★':'☆');
    fav.type='button';fav.setAttribute('aria-pressed',String(saved));fav.setAttribute('aria-label',(saved?'Remove favourite ':'Save favourite ')+s.name);
    fav.title=saved?'Remove from favourites':'Add to favourites';
    fav.addEventListener('click',()=>toggleFavourite(s));
    const expand=make('button','btn station-expand','⛶');
    expand.type='button';
    expand.setAttribute('aria-label','Expand player for '+s.name);
    expand.title='Expand player';
    expand.addEventListener('click',()=>{
      if(current?.stationuuid!==s.stationuuid)playStation(s);
      $('expand-player').click();
    });
    actions.append(play);card.append(top,fav,expand,actions);frag.append(card);
  }
  els.stations.append(frag);
  if(!stations.length&&!busy)els.status.textContent=mode==='favourites'?'No favourites saved yet.':'No stations found. Try another search or filter.';
}
async function fetchStations(params){let error;for(const base of API){try{const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),9000);try{const response=await fetch(base+'/json/stations/search?'+params.toString(),{signal:ctrl.signal});if(!response.ok)throw Error('Station directory unavailable');const data=await response.json();if(!Array.isArray(data))throw Error('Invalid directory response');return data}finally{clearTimeout(timeout)}}catch(e){error=e}}throw error||Error('No station directory available')}
async function load(append=false){const id=++requestId;if(mode==='favourites'){stations=sortStations(favourites().filter(validStation).filter(s=>matches(s)));els.more.hidden=true;els.status.textContent=stations.length+' saved station(s)';render();return}if(busy&&!append){}busy=true;if(!append){offset=0;stations=[];els.stations.replaceChildren()}els.more.hidden=true;els.status.textContent='Loading stations…';const order=$('sort').value==='name'?'name':$('sort').value==='recent'?'lastchangetime':'clickcount';const params=new URLSearchParams({hidebroken:'true',order,reverse:String(order!=='name'),limit:'30',offset:String(offset)});const q=els.search.value.trim();if(q)params.set('name',q);if(els.country.value)params.set('countrycode',els.country.value);if(els.genre.value)params.set('tag',els.genre.value);try{const africaAll=mode==='africa'&&!els.country.value;let data;if(africaAll){const batch=AFRICA.slice(offset%AFRICA.length,(offset%AFRICA.length)+4);const page=Math.floor(offset/AFRICA.length);const results=await Promise.allSettled(batch.map(code=>{const p=new URLSearchParams(params);p.set('countrycode',code);p.set('limit','10');p.set('offset',String(page*10));return fetchStations(p)}));if(results.every(r=>r.status==='rejected'))throw Error('African station directory unavailable');data=results.flatMap(r=>r.status==='fulfilled'?r.value:[])}else{data=await fetchStations(params)}if(id!==requestId)return;const filtered=data.filter(validStation).filter(s=>(mode!=='africa'||AFRICA.includes((s.countrycode||'').toUpperCase()))&&(mode!=='diaspora'||DIASPORA_CODES.includes((s.countrycode||'').toUpperCase())));const seen=new Set(stations.map(s=>s.stationuuid));stations.push(...filtered.filter(s=>!seen.has(s.stationuuid)&&seen.add(s.stationuuid)));offset+=africaAll?4:data.length;els.status.textContent=stations.length+' stations shown'+(mode==='africa'?' · African stations':'');els.more.hidden=africaAll?false:data.length<30;render()}catch(e){if(id!==requestId)return;els.status.textContent='Unable to load the station directory. Check your connection and retry.';els.more.hidden=false;els.more.textContent='Retry'}finally{if(id===requestId)busy=false}}
function matches(s){const q=els.search.value.trim().toLowerCase();return(!q||s.name.toLowerCase().includes(q))&&(!els.country.value||s.countrycode===els.country.value)&&(!els.genre.value||(s.tags||'').toLowerCase().includes(els.genre.value))}
function playStation(s){if(current?.stationuuid===s.stationuuid){if(els.audio.paused){setPlaybackState('connecting');els.audio.play().catch(playError)}else els.audio.pause();return}current=s;rememberStation(s);renderRecent();const art=$('player-art');if(art){art.src=/^https:\/\//i.test(s.favicon||'')?s.favicon:'./ARPLogo.png';art.alt=s.name+' artwork';art.onerror=()=>{art.onerror=null;art.src='./ARPLogo.png'}}els.audio.src=stationUrl(s);els.now.textContent=s.name;setPlaybackState('connecting');els.toggle.disabled=false;syncExpanded();els.audio.play().catch(playError);render()}
function playError(){if(!current)return;setPlaybackState('unavailable');render()}
$('next-station')?.addEventListener('click',()=>{stepStation(1)});
function showView(code){
  const explorer=$('explorer-view'),directory=$('directory-view'),main=document.querySelector('main');
  const isCountry=!!code&&AFRICA.includes(code);
  const showDirectory=isCountry||code==='all';
  explorer.hidden=showDirectory;directory.hidden=!showDirectory;
  main.classList.toggle('explorer-main',!showDirectory);document.body.classList.toggle('explorer-active',!showDirectory);
  if(!showDirectory){document.title='TUNE.AFRICAN — Africa Explorer';return}
  mode=isCountry?'africa':'world';
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  populateCountries();els.country.value=isCountry?code:'';
  els.search.value='';els.genre.value='';$('clear-search').hidden=true;updateGenreChips();
  const name=isCountry?new Intl.DisplayNames(['en'],{type:'region'}).of(code):'Worldwide';
  $('directory-title').textContent=name+' Radio Stations';
  $('directory-subtitle').textContent=isCountry?'Explore live radio from '+name+'.':'Browse radio stations around the world.';
  document.title=name+' Radio — TUNE.AFRICAN';
  load();
}
function fitExplorerPlayer(){document.documentElement.style.setProperty('--explorer-player-height',Math.ceil(document.querySelector('.player').getBoundingClientRect().height)+'px')}
new ResizeObserver(fitExplorerPlayer).observe(document.querySelector('.player'));fitExplorerPlayer();
function route(){const match=location.hash.match(/^#\/(country\/([A-Z]{2})|all)$/);showView(match?(match[2]||'all'):null)}
window.addEventListener('hashchange',route);
window.addEventListener('radio:country',event=>{const code=event.detail?.code;if(!AFRICA.includes(code))return;location.hash='#/country/'+code;if(location.hash==='#/country/'+code)route()});
$('player-map-shortcut').addEventListener('click',()=>{location.hash='#/explore';route();window.scrollTo({top:0,behavior:'smooth'})});

els.audio.addEventListener('playing',()=>setPlaybackState('playing'));
els.audio.addEventListener('pause',()=>{if(playbackState!=='unavailable')setPlaybackState('paused')});
els.audio.addEventListener('error',playError);
els.audio.addEventListener('waiting',()=>{if(current)setPlaybackState('buffering')});
els.audio.addEventListener('stalled',()=>{if(current)setPlaybackState('buffering')});
els.audio.addEventListener('loadstart',()=>{if(current)setPlaybackState('connecting')});
function toggleAudio(){if(!current)return;if(els.audio.paused){setPlaybackState('connecting');els.audio.play().catch(playError)}else els.audio.pause()}
els.toggle.addEventListener('click',toggleAudio);
$('expanded-toggle').addEventListener('click',toggleAudio);
$('expanded-favourite').addEventListener('click',()=>{if(current)toggleFavourite(current)});
function setVolume(v){els.audio.volume=Number(v)/100;els.volume.value=v;$('expanded-volume').value=v}
els.volume.addEventListener('input',()=>setVolume(els.volume.value));
$('expanded-volume').addEventListener('input',()=>setVolume($('expanded-volume').value));
setVolume(75);
function stepStation(delta){const list=sortStations([...stations]);const i=list.findIndex(s=>s.stationuuid===current?.stationuuid);if(list.length)playStation(list[(i+delta+list.length)%list.length])}
$('previous-station').addEventListener('click',()=>stepStation(-1));
$('expanded-prev').addEventListener('click',()=>stepStation(-1));
$('expanded-next').addEventListener('click',()=>stepStation(1));
$('retry-stream').addEventListener('click',()=>{if(!current)return;els.audio.load();setPlaybackState('connecting');els.audio.play().catch(playError)});
$('expanded-retry').addEventListener('click',()=>$('retry-stream').click());
function closeExpanded(){if($('player-expanded').hidden)return;$('player-expanded').hidden=true;window.dispatchEvent(new CustomEvent('radio:expanded',{detail:{open:false}}));document.body.style.overflow='';lastFocused?.focus()}
$('expand-player').addEventListener('click',()=>{lastFocused=document.activeElement;syncExpanded();$('player-expanded').hidden=false;window.dispatchEvent(new CustomEvent('radio:expanded',{detail:{open:true,state:playbackState,code:current?.countrycode?.toUpperCase()||null}}));document.body.style.overflow='hidden';$('close-expanded').focus()});
$('close-expanded').addEventListener('click',closeExpanded);
$('expanded-map').addEventListener('click',()=>{
  closeExpanded();
  location.hash='#/explore';
  route();
  window.scrollTo({top:0,behavior:'smooth'});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExpanded();if(e.key==='Tab'&&!$('player-expanded').hidden){const controls=[...$('player-expanded').querySelectorAll('button:not([hidden]),input')];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
$('sort').addEventListener('change',()=>{if(mode==='favourites')render();else load()});
$('clear-search').addEventListener('click',()=>{els.search.value='';$('clear-search').hidden=true;clearTimeout(timer);load();els.search.focus()});

document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  mode=button.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  populateCountries();
  if(mode==='diaspora'){
    els.country.value='GB';
    $('directory-title').textContent='African Diaspora Radio';
    $('directory-subtitle').textContent='Discover radio by host country. Stations are not necessarily diaspora-focused.';
    document.title='African Diaspora Radio — TUNE.AFRICAN';
  }
  load();
}));
function populateCountries(){
  const old=els.country.value;
  els.country.replaceChildren(new Option(mode==='diaspora'?'All diaspora regions':'All countries',''));
  const names=new Intl.DisplayNames(['en'],{type:'region'});
  if(mode==='diaspora'){
    for(const [region,codes] of Object.entries(DIASPORA_REGIONS)){
      const group=document.createElement('optgroup');
      group.label=region;
      for(const code of codes)group.append(new Option(names.of(code),code));
      els.country.add(group);
    }
  }else{
    const codes=mode==='africa'?AFRICA:['NG','GH','KE','ZA','EG','MA','US','GB','FR','DE','BR','IN','AU','CA','JP',...AFRICA];
    for(const code of [...new Set(codes)].sort((a,b)=>names.of(a).localeCompare(names.of(b))))els.country.add(new Option(names.of(code),code));
  }
  if([...els.country.options].some(o=>o.value===old))els.country.value=old;
}
els.search.addEventListener('input',()=>{$('clear-search').hidden=!els.search.value;clearTimeout(timer);timer=setTimeout(()=>load(),350)});els.country.addEventListener('change',()=>load());els.genre.addEventListener('change',()=>{updateGenreChips();load()});els.more.addEventListener('click',()=>load(els.more.textContent!=='Retry'));$('year').textContent=new Date().getFullYear();populateCountries();els.country.value='NG';updateGenreChips();renderRecent();route();
