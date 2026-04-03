// ===== STORAGE =====
const DKEY='taesung_data', SKEY='taesung_settings';
// DEF_SET defined above
function loadJ(k,def){try{const v=localStorage.getItem(k);return v?{...def,...JSON.parse(v)}:def;}catch(e){return def;}}
// SET defined above

// Initialize data from data.js constants
const DEF_DATA={holdJP:INIT_HOLD_JP,holdUS:INIT_HOLD_US,real:INIT_REAL,bkIn:INIT_BK_IN,bkOut:INIT_BK_OUT,journals:INIT_JOURNALS,accts:ACCT_INIT};
let D=loadJ(DKEY,DEF_DATA);
// Migrate: always use fresh accts from ACCT_INIT (fixes JP->KR group name change)
D.accts=ACCT_INIT;
if(D.secDeposit===undefined)D.secDeposit=SEC_DEP;
if(!D.vendors)D.vendors=INIT_VENDORS;
// Also migrate any saved holdings/journals group refs

function saveD(){D._lastSaved=new Date().toISOString();localStorage.setItem(DKEY,JSON.stringify(D));}
function saveS(){localStorage.setItem(SKEY,JSON.stringify(SET));}
function nid(){return Date.now()+Math.floor(Math.random()*1000);}


// ===== PIN LOCK =====
const PIN_KEY='taesung_pin';
let pinBuffer='';
let pinMode='unlock'; // 'unlock','setNew','confirmNew'
let pinTemp='';

function initLock(){
  const savedPin=localStorage.getItem(PIN_KEY);
  const lockEl=document.getElementById('lockScreen');
  if(!savedPin){
    // First time: set new PIN
    pinMode='setNew';
    document.getElementById('lockMsg').textContent='새 PIN(4자리)을 설정하세요';
    document.getElementById('lockExtra').textContent='처음 사용시 PIN을 설정합니다';
  } else {
    pinMode='unlock';
    document.getElementById('lockMsg').textContent='PIN을 입력하세요';
    document.getElementById('lockExtra').textContent='';
  }
  lockEl.style.display='flex';
  buildPinPad();
}

function buildPinPad(){
  const pad=document.getElementById('pinPad');
  pad.innerHTML='';
  [1,2,3,4,5,6,7,8,9,'C',0,'⏎'].forEach(k=>{
    const btn=document.createElement('button');
    btn.className='pin-key'+(typeof k==='string'&&k!=='0'?' fn':'');
    btn.textContent=k;
    btn.onclick=()=>pinInput(String(k));
    pad.appendChild(btn);
  });
}

function pinInput(k){
  if(k==='C'){pinBuffer='';updateDots();return;}
  if(k==='⏎'){checkPin();return;}
  if(pinBuffer.length<4){
    pinBuffer+=k;
    updateDots();
    if(pinBuffer.length===4) setTimeout(checkPin,200);
  }
}

function updateDots(){
  for(let i=0;i<4;i++){
    document.getElementById('pd'+i).classList.toggle('filled',i<pinBuffer.length);
  }
}

function checkPin(){
  const savedPin=localStorage.getItem(PIN_KEY);
  if(pinMode==='setNew'){
    if(pinBuffer.length!==4){document.getElementById('lockMsg').textContent='4자리를 입력하세요';pinBuffer='';updateDots();return;}
    pinTemp=pinBuffer;pinBuffer='';updateDots();
    pinMode='confirmNew';
    document.getElementById('lockMsg').textContent='확인을 위해 다시 입력하세요';
    return;
  }
  if(pinMode==='confirmNew'){
    if(pinBuffer===pinTemp){
      localStorage.setItem(PIN_KEY,pinBuffer);
      document.getElementById('lockScreen').style.display='none';
      pinBuffer='';pinTemp='';
    } else {
      document.getElementById('lockMsg').textContent='불일치! 다시 설정하세요';
      pinBuffer='';pinTemp='';updateDots();
      pinMode='setNew';
    }
    return;
  }
  // unlock mode
  if(pinBuffer===savedPin){
    document.getElementById('lockScreen').style.display='none';
    pinBuffer='';
  } else {
    document.getElementById('lockMsg').textContent='❌ 틀렸습니다. 다시 입력하세요';
    pinBuffer='';updateDots();
    // Shake animation
    document.querySelector('#lockScreen > div').style.animation='shake 0.3s';
    setTimeout(()=>{document.querySelector('#lockScreen > div').style.animation='';},400);
  }
}

function resetPinPrompt(){
  if(confirm('PIN을 초기화하시겠습니까?\n(모든 데이터는 유지됩니다)')){
    localStorage.removeItem(PIN_KEY);
    pinMode='setNew';pinBuffer='';pinTemp='';updateDots();
    document.getElementById('lockMsg').textContent='새 PIN(4자리)을 설정하세요';
    document.getElementById('lockExtra').textContent='';
  }
}

function changePin(){
  document.getElementById('lockScreen').style.display='flex';
  pinMode='setNew';pinBuffer='';pinTemp='';updateDots();
  document.getElementById('lockMsg').textContent='새 PIN(4자리)을 설정하세요';
  document.getElementById('lockExtra').textContent='';
}


// ===== EXCHANGE RATE AUTO =====
function fetchRate(){
  const btn=document.getElementById('rateBtn');
  if(btn)btn.textContent='⏳ 가져오는 중...';
  fetch('https://api.exchangerate-api.com/v4/latest/USD')
    .then(r=>r.json())
    .then(data=>{
      const jpyRate=data.rates.JPY;
      const krwRate=data.rates.KRW;
      SET.rates.USDJPY=Math.round(jpyRate*1000000)/1000000;
      SET.rates.JPYKRW=krwRate&&jpyRate?Math.round(krwRate/jpyRate*1000000)/1000000:SET.rates.JPYKRW;
      localStorage.setItem('taesung_settings',JSON.stringify(SET));
      if(btn)btn.textContent='✅ 완료! USD/JPY: '+SET.rates.USDJPY;
      // Update settings page inputs if visible
      const r1=document.getElementById('r1');if(r1)r1.value=SET.rates.USDJPY;
      const r2=document.getElementById('r2');if(r2)r2.value=SET.rates.JPYKRW;
      setTimeout(()=>{if(btn)btn.textContent='🔄 환율 자동 가져오기';},3000);
    })
    .catch(e=>{
      if(btn)btn.textContent='❌ 실패 (네트워크 확인)';
      setTimeout(()=>{if(btn)btn.textContent='🔄 환율 자동 가져오기';},3000);
    });
}

// ===== Dynamic FS Calculation =====
function acctBal(code){
  const ac=D.accts.find(x=>x.c===code);
  const isDb=ac&&["자산","비용"].includes(ac.g);
  let dr=0,cr=0;
  D.journals.forEach(j=>{if(j.dr===code)dr+=j.amt;if(j.cr===code)cr+=j.amt;});
  return isDb?dr-cr:cr-dr;
}
function dynamicFS(){
  const c=calc();
  // P&L: all computed from journals
  const sgaCodes=['510','511','512','513','514','515','516','520','521','522','523','524','525','526','527','528','529','530','531','532','533','534','535','536','537','538','539','547','548','549','570','580','581','582','583','584'];
  const noiCodes=['401','402','403','404','405','406','407','408','409','410','411','412','413'];
  const specCodes=['560','561','562','563','564','565'];
  let sgaT=0,noiT=0,suT=0;
  sgaCodes.forEach(c2=>{sgaT+=acctBal(c2);});
  noiCodes.forEach(c2=>{noiT+=acctBal(c2);});
  specCodes.forEach(c2=>{suT+=acctBal(c2);});
  const su=suT;
  const ol=0-sgaT-su; // 매출 0
  const interestPay=acctBal('540'); // 지급이자 from journals
  // Dynamic: unrealized P&L from current holdings
  const evalLoss=Math.max(0, c.allC - c.allMv); // 보유종목 시가기준 실시간 // positive = loss
  const noeT=evalLoss+interestPay;
  const oi=ol+noiT-noeT;
  // Use journal tax if exists, otherwise estimate
  const journalCt=acctBal('550');
  // Detailed tax: 법인세15%+지방법인세10.3%+사업세7%+특별사업세37%+도민세7%+균등할7만
  const estTax=oi>0?Math.round(oi*0.15)+Math.round(Math.round(oi*0.15)*0.103)+Math.round(oi*0.07)+Math.round(Math.round(oi*0.07)*0.37)+Math.round(Math.round(oi*0.15)*0.07)+70000:0;
  const ct=journalCt>0?journalCt:estTax;
  const ni=oi-ct;
  // B/S: journal + 시가 조정 (평가손 실시간 반영)
  const deposit=acctBal('110');
  const secDep=acctBal('191');
  const secBookVal=acctBal('130'); // 전표 장부가
  const secMV=c.allMv;
  const journalEvalLoss=acctBal('542'); // 전표상 평가손
  const evalAdj=evalLoss-journalEvalLoss; // 시가 조정액
  const secForBS=secBookVal-evalAdj; // 시가 반영 유가증권
  const cashT=deposit+secDep;
  const totA=cashT+secForBS;
  // Liabilities + Equity: all from journals
  const liabCodes=['200','201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','220','221','222','223','224','225','226','227','228'];
  let totL=0;liabCodes.forEach(c2=>{totL+=acctBal(c2);});
  // Equity: from journals
  const capitalBal=acctBal('300')+acctBal('301')+acctBal('302');
  const retainedBal=acctBal('310')+acctBal('311')+acctBal('312');
  // 이익잉여금 = journal retained + current period NI (if not yet closed)
  const eqNI=ni;
  const totE=capitalBal+retainedBal+eqNI;
  return {sgaT,su,ol,noiT,evalLoss,interestPay,noeT,oi,ct,ni,deposit,secDep,secBookVal,secForBS,secMV,cashT,totA,totL,capitalBal,eqNI,totE,evalAdj};
}


// ===== ASSET TREND (자산추이) =====
function saveSnapshot(){
  if(!D.snapshots)D.snapshots=[];
  const c=calc();
  const today=new Date().toISOString().slice(0,10);
  // Max 1 snapshot per day (update if exists)
  const idx=D.snapshots.findIndex(s=>s.dt===today);
  const snap={dt:today,totA:c.totA,bb:c.bb,secBal:c.secBal,secDep:c.secDep,allMv:c.allMv,allPl:c.allPl,rpl:c.rpl};
  if(idx>=0)D.snapshots[idx]=snap;
  else D.snapshots.push(snap);
  // Keep max 365 days
  if(D.snapshots.length>365)D.snapshots=D.snapshots.slice(-365);
  saveD();
}

function renderTrendChart(period){
  if(!D.snapshots||D.snapshots.length===0)return '<div style="text-align:center;padding:30px;color:#94a3b8">데이터 수집 중... 매일 대시보드 방문 시 자동 기록됩니다</div>';
  
  let data=[...D.snapshots].sort((a,b)=>a.dt.localeCompare(b.dt));
  // Filter by period
  const now=new Date();
  let cutoff=new Date();
  if(period==='week')cutoff.setDate(now.getDate()-7);
  else if(period==='month')cutoff.setMonth(now.getMonth()-1);
  else if(period==='quarter')cutoff.setMonth(now.getMonth()-3);
  else if(period==='half')cutoff.setMonth(now.getMonth()-6);
  else cutoff.setFullYear(now.getFullYear()-1);
  const cutStr=cutoff.toISOString().slice(0,10);
  data=data.filter(s=>s.dt>=cutStr);
  
  if(data.length===0)return '<div style="text-align:center;padding:20px;color:#94a3b8">해당 기간 데이터 없음</div>';
  
  // Chart dimensions
  const W=800,H=200,PL=70,PR=20,PT=20,PB=40;
  const cW=W-PL-PR,cH=H-PT-PB;
  
  // Y axis: totA
  const vals=data.map(d=>d.totA);
  const minV=Math.min(...vals)*0.98;
  const maxV=Math.max(...vals)*1.02;
  const range=maxV-minV||1;
  
  // Build SVG
  let svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-height:220px;font-family:sans-serif">';
  
  // Grid lines + Y labels
  for(let i=0;i<=4;i++){
    const y=PT+cH*(1-i/4);
    const val=minV+range*i/4;
    svg+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="#e2e6ed" stroke-width="0.5"/>';
    svg+='<text x="'+(PL-6)+'" y="'+(y+3)+'" text-anchor="end" fill="#94a3b8" font-size="9">'+(val>=100000000?(val/100000000).toFixed(1)+'億':(val/10000).toFixed(0)+'万')+'</text>';
  }
  
  // Data points + line
  const points=data.map((d,i)=>{
    const x=PL+(data.length>1?i/(data.length-1):0.5)*cW;
    const y=PT+cH*(1-(d.totA-minV)/range);
    return {x,y,d};
  });
  
  // Area fill
  if(points.length>1){
    let area='M'+points[0].x+','+(PT+cH);
    points.forEach(p=>{area+='L'+p.x+','+p.y;});
    area+='L'+points[points.length-1].x+','+(PT+cH)+'Z';
    svg+='<path d="'+area+'" fill="url(#grad)" opacity="0.3"/>';
    svg+='<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>';
  }
  
  // Line
  if(points.length>1){
    let line='M'+points.map(p=>p.x+','+p.y).join('L');
    svg+='<path d="'+line+'" fill="none" stroke="#2563eb" stroke-width="2"/>';
  }
  
  // Dots + X labels
  points.forEach((p,i)=>{
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>';
    // X label (show every few)
    const step=Math.max(1,Math.floor(points.length/8));
    if(i%step===0||i===points.length-1){
      const label=p.d.dt.slice(5);// MM-DD
      svg+='<text x="'+p.x+'" y="'+(H-8)+'" text-anchor="middle" fill="#94a3b8" font-size="8">'+label+'</text>';
    }
  });
  
  // Latest value label
  if(points.length>0){
    const last=points[points.length-1];
    svg+='<text x="'+last.x+'" y="'+(last.y-10)+'" text-anchor="middle" fill="#2563eb" font-size="10" font-weight="bold">¥'+fm(last.d.totA)+'</text>';
  }
  
  svg+='</svg>';
  
  // Sub-chart: breakdown bars
  const last=data[data.length-1];
  const parts=[
    {label:'법인계좌',val:last.bb,color:'#d97706'},
    {label:'증권예수금',val:last.secDep,color:'#7c3aed'},
    {label:'유가증권',val:last.allMv,color:'#2563eb'}
  ];
  const barTotal=parts.reduce((s,p)=>s+p.val,0)||1;
  let bars='<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-top:8px">';
  parts.forEach(p=>{
    const pct=Math.max(1,p.val/barTotal*100);
    bars+='<div style="width:'+pct+'%;background:'+p.color+';display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:600;min-width:30px" title="'+p.label+': ¥'+fm(p.val)+'">'+(pct>15?p.label:'')+'</div>';
  });
  bars+='</div>';
  bars+='<div style="display:flex;gap:12px;margin-top:6px;font-size:10px">';
  parts.forEach(p=>{bars+='<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+p.color+';margin-right:3px"></span>'+p.label+' '+fm(p.val)+'</span>';});
  bars+='</div>';
  
  return svg+bars;
}


// ===== FIREBASE SYNC =====
const FB_DOC = 'taesung_main';
const FB_COL = 'appdata';
let fbReady = false;
try{fbReady = typeof firebase !== 'undefined' && typeof db !== 'undefined' && db !== null;}catch(e){fbReady=false;}

async function fbSave(){
  if(!fbReady) return;
  try{
    await db.collection(FB_COL).doc(FB_DOC).set({
      data: JSON.stringify(D),
      settings: JSON.stringify(SET),
      updatedAt: new Date().toISOString(),
      device: navigator.userAgent.slice(0,50)
    });
    console.log('Firebase saved');
  }catch(e){console.log('Firebase save error:',e.message);}
}

async function fbLoad(){
  if(!fbReady) return null;
  try{
    const doc = await db.collection(FB_COL).doc(FB_DOC).get();
    if(doc.exists){
      const fb = doc.data();
      return {
        data: JSON.parse(fb.data),
        settings: JSON.parse(fb.settings),
        updatedAt: fb.updatedAt
      };
    }
  }catch(e){console.log('Firebase load error:',e.message);}
  return null;
}



function showDiag(){
  const c=calc();
  const d=dynamicFS();
  const info=
    '=== 데이터 진단 ===\n'+
    '전표: '+D.journals.length+'건\n'+
    '보유종목(JP): '+D.holdJP.length+'종목\n'+
    '보유종목(US): '+D.holdUS.length+'종목\n'+
    'secDeposit: '+(D.secDeposit||'없음')+'\n'+
    '_lastSaved: '+(D._lastSaved||'없음')+'\n'+
    '\n=== calc() ===\n'+
    'bb(은행잔액): '+c.bb+'\n'+
    'secDep: '+c.secDep+'\n'+
    'jpMv: '+c.jpMv+'\n'+
    'usMv: '+c.usMv+'\n'+
    'allMv: '+c.allMv+'\n'+
    'totA: '+c.totA+'\n'+
    '\n=== holdJP cp(현재가) ===\n'+
    D.holdJP.map(h=>h.tk+': cp='+h.cp+' mv='+h.mv).join('\n')+'\n'+
    '\n=== holdUS ===\n'+
    D.holdUS.map(h=>h.tk+': cpUsd='+h.cpUsd+' mv='+h.mv).join('\n');
  alert(info);
}

async function doFbUpload(){
  if(!fbReady){alert('Firebase가 연결되지 않았습니다.\n페이지를 새로고침하세요.');return;}
  try{
    await fbSave();
    alert('서버에 업로드 완료!');
  }catch(e){alert('업로드 실패: '+e.message);}
}

async function doFbDownload(){
  if(!fbReady){alert('Firebase가 연결되지 않았습니다.');return;}
  try{
    const doc=await db.collection(FB_COL).doc(FB_DOC).get();
    if(!doc.exists){alert('서버에 데이터가 없습니다.');return;}
    const fb=doc.data();
    const fbData=JSON.parse(fb.data);
    const fbHold=fbData.holdJP||[];
    const info='Firebase 데이터:\n'+
      '전표: '+(fbData.journals||[]).length+'건\n'+
      '종목 현재가:\n'+
      fbHold.map(h=>h.tk+':cp='+h.cp).join(', ')+'\n\n적용?';
    if(!confirm(info))return;
    // Write directly to D and localStorage
    for(var key in fbData){if(fbData.hasOwnProperty(key))D[key]=fbData[key];}
    D.accts=ACCT_INIT;
    if(D.secDeposit===undefined)D.secDeposit=SEC_DEP;
    if(!D.vendors)D.vendors=INIT_VENDORS||[];
    D._lastSaved=new Date().toISOString();
    try{localStorage.setItem(DKEY,JSON.stringify(D));}catch(e){}
    if(fb.settings){
      try{SET=JSON.parse(fb.settings);localStorage.setItem(SKEY,JSON.stringify(SET));}catch(e){}
    }
    // Verify
    var c2=calc();
    alert('적용 완료!\ntotA='+c2.totA+'\njpMv='+c2.jpMv);
    go('dash');
  }catch(e){alert('다운로드 실패: '+e.message);}
}

async function fbInit(){
  if(!fbReady) return;
  try{
    const fb = await fbLoad();
    if(!fb) {
      // First time: upload local to Firebase
      await fbSave();
      console.log('Firebase: initial upload done');
      return;
    }
    // Compare timestamps
    const localTime = D._lastSaved || '2000-01-01';
    const fbTime = fb.updatedAt || '2000-01-01';
    if(fbTime > localTime){
      // Firebase is newer: load it
      const fbData = fb.data;
      fbData.accts = ACCT_INIT;
      D = fbData;
      if(D.secDeposit===undefined) D.secDeposit = SEC_DEP;
      if(!D.vendors) D.vendors = INIT_VENDORS;
      localStorage.setItem(DKEY, JSON.stringify(D));
      if(fb.settings){
        SET = fb.settings;
        localStorage.setItem(SKEY, JSON.stringify(SET));
      }
      console.log('Firebase: loaded newer data ('+fbTime+')');
      // Save locally only (don't re-upload to Firebase)
      localStorage.setItem(DKEY,JSON.stringify(D));
      go('dash');
      console.log('Firebase auto-sync applied');
    } else {
      console.log('Firebase: local is current');
    }
  }catch(e){console.log('Firebase init error:',e.message);}
}


// ===== 월차 마감 =====
function saveMonthlyClose(){
  if(!D.monthlyClosed) D.monthlyClosed={};
  const now=new Date();
  const key=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const d=dynamicFS();
  const c=calc();
  D.monthlyClosed[key]={
    date:now.toISOString(),
    totA:c.totA,bb:c.bb,secDep:c.secDep,allMv:c.allMv,
    sgaT:d.sgaT,noiT:d.noiT,noeT:d.noeT,oi:d.oi,ni:d.ni,
    totL:d.totL,totE:d.totE,
    journals:D.journals.length
  };
  saveD();
  alert('월차 마감 저장 완료!\n'+key+'\n총자산: '+fm(c.totA)+'\n경상이익: '+fm(d.oi));
}

function showMonthlyTab(btn){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  btn.classList.add('on');
  var tc=document.getElementById('TC');
  if(tc) tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">📅 월차 추이</div>'+rMonthlyTable()+'</div>';
}
function rMonthlyTable(){
  if(!D.monthlyClosed||Object.keys(D.monthlyClosed).length===0) return '<div style="padding:20px;text-align:center;color:#94a3b8">월차 마감 데이터가 없습니다.\n설정에서 월차 마감을 실행하세요.</div>';
  const keys=Object.keys(D.monthlyClosed).sort();
  let rows='';
  keys.forEach((k,i)=>{
    const m=D.monthlyClosed[k];
    const prev=i>0?D.monthlyClosed[keys[i-1]]:null;
    const diff=prev?(m.totA-prev.totA):0;
    const diffColor=diff>=0?'#059669':'#dc2626';
    rows+='<tr class="'+(i%2?'a':'')+'"><td class="m">'+k+'</td><td class="r m">'+fm(m.totA)+'</td><td class="r m">'+fm(m.bb)+'</td><td class="r m">'+fm(m.allMv)+'</td><td class="r m">'+fm(m.oi)+'</td><td class="r m">'+fm(m.ni)+'</td><td class="r m" style="color:'+diffColor+'">'+(diff>=0?'+':'')+fm(diff)+'</td><td class="mu">'+m.journals+'건</td></tr>';
  });
  return '<table><thead><tr><th>월</th><th class="r">총자산</th><th class="r">은행잔액</th><th class="r">유가증권</th><th class="r">경상이익</th><th class="r">순이익</th><th class="r">전월대비</th><th>전표</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

// ===== UTILS =====
const fm=n=>n==null?"-":new Intl.NumberFormat("ja-JP").format(Math.round(n));
const fy=n=>n==null?"-":"¥"+fm(n);
const bg=v=>'<span class="bg '+(v>=0?'p':'n')+'">'+(v>=0?'+':'')+fm(v)+'</span>';
function rptDt(){return SET.reportDate||new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});}

function calc(){
  const jpMv=D.holdJP.reduce((s,h)=>s+h.mv,0),jpC=D.holdJP.reduce((s,h)=>s+h.tc,0);
  const usMv=D.holdUS.reduce((s,h)=>s+h.mv,0),usC=D.holdUS.reduce((s,h)=>s+h.tc,0);
  const tI=D.bkIn.reduce((s,d)=>s+d.amt,0),tO=D.bkOut.reduce((s,d)=>s+d.amt,0);
  const rpl=D.real.reduce((s,r)=>s+r.net,0),rC=D.real.reduce((s,r)=>s+r.tc,0),rS=D.real.reduce((s,r)=>s+r.sa,0);
  const bb=tI-tO,secDep=D.secDeposit||SEC_DEP,secBal=secDep+jpMv+usMv;
  return {jpMv,jpC,usMv,usC,allMv:jpMv+usMv,allC:jpC+usC,allPl:jpMv+usMv-jpC-usC,rpl,rC,rS,tI,tO,bb,secDep,secBal,totA:bb+secBal};
}

function showModal(title,html){document.getElementById('modal').innerHTML='<div class="mo" onclick="closeModal()"><div class="mc" onclick="event.stopPropagation()"><h3>'+title+'</h3>'+html+'</div></div>';document.getElementById('modal').classList.remove('hidden');}
function closeModal(){document.getElementById('modal').classList.add('hidden');}
function acctNm(c){return tAcct(c);}
function acctOptions(){return '<option value="">--</option>'+["자산","부채","순자산","수익","비용"].map(g=>'<optgroup label="'+g+'">'+D.accts.filter(a=>a.g===g).map(a=>'<option value="'+a.c+'">'+a.c+' '+(LANG==='ja'?a.n:a.k)+'</option>').join('')+'</optgroup>').join('');}
function catLabel(d){return LANG==='ja'?(d.catJa||d.cat):d.cat;}
function holdNm(h){return LANG==='ja'?(h.ja||h.nm):h.nm;}
function realNm(r){return LANG==='ja'?(r.ja||r.nm):r.nm;}


// ===== CRUD & PAGES =====
function addBkIn(){showModal('입금 내역추가',`<div class="fg"><div><label>날짜</label><input type="date" id="f_dt"></div><div><label>구분</label><input id="f_cat" placeholder="구분(내역)"></div><div><label>분류</label><select id="f_type"><option value="income">수익</option><option value="capital">자본금</option><option value="loan">차입금 (부채)</option><option value="sec">증권이체</option></select></div><div><label>금액 (엔)</label><input type="number" id="f_amt" placeholder="0"></div><div style="display:flex;gap:8px;justify-content:flex-end;align-items:end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt gn" onclick="doAddBkIn()">추가</button></div></div>`);}
function doAddBkIn(){const dt=document.getElementById('f_dt').value,cat=document.getElementById('f_cat').value,amt=Number(document.getElementById('f_amt').value),type=document.getElementById('f_type').value;if(!dt||!amt)return alert('날짜와 금액을 입력하세요');D.bkIn.push({id:nid(),dt,cat,amt,type});saveD();closeModal();go('bank');}
function addBkOut(){showModal('출금 내역추가',`<div class="fg"><div><label>날짜</label><input type="date" id="f_dt"></div><div><label>구분</label><input id="f_cat" placeholder="구분(내역)"></div><div><label>분류</label><select id="f_type"><option value="expense">경비</option><option value="sec">증권이체</option><option value="loan">차입금상환 (부채)</option><option value="other">기타</option></select></div><div><label>금액 (엔)</label><input type="number" id="f_amt" placeholder="0"></div><div style="display:flex;gap:8px;justify-content:flex-end;align-items:end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt rd" onclick="doAddBkOut()">추가</button></div></div>`);}
function doAddBkOut(){const dt=document.getElementById('f_dt').value,cat=document.getElementById('f_cat').value,amt=Number(document.getElementById('f_amt').value),type=document.getElementById('f_type').value;if(!dt||!amt)return alert('날짜와 금액을 입력하세요');D.bkOut.push({id:nid(),dt,cat,amt,type});saveD();closeModal();go('bank');}
function delBk(type,id){if(!confirm('삭제하시겠습니까?'))return;if(type==='in')D.bkIn=D.bkIn.filter(x=>x.id!==id);else D.bkOut=D.bkOut.filter(x=>x.id!==id);saveD();go('bank');}

// ===== CRUD: Securities Holdings =====
function addHoldJP(){showModal('일본 종목 추가',`<div class="fg">
  <div><label>종목코드</label><input id="f_tk"></div><div><label>종목명</label><input id="f_nm"></div>
  <div><label>수량</label><input type="number" id="f_sh"></div><div><label>매수금액(수수료제외)</label><input type="number" id="f_ba"></div>
  <div><label>매수수수료</label><input type="number" id="f_fee" value="0"></div><div><label>현재가</label><input type="number" id="f_cp"></div>
  <div class="full" id="f_preview"></div>
  <div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt" onclick="doAddHoldJP()">추가</button></div></div>
  <script>['f_sh','f_ba','f_fee','f_cp'].forEach(id=>document.getElementById(id).addEventListener('input',updPreview));function updPreview(){const sh=+document.getElementById('f_sh').value||0,ba=+document.getElementById('f_ba').value||0,fee=+document.getElementById('f_fee').value||0,cp=+document.getElementById('f_cp').value||0;const tc=ba+fee,mv=sh*cp,pl=mv-tc;document.getElementById('f_preview').innerHTML=sh&&cp?'<div class=\"preview\"><span>취득원가: <b>'+fm(tc)+'</b></span><span>평가액: <b>'+fm(mv)+'</b></span><span>손익: <b style=\"color:'+(pl>=0?'#059669':'#dc2626')+'\">'+fm(pl)+'</b></span></div>':'';}<\/script>`);}
function doAddHoldJP(){const tk=document.getElementById('f_tk').value,nm=document.getElementById('f_nm').value,sh=+document.getElementById('f_sh').value,ba=+document.getElementById('f_ba').value,fee=+document.getElementById('f_fee').value||0,cp=+document.getElementById('f_cp').value;if(!tk||!sh)return alert('코드와 수량을 입력하세요');const tc=ba+fee,bep=sh?Math.round(tc/sh):0,mv=sh*cp;D.holdJP.push({id:nid(),tk,nm,sh,px:sh?Math.round(ba/sh):0,buyAmt:ba,fee,tc,bep,cp,mv});saveD();closeModal();go('sec');}
function delHoldJP(id){if(!confirm('삭제하시겠습니까?'))return;D.holdJP=D.holdJP.filter(x=>x.id!==id);saveD();go('sec');}

function addHoldUS(){showModal('미국 종목 추가',`<div class="fg">
  <div><label>종목코드</label><input id="f_tk"></div><div><label>종목명</label><input id="f_nm"></div>
  <div><label>수량</label><input type="number" id="f_sh"></div><div><label>매수금액(엔)</label><input type="number" id="f_ba"></div>
  <div><label>현재가(USD)</label><input type="number" id="f_cpu" step="0.01"></div><div><label>환율(USD/JPY)</label><input type="number" id="f_rate" value="${SET.rates.USDJPY}" step="0.000001"></div>
  <div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt" onclick="doAddHoldUS()">추가</button></div></div>`);}
function doAddHoldUS(){const tk=document.getElementById('f_tk').value,nm=document.getElementById('f_nm').value,sh=+document.getElementById('f_sh').value,ba=+document.getElementById('f_ba').value,cpu=+document.getElementById('f_cpu').value,rate=+document.getElementById('f_rate').value;if(!tk||!sh)return alert('코드와 수량을 입력하세요');const mv=Math.round(sh*cpu*rate);D.holdUS.push({id:nid(),tk,nm,sh,buyAmt:ba,fee:0,tc:ba,bep:sh?Math.round(ba/sh):0,cpUsd:cpu,rate,mv});saveD();closeModal();go('sec');}
function delHoldUS(id){if(!confirm('삭제하시겠습니까?'))return;D.holdUS=D.holdUS.filter(x=>x.id!==id);saveD();go('sec');}

// ===== CRUD: Realized =====
function addReal(){showModal('수익실현 추가',`<div class="fg">
  <div><label>확정일</label><input type="date" id="f_dt"></div><div><label>종목코드</label><input id="f_tk"></div>
  <div><label>종목명</label><input id="f_nm"></div><div><label>수량</label><input type="number" id="f_sh"></div>
  <div><label>매수금액</label><input type="number" id="f_ba"></div><div><label>매수수수료</label><input type="number" id="f_bc" value="0"></div>
  <div><label>매수소비세</label><input type="number" id="f_bt" value="0"></div><div><label>매도금액</label><input type="number" id="f_sa"></div>
  <div><label>매도수수료</label><input type="number" id="f_sc" value="0"></div><div><label>매도소비세</label><input type="number" id="f_st" value="0"></div>
  <div class="full" id="f_rp"></div>
  <div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt gn" onclick="doAddReal()">추가</button></div></div>
  <script>['f_ba','f_bc','f_bt','f_sa','f_sc','f_st'].forEach(id=>document.getElementById(id).addEventListener('input',updRP));function updRP(){const ba=+document.getElementById('f_ba').value||0,bc=+document.getElementById('f_bc').value||0,bt=+document.getElementById('f_bt').value||0,sa=+document.getElementById('f_sa').value||0,sc=+document.getElementById('f_sc').value||0,st=+document.getElementById('f_st').value||0;const tc=ba+bc+bt,net=sa-tc-sc-st;document.getElementById('f_rp').innerHTML=ba&&sa?'<div class=\"preview\"><span>취득원가: <b>'+fm(tc)+'</b></span><span>순수익: <b style=\"color:'+(net>=0?'#059669':'#dc2626')+'\">'+fm(net)+'</b></span><span>수익률: <b>'+(tc?(net/tc*100).toFixed(2):'0')+'%</b></span></div>':'';}<\/script>`);}
function doAddReal(){const dt=document.getElementById('f_dt').value,tk=document.getElementById('f_tk').value,nm=document.getElementById('f_nm').value,sh=+document.getElementById('f_sh').value,ba=+document.getElementById('f_ba').value,bC=+document.getElementById('f_bc').value||0,bT=+document.getElementById('f_bt').value||0,sa=+document.getElementById('f_sa').value,sC=+document.getElementById('f_sc').value||0,sT=+document.getElementById('f_st').value||0;if(!tk||!sa)return alert('필수항목을 입력하세요');const tc=ba+bC+bT,gr=sa-tc,net=gr-sC-sT,rr=tc?(net/tc*100):0;D.real.push({id:nid(),dt,tk,nm,sh,px:sh?Math.round(ba/sh):0,buyAmt:ba,bC,bT,tc,sp:sh?Math.round(sa/sh):0,sa,gr,sC,sT,net,rr:Math.round(rr*100)/100});saveD();closeModal();go('sec');}
function delReal(id){if(!confirm('삭제하시겠습니까?'))return;D.real=D.real.filter(x=>x.id!==id);saveD();go('sec');}


function editHoldJP(id){
  const h=D.holdJP.find(x=>x.id===id);if(!h)return;
  const isMan=h.manual||false;
  showModal('종목 수정 ('+h.tk+')',
  '<div class="fg">'+
  '<div><label>종목코드</label><input id="f_tk" value="'+h.tk+'"></div>'+
  '<div><label>종목명</label><input id="f_nm" value="'+(h.nm||'')+'"></div>'+
  '<div><label>수량</label><input type="number" id="f_sh" value="'+h.sh+'"></div>'+
  '<div><label>매수금액</label><input type="number" id="f_ba" value="'+h.buyAmt+'"></div>'+
  '<div><label>수수료</label><input type="number" id="f_fee" value="'+h.fee+'"></div>'+
  '<div><label>현재가</label><input type="number" id="f_cp" value="'+h.cp+'"></div>'+
  '<div class="full" style="padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin-top:4px">'+
    '<label style="font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer">'+
    '<input type="checkbox" id="f_man" '+(isMan?'checked':'')+' onchange="toggleManual()"> <b>수동모드</b> (평가액 직접 입력)</label>'+
    '<div style="margin-top:6px"><label style="font-size:10px;color:#64748b">평가액</label>'+
    '<input type="number" id="f_mv" value="'+h.mv+'" '+(isMan?'':'disabled')+' style="background:'+(isMan?'#fff':'#f1f3f6')+'"></div>'+
  '</div>'+
  '<div class="full" style="display:flex;gap:8px;justify-content:flex-end">'+
    '<button class="bt gh" onclick="closeModal()">취소</button>'+
    '<button class="bt" onclick="doEditHoldJP('+id+')">저장</button></div></div>');
}
function toggleManual(){
  var cb=document.getElementById('f_man');
  var mv=document.getElementById('f_mv');
  if(cb&&mv){mv.disabled=!cb.checked;mv.style.background=cb.checked?'#fff':'#f1f3f6';}
}
function doEditHoldJP(id){
  const h=D.holdJP.find(x=>x.id===id);if(!h)return;
  h.tk=document.getElementById('f_tk').value;
  h.nm=document.getElementById('f_nm').value;
  h.sh=+document.getElementById('f_sh').value;
  h.buyAmt=+document.getElementById('f_ba').value;
  h.fee=+document.getElementById('f_fee').value;
  h.cp=+document.getElementById('f_cp').value;
  h.tc=h.buyAmt+h.fee;
  h.bep=h.sh?Math.round(h.tc/h.sh):0;
  h.manual=document.getElementById('f_man').checked;
  if(h.manual){h.mv=+document.getElementById('f_mv').value;}
  else{h.mv=h.sh*h.cp;}
  saveD();closeModal();go('sec');
}
function editHoldUS(id){
  const h=D.holdUS.find(x=>x.id===id);if(!h)return;
  const isMan=h.manual||false;
  showModal('미국종목 수정 ('+h.tk+')',
  '<div class="fg">'+
  '<div><label>종목코드</label><input id="f_tk" value="'+h.tk+'"></div>'+
  '<div><label>종목명</label><input id="f_nm" value="'+(h.nm||'')+'"></div>'+
  '<div><label>수량</label><input type="number" id="f_sh" value="'+h.sh+'"></div>'+
  '<div><label>매수금액(엔)</label><input type="number" id="f_ba" value="'+h.buyAmt+'"></div>'+
  '<div><label>현재가(USD)</label><input type="number" id="f_cpu" value="'+h.cpUsd+'" step="0.01"></div>'+
  '<div><label>환율(USD/JPY)</label><input type="number" id="f_rate" value="'+(h.rate||SET.rates.USDJPY)+'" step="0.000001"></div>'+
  '<div class="full" style="padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;margin-top:4px">'+
    '<label style="font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer">'+
    '<input type="checkbox" id="f_man" '+(isMan?'checked':'')+' onchange="toggleManual()"> <b>수동모드</b> (평가액 직접 입력)</label>'+
    '<div style="margin-top:6px"><label style="font-size:10px;color:#64748b">평가액</label>'+
    '<input type="number" id="f_mv" value="'+h.mv+'" '+(isMan?'':'disabled')+' style="background:'+(isMan?'#fff':'#f1f3f6')+'"></div>'+
  '</div>'+
  '<div class="full" style="display:flex;gap:8px;justify-content:flex-end">'+
    '<button class="bt gh" onclick="closeModal()">취소</button>'+
    '<button class="bt" onclick="doEditHoldUS('+id+')">저장</button></div></div>');
}
function doEditHoldUS(id){
  const h=D.holdUS.find(x=>x.id===id);if(!h)return;
  h.tk=document.getElementById('f_tk').value;
  h.nm=document.getElementById('f_nm').value;
  h.sh=+document.getElementById('f_sh').value;
  h.buyAmt=+document.getElementById('f_ba').value;
  h.cpUsd=+document.getElementById('f_cpu').value;
  h.rate=+document.getElementById('f_rate').value;
  h.tc=h.buyAmt;
  h.manual=document.getElementById('f_man').checked;
  if(h.manual){h.mv=+document.getElementById('f_mv').value;}
  else{h.mv=Math.round(h.sh*h.cpUsd*h.rate);}
  saveD();closeModal();go('sec');
}
function editReal(id){const r=D.real.find(x=>x.id===id);if(!r)return;showModal('수익실현 수정 ('+r.tk+')',
  '<div class="fg">'+
  '<div><label>확정일</label><input type="date" id="f_dt" value="'+r.dt+'"></div><div><label>코드</label><input id="f_tk" value="'+r.tk+'"></div>'+
  '<div><label>종목명</label><input id="f_nm" value="'+r.nm+'"></div><div><label>수량</label><input type="number" id="f_sh" value="'+r.sh+'"></div>'+
  '<div><label>매수금액</label><input type="number" id="f_ba" value="'+r.buyAmt+'"></div><div><label>매수수수료</label><input type="number" id="f_bc" value="'+r.bC+'"></div>'+
  '<div><label>매수소비세</label><input type="number" id="f_bt" value="'+r.bT+'"></div><div><label>매도금액</label><input type="number" id="f_sa" value="'+r.sa+'"></div>'+
  '<div><label>매도수수료</label><input type="number" id="f_sc" value="'+r.sC+'"></div><div><label>매도소비세</label><input type="number" id="f_st" value="'+r.sT+'"></div>'+
  '<div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt" onclick="doEditReal('+id+')">저장</button></div></div>');}
function doEditReal(id){const r=D.real.find(x=>x.id===id);if(!r)return;r.dt=document.getElementById('f_dt').value;r.tk=document.getElementById('f_tk').value;r.nm=document.getElementById('f_nm').value;r.sh=+document.getElementById('f_sh').value;r.buyAmt=+document.getElementById('f_ba').value;r.bC=+document.getElementById('f_bc').value;r.bT=+document.getElementById('f_bt').value;r.sa=+document.getElementById('f_sa').value;r.sC=+document.getElementById('f_sc').value;r.sT=+document.getElementById('f_st').value;r.tc=r.buyAmt+r.bC+r.bT;r.sp=r.sh?Math.round(r.sa/r.sh):0;r.gr=r.sa-r.tc;r.net=r.gr-r.sC-r.sT;r.rr=r.tc?Math.round(r.net/r.tc*10000)/100:0;saveD();closeModal();go('sec');}



function viewSlip(id){
  const j=D.journals.find(x=>x.id===id);
  if(!j)return;
  const drNm=acctNm(j.dr),crNm=acctNm(j.cr);
  showModal('전표 상세 ['+j.no+']',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">'+
    '<div><label style="font-size:10px;color:#64748b">전표번호</label><div style="font-weight:700;color:#2563eb">'+j.no+'</div></div>'+
    '<div><label style="font-size:10px;color:#64748b">일자</label><div>'+j.dt+(j.edt?' (증빙:'+j.edt+')':'')+'</div></div>'+
    '<div style="grid-column:1/-1"><label style="font-size:10px;color:#64748b">적요</label><div style="font-weight:600">'+j.desc+'</div></div>'+
    '</div>'+
    '<table style="margin-top:14px"><thead><tr><th>차/대</th><th>계정과목</th><th>코드</th><th class="r">금액</th></tr></thead>'+
    '<tbody>'+
    '<tr style="background:#dbeafe"><td style="color:#2563eb;font-weight:700">차변</td><td style="font-weight:600">'+drNm+'</td><td class="mu">'+j.dr+'</td><td class="r m b">'+fm(j.amt)+'</td></tr>'+
    '<tr style="background:#fee2e2"><td style="color:#dc2626;font-weight:700">대변</td><td style="font-weight:600">'+crNm+'</td><td class="mu">'+j.cr+'</td><td class="r m b">'+fm(j.amt)+'</td></tr>'+
    '</tbody></table>'+
    (j.vendor?'<div style="margin-top:8px;font-size:11px;color:#64748b">거래처: <b style="color:#d97706">'+j.vendor+'</b></div>':'')+(j.cur?'<div style="font-size:11px;color:#64748b">통화: '+j.cur+'</div>':'')+(j.taxCls?'<div style="font-size:11px;color:#64748b">소비세: '+j.taxCls+'</div>':'')+
    (j.exp?'<div style="font-size:11px;color:#64748b">원가구분: '+(j.exp==="s"?"판관비":j.exp==="c"?"매출원가":j.exp==="o"?"영업외":"특별")+'</div>':'')+
    '<div style="margin-top:16px;display:flex;gap:8px;justify-content:space-between">'+
    '<button class="bt" style="background:#dc2626" onclick="delSlip('+id+')">🗑</button>'+
    '<div style="display:flex;gap:6px"><button class="bt" style="background:#d97706" onclick="copySlip('+id+')">📋 복사</button><button class="bt" onclick="editSlip('+id+')">✏️ 수정</button><button class="bt gh" onclick="closeModal()">닫기</button></div>'+
    '</div>');
}
function delSlip(id){
  if(!confirm("이 전표를 삭제하시겠습니까?\n삭제하면 총계정원장과 재무제표에도 반영됩니다."))return;
  D.journals=D.journals.filter(x=>x.id!==id);
  saveD();closeModal();go("slip");
}


function exportWord(){
  const c=calc();
  const tI2=D.bkIn.reduce((s,d)=>s+d.amt,0);const tO2=D.bkOut.reduce((s,d)=>s+d.amt,0);
  const isSec2=cat=>{const c2=cat.toLowerCase();return c2.includes('증권')||c2.includes('주식')||c2.includes('매수')||c2.includes('매도')||c2.includes('이체')||c2.includes('ipo')||c2.includes('증거금');};
  const isCap2=cat=>{const c2=cat.toLowerCase();return c2.includes('자본')||c2.includes('출자')||c2.includes('차입');};
  const opIn2=D.bkIn.reduce((s,d)=>s+(!isSec2(d.cat)&&!isCap2(d.cat)?d.amt:0),0);
  const opOut2=D.bkOut.reduce((s,d)=>s+(!isSec2(d.cat)?d.amt:0),0);
  const S='border:1px solid #999;padding:4pt 6pt;font-size:10pt;';
  const HR=S+'text-align:right;';
  const HB=HR+'font-weight:bold;';
  const TH='background:#e8e8e8;font-weight:bold;font-size:9pt;padding:4pt 6pt;border:1px solid #999;';
  const THR=TH+'text-align:right;';
  const G='color:#059669;';const R='color:#dc2626;';const B='color:#2563eb;';
  const bg=v=>'<span style="display:inline-block;padding:1pt 5pt;border-radius:2pt;font-size:9pt;font-weight:bold;'+(v>=0?'background:#d1fae5;color:#059669':'background:#fee2e2;color:#dc2626')+'">'+(v>=0?'+':'')+fm(v)+'</span>';

  let jpRows='';
  D.holdJP.forEach((h,i)=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;const bg2=i%2?'background:#f5f5f5;':'';
    jpRows+='<tr><td style="'+S+bg2+B+'font-weight:bold">'+h.tk+'</td><td style="'+S+bg2+'">'+h.nm+'</td><td style="'+HR+bg2+'">'+fm(h.sh)+'</td><td style="'+HR+bg2+'">'+fm(h.buyAmt)+'</td><td style="'+HR+bg2+'color:#888">'+fm(h.fee)+'</td><td style="'+HB+bg2+'">'+fm(h.tc)+'</td><td style="'+HR+bg2+'">'+fm(h.bep)+'</td><td style="'+HR+bg2+'">'+(h.cp?fm(h.cp):'-')+'</td><td style="'+HB+bg2+'">'+fm(h.mv)+'</td><td style="'+HR+bg2+(pl>=0?G:R)+'font-weight:bold">'+fm(pl)+'</td><td style="'+HR+bg2+(pl>=0?G:R)+'">'+rr.toFixed(2)+'%</td></tr>';
  });
  const jpPl=c.jpMv-c.jpC;

  let usRows='';
  D.holdUS.forEach(h=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;
    usRows+='<tr><td style="'+S+B+'font-weight:bold">'+h.tk+'</td><td style="'+S+'">'+h.nm+'</td><td style="'+HR+'">'+fm(h.sh)+'</td><td style="'+HB+'">'+fm(h.tc)+'</td><td style="'+HR+'">'+h.cpUsd+'</td><td style="'+HR+'">'+(h.rate||SET.rates.USDJPY)+'</td><td style="'+HB+'">'+fm(h.mv)+'</td><td style="'+HR+(pl>=0?G:R)+'font-weight:bold">'+fm(pl)+'</td><td style="'+HR+(pl>=0?G:R)+'">'+rr.toFixed(2)+'%</td></tr>';
  });

  let realRows='';
  D.real.forEach((r,i)=>{const bg2=i%2?'background:#f5f5f5;':'';
    realRows+='<tr><td style="'+S+bg2+'color:#888">'+r.dt+'</td><td style="'+S+bg2+B+'font-weight:bold">'+r.tk+'</td><td style="'+S+bg2+'">'+r.nm+'</td><td style="'+HR+bg2+'">'+fm(r.sh)+'</td><td style="'+HR+bg2+'">'+fm(r.buyAmt)+'</td><td style="'+HR+bg2+'color:#888">'+fm(r.bC+r.bT)+'</td><td style="'+HB+bg2+'">'+fm(r.tc)+'</td><td style="'+HR+bg2+'">'+fm(r.sa)+'</td><td style="'+HR+bg2+'color:#888">'+fm(r.sC+r.sT)+'</td><td style="'+HR+bg2+G+'font-weight:bold">'+fm(r.net)+'</td><td style="'+HR+bg2+G+'">'+r.rr.toFixed(2)+'%</td></tr>';
  });

  let bkInRows='',cI=0;
  D.bkIn.forEach((d,i)=>{cI+=d.amt;const bg2=i%2?'background:#f5f5f5;':'';
    bkInRows+='<tr><td style="'+S+bg2+'color:#888">'+d.dt+'</td><td style="'+S+bg2+'">'+d.cat+'</td><td style="'+HR+bg2+G+'">'+fm(d.amt)+'</td><td style="'+HB+bg2+'">'+fm(cI)+'</td></tr>';});
  let bkOutRows='',cO=0;
  D.bkOut.forEach((d,i)=>{cO+=d.amt;const bg2=i%2?'background:#f5f5f5;':'';
    bkOutRows+='<tr><td style="'+S+bg2+'color:#888">'+d.dt+'</td><td style="'+S+bg2+'">'+d.cat+'</td><td style="'+HR+bg2+R+'">'+fm(d.amt)+'</td><td style="'+HR+bg2+'">'+fm(cO)+'</td></tr>';});

  const T='style="width:100%;border-collapse:collapse;margin-bottom:10pt"';
  const wordHTML=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>@page{size:A4 landscape;margin:12mm} body{font-family:'Malgun Gothic',sans-serif;font-size:11pt;color:#1a2030}</style></head>
<body>
<div style="text-align:center;margin-bottom:16pt"><div style="font-size:20pt;font-weight:bold;color:#1e3a5f">태성㈜ 자금운용보고서</div><div style="font-size:11pt;color:#666;margin-top:4pt">${rptDt()} 기준</div></div>

<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding-bottom:4pt">1. 총자산내역</h2>
<table ${T}><tr><td style="${TH}">구분</td><td style="${THR}">내역(엔)</td><td style="${TH}">비고</td></tr>
<tr><td style="${S}">자본금</td><td style="${HR}">${fm(acctBal("300"))}</td><td style="${S}"></td></tr>
<tr><td style="${S}background:#f5f5f5">수입</td><td style="${HR}background:#f5f5f5">${fm(opIn2)}</td><td style="${S}background:#f5f5f5"></td></tr>
<tr><td style="${S}">지출</td><td style="${HR}color:#dc2626">(${fm(opOut2)})</td><td style="${S}"></td></tr>
<tr><td style="${S}background:#f5f5f5;font-weight:bold">법인계좌잔액---(1)</td><td style="${HB}background:#f5f5f5">${fm(c.bb)}</td><td style="${S}background:#f5f5f5;color:#888">미츠이스미토모</td></tr>
<tr><td style="${S}">증권예수금</td><td style="${HR}">${fm(c.secDep)}</td><td style="${S}"></td></tr>
<tr><td style="${S}background:#f5f5f5">유가증권평가액</td><td style="${HR}background:#f5f5f5">${fm(c.allMv)}</td><td style="${S}background:#f5f5f5"></td></tr>
<tr><td style="${S}font-weight:bold">증권계좌잔액---(2)</td><td style="${HB}">${fm(c.secBal)}</td><td style="${S}color:#888">SMBC닛코증권</td></tr>
<tr><td style="${S}background:#e8e8e8;font-weight:bold">총보유자산합계</td><td style="${HB}background:#e8e8e8">${fm(c.totA)}</td><td style="${S}background:#e8e8e8;color:#888">(1)+(2)</td></tr></table>

<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding-bottom:4pt">2. 유가증권 평가 및 손익 현황</h2>
<table style="margin-bottom:8pt"><tr><td style="padding:4pt 8pt;font-size:10pt">총 평가액: <b>${fm(c.allMv)}</b></td><td style="padding:4pt 8pt;font-size:10pt">총 평가손익: <b style="${c.allPl>=0?G:R}">${fm(c.allPl)}</b></td><td style="padding:4pt 8pt;font-size:10pt">예수금: <b>${fm(c.secDep)}</b></td></tr></table>

<p style="font-weight:bold;font-size:11pt">가) 일본</p>
<table ${T}><tr><td style="${TH}">코드</td><td style="${TH}">종목명</td><td style="${THR}">수량</td><td style="${THR}">매수금액</td><td style="${THR}">수수료</td><td style="${THR}">취득원가</td><td style="${THR}">BEP</td><td style="${THR}">현재가</td><td style="${THR}">평가액</td><td style="${THR}">손익</td><td style="${THR}">수익률</td></tr>
${jpRows}
<tr><td colspan="3" style="${S}background:#e8e8e8;font-weight:bold;text-align:right">합계</td><td style="${HB}background:#e8e8e8">${fm(D.holdJP.reduce((s,h)=>s+h.buyAmt,0))}</td><td style="${HB}background:#e8e8e8">${fm(D.holdJP.reduce((s,h)=>s+h.fee,0))}</td><td style="${HB}background:#e8e8e8">${fm(c.jpC)}</td><td colspan="2" style="${S}background:#e8e8e8"></td><td style="${HB}background:#e8e8e8">${fm(c.jpMv)}</td><td style="${HB}background:#e8e8e8;${jpPl>=0?G:R}">${fm(jpPl)}</td><td style="${HB}background:#e8e8e8;${jpPl>=0?G:R}">${(jpPl/c.jpC*100).toFixed(2)}%</td></tr></table>

<p style="font-weight:bold;font-size:11pt">나) 미국</p>
<table ${T}><tr><td style="${TH}">코드</td><td style="${TH}">종목명</td><td style="${THR}">수량</td><td style="${THR}">취득원가</td><td style="${THR}">현재가(USD)</td><td style="${THR}">환율</td><td style="${THR}">평가액</td><td style="${THR}">손익</td><td style="${THR}">수익률</td></tr>${usRows}</table>

<p style="font-weight:bold;font-size:11pt">다) 전체</p>
<table ${T}><tr><td style="${TH}">구분</td><td style="${THR}">취득원가</td><td style="${THR}">평가금액</td><td style="${THR}">비중</td><td style="${THR}">손익</td><td style="${THR}">수익률</td></tr>
<tr><td style="${S}">일본</td><td style="${HR}">${fm(c.jpC)}</td><td style="${HR}">${fm(c.jpMv)}</td><td style="${HR}">${c.allMv?Math.round(c.jpMv/c.allMv*100):0}%</td><td style="${HR}${jpPl>=0?G:R}font-weight:bold">${fm(jpPl)}</td><td style="${HR}${jpPl>=0?G:R}">${(jpPl/c.jpC*100).toFixed(2)}%</td></tr>
<tr><td style="${S}background:#f5f5f5">미국</td><td style="${HR}background:#f5f5f5">${fm(c.usC)}</td><td style="${HR}background:#f5f5f5">${fm(c.usMv)}</td><td style="${HR}background:#f5f5f5">${c.allMv?Math.round(c.usMv/c.allMv*100):0}%</td><td style="${HR}background:#f5f5f5;${R}font-weight:bold">${fm(c.usMv-c.usC)}</td><td style="${HR}background:#f5f5f5;${R}">${((c.usMv-c.usC)/c.usC*100).toFixed(2)}%</td></tr>
<tr><td style="${S}background:#e8e8e8;font-weight:bold">합계</td><td style="${HB}background:#e8e8e8">${fm(c.allC)}</td><td style="${HB}background:#e8e8e8">${fm(c.allMv)}</td><td style="${HB}background:#e8e8e8">100%</td><td style="${HB}background:#e8e8e8;${c.allPl>=0?G:R}">${fm(c.allPl)}</td><td style="${HB}background:#e8e8e8;${c.allPl>=0?G:R}">${(c.allPl/c.allC*100).toFixed(2)}%</td></tr></table>

<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding-bottom:4pt">3. 수익실현내역</h2>
<table ${T}><tr><td style="${TH}">확정일</td><td style="${TH}">코드</td><td style="${TH}">종목명</td><td style="${THR}">수량</td><td style="${THR}">매수금액</td><td style="${THR}">수수료</td><td style="${THR}">취득원가</td><td style="${THR}">매도금액</td><td style="${THR}">매도수수료</td><td style="${THR}">순수익</td><td style="${THR}">수익률</td></tr>
${realRows}
<tr><td colspan="4" style="${S}background:#e8e8e8;font-weight:bold;text-align:right">합계</td><td style="${HB}background:#e8e8e8">${fm(D.real.reduce((s,r)=>s+r.buyAmt,0))}</td><td style="${HB}background:#e8e8e8">${fm(D.real.reduce((s,r)=>s+r.bC+r.bT,0))}</td><td style="${HB}background:#e8e8e8">${fm(c.rC)}</td><td style="${HB}background:#e8e8e8">${fm(c.rS)}</td><td style="${HB}background:#e8e8e8">${fm(D.real.reduce((s,r)=>s+r.sC+r.sT,0))}</td><td style="${HB}background:#e8e8e8;${G}">${fm(c.rpl)}</td><td style="${HB}background:#e8e8e8;${G}">${(c.rpl/c.rC*100).toFixed(2)}%</td></tr></table>

<h2 style="font-size:13pt;color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding-bottom:4pt">4. 은행 법인 계좌 상세 내역</h2>
<table style="width:48%;border-collapse:collapse;float:left;margin-right:2%"><tr><td colspan="4" style="${TH}${G}">입금 상세내역</td></tr><tr><td style="${TH}">일자</td><td style="${TH}">구분</td><td style="${THR}">입금액</td><td style="${THR}">누적</td></tr>${bkInRows}</table>
<table style="width:48%;border-collapse:collapse;float:left"><tr><td colspan="4" style="${TH}${R}">출금 상세내역</td></tr><tr><td style="${TH}">일자</td><td style="${TH}">구분</td><td style="${THR}">출금액</td><td style="${THR}">누적</td></tr>${bkOutRows}
<tr><td colspan="2" style="${S}background:#e8e8e8;font-weight:bold;text-align:right">잔액</td><td colspan="2" style="${HB}background:#e8e8e8;color:#2563eb;font-size:12pt">${fm(c.bb)}</td></tr></table>
<div style="clear:both"></div>
<br><p style="color:#999;font-size:9pt;text-align:center">본 보고서는 태성㈜ 재무관리 프로그램에서 자동 생성되었습니다.</p>
</body></html>`;

  const blob=new Blob([wordHTML],{type:'application/msword'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='태성_자금운용보고서_'+new Date().toISOString().slice(0,10)+'.doc';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function updatePrices(){
  let rows = D.holdJP.map(h=>`<tr>
    <td class="b bl">${h.tk}</td><td>${h.nm}</td><td class="r m">${fm(h.sh)}</td>
    <td class="r m mu">${fm(h.cp)}</td>
    <td class="r"><input type="number" id="up_${h.id}" value="${h.cp}" style="width:90px;padding:4px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px;text-align:right"></td>
    <td class="r m">${fm(h.mv)}</td></tr>`).join('');
  let usRows = D.holdUS.map(h=>`<tr style="background:#f0f9ff">
    <td class="b bl">${h.tk}</td><td>${h.nm} 🇺🇸</td><td class="r m">${fm(h.sh)}</td>
    <td class="r m mu">${h.cpUsd}</td>
    <td class="r"><input type="number" id="upu_${h.id}" value="${h.cpUsd}" step="0.01" style="width:90px;padding:4px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px;text-align:right"></td>
    <td class="r m">${fm(h.mv)}</td></tr>`).join('');
  showModal('📊 시세 업데이트 (현재가 일괄수정)',`
    <div style="font-size:11px;color:#64748b;margin-bottom:10px">각 종목의 현재가를 입력하고 [일괄 적용]을 누르세요</div>
    <table><thead><tr><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">기존 현재가</th><th class="r">새 현재가</th><th class="r">기존 평가액</th></tr></thead>
    <tbody>${rows}${usRows}</tbody></table>
    <div style="margin-top:10px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px">
      <div style="display:flex;align-items:center;gap:10px;font-size:12px">
        <span>🇺🇸 USD/JPY 환율:</span>
        <input type="number" id="up_rate" value="${SET.rates.USDJPY}" step="0.000001" style="width:120px;padding:4px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px;text-align:right">
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
      <button class="bt gh" onclick="closeModal()">취소</button>
      <button class="bt gn" onclick="applyPrices()">✓ 일괄 적용</button>
    </div>`);
}
function applyPrices(){
  let changed = 0;
  D.holdJP.forEach(h=>{
    const el = document.getElementById('up_'+h.id);
    if(el){
      const newCp = +el.value;
      if(newCp !== h.cp){
        h.cp = newCp;
        h.mv = h.sh * newCp;
        changed++;
      }
    }
  });
  const newRate = +document.getElementById('up_rate').value;
  if(newRate !== SET.rates.USDJPY){
    SET.rates.USDJPY = newRate;
    saveS();
  }
  D.holdUS.forEach(h=>{
    const el = document.getElementById('upu_'+h.id);
    if(el){
      const newCpUsd = +el.value;
      if(newCpUsd !== h.cpUsd){
        h.cpUsd = newCpUsd;
        h.rate = newRate;
        h.mv = Math.round(h.sh * newCpUsd * newRate);
        changed++;
      }
    }
  });
  saveD();
  closeModal();
  go('sec');
  alert(changed + '종목 현재가가 업데이트되었습니다.');
}

// ===== SLIP (전표처리) =====
function addSlipRow(){const tb=document.getElementById('slipRows');const id=nid();tb.insertAdjacentHTML('beforeend','<tr id="sr_'+id+'"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px"><option value="dr">차변</option><option value="cr">대변</option></select></td><td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%">'+acctOptions()+'</select></td><td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td><td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td><td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td><td><button class="del" onclick="document.getElementById(\'sr_'+id+'\').remove();updSlipBal()">✕</button></td></tr>');}
function acctOptions(){return '<option value="">--</option>'+["자산","부채","순자산","수익","비용"].map(g=>`<optgroup label="${g}">${D.accts.filter(a=>a.g===g).map(a=>`<option value="${a.c}">${a.c} ${a.k}</option>`).join('')}</optgroup>`).join('');}
function updSlipBal(){let dr=0,cr=0;document.querySelectorAll('#slipRows tr').forEach(r=>{const s=r.querySelector('.sl_side').value,a=+(r.querySelector('.sl_amt').value)||0;if(s==='dr')dr+=a;else cr+=a;});const ok=dr===cr&&dr>0;document.getElementById('slipBal').innerHTML='<span>차변: <b>'+fm(dr)+'</b></span><span>대변: <b>'+fm(cr)+'</b></span><span style="font-weight:700;color:'+(ok?'#059669':'#dc2626')+'">'+(ok?'✓ 차대일치':'✗ 불일치')+'</span>';document.getElementById('slipSubmit').style.background=ok?'#059669':'#94a3b8';}
function submitSlip(){var vsel=document.getElementById("sl_vendor_sel"),vinp=document.getElementById("sl_vendor_inp");var vendor=(vsel&&vsel.value)?vsel.value:(vinp?vinp.value:"");if(vendor)addVendor(vendor);let dr=0,cr=0;const rows=[];document.querySelectorAll('#slipRows tr').forEach(r=>{const s=r.querySelector('.sl_side').value,ac=r.querySelector('.sl_acct').value,a=+(r.querySelector('.sl_amt').value)||0,exp=r.querySelector('.sl_exp')?.value||'',taxr=r.querySelector('.sl_taxr')?.value||'0';var txC=r.querySelector('.sl_taxcls');var taxCls=txC?txC.value:'';if(ac&&a>0){rows.push({side:s,ac,amt:a,exp,taxr,taxCls});if(s==='dr')dr+=a;else cr+=a;}});if(dr!==cr||dr===0)return alert('차대가 일치하지 않습니다');const edt=document.getElementById('sl_edt').value,pdt=document.getElementById('sl_pdt').value,desc=document.getElementById('sl_desc').value,cur=document.getElementById('sl_cur').value;const mo=edt.split('-')[1]||'01';const dt=mo+'/'+edt.split('-')[2];const no='S'+String(D.journals.length+1).padStart(4,'0');const drRows=rows.filter(r=>r.side==='dr'),crRows=rows.filter(r=>r.side==='cr');drRows.forEach(d=>{crRows.forEach(c=>{const ratio=c.amt/cr,amt=Math.round(d.amt*ratio);var tC=d.taxCls||c.taxCls||'';if(window._editSlipId){var ej=D.journals.find(x=>x.id===window._editSlipId);if(ej){ej.dt=dt;ej.desc=desc;ej.dr=d.ac;ej.cr=c.ac;ej.amt=amt;ej.edt=edt;ej.pdt=pdt;ej.cur=cur;ej.exp=d.exp||c.exp;ej.vendor=vendor;ej.taxCls=tC;}window._editSlipId=null;}else{D.journals.push({id:nid(),dt,no,desc,dr:d.ac,cr:c.ac,amt,edt,pdt,cur,exp:d.exp||c.exp,vendor:vendor,taxCls:tC});}});});saveD();go('slip');}
function addAcct(){showModal('계정과목 추가',`<div class="fg"><div><label>코드</label><input id="fa_c"></div><div><label>과목명(한국어)</label><input id="fa_k"></div><div><label>과목명(일본어)</label><input id="fa_n"></div><div><label>구분</label><select id="fa_g"><option value="자산">자산</option><option value="부채">부채</option><option value="순자산">순자산</option><option value="수익">수익</option><option value="비용">비용</option></select></div><div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt" onclick="doAddAcct()">추가</button></div><div class="full" style="font-size:10px;color:#64748b">현재 ${D.accts.length}개 과목</div></div>`);}
function doAddAcct(){const c=document.getElementById('fa_c').value,k=document.getElementById('fa_k').value,n=document.getElementById('fa_n').value||k,g=document.getElementById('fa_g').value;if(!c||!k)return alert('코드와 과목명을 입력하세요');D.accts.push({c,n,k,g});saveD();closeModal();go('slip');}

function rSlip(){
  // Group journals by year-month
  const grouped={};
  D.journals.forEach(j=>{
    const ym=j.dt.replace(/\/.*$/,'').replace(/^(\d+)\/(\d+)$/,'$1/$2');
    // Extract month key
    let mk='기타';
    const m=j.dt.match(/(\d+)\//);
    if(m){const mon=parseInt(m[1]);mk=mon>=6?'2025/'+(mon<10?'0'+mon:mon):'2026/'+(mon<10?'0'+mon:mon);}
    if(j.dt.includes('5/31'))mk='2026/05(결산)';
    if(!grouped[mk])grouped[mk]=[];
    grouped[mk].push(j);
  });
  const sortedKeys=Object.keys(grouped).sort();

  // Slip list with year/month tabs
  const monthBtns=sortedKeys.map(k=>'<button class="bt gh" style="font-size:10px;margin:2px" onclick="filterSlips(\''+k+'\')">'+k+' ('+grouped[k].length+')</button>').join('');

  let allSlips='';
  sortedKeys.forEach(mk=>{
    allSlips+='<div class="slip-month" data-month="'+mk+'"><div style="padding:8px 12px;background:#dbeafe;font-weight:700;font-size:12px;color:#1e3a5f;border-bottom:1px solid #e2e6ed">📅 '+mk+' ('+grouped[mk].length+'건)</div>';
    grouped[mk].forEach(e=>{
      const drNm=acctNm(e.dr),crNm=acctNm(e.cr);
      allSlips+='<div onclick="viewSlip('+e.id+')" style="padding:6px 14px;border-bottom:1px solid #f1f3f6;font-size:11px;display:flex;gap:8px;align-items:center;cursor:pointer" onmouseenter="this.style.background=\'#f0f9ff\'" onmouseleave="this.style.background=\'\'">'+
        '<span class="mu" style="width:50px">'+e.dt+'</span>'+
        '<span style="color:#2563eb;width:55px;font-size:10px">'+e.no+'</span>'+
        '<span style="width:180px;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</span>'+
        '<span style="color:#2563eb;width:120px">차 '+drNm+'</span>'+
        '<span style="color:#dc2626;width:120px">대 '+crNm+'</span>'+
        '<span class="m" style="width:90px;text-align:right;font-weight:600">'+fm(e.amt)+'</span>'+
        '</div>';
    });
    allSlips+='</div>';
  });

  return '<div class="pt">전표처리</div>'+
  '<div class="ib">💡 전표 '+D.journals.length+'건 등록 | 전표 → 총계정원장 → 재무제표 자동연동</div>'+
  '<div class="pn" style="padding:14px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #1e3a5f">'+
      '<span style="font-size:16px;font-weight:700;color:#1e3a5f">대체전표</span>'+
      '<div style="border:2px solid #1e3a5f;border-radius:6px;padding:3px 10px;text-align:center"><div style="font-size:7px;color:#64748b">결재</div><div style="font-size:11px;font-weight:700;color:#1e3a5f">본인전결</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">'+
      '<div class="fg"><div><label>증빙일자</label><input type="date" id="sl_edt" value="'+new Date().toISOString().slice(0,10)+'"></div></div>'+
      '<div class="fg"><div><label>전기일자</label><input type="date" id="sl_pdt" value="'+new Date().toISOString().slice(0,10)+'"></div></div>'+
      '<div class="fg"><div><label>적요</label><input id="sl_desc" placeholder="거래 내용"></div></div>'+
      '<div class="fg"><div><label>통화</label><select id="sl_cur"><option value="JPY">🇯🇵 JPY</option><option value="KRW">🇰🇷 KRW</option><option value="USD">🇺🇸 USD</option></select></div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div class="fg"><div><label>거래처</label><select id="sl_vendor_sel" onchange="var i=document.getElementById(\'sl_vendor_inp\');if(i){i.style.display=this.value?\'none\':\'block\';i.value=this.value;}">'+vendorOptions('')+'</select></div></div><div class="fg"><div><label>직접입력</label><input id="sl_vendor_inp" placeholder="거래처명"></div></div></div>'+
    '<table><thead><tr><th>차/대</th><th>계정과목</th><th>원가구분</th><th>소비세</th><th class="r">금액</th><th></th></tr></thead>'+
    '<tbody id="slipRows">'+
      '<tr id="sr_1"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;background:#dbeafe"><option value="dr">차변</option><option value="cr">대변</option></select></td>'+
      '<td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%">'+acctOptions()+'</select></td>'+
      '<td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td>'+
      '<td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td>'+
      '<td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td>'+
      
      '<td></td></tr>'+
      '<tr id="sr_2"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;background:#fee2e2"><option value="cr">대변</option><option value="dr">차변</option></select></td>'+
      '<td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%">'+acctOptions()+'</select></td>'+
      '<td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td>'+
      '<td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td>'+
      '<td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td>'+
      
      '<td></td></tr>'+
    '</tbody></table>'+
    '<div style="margin-top:8px;display:flex;gap:6px"><button class="bt gh" style="font-size:10px" onclick="addSlipRow()">+ 행추가</button><button class="bt gh" style="font-size:10px" onclick="addAcct()">+ 과목추가</button><button class="bt gh" style="font-size:10px" onclick="manageVendors()">👤 거래처</button></div>'+
    '<div id="slipBal" style="margin-top:10px;padding:6px 10px;background:#fee2e2;border-radius:6px;font-size:11px;display:flex;justify-content:space-between"><span>차변: <b>0</b></span><span>대변: <b>0</b></span><span style="font-weight:700;color:#dc2626">✗ 불일치</span></div>'+
    '<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="bt" id="slipSubmit" style="background:#94a3b8" onclick="submitSlip()">승인·기표</button></div>'+
  '</div>'+
  '<div class="pn" style="margin-top:16px"><div class="ph"><span>전표일람 ('+D.journals.length+'건)</span></div>'+
  '<div style="padding:8px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #e2e6ed">'+
    '<span style="font-size:11px;font-weight:600">회기:</span>'+
    '<select style="padding:4px 6px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px"><option>제1기 (2025.06~2026.05)</option></select>'+
    '<span style="font-size:11px;font-weight:600">월:</span>'+
    '<select id="slip_mo" onchange="filterSlipsByMonth()" style="padding:4px 6px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px">'+
    '<option value=\'all\'>전체 ('+D.journals.length+')</option>'+
    sortedKeys.map(k=>'<option value=\''+k+'\'>'+k+' ('+grouped[k].length+')</option>').join('')+
    '</select>'+
  '</div>'+
  '<div id="slipListBody" style="max-height:500px;overflow-y:auto">'+allSlips+'</div>'+
  '</div>';
}

function filterSlipsByMonth(){const v=document.getElementById('slip_mo').value;filterSlips(v);}
function filterSlips(month){
  document.querySelectorAll('.slip-month').forEach(el=>{
    el.style.display=(month==='all'||el.dataset.month===month)?'block':'none';
  });
}


// ===== Vendor Management =====
function vendorOptions(sel){if(!D.vendors)D.vendors=[];return '<option value="">(직접입력)</option>'+D.vendors.map(v=>'<option value="'+v.name+'"'+(v.name===sel?' selected':'')+'>'+v.name+'</option>').join('');}
function addVendor(nm){if(!D.vendors)D.vendors=[];if(nm&&!D.vendors.find(v=>v.name===nm)){D.vendors.push({id:nid(),name:nm,note:''});saveD();}}
function manageVendors(){showModal('거래처 관리','<div style="margin-bottom:10px;display:flex;gap:6px"><input id="vn_n" placeholder="거래처명" style="flex:1;padding:5px 8px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px"><input id="vn_t" placeholder="비고" style="width:80px;padding:5px 8px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px"><button class="bt gn" onclick="doAddV()">추가</button></div><table><thead><tr><th>거래처</th><th>비고</th><th></th></tr></thead><tbody>'+D.vendors.map(v=>'<tr><td>'+v.name+'</td><td class="mu">'+(v.note||'')+'</td><td><button class="del" onclick="delV('+v.id+')">✕</button></td></tr>').join('')+'</tbody></table>');}
function doAddV(){var n=document.getElementById('vn_n').value,t=document.getElementById('vn_t').value;if(!n)return;D.vendors.push({id:nid(),name:n,note:t});saveD();manageVendors();}
function delV(id){D.vendors=D.vendors.filter(v=>v.id!==id);saveD();manageVendors();}

// ===== Slip Edit/Copy =====
function editSlip(id){var j=D.journals.find(x=>x.id===id);if(!j)return;closeModal();window._editSlipId=id;go('slip');setTimeout(function(){var e=document.getElementById('sl_edt');if(e)e.value=j.edt||'';var p=document.getElementById('sl_pdt');if(p)p.value=j.pdt||'';var d2=document.getElementById('sl_desc');if(d2)d2.value=j.desc||'';var c2=document.getElementById('sl_cur');if(c2)c2.value=j.cur||'JPY';var vs=document.getElementById('sl_vendor_sel');if(vs)vs.value=j.vendor||'';var vi=document.getElementById('sl_vendor_inp');if(vi){vi.value=j.vendor||'';vi.style.display=vs&&vs.value?'none':'block';}var rows=document.querySelectorAll('#slipRows tr');if(rows[0]){rows[0].querySelector('.sl_side').value='dr';rows[0].querySelector('.sl_acct').value=j.dr;rows[0].querySelector('.sl_amt').value=j.amt;var tc=rows[0].querySelector('.sl_taxcls');if(tc)tc.value=j.taxCls||'';}if(rows[1]){rows[1].querySelector('.sl_side').value='cr';rows[1].querySelector('.sl_acct').value=j.cr;rows[1].querySelector('.sl_amt').value=j.amt;}updSlipBal();var sb=document.getElementById('slipSubmit');if(sb){sb.textContent='수정 저장';sb.style.background='#2563eb';}},300);}

function copySlip(id){var j=D.journals.find(x=>x.id===id);if(!j)return;closeModal();window._editSlipId=null;go('slip');setTimeout(function(){var d2=document.getElementById('sl_desc');if(d2)d2.value=(j.desc||'')+' (복사)';var c2=document.getElementById('sl_cur');if(c2)c2.value=j.cur||'JPY';var vs=document.getElementById('sl_vendor_sel');if(vs)vs.value=j.vendor||'';var vi=document.getElementById('sl_vendor_inp');if(vi){vi.value=j.vendor||'';vi.style.display=vs&&vs.value?'none':'block';}var rows=document.querySelectorAll('#slipRows tr');if(rows[0]){rows[0].querySelector('.sl_side').value='dr';rows[0].querySelector('.sl_acct').value=j.dr;rows[0].querySelector('.sl_amt').value=j.amt;}if(rows[1]){rows[1].querySelector('.sl_side').value='cr';rows[1].querySelector('.sl_acct').value=j.cr;rows[1].querySelector('.sl_amt').value=j.amt;}updSlipBal();},300);}

function saveDeposit(){
  var el=document.getElementById('depEdit');
  if(!el)return;
  var raw=el.textContent.replace(/[,\s]/g,'');
  var val=parseInt(raw);
  if(!isNaN(val)&&val>=0){
    D.secDeposit=val;
    saveD();
    el.textContent=fm(val);
    alert('증권예수금 저장: ¥'+fm(val));
    go('sec');
  }
}
function calcSlipTax(sel){
  const tr=sel.closest('tr');
  const amt=+(tr.querySelector('.sl_amt').value)||0;
  const rate=sel.value==='10k'?10:parseInt(sel.value)||0;
  const tax=Math.round(amt*rate/100);
  tr.querySelector('.sl_taxamt').textContent=tax?fm(tax):'0';
}

function acctNm(c){return tAcct(c);}

// ===== GENERAL LEDGER (총계정원장) =====
function rGL(){
  // Compute balances from journals
  const bal={};
  D.journals.forEach(j=>{
    if(!bal[j.dr])bal[j.dr]={dr:0,cr:0,entries:[]};
    if(!bal[j.cr])bal[j.cr]={dr:0,cr:0,entries:[]};
    bal[j.dr].dr+=j.amt;bal[j.dr].entries.push({...j,isDr:true});
    bal[j.cr].cr+=j.amt;bal[j.cr].entries.push({...j,isDr:false});
  });
  const groups={};
  Object.entries(bal).forEach(([code,v])=>{
    const a=D.accts.find(x=>x.c===code);if(!a)return;
    const isDb=["자산","비용"].includes(a.g);
    v.net=isDb?v.dr-v.cr:v.cr-v.dr;
    if(!groups[a.g])groups[a.g]=[];
    groups[a.g].push({code,name:a.k,...v});
  });

  if(D.journals.length===0){
    return `<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">총계정원장</div><button class="bt" onclick="exportGLExcel()" style="background:#059669;font-size:11px">📥 엑셀 내보내기 (日本語)</button></div>
    <div class="ib">💡 전표를 기표하면 여기에 계정별로 자동 집계됩니다</div>
    <div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:40px;margin-bottom:12px">📒</div><div>아직 기표된 전표가 없습니다.<br>[전표처리] 메뉴에서 전표를 입력하세요.</div></div>`;}

  return `<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">총계정원장</div><button class="bt" onclick="exportGLExcel()" style="background:#059669;font-size:11px">📥 엑셀 내보내기 (日本語)</button></div>
  <div class="ib">💡 전표 ${D.journals.length}건에서 자동 집계. 계정을 클릭하면 상세 내역을 표시합니다.</div>
  ${["자산","부채","순자산","수익","비용"].filter(g=>groups[g]).map(g=>`
    <div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:6px;padding:3px 8px;background:#dbeafe;border-radius:5px;display:inline-block">${g}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px">
    ${groups[g].map(a=>`<div onclick="showGLDetail('${a.code}')" style="background:#fff;border:1px solid #e2e6ed;border-radius:7px;padding:8px 12px;cursor:pointer" onmouseenter="this.style.borderColor='#2563eb'" onmouseleave="this.style.borderColor='#e2e6ed'"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;font-weight:600">${a.name}</div><div style="font-size:9px;color:#64748b">${a.code} · ${a.entries.length}건</div></div><div style="font-size:13px;font-weight:700;font-feature-settings:'tnum'">${fy(a.net)}</div></div></div>`).join('')}
    </div></div>`).join('')}`;}

function showGLDetail(code){
  const a=D.accts.find(x=>x.c===code);if(!a)return;
  const isDb=["자산","비용"].includes(a.g);
  const entries=[];let bal=0;
  D.journals.filter(j=>j.dr===code||j.cr===code).forEach(j=>{
    const isDr=j.dr===code;const dr=isDr?j.amt:0;const cr=isDr?0:j.amt;
    bal+=isDb?(dr-cr):(cr-dr);
    entries.push({dt:j.dt,no:j.no,desc:j.desc,dr,cr,bal});
  });
  showModal(`【${a.k}】 원장 (잔액: ${fy(bal)})`,`
    <table><thead><tr><th>날짜</th><th>전표</th><th>적요</th><th class="r">차변</th><th class="r">대변</th><th class="r">잔액</th></tr></thead>
    <tbody>${entries.map((e,i)=>`<tr class="${i%2?'a':''}"><td class="mu m">${e.dt}</td><td class="bl">${e.no}</td><td>${e.desc||''}</td><td class="r m">${e.dr?fm(e.dr):''}</td><td class="r m">${e.cr?fm(e.cr):''}</td><td class="r m b">${fm(e.bal)}</td></tr>`).join('')}</tbody></table>`);
}

// ===== PAGES =====


// Fiscal year: June~May. Period 1 = 2025/06~2026/05, Period 2 = 2026/06~2027/05...
function getFiscalPeriod(dt){
  const m=dt.match(/(\d+)\//);if(!m)return{ki:1,mo:'05'};
  const mon=parseInt(m[1]);
  // FY starts June. 6~12 = first half, 1~5 = second half of same FY
  if(mon>=6)return{ki:1,yr:'2025',mo:String(mon).padStart(2,'0')};
  else return{ki:1,yr:'2026',mo:String(mon).padStart(2,'0')};
}
function getFiscalMonths(ki){
  // For now just 1기. Later can add 2기 etc.
  return [{v:'all',l:'전체'},{v:'06',l:'6월'},{v:'07',l:'7월'},{v:'08',l:'8월'},{v:'09',l:'9월'},{v:'10',l:'10월'},{v:'11',l:'11월'},{v:'12',l:'12월'},{v:'01',l:'1월'},{v:'02',l:'2월'},{v:'03',l:'3월'},{v:'04',l:'4월'},{v:'05',l:'5월(결산)'}];
}
function journalMatchMonth(j,mo){
  if(mo==='all')return true;
  const m=j.dt.match(/(\d+)\//);if(!m)return mo==='05';
  return String(parseInt(m[1])).padStart(2,'0')===mo;
}

function rJrn(){
  // Get all unique year-months
  const yms=new Set();
  D.journals.forEach(j=>{
    const m=j.dt.match(/(\d+)\//);
    if(m){const mon=parseInt(m[1]);const yr=mon>=6?'2025':'2026';yms.add(yr+'/'+String(mon).padStart(2,'0'));}
  });
  if(D.journals.some(j=>j.dt.includes('5/31')))yms.add('2026/05');
  const sortedYMs=[...yms].sort();

  // Build year-month selector
  const ymOpts=sortedYMs.map(ym=>'<option value="'+ym+'">'+ym+'</option>').join('');

  return '<div class="pt">전표조회</div>'+
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:#fff;border:1px solid #e2e6ed;border-radius:9px">'+
    '<span style="font-size:12px;font-weight:600">회기:</span>'+
    '<select id="jrn_ki" onchange="onKiChange()" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">'+
    '<option value="1">제1기 (2025.06~2026.05)</option>'+
    '<option value="2">제2기 (2026.06~2027.05)</option>'+
    '</select>'+
    '<span style="font-size:12px;font-weight:600;margin-left:8px">월:</span>'+
    '<select id="jrn_mo" onchange="filterJrn()" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">'+
    getFiscalMonths(1).map(m=>'<option value="'+m.v+'">'+m.l+'</option>').join('')+
    '</select>'+
    '<span style="font-size:12px;font-weight:600;margin-left:8px">계정:</span>'+
    '<select id="jrn_acct" onchange="filterJrn()" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">'+
    '<option value="all">전체</option>'+
    D.accts.map(a=>'<option value="'+a.c+'">'+a.c+' '+a.k+'</option>').join('')+
    '</select>'+
    '<span style="font-size:12px;font-weight:600;margin-left:8px">거래처:</span>'+
    '<select id="jrn_vendor" onchange="filterJrn()" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">'+
    '<option value="all">전체</option>'+
    (D.vendors||[]).map(v=>'<option value="'+v.name+'">'+v.name+'</option>').join('')+
    '</select>'+
    '</div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:8px 14px;background:#fff;border:1px solid #e2e6ed;border-radius:9px">'+
    '<span style="font-size:12px;font-weight:600">🔍 검색:</span>'+
    '<input id="jrn_search" oninput="filterJrn()" placeholder="적요, 전표번호 검색..." style="flex:1;padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">'+
    '<span id="jrn_count" style="font-size:11px;color:#64748b">'+D.journals.length+'건</span>'+
    '</div>'+
    '<div class="pn"><div id="jrnBody" style="max-height:600px;overflow-y:auto">'+buildJrnTable(D.journals)+'</div></div>';
}

function buildJrnTable(list){
  if(list.length===0)return '<div style="padding:30px;text-align:center;color:#64748b">해당 조건의 전표가 없습니다</div>';
  let rows='';let totalDr=0;
  list.forEach((e,i)=>{
    totalDr+=e.amt;
    rows+='<tr class="'+(i%2?'a':'')+'" onclick="viewSlip('+e.id+')" style="cursor:pointer" onmouseenter="this.style.background=\'#f0f9ff\'" onmouseleave="this.style.background=\''+( i%2?'#f8f9fb':'')+'\'">';
    rows+='<td class="mu m" style="width:50px">'+e.dt+'</td>';
    rows+='<td style="width:55px;color:#2563eb;font-size:10px">'+e.no+'</td>';
    rows+='<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+e.desc+(e.vendor?' <span style="color:#d97706;font-size:9px">['+e.vendor+']</span>':'')+'</td>';
    rows+='<td style="color:#2563eb">'+acctNm(e.dr)+'</td>';
    rows+='<td style="color:#dc2626">'+acctNm(e.cr)+'</td>';
    rows+='<td class="r m b">'+fm(e.amt)+'</td></tr>';
  });
  return '<table><thead><tr><th>일자</th><th>전표</th><th>적요</th><th>차변</th><th>대변</th><th class="r">금액</th></tr></thead><tbody>'+rows+'</tbody>'+
    '<tr class="t"><td colspan="5" class="r">합계 ('+list.length+'건)</td><td class="r m">'+fm(totalDr)+'</td></tr></table>';
}

function onKiChange(){
  // Future: load different fiscal year data
  filterJrn();
}
function filterJrn(){
  const mo=document.getElementById('jrn_mo').value;
  const acct=document.getElementById('jrn_acct').value;
  const vendor=document.getElementById('jrn_vendor')?document.getElementById('jrn_vendor').value:'all';
  const search=(document.getElementById('jrn_search')?document.getElementById('jrn_search').value:'').toLowerCase();
  let filtered=D.journals;
  if(mo!=='all'){
    filtered=filtered.filter(j=>journalMatchMonth(j,mo));
  }
  if(acct!=='all'){
    filtered=filtered.filter(j=>j.dr===acct||j.cr===acct);
  }
  if(vendor!=='all'){
    filtered=filtered.filter(j=>j.vendor===vendor);
  }
  if(search){
    filtered=filtered.filter(j=>(j.desc||'').toLowerCase().includes(search)||(j.no||'').toLowerCase().includes(search)||(j.vendor||'').toLowerCase().includes(search));
  }
  document.getElementById('jrnBody').innerHTML=buildJrnTable(filtered);
  document.getElementById('jrn_count').textContent=filtered.length+'건';
}


function rDash(){saveSnapshot();const c=calc();return `<div class="pt">대시보드</div>
  <div class="cards"><div class="cd bl"><div class="l">총 보유 자산</div><div class="v">${fy(c.totA)}</div></div><div class="cd go"><div class="l">법인계좌</div><div class="v">${fy(c.bb)}</div></div><div class="cd bl"><div class="l">증권계좌</div><div class="v">${fy(c.secBal)}</div></div><div class="cd gn"><div class="l">실현손익</div><div class="v">+${fy(c.rpl)}</div></div></div>
  <div class="cards"><div class="cd bl"><div class="l">유가증권평가액</div><div class="v">${fy(c.allMv)}</div></div><div class="cd ${c.allPl>=0?'gn':'rd'}"><div class="l">평가손익</div><div class="v">${fy(c.allPl)}</div></div><div class="cd ${c.rpl+c.allPl>=0?'gn':'rd'}"><div class="l">총합손익</div><div class="v">${fy(c.rpl+c.allPl)}</div></div></div>
  <div class="pn" style="margin-top:14px">
    <div class="ph"><span>📈 자산추이</span>
      <div style="display:flex;gap:4px">
        <button class="bt gh" style="font-size:10px;padding:2px 8px" onclick="document.getElementById('trendChart').innerHTML=renderTrendChart('week')">주</button>
        <button class="bt gh" style="font-size:10px;padding:2px 8px" onclick="document.getElementById('trendChart').innerHTML=renderTrendChart('month')">월</button>
        <button class="bt gh" style="font-size:10px;padding:2px 8px" onclick="document.getElementById('trendChart').innerHTML=renderTrendChart('quarter')">분기</button>
        <button class="bt gh" style="font-size:10px;padding:2px 8px" onclick="document.getElementById('trendChart').innerHTML=renderTrendChart('half')">반기</button>
        <button class="bt gh" style="font-size:10px;padding:2px 8px" onclick="document.getElementById('trendChart').innerHTML=renderTrendChart('year')">년</button>
      </div>
    </div>
    <div style="padding:14px" id="trendChart">\</div>
  </div>`;}


// ===== 결산 자동화: 평가손 조정전표 =====
function autoEvalAdjust(){
  const c=calc();
  const marketEvalLoss=Math.max(0, c.allC - c.allMv); // 시가기준 평가손
  const journalEvalLoss=acctBal('542'); // 전표상 평가손
  const diff=marketEvalLoss-journalEvalLoss;
  
  if(diff===0){
    alert('조정 불필요\n\n전표 평가손: '+fm(journalEvalLoss)+'\n시가 평가손: '+fm(marketEvalLoss)+'\n\n차이: 0');
    return;
  }
  
  const info='평가손 조정전표 생성\n\n'+
    '전표상 평가손: '+fm(journalEvalLoss)+'\n'+
    '시가기준 평가손: '+fm(marketEvalLoss)+'\n'+
    '조정액: '+fm(Math.abs(diff))+'\n\n';
  
  if(diff>0){
    // 평가손 증가: DR 유가증권평가손(542) / CR 유가증권(130)
    if(!confirm(info+'평가손 증가 → 전표 생성:\n차변: 유가증권평가손(542) '+fm(diff)+'\n대변: 유가증권(130) '+fm(diff)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'ADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 유가증권평가손 추가인식',dr:'542',cr:'130',amt:diff});
  } else {
    // 평가손 감소(환입): DR 유가증권(130) / CR 유가증권평가손(542)
    var absDiff=Math.abs(diff);
    if(!confirm(info+'평가손 감소(환입) → 전표 생성:\n차변: 유가증권(130) '+fm(absDiff)+'\n대변: 유가증권평가손(542) '+fm(absDiff)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'ADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 유가증권평가손 환입',dr:'130',cr:'542',amt:absDiff});
  }
  saveD();
  alert('조정전표 생성 완료!\n전표조회에서 확인하세요.');
  go('sec');
}

function todayStr(){
  var d=new Date();
  return (d.getMonth()+1)+'/'+d.getDate();
}

function rSec(){const c=calc();const jpT=c.jpMv;
  return `<div class="pt">유가증권</div>
  <div class="cards"><div class="cd bl"><div class="l">평가액</div><div class="v">${fy(c.allMv)}</div></div><div class="cd ${c.allPl>=0?'gn':'rd'}"><div class="l">평가손익</div><div class="v">${fy(c.allPl)}</div></div><div class="cd gn"><div class="l">실현손익</div><div class="v">+${fy(c.rpl)}</div></div></div>
  <div class="pn" style="padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600">증권예수금: <span id="depEdit" contenteditable="true" style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 6px;cursor:pointer;outline:none">${fm(D.secDeposit||SEC_DEP)}</span> 엔</span><button class="bt" onclick="saveDeposit()" style="font-size:10px;padding:3px 10px">💾 저장</button></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div class="tabs" style="margin-bottom:0"><button class="tab on" data-tab="hold">보유현황</button><button class="tab" data-tab="real">수익실현</button></div><button class="bt" onclick="updatePrices()" style="background:#d97706">📊 시세 업데이트</button> <button class="bt" onclick="autoEvalAdjust()" style="background:#7c3aed;font-size:11px">📋 결산조정</button></div>
  <div id="TC">
  <div class="pn"><div class="ph"><span>가) 일본</span><button class="bt" onclick="addHoldJP()">+ 종목추가</button></div><div style="overflow-x:auto"><table style="min-width:900px">
    <thead><tr><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">매수금액</th><th class="r">수수료</th><th class="r">취득원가</th><th class="r">BEP</th><th class="r">현재가</th><th class="r">평가액</th><th class="r">손익</th><th class="r">수익률</th><th></th></tr></thead>
    <tbody>${D.holdJP.map((h,i)=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;return`<tr class="${i%2?'a':''}"><td class="b bl">${h.tk}</td><td>${h.nm}</td><td class="r m">${fm(h.sh)}</td><td class="r m">${fm(h.buyAmt)}</td><td class="r m mu">${fm(h.fee)}</td><td class="r m b">${fm(h.tc)}</td><td class="r m">${fm(h.bep)}</td><td class="r m">${h.cp?fm(h.cp):'-'}</td><td class="r m b">${fm(h.mv)}</td><td class="r">${bg(pl)}</td><td class="r m ${pl>=0?'gn':'rd'}">${rr.toFixed(2)}%</td><td><button class="del" onclick="editHoldJP(${h.id})" style="color:#2563eb;margin-right:4px">✏️</button><button class="del" onclick="delHoldJP(${h.id})">✕</button></td></tr>`;}).join('')}</tbody>
    <tr class="t"><td colspan="3" class="r">합계</td><td class="r m">${fm(D.holdJP.reduce((s,h)=>s+h.buyAmt,0))}</td><td class="r m">${fm(D.holdJP.reduce((s,h)=>s+h.fee,0))}</td><td class="r m">${fm(c.jpC)}</td><td colspan="2"></td><td class="r m">${fm(c.jpMv)}</td><td class="r">${bg(c.jpMv-c.jpC)}</td><td class="r m">${((c.jpMv-c.jpC)/c.jpC*100).toFixed(2)}%</td><td></td></tr>
  </table></div></div>
  <div class="pn"><div class="ph"><span>나) 미국</span><button class="bt" onclick="addHoldUS()">+ 종목추가</button></div><table>
    <thead><tr><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">취득원가</th><th class="r">현재가(USD)</th><th class="r">환율</th><th class="r">평가액</th><th class="r">손익</th><th class="r">수익률</th><th></th></tr></thead>
    <tbody>${D.holdUS.map(h=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;return`<tr><td class="b bl">${h.tk}</td><td>${h.nm}</td><td class="r m">${fm(h.sh)}</td><td class="r m">${fm(h.tc)}</td><td class="r m">${h.cpUsd}</td><td class="r m">${h.rate||SET.rates.USDJPY}</td><td class="r m b">${fm(h.mv)}</td><td class="r">${bg(pl)}</td><td class="r m rd">${rr.toFixed(2)}%</td><td><button class="del" onclick="editHoldUS(${h.id})" style="color:#2563eb;margin-right:4px">✏️</button><button class="del" onclick="delHoldUS(${h.id})">✕</button></td></tr>`;}).join('')}</tbody>
  </table></div>
  <div class="pn"><div class="ph">다) 전체</div><table><thead><tr><th>구분</th><th class="r">취득원가</th><th class="r">평가금액</th><th class="r">비중</th><th class="r">손익</th><th class="r">수익률</th></tr></thead>
    <tbody><tr><td>일본</td><td class="r m">${fm(c.jpC)}</td><td class="r m">${fm(c.jpMv)}</td><td class="r">${c.allMv?Math.round(c.jpMv/c.allMv*100):0}%</td><td class="r">${bg(c.jpMv-c.jpC)}</td><td class="r m">${((c.jpMv-c.jpC)/c.jpC*100).toFixed(2)}%</td></tr>
    <tr class="a"><td>미국</td><td class="r m">${fm(c.usC)}</td><td class="r m">${fm(c.usMv)}</td><td class="r">${c.allMv?Math.round(c.usMv/c.allMv*100):0}%</td><td class="r">${bg(c.usMv-c.usC)}</td><td class="r m rd">${((c.usMv-c.usC)/c.usC*100).toFixed(2)}%</td></tr>
    <tr class="t"><td>합계</td><td class="r m">${fm(c.allC)}</td><td class="r m">${fm(c.allMv)}</td><td class="r">100%</td><td class="r">${bg(c.allPl)}</td><td class="r m ${c.allPl>=0?'gn':'rd'}">${(c.allPl/c.allC*100).toFixed(2)}%</td></tr></tbody></table></div>
  </div>`;}

function rRealTab(){const c=calc();
  return `<div class="pn"><div class="ph"><span>수익실현 내역 (${D.real.length}건)</span><button class="bt gn" onclick="addReal()">+ 내역추가</button></div>
  <div style="overflow-x:auto"><table style="min-width:1150px"><thead><tr><th>확정일</th><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">매수금액</th><th class="r">매수수수료</th><th class="r">매수소비세</th><th class="r">취득원가</th><th class="r">매도금액</th><th class="r">매도수수료</th><th class="r">매도소비세</th><th class="r">순수익</th><th class="r">수익률</th><th></th></tr></thead>
  <tbody>${D.real.map((r,i)=>`<tr class="${i%2?'a':''}"><td class="mu m">${r.dt}</td><td class="b bl">${r.tk}</td><td>${r.nm}</td><td class="r m">${fm(r.sh)}</td><td class="r m">${fm(r.buyAmt)}</td><td class="r m mu">${fm(r.bC)}</td><td class="r m rd">${fm(r.bT)}</td><td class="r m b">${fm(r.tc)}</td><td class="r m">${fm(r.sa)}</td><td class="r m mu">${fm(r.sC)}</td><td class="r m rd">${fm(r.sT)}</td><td class="r">${bg(r.net)}</td><td class="r m gn">${r.rr.toFixed(2)}%</td><td><button class="del" onclick="editReal(${r.id})" style="color:#2563eb;margin-right:4px">✏️</button><button class="del" onclick="delReal(${r.id})">✕</button></td></tr>`).join('')}</tbody>
  <tr class="t"><td colspan="4" class="r">합계</td><td class="r m">${fm(D.real.reduce((s,r)=>s+r.buyAmt,0))}</td><td class="r m">${fm(D.real.reduce((s,r)=>s+r.bC,0))}</td><td class="r m">${fm(D.real.reduce((s,r)=>s+r.bT,0))}</td><td class="r m">${fm(c.rC)}</td><td class="r m">${fm(c.rS)}</td><td class="r m">${fm(D.real.reduce((s,r)=>s+r.sC,0))}</td><td class="r m">${fm(D.real.reduce((s,r)=>s+r.sT,0))}</td><td class="r">${bg(c.rpl)}</td><td class="r m gn">${(c.rpl/c.rC*100).toFixed(2)}%</td><td></td></tr>
  </table></div></div>`;}

function bkTagByType(d){
  const tags={capital:'<span style="font-size:9px;background:#d1fae5;color:#059669;padding:1px 5px;border-radius:3px;margin-left:4px">자본</span>',
    loan:'<span style="font-size:9px;background:#e0e7ff;color:#4338ca;padding:1px 5px;border-radius:3px;margin-left:4px">부채</span>',
    sec:'<span style="font-size:9px;background:#dbeafe;color:#2563eb;padding:1px 5px;border-radius:3px;margin-left:4px">증권</span>',
    income:'<span style="font-size:9px;background:#fef3c7;color:#d97706;padding:1px 5px;border-radius:3px;margin-left:4px">수익</span>',
    expense:'<span style="font-size:9px;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:3px;margin-left:4px">경비</span>',
    other:'<span style="font-size:9px;background:#f1f5f9;color:#64748b;padding:1px 5px;border-radius:3px;margin-left:4px">기타</span>'};
  if(d.type&&tags[d.type])return tags[d.type];
  // Keyword fallback
  const c=(d.cat||'').toLowerCase();
  if(c.includes('증권')||c.includes('주식')||c.includes('매수')||c.includes('매도')||c.includes('이체')||c.includes('ipo')||c.includes('증거금'))return tags.sec;
  if(c.includes('자본')||c.includes('출자'))return tags.capital;
  if(c.includes('차입'))return tags.loan;
  if(c.includes('이자')||c.includes('배당'))return tags.income;
  return tags.expense;
}
function bkSummary(){
  const isSecD=d=>{if(d.type)return d.type==='sec';const c=d.cat.toLowerCase();return c.includes('증권')||c.includes('주식')||c.includes('매수')||c.includes('매도')||c.includes('이체')||c.includes('ipo')||c.includes('증거금');};
  let secOut=0,expOut=0,capIn=0,secIn=0,incIn=0,loanIn=0;
  D.bkOut.forEach(d=>{if(isSecD(d))secOut+=d.amt;else if(d.type==='loan')secOut+=d.amt;else expOut+=d.amt;});
  D.bkIn.forEach(d=>{if(d.type==='capital')capIn+=d.amt;else if(d.type==='loan'){loanIn+=d.amt;}else if(isSecD(d))secIn+=d.amt;else if(d.type==='income'||(!d.type&&!d.cat.toLowerCase().includes('자본')&&!d.cat.toLowerCase().includes('차입')))incIn+=d.amt;else if(!d.type){const c=d.cat.toLowerCase();if(c.includes('자본'))capIn+=d.amt;else if(c.includes('차입'))loanIn+=d.amt;else incIn+=d.amt;}});
  return {secOut,expOut,capIn,secIn,incIn,loanIn};
}
function rBank(){const c=calc();let cI=0,cO=0;
  return `<div class="pt">법인계좌</div>
  <div class="cards"><div class="cd bl"><div class="l">잔액</div><div class="v">${fy(c.bb)}</div></div><div class="cd gn"><div class="l">총입금</div><div class="v">${fy(c.tI)}</div></div><div class="cd rd"><div class="l">총출금</div><div class="v">${fy(c.tO)}</div></div></div>
  <div class="pn"><div class="ph" style="color:#059669"><span>입금</span><button class="bt gn" onclick="addBkIn()">+ 내역추가</button></div><table><thead><tr><th>일자</th><th>구분</th><th class="r">입금액(엔)</th><th class="r">누적(엔)</th><th></th></tr></thead>
  <tbody>${D.bkIn.map((d,i)=>{cI+=d.amt;return`<tr class="${i%2?'a':''}"><td class="mu m">${d.dt}</td><td>${d.cat}</td><td class="r m gn">${fm(d.amt)}</td><td class="r m b">${fm(cI)}</td><td><button class="del" onclick="delBk('in',${d.id})">✕</button></td></tr>`;}).join('')}</tbody></table></div>
  <div class="pn"><div class="ph" style="color:#dc2626"><span>출금</span><button class="bt rd" onclick="addBkOut()">+ 내역추가</button></div><table><thead><tr><th>일자</th><th>구분</th><th class="r">출금액(엔)</th><th class="r">누적(엔)</th><th></th></tr></thead>
  <tbody>${D.bkOut.map((d,i)=>{cO+=d.amt;return`<tr class="${i%2?'a':''}"><td class="mu m">${d.dt}</td><td>${d.cat}</td><td class="r m rd">${fm(d.amt)}</td><td class="r m">${fm(cO)}</td><td><button class="del" onclick="delBk('out',${d.id})">✕</button></td></tr>`;}).join('')}</tbody>
  <tr class="t"><td colspan="2" class="r">잔액</td><td colspan="3" class="r m" style="font-size:15px;color:#2563eb">${fm(c.bb)}</td></tr></table></div>`;}

function rFS(){
  const d=dynamicFS();const c=calc();
  // SGA: dynamically from journals
  // SGA: scan ALL expense accounts with balance (exclude NOE 540-546, tax 550+, startup 560+)
  const sgaExclude=['540','541','542','543','544','545','546','550','551','552','553','560','561','562','563','564','565'];
  const sga=D.accts.filter(ac=>ac.g==='비용'&&!sgaExclude.includes(ac.c)).map(ac=>({nm:ac.k,a:acctBal(ac.c)})).filter(x=>x.a!==0);
  // NOI: dynamically from journals
  // NOI: scan ALL revenue accounts with balance
  const noi=D.accts.filter(ac=>ac.g==='수익').map(ac=>({nm:ac.k,a:acctBal(ac.c)})).filter(x=>x.a!==0);
  // NOE
  const noe=[
    {nm:"유가증권평가손(미실현)",a:d.evalLoss,n:"보유종목 시가기준 자동반영"},
    {nm:"지급이자",a:d.interestPay}
  ].filter(x=>x.a>0);

  return '<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">재무제표</div><button class="bt" onclick="exportFSWord()" style="background:#2563eb;font-size:11px">📥 워드 내보내기 (日本語)</button></div><div class="tabs"><button class="tab on" data-tab="pl">손익계산서</button><button class="tab" data-tab="bs">대차대조표</button><button class="tab" data-tab="tx">법인세추정</button><button class="tab" data-tab="monthly" onclick="showMonthlyTab(this)">월차추이</button></div>'+
  '<div id="TC"><div class="pn" style="padding:18px;max-width:680px"><div style="text-align:center;margin-bottom:16px"><div style="font-size:16px;font-weight:700">손 익 계 산 서 (잠정)</div><div style="font-size:12px;color:#64748b">태성주식회사 (단위:엔)</div></div>'+
  '<div class="fr"><span>Ⅰ 매출액</span><span class="m">0</span></div><div class="fr b"><span>매출총이익</span><span class="m">0</span></div><div style="height:8px"></div>'+
  '<div class="fr h"><span>Ⅱ 판매비와 일반관리비</span></div>'+
  sga.map(s=>'<div class="fr i"><span>'+s.nm+(s.n?' <span style="font-size:10px;color:#64748b">('+s.n+')</span>':'')+'</span><span class="m">'+fm(s.a)+'</span></div>').join('')+
  '<div class="fr b tl"><span>판관비 합계</span><span class="m">'+fm(d.sgaT)+'</span></div>'+
  '<div class="fr"><span>설립비</span><span class="m">'+fm(d.su)+'</span></div>'+
  '<div class="fr b tl" style="color:#dc2626"><span>영업손실</span><span class="m">'+fm(d.ol)+'</span></div><div style="height:8px"></div>'+
  '<div class="fr h"><span>Ⅲ 영업외수익</span></div>'+
  noi.map(s=>'<div class="fr i"><span>'+s.nm+(s.n?' <span style="font-size:10px;color:#64748b">('+s.n+')</span>':'')+'</span><span class="m">'+fm(s.a)+'</span></div>').join('')+
  '<div class="fr b tl"><span>영업외수익 합계</span><span class="m">'+fm(d.noiT)+'</span></div><div style="height:6px"></div>'+
  '<div class="fr h"><span>Ⅳ 영업외비용</span></div>'+
  noe.map(s=>'<div class="fr i"><span>'+s.nm+(s.n?' <span style="font-size:10px;color:#64748b">('+s.n+')</span>':'')+'</span><span class="m">'+fm(s.a)+'</span></div>').join('')+
  '<div class="fr b tl"><span>영업외비용 합계</span><span class="m">'+fm(d.noeT)+'</span></div><div style="height:8px"></div>'+
  '<div class="fr b tl" style="color:#059669"><span>경상이익</span><span class="m">'+fm(d.oi)+'</span></div>'+
  '<div class="fr"><span>Ⅴ 법인세 등</span><span class="m">'+fm(d.ct)+'</span></div>'+
  '<div style="display:flex;justify-content:space-between;padding:12px 14px;font-size:16px;font-weight:700;border-top:3px solid #e2e6ed;margin-top:8px;background:#d1fae560;border-radius:0 0 6px 6px"><span>당기순이익</span><span style="color:'+(d.ni>=0?'#059669':'#dc2626')+'" class="m">'+fy(d.ni)+'</span></div>'+
  '<div class="ib" style="margin-top:8px;font-size:10px">💡 유가증권평가손·법인세는 보유종목 시가 기준 자동 반영됩니다</div>'+
  '</div></div>';
}

function rRpt(){const c=calc();
  const tI=D.bkIn.reduce((s,d)=>s+d.amt,0);
  const tO=D.bkOut.reduce((s,d)=>s+d.amt,0);
  // Operating only (exclude capital + securities transfers)
  // Classification: use type field if available, else keyword fallback
  const isSecE=d=>{if(d.type)return d.type==='sec';const c2=d.cat.toLowerCase();return c2.includes('증권')||c2.includes('주식')||c2.includes('매수')||c2.includes('매도')||c2.includes('이체')||c2.includes('ipo')||c2.includes('증거금');};
  const isCapE=d=>{if(d.type)return d.type==='capital'||d.type==='loan';const c2=d.cat.toLowerCase();return c2.includes('자본')||c2.includes('출자')||c2.includes('차입');};
  const opIn=D.bkIn.reduce((s,d)=>s+(d.type==='income'||((!d.type)&&!isSecE(d)&&!isCapE(d))?d.amt:0),0);
  const opOut=D.bkOut.reduce((s,d)=>s+(d.type==='expense'||((!d.type)&&!isSecE(d))?d.amt:0),0);
  // Build JP table
  let jpRows='';
  D.holdJP.forEach((h,i)=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;
    jpRows+='<tr class="'+(i%2?'a':'')+'"><td class="b bl">'+h.tk+'</td><td>'+h.nm+'</td><td class="r m">'+fm(h.sh)+'</td><td class="r m">'+fm(h.buyAmt)+'</td><td class="r m mu">'+fm(h.fee)+'</td><td class="r m b">'+fm(h.tc)+'</td><td class="r m">'+fm(h.bep)+'</td><td class="r m">'+(h.cp?fm(h.cp):'-')+'</td><td class="r m b">'+fm(h.mv)+'</td><td class="r">'+bg(pl)+'</td><td class="r m '+(pl>=0?'gn':'rd')+'">'+rr.toFixed(2)+'%</td></tr>';
  });
  const jpPl=c.jpMv-c.jpC;
  // Build US table
  let usRows='';
  D.holdUS.forEach(h=>{const pl=h.mv-h.tc,rr=h.tc?(pl/h.tc*100):0;
    usRows+='<tr><td class="b bl">'+h.tk+'</td><td>'+h.nm+'</td><td class="r m">'+fm(h.sh)+'</td><td class="r m">'+fm(h.tc)+'</td><td class="r m">'+h.cpUsd+'</td><td class="r m">'+(h.rate||SET.rates.USDJPY)+'</td><td class="r m b">'+fm(h.mv)+'</td><td class="r">'+bg(pl)+'</td><td class="r m '+(pl>=0?'gn':'rd')+'">'+rr.toFixed(2)+'%</td></tr>';
  });
  // Build realized table
  let realRows='';
  D.real.forEach((r,i)=>{
    realRows+='<tr class="'+(i%2?'a':'')+'"><td class="mu m">'+r.dt+'</td><td class="b bl">'+r.tk+'</td><td>'+r.nm+'</td><td class="r m">'+fm(r.sh)+'</td><td class="r m">'+fm(r.buyAmt)+'</td><td class="r m mu">'+fm(r.bC+r.bT)+'</td><td class="r m b">'+fm(r.tc)+'</td><td class="r m">'+fm(r.sp)+'</td><td class="r m">'+fm(r.sa)+'</td><td class="r m">'+fm(r.gr)+'</td><td class="r m mu">'+fm(r.sC+r.sT)+'</td><td class="r">'+bg(r.net)+'</td><td class="r m gn">'+r.rr.toFixed(2)+'%</td></tr>';
  });
  // Bank tables
  let bkInRows='',cI=0;
  D.bkIn.forEach((d,i)=>{cI+=d.amt;bkInRows+='<tr class="'+(i%2?'a':'')+'"><td class="mu m">'+d.dt+'</td><td>'+d.cat+'</td><td class="r m gn">'+fm(d.amt)+'</td><td class="r m b">'+fm(cI)+'</td></tr>';});
  let bkOutRows='',cO=0;
  D.bkOut.forEach((d,i)=>{cO+=d.amt;bkOutRows+='<tr class="'+(i%2?'a':'')+'"><td class="mu m">'+d.dt+'</td><td>'+d.cat+'</td><td class="r m rd">'+fm(d.amt)+'</td><td class="r m">'+fm(cO)+'</td></tr>';});

  return '<div style="max-width:1100px" id="rptContent">'+
    '<div contenteditable="true" style="text-align:center;margin-bottom:20px"><div style="font-size:22px;font-weight:700;color:#1e3a5f">태성㈜ 자금운용보고서</div><div style="font-size:13px;color:#64748b;margin-top:4px">'+rptDt()+' 기준</div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:12px"><button class="bt" onclick="window.print()">🖨 인쇄 (A4)</button><button class="bt" onclick="exportWord()" style="background:#2563eb">📥 워드 내보내기</button></div>'+

    // 1. 총자산내역
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div contenteditable="true" style="font-size:15px;font-weight:700;color:#1e3a5f">1. 총자산내역</div><button class="bt gh no-print" style="font-size:10px" onclick="rptAddRow(\'총자산\')">+ 행추가</button></div>'+
    '<div class="pn"><table><thead><tr><th>구분</th><th class="r">내역(엔)</th><th>비고</th></tr></thead><tbody>'+
    '<tr><td>자본금</td><td class="r m">'+fm(acctBal('300'))+'</td><td></td></tr>'+
    '<tr class="a"><td>수입</td><td class="r m">'+fm(opIn)+'</td><td class="mu">경비 수입 (이자·배당 등)</td></tr>'+
    '<tr><td>지출</td><td class="r m" style="color:#dc2626">('+fm(opOut)+')</td><td class="mu">경비 지출</td></tr>'+
    '<tr class="a" style="font-size:10px;color:#64748b"><td>　참고) 총입금 (증권이체 포함)</td><td class="r m" style="color:#64748b">'+fm(tI-acctBal('300'))+'</td><td class="mu" style="color:#64748b">자본금 외 전체</td></tr>'+
    '<tr style="font-size:10px;color:#64748b"><td>　참고) 총출금 (증권이체 포함)</td><td class="r m" style="color:#64748b">('+fm(tO)+')</td><td></td></tr>'+
    '<tr class="a" style="font-weight:700"><td>법인계좌잔액---(1)</td><td class="r m b">'+fm(c.bb)+'</td><td class="mu">미츠이스미토모</td></tr>'+
    '<tr><td>증권예수금</td><td class="r m">'+fm(c.secDep)+'</td><td></td></tr>'+
    '<tr class="a"><td>유가증권평가액</td><td class="r m">'+fm(c.allMv)+'</td><td></td></tr>'+
    '<tr style="font-weight:700"><td>증권계좌잔액---(2)</td><td class="r m b">'+fm(c.secBal)+'</td><td class="mu">SMBC닛코증권</td></tr>'+
    '<tr class="t"><td>총보유자산합계</td><td class="r m">'+fm(c.totA)+'</td><td class="mu">(1)+(2)</td></tr>'+
    '</tbody></table></div>'+

    // 2. 유가증권 평가 및 손익 현황
    '<div contenteditable="true" style="font-size:15px;font-weight:700;margin:20px 0 8px;color:#1e3a5f">2. 유가증권 평가 및 손익 현황</div>'+
    '<div class="pn" style="padding:12px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:13px;font-weight:700">총괄 요약</span><button class="bt gh no-print" style="font-size:9px" onclick="rptAddSummaryRow()">+ 행추가</button></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px">'+
    '<div>총 평가액: <b>'+fm(c.allMv)+'</b></div>'+
    '<div>총 평가손익: <b style="color:'+(c.allPl>=0?'#059669':'#dc2626')+'">'+fm(c.allPl)+'</b></div>'+
    '<div>예수금: <b>'+fm(c.secDep)+'</b></div>'+
    '<div>증권계좌잔액: <b>'+fm(c.secBal)+'</b></div></div><div id="rptSummaryExtra"></div></div>'+

    // 가) 일본
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div contenteditable="true" style="font-size:13px;font-weight:700">가) 일본</div><button class="bt gh no-print" style="font-size:10px" onclick="rptAddRow(\'보유(일본)\')">+ 행추가</button></div>'+
    '<div class="pn"><div style="overflow-x:auto"><table style="min-width:900px"><thead><tr><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">매수금액</th><th class="r">수수료</th><th class="r">취득원가</th><th class="r">BEP</th><th class="r">현재가</th><th class="r">평가액</th><th class="r">손익</th><th class="r">수익률</th></tr></thead>'+
    '<tbody>'+jpRows+'</tbody>'+
    '<tr class="t"><td colspan="3" class="r">합계</td><td class="r m">'+fm(D.holdJP.reduce((s,h)=>s+h.buyAmt,0))+'</td><td class="r m">'+fm(D.holdJP.reduce((s,h)=>s+h.fee,0))+'</td><td class="r m">'+fm(c.jpC)+'</td><td colspan="2"></td><td class="r m">'+fm(c.jpMv)+'</td><td class="r">'+bg(jpPl)+'</td><td class="r m '+(jpPl>=0?'gn':'rd')+'">'+((jpPl)/c.jpC*100).toFixed(2)+'%</td></tr>'+
    '</table></div></div>'+

    // 나) 미국
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div contenteditable="true" style="font-size:13px;font-weight:700">나) 미국</div><button class="bt gh no-print" style="font-size:10px" onclick="rptAddRow(\'보유(미국)\')">+ 행추가</button></div>'+
    '<div class="pn"><table><thead><tr><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">취득원가</th><th class="r">현재가(USD)</th><th class="r">환율</th><th class="r">평가액</th><th class="r">손익</th><th class="r">수익률</th></tr></thead>'+
    '<tbody>'+usRows+'</tbody></table></div>'+

    // 다) 전체
    '<div contenteditable="true" style="font-size:13px;font-weight:700;margin-bottom:6px">다) 전체</div>'+
    '<div class="pn"><table><thead><tr><th>구분</th><th class="r">취득원가</th><th class="r">평가금액</th><th class="r">비중</th><th class="r">손익</th><th class="r">수익률</th></tr></thead>'+
    '<tbody><tr><td>일본</td><td class="r m">'+fm(c.jpC)+'</td><td class="r m">'+fm(c.jpMv)+'</td><td class="r">'+(c.allMv?Math.round(c.jpMv/c.allMv*100):0)+'%</td><td class="r">'+bg(jpPl)+'</td><td class="r m '+(jpPl>=0?'gn':'rd')+'">'+(jpPl/c.jpC*100).toFixed(2)+'%</td></tr>'+
    '<tr class="a"><td>미국</td><td class="r m">'+fm(c.usC)+'</td><td class="r m">'+fm(c.usMv)+'</td><td class="r">'+(c.allMv?Math.round(c.usMv/c.allMv*100):0)+'%</td><td class="r">'+bg(c.usMv-c.usC)+'</td><td class="r m rd">'+((c.usMv-c.usC)/c.usC*100).toFixed(2)+'%</td></tr>'+
    '<tr class="t"><td>합계</td><td class="r m">'+fm(c.allC)+'</td><td class="r m">'+fm(c.allMv)+'</td><td class="r">100%</td><td class="r">'+bg(c.allPl)+'</td><td class="r m '+(c.allPl>=0?'gn':'rd')+'">'+(c.allPl/c.allC*100).toFixed(2)+'%</td></tr></tbody></table></div>'+

    // 3. 수익실현내역
    '<div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 8px"><div contenteditable="true" style="font-size:15px;font-weight:700;color:#1e3a5f">3. 수익실현내역</div><button class="bt gh no-print" style="font-size:10px" onclick="rptAddRow(\'수익실현\')">+ 행추가</button></div>'+
    '<div class="pn"><div style="overflow-x:auto"><table style="min-width:1050px"><thead><tr><th>확정일</th><th>코드</th><th>종목명</th><th class="r">수량</th><th class="r">매수금액</th><th class="r">매수수수료</th><th class="r">취득원가</th><th class="r">매도가</th><th class="r">매도금액</th><th class="r">실현순익</th><th class="r">매도수수료</th><th class="r">순수익</th><th class="r">수익률</th></tr></thead>'+
    '<tbody>'+realRows+'</tbody>'+
    '<tr class="t"><td colspan="4" class="r">합계</td><td class="r m">'+fm(D.real.reduce((s,r)=>s+r.buyAmt,0))+'</td><td class="r m">'+fm(D.real.reduce((s,r)=>s+r.bC+r.bT,0))+'</td><td class="r m">'+fm(c.rC)+'</td><td></td><td class="r m">'+fm(c.rS)+'</td><td class="r m">'+fm(D.real.reduce((s,r)=>s+r.gr,0))+'</td><td class="r m">'+fm(D.real.reduce((s,r)=>s+r.sC+r.sT,0))+'</td><td class="r">'+bg(c.rpl)+'</td><td class="r m gn">'+(c.rpl/c.rC*100).toFixed(2)+'%</td></tr>'+
    '</table></div></div>'+

    // 4. 은행 법인 계좌 상세 내역
    '<div contenteditable="true" style="font-size:15px;font-weight:700;margin:20px 0 8px;color:#1e3a5f">4. 은행 법인 계좌 상세 내역</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="pn"><div class="ph" style="color:#059669;font-size:12px"><span>입금 상세내역</span><button class="bt gh no-print" style="font-size:9px" onclick="rptAddRow(\'입금\')">+</button></div><table><thead><tr><th>일자</th><th>구분(내역)</th><th class="r">입금금액(엔)</th><th class="r">누적입금액(엔)</th></tr></thead><tbody>'+bkInRows+'</tbody></table></div>'+
    '<div class="pn"><div class="ph" style="color:#dc2626;font-size:12px"><span>출금 상세내역</span><button class="bt gh no-print" style="font-size:9px" onclick="rptAddRow(\'출금\')">+</button></div><table><thead><tr><th>일자</th><th>구분(내역)</th><th class="r">출금금액(엔)</th><th class="r">누적출금액(엔)</th></tr></thead><tbody>'+bkOutRows+'</tbody>'+
    '<tr class="t"><td colspan="2" class="r">잔액</td><td colspan="2" class="r m" style="font-size:14px;color:#2563eb">'+fm(c.bb)+'</td></tr></table></div>'+
    '</div>'+
    '</div>';
}


// ===== DATA BACKUP / RESTORE =====
function exportBackup(){
  const backup={
    version:'taesung_v26',
    exportDate:new Date().toISOString(),
    data:D,
    settings:SET,
    pin:localStorage.getItem(PIN_KEY)
  };
  const json=JSON.stringify(backup,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a2=document.createElement('a');
  a2.href=url;
  a2.download='taesung_backup_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a2);a2.click();document.body.removeChild(a2);
  URL.revokeObjectURL(url);
  alert('백업 완료!\n파일: '+a2.download);
}

function importBackup(){
  const input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=function(e){
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=function(ev){
      try{
        const backup=JSON.parse(ev.target.result);
        if(!backup.data||!backup.data.journals){
          alert('올바른 백업 파일이 아닙니다.');return;
        }
        const info='백업 정보:\n'+
          '- 내보낸 날짜: '+(backup.exportDate||'불명').slice(0,10)+'\n'+
          '- 전표: '+backup.data.journals.length+'건\n'+
          '- 보유종목(일본): '+(backup.data.holdJP||[]).length+'종목\n'+
          '- 보유종목(미국): '+(backup.data.holdUS||[]).length+'종목\n\n'+
          '현재 데이터를 덮어씁니다. 진행하시겠습니까?';
        if(!confirm(info))return;
        // Restore data
        D=backup.data;
        D.accts=ACCT_INIT; // Always use fresh accounts
        saveD();
        // Restore settings
        if(backup.settings){
          SET=backup.settings;
          localStorage.setItem(SKEY,JSON.stringify(SET));
        }
        // Restore PIN
        if(backup.pin){
          localStorage.setItem(PIN_KEY,backup.pin);
        }
        alert('복원 완료! 페이지를 새로고침합니다.');
        location.reload();
      }catch(err){
        alert('파일 읽기 오류: '+err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function rSet(){return `<div class="pt">설정</div>
  <div class="sc"><h4>💱 환율 설정</h4><div style="font-size:11px;color:#64748b;margin-bottom:10px">환율 변경 시 유가증권 평가 및 전표처리에 반영</div>
  <button class="bt" id="rateBtn" onclick="fetchRate()" style="background:#d97706;margin-bottom:12px">🔄 환율 자동 가져오기</button>
  <div class="rr"><span style="width:120px">USD/JPY:</span><input type="number" id="r1" value="${SET.rates.USDJPY}" step="0.000001"><span class="mu">1달러 = ? 엔</span></div>
  <div class="rr"><span style="width:120px">JPY/KRW:</span><input type="number" id="r2" value="${SET.rates.JPYKRW}" step="0.000001"><span class="mu">1엔 = ? 원</span></div>
  <div style="margin-top:12px"><button class="bt" onclick="SET.rates.USDJPY=+document.getElementById('r1').value;SET.rates.JPYKRW=+document.getElementById('r2').value;saveS();alert('저장됨');go('set')">💾 저장</button></div></div>
  <div class="sc"><h4>📄 보고서 기준일</h4><div class="rr"><span>기준일 (비워두면 자동):</span><input id="r3" value="${SET.reportDate}" placeholder="예: 26. 3. 27." style="width:160px"></div>
  <button class="bt" onclick="SET.reportDate=document.getElementById('r3').value;saveS();alert('저장됨')">💾 저장</button></div>
  <div class="sc"><h4>☁️ Firebase 동기화</h4>
  <div style="font-size:11px;margin-bottom:8px" id="fbStatus">${fbReady?'<span style="color:#059669">✅ Firebase 연결됨</span>':'<span style="color:#dc2626">❌ Firebase 미연결 (새로고침 필요)</span>'}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="bt" onclick="doFbUpload()" style="background:#d97706">📤 서버에 업로드</button>
    <button class="bt" onclick="doFbDownload()" style="background:#2563eb">📥 서버에서 다운로드</button>
  </div>
  <div style="font-size:10px;color:#94a3b8;margin-top:6px">💡 자동 동기화: 전표 저장 시 자동으로 서버에 업로드됩니다</div><button class="bt gh" onclick="showDiag()" style="font-size:9px;margin-top:6px">🔍 데이터 진단</button></div></div>
  <div class="sc"><h4>📅 월차 마감</h4>
  <div style="font-size:11px;color:#64748b;margin-bottom:8px">현재 재무상태를 월별로 저장합니다. 매월 말에 실행하세요.</div>
  <button class="bt" onclick="saveMonthlyClose()" style="background:#7c3aed">📅 이번 달 마감 저장</button></div>
  <div class="sc"><h4>💾 데이터 백업 / 복원</h4>
  <div style="font-size:11px;color:#64748b;margin-bottom:10px">다른 기기로 데이터를 이동하거나 백업할 수 있습니다</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="bt" onclick="exportBackup()" style="background:#059669">📤 백업 내보내기 (JSON)</button>
    <button class="bt" onclick="importBackup()" style="background:#2563eb">📥 백업 가져오기</button>
  </div>
  <div style="font-size:10px;color:#94a3b8;margin-top:6px">💡 PC에서 내보내기 → 휴대폰에서 가져오기로 동기화 가능</div></div>
  <div class="sc"><h4>🔐 PIN 변경</h4><div style="font-size:11px;color:#64748b;margin-bottom:8px">앱 접근 시 사용하는 4자리 PIN을 변경합니다</div>
  <button class="bt" onclick="changePin()">🔐 PIN 변경</button></div>
  <div class="sc"><h4>🔄 데이터 초기화</h4><div style="font-size:11px;color:#64748b;margin-bottom:8px">모든 수정사항을 원래 데이터로 복원합니다</div>
  <button class="bt rd" onclick="if(confirm('정말 초기화하시겠습니까?')){localStorage.removeItem('${DKEY}');localStorage.removeItem('${SKEY}');location.reload();}">🗑 초기화</button></div>`;}



function rptAddSummaryRow(){
  var container=document.getElementById('rptSummaryExtra');
  if(!container)return;
  var row=document.createElement('div');
  row.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px dashed #fde68a;margin-top:4px;background:#fffbeb;font-size:12px';
  row.innerHTML='<span contenteditable="true" style="flex:1;padding:3px 6px;outline:none;border:1px dashed #fde68a;border-radius:3px">(내용 입력)</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px" class="no-print">✕</button>';
  container.appendChild(row);
}

// ===== Report row-add functions =====
function rptAddRow(section){
  const tables=document.querySelectorAll('#rptContent table');
  let targetIdx=0;
  if(section==='총자산') targetIdx=0;
  else if(section==='보유(일본)') targetIdx=1;
  else if(section==='보유(미국)') targetIdx=2;
  else if(section==='전체') targetIdx=3;
  else if(section==='수익실현') targetIdx=4;
  else if(section==='입금') targetIdx=5;
  else if(section==='출금') targetIdx=6;
  if(tables[targetIdx]){
    const tbody=tables[targetIdx].querySelector('tbody')||tables[targetIdx];
    const totalRow=tbody.querySelector('tr.t');
    const newRow=document.createElement('tr');
    newRow.style.background='#fffbeb';
    const colCount=tbody.querySelector('tr')?.cells.length||3;
    newRow.innerHTML='<td colspan="'+(colCount-1)+'" contenteditable="true" style="border:1px dashed #fde68a;padding:6px 8px;outline:none">(내용을 입력하세요)</td><td style="text-align:center"><button onclick="this.closest(\'tr\').remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button></td>';
    if(totalRow)tbody.insertBefore(newRow,totalRow);
    else tbody.appendChild(newRow);
  }
}


// ===== EXPORT: GL to Excel (Japanese) =====
function exportGLExcel(){
  const S='border:1px solid #999;padding:3pt 5pt;font-size:9pt;';
  const HR=S+'text-align:right;';const HB=HR+'font-weight:bold;';
  const TH='background:#dbeafe;font-weight:bold;font-size:8pt;padding:3pt 5pt;border:1px solid #999;';
  const THR=TH+'text-align:right;';
  // Build GL from journals
  const bal={};
  D.journals.forEach(j=>{
    if(!bal[j.dr])bal[j.dr]={dr:0,cr:0,entries:[]};
    if(!bal[j.cr])bal[j.cr]={dr:0,cr:0,entries:[]};
    bal[j.dr].dr+=j.amt;bal[j.dr].entries.push({...j,isDr:true});
    bal[j.cr].cr+=j.amt;bal[j.cr].entries.push({...j,isDr:false});
  });
  let html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>td,th{mso-number-format:"\@"}</style></head><body>';
  html+='<h2 style="font-size:14pt;color:#1e3a5f">泰成株式会社　総勘定元帳</h2>';
  html+='<p style="font-size:9pt;color:#666">自 令和7年6月2日 至 令和8年4月2日（暫定）</p><br>';
  
  const groups={"자산":"資産","부채":"負債","순자산":"純資産","수익":"収益","비용":"費用"};
  Object.entries(bal).forEach(([code,v])=>{
    const ac=D.accts.find(x=>x.c===code);if(!ac)return;
    const isDb=["자산","비용"].includes(ac.g);
    const net=isDb?v.dr-v.cr:v.cr-v.dr;
    const jpName=ac.n||ac.k;const jpGroup=groups[ac.g]||ac.g;
    html+='<table style="width:100%;border-collapse:collapse;margin-bottom:12pt">';
    html+='<tr><td colspan="5" style="background:#1e3a5f;color:#fff;font-weight:bold;padding:4pt 8pt;font-size:10pt">【'+jpName+'】 '+code+' ('+jpGroup+') — 残高: '+fm(net)+'円</td></tr>';
    html+='<tr><td style="'+TH+'">日付</td><td style="'+TH+'">伝票</td><td style="'+TH+'">摘要</td><td style="'+THR+'">借方</td><td style="'+THR+'">貸方</td><td style="'+THR+'">残高</td></tr>';
    let runBal=0;
    v.entries.forEach((e,i)=>{
      const dr=e.isDr?e.amt:0,cr=e.isDr?0:e.amt;
      runBal+=isDb?(dr-cr):(cr-dr);
      const bg=i%2?'background:#f5f5f5;':'';
      html+='<tr><td style="'+S+bg+'">'+e.dt+'</td><td style="'+S+bg+'color:#2563eb">'+e.no+'</td><td style="'+S+bg+'">'+e.desc+'</td><td style="'+HR+bg+'">'+(dr?fm(dr):'')+'</td><td style="'+HR+bg+'">'+(cr?fm(cr):'')+'</td><td style="'+HB+bg+'">'+fm(runBal)+'</td></tr>';
    });
    html+='</table>';
  });
  html+='</body></html>';
  const blob=new Blob([html],{type:'application/vnd.ms-excel'});
  const url=URL.createObjectURL(blob);const a2=document.createElement('a');
  a2.href=url;a2.download='泰成_総勘定元帳_'+new Date().toISOString().slice(0,10)+'.xls';
  document.body.appendChild(a2);a2.click();document.body.removeChild(a2);URL.revokeObjectURL(url);
}

// ===== EXPORT: FS to Word (Japanese) =====
function exportFSWord(){
  const d=dynamicFS();
  const today=new Date();
  const dateStr=today.getFullYear()+'年'+(today.getMonth()+1)+'月'+today.getDate()+'日';
  
  let html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8">
<style>
  @page{size:A4 portrait;margin:20mm 18mm}
  body{font-family:"Yu Gothic","Meiryo","Malgun Gothic",sans-serif;font-size:10pt;color:#222;line-height:1.6}
  h1{font-size:18pt;text-align:center;color:#1a1a2e;letter-spacing:4pt;margin:0 0 2pt}
  h2{font-size:13pt;color:#1a1a2e;border-bottom:2.5pt solid #1a1a2e;padding-bottom:3pt;margin:20pt 0 8pt}
  .sub{font-size:9pt;color:#666;text-align:center;margin-bottom:16pt}
  table{width:100%;border-collapse:collapse;margin-bottom:12pt}
  th{background:#2c3e6b;color:#fff;font-size:9pt;padding:5pt 8pt;border:1pt solid #2c3e6b;text-align:left}
  th.r{text-align:right}
  td{padding:4pt 8pt;border:1pt solid #ccc;font-size:9.5pt}
  td.r{text-align:right;font-feature-settings:'tnum'}
  td.b{font-weight:bold}
  tr.sec{background:#e8edf5}
  tr.sec td{font-weight:bold;color:#1a1a2e;font-size:10pt;border-bottom:1.5pt solid #2c3e6b}
  tr.sub td{background:#f4f6fa;font-weight:600}
  tr.total{background:#2c3e6b}
  tr.total td{color:#fff;font-weight:bold;font-size:10.5pt;border:1pt solid #2c3e6b}
  tr.gap td{border:none;height:4pt;padding:0}
  .note{font-size:8pt;color:#888;margin-top:-8pt;margin-bottom:8pt}
  .stamp{border:2pt solid #1a1a2e;display:inline-block;padding:4pt 14pt;text-align:center;margin-top:10pt;float:right}
  .stamp .s1{font-size:7pt;color:#666}
  .stamp .s2{font-size:11pt;font-weight:bold}
  .footer{text-align:center;font-size:8pt;color:#aaa;margin-top:20pt;border-top:1pt solid #ddd;padding-top:6pt}
</style></head><body>`;

  // ==================== P&L ====================
  html+=`
<div class="stamp"><div class="s1">決裁</div><div class="s2">本人専決</div></div>
<h1>損 益 計 算 書</h1>
<div class="sub">泰成株式会社<br>自 令和7年6月2日（設立日）至 令和8年4月2日（暫定）<br>（単位：円）</div>

<table>
<tr><th style="width:35%">科目</th><th class="r" style="width:20%">内訳</th><th class="r" style="width:20%">小計</th><th class="r" style="width:25%">合計</th></tr>

<tr class="sec"><td colspan="3">Ⅰ　売上高</td><td class="r">0</td></tr>
<tr class="sub"><td colspan="3">売上総利益</td><td class="r b">0</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">Ⅱ　販売費及び一般管理費</td></tr>
'+function(){var excl=['540','541','542','543','544','545','546','550','551','552','553','560','561','562','563','564','565'];var r='';D.accts.filter(function(ac){return ac.g==='비용'&&excl.indexOf(ac.c)<0;}).forEach(function(ac){var b=acctBal(ac.c);if(b>0)r+='<tr><td>　'+(ac.n||ac.k)+'</td><td class="r">'+fm(b)+'</td><td></td><td></td></tr>';});return r;}()+'
<tr class="sub"><td>　販管費合計</td><td></td><td class="r b">${fm(d.sgaT)}</td><td></td></tr>
<tr><td>　創立費</td><td></td><td class="r">${fm(d.su)}</td><td></td></tr>
<tr class="sub"><td>営業損失</td><td></td><td></td><td class="r b" style="color:#c0392b">${fm(d.ol)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">Ⅲ　営業外収益</td></tr>
'+function(){var r='';D.accts.filter(function(ac){return ac.g==='수익';}).forEach(function(ac){var b=acctBal(ac.c);if(b>0)r+='<tr><td>　'+(ac.n||ac.k)+'</td><td class="r">'+fm(b)+'</td><td></td><td></td></tr>';});return r;}()+'
<tr class="sub"><td>　営業外収益合計</td><td></td><td></td><td class="r b">${fm(d.noiT)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">Ⅳ　営業外費用</td></tr>
<tr><td>　有価証券評価損（未実現）</td><td class="r">${fm(d.evalLoss)}</td><td></td><td></td></tr>
<tr><td colspan="4" class="note">　　※保有銘柄の時価基準により自動反映</td></tr>
<tr><td>　支払利息（役員借入金 年1%）</td><td class="r">${fm(d.interestPay)}</td><td></td><td></td></tr>
<tr><td colspan="4" class="note">　　※1.5億×1%×289日÷365日</td></tr>
<tr class="sub"><td>　営業外費用合計</td><td></td><td></td><td class="r b">${fm(d.noeT)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sub"><td>経常利益（税引前）</td><td></td><td></td><td class="r b" style="color:#27ae60;font-size:11pt">${fm(d.oi)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>
<tr class="sec"><td colspan="3">Ⅴ　法人税等（推定）</td><td class="r">${fm(d.ct)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>
<tr class="total"><td colspan="3">税引後当期純利益</td><td class="r" style="font-size:12pt">${fm(d.ni)}</td></tr>
</table>

<div style="page-break-before:always"></div>

<div class="stamp"><div class="s1">決裁</div><div class="s2">本人専決</div></div>
<h1>貸 借 対 照 表</h1>
<div class="sub">泰成株式会社<br>令和8年4月2日現在（暫定）<br>（単位：円）</div>

<table>
<tr><th style="width:40%">科目</th><th class="r" style="width:20%">内訳</th><th class="r" style="width:20%">小計</th><th class="r" style="width:20%">合計</th></tr>

<tr class="sec"><td colspan="4">【資産の部】</td></tr>
<tr><td>　普通預金</td><td class="r">${fm(d.deposit)}</td><td></td><td></td></tr>
<tr><td>　証券預り金</td><td class="r">${fm(d.secDep)}</td><td></td><td></td></tr>
<tr class="sub"><td>　現金・預金計</td><td></td><td class="r b">${fm(d.cashT)}</td><td></td></tr>
<tr class="sub"><td>　有価証券（時価）</td><td></td><td class="r b">${fm(d.secMV)}</td><td></td></tr>
<tr class="total"><td>資産合計</td><td></td><td></td><td class="r" style="font-size:11pt">${fm(d.totA)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">【負債の部】</td></tr>
<tr><td>　役員借入金</td><td class="r">${fm(acctBal("221")+acctBal("220"))}</td><td></td><td></td></tr>
<tr><td>　未払利息（年1%、289日）</td><td class="r">${fm(d.interestPay)}</td><td></td><td></td></tr>
<tr><td>　未払金（設立費）</td><td class="r">${fm(371400)}</td><td></td><td></td></tr>
<tr><td>　未払法人税等</td><td class="r">${fm(d.ct)}</td><td></td><td></td></tr>
<tr class="total"><td>負債合計</td><td></td><td></td><td class="r">${fm(d.totL)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">【純資産の部】</td></tr>
<tr><td>　資本金</td><td class="r">${fm(acctBal("300"))}</td><td></td><td></td></tr>
<tr><td>　利益剰余金（当期純利益）</td><td class="r">${fm(d.eqNI)}</td><td></td><td></td></tr>
<tr class="total"><td>純資産合計</td><td></td><td></td><td class="r">${fm(d.totE)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>
<tr class="total" style="background:#0d1b3e"><td>負債・純資産合計</td><td></td><td></td><td class="r" style="font-size:12pt">${fm(d.totL+d.totE)}</td></tr>
</table>

<div class="footer">泰成株式会社 財務管理システム ｜ 出力日: ${dateStr} ｜ 本書は暫定値に基づく参考資料です</div>
</body></html>`;

  const blob=new Blob([html],{type:'application/msword'});
  const url=URL.createObjectURL(blob);const a2=document.createElement('a');
  a2.href=url;a2.download='泰成_財務諸表_'+new Date().toISOString().slice(0,10)+'.doc';
  document.body.appendChild(a2);a2.click();document.body.removeChild(a2);URL.revokeObjectURL(url);
}



// ===== ROUTING =====
const pages={dash:rDash,slip:rSlip,jrn:rJrn,gl:rGL,fs:rFS,sec:rSec,bank:rBank,rpt:rRpt,set:rSet};
let cur='dash';

function go(p){
  cur=p;
  document.getElementById('M').innerHTML=pages[p]();
  if(p==='dash'){var tc=document.getElementById('trendChart');if(tc)tc.innerHTML=renderTrendChart('month');}
  document.querySelectorAll('.ni').forEach(el=>el.classList.toggle('on',el.dataset.page===p));
  // Tab events
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));this.classList.add('on');
    const tc=document.getElementById('TC'),id=this.dataset.tab;if(!tc)return;
    if(cur==='sec'){if(id==='real')tc.innerHTML=rRealTab();else go('sec');}
    if(cur==='fs'){if(id==='bs')tc.innerHTML=rBSTab();else if(id==='tx')tc.innerHTML=rTxTab();else if(id==='monthly')tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">📅 월차 추이</div>'+rMonthlyTable()+'</div>';else go('fs');}
  }));
}

function rBSTab(){
  const d=dynamicFS();
  // Dynamic asset items (exclude 110, 191, 130 which are shown separately)
  var extraAssets='';
  D.accts.filter(function(ac){return ac.g==='자산'&&ac.c!=='110'&&ac.c!=='191'&&ac.c!=='130';}).forEach(function(ac){var b=acctBal(ac.c);if(b!==0)extraAssets+='<div class="fr"><span>'+ac.k+'</span><span class="m">'+fm(b)+'</span></div>';});
  // Dynamic liability items
  var liabItems='';
  D.accts.filter(function(ac){return ac.g==='부채';}).forEach(function(ac){var b=acctBal(ac.c);if(b!==0)liabItems+='<div class="fr"><span>'+ac.k+'</span><span class="m">'+fm(b)+'</span></div>';});
  // Dynamic equity items
  var eqItems='';
  D.accts.filter(function(ac){return ac.g==='순자산';}).forEach(function(ac){var b=acctBal(ac.c);if(b!==0)eqItems+='<div class="fr"><span>'+ac.k+'</span><span class="m">'+fm(b)+'</span></div>';});
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'+
  '<div class="pn" style="padding:14px"><div style="text-align:center;font-size:14px;font-weight:700;color:#2563eb;margin-bottom:10px">【자산】</div>'+
  '<div class="fr"><span>보통예금</span><span class="m">'+fm(d.deposit)+'</span></div>'+
  '<div class="fr"><span>증권예수금</span><span class="m">'+fm(d.secDep)+'</span></div>'+
  '<div class="fr b tl"><span>현금·예금계</span><span class="m">'+fm(d.cashT)+'</span></div>'+
  '<div class="fr"><span>유가증권(장부가)</span><span class="m">'+fm(d.secBookVal)+'</span></div>'+
  '<div class="fr" style="font-size:10px;color:#64748b"><span>　※시가평가: '+fm(d.secMV)+'</span><span></span></div>'+
  extraAssets+'<div class="fr b tl" style="color:#2563eb;font-size:14px"><span>자산합계</span><span class="m">'+fm(d.totA)+'</span></div></div>'+
  '<div class="pn" style="padding:14px"><div style="text-align:center;font-size:14px;font-weight:700;color:#d97706;margin-bottom:10px">【부채】</div>'+
  liabItems+
  '<div class="fr b tl" style="color:#d97706"><span>부채합계</span><span class="m">'+fm(d.totL)+'</span></div>'+
  '<div style="text-align:center;font-size:14px;font-weight:700;color:#059669;margin:16px 0 10px">【순자산】</div>'+
  eqItems+'<div class="fr"><span>이익잉여금(당기순이익)</span><span class="m">'+fm(d.eqNI)+'</span></div>'+
  '<div class="fr b tl" style="color:#059669"><span>순자산합계</span><span class="m">'+fm(d.totE)+'</span></div>'+
  '<div class="fr b tl" style="font-size:14px"><span>부채·순자산합계</span><span class="m">'+fm(d.totL+d.totE)+'</span></div></div></div>'+
  '<div class="ib" style="font-size:10px">💡 전표 기반 자동집계. 유가증권평가손·유가증권은 보유종목 시가 자동반영 → 차대 균형 보장</div>';
}

function rTxTab(){
  const d=dynamicFS();
  const oi=d.oi; // 경상이익
  // Japan corporate tax structure for small company (자본금 1억이하, 소득800만이하)
  const houjinzei=oi>0?Math.round(oi*0.15):0; // 법인세 15% (800만이하)
  const chihou_houjin=Math.round(houjinzei*0.103); // 지방법인세 10.3%
  const jigyouzei=oi>0?Math.round(oi*0.07):0; // 사업세 7% (표준세율)
  const tokubetsu_jigyou=Math.round(jigyouzei*0.37); // 특별법인사업세 37%
  const touminzei=Math.round(houjinzei*0.07); // 도민세(법인세할) 7%
  const kintou=70000; // 균등할 7만엔 (도쿄도 최저)
  const totalTax=houjinzei+chihou_houjin+jigyouzei+tokubetsu_jigyou+touminzei+kintou;
  const effectiveRate=oi>0?((totalTax/oi)*100).toFixed(2):'0';
  
  return '<div class="pn" style="padding:18px;max-width:520px">'+
    '<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:4px">법인세 등 추정 상세</div>'+
    '<div style="text-align:center;font-size:10px;color:#64748b;margin-bottom:14px">태성주식회사 (자본금1천만엔, 도쿄도, 소규모법인)</div>'+
    '<div class="fr h"><span>경상이익 (과세소득)</span><span class="m">'+fm(oi)+'</span></div>'+
    '<div style="height:8px"></div>'+
    '<div class="fr h" style="color:#1e3a5f"><span>① 국세</span></div>'+
    '<div class="fr i"><span>법인세 (15%)</span><span class="m">'+fm(houjinzei)+'</span></div>'+
    '<div class="fr i" style="font-size:10px;color:#64748b"><span>　※자본금1억이하·소득800만이하 경감세율</span></div>'+
    '<div class="fr i"><span>지방법인세 (법인세×10.3%)</span><span class="m">'+fm(chihou_houjin)+'</span></div>'+
    '<div style="height:6px"></div>'+
    '<div class="fr h" style="color:#d97706"><span>② 도도부현세 (도쿄도)</span></div>'+
    '<div class="fr i"><span>법인사업세 (7%)</span><span class="m">'+fm(jigyouzei)+'</span></div>'+
    '<div class="fr i"><span>특별법인사업세 (사업세×37%)</span><span class="m">'+fm(tokubetsu_jigyou)+'</span></div>'+
    '<div class="fr i"><span>법인도민세 (법인세×7%)</span><span class="m">'+fm(touminzei)+'</span></div>'+
    '<div class="fr i"><span>균등할 (도쿄도 최저)</span><span class="m">'+fm(kintou)+'</span></div>'+
    '<div style="height:8px"></div>'+
    '<div class="fr b tl" style="color:#dc2626;font-size:13px"><span>법인세 등 합계</span><span class="m">'+fm(totalTax)+'</span></div>'+
    '<div class="fr" style="font-size:11px;color:#64748b"><span>실효세율</span><span class="m">'+effectiveRate+'%</span></div>'+
    '<div style="height:10px"></div>'+
    '<div class="ib" style="font-size:9px">💡 참고용 추정치입니다. 실제 세액은 세무사 확인이 필요합니다.<br>'+
    '사업세는 손금산입 가능하나 여기서는 미반영. 결손금 이월공제 미반영.</div>'+
    '</div>';
}

// Calculator
let cS={d:"0",p:null,o:null,f:true};
function cP(v){let{d,p,o,f}=cS;if(v==='C'){d="0";p=null;o=null;f=true;}else if(['+','-','×','÷'].includes(v)){p=parseFloat(d);o=v;f=true;}else if(v==='='){if(p!=null&&o){const c=parseFloat(d);let r=0;if(o==='+')r=p+c;if(o==='-')r=p-c;if(o==='×')r=p*c;if(o==='÷')r=c?p/c:0;d=String(Math.round(r*1e8)/1e8);p=null;o=null;f=true;}}else if(v==='.'){if(!d.includes('.')){d+='.';f=false;}}else{d=f?(v==='0'?'0':v):(d==='0'?v:d+v);f=false;}cS={d,p,o,f};document.getElementById('cD').textContent=isNaN(d)?d:Number(d).toLocaleString('ja-JP',{maximumFractionDigits:8});}

// toggleLang() in lang.js

// Init

// updateNavLabels() defined in lang.js


document.addEventListener('DOMContentLoaded',function(){
  go('dash');updateNavLabels();
  document.querySelectorAll('.ni').forEach(el=>el.addEventListener('click',()=>go(el.dataset.page)));
  const ks=['C','±','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','0','.','='];
  const kd=document.getElementById('cK');
  ks.forEach((k,i)=>{const b=document.createElement('button');b.textContent=k;b.onclick=()=>cP(k);const isOp=['+','-','×','÷','='].includes(k);b.style.cssText=`padding:8px 0;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;${k==='0'&&i===16?'grid-column:span 2;':''}background:${isOp?'#2563eb':['C','±','%'].includes(k)?'#f1f3f6':'#f8f9fb'};color:${isOp?'#fff':'#1a2030'}`;kd.appendChild(b);});
});
