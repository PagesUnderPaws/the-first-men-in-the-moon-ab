(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const ENDING_URLS = {
    published: 'text/published-ending.html',
    alternative: 'text/alternative-ending.html'
  };

  const state = {
    mode: null,
    bookCode: null,
    readBefore: null,
    recognise: null,
    knowDifference: null,
    blindness: null,
    readAhead: null,
    order: [],
    firstRatings: {},
    secondRatings: {},
    comparison: {},
    postReveal: {},
    readerIndex: 0
  };

  let novelSections = [];
  let endingCache = {};

  function saveState(){
    try { localStorage.setItem('moonABState', JSON.stringify(state)); } catch (_) {}
  }

  function show(id){
    $$('.app-screen').forEach(s => s.classList.remove('active'));
    const el = $('#'+id);
    if (!el) return;
    el.classList.add('active');
    window.scrollTo({top:0, behavior:'instant'});
  }

  function values(form){ return Object.fromEntries(new FormData(form).entries()); }
  function answered(form, name){ return Boolean(form.querySelector(`input[name="${name}"]:checked`)); }

  // Q1 is recorded separately. Provenance blindness depends only on Q2/Q3:
  // Q2 yes and/or Q3 yes => Non-blinded. Only no/no => Blinded.
  function classify(){
    return (state.recognise === 'yes' || state.knowDifference === 'yes') ? 'Non-blinded' : 'Blinded';
  }

  function chooseOnlineOrder(){
    if (!state.order.length) state.order = Math.random() < 0.5 ? ['published','alternative'] : ['alternative','published'];
  }

  function setBookOrder(code){
    state.bookCode = code;
    state.order = code === 'Z' ? ['published','alternative'] : ['alternative','published'];
  }

  async function loadEnding(kind){
    if (endingCache[kind]) return endingCache[kind];
    const r = await fetch(ENDING_URLS[kind], {cache:'no-cache'});
    if (!r.ok) throw new Error(`Could not load ${kind} ending (${r.status}).`);
    endingCache[kind] = await r.text();
    return endingCache[kind];
  }

  async function loadNovel(){
    if (novelSections.length) return;
    const r = await fetch('text/novel.html', {cache:'no-cache'});
    if (!r.ok) throw new Error(`Could not load novel (${r.status}).`);
    const html = await r.text();
    const holder = document.createElement('div');
    holder.innerHTML = html;
    novelSections = [...holder.querySelectorAll('.chapter')].map(el => ({
      html: el.innerHTML,
      chapter: el.dataset.chapter,
      title: el.dataset.title || ''
    }));
  }

  async function startOnlineReading(){
    $('#readerError').classList.add('hidden');
    $('#readerError').textContent = '';
    try {
      await Promise.all([loadNovel(), loadEnding(state.order[0]), loadEnding(state.order[1])]);
      state.readerIndex = Math.max(0, Math.min(state.readerIndex || 0, novelSections.length));
      await renderReaderSegment();
      show('onlineReader');
    } catch (err) {
      $('#readerError').textContent = 'The reading text could not be loaded. Make sure index.html, script.js, style.css and the text folder were all uploaded to GitHub.';
      $('#readerError').classList.remove('hidden');
      show('onlineReader');
    }
  }

  async function renderReaderSegment(){
    const i = state.readerIndex;
    const totalNovel = novelSections.length;
    const isEnding = i === totalNovel;
    if (isEnding) {
      $('#onlineReaderText').innerHTML = await loadEnding(state.order[0]);
      $('#readerStatus').textContent = 'First final act';
      $('#readerNext').textContent = 'I’ve finished this ending';
    } else {
      $('#onlineReaderText').innerHTML = novelSections[i].html;
      if (novelSections[i].chapter === 'title') $('#readerStatus').textContent = 'Title page';
      else $('#readerStatus').textContent = `Chapter ${novelSections[i].chapter} of XXIV`;
      $('#readerNext').textContent = 'Next';
    }
    $('#readerPrev').disabled = i === 0;
    saveState();
    window.scrollTo({top:0,behavior:'instant'});
  }

  function makeScale(name){
    return Array.from({length:9},(_,i)=>`<label><input type="radio" name="${name}" value="${i+1}">${i+1}</label>`).join('');
  }

  function surveyMarkup(which, includeReadAhead=false){
    return `
      ${includeReadAhead ? `<fieldset class="q"><legend>Book-reading check: before answering these questions, had you already read any of the second final act in your book?</legend><div class="choices"><label><input type="radio" name="readAhead" value="yes">Yes</label><label><input type="radio" name="readAhead" value="no">No</label></div></fieldset>` : ''}
      <div class="q"><label>1. How much did you enjoy this ending?</label><div class="scale">${makeScale(which+'_enjoy')}</div><div class="scale-note"><span>1 · not at all</span><span>9 · extremely</span></div></div>
      <div class="q"><label>2. How well did this ending fit the novel that came before it?</label><div class="scale">${makeScale(which+'_fit')}</div><div class="scale-note"><span>1 · very poorly</span><span>9 · extremely well</span></div></div>
      <div class="q"><label>3. How satisfying did you find it as an ending to the novel?</label><div class="scale">${makeScale(which+'_satisfying')}</div><div class="scale-note"><span>1 · not at all</span><span>9 · extremely</span></div></div>
      <div class="q"><label>4. Optional: What are your thoughts on this ending?</label><textarea name="${which}_thoughts"></textarea><p class="small muted">Optional comments may contribute to an anonymous aggregate summary shown after the reveal.</p></div>
      <p id="${which}SurveyError" class="small warning hidden" role="alert"></p>
      <div class="actions"><button type="button" class="secondary surveyBack" data-which="${which}">Back</button><button type="button" class="surveyContinue" data-which="${which}">Continue</button></div>`;
  }

  function buildSurveys(){
    $('#survey1Form').innerHTML = surveyMarkup('first', state.mode === 'book');
    $('#survey2Form').innerHTML = surveyMarkup('second', false);
  }

  function resetFormsForNewRun(){
    $('#screeningForm').reset();
    $('#compareForm').reset();
    $('#postRevealForm').reset();
    $('#screeningError').classList.add('hidden');
    $('#compareError').classList.add('hidden');
    $('#postRevealError').classList.add('hidden');
    $('#newPreferenceWrap').classList.add('hidden');
  }

  function validateEndingSurvey(which){
    const form = which === 'first' ? $('#survey1Form') : $('#survey2Form');
    const missing = ['enjoy','fit','satisfying'].some(k => !answered(form, `${which}_${k}`));
    const readAheadMissing = which === 'first' && state.mode === 'book' && !answered(form,'readAhead');
    const err = $('#'+which+'SurveyError');
    if (missing || readAheadMissing) {
      err.textContent = readAheadMissing
        ? 'Please answer the book-reading check and questions 1–3 before continuing. Question 4 is optional.'
        : 'Please answer questions 1–3 before continuing. Question 4 is optional.';
      err.classList.remove('hidden');
      err.scrollIntoView({behavior:'smooth',block:'center'});
      return false;
    }
    err.classList.add('hidden');
    return true;
  }

  function getMoonName(){
    const key='moonDiscussionName';
    try {
      const existing=localStorage.getItem(key); if(existing) return existing;
    } catch (_) {}
    const first=['Lunar','Moon','Crater','Cavorite','Silver','Blue','Orbit','Eclipse','Mare','Starlit'];
    const second=['Moth','Fox','Hare','Badger','Owl','Marten','Crow','Beetle','Voyager','Selenite'];
    const name=`${first[Math.floor(Math.random()*first.length)]}${second[Math.floor(Math.random()*second.length)]}-${Math.floor(100+Math.random()*900)}`;
    try { localStorage.setItem(key,name); } catch (_) {}
    return name;
  }

  function firstKindLabel(){ return state.order[0] === 'published' ? 'Published ending' : 'Alternative ending'; }
  function preferredKind(){
    const p=state.comparison.preferred;
    if (p==='none') return 'No preference';
    if (p==='first') return state.order[0]==='published' ? 'Published ending' : 'Alternative ending';
    if (p==='second') return state.order[1]==='published' ? 'Published ending' : 'Alternative ending';
    return '—';
  }

  function renderResults(){
    $('#blindnessOut').textContent = state.blindness || '—';
    $('#modeOut').textContent = state.mode === 'book' ? 'Printed book' : 'Online';
    $('#orderOut').textContent = firstKindLabel();
    $('#preferenceOut').textContent = preferredKind();
    $('#readBeforeOut').textContent = state.readBefore === 'yes' ? 'Yes' : 'No';
    const sequenceBox=$('#sequenceBox');
    if(state.mode==='book'){
      sequenceBox.classList.remove('hidden');
      $('#sequenceOut').textContent = state.readAhead === 'yes' ? 'Read ahead before first survey' : 'Followed the instructed order';
    } else sequenceBox.classList.add('hidden');
    const f=state.firstRatings.first_thoughts?.trim();
    const s=state.secondRatings.second_thoughts?.trim();
    const w=state.comparison.whyPreferred?.trim();
    $('#firstCommentOut').textContent=f || 'No comment entered.';
    $('#secondCommentOut').textContent=s || 'No comment entered.';
    $('#preferenceCommentOut').textContent=w || 'No comment entered.';
    $('#discussionName').textContent=getMoonName();
  }

  // Home and mode selection
  $('#homeBtn').addEventListener('click',()=>show('home'));
  $('#startOnline').addEventListener('click',()=>{
    Object.assign(state,{mode:'online',bookCode:null,readAhead:null,order:[],readerIndex:0,firstRatings:{},secondRatings:{},comparison:{},postReveal:{}});
    resetFormsForNewRun(); buildSurveys(); saveState(); show('screening');
  });
  $('#startBook').addEventListener('click',()=>{
    Object.assign(state,{mode:'book',bookCode:null,readAhead:null,order:[],readerIndex:0,firstRatings:{},secondRatings:{},comparison:{},postReveal:{}});
    resetFormsForNewRun(); buildSurveys(); saveState(); show('bookCode');
  });
  $('#bookCodeBack').addEventListener('click',()=>show('home'));
  $$('[data-book-code]').forEach(btn=>btn.addEventListener('click',()=>{
    setBookOrder(btn.dataset.bookCode); buildSurveys(); saveState(); show('screening');
  }));

  $('#screeningBack').addEventListener('click',()=> show(state.mode==='book'?'bookCode':'home'));
  $('#screeningContinue').addEventListener('click',async()=>{
    const form=$('#screeningForm');
    const names=['readBefore','recognise','knowDifference'];
    if(names.some(n=>!answered(form,n))){
      $('#screeningError').classList.remove('hidden');
      $('#screeningError').scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    $('#screeningError').classList.add('hidden');
    const v=values(form);
    state.readBefore=v.readBefore; state.recognise=v.recognise; state.knowDifference=v.knowDifference;
    state.blindness=classify();
    if(state.mode==='online') chooseOnlineOrder();
    saveState();
    if(state.mode==='book') show('bookFirst'); else await startOnlineReading();
  });

  // Online long read: full shared novel once, then first ending.
  $('#readerPrev').addEventListener('click',async()=>{
    if(state.readerIndex>0){state.readerIndex--; await renderReaderSegment();}
  });
  $('#readerNext').addEventListener('click',async()=>{
    if(state.readerIndex < novelSections.length){state.readerIndex++; await renderReaderSegment(); return;}
    show('survey1');
  });

  // Direct ending screen used when returning Back from Survey 1 online.
  $('#firstEndingDone').addEventListener('click',()=>show('survey1'));
  $('#bookFirstBack').addEventListener('click',()=>show('screening'));
  $('#bookFirstDone').addEventListener('click',()=>show('survey1'));

  // Survey handlers
  document.addEventListener('click',async e=>{
    const back=e.target.closest('.surveyBack');
    if(back){
      const which=back.dataset.which;
      if(which==='first'){
        if(state.mode==='book') show('bookFirst');
        else {
          $('#firstEndingText').innerHTML = await loadEnding(state.order[0]);
          show('firstEndingOnly');
        }
      } else {
        if(state.mode==='book') show('bookSecond'); else show('secondEnding');
      }
      return;
    }
    const cont=e.target.closest('.surveyContinue');
    if(!cont) return;
    const which=cont.dataset.which;
    if(!validateEndingSurvey(which)) return;
    const form=which==='first'?$('#survey1Form'):$('#survey2Form');
    const v=values(form);
    if(which==='first'){
      state.firstRatings=v;
      if(state.mode==='book') state.readAhead=v.readAhead || null;
      saveState();
      if(state.mode==='book') show('bookSecond');
      else {
        $('#secondEndingText').innerHTML = await loadEnding(state.order[1]);
        show('secondEnding');
      }
    } else {
      state.secondRatings=v; saveState(); show('compare');
    }
  });

  $('#secondEndingDone').addEventListener('click',()=>show('survey2'));
  $('#bookSecondBack').addEventListener('click',()=>show('survey1'));
  $('#bookSecondDone').addEventListener('click',()=>show('survey2'));

  $('#confidenceScale').innerHTML=makeScale('confidence');
  $('#surpriseScale').innerHTML=makeScale('surprise');
  buildSurveys();

  $('#compareBack').addEventListener('click',()=>show('survey2'));
  $('#compareContinue').addEventListener('click',()=>{
    const form=$('#compareForm');
    if(!answered(form,'preferred') || !answered(form,'publishedGuess') || !answered(form,'confidence')){
      $('#compareError').classList.remove('hidden');
      $('#compareError').scrollIntoView({behavior:'smooth',block:'center'}); return;
    }
    $('#compareError').classList.add('hidden');
    state.comparison=values(form); saveState();
    const publishedPosition=state.order[0]==='published'?'first':'second';
    $('#revealText').innerHTML=`<p><strong>The ${publishedPosition} ending was the version published by H. G. Wells.</strong></p><p>The other is a reconstructed alternative final act created for this project, with generative AI used during drafting and revision.</p>`;
    show('reveal');
  });

  $$('input[name="changed"]').forEach(x=>x.addEventListener('change',()=>{
    const yes=$('input[name="changed"][value="yes"]:checked');
    $('#newPreferenceWrap').classList.toggle('hidden',!yes);
  }));

  $('#postRevealContinue').addEventListener('click',()=>{
    const form=$('#postRevealForm');
    const changed=form.querySelector('input[name="changed"]:checked')?.value;
    const missing=!answered(form,'surprise') || !changed || (changed==='yes' && !answered(form,'newPreference'));
    if(missing){
      $('#postRevealError').textContent='Please answer the required questions before continuing.';
      $('#postRevealError').classList.remove('hidden');
      $('#postRevealError').scrollIntoView({behavior:'smooth',block:'center'}); return;
    }
    $('#postRevealError').classList.add('hidden');
    state.postReveal=values(form); saveState(); renderResults(); show('results');
  });

  // Hidden developer/test controls. Append ?test=1 to the URL.
  if(new URLSearchParams(location.search).get('test')==='1'){
    const panel=document.createElement('div'); panel.id='testPanel';
    panel.innerHTML='<b>Test mode</b><br>' + [
      ['Home','home'],['Codes','bookCode'],['Screening','screening'],['Book 1','bookFirst'],['Survey 1','survey1'],['Book 2','bookSecond'],['Survey 2','survey2'],['Compare','compare'],['Reveal','reveal'],['Results','results']
    ].map(([label,id])=>`<button type="button" data-jump="${id}">${label}</button>`).join('') + '<br><button type="button" data-test-order="published">Online: Wells first</button><button type="button" data-test-order="alternative">Online: Alt first</button>';
    document.body.appendChild(panel);
    panel.addEventListener('click',async e=>{
      const jump=e.target.dataset.jump;
      if(jump){ if(jump==='results') renderResults(); show(jump); }
      const first=e.target.dataset.testOrder;
      if(first){ state.mode='online'; state.order=first==='published'?['published','alternative']:['alternative','published']; buildSurveys(); await loadNovel(); $('#secondEndingText').innerHTML=await loadEnding(state.order[1]); $('#firstEndingText').innerHTML=await loadEnding(state.order[0]); show('screening'); }
    });
  }
})();