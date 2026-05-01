// ===== STORAGE =====
const DKEY='taesung_data', SKEY='taesung_settings';
// DEF_SET defined above
function loadJ(k,def){try{const v=localStorage.getItem(k);return v?{...def,...JSON.parse(v)}:def;}catch(e){return def;}}
// SET defined above

// Initialize data from data.js constants
const DEF_DATA={holdJP:INIT_HOLD_JP,holdUS:INIT_HOLD_US,real:INIT_REAL,bkIn:INIT_BK_IN,bkOut:INIT_BK_OUT,journals:INIT_JOURNALS,accts:ACCT_INIT};
let D=loadJ(DKEY,DEF_DATA);
// Migrate: always use fresh accts from ACCT_INIT (fixes JP->KR group name change)
// Merge: keep ACCT_INIT + user-added custom accounts
if(!D.customAccts)D.customAccts=[];
if(D._oiAccts)OI_ACCTS=D._oiAccts;
D.accts=ACCT_INIT.concat(D.customAccts);
if(D.secDeposit===undefined)D.secDeposit=SEC_DEP;
if(!D.fxSecDeposit)D.fxSecDeposit={USD:{amt:0,avgRate:0,curRate:0}};
if(!D.vendors)D.vendors=INIT_VENDORS;
if(!D.fixedAssets)D.fixedAssets=[];
if(!D.leases)D.leases=[];
if(!D.contracts)D.contracts=[];
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
  const sgaCodes=['510','511','512','513','514','515','516','520','521','522','523','524','525','526','527','528','529','530','531','532','533','534','535','536','538','539','547','548','549','570','580','581','582','583','584'];
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
  const evalPL=c.allMv - c.allC; // positive=gain, negative=loss
  const evalGain=Math.max(0, evalPL); // 평가이익 (영업외수익)
  const evalLoss=Math.max(0, -evalPL); // 평가손 (영업외비용)
  const secFee=acctBal('537'); // 유가증권매매수수료 (영업외비용)
  const noiTWithEval=noiT+evalGain;
  const noeT=evalLoss+interestPay+secFee;
  const oi=ol+noiTWithEval-noeT;
  // Use journal tax if exists, otherwise estimate
  const journalCt=acctBal('550');
  // Detailed tax: 법인세15%+지방법인세10.3%+사업세7%+특별사업세37%+도민세7%+균등할7만
  // Progressive business tax
  var estJigyou=0;
  if(oi>0){if(oi<=4000000)estJigyou=Math.round(oi*0.035);else if(oi<=8000000)estJigyou=Math.round(4000000*0.035+(oi-4000000)*0.053);else estJigyou=Math.round(4000000*0.035+4000000*0.053+(oi-8000000)*0.07);}
  const estTax=oi>0?Math.round(oi*0.15)+Math.round(Math.round(oi*0.15)*0.103)+estJigyou+Math.round(estJigyou*0.37)+Math.round(Math.round(oi*0.15)*0.07)+70000:0;
  const ct=journalCt>0?journalCt:estTax;
  const estTaxVal=estTax;
  const ni=oi-ct;
  // B/S: journal + 시가 조정 (평가손 실시간 반영)
  const deposit=acctBal('110');
  const secDep=acctBal('191');
  const secBookVal=acctBal('130'); // 전표 장부가
  const secMV=c.allMv;
  const journalEvalLoss=acctBal('542'); // 전표상 평가손
  const evalAdj=-evalPL-journalEvalLoss; // 시가 조정액 (양수=장부가 감액, 음수=장부가 증액)
  const secForBS=secBookVal-evalAdj; // 시가 반영 유가증권
  const cashT=deposit+secDep;
  // Other assets (fixed assets, prepaid, etc.) — all asset accounts except 110, 191, 130
  let otherAssets=0;
  D.accts.filter(function(ac){return ac.g==='자산'&&ac.c!=='110'&&ac.c!=='191'&&ac.c!=='130';}).forEach(function(ac){otherAssets+=acctBal(ac.c);});
  const totA=cashT+secForBS+otherAssets;
  // Liabilities + Equity: all from journals
  const liabCodes=['200','201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','220','221','222','223','224','225','226','227','228'];
  let totL=0;liabCodes.forEach(c2=>{totL+=acctBal(c2);});
  // Equity: from journals
  const capitalBal=acctBal('300')+acctBal('301')+acctBal('302');
  const retainedBal=acctBal('310')+acctBal('311')+acctBal('312');
  // 이익잉여금 = journal retained + current period NI (if not yet closed)
  const eqNI=ni;
  const totE=capitalBal+retainedBal+eqNI;
  return {sgaT,su,ol,noiT:noiTWithEval,evalGain,evalLoss,interestPay,secFee,noeT,oi,ct,ni,deposit,secDep,secBookVal,secForBS,secMV,cashT,otherAssets,totA,totL,capitalBal,eqNI,totE,evalAdj};
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


function showSyncModal(){
  showModal('☁️ Firebase 동기화',
    '<div style="text-align:center;padding:10px">'+
    '<div style="font-size:12px;color:#64748b;margin-bottom:16px">'+(fbReady?'<span style="color:#059669">✅ Firebase 연결됨</span>':'<span style="color:#dc2626">❌ Firebase 미연결</span>')+'</div>'+
    '<div style="display:flex;gap:12px;justify-content:center">'+
    '<button class="bt" onclick="doFbUpload().then(()=>{closeModal();})" style="background:#d97706;padding:12px 24px;font-size:14px">📤 업로드<br><span style="font-size:10px">PC → 서버</span></button>'+
    '<button class="bt" onclick="doFbDownload().then(()=>{closeModal();})" style="background:#2563eb;padding:12px 24px;font-size:14px">📥 다운로드<br><span style="font-size:10px">서버 → 이 기기</span></button>'+
    '</div>'+
    '<div style="font-size:10px;color:#94a3b8;margin-top:12px">마지막 저장: '+(D._lastSaved?D._lastSaved.slice(0,16):'없음')+'</div>'+
    '</div>');
}


// ===== 증빙 첨부 (base64) =====
function compressImage(file,maxW,cb){
  var reader=new FileReader();
  reader.onload=function(e){
    if(file.type==='application/pdf'){
      cb({data:e.target.result,name:file.name,type:file.type,size:file.size});return;
    }
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height;
      if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
      var canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      var data=canvas.toDataURL('image/jpeg',0.7);
      cb({data:data,name:file.name,type:'image/jpeg',size:data.length});
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function attachReceipt(slipId){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*,.pdf';
  input.capture='environment';
  input.onchange=function(e){
    var file=e.target.files[0];
    if(!file)return;
    if(file.size>10*1024*1024){alert('파일 크기는 10MB 이하만 가능합니다');return;}
    toast('처리 중...','info');
    compressImage(file,800,function(result){
      if(result.size>500000&&result.type!=='application/pdf'){
        // Re-compress smaller
        compressImage(file,500,function(r2){doAttach(slipId,r2);});
      }else{
        doAttach(slipId,result);
      }
    });
  };
  input.click();
}

function doAttach(slipId,result){
  var j=D.journals.find(function(x){return x.id===slipId;});
  if(j){
    if(!j.receipts)j.receipts=[];
    j.receipts.push({name:result.name,data:result.data,type:result.type});
    saveD();
    toast('증빙 첨부 완료: '+result.name);
    viewSlip(slipId);
  }
}

function removeReceipt(slipId,idx){
  if(!confirm('증빙을 삭제하시겠습니까?'))return;
  var j=D.journals.find(function(x){return x.id===slipId;});
  if(j&&j.receipts){
    j.receipts.splice(idx,1);
    saveD();
    toast('증빙 삭제 완료');
    viewSlip(slipId);
  }
}

function viewReceipt(slipId,idx){
  var j=D.journals.find(function(x){return x.id===slipId;});
  if(!j||!j.receipts||!j.receipts[idx])return;
  var r=j.receipts[idx];
  if(r.data&&r.data.startsWith('data:image')){
    // Show overlay on top of modal (not replacing it)
    var ov=document.createElement('div');
    ov.id='receiptOverlay';
    ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:11000;display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer';
    ov.innerHTML='<div style="color:#fff;font-size:12px;margin-bottom:8px">📎 '+r.name+' <span style="font-size:10px;color:#94a3b8">(탭하여 닫기)</span></div><img src="'+r.data+'" style="max-width:90%;max-height:80vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.3)">';
    ov.onclick=function(){ov.remove();};
    document.body.appendChild(ov);
  }else if(r.data&&r.data.startsWith('data:application/pdf')){
    var win=window.open();
    win.document.write('<iframe src="'+r.data+'" style="width:100%;height:100%;border:none"></iframe>');
  }else if(r.url){
    window.open(r.url,'_blank');
  }
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
    // Merge: keep ACCT_INIT + user-added custom accounts
if(!D.customAccts)D.customAccts=[];
if(D._oiAccts)OI_ACCTS=D._oiAccts;
D.accts=ACCT_INIT.concat(D.customAccts);
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


function updateTaxJournal(){
  const d=dynamicFS();
  const oi=d.oi;
  // Progressive business tax (same as rTxTab)
  const houjinzei=oi>0?Math.round(oi*0.15):0;
  const chihou=Math.round(houjinzei*0.103);
  var jigyou=0;
  if(oi>0){
    if(oi<=4000000) jigyou=Math.round(oi*0.035);
    else if(oi<=8000000) jigyou=Math.round(4000000*0.035+(oi-4000000)*0.053);
    else jigyou=Math.round(4000000*0.035+4000000*0.053+(oi-8000000)*0.07);
  }
  const tokubetsu=Math.round(jigyou*0.37);
  const tomin=Math.round(houjinzei*0.07);
  const kintou=70000;
  const newTax=houjinzei+chihou+jigyou+tokubetsu+tomin+kintou;
  const currentTax=acctBal('550');
  
  const info='법인세 전표 갱신\n\n'+
    '현재 전표: '+fm(currentTax)+'\n'+
    '추정 세액: '+fm(newTax)+'\n'+
    '차이: '+fm(newTax-currentTax)+'\n\n';
  
  if(newTax===currentTax){alert('조정 불필요 (동일 금액)');return;}
  
  // Find existing 550 journal (dr=550)
  const existing=D.journals.find(j=>j.dr==='550');
  
  if(existing && confirm(info+'기존 법인세 전표('+existing.no+')를 갱신하시겠습니까?')){
    existing.amt=newTax;
    existing.desc='법인세등 (추정갱신 '+new Date().toISOString().slice(0,10)+')';
    saveD();
    toast('법인세 전표 갱신 완료: '+fm(newTax));
    go('fs');
  } else if(!existing && confirm(info+'법인세 전표가 없습니다. 새로 생성하시겠습니까?')){
    D.journals.push({id:nid(),dt:todayStr(),no:'TAX01',desc:'법인세등 (추정)',dr:'550',cr:'205',amt:newTax});
    saveD();
    toast('법인세 전표 생성 완료: '+fm(newTax));
    go('fs');
  }
}


function rVendorSummary(){
  const summary={};
  D.journals.forEach(j=>{
    const v=j.vendor||'(미지정)';
    if(!summary[v])summary[v]={count:0,drTotal:0,crTotal:0,accounts:new Set()};
    summary[v].count++;
    summary[v].drTotal+=j.amt;
    summary[v].accounts.add(j.dr);
    summary[v].accounts.add(j.cr);
  });
  const sorted=Object.entries(summary).sort((a,b)=>b[1].drTotal-a[1].drTotal);
  let rows='';
  sorted.forEach(([name,s],i)=>{
    rows+='<tr class="'+(i%2?'a':'')+'" style="cursor:pointer" onclick="filterByVendor(\''+name.replace(/'/g,"\\'")+'\')">';
    rows+='<td><b>'+name+'</b></td>';
    rows+='<td class="r m">'+s.count+'건</td>';
    rows+='<td class="r m">'+fm(s.drTotal)+'</td>';
    rows+='<td class="mu" style="font-size:10px">'+ [...s.accounts].filter(a=>a).slice(0,4).map(a=>{const ac=D.accts.find(x=>x.c===a);return ac?ac.k:a;}).join(', ')+'</td>';
    rows+='</tr>';
  });
  return '<table><thead><tr><th>거래처</th><th class="r">전표수</th><th class="r">거래총액</th><th>관련 계정</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

function filterByVendor(name){
  go('jrn');
  setTimeout(function(){
    var sel=document.getElementById('jrn_vendor');
    if(sel){
      // Find matching option
      for(var i=0;i<sel.options.length;i++){
        if(sel.options[i].value===name){sel.selectedIndex=i;break;}
      }
      // Also try search
      var search=document.getElementById('jrn_search');
      if(search&&name!=='(미지정)') search.value=name;
      filterJrn();
    }
  },200);
}


// ===== Expense Drill-down =====
function expDrill(acctCode,mo){
  var acct=D.accts.find(function(x){return x.c===acctCode;});
  var acctName=acct?acct.k:acctCode;
  var moNum=parseInt(mo);
  var monthLabel=moNum+'월';
  var matched=D.journals.filter(function(j){
    var m=j.dt.match(/(\d+)\//);if(!m)return false;
    var jmo=String(parseInt(m[1])).padStart(2,'0');
    return jmo===mo&&(j.dr===acctCode||j.cr===acctCode);
  });
  var rows='';var total=0;
  matched.forEach(function(j,i){
    var amt=j.dr===acctCode?j.amt:-j.amt;
    total+=amt;
    rows+='<tr class="'+(i%2?'a':'')+'" onclick="closeModal();viewSlip('+j.id+')" style="cursor:pointer"><td class="mu" style="font-size:10px">'+jDispDate(j)+'</td><td style="font-size:10px;color:#2563eb">'+j.no+'</td><td>'+j.desc+'</td><td class="r m">'+(amt>=0?'':'-')+fm(Math.abs(amt))+'</td></tr>';
  });
  if(matched.length===0) rows='<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">해당 내역 없음</td></tr>';
  showModal('📊 '+acctName+' — '+monthLabel+' 상세',
    '<div style="font-size:11px;color:#64748b;margin-bottom:8px">'+matched.length+'건 | 합계: '+fm(total)+'</div>'+
    '<div style="max-height:400px;overflow-y:auto"><table><thead><tr><th>일자</th><th>전표</th><th>적요</th><th class="r">금액</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div style="font-size:9px;color:#94a3b8;margin-top:8px">전표를 클릭하면 상세보기로 이동합니다</div>'
  );
}

function showExpenseTab(btn){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on');});
  btn.classList.add('on');
  var tc=document.getElementById('TC');
  if(tc) tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">📊 월별 비용분석</div>'+rExpenseAnalysis()+'</div>';
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



// ===== Undo =====
var _undoStack=[];
function saveUndo(action,data){
  _undoStack.push({action:action,data:JSON.parse(JSON.stringify(data)),time:new Date().toISOString()});
  if(_undoStack.length>10)_undoStack.shift();
}
function doUndo(){
  if(_undoStack.length===0){toast('되돌릴 작업이 없습니다','error');return;}
  var last=_undoStack.pop();
  if(last.action==='delete'){
    D.journals.push(last.data);
    saveD();toast('전표 삭제 취소: '+last.data.desc);go('jrn');
  }else if(last.action==='edit'){
    var j=D.journals.find(function(x){return x.id===last.data.id;});
    if(j){Object.assign(j,last.data);saveD();toast('전표 수정 취소');go('jrn');}
  }else if(last.action==='create'){
    D.journals=D.journals.filter(function(x){return x.id!==last.data.id;});
    saveD();toast('전표 생성 취소: '+last.data.desc);go('jrn');
  }
}


// ===== Slip Number Generator =====
function genSlipNo(edt,drCode,crCode){
  var parts=(edt||'').split('-');
  var yr=parseInt(parts[0]||'2026');
  var mo=parseInt(parts[1]||'1');
  // Fiscal year: 6월~5월
  var ki=(mo>=6&&yr===2025)?1:(mo<=5&&yr===2026)?1:2;
  var moStr=String(mo).padStart(2,'0');
  // Type: determine from accounts
  var type='GL';
  var dr=drCode||'';var cr=crCode||'';
  if(dr==='130'||cr==='130'||dr==='191'||cr==='191')type='SC'; // Securities
  else if(dr==='110'||cr==='110')type='BK'; // Bank
  else if(dr==='550'||cr==='550'||dr==='205'||cr==='205')type='TX'; // Tax
  else if(dr.startsWith('5')||cr.startsWith('4'))type='GL'; // General
  // Count existing for this ki-mo-type
  var prefix=ki+'-'+moStr+'-'+type+'-';
  var existing=D.journals.filter(function(j){return j.no&&j.no.startsWith(prefix);}).length;
  return prefix+String(existing+1).padStart(4,'0');
}


// ===== Monthly Expense Analysis =====
function rExpenseAnalysis(){
  var months=['06','07','08','09','10','11','12','01','02','03','04','05'];
  var monthLabels=['6월','7월','8월','9월','10월','11월','12월','1월','2월','3월','4월','5월'];
  // Get all expense accounts with any balance
  var expAccts=[];
  D.accts.filter(function(ac){return ac.g==='비용';}).forEach(function(ac){
    var total=acctBal(ac.c);
    if(total!==0)expAccts.push({c:ac.c,k:ac.k,total:total});
  });
  // 154 가지급소비세도 표시 (환급 대상 자산이지만 비용분석에서 참고용)
  var tax154=acctBal('154');
  if(tax154!==0) expAccts.push({c:'154',k:'가지급소비세 (매입세액)',total:tax154});
  expAccts.sort(function(a,b){return b.total-a.total;});
  
  // Monthly breakdown
  var monthlyData={};
  months.forEach(function(m){monthlyData[m]=0;});
  var acctMonthly={};
  expAccts.forEach(function(ac){acctMonthly[ac.c]={};months.forEach(function(m){acctMonthly[ac.c][m]=0;});});
  
  D.journals.forEach(function(j){
    var m=j.dt.match(/(\d+)\//);if(!m)return;
    var mo=String(parseInt(m[1])).padStart(2,'0');
    if(months.indexOf(mo)<0)return;
    expAccts.forEach(function(ac){
      if(j.dr===ac.c)acctMonthly[ac.c][mo]+=j.amt;
      if(j.cr===ac.c)acctMonthly[ac.c][mo]-=j.amt;
    });
    // Total expense by month
    var isExp=expAccts.some(function(ac){return j.dr===ac.c;});
    if(isExp)monthlyData[mo]+=j.amt;
  });
  
  // Grand total
  var grandTotal=expAccts.reduce(function(s,ac){return s+ac.total;},0);
  
  // Build chart (simple bar)
  var maxMonth=Math.max.apply(null,months.map(function(m){return monthlyData[m];}));
  var chartHtml='<div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin:10px 0;padding:10px 0;border-bottom:1px solid #e2e6ed">';
  months.forEach(function(m,i){
    var val=monthlyData[m];
    var h=maxMonth>0?Math.max(2,Math.round(val/maxMonth*100)):0;
    chartHtml+='<div style="flex:1;text-align:center"><div style="background:#3b82f6;height:'+h+'px;border-radius:3px 3px 0 0;margin:0 2px" title="'+monthLabels[i]+': '+fm(val)+'"></div><div style="font-size:8px;color:#64748b;margin-top:2px">'+monthLabels[i].slice(0,-1)+'</div></div>';
  });
  chartHtml+='</div>';
  
  // Pie-like summary (horizontal bar)
  var pieHtml='<div style="margin:10px 0">';
  var colors=['#3b82f6','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d','#c2410c','#6366f1'];
  expAccts.forEach(function(ac,i){
    var pct=grandTotal>0?((ac.total/grandTotal)*100).toFixed(1):'0';
    var w=grandTotal>0?Math.max(2,Math.round(ac.total/grandTotal*100))+'%':'0%';
    pieHtml+='<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px"><span style="width:10px;height:10px;background:'+colors[i%10]+';border-radius:2px;flex-shrink:0"></span><span style="width:100px;flex-shrink:0">'+ac.k+'</span><div style="flex:1;background:#f1f5f9;border-radius:3px;height:14px"><div style="width:'+w+';background:'+colors[i%10]+';height:100%;border-radius:3px"></div></div><span style="width:80px;text-align:right;font-weight:600">'+fm(ac.total)+'</span><span style="width:40px;text-align:right;color:#64748b">'+pct+'%</span></div>';
  });
  pieHtml+='<div style="display:flex;justify-content:flex-end;padding-top:6px;border-top:1px solid #e2e6ed;font-weight:700;font-size:12px">합계: '+fm(grandTotal)+'</div></div>';
  
  // Detail table
  var tableHtml='<div style="overflow-x:auto;margin-top:10px"><table style="font-size:10px"><thead><tr><th>계정</th>';
  monthLabels.forEach(function(l){tableHtml+='<th class="r">'+l+'</th>';});
  tableHtml+='<th class="r" style="font-weight:700">합계</th></tr></thead><tbody>';
  expAccts.forEach(function(ac,i){
    tableHtml+='<tr class="'+(i%2?'a':'')+'"><td style="white-space:nowrap">'+ac.k+'</td>';
    months.forEach(function(m){
      var v=acctMonthly[ac.c][m];
      tableHtml+='<td class="r m" '+(v?'style="cursor:pointer;color:#2563eb" onclick="expDrill(\''+ac.c+'\',\''+m+'\')">'+fm(v):'>')+' </td>';
    });
    tableHtml+='<td class="r m b">'+fm(ac.total)+'</td></tr>';
  });
  // Total row
  tableHtml+='<tr class="t"><td>합계</td>';
  months.forEach(function(m){tableHtml+='<td class="r m">'+fm(monthlyData[m])+'</td>';});
  tableHtml+='<td class="r m">'+fm(grandTotal)+'</td></tr>';
  tableHtml+='</tbody></table></div>';
  
  return chartHtml+pieHtml+tableHtml;
}


// ===== One-time ADJ fix =====
function fixAdjEntries(){
  var fixed=0;
  D.journals.forEach(function(j){
    if(j.no==='ADJ01'){j.dt='9/18';j.no='S0671';j.desc='IPO증거금 증권이체';fixed++;}
    if(j.no==='ADJ02'){j.dt='3/18';j.no='S0900';j.desc='매수수수료 취득원가 반영(보유종목분)';fixed++;}
    if(j.no==='ADJ03'){j.dt='3/18';j.no='S0901';j.desc='유가증권 취득원가 정정(수수료분)';fixed++;}
    if(j.no==='ADJ04'){j.dt='3/9';j.no='S0902';j.desc='매각이익 반올림 조정';fixed++;}
  });
  if(fixed>0){saveD();toast(fixed+'건 조정전표 정정 완료');go('jrn');}
  else{toast('수정할 조정전표가 없습니다','info');}
}

// ===== Toast Notification =====
function toast(msg,type){
  type=type||'success';
  var t=document.createElement('div');
  t.style.cssText='position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:13px;font-weight:600;z-index:10000;opacity:0;transition:opacity 0.3s;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.15)';
  t.style.background=type==='success'?'#059669':type==='error'?'#dc2626':'#2563eb';
  t.textContent=(type==='success'?'✅ ':type==='error'?'❌ ':'ℹ️ ')+msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='1';},50);
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove();},300);},2500);
}

// ===== UTILS =====
const fm=n=>n==null?"-":new Intl.NumberFormat("ja-JP").format(Math.round(n));
const fy=n=>n==null?"-":"¥"+fm(n);
const bg=v=>'<span class="bg '+(v>=0?'p':'n')+'">'+(v>=0?'+':'')+fm(v)+'</span>';
function rptDt(){return SET.reportDate||new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});}
// 전표 날짜 유틸: dt("3/20") → 연도 포함 풀 날짜
function jFullDate(j){
  if(j.edt) return j.edt; // 2026-04-08 형식
  var m=j.dt.match(/(\d+)\/(\d+)/);if(!m) return '2025-06-01';
  var mo=parseInt(m[1]),day=parseInt(m[2]);
  var yr=(mo>=6)?2025:2026; // 회계연도: 6~12=2025, 1~5=2026
  return yr+'-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function jDispDate(j){
  var fd=jFullDate(j);
  return fd.replace(/-/g,'/'); // 2025/07/09
}
function jSortKey(j){return jFullDate(j);} // ISO format for sorting

function calc(){
  const jpMv=D.holdJP.reduce((s,h)=>s+h.mv,0),jpC=D.holdJP.reduce((s,h)=>s+h.tc,0);
  const usMv=D.holdUS.reduce((s,h)=>s+h.mv,0),usC=D.holdUS.reduce((s,h)=>s+h.tc,0);
  const tI=D.bkIn.reduce((s,d)=>s+d.amt,0),tO=D.bkOut.reduce((s,d)=>s+d.amt,0);
  const rpl=D.real.reduce((s,r)=>s+r.net,0),rC=D.real.reduce((s,r)=>s+r.tc,0),rS=D.real.reduce((s,r)=>s+r.sa,0);
  const bb=tI-tO,secDep=D.secDeposit||SEC_DEP,secBal=secDep+jpMv+usMv;
  // Include other asset balances (fixed assets etc.) for complete total
  let otherA=0;
  D.accts.filter(function(ac){return ac.g==='자산'&&ac.c!=='110'&&ac.c!=='191'&&ac.c!=='130';}).forEach(function(ac){otherA+=acctBal(ac.c);});
  return {jpMv,jpC,usMv,usC,allMv:jpMv+usMv,allC:jpC+usC,allPl:jpMv+usMv-jpC-usC,rpl,rC,rS,tI,tO,bb,secDep,secBal,totA:bb+secBal+otherA};
}

function showModal(title,html){document.getElementById('modal').innerHTML='<div class="mo" onclick="closeModal()"><div class="mc" onclick="event.stopPropagation()"><h3>'+title+'</h3>'+html+'</div></div>';document.getElementById('modal').classList.remove('hidden');}
function closeModal(){document.getElementById('modal').classList.add('hidden');}


// ===== CRUD & PAGES =====
function addBkIn(){showModal('입금 내역추가',`<div class="fg"><div><label>날짜</label><input type="date" id="f_dt"></div><div><label>구분</label><input id="f_cat" placeholder="구분(내역)"></div><div><label>분류</label><select id="f_type"><option value="income">수익</option><option value="capital">자본금</option><option value="loan">차입금 (부채)</option><option value="sec">증권이체</option></select></div><div><label>금액 (엔)</label><input type="number" id="f_amt" placeholder="0"></div><div style="display:flex;gap:8px;justify-content:flex-end;align-items:end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt gn" onclick="doAddBkIn()">추가</button></div></div>`);}
function doAddBkIn(){const dt=document.getElementById('f_dt').value,cat=document.getElementById('f_cat').value,amt=Number(document.getElementById('f_amt').value),type=document.getElementById('f_type').value;if(!dt||!amt)return alert('날짜와 금액을 입력하세요');D.bkIn.push({id:nid(),dt,cat,amt,type});saveD();closeModal();toast('입금 내역 추가 완료');go('bank');}
function addBkOut(){showModal('출금 내역추가',`<div class="fg"><div><label>날짜</label><input type="date" id="f_dt"></div><div><label>구분</label><input id="f_cat" placeholder="구분(내역)"></div><div><label>분류</label><select id="f_type"><option value="expense">경비</option><option value="sec">증권이체</option><option value="loan">차입금상환 (부채)</option><option value="other">기타</option></select></div><div><label>금액 (엔)</label><input type="number" id="f_amt" placeholder="0"></div><div style="display:flex;gap:8px;justify-content:flex-end;align-items:end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt rd" onclick="doAddBkOut()">추가</button></div></div>`);}
function doAddBkOut(){const dt=document.getElementById('f_dt').value,cat=document.getElementById('f_cat').value,amt=Number(document.getElementById('f_amt').value),type=document.getElementById('f_type').value;if(!dt||!amt)return alert('날짜와 금액을 입력하세요');D.bkOut.push({id:nid(),dt,cat,amt,type});saveD();closeModal();toast('출금 내역 추가 완료');go('bank');}
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
  saveD();closeModal();toast('종목 수정 완료');go('sec');
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
  saveD();closeModal();toast('종목 수정 완료');go('sec');
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
    '<div><label style="font-size:10px;color:#64748b">일자</label><div>'+jDispDate(j)+(j.edt?' (증빙:'+j.edt+')':'')+'</div></div>'+
    '<div style="grid-column:1/-1"><label style="font-size:10px;color:#64748b">적요</label><div style="font-weight:600">'+j.desc+'</div></div>'+
    '</div>'+
    '<table style="margin-top:14px"><thead><tr><th>차/대</th><th>계정과목</th><th>코드</th><th class="r">금액</th></tr></thead>'+
    '<tbody>'+
    '<tr style="background:#dbeafe"><td style="color:#2563eb;font-weight:700">차변</td><td style="font-weight:600">'+drNm+'</td><td class="mu">'+j.dr+'</td><td class="r m b">'+fm(j.amt)+'</td></tr>'+
    '<tr style="background:#fee2e2"><td style="color:#dc2626;font-weight:700">대변</td><td style="font-weight:600">'+crNm+'</td><td class="mu">'+j.cr+'</td><td class="r m b">'+fm(j.amt)+'</td></tr>'+
    '</tbody></table>'+
    (j.vendor?'<div style="margin-top:8px;font-size:11px;color:#64748b">거래처: <b style="color:#d97706">'+j.vendor+'</b></div>':'')+(j.cur?'<div style="font-size:11px;color:#64748b">통화: '+j.cur+'</div>':'')+(j.taxCls?'<div style="font-size:11px;color:#64748b">소비세: '+j.taxCls+'</div>':'')+
    (j.exp?'<div style="font-size:11px;color:#64748b">원가구분: '+(j.exp==="s"?"판관비":j.exp==="c"?"매출원가":j.exp==="o"?"영업외":"특별")+'</div>':'')+
    '<div style="margin-top:12px;border-top:1px solid #e2e6ed;padding-top:10px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600">📎 증빙</span><button class="bt gh" style="font-size:10px" onclick="attachReceipt('+id+')">+ 첨부</button></div>'+
    (j.receipts&&j.receipts.length>0?j.receipts.map(function(r,i){return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px"><span onclick="viewReceipt('+id+','+i+')" style="color:#2563eb;cursor:pointer">📄 '+r.name+'</span><button onclick="removeReceipt('+id+','+i+')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:10px">✕</button></div>';}).join(''):'<div style="font-size:10px;color:#94a3b8;padding:4px 0">첨부된 증빙 없음</div>')+
    '</div>'+
    '<div style="margin-top:12px;display:flex;gap:8px;justify-content:space-between">'+
    '<button class="bt" style="background:#dc2626" onclick="delSlip('+id+')">🗑</button>'+
    '<div style="display:flex;gap:6px"><button class="bt" style="background:#d97706" onclick="copySlip('+id+')">📋 복사</button><button class="bt" onclick="editSlip('+id+')">✏️ 수정</button><button class="bt gh" onclick="closeModal()">닫기</button></div>'+
    '</div>');
}
function delSlip(id){
  if(!confirm("이 전표를 삭제하시겠습니까?\n삭제하면 총계정원장과 재무제표에도 반영됩니다."))return;
  var delJ=D.journals.find(x=>x.id===id);if(delJ)saveUndo('delete',delJ);D.journals=D.journals.filter(x=>x.id!==id);
  saveD();closeModal();go("jrn");
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
  D.bkIn.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');}).forEach((d,i)=>{cI+=d.amt;const bg2=i%2?'background:#f5f5f5;':'';
    bkInRows+='<tr><td style="'+S+bg2+'color:#888">'+d.dt+'</td><td style="'+S+bg2+'">'+d.cat+'</td><td style="'+HR+bg2+G+'">'+fm(d.amt)+'</td><td style="'+HB+bg2+'">'+fm(cI)+'</td></tr>';});
  let bkOutRows='',cO=0;
  D.bkOut.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');}).forEach((d,i)=>{cO+=d.amt;const bg2=i%2?'background:#f5f5f5;':'';
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
<tr><td style="${S}background:#e8e8e8;font-weight:bold">총보유자산합계</td><td style="${HB}background:#e8e8e8">${fm(c.bb+c.secBal)}</td><td style="${S}background:#e8e8e8;color:#888">(1)+(2)</td></tr>
${c.totA!==(c.bb+c.secBal)?`<tr><td style="${S}background:#dbeafe;font-weight:bold;color:#2563eb">총보유자산합계 (소비세환급시)</td><td style="${HB}background:#dbeafe;color:#2563eb">${fm(c.totA)}</td><td style="${S}background:#dbeafe;color:#888;font-size:9pt">가지급소비세 ${fm(c.totA-c.bb-c.secBal)} 포함</td></tr>`:''}</table>

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
      if(newCpUsd !== h.cpUsd || newRate !== h.rate){
        h.cpUsd = newCpUsd;
        h.rate = newRate;
        h.mv = Math.round(h.sh * newCpUsd * newRate);
        changed++;
      }
    }
  });
  // 외화예수금 평가환율 자동 갱신
  if(D.fxSecDeposit&&D.fxSecDeposit.USD&&D.fxSecDeposit.USD.amt>0){
    D.fxSecDeposit.USD.curRate=newRate;
  }
  saveD();
  closeModal();
  go('sec');
  alert(changed + '종목 현재가가 업데이트되었습니다.');
}

// ===== SLIP (전표작성) =====
function addSlipRow(){const tb=document.getElementById('slipRows');const id=nid();tb.insertAdjacentHTML('beforeend','<tr id="sr_'+id+'"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px"><option value="dr">차변</option><option value="cr">대변</option></select></td><td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%" onchange="slipAutoFill(this.closest(&quot;tr&quot;))">'+acctOptions()+'</select></td><td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td><td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td><td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td><td><button class="del" onclick="document.getElementById(\'sr_'+id+'\').remove();updSlipBal()">✕</button></td></tr>');}

// ===== 전표 자동완성 (계정 선택 시 반대편 추천) =====
var ACCT_PAIRS={
  // 비용 → 대변 추천
  '520':'110','521':'110','522':'110','523':'110','524':'110','525':'110',
  '526':'110','527':'110','528':'110','529':'110','530':'110','531':'110',
  '532':'110','533':'110','534':'110','535':'110','536':'110','537':'191',
  '538':'110','539':'110','540':'224','547':'110','548':'110','549':'110',
  '550':'205','560':'110','570':'110','580':'110',
  // 수익 → 차변 추천
  '401':'110','402':'191','403':'191','405':'110',
  // 자산 이동
  '130':'191','191':'110','110':'221',
  // 부채
  '221':'110','203':'110','205':'550','224':'540'
};

function slipAutoFill(changedRow){
  var rows=document.querySelectorAll('#slipRows tr');
  if(rows.length<2)return;
  var side=changedRow.querySelector('.sl_side').value;
  var acct=changedRow.querySelector('.sl_acct').value;
  if(!acct)return;
  
  var suggested=ACCT_PAIRS[acct];
  if(!suggested)return;
  
  // Find the other row (opposite side)
  var otherRow=null;
  rows.forEach(function(r){
    if(r!==changedRow){
      var oSide=r.querySelector('.sl_side').value;
      var oAcct=r.querySelector('.sl_acct').value;
      if(oSide!==side && !oAcct) otherRow=r;
    }
  });
  
  if(otherRow){
    var sel=otherRow.querySelector('.sl_acct');
    if(sel&&!sel.value){
      sel.value=suggested;
      // Copy amount too if empty
      var srcAmt=changedRow.querySelector('.sl_amt').value;
      var dstAmt=otherRow.querySelector('.sl_amt');
      if(dstAmt&&!dstAmt.value&&srcAmt) dstAmt.value=srcAmt;
      updSlipBal();
    }
  }
}

function acctOptions(){return '<option value="">--</option>'+["자산","부채","순자산","수익","비용"].map(g=>`<optgroup label="${g}">${D.accts.filter(a=>a.g===g).map(a=>`<option value="${a.c}">${a.c} ${a.k}</option>`).join('')}</optgroup>`).join('');}
function updSlipBal(){let dr=0,cr=0;document.querySelectorAll('#slipRows tr').forEach(r=>{const s=r.querySelector('.sl_side').value,a=+(r.querySelector('.sl_amt').value)||0;if(s==='dr')dr+=a;else cr+=a;});const ok=dr===cr&&dr>0;document.getElementById('slipBal').innerHTML='<span>차변: <b>'+fm(dr)+'</b></span><span>대변: <b>'+fm(cr)+'</b></span><span style="font-weight:700;color:'+(ok?'#059669':'#dc2626')+'">'+(ok?'✓ 차대일치':'✗ 불일치')+'</span>';document.getElementById('slipSubmit').style.background=ok?'#059669':'#94a3b8';}
function submitSlip(){var vsel=document.getElementById("sl_vendor_sel"),vinp=document.getElementById("sl_vendor_inp");var vendor=(vsel&&vsel.value)?vsel.value:(vinp?vinp.value:"");if(vendor)addVendor(vendor);let dr=0,cr=0;const rows=[];document.querySelectorAll('#slipRows tr').forEach(r=>{const s=r.querySelector('.sl_side').value,ac=r.querySelector('.sl_acct').value,a=+(r.querySelector('.sl_amt').value)||0,exp=r.querySelector('.sl_exp')?.value||'',taxr=r.querySelector('.sl_taxr')?.value||'0';var txC=r.querySelector('.sl_taxcls');var taxCls=txC?txC.value:'';if(ac&&a>0){rows.push({side:s,ac,amt:a,exp,taxr,taxCls});if(s==='dr')dr+=a;else cr+=a;}});if(dr!==cr||dr===0)return alert('차대가 일치하지 않습니다');
const edt=document.getElementById('sl_edt').value,pdt=document.getElementById('sl_pdt').value,desc=document.getElementById('sl_desc').value,cur=document.getElementById('sl_cur').value;
  if(!desc.trim())return alert('적요를 입력하세요');
  if(!edt)return alert('전표일자를 입력하세요');
  // vendor is optional
  // Check all rows have 원가구분
  // 원가구분 optional
const mo=String(parseInt(edt.split('-')[1]||'1'));const dt=mo+'/'+String(parseInt(edt.split('-')[2]||'1'));const no=genSlipNo(edt,rows[0]?rows[0].ac:'',rows[1]?rows[1].ac:'');const drRows=rows.filter(r=>r.side==='dr'),crRows=rows.filter(r=>r.side==='cr');var _newSlipId=nid();var _isEdit=!!window._editSlipId;if(!_isEdit&&!confirm('전표를 생성하시겠습니까?\n\n적요: '+desc+'\n금액: '+fm(dr)))return;drRows.forEach(d=>{crRows.forEach(c=>{const ratio=c.amt/cr,amt=Math.round(d.amt*ratio);var tC=d.taxCls||c.taxCls||'';if(window._editSlipId){var ej=D.journals.find(x=>x.id===window._editSlipId);if(ej){saveUndo('edit',ej);ej.dt=dt;ej.desc=desc;ej.dr=d.ac;ej.cr=c.ac;ej.amt=amt;ej.edt=edt;ej.pdt=pdt;ej.cur=cur;ej.exp=d.exp||c.exp;ej.vendor=vendor;ej.taxCls=tC;}window._editSlipId=null;}else{
// 세빼기: 과세거래 자동분리 (본체 + 소비세)
var mainAmt=amt,taxAmt=0;
if(tC==='과세10%'||tC==='경감8%'){
  var rate=tC==='경감8%'?8:10;
  taxAmt=Math.round(amt*rate/(100+rate));
  mainAmt=amt-taxAmt;
}
var newJ={id:_newSlipId,dt,no,desc,dr:d.ac,cr:c.ac,amt:mainAmt,edt,pdt,cur,exp:d.exp||c.exp,vendor:vendor,taxCls:tC};D.journals.push(newJ);saveUndo('create',newJ);
// 소비세 분리 전표 자동생성
if(taxAmt>0){
  var drAcct=D.accts.find(function(a){return a.c===d.ac;});
  var crAcct=D.accts.find(function(a){return a.c===c.ac;});
  var taxDr=(drAcct&&drAcct.g==='비용')?'154':d.ac; // 비용→가지급소비세
  var taxCr=(crAcct&&crAcct.g==='수익')?'211':c.ac; // 수익→가수소비세
  var taxNo=genSlipNo(edt,taxDr,taxCr);
  var taxJ={id:nid(),dt:dt,no:taxNo,desc:'[소비세] '+desc,dr:taxDr,cr:taxCr,amt:taxAmt,edt:edt,pdt:pdt,cur:cur,exp:'',vendor:vendor,taxCls:tC};
  D.journals.push(taxJ);
}
}});});saveD();
// 영향받은 계정 표시
var impactMsg='';
if(!_isEdit){
  var impacts=[];
  drRows.forEach(function(d){var a=D.accts.find(function(x){return x.c===d.ac;});impacts.push((a?a.k:d.ac)+' +'+fm(d.amt));});
  crRows.forEach(function(c2){var a=D.accts.find(function(x){return x.c===c2.ac;});impacts.push((a?a.k:c2.ac)+' -'+fm(c2.amt));});
  impactMsg=' → '+impacts.join(', ');
}
toast(_isEdit?'전표 수정 완료':'전표 생성 완료: '+desc+impactMsg);go('slip');window.scrollTo(0,0);}
function addAcct(){showModal('계정과목 추가',`<div class="fg"><div><label>코드</label><input id="fa_c"></div><div><label>과목명(한국어)</label><input id="fa_k"></div><div><label>과목명(일본어)</label><input id="fa_n"></div><div><label>구분</label><select id="fa_g"><option value="자산">자산</option><option value="부채">부채</option><option value="순자산">순자산</option><option value="수익">수익</option><option value="비용">비용</option></select></div><div class="full" style="display:flex;gap:8px;justify-content:flex-end"><button class="bt gh" onclick="closeModal()">취소</button><button class="bt" onclick="doAddAcct()">추가</button></div><div class="full" style="font-size:10px;color:#64748b">현재 ${D.accts.length}개 과목</div></div>`);}
function doAddAcct(){const c=document.getElementById('fa_c').value,k=document.getElementById('fa_k').value,n=document.getElementById('fa_n').value||k,g=document.getElementById('fa_g').value;if(!c||!k)return alert('코드와 과목명을 입력하세요');if(D.accts.find(x=>x.c===c))return alert('이미 존재하는 코드입니다');var newAcct={c,n,k,g};D.accts.push(newAcct);if(!D.customAccts)D.customAccts=[];
if(D._oiAccts)OI_ACCTS=D._oiAccts;D.customAccts.push(newAcct);saveD();closeModal();toast('계정과목 추가: '+c+' '+k);go('slip');}

function rSlip(){
  // Group journals by year-month
  const grouped={};
  D.journals.forEach(j=>{
    // Extract month key using jFullDate
    var fd=jFullDate(j);
    var mk=fd.slice(0,7).replace('-','/'); // 2025/07
    if(fd.startsWith('2026-05')&&j.dt&&j.dt.includes('5/31'))mk='2026/05(결산)';
    if(!grouped[mk])grouped[mk]=[];
    grouped[mk].push(j);
  });
  // Sort entries within each group by date
  Object.keys(grouped).forEach(function(k){grouped[k].sort(function(a,b){return jSortKey(a).localeCompare(jSortKey(b));});});
  const sortedKeys=Object.keys(grouped).sort();

  // Slip list with year/month tabs
  const monthBtns=sortedKeys.map(k=>'<button class="bt gh" style="font-size:10px;margin:2px" onclick="filterSlips(\''+k+'\')">'+k+' ('+grouped[k].length+')</button>').join('');

  let allSlips='';
  sortedKeys.forEach(mk=>{
    allSlips+='<div class="slip-month" data-month="'+mk+'"><div style="padding:8px 12px;background:#dbeafe;font-weight:700;font-size:12px;color:#1e3a5f;border-bottom:1px solid #e2e6ed">📅 '+mk+' ('+grouped[mk].length+'건)</div>';
    grouped[mk].forEach(e=>{
      const drNm=acctNm(e.dr),crNm=acctNm(e.cr);
      allSlips+='<div onclick="viewSlip('+e.id+')" style="padding:6px 14px;border-bottom:1px solid #f1f3f6;font-size:11px;display:flex;gap:8px;align-items:center;cursor:pointer" onmouseenter="this.style.background=\'#f0f9ff\'" onmouseleave="this.style.background=\'\'">'+
        '<span class="mu" style="width:70px;font-size:10px">'+jDispDate(e)+'</span>'+
        '<span style="color:#2563eb;width:95px;font-size:10px">'+e.no+'</span>'+
        '<span style="width:180px;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</span>'+
        '<span style="color:#2563eb;width:120px">차 '+drNm+'</span>'+
        '<span style="color:#dc2626;width:120px">대 '+crNm+'</span>'+
        '<span class="m" style="width:90px;text-align:right;font-weight:600">'+fm(e.amt)+'</span>'+
        '</div>';
    });
    allSlips+='</div>';
  });

  return '<div class="pt">전표작성</div>'+
  '<div class="ib">💡 전표 '+D.journals.length+'건 등록 | 전표 → 총계정원장 → 재무제표 자동연동</div>'+
  '<div class="pn" style="padding:14px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #1e3a5f">'+
      '<span style="font-size:16px;font-weight:700;color:#1e3a5f">대체전표</span>'+
      '<div style="border:2px solid #1e3a5f;border-radius:6px;padding:3px 10px;text-align:center"><div style="font-size:7px;color:#64748b">결재</div><div style="font-size:11px;font-weight:700;color:#1e3a5f">본인전결</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">'+
      '<div class="fg"><div><label>증빙일자</label><input type="date" id="sl_edt" value="'+new Date().toISOString().slice(0,10)+'"></div></div>'+
      '<div class="fg"><div><label>전기일자</label><input type="date" id="sl_pdt" value="'+new Date().toISOString().slice(0,10)+'"></div></div>'+
      '<div class="fg"><div><label>적요 <span style="color:#dc2626">*</span></label><input id="sl_desc" placeholder="거래 내용"></div></div>'+
      '<div class="fg"><div><label>통화</label><select id="sl_cur"><option value="JPY">🇯🇵 JPY</option><option value="KRW">🇰🇷 KRW</option><option value="USD">🇺🇸 USD</option></select></div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div class="fg"><div><label>거래처</label><select id="sl_vendor_sel" onchange="var i=document.getElementById(\'sl_vendor_inp\');if(i){i.style.display=this.value?\'none\':\'block\';i.value=this.value;}">'+vendorOptions('')+'</select></div></div><div class="fg"><div><label>직접입력</label><input id="sl_vendor_inp" placeholder="거래처명"></div></div></div>'+
    '<table><thead><tr><th>차/대</th><th>계정과목</th><th>원가구분</th><th>소비세</th><th class="r">금액</th><th></th></tr></thead>'+
    '<tbody id="slipRows">'+
      '<tr id="sr_1"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;background:#dbeafe"><option value="dr">차변</option><option value="cr">대변</option></select></td>'+
      '<td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%" onchange="slipAutoFill(this.closest(&quot;tr&quot;))">'+acctOptions()+'</select></td>'+
      '<td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td>'+
      '<td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td>'+
      '<td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td>'+
      
      '<td></td></tr>'+
      '<tr id="sr_2"><td><select class="sl_side" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;background:#fee2e2"><option value="cr">대변</option><option value="dr">차변</option></select></td>'+
      '<td><select class="sl_acct" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;width:100%" onchange="slipAutoFill(this.closest(&quot;tr&quot;))">'+acctOptions()+'</select></td>'+
      '<td><select class="sl_exp" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="c">매출원가</option><option value="s">판관비</option><option value="o">영업외</option><option value="x">특별</option></select></td>'+
      '<td><select class="sl_taxcls" style="padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:10px"><option value="">-</option><option value="과세10%">과세10%</option><option value="경감8%">경감8%</option><option value="비과세">비과세</option><option value="불과세">불과세</option></select></td>'+
      '<td class="r"><input type="number" class="sl_amt" placeholder="0" style="width:100px;padding:3px;border:1px solid #e2e6ed;border-radius:4px;font-size:11px;text-align:right" oninput="updSlipBal()"></td>'+
      
      '<td></td></tr>'+
    '</tbody></table>'+
    '<div style="margin-top:8px;display:flex;gap:6px"><button class="bt gh" style="font-size:10px" onclick="addSlipRow()">+ 행추가</button><button class="bt gh" style="font-size:10px" onclick="addAcct()">+ 과목추가</button><button class="bt gh" style="font-size:10px" onclick="manageVendors()">👤 거래처</button></div>'+
    '<div id="slipBal" style="margin-top:10px;padding:6px 10px;background:#fee2e2;border-radius:6px;font-size:11px;display:flex;justify-content:space-between"><span>차변: <b>0</b></span><span>대변: <b>0</b></span><span style="font-weight:700;color:#dc2626">✗ 불일치</span></div>'+
    '<div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="bt" id="slipSubmit" style="background:#94a3b8" onclick="submitSlip()">전표생성</button></div>'+
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

function refreshVendorSel(){
  var sel=document.getElementById('sl_vendor_sel');
  if(!sel)return;
  var cur=sel.value;
  sel.innerHTML=vendorOptions(cur);
}
function vendorOptions(sel){if(!D.vendors)D.vendors=[];return '<option value="">(직접입력)</option>'+D.vendors.map(v=>'<option value="'+v.name+'"'+(v.name===sel?' selected':'')+'>'+v.name+'</option>').join('');}
function addVendor(nm){if(!D.vendors)D.vendors=[];if(nm&&!D.vendors.find(v=>v.name===nm)){D.vendors.push({id:nid(),name:nm,note:''});saveD();}}
function manageVendors(){showModal('거래처 관리','<div style="margin-bottom:10px;display:flex;gap:6px"><input id="vn_n" placeholder="거래처명" style="flex:1;padding:5px 8px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px"><input id="vn_t" placeholder="비고" style="width:80px;padding:5px 8px;border:1px solid #e2e6ed;border-radius:4px;font-size:12px"><button class="bt gn" onclick="doAddV()">추가</button></div><table><thead><tr><th>거래처</th><th>비고</th><th></th></tr></thead><tbody>'+D.vendors.map(v=>'<tr><td>'+v.name+'</td><td class="mu">'+(v.note||'')+'</td><td><button class="del" onclick="delV('+v.id+')">✕</button></td></tr>').join('')+'</tbody></table>');}
function doAddV(){var n=document.getElementById('vn_n').value,t=document.getElementById('vn_t').value;if(!n)return;D.vendors.push({id:nid(),name:n,note:t});saveD();manageVendors();refreshVendorSel();}
function delV(id){D.vendors=D.vendors.filter(v=>v.id!==id);saveD();manageVendors();refreshVendorSel();}

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
function editFxDeposit(){
  var fx=D.fxSecDeposit&&D.fxSecDeposit.USD?D.fxSecDeposit.USD:{amt:0,avgRate:0,curRate:SET.rates.USDJPY||0};
  showModal('💵 외화예수금 (USD)',
    '<div style="font-size:11px;color:#64748b;margin-bottom:10px">USD 잔고와 평가환율을 입력하세요. 취득환율은 매수 시점 환율입니다.</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
    '<div><label>USD 잔고</label><input type="number" id="fx_amt" value="'+(fx.amt||0)+'" step="1" placeholder="125000"></div>'+
    '<div><label>취득환율 (JPY/USD)</label><input type="number" id="fx_avg" value="'+(fx.avgRate||0)+'" step="0.0001" placeholder="157.40"></div>'+
    '<div><label>평가환율 (JPY/USD)</label><input type="number" id="fx_cur" value="'+(fx.curRate||SET.rates.USDJPY||0)+'" step="0.0001" placeholder="157.18"></div>'+
    '<div style="grid-column:1/3"><div style="font-size:10px;color:#94a3b8">취득금액 = USD × 취득환율 (장부가) / 평가금액 = USD × 평가환율 (시가) / 차액 = 평가손익</div></div>'+
    '</div>'+
    '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">'+
    '<button class="bt gh" onclick="closeModal()">취소</button>'+
    '<button class="bt gn" onclick="saveFxDeposit()">✓ 저장</button>'+
    '</div>');
}
function saveFxDeposit(){
  var amt=+document.getElementById('fx_amt').value||0;
  var avg=+document.getElementById('fx_avg').value||0;
  var cur=+document.getElementById('fx_cur').value||0;
  if(!D.fxSecDeposit) D.fxSecDeposit={USD:{}};
  D.fxSecDeposit.USD={amt:amt,avgRate:avg,curRate:cur};
  saveD();
  closeModal();
  toast('외화예수금 저장 완료');
  go('sec');
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
    bal[j.dr].dr+=j.amt;bal[j.dr].entries.push({...j,isDr:true,dispDt:jDispDate(j),sortKey:jSortKey(j)});
    bal[j.cr].cr+=j.amt;bal[j.cr].entries.push({...j,isDr:false,dispDt:jDispDate(j),sortKey:jSortKey(j)});
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
    <div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:40px;margin-bottom:12px">📒</div><div>아직 기표된 전표가 없습니다.<br>[전표작성] 메뉴에서 전표를 입력하세요.</div></div>`;}

  return `<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">총계정원장</div><button class="bt" onclick="exportGLExcel()" style="background:#059669;font-size:11px">📥 엑셀 내보내기 (日本語)</button></div>
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:10px 14px;background:#fff;border:1px solid #e2e6ed;border-radius:9px">
    <span style="font-size:12px;font-weight:600">📅 기간:</span>
    <select id="gl_mo" onchange="filterGL()" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">
      <option value="all">전체 (누적)</option>
      <option value="06">6월</option><option value="07">7월</option><option value="08">8월</option>
      <option value="09">9월</option><option value="10">10월</option><option value="11">11월</option>
      <option value="12">12월</option><option value="01">1월</option><option value="02">2월</option>
      <option value="03">3월</option><option value="04">4월</option><option value="05">5월 (결산)</option>
    </select>
    <span id="gl_info" style="font-size:11px;color:#64748b">${D.journals.length}건</span>
  </div>
  <div id="glBody">
  <div class="ib">💡 전표 ${D.journals.length}건에서 자동 집계. 계정을 클릭하면 상세 내역을 표시합니다.</div>
  ${["자산","부채","순자산","수익","비용"].filter(g=>groups[g]).map(g=>`
    <div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:6px;padding:3px 8px;background:#dbeafe;border-radius:5px;display:inline-block">${g}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px">
    ${groups[g].map(a=>`<div onclick="showGLDetail('${a.code}')" style="background:#fff;border:1px solid #e2e6ed;border-radius:7px;padding:8px 12px;cursor:pointer" onmouseenter="this.style.borderColor='#2563eb'" onmouseleave="this.style.borderColor='#e2e6ed'"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;font-weight:600">${a.name}</div><div style="font-size:9px;color:#64748b">${a.code} · ${a.entries.length}건</div></div><div style="font-size:13px;font-weight:700;font-feature-settings:'tnum'">${fy(a.net)}</div></div></div>`).join('')}
    </div></div>`).join('')}
  </div>`;}

function showGLDetail(code){
  const a=D.accts.find(x=>x.c===code);if(!a)return;
  const isDb=["자산","비용"].includes(a.g);
  const entries=[];let bal=0;
  D.journals.filter(j=>j.dr===code||j.cr===code).sort(function(a2,b2){return jSortKey(a2).localeCompare(jSortKey(b2));}).forEach(j=>{
    const isDr=j.dr===code;const dr=isDr?j.amt:0;const cr=isDr?0:j.amt;
    bal+=isDb?(dr-cr):(cr-dr);
    entries.push({id:j.id,dt:jDispDate(j),no:j.no,desc:j.desc,dr,cr,bal});
  });
  showModal(`【${a.k}】 ${code} (${a.g}) — 残高: ${fm(bal)}円`,`
    <div style="max-height:500px;overflow-y:auto"><table><thead><tr><th>日付</th><th>伝票</th><th>摘要</th><th class="r">借方</th><th class="r">貸方</th><th class="r">残高</th></tr></thead>
    <tbody>${entries.map((e,i)=>`<tr class="${i%2?'a':''}" onclick="closeModal();viewSlip(${e.id})" style="cursor:pointer" onmouseenter="this.style.background='#f0f9ff'" onmouseleave="this.style.background='${i%2?'#f8f9fb':''}'"><td class="mu m" style="font-size:10px">${e.dt}</td><td style="color:#2563eb;font-size:10px">${e.no}</td><td>${e.desc||''}</td><td class="r m">${e.dr?fm(e.dr):''}</td><td class="r m">${e.cr?fm(e.cr):''}</td><td class="r m b">${fm(e.bal)}</td></tr>`).join('')}</tbody></table></div>
    <div style="font-size:9px;color:#94a3b8;margin-top:6px">전표를 클릭하면 상세보기로 이동합니다</div>`);
}

function filterGL(){
  var sel=document.getElementById('gl_mo');
  if(!sel)return;
  var mo=sel.value;
  
  // Filter journals by month
  var filtered=D.journals;
  if(mo!=='all'){
    filtered=D.journals.filter(function(j){
      var m=j.dt.match(/(\d+)\//);
      if(!m)return mo==='05';
      return String(parseInt(m[1])).padStart(2,'0')===mo;
    });
  }
  
  // Compute balances from filtered journals
  var bal={};
  filtered.forEach(function(j){
    if(!bal[j.dr])bal[j.dr]={dr:0,cr:0,entries:[]};
    if(!bal[j.cr])bal[j.cr]={dr:0,cr:0,entries:[]};
    bal[j.dr].dr+=j.amt;bal[j.dr].entries.push(Object.assign({},j,{isDr:true,dispDt:jDispDate(j),sortKey:jSortKey(j)}));
    bal[j.cr].cr+=j.amt;bal[j.cr].entries.push(Object.assign({},j,{isDr:false,dispDt:jDispDate(j),sortKey:jSortKey(j)}));
  });
  var groups={};
  Object.entries(bal).forEach(function(pair){
    var code=pair[0],v=pair[1];
    var ac=D.accts.find(function(x){return x.c===code;});
    if(!ac)return;
    var isDb=["자산","비용"].indexOf(ac.g)>=0;
    v.net=isDb?v.dr-v.cr:v.cr-v.dr;
    if(!groups[ac.g])groups[ac.g]=[];
    groups[ac.g].push({code:code,name:ac.k,net:v.net,dr:v.dr,cr:v.cr,entries:v.entries});
  });
  
  // Update info
  var infoEl=document.getElementById('gl_info');
  if(infoEl) infoEl.textContent=filtered.length+'건'+(mo!=='all'?' ('+mo+'월)':'');
  
  // Build HTML
  var html='<div class="ib">💡 '+(mo==='all'?'전체 누적':mo+'월')+' 전표 '+filtered.length+'건 집계. 계정을 클릭하면 상세 내역을 표시합니다.</div>';
  
  ["자산","부채","순자산","수익","비용"].forEach(function(g){
    if(!groups[g])return;
    html+='<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:6px;padding:3px 8px;background:#dbeafe;border-radius:5px;display:inline-block">'+g+'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px">';
    groups[g].forEach(function(ac){
      html+='<div onclick="showGLDetail(\''+ac.code+'\')" style="background:#fff;border:1px solid #e2e6ed;border-radius:7px;padding:8px 12px;cursor:pointer" onmouseenter="this.style.borderColor=\'#2563eb\'" onmouseleave="this.style.borderColor=\'#e2e6ed\'"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:12px;font-weight:600">'+ac.name+'</div><div style="font-size:9px;color:#64748b">'+ac.code+' · '+ac.entries.length+'건</div></div><div style="font-size:13px;font-weight:700;font-feature-settings:\'tnum\'">¥'+fm(ac.net)+'</div></div></div>';
    });
    html+='</div></div>';
  });
  
  if(filtered.length===0) html='<div style="text-align:center;padding:40px;color:#64748b">해당 월에 기표된 전표가 없습니다.</div>';
  
  var body=document.getElementById('glBody');
  if(body) body.innerHTML=html;
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

  return '<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">전표조회</div><div style="display:flex;gap:6px"><button class="bt gh" onclick="doUndo()" style="font-size:11px">↩ 되돌리기</button></div><button class="bt gh" onclick="document.getElementById(\'vendorSummary\').classList.toggle(\'hidden\')" style="font-size:11px">👤 거래처별 집계</button></div>'+
    '<div id="vendorSummary" class="hidden"><div class="pn" style="margin-bottom:10px;padding:12px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">👤 거래처별 집계</div>'+rVendorSummary()+'</div></div>'+
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
  // Sort by date
  var sorted=list.slice().sort(function(a,b){return jSortKey(a).localeCompare(jSortKey(b));});
  let rows='';let totalDr=0;
  sorted.forEach((e,i)=>{
    totalDr+=e.amt;
    rows+='<tr class="'+(i%2?'a':'')+'" onclick="viewSlip('+e.id+')" style="cursor:pointer" onmouseenter="this.style.background=\'#f0f9ff\'" onmouseleave="this.style.background=\''+( i%2?'#f8f9fb':'')+'\'">';
    rows+='<td class="mu m" style="width:70px;font-size:10px">'+jDispDate(e)+'</td>';
    rows+='<td style="width:95px;color:#2563eb;font-size:10px;white-space:nowrap">'+e.no+'</td>';
    rows+='<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+(e.receipts&&e.receipts.length>0?'📎 ':'')+e.desc+(e.vendor?' <span style="color:#d97706;font-size:9px">['+e.vendor+']</span>':'')+'</td>';
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



// ===== 일정 알림 (세무 기한/마감) =====
function getAlerts(){
  var today=new Date();
  var mm=today.getMonth()+1, dd=today.getDate(), dow=today.getDay();
  var alerts=[];
  // Helper: days until target date
  function daysUntil(m,d){
    var t=new Date(today.getFullYear(),m-1,d);
    if(t<today)t=new Date(today.getFullYear()+1,m-1,d);
    return Math.ceil((t-today)/(1000*60*60*24));
  }
  function addAlert(icon,title,desc,daysLeft,cls){
    alerts.push({icon:icon,title:title,desc:desc,days:daysLeft,cls:cls||'info'});
  }

  // 1) 월차마감 알림 — 매월 25일~말일
  var lastDay=new Date(today.getFullYear(),mm,0).getDate();
  if(dd>=25){
    var closedKey=today.getFullYear()+'-'+String(mm).padStart(2,'0');
    var alreadyClosed=D.monthlyClosed&&D.monthlyClosed[closedKey];
    if(!alreadyClosed){
      addAlert('📅','월차마감 ('+(mm)+'월)','설정 → 월차마감 저장 실행',lastDay-dd,'warn');
    }
  }

  // 2) 주간 운용보고서 — 매주 금요일 알림
  if(dow>=4 && dow<=5){
    addAlert('📄','주간 운용보고서','운용보고서 → 워드 내보내기',dow===5?0:1,'info');
  }

  // 3) Firebase 동기화 — 7일 이상 동기화 안 한 경우
  if(D._lastSaved){
    var lastMs=new Date(D._lastSaved).getTime();
    var diffDays=Math.floor((today.getTime()-lastMs)/(1000*60*60*24));
    if(diffDays>=7){
      addAlert('☁️','Firebase 동기화 필요',diffDays+'일 전 마지막 저장','overdue','warn');
    }
  }

  // 4) 결산 관련 (5월)
  var dMay31=daysUntil(5,31);
  if(dMay31<=60 && dMay31>30){
    addAlert('📋','결산 준비 (5월말)','중간보고 → 법인세 추정탭 확인',dMay31,'info');
  }
  if(dMay31<=30 && dMay31>0){
    addAlert('🔴','결산 D-'+dMay31,'유가증권 시세 확정 · 평가손익 전표 · 법인세 확정',dMay31,'urgent');
  }

  // 5) 법인세 확정신고 (결산일+2개월 = 7/31)
  var dJul31=daysUntil(7,31);
  if(dJul31<=30 && dJul31>0){
    addAlert('🏛','법인세·소비세 확정신고 (7/31)','세무사에게 재무제표 · 총계정원장 · 소비세 집계 전달',dJul31,'urgent');
  }
  if(dJul31<=60 && dJul31>30){
    addAlert('🏛','법인세·소비세 신고 준비','워드/엑셀 내보내기 → 세무사 전달 준비 (소비세 포함)',dJul31,'warn');
  }

  // 6) 법인도민세(균등할) — 매년 8/31 납부 (도쿄도)
  var dAug31=daysUntil(8,31);
  if(dAug31<=30 && dAug31>0){
    addAlert('🏢','도민세 균등할 납부 (8/31)','도쿄도 7만엔 납부',dAug31,'warn');
  }

  // 7) 시세 업데이트 리마인더 — 평일 표시
  if(dow>=1 && dow<=5){
    addAlert('📈','시세 업데이트','유가증권 → 시세 업데이트 실행','-','daily');
  }

  // 8) 제2기 전환 (2026.06 초)
  var dJun1=daysUntil(6,1);
  if(today.getFullYear()>=2026 && dJun1<=30 && dJun1>0){
    addAlert('🔄','제2기 전환 준비','BS이월 · PL리셋 · 이익잉여금 합산',dJun1,'warn');
  }

  // 9) 계약 만기 알림
  if(D.contracts&&D.contracts.length>0){
    D.contracts.forEach(function(ct){
      if(!ct.endDate||ct.active===false) return;
      var endD=new Date(ct.endDate);
      var diffD=Math.ceil((endD-today)/(1000*60*60*24));
      var alertDays=ct.alertDays||30;
      if(diffD<0){
        addAlert('📁','계약 만료: '+ct.name,(ct.counterparty||'')+' — '+ct.endDate+' 만료'+(ct.autoRenew?' (자동갱신)':''),'overdue','urgent');
      } else if(diffD<=alertDays){
        addAlert('📁','계약 만기 임박: '+ct.name,(ct.counterparty||'')+' — D-'+diffD+(ct.autoRenew?' (자동갱신)':''),diffD,'warn');
      }
    });
  }

  // 10) 리스/렌탈 만기 알림
  if(D.leases&&D.leases.length>0){
    D.leases.forEach(function(ls){
      if(!ls.endDate||!ls.active) return;
      var endD=new Date(ls.endDate);
      var diffD=Math.ceil((endD-today)/(1000*60*60*24));
      if(diffD<0){
        addAlert('📋','리스 만료: '+ls.name,(ls.vendor||'')+' — '+ls.endDate+' 만료','overdue','urgent');
      } else if(diffD<=30){
        addAlert('📋','리스 만기 임박: '+ls.name,(ls.vendor||'')+' — D-'+diffD,diffD,'warn');
      }
    });
  }

  // Sort: urgent first, then warn, then info/daily
  var order={urgent:0,warn:1,info:2,daily:3};
  alerts.sort(function(a,b){return (order[a.cls]||9)-(order[b.cls]||9);});
  return alerts;
}

function renderAlerts(){
  var alerts=getAlerts();
  if(alerts.length===0) return '';
  var colors={urgent:'#dc2626',warn:'#d97706',info:'#2563eb',daily:'#64748b'};
  var bgColors={urgent:'#fef2f2',warn:'#fffbeb',info:'#eff6ff',daily:'#f8fafc'};
  var borderColors={urgent:'#fca5a5',warn:'#fde68a',info:'#bfdbfe',daily:'#e2e6ed'};
  var html='<div class="pn" style="margin-bottom:14px"><div class="ph"><span>🔔 일정 알림</span><span style="font-size:10px;color:#64748b">'+alerts.length+'건</span></div>';
  html+='<div style="padding:8px 12px">';
  alerts.forEach(function(al){
    var c=colors[al.cls]||'#64748b';
    var bg=bgColors[al.cls]||'#f8fafc';
    var bd=borderColors[al.cls]||'#e2e6ed';
    var daysText='';
    if(al.days==='overdue')daysText='<span style="color:#dc2626;font-weight:700">지연</span>';
    else if(al.days==='-')daysText='<span style="color:#64748b">매일</span>';
    else if(al.days===0)daysText='<span style="color:#dc2626;font-weight:700">오늘</span>';
    else if(typeof al.days==='number')daysText='<span style="color:'+c+';font-weight:600">D-'+al.days+'</span>';
    html+='<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:4px;background:'+bg+';border:1px solid '+bd+';border-radius:7px;border-left:3px solid '+c+'">';
    html+='<span style="font-size:16px;flex-shrink:0">'+al.icon+'</span>';
    html+='<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:'+c+'">'+al.title+'</div><div style="font-size:10px;color:#64748b;margin-top:1px">'+al.desc+'</div></div>';
    html+='<div style="text-align:right;font-size:11px;flex-shrink:0">'+daysText+'</div>';
    html+='</div>';
  });
  html+='</div></div>';
  return html;
}

function rDash(){saveSnapshot();const c=calc();return `<div class="pt">대시보드</div>
  <div class="cards"><div class="cd bl"><div class="l">총 보유 자산</div><div class="v">${fy(c.bb+c.secBal)}</div>${c.totA!==(c.bb+c.secBal)?'<div style="font-size:9px;color:#2563eb;margin-top:2px">소비세환급시 '+fy(c.totA)+'</div>':''}</div><div class="cd go"><div class="l">법인계좌</div><div class="v">${fy(c.bb)}</div></div><div class="cd bl"><div class="l">증권계좌</div><div class="v">${fy(c.secBal)}</div></div><div class="cd gn"><div class="l">실현손익</div><div class="v">+${fy(c.rpl)}</div></div></div>
  <div class="cards"><div class="cd bl"><div class="l">유가증권평가액</div><div class="v">${fy(c.allMv)}</div></div><div class="cd ${c.allPl>=0?'gn':'rd'}"><div class="l">평가손익</div><div class="v">${fy(c.allPl)}</div></div><div class="cd ${c.rpl+c.allPl>=0?'gn':'rd'}"><div class="l">총합손익</div><div class="v">${fy(c.rpl+c.allPl)}</div></div></div>
  ${renderAlerts()}
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
    alert('조정 불필요\n\n전표 평가손익: '+fm(journalEvalLoss)+'\n시가 평가손익: '+fm(marketEvalLoss)+'\n\n차이: 0');
    return;
  }
  
  const info='평가손익 조정전표 생성\n\n'+
    '전표상 평가손: '+fm(journalEvalLoss)+'\n'+
    '시가기준 평가손익: '+fm(marketEvalLoss)+'\n'+
    '조정액: '+fm(Math.abs(diff))+'\n\n';
  
  if(diff>0){
    // 평가손 증가: DR 유가증권평가손(542) / CR 유가증권(130)
    if(!confirm(info+'평가손 증가 → 전표 생성:\n차변: 유가증권평가손(542) '+fm(diff)+'\n대변: 유가증권(130) '+fm(diff)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'ADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 유가증권평가손익 추가인식',dr:'542',cr:'130',amt:diff});
  } else {
    // 평가손 감소(환입): DR 유가증권(130) / CR 유가증권평가손(542)
    var absDiff=Math.abs(diff);
    if(!confirm(info+'평가손 감소(환입) → 전표 생성:\n차변: 유가증권(130) '+fm(absDiff)+'\n대변: 유가증권평가손(542) '+fm(absDiff)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'ADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 유가증권평가손익 환입',dr:'130',cr:'542',amt:absDiff});
  }
  saveD();
  alert('조정전표 생성 완료!\n전표조회에서 확인하세요.');
  go('sec');
}

function todayStr(){
  var d=new Date();
  return (d.getMonth()+1)+'/'+d.getDate();
}

// ===== 결산 자동화: 외화예수금 평가손익 조정전표 =====
function autoFxEvalAdjust(){
  if(!D.fxSecDeposit||!D.fxSecDeposit.USD||!D.fxSecDeposit.USD.amt){
    alert('외화예수금 잔고가 없습니다.');return;
  }
  var fx=D.fxSecDeposit.USD;
  var bookJpy=Math.round(fx.amt*fx.avgRate);
  var mvJpy=Math.round(fx.amt*fx.curRate);
  var fxPl=mvJpy-bookJpy; // +이익 -손실
  
  if(fxPl===0){
    alert('조정 불필요 (평가환율과 취득환율이 동일)');return;
  }
  
  var info='외화예수금 평가손익 조정전표\n\n'+
    'USD 잔고: $'+fm(fx.amt)+'\n'+
    '취득환율: '+fx.avgRate.toFixed(4)+' (장부가 '+fm(bookJpy)+')\n'+
    '평가환율: '+fx.curRate.toFixed(4)+' (평가액 '+fm(mvJpy)+')\n'+
    '평가손익: '+(fxPl>=0?'+':'')+fm(fxPl)+'\n\n';
  
  if(fxPl<0){
    // 평가손: DR 542 유가증권평가손 / CR 192 외화증권예수금
    if(!confirm(info+'평가손 인식 → 전표 생성:\n차변: 유가증권평가손(542) '+fm(-fxPl)+'\n대변: 외화증권예수금(192) '+fm(-fxPl)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'FXADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 외화예수금 평가손(USD)',dr:'542',cr:'192',amt:-fxPl,edt:new Date().toISOString().slice(0,10)});
    // 장부가 갱신
    fx.avgRate=fx.curRate;
  }else{
    // 평가이익: DR 192 외화증권예수금 / CR 405 잡수입(또는 별도 외환차익 계정)
    if(!confirm(info+'평가이익 인식 → 전표 생성:\n차변: 외화증권예수금(192) '+fm(fxPl)+'\n대변: 잡수입(405) '+fm(fxPl)+'\n\n생성하시겠습니까?'))return;
    D.journals.push({id:nid(),dt:todayStr(),no:'FXADJ'+String(D.journals.length+1).padStart(2,'0'),desc:'결산조정: 외화예수금 평가이익(USD)',dr:'192',cr:'405',amt:fxPl,edt:new Date().toISOString().slice(0,10)});
    // 장부가 갱신
    fx.avgRate=fx.curRate;
  }
  saveD();
  alert('조정전표 생성 완료!\n장부환율이 평가환율('+fx.curRate.toFixed(4)+')로 갱신되었습니다.');
  go('sec');
}

// ===== XIRR 계산 (수정내부수익률) =====
function calcXIRR(){
  // 자본 기준: 증권계좌로 입금한 돈 vs 현재 증권계좌 총액
  var flows=[];
  var today=new Date();
  
  // 1. 증권계좌 입금 (은행→증권 이체): DR 191/CR 110
  D.journals.forEach(function(j){
    var fd=jFullDate(j);
    var dt=new Date(fd);
    if(isNaN(dt.getTime())) return;
    // 은행에서 증권으로 이체 (자본 투입)
    if(j.dr==='191'&&j.cr==='110') flows.push({date:dt,amount:-j.amt});
    // 증권에서 은행으로 이체 (자본 회수) - 현재 없지만 향후 대비
    if(j.dr==='110'&&j.cr==='191') flows.push({date:dt,amount:j.amt});
  });
  
  // 2. 현재 증권계좌 잔액 (예수금 + 외화예수금 + 보유종목 시가) = 최종 가치
  var c=calc();
  var fxJpy=0;
  if(D.fxSecDeposit&&D.fxSecDeposit.USD&&D.fxSecDeposit.USD.amt>0){
    var fx=D.fxSecDeposit.USD;
    fxJpy=Math.round(fx.amt*(fx.curRate||fx.avgRate||SET.rates.USDJPY));
  }
  var terminalValue=(D.secDeposit||SEC_DEP)+c.allMv+fxJpy;
  if(terminalValue>0) flows.push({date:today,amount:terminalValue});
  
  if(flows.length<2) return null;
  
  // XIRR Newton-Raphson solver
  function xnpv(rate,cfs){
    var d0=cfs[0].date;
    var sum=0;
    for(var i=0;i<cfs.length;i++){
      var days=(cfs[i].date-d0)/(365.25*86400000);
      sum+=cfs[i].amount/Math.pow(1+rate,days);
    }
    return sum;
  }
  
  flows.sort(function(a,b){return a.date-b.date;});
  
  // Newton-Raphson
  var guess=0.1;
  for(var iter=0;iter<200;iter++){
    var f=xnpv(guess,flows);
    var h=0.0001;
    var df=(xnpv(guess+h,flows)-f)/h;
    if(Math.abs(df)<1e-10) break;
    var newGuess=guess-f/df;
    if(Math.abs(newGuess-guess)<1e-8) break;
    guess=newGuess;
    if(guess<-0.99) guess=-0.99;
    if(guess>10) guess=10;
  }
  
  if(isNaN(guess)||!isFinite(guess)||guess<-1||guess>10) return null;
  
  // 단순수익률도 계산
  var totalInvested=flows.filter(function(f){return f.amount<0;}).reduce(function(s,f){return s+f.amount;},0);
  var simpleReturn=totalInvested!==0?(terminalValue+totalInvested)/(-totalInvested)*100:0;
  
  return {rate:guess, flowCount:flows.length, simpleReturn:simpleReturn, invested:-totalInvested, current:terminalValue};
}

function rSec(){const c=calc();const jpT=c.jpMv;
  var xirrResult=calcXIRR();
  var xirrDisplay=xirrResult?((xirrResult.rate*100).toFixed(2)+'%'):'—';
  var xirrColor=xirrResult?(xirrResult.rate>=0?'gn':'rd'):'bl';
  var xirrNote=xirrResult?'투입 '+fm(xirrResult.invested)+' → 현재 '+fm(xirrResult.current)+' (단순 '+xirrResult.simpleReturn.toFixed(1)+'%)':'';
  // 외화예수금 계산
  var fxUSD=D.fxSecDeposit&&D.fxSecDeposit.USD?D.fxSecDeposit.USD:{amt:0,avgRate:0,curRate:0};
  var fxUsdAmt=fxUSD.amt||0;
  var fxAvgRate=fxUSD.avgRate||0;
  var fxCurRate=fxUSD.curRate||SET.rates.USDJPY||0;
  var fxBookJpy=Math.round(fxUsdAmt*fxAvgRate);
  var fxMvJpy=Math.round(fxUsdAmt*fxCurRate);
  var fxPl=fxMvJpy-fxBookJpy;
  
  return `<div class="pt">유가증권</div>
  <div class="cards"><div class="cd bl"><div class="l">평가액</div><div class="v">${fy(c.allMv)}</div></div><div class="cd ${c.allPl>=0?'gn':'rd'}"><div class="l">평가손익</div><div class="v">${fy(c.allPl)}</div></div><div class="cd gn"><div class="l">실현손익</div><div class="v">+${fy(c.rpl)}</div></div><div class="cd ${xirrColor}"><div class="l">XIRR (연환산수익률)</div><div class="v">${xirrDisplay}</div>${xirrNote?'<div style="font-size:8px;color:#64748b;margin-top:2px">'+xirrNote+'</div>':''}</div>${fxUsdAmt>0?'<div class="cd '+(fxPl>=0?'gn':'rd')+'"><div class="l">USD 예수금</div><div class="v">$'+fm(fxUsdAmt)+'</div><div style="font-size:9px;color:#64748b;margin-top:2px">¥'+fm(fxMvJpy)+' (평가손익 '+(fxPl>=0?'+':'')+fm(fxPl)+')</div></div>':''}</div>
  <div class="pn" style="padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600">증권예수금: <span id="depEdit" contenteditable="true" style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 6px;cursor:pointer;outline:none">${fm(D.secDeposit||SEC_DEP)}</span> 엔</span><button class="bt" onclick="saveDeposit()" style="font-size:10px;padding:3px 10px">💾 저장</button></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:6px"><div class="tabs" style="margin-bottom:0"><button class="tab on" data-tab="hold">보유현황</button><button class="tab" data-tab="real">수익실현</button></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="bt" onclick="updatePrices()" style="background:#d97706">📊 시세 업데이트</button> <button class="bt" onclick="autoEvalAdjust()" style="background:#7c3aed;font-size:11px">📋 결산조정 (평가)</button>${fxUsdAmt>0?'<button class="bt" onclick="autoFxEvalAdjust()" style="background:#0891b2;font-size:11px">💱 외화 결산조정</button>':''}</div></div>
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
  <div class="pn"><div class="ph"><span>나-2) 외화예수금 (米国株購入用)</span><button class="bt" onclick="editFxDeposit()" style="font-size:11px">✏️ 편집</button></div>${fxUsdAmt>0?'<table><thead><tr><th>통화</th><th class="r">잔고</th><th class="r">취득환율</th><th class="r">취득금액(JPY)</th><th class="r">평가환율</th><th class="r">평가금액(JPY)</th><th class="r">평가손익</th></tr></thead><tbody><tr><td class="b bl">USD 米ドル</td><td class="r m">$'+fm(fxUsdAmt)+'</td><td class="r m">'+fxAvgRate.toFixed(4)+'</td><td class="r m b">'+fm(fxBookJpy)+'</td><td class="r m">'+fxCurRate.toFixed(4)+'</td><td class="r m b">'+fm(fxMvJpy)+'</td><td class="r">'+bg(fxPl)+'</td></tr></tbody></table>':'<div style="padding:20px;text-align:center;color:#64748b;font-size:12px">외화예수금 잔고가 없습니다. 편집 버튼으로 입력하세요.</div>'}</div>
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
  var sortedIn=D.bkIn.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');});
  var sortedOut=D.bkOut.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');});
  return `<div class="pt">법인계좌</div>
  <div class="cards"><div class="cd bl"><div class="l">잔액</div><div class="v">${fy(c.bb)}</div></div><div class="cd gn"><div class="l">총입금</div><div class="v">${fy(c.tI)}</div></div><div class="cd rd"><div class="l">총출금</div><div class="v">${fy(c.tO)}</div></div></div>
  <div class="pn"><div class="ph" style="color:#059669"><span>입금</span><button class="bt gn" onclick="addBkIn()">+ 내역추가</button></div><table><thead><tr><th>일자</th><th>구분</th><th class="r">입금액(엔)</th><th class="r">누적(엔)</th><th></th></tr></thead>
  <tbody>${sortedIn.map((d,i)=>{cI+=d.amt;return`<tr class="${i%2?'a':''}"><td class="mu m">${d.dt}</td><td>${d.cat}</td><td class="r m gn">${fm(d.amt)}</td><td class="r m b">${fm(cI)}</td><td><button class="del" onclick="delBk('in',${d.id})">✕</button></td></tr>`;}).join('')}</tbody></table></div>
  <div class="pn"><div class="ph" style="color:#dc2626"><span>출금</span><button class="bt rd" onclick="addBkOut()">+ 내역추가</button></div><table><thead><tr><th>일자</th><th>구분</th><th class="r">출금액(엔)</th><th class="r">누적(엔)</th><th></th></tr></thead>
  <tbody>${sortedOut.map((d,i)=>{cO+=d.amt;return`<tr class="${i%2?'a':''}"><td class="mu m">${d.dt}</td><td>${d.cat}</td><td class="r m rd">${fm(d.amt)}</td><td class="r m">${fm(cO)}</td><td><button class="del" onclick="delBk('out',${d.id})">✕</button></td></tr>`;}).join('')}</tbody>
  <tr class="t"><td colspan="2" class="r">잔액</td><td colspan="3" class="r m" style="font-size:15px;color:#2563eb">${fm(c.bb)}</td></tr></table></div>`;}

function rFS(){
  const d=dynamicFS();const c=calc();
  // SGA: dynamically from journals
  // SGA: scan ALL expense accounts with balance (exclude NOE 540-546, tax 550+, startup 560+)
  const sgaExclude=['537','540','541','542','543','544','545','546','550','551','552','553','560','561','562','563','564','565'];
  const sga=D.accts.filter(ac=>ac.g==='비용'&&!sgaExclude.includes(ac.c)).map(ac=>({nm:ac.k,a:acctBal(ac.c)})).filter(x=>x.a!==0);
  // NOI: dynamically from journals
  // NOI: scan ALL revenue accounts with balance
  const noi=D.accts.filter(ac=>ac.g==='수익').map(ac=>({nm:ac.k,a:acctBal(ac.c)})).filter(x=>x.a!==0);
  // 평가이익 → 영업외수익에 추가
  if(d.evalGain>0) noi.push({nm:"유가증권평가이익(미실현)",a:d.evalGain,n:"시가기준 자동반영 · 결산 시 📋결산조정 필요"});
  // NOE
  const noe=[
    {nm:"유가증권매매수수료",a:d.secFee},
    {nm:"유가증권평가손(미실현)",a:d.evalLoss,n:"시가기준 자동반영 · 결산 시 📋결산조정 필요"},
    {nm:"지급이자",a:d.interestPay}
  ].filter(x=>x.a>0);

  return '<div style="display:flex;justify-content:space-between;align-items:center"><div class="pt">재무제표</div><button class="bt" onclick="exportFSWord()" style="background:#2563eb;font-size:11px">📥 워드 내보내기 (日本語)</button></div><div class="tabs"><button class="tab on" data-tab="pl">손익계산서</button><button class="tab" data-tab="bs">대차대조표</button><button class="tab" data-tab="tx">법인세추정</button><button class="tab" data-tab="monthly" onclick="showMonthlyTab(this)">월차추이</button><button class="tab" data-tab="expense" onclick="showExpenseTab(this)">비용분석</button><button class="tab" data-tab="cashflow">현금흐름</button><button class="tab" data-tab="taxsum">소비세</button><button class="tab" data-tab="withholding">원천징수</button><button class="tab" data-tab="trial">시산표</button></div>'+
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
    (d.ct!==d.estTax?'<div style="font-size:9px;color:#d97706;padding:2px 16px">※ 추정세액 '+fm(d.estTax)+' (법인세추정탭에서 전표 갱신 가능)</div>':'')+
  '<div style="display:flex;justify-content:space-between;padding:12px 14px;font-size:16px;font-weight:700;border-top:3px solid #e2e6ed;margin-top:8px;background:#d1fae560;border-radius:0 0 6px 6px"><span>당기순이익</span><span style="color:'+(d.ni>=0?'#059669':'#dc2626')+'" class="m">'+fy(d.ni)+'</span></div>'+
  '<div class="ib" style="margin-top:8px;font-size:10px">💡 유가증권평가손·법인세는 보유종목 시가 기준 자동 반영됩니다</div>'+
  '</div></div>';
}


// ===== 운용보고서 편집 저장 =====
function saveRptEdits(){
  var el=document.getElementById('rptContent');
  if(!el)return;
  if(!D.rptEdits)D.rptEdits={};
  // Save all contenteditable elements
  var editables=el.querySelectorAll('[contenteditable="true"]');
  var edits={};
  editables.forEach(function(e,i){
    var key='ce_'+i;
    if(e.dataset.rptKey) key=e.dataset.rptKey;
    edits[key]=e.innerHTML;
  });
  // Save added rows
  var addedRows=el.querySelectorAll('tr[style*="fffbeb"]');
  var rows=[];
  addedRows.forEach(function(r){
    rows.push(r.innerHTML);
  });
  edits._addedRows=rows;
  D.rptEdits=edits;
  saveD();
  toast('보고서 편집 내용 저장 완료');
}

function restoreRptEdits(){
  if(!D.rptEdits||Object.keys(D.rptEdits).length===0)return;
  var el=document.getElementById('rptContent');
  if(!el)return;
  var editables=el.querySelectorAll('[contenteditable="true"]');
  editables.forEach(function(e,i){
    var key='ce_'+i;
    if(e.dataset.rptKey) key=e.dataset.rptKey;
    if(D.rptEdits[key]) e.innerHTML=D.rptEdits[key];
  });
}

function clearRptEdits(){
  if(!confirm('편집 내용을 초기화하시겠습니까?\n원본 데이터로 복원됩니다.'))return;
  delete D.rptEdits;
  saveD();
  toast('편집 초기화 완료');
  go('rpt');
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
  // Bank tables (sorted by date)
  let bkInRows='',cI=0;
  D.bkIn.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');}).forEach((d,i)=>{cI+=d.amt;bkInRows+='<tr class="'+(i%2?'a':'')+'"><td class="mu m">'+d.dt+'</td><td>'+d.cat+'</td><td class="r m gn">'+fm(d.amt)+'</td><td class="r m b">'+fm(cI)+'</td></tr>';});
  let bkOutRows='',cO=0;
  D.bkOut.slice().sort(function(a,b){return (a.dt||'').localeCompare(b.dt||'');}).forEach((d,i)=>{cO+=d.amt;bkOutRows+='<tr class="'+(i%2?'a':'')+'"><td class="mu m">'+d.dt+'</td><td>'+d.cat+'</td><td class="r m rd">'+fm(d.amt)+'</td><td class="r m">'+fm(cO)+'</td></tr>';});

  return '<div style="max-width:1100px" id="rptContent">'+
    '<div contenteditable="true" style="text-align:center;margin-bottom:20px"><div style="font-size:22px;font-weight:700;color:#1e3a5f">태성㈜ 자금운용보고서</div><div style="font-size:13px;color:#64748b;margin-top:4px">'+rptDt()+' 기준</div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button class="bt" onclick="window.print()">🖨 인쇄 (A4)</button><button class="bt" onclick="exportWord()" style="background:#2563eb">📥 워드 내보내기</button><button class="bt" onclick="saveRptEdits()" style="background:#059669">💾 편집 저장</button><button class="bt gh" onclick="clearRptEdits()">🔄 원본 복원</button></div>'+

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
    '<tr class="t"><td>총보유자산합계</td><td class="r m">'+fm(c.bb+c.secBal)+'</td><td class="mu">(1)+(2)</td></tr>'+
    (c.totA!==(c.bb+c.secBal)?'<tr style="background:#dbeafe"><td style="font-weight:700;color:#2563eb">총보유자산합계 (소비세환급시)</td><td class="r m b" style="color:#2563eb">'+fm(c.totA)+'</td><td class="mu" style="font-size:10px">가지급소비세 '+fm(c.totA-c.bb-c.secBal)+' 포함</td></tr>':'')+
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
        // Merge: keep ACCT_INIT + user-added custom accounts
if(!D.customAccts)D.customAccts=[];
if(D._oiAccts)OI_ACCTS=D._oiAccts;
D.accts=ACCT_INIT.concat(D.customAccts); // Always use fresh accounts
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
  <div class="sc"><h4>💱 환율 설정</h4><div style="font-size:11px;color:#64748b;margin-bottom:10px">환율 변경 시 유가증권 평가 및 전표작성에 반영</div>
  <button class="bt" id="rateBtn" onclick="fetchRate()" style="background:#d97706;margin-bottom:12px">🔄 환율 자동 가져오기</button>
  <div class="rr"><span style="width:120px">USD/JPY:</span><input type="number" id="r1" value="${SET.rates.USDJPY}" step="0.000001"><span class="mu">1달러 = ? 엔</span></div>
  <div class="rr"><span style="width:120px">JPY/KRW:</span><input type="number" id="r2" value="${SET.rates.JPYKRW}" step="0.000001"><span class="mu">1엔 = ? 원</span></div>
  <div style="margin-top:12px"><button class="bt" onclick="SET.rates.USDJPY=+document.getElementById('r1').value;SET.rates.JPYKRW=+document.getElementById('r2').value;saveS();toast('저장 완료');go('set')">💾 저장</button></div></div>
  <div class="sc"><h4>📄 보고서 기준일</h4><div class="rr"><span>기준일 (비워두면 자동):</span><input id="r3" value="${SET.reportDate}" placeholder="예: 26. 3. 27." style="width:160px"></div>
  <button class="bt" onclick="SET.reportDate=document.getElementById('r3').value;saveS();toast('저장 완료')">💾 저장</button></div>
  <div class="sc"><h4>☁️ Firebase 동기화</h4>
  <div style="font-size:11px;margin-bottom:8px" id="fbStatus">${fbReady?'<span style="color:#059669">✅ Firebase 연결됨</span>':'<span style="color:#dc2626">❌ Firebase 미연결 (새로고침 필요)</span>'}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="bt" onclick="doFbUpload()" style="background:#d97706">📤 서버에 업로드</button>
    <button class="bt" onclick="doFbDownload()" style="background:#2563eb">📥 서버에서 다운로드</button>
  </div>
  <div style="font-size:10px;color:#94a3b8;margin-top:6px">💡 자동 동기화: 전표 저장 시 자동으로 서버에 업로드됩니다</div><button class="bt gh" onclick="showDiag()" style="font-size:9px;margin-top:6px">🔍 데이터 진단</button></div></div>
  <div class="sc"><h4>📅 월차 마감</h4>
  <div style="font-size:11px;color:#64748b;margin-bottom:8px">현재 재무상태를 월별로 저장합니다. 매월 말에 실행하세요.</div>
  <div style="font-size:10px;color:#d97706;margin-bottom:8px;background:#fffbeb;padding:6px 10px;border-radius:4px">⚠️ 결산(5월) 시 유가증권 → 📋 결산조정(평가손익전표) 버튼으로 평가손익 전표를 반드시 생성하세요</div>
  <button class="bt" onclick="saveMonthlyClose()" style="background:#7c3aed">📅 이번 달 마감 저장</button></div>
  <div class="sc"><h4>💾 데이터 백업 / 복원</h4>
  <div style="font-size:11px;color:#64748b;margin-bottom:10px">다른 기기로 데이터를 이동하거나 백업할 수 있습니다</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="bt" onclick="exportBackup()" style="background:#059669">📤 백업 내보내기 (JSON)</button>
    <button class="bt" onclick="importBackup()" style="background:#2563eb">📥 백업 가져오기</button>
  </div>
  <div style="font-size:10px;color:#94a3b8;margin-top:6px">💡 PC에서 내보내기 → 휴대폰에서 가져오기로 동기화 가능</div></div>
  
  <div class="sc"><h4>🔄 데이터 초기화</h4><div style="font-size:11px;color:#64748b;margin-bottom:8px">모든 수정사항을 원래 데이터로 복원합니다 (자산추이·월차마감 데이터는 보존)</div>
  <button class="bt rd" onclick="if(confirm('정말 초기화하시겠습니까?')){try{localStorage.setItem('${DKEY}_preserve',JSON.stringify({snapshots:D.snapshots||[],monthlyClosed:D.monthlyClosed||{}}));}catch(e){}localStorage.removeItem('${DKEY}');localStorage.removeItem('${SKEY}');location.reload();}">🗑 초기화</button></div>`;}



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
    bal[j.dr].dr+=j.amt;bal[j.dr].entries.push({...j,isDr:true,dispDt:jDispDate(j),sortKey:jSortKey(j)});
    bal[j.cr].cr+=j.amt;bal[j.cr].entries.push({...j,isDr:false,dispDt:jDispDate(j),sortKey:jSortKey(j)});
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
    v.entries.sort(function(a,b){return a.sortKey.localeCompare(b.sortKey);}).forEach((e,i)=>{
      const dr=e.isDr?e.amt:0,cr=e.isDr?0:e.amt;
      runBal+=isDb?(dr-cr):(cr-dr);
      const bg=i%2?'background:#f5f5f5;':'';
      html+='<tr><td style="'+S+bg+'">'+e.dispDt+'</td><td style="'+S+bg+'color:#2563eb">'+e.no+'</td><td style="'+S+bg+'">'+e.desc+'</td><td style="'+HR+bg+'">'+(dr?fm(dr):'')+'</td><td style="'+HR+bg+'">'+(cr?fm(cr):'')+'</td><td style="'+HB+bg+'">'+fm(runBal)+'</td></tr>';
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
'+function(){var excl=['537','540','541','542','543','544','545','546','550','551','552','553','560','561','562','563','564','565'];var r='';D.accts.filter(function(ac){return ac.g==='비용'&&excl.indexOf(ac.c)<0;}).forEach(function(ac){var b=acctBal(ac.c);if(b>0)r+='<tr><td>　'+(ac.n||ac.k)+'</td><td class="r">'+fm(b)+'</td><td></td><td></td></tr>';});return r;}()+'
<tr class="sub"><td>　販管費合計</td><td></td><td class="r b">${fm(d.sgaT)}</td><td></td></tr>
<tr><td>　創立費</td><td></td><td class="r">${fm(d.su)}</td><td></td></tr>
<tr class="sub"><td>営業損失</td><td></td><td></td><td class="r b" style="color:#c0392b">${fm(d.ol)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">Ⅲ　営業外収益</td></tr>
'+function(){var r='';D.accts.filter(function(ac){return ac.g==='수익';}).forEach(function(ac){var b=acctBal(ac.c);if(b>0)r+='<tr><td>　'+(ac.n||ac.k)+'</td><td class="r">'+fm(b)+'</td><td></td><td></td></tr>';});if(d.evalGain>0)r+='<tr><td>　有価証券評価益（未実現）</td><td class="r">'+fm(d.evalGain)+'</td><td></td><td></td></tr><tr><td colspan="4" class="note">　　※保有銘柄の時価基準により自動反映</td></tr>';return r;}()+'
<tr class="sub"><td>　営業外収益合計</td><td></td><td></td><td class="r b">${fm(d.noiT)}</td></tr>
<tr class="gap"><td colspan="4"></td></tr>

<tr class="sec"><td colspan="4">Ⅳ　営業外費用</td></tr>
<tr><td>　有価証券売買手数料</td><td class="r">${fm(d.secFee)}</td><td></td><td></td></tr>
${d.evalLoss>0?'<tr><td>　有価証券評価損（未実現）</td><td class="r">'+fm(d.evalLoss)+'</td><td></td><td></td></tr><tr><td colspan="4" class="note">　　※保有銘柄の時価基準により自動反映</td></tr>':''}
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
${(function(){var rows='';D.accts.filter(function(ac){return ac.g==='자산'&&ac.c!=='110'&&ac.c!=='191'&&ac.c!=='130';}).forEach(function(ac){var b=acctBal(ac.c);if(b!==0)rows+='<tr><td>　'+ac.n+'</td><td class="r">'+fm(b)+'</td><td></td><td></td></tr>';});return rows;})()}
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





// ===== 월별 현금흐름표 =====
function rCashFlow(){
  var months=['06','07','08','09','10','11','12','01','02','03','04','05'];
  var monthLabels=['6월','7월','8월','9월','10월','11월','12월','1월','2월','3월','4월','5월'];
  
  var cfData={};
  months.forEach(function(m){
    cfData[m]={opIn:0,opOut:0,invIn:0,invOut:0,finIn:0,finOut:0};
  });
  
  D.bkIn.forEach(function(d){
    var mo=cfExtractMonth(d.dt);
    if(!mo||!cfData[mo])return;
    var t=d.type||cfGuessType(d,'in');
    if(t==='income') cfData[mo].opIn+=d.amt;
    else if(t==='capital'||t==='loan') cfData[mo].finIn+=d.amt;
    else if(t==='sec') {} // 은행↔증권 내부이체 제외 (전표에서 추적)
    else cfData[mo].opIn+=d.amt;
  });
  
  D.bkOut.forEach(function(d){
    var mo=cfExtractMonth(d.dt);
    if(!mo||!cfData[mo])return;
    var t=d.type||cfGuessType(d,'out');
    if(t==='expense') cfData[mo].opOut+=d.amt;
    else if(t==='sec') {} // 은행↔증권 내부이체 제외 (전표에서 추적)
    else if(t==='loan') cfData[mo].finOut+=d.amt;
    else cfData[mo].opOut+=d.amt;
  });
  
  // 증권 매매 + 증권계좌 직접거래 (전표 기반)
  D.journals.forEach(function(j){
    var m=j.dt.match(/(\d+)\//);
    if(!m)return;
    var mo=String(parseInt(m[1])).padStart(2,'0');
    if(!cfData[mo])return;
    // 주식매수: DR 130(유가증권) / CR 191(증권예수금)
    if(j.dr==='130'&&j.cr==='191') cfData[mo].invOut+=j.amt;
    // 주식매각(원가제거): DR 191 / CR 130
    if(j.dr==='191'&&j.cr==='130') cfData[mo].invIn+=j.amt;
    // 매각이익: DR 191 / CR 403(매각이익)
    if(j.dr==='191'&&j.cr==='403') cfData[mo].invIn+=j.amt;
    // 매수수수료(증권): DR 537 / CR 191
    if(j.dr==='537'&&j.cr==='191') cfData[mo].invOut+=j.amt;
    // 소비세(증권수수료): DR 154 / CR 191 (세빼기 마이그레이션 후)
    if(j.dr==='154'&&j.cr==='191') cfData[mo].invOut+=j.amt;
    // 증권계좌 직접 수입: 배당금(402), 잡수입(405) → 영업활동
    if(j.dr==='191'&&(j.cr==='402'||j.cr==='405')) cfData[mo].opIn+=j.amt;
  });
  
  var totals={opIn:0,opOut:0,invIn:0,invOut:0,finIn:0,finOut:0};
  months.forEach(function(m){
    var d=cfData[m];
    totals.opIn+=d.opIn;totals.opOut+=d.opOut;
    totals.invIn+=d.invIn;totals.invOut+=d.invOut;
    totals.finIn+=d.finIn;totals.finOut+=d.finOut;
  });
  
  var cumBal=0;
  var cumData=[];
  months.forEach(function(m){
    var d=cfData[m];
    var netCf=(d.opIn-d.opOut)+(d.invIn-d.invOut)+(d.finIn-d.finOut);
    cumBal+=netCf;
    cumData.push({m:m,net:netCf,cum:cumBal});
  });
  
  // Chart
  var maxAbs=1;
  cumData.forEach(function(cd){maxAbs=Math.max(maxAbs,Math.abs(cd.net));});
  var chartH=140,barW=50;
  var chartHtml='<div style="overflow-x:auto"><svg viewBox="0 0 '+(months.length*barW+60)+' '+(chartH+40)+'" style="width:100%;max-height:180px;font-family:sans-serif">';
  var zeroY=20+chartH/2;
  chartHtml+='<line x1="40" y1="'+zeroY+'" x2="'+(months.length*barW+50)+'" y2="'+zeroY+'" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="3,3"/>';
  chartHtml+='<text x="36" y="'+(zeroY+3)+'" text-anchor="end" fill="#94a3b8" font-size="8">0</text>';
  
  cumData.forEach(function(cd,i){
    var x=45+i*barW;
    var h=maxAbs>0?Math.abs(cd.net)/maxAbs*(chartH/2-10):0;
    var y=cd.net>=0?zeroY-h:zeroY;
    var color=cd.net>=0?'#059669':'#dc2626';
    if(h>0) chartHtml+='<rect x="'+(x-12)+'" y="'+y+'" width="24" height="'+h+'" fill="'+color+'" rx="3" opacity="0.8"/>';
    if(cd.net!==0){
      var valY=cd.net>=0?y-4:y+h+10;
      var val=Math.abs(cd.net)>=100000000?(cd.net/100000000).toFixed(1)+'\u5104':Math.abs(cd.net)>=10000?(cd.net/10000).toFixed(0)+'\u4E07':String(cd.net);
      chartHtml+='<text x="'+x+'" y="'+valY+'" text-anchor="middle" fill="'+color+'" font-size="7" font-weight="600">'+val+'</text>';
    }
    chartHtml+='<text x="'+x+'" y="'+(chartH+36)+'" text-anchor="middle" fill="#64748b" font-size="8">'+monthLabels[i].slice(0,-1)+'</text>';
  });
  chartHtml+='</svg></div>';
  
  // Summary cards
  var netOp=totals.opIn-totals.opOut;
  var netInv=totals.invIn-totals.invOut;
  var netFin=totals.finIn-totals.finOut;
  var netTotal=netOp+netInv+netFin;
  
  var summaryHtml='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  summaryHtml+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#2563eb;margin-bottom:2px">\u2160 \u00b7 \uC601\uC5C5\uD65C\uB3D9</div><div style="font-size:14px;font-weight:700;color:'+(netOp>=0?'#059669':'#dc2626')+'">'+fm(netOp)+'</div></div>';
  summaryHtml+='<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#d97706;margin-bottom:2px">\u2161 \u00b7 \uD22C\uC790\uD65C\uB3D9</div><div style="font-size:14px;font-weight:700;color:'+(netInv>=0?'#059669':'#dc2626')+'">'+fm(netInv)+'</div></div>';
  summaryHtml+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#059669;margin-bottom:2px">\u2162 \u00b7 \uC7AC\uBB34\uD65C\uB3D9</div><div style="font-size:14px;font-weight:700;color:'+(netFin>=0?'#059669':'#dc2626')+'">'+fm(netFin)+'</div></div>';
  summaryHtml+='<div style="background:#f8fafc;border:1px solid #e2e6ed;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#1e3a5f;margin-bottom:2px">\uC21C\uD604\uAE08\uC99D\uAC10</div><div style="font-size:14px;font-weight:700;color:'+(netTotal>=0?'#059669':'#dc2626')+'">'+fm(netTotal)+'</div></div>';
  summaryHtml+='</div>';
  
  // Detail table
  var cn=months.length+2;
  var tableHtml='<div style="overflow-x:auto"><table style="font-size:10px;min-width:800px"><thead><tr><th style="text-align:left;min-width:140px">\uAD6C\uBD84</th>';
  monthLabels.forEach(function(l){tableHtml+='<th class="r">'+l+'</th>';});
  tableHtml+='<th class="r" style="font-weight:700;background:#dbeafe">\uD569\uACC4</th></tr></thead><tbody>';
  
  // Operating
  tableHtml+='<tr style="background:#eff6ff"><td colspan="'+cn+'" style="font-weight:700;color:#2563eb;padding:6px 6px 4px">\u2160 \uC601\uC5C5\uD65C\uB3D9 \uD604\uAE08\uD750\uB984</td></tr>';
  tableHtml+='<tr><td style="padding-left:16px">\uC218\uC785 (\uC774\uC790\u00b7\uBC30\uB2F9 \uB4F1)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m gn">'+(cfData[m].opIn?fm(cfData[m].opIn):'')+'</td>';});
  tableHtml+='<td class="r m b gn">'+fm(totals.opIn)+'</td></tr>';
  tableHtml+='<tr class="a"><td style="padding-left:16px">\uC9C0\uCD9C (\uACBD\uBE44)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m rd">'+(cfData[m].opOut?'('+fm(cfData[m].opOut)+')':'')+'</td>';});
  tableHtml+='<td class="r m b rd">('+fm(totals.opOut)+')</td></tr>';
  tableHtml+='<tr style="font-weight:600;border-top:1px solid #bfdbfe"><td style="padding-left:8px;color:#2563eb">\uC601\uC5C5\uD65C\uB3D9 \uC18C\uACC4</td>';
  months.forEach(function(m){var v=cfData[m].opIn-cfData[m].opOut;tableHtml+='<td class="r m '+(v>=0?'gn':'rd')+'">'+fm(v)+'</td>';});
  tableHtml+='<td class="r m b '+(netOp>=0?'gn':'rd')+'">'+fm(netOp)+'</td></tr>';
  
  // Investing
  tableHtml+='<tr style="background:#fefce8"><td colspan="'+cn+'" style="font-weight:700;color:#d97706;padding:6px 6px 4px">\u2161 \uD22C\uC790\uD65C\uB3D9 \uD604\uAE08\uD750\uB984</td></tr>';
  tableHtml+='<tr><td style="padding-left:16px">\uC720\uC785 (\uC99D\uAD8C\uB9E4\uAC01 \uB4F1)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m gn">'+(cfData[m].invIn?fm(cfData[m].invIn):'')+'</td>';});
  tableHtml+='<td class="r m b gn">'+fm(totals.invIn)+'</td></tr>';
  tableHtml+='<tr class="a"><td style="padding-left:16px">\uC720\uCD9C (\uC99D\uAD8C\uB9E4\uC218\u00b7\uC774\uCCB4)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m rd">'+(cfData[m].invOut?'('+fm(cfData[m].invOut)+')':'')+'</td>';});
  tableHtml+='<td class="r m b rd">('+fm(totals.invOut)+')</td></tr>';
  tableHtml+='<tr style="font-weight:600;border-top:1px solid #fde68a"><td style="padding-left:8px;color:#d97706">\uD22C\uC790\uD65C\uB3D9 \uC18C\uACC4</td>';
  months.forEach(function(m){var v=cfData[m].invIn-cfData[m].invOut;tableHtml+='<td class="r m '+(v>=0?'gn':'rd')+'">'+(v!==0?fm(v):'')+'</td>';});
  tableHtml+='<td class="r m b '+(netInv>=0?'gn':'rd')+'">'+fm(netInv)+'</td></tr>';
  
  // Financing
  tableHtml+='<tr style="background:#f0fdf4"><td colspan="'+cn+'" style="font-weight:700;color:#059669;padding:6px 6px 4px">\u2162 \uC7AC\uBB34\uD65C\uB3D9 \uD604\uAE08\uD750\uB984</td></tr>';
  tableHtml+='<tr><td style="padding-left:16px">\uC720\uC785 (\uC790\uBCF8\uAE08\u00b7\uCC28\uC785\uAE08)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m gn">'+(cfData[m].finIn?fm(cfData[m].finIn):'')+'</td>';});
  tableHtml+='<td class="r m b gn">'+fm(totals.finIn)+'</td></tr>';
  tableHtml+='<tr class="a"><td style="padding-left:16px">\uC720\uCD9C (\uC0C1\uD658 \uB4F1)</td>';
  months.forEach(function(m){tableHtml+='<td class="r m rd">'+(cfData[m].finOut?'('+fm(cfData[m].finOut)+')':'')+'</td>';});
  tableHtml+='<td class="r m b rd">'+(totals.finOut?'('+fm(totals.finOut)+')':'0')+'</td></tr>';
  tableHtml+='<tr style="font-weight:600;border-top:1px solid #bbf7d0"><td style="padding-left:8px;color:#059669">\uC7AC\uBB34\uD65C\uB3D9 \uC18C\uACC4</td>';
  months.forEach(function(m){var v=cfData[m].finIn-cfData[m].finOut;tableHtml+='<td class="r m '+(v>=0?'gn':'rd')+'">'+(v!==0?fm(v):'')+'</td>';});
  tableHtml+='<td class="r m b '+(netFin>=0?'gn':'rd')+'">'+fm(netFin)+'</td></tr>';
  
  // Net + Cumulative
  tableHtml+='<tr style="background:#1e293b;color:#fff"><td style="font-weight:700;padding:8px 6px">\uC21C\uD604\uAE08\uC99D\uAC10</td>';
  months.forEach(function(m){
    var v=(cfData[m].opIn-cfData[m].opOut)+(cfData[m].invIn-cfData[m].invOut)+(cfData[m].finIn-cfData[m].finOut);
    tableHtml+='<td class="r m" style="color:'+(v>=0?'#6ee7b7':'#fca5a5')+';font-weight:600">'+(v!==0?fm(v):'')+'</td>';
  });
  tableHtml+='<td class="r m" style="font-weight:700;font-size:12px">'+fm(netTotal)+'</td></tr>';
  
  tableHtml+='<tr style="background:#f1f3f6"><td style="font-weight:700;color:#1e3a5f">\uB204\uC801 \uC794\uC561</td>';
  cumData.forEach(function(cd){
    tableHtml+='<td class="r m b">'+(cd.cum!==0?fm(cd.cum):'')+'</td>';
  });
  tableHtml+='<td class="r m b" style="color:#2563eb;font-size:12px">'+fm(cumBal)+'</td></tr>';
  
  // 실제보유현금 검증 행
  var actualCash=acctBal('110')+(D.secDeposit||SEC_DEP);
  var cfDiff=actualCash-cumBal;
  tableHtml+='<tr style="background:#dbeafe"><td style="font-weight:700;color:#1e3a5f">실제보유현금</td>';
  months.forEach(function(){tableHtml+='<td></td>';});
  tableHtml+='<td class="r m b" style="color:#1e3a5f;font-size:12px">'+fm(actualCash)+'</td></tr>';
  if(Math.abs(cfDiff)>0){
    tableHtml+='<tr><td style="font-size:9px;color:#64748b;padding-left:8px">└ 차이 (비현금 회계조정)</td>';
    months.forEach(function(){tableHtml+='<td></td>';});
    tableHtml+='<td class="r m" style="font-size:9px;color:#64748b">'+fm(cfDiff)+'</td></tr>';
  }
  
  tableHtml+='</tbody></table></div>';
  
  var noteHtml='<div class="ib" style="font-size:9px;margin-top:8px">\uD83D\uDCA1 법인계좌+증권계좌 입출금 기반. 영업=경비수입/지출(배당·잡수입 포함), 투자=증권매매·수수료·소비세, 재무=자본금·차입금. 실제보유현금과의 차이는 비현금 회계조정(취득원가 재분류 등)에 의한 것.</div>';
  
  return summaryHtml+chartHtml+tableHtml+noteHtml;
}

function cfExtractMonth(dt){
  if(!dt)return null;
  var m;
  m=dt.match(/^(\d{4})[\/\-](\d{1,2})/);
  if(m) return String(parseInt(m[2])).padStart(2,'0');
  m=dt.match(/^(\d{1,2})\//);
  if(m) return String(parseInt(m[1])).padStart(2,'0');
  return null;
}

function cfGuessType(d,dir){
  var c=(d.cat||'').toLowerCase();
  if(c.includes('\uC99D\uAD8C')||c.includes('\uC8FC\uC2DD')||c.includes('\uB9E4\uC218')||c.includes('\uB9E4\uB3C4')||c.includes('\uC774\uCCB4')||c.includes('ipo')||c.includes('\uC99D\uAC70\uAE08'))return 'sec';
  if(c.includes('\uC790\uBCF8')||c.includes('\uCD9C\uC790'))return 'capital';
  if(c.includes('\uCC28\uC785'))return 'loan';
  if(dir==='in'&&(c.includes('\uC774\uC790')||c.includes('\uBC30\uB2F9')))return 'income';
  return dir==='in'?'income':'expense';
}


// ===== 미결관리 (Open Item Management) =====
// 미결관리 대상 계정 (부채·자산 중 개별 추적 필요한 계정)
var OI_ACCTS=['122','203','204','205','206','207','221','224','225'];

function isOIAcct(code){return OI_ACCTS.indexOf(code)>=0;}

// 미결 항목 조회: 해당 계정에서 반제되지 않은 전표
function getOpenItems(acctCode){
  var items=[];
  D.journals.forEach(function(j){
    if(j.dr===acctCode||j.cr===acctCode){
      var isDr=j.dr===acctCode;
      var side=isDr?'dr':'cr';
      // 부채계정: cr=발생(+), dr=상환(-)
      // 자산계정: dr=발생(+), cr=회수(-)
      var ac=D.accts.find(function(x){return x.c===acctCode;});
      var isLiab=ac&&ac.g==='부채';
      var sign=(isLiab&&!isDr)||(!isLiab&&isDr)?1:-1;
      items.push({
        id:j.id, dt:jDispDate(j), no:j.no, desc:j.desc, 
        amt:j.amt, side:side, sign:sign,
        signedAmt:j.amt*sign,
        tkCode:j.tkCode||'',
        cleared:j.cleared||false,
        clearGroup:j.clearGroup||''
      });
    }
  });
  return items;
}

function rOI(){
  // 미결관리 대상 계정별 요약
  var summaryHtml='';
  var totalOpen=0, totalCleared=0;
  
  OI_ACCTS.forEach(function(code){
    var ac=D.accts.find(function(x){return x.c===code;});
    if(!ac)return;
    var items=getOpenItems(code);
    if(items.length===0)return;
    
    var openItems=items.filter(function(x){return !x.cleared;});
    var clearedItems=items.filter(function(x){return x.cleared;});
    var openBal=openItems.reduce(function(s,x){return s+x.signedAmt;},0);
    
    totalOpen+=openItems.length;
    totalCleared+=clearedItems.length;
    
    var statusColor=openBal===0?'#059669':openBal>0?'#2563eb':'#d97706';
    summaryHtml+='<div onclick="showOIDetail(\''+code+'\')" style="background:#fff;border:1px solid #e2e6ed;border-radius:8px;padding:10px 14px;cursor:pointer;border-left:4px solid '+statusColor+'" onmouseenter="this.style.borderColor=\''+statusColor+'\'" onmouseleave="this.style.borderColor=\'#e2e6ed\'">';
    summaryHtml+='<div style="display:flex;justify-content:space-between;align-items:center">';
    summaryHtml+='<div><div style="font-size:12px;font-weight:600">'+ac.k+' ('+code+')</div>';
    summaryHtml+='<div style="font-size:9px;color:#64748b">미결 '+openItems.length+'건 / 반제 '+clearedItems.length+'건</div></div>';
    summaryHtml+='<div style="text-align:right"><div style="font-size:14px;font-weight:700;color:'+statusColor+';font-feature-settings:\'tnum\'">'+fm(Math.abs(openBal))+'</div>';
    summaryHtml+='<div style="font-size:9px;color:#64748b">'+(openBal>0?'미결잔액':'')+(openBal===0&&openItems.length===0?'완결':'')+(openBal===0&&openItems.length>0?'잔액0 (확인필요)':'')+'</div></div>';
    summaryHtml+='</div></div>';
  });
  
  if(!summaryHtml) summaryHtml='<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:40px;margin-bottom:12px">📋</div>미결관리 대상 전표가 없습니다.<br>전표 기표 후 여기서 확인하세요.</div>';
  
  return '<div class="pt">미결관리</div>'+
    '<div class="ib">💡 부채·자산 계정의 미결(미정산) 항목을 추적하고 반제(상계)합니다. 계정을 클릭하면 상세 내역을 표시합니다.</div>'+
    '<div class="cards">'+
      '<div class="cd bl"><div class="l">미결관리 계정</div><div class="v">'+OI_ACCTS.length+'개</div></div>'+
      '<div class="cd go"><div class="l">미결 항목</div><div class="v">'+totalOpen+'건</div></div>'+
      '<div class="cd gn"><div class="l">반제 완료</div><div class="v">'+totalCleared+'건</div></div>'+
    '</div>'+
    '<div class="pn"><div class="ph"><span>계정별 미결 현황</span><button class="bt gh" style="font-size:10px" onclick="manageOIAccts()">⚙️ 대상계정 관리</button></div>'+
    '<div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">'+summaryHtml+'</div></div>';
}

function showOIDetail(code){
  var ac=D.accts.find(function(x){return x.c===code;});
  if(!ac)return;
  var items=getOpenItems(code);
  var openItems=items.filter(function(x){return !x.cleared;});
  var clearedItems=items.filter(function(x){return x.cleared;});
  
  // Open items table
  var openHtml='';
  if(openItems.length>0){
    openHtml='<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:#d97706;margin-bottom:6px">🔶 미결 항목 ('+openItems.length+'건)</div>';
    openHtml+='<table><thead><tr><th><input type="checkbox" id="oiSelAll" onchange="oiToggleAll(this)"></th><th>일자</th><th>전표</th><th>적요</th><th>추적코드</th><th class="r">발생</th><th class="r">상환</th><th class="r">잔액</th></tr></thead><tbody>';
    var runBal=0;
    openItems.forEach(function(it,i){
      runBal+=it.signedAmt;
      var isPositive=it.signedAmt>0;
      openHtml+='<tr class="'+(i%2?'a':'')+'">';
      openHtml+='<td><input type="checkbox" class="oi-chk" data-id="'+it.id+'" data-amt="'+it.signedAmt+'" onchange="oiUpdateSel()"></td>';
      openHtml+='<td class="mu m">'+it.dt+'</td>';
      openHtml+='<td style="color:#2563eb;font-size:10px">'+it.no+'</td>';
      openHtml+='<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+it.desc+'</td>';
      openHtml+='<td style="font-size:10px;color:#7c3aed">'+(it.tkCode||'-')+'</td>';
      openHtml+='<td class="r m gn">'+(isPositive?fm(it.amt):'')+'</td>';
      openHtml+='<td class="r m rd">'+(!isPositive?fm(it.amt):'')+'</td>';
      openHtml+='<td class="r m b">'+fm(runBal)+'</td>';
      openHtml+='</tr>';
    });
    openHtml+='</tbody></table>';
    openHtml+='<div id="oiSelInfo" style="margin-top:8px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e6ed;border-radius:6px;font-size:11px;display:none"></div>';
    openHtml+='<div style="margin-top:8px;display:flex;gap:6px">';
    openHtml+='<button class="bt" id="oiClearBtn" onclick="oiClear(\''+code+'\')" style="background:#7c3aed" disabled>📋 선택항목 반제</button>';
    openHtml+='<button class="bt gh" onclick="oiAssignTK(\''+code+'\')">🏷 추적코드 일괄부여</button>';
    openHtml+='</div></div>';
  }
  
  // Cleared items
  var clearedHtml='';
  if(clearedItems.length>0){
    clearedHtml='<div style="margin-top:12px"><div style="font-size:12px;font-weight:700;color:#059669;margin-bottom:6px">✅ 반제 완료 ('+clearedItems.length+'건)</div>';
    clearedHtml+='<table><thead><tr><th>일자</th><th>전표</th><th>적요</th><th>반제그룹</th><th class="r">금액</th><th></th></tr></thead><tbody>';
    clearedItems.forEach(function(it,i){
      clearedHtml+='<tr class="'+(i%2?'a':'')+'" style="opacity:0.6">';
      clearedHtml+='<td class="mu m">'+it.dt+'</td>';
      clearedHtml+='<td style="color:#2563eb;font-size:10px">'+it.no+'</td>';
      clearedHtml+='<td>'+it.desc+'</td>';
      clearedHtml+='<td style="font-size:10px;color:#059669">'+(it.clearGroup||'')+'</td>';
      clearedHtml+='<td class="r m">'+fm(it.amt)+'</td>';
      clearedHtml+='<td><button class="del" onclick="oiUndo('+it.id+',\''+code+'\')" style="font-size:9px;color:#d97706">반제취소</button></td>';
      clearedHtml+='</tr>';
    });
    clearedHtml+='</tbody></table></div>';
  }
  
  var bal=items.reduce(function(s,x){return s+x.signedAmt;},0);
  var openBal=openItems.reduce(function(s,x){return s+x.signedAmt;},0);
  
  showModal('📋 '+ac.k+' ('+code+') 미결관리',
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'+
    '<div style="background:#eff6ff;padding:8px;border-radius:6px;text-align:center"><div style="font-size:9px;color:#2563eb">총잔액</div><div style="font-size:14px;font-weight:700">'+fm(bal)+'</div></div>'+
    '<div style="background:#fffbeb;padding:8px;border-radius:6px;text-align:center"><div style="font-size:9px;color:#d97706">미결잔액</div><div style="font-size:14px;font-weight:700">'+fm(openBal)+'</div></div>'+
    '<div style="background:#f0fdf4;padding:8px;border-radius:6px;text-align:center"><div style="font-size:9px;color:#059669">반제완료</div><div style="font-size:14px;font-weight:700">'+clearedItems.length+'건</div></div>'+
    '</div>'+
    openHtml+clearedHtml
  );
}

// 체크박스 전체선택
function oiToggleAll(el){
  document.querySelectorAll('.oi-chk').forEach(function(cb){cb.checked=el.checked;});
  oiUpdateSel();
}

// 선택된 항목 합계 표시
function oiUpdateSel(){
  var checks=document.querySelectorAll('.oi-chk:checked');
  var info=document.getElementById('oiSelInfo');
  var btn=document.getElementById('oiClearBtn');
  if(!info||!btn)return;
  
  if(checks.length===0){
    info.style.display='none';
    btn.disabled=true;
    return;
  }
  
  var total=0, cnt=0;
  checks.forEach(function(cb){total+=parseFloat(cb.dataset.amt);cnt++;});
  
  info.style.display='block';
  var isBalanced=Math.abs(total)<1;
  info.innerHTML='선택: <b>'+cnt+'건</b> | 합계: <b style="color:'+(isBalanced?'#059669':'#dc2626')+'">'+fm(total)+'</b>'+
    (isBalanced?' <span style="color:#059669">✅ 반제 가능 (차대일치)</span>':' <span style="color:#dc2626">⚠️ 잔액 불일치 — 차대가 맞아야 반제 가능</span>');
  btn.disabled=!isBalanced;
}

// 반제 실행
function oiClear(acctCode){
  var checks=document.querySelectorAll('.oi-chk:checked');
  if(checks.length===0)return;
  
  // Verify balance = 0
  var total=0;
  var ids=[];
  checks.forEach(function(cb){total+=parseFloat(cb.dataset.amt);ids.push(parseInt(cb.dataset.id));});
  
  if(Math.abs(total)>=1){
    alert('선택항목의 합계가 0이 아닙니다.\n발생(+)과 상환(-)이 일치해야 반제할 수 있습니다.');
    return;
  }
  
  // Generate clear group code
  if(!D._clearSeq)D._clearSeq=0;
  D._clearSeq++;
  var clearGroup='CLR-'+acctCode+'-'+String(D._clearSeq).padStart(3,'0');
  
  var desc=ids.length+'건 반제 ('+clearGroup+')\n';
  ids.forEach(function(id){
    var j=D.journals.find(function(x){return x.id===id;});
    if(j)desc+=j.dt+' '+j.no+' '+j.desc+' '+fm(j.amt)+'\n';
  });
  
  if(!confirm('반제 실행\n\n'+desc+'\n반제그룹: '+clearGroup+'\n\n진행하시겠습니까?'))return;
  
  ids.forEach(function(id){
    var j=D.journals.find(function(x){return x.id===id;});
    if(j){
      j.cleared=true;
      j.clearGroup=clearGroup;
      j.clearDate=new Date().toISOString().slice(0,10);
    }
  });
  saveD();
  toast(ids.length+'건 반제 완료 ('+clearGroup+')');
  showOIDetail(acctCode);
}

// 반제 취소
function oiUndo(journalId,acctCode){
  if(!confirm('이 항목의 반제를 취소하시겠습니까?'))return;
  var j=D.journals.find(function(x){return x.id===journalId;});
  if(j){
    delete j.cleared;
    delete j.clearGroup;
    delete j.clearDate;
    saveD();
    toast('반제 취소 완료');
    showOIDetail(acctCode);
  }
}

// 추적코드 일괄부여
function oiAssignTK(acctCode){
  var items=getOpenItems(acctCode).filter(function(x){return !x.cleared&&!x.tkCode;});
  if(items.length===0){alert('추적코드가 없는 미결항목이 없습니다.');return;}
  
  if(!confirm(items.length+'건에 추적코드를 자동 부여하시겠습니까?'))return;
  
  var now=new Date();
  var prefix=acctCode+'-'+String(now.getFullYear()).slice(2)+String(now.getMonth()+1).padStart(2,'0');
  var seq=1;
  
  // Find max existing seq for this prefix
  D.journals.forEach(function(j){
    if(j.tkCode&&j.tkCode.startsWith(prefix)){
      var n=parseInt(j.tkCode.split('-')[2])||0;
      if(n>=seq)seq=n+1;
    }
  });
  
  items.forEach(function(it){
    var j=D.journals.find(function(x){return x.id===it.id;});
    if(j){
      j.tkCode=prefix+'-'+String(seq).padStart(3,'0');
      seq++;
    }
  });
  saveD();
  toast(items.length+'건 추적코드 부여 완료');
  showOIDetail(acctCode);
}

// 미결관리 대상계정 관리
function manageOIAccts(){
  var html='<div style="margin-bottom:10px;font-size:11px;color:#64748b">체크된 계정이 미결관리 대상입니다. 부채·자산 계정 중 개별 추적이 필요한 항목을 선택하세요.</div>';
  html+='<div style="max-height:400px;overflow-y:auto">';
  
  ['부채','자산'].forEach(function(g){
    html+='<div style="font-size:11px;font-weight:700;color:#2563eb;margin:8px 0 4px;padding:3px 6px;background:#dbeafe;border-radius:4px;display:inline-block">'+g+'</div>';
    D.accts.filter(function(ac){return ac.g===g;}).forEach(function(ac){
      var checked=OI_ACCTS.indexOf(ac.c)>=0;
      var hasBal=acctBal(ac.c)!==0;
      html+='<label style="display:flex;align-items:center;gap:6px;padding:3px 8px;font-size:11px;cursor:pointer'+(hasBal?';font-weight:600':'')+'">';
      html+='<input type="checkbox" class="oi-acct-chk" value="'+ac.c+'"'+(checked?' checked':'')+'>';
      html+=ac.c+' '+ac.k+(hasBal?' <span style="color:#2563eb;font-size:10px">('+fm(acctBal(ac.c))+')</span>':'');
      html+='</label>';
    });
  });
  html+='</div>';
  html+='<div style="margin-top:10px"><button class="bt" onclick="saveOIAccts()">💾 저장</button></div>';
  
  showModal('⚙️ 미결관리 대상계정 설정', html);
}

function saveOIAccts(){
  var newList=[];
  document.querySelectorAll('.oi-acct-chk:checked').forEach(function(cb){
    newList.push(cb.value);
  });
  OI_ACCTS=newList;
  // Save to D for persistence
  D._oiAccts=newList;
  saveD();
  closeModal();
  toast('미결관리 대상계정 저장 완료 ('+newList.length+'개)');
  go('oi');
}


// ===== 소비세 집계표 (일반과세·세빼기경리) =====
function rTaxSummary(){
  // 154(가지급소비세) and 211(가수소비세) balances from journals
  var inputTax=acctBal('154');  // 매입세액 (지급한 소비세)
  var outputTax=acctBal('211'); // 매출세액 (받은 소비세)
  var netTax=outputTax-inputTax; // 양수=납부, 음수=환급

  // Breakdown by taxCls
  var expCodes={};D.accts.filter(function(ac){return ac.g==='비용';}).forEach(function(ac){expCodes[ac.c]=true;});
  var revCodes={};D.accts.filter(function(ac){return ac.g==='수익';}).forEach(function(ac){revCodes[ac.c]=true;});
  var cats={'과세10%':{exp:0,rev:0,tax154:0,tax211:0,cnt:0},'경감8%':{exp:0,rev:0,tax154:0,tax211:0,cnt:0},'비과세':{exp:0,rev:0,cnt:0},'불과세':{exp:0,rev:0,cnt:0},'미분류':{exp:0,rev:0,cnt:0}};
  D.journals.forEach(function(j){
    var cls=j.taxCls||'미분류';
    if(!cats[cls]) cats[cls]={exp:0,rev:0,tax154:0,tax211:0,cnt:0};
    if(expCodes[j.dr]) cats[cls].exp+=j.amt;
    if(revCodes[j.cr]) cats[cls].rev+=j.amt;
    if(j.dr==='154') cats[cls].tax154=(cats[cls].tax154||0)+j.amt;
    if(j.cr==='211') cats[cls].tax211=(cats[cls].tax211||0)+j.amt;
    cats[cls].cnt++;
  });

  // Check for un-migrated entries
  var unmigrated=D.journals.filter(function(j){
    if(j.taxCls!=='과세10%'&&j.taxCls!=='경감8%') return false;
    if(j.dr==='154'||j.cr==='211') return false;
    if(j.dr==='537') return false; // 537 already has separate tax entries
    if(j.desc&&j.desc.indexOf('[소비세]')>=0) return false;
    if(!expCodes[j.dr]&&!revCodes[j.cr]) return false;
    var desc=j.desc;
    var hasCompanion=D.journals.some(function(j2){
      return j2.desc==='[소비세] '+desc&&j2.dt===j.dt;
    });
    return !hasCompanion;
  });

  // Header
  var html='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px">';
  html+='<b>📋 일반과세 (本則課税) · 세빼기 경리 (税抜経理方式)</b>';
  html+='<br>자본금 1,000만엔 → 설립 제1기부터 과세사업자. 전표 기표 시 본체/소비세 자동분리.';
  html+='<br>신고기한: 결산일 익일부터 2개월 이내 (7/31)';
  html+='</div>';

  // Migration warning
  if(unmigrated.length>0){
    html+='<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:14px">';
    html+='<div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:4px">⚠️ 세빼기 미전환 전표 '+unmigrated.length+'건 발견</div>';
    html+='<div style="font-size:11px;color:#64748b;margin-bottom:8px">과세 구분이 있지만 소비세 분리가 안 된 기존 전표입니다. 아래 버튼으로 일괄 전환하세요.</div>';
    html+='<button class="bt rd" onclick="migrateTaxSplit()">기존 전표 소비세 분리 실행 ('+unmigrated.length+'건)</button>';
    html+='</div>';
  }

  // 매출세액 vs 매입세액 summary
  var isRefund=netTax<0;
  html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">';
  html+='<div style="background:#fff;border:1px solid #e2e6ed;border-radius:8px;padding:12px;text-align:center;border-top:3px solid #d97706">';
  html+='<div style="font-size:10px;color:#d97706;font-weight:600">매출세액 (売上税額)</div>';
  html+='<div style="font-size:16px;font-weight:700;margin-top:4px">'+fm(outputTax)+'</div>';
  html+='<div style="font-size:9px;color:#64748b">211 가수소비세 잔액</div></div>';
  html+='<div style="background:#fff;border:1px solid #e2e6ed;border-radius:8px;padding:12px;text-align:center;border-top:3px solid #2563eb">';
  html+='<div style="font-size:10px;color:#2563eb;font-weight:600">매입세액 (仕入税額)</div>';
  html+='<div style="font-size:16px;font-weight:700;margin-top:4px">'+fm(inputTax)+'</div>';
  html+='<div style="font-size:9px;color:#64748b">154 가지급소비세 잔액</div></div>';
  html+='<div style="background:#fff;border:1px solid #e2e6ed;border-radius:8px;padding:12px;text-align:center;border-top:3px solid '+(isRefund?'#059669':'#dc2626')+'">';
  html+='<div style="font-size:10px;color:'+(isRefund?'#059669':'#dc2626')+';font-weight:600">'+(isRefund?'환급세액 (還付)':'납부세액 (納付)')+'</div>';
  html+='<div style="font-size:16px;font-weight:700;margin-top:4px;color:'+(isRefund?'#059669':'#dc2626')+'">'+fm(Math.abs(netTax))+'</div>';
  html+='<div style="font-size:9px;color:#64748b">매출세액 - 매입세액</div></div></div>';

  // 결산 정산전표 생성
  html+='<div class="pn" style="padding:14px;margin-bottom:14px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 소비세 결산 정산전표</div>';
  if(isRefund){
    html+='<div style="margin-bottom:8px;font-size:12px">① DR 211(가수소비세) '+fm(outputTax)+' / CR 154(가지급소비세) '+fm(outputTax)+' (상계)</div>';
    html+='<div style="margin-bottom:8px;font-size:12px">② DR 122(미수입금) '+fm(Math.abs(netTax))+' / CR 154(가지급소비세) '+fm(Math.abs(netTax))+' (환급)</div>';
  } else if(netTax>0){
    html+='<div style="margin-bottom:8px;font-size:12px">① DR 211(가수소비세) '+fm(inputTax)+' / CR 154(가지급소비세) '+fm(inputTax)+' (상계)</div>';
    html+='<div style="margin-bottom:8px;font-size:12px">② DR 211(가수소비세) '+fm(netTax)+' / CR 206(미지급소비세) '+fm(netTax)+' (납부)</div>';
  } else {
    html+='<div style="margin-bottom:8px;font-size:12px">소비세 = 0 (과세거래 없음)</div>';
  }
  html+='<button class="bt '+(isRefund?'gn':'rd')+'" onclick="genTaxSettlement()" '+(netTax===0?'disabled':'')+'>정산전표 생성 (결산 시)</button>';
  html+=' <span style="font-size:10px;color:#64748b">중복 체크 있음</span>';
  var taxJournals=D.journals.filter(function(j){return j.desc&&j.desc.indexOf('[소비세정산]')>=0;});
  if(taxJournals.length>0){
    html+='<div style="margin-top:8px;font-size:10px;color:#d97706">⚠️ 이미 정산전표 '+taxJournals.length+'건: ';
    taxJournals.forEach(function(j){html+=j.no+' '+fm(j.amt)+'엔 ';});
    html+='</div>';
  }
  html+='</div>';

  // 소비세 전표 상세 (154/211 entries)
  var taxEntries=D.journals.filter(function(j){return j.dr==='154'||j.cr==='211';});
  html+='<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:700">📋 소비세 전표 상세 ('+taxEntries.length+'건)</span>';
  html+='<div style="display:flex;gap:4px"><button class="bt gh" style="font-size:10px" onclick="sortTaxEntries(\'date\')">일자순</button><button class="bt gh" style="font-size:10px" onclick="sortTaxEntries(\'no\')">전표번호순</button><button class="bt gh" style="font-size:10px" onclick="sortTaxEntries(\'amt\')">금액순</button></div></div>';
  html+='<div id="taxEntryTable">';
  html+=buildTaxEntryTable(taxEntries,'date');
  html+='</div>';

  html+='<div class="ib" style="margin-top:14px;font-size:10px">';
  html+='💡 <b>세빼기 경리 (税抜経理方式):</b> 전표 기표 시 소비세 구분(과세10%/경감8%) 선택하면 본체와 소비세가 자동 분리됩니다.<br>';
  html+='• 매입: DR 비용(본체) + DR 154(가지급소비세) / CR 보통예금(세포함액)<br>';
  html+='• 결산: 154와 211을 상계 → 차액을 206(납부) 또는 122(환급)으로 정산<br>';
  html+='• 환급 가능: 매출세액 < 매입세액 → 소비세 환급 신청 (세리사 확인 필요)</div>';
  return html;
}

// --- 소비세 결산 정산전표 ---
function buildTaxEntryTable(entries,sortBy){
  if(!entries||entries.length===0) return '<div style="padding:20px;text-align:center;color:#64748b">소비세 전표가 없습니다.</div>';
  var sorted=entries.slice();
  if(sortBy==='date') sorted.sort(function(a,b){return jSortKey(a).localeCompare(jSortKey(b));});
  else if(sortBy==='no') sorted.sort(function(a,b){return (a.no||'').localeCompare(b.no||'');});
  else if(sortBy==='amt') sorted.sort(function(a,b){return b.amt-a.amt;});
  var total=0;
  var h='<table><thead><tr><th>일자</th><th>전표</th><th>적요</th><th>유형</th><th class="r">세액</th></tr></thead><tbody>';
  sorted.forEach(function(j,i){
    var type=j.dr==='154'?'<span style="color:#2563eb">매입세</span>':'<span style="color:#d97706">매출세</span>';
    h+='<tr class="'+(i%2?'a':'')+'"><td class="mu m" style="font-size:10px">'+jDispDate(j)+'</td><td style="color:#2563eb;font-size:10px">'+(j.no||'-')+'</td><td>'+j.desc+'</td><td>'+type+'</td><td class="r m b">'+fm(j.amt)+'</td></tr>';
    total+=j.amt;
  });
  h+='<tr class="t"><td colspan="4">합계 ('+sorted.length+'건)</td><td class="r m">'+fm(total)+'</td></tr>';
  h+='</tbody></table>';
  return h;
}
function sortTaxEntries(sortBy){
  var entries=D.journals.filter(function(j){return j.dr==='154'||j.cr==='211';});
  var el=document.getElementById('taxEntryTable');
  if(el) el.innerHTML=buildTaxEntryTable(entries,sortBy);
}

function genTaxSettlement(){
  var existing=D.journals.filter(function(j){return j.desc&&j.desc.indexOf('[소비세정산]')>=0;});
  if(existing.length>0){
    if(!confirm('⚠️ 이미 정산전표가 '+existing.length+'건 있습니다. 중복 생성하시겠습니까?')) return;
  }
  var inputTax=acctBal('154');
  var outputTax=acctBal('211');
  if(inputTax===0&&outputTax===0){toast('정산할 소비세가 없습니다','warn');return;}
  var netTax=outputTax-inputTax;
  var isRefund=netTax<0;
  var count=0;
  // Step 1: 상계 (netting) — smaller of the two
  var netAmt=Math.min(inputTax,outputTax);
  if(netAmt>0){
    D.journals.push({id:nid(),dt:'5/31',no:genSlipNo('2026-05','211','154'),desc:'소비세 상계 (가수↔가지급) [소비세정산]',dr:'211',cr:'154',amt:netAmt,edt:'2026-05-31',pdt:'2026-05-31',cur:'JPY',exp:'',vendor:'',taxCls:''});
    count++;
  }
  // Step 2: remainder
  var remainder=Math.abs(netTax);
  if(remainder>0){
    if(isRefund){
      // 환급: DR 122(미수입금) / CR 154(가지급소비세)
      D.journals.push({id:nid(),dt:'5/31',no:genSlipNo('2026-05','122','154'),desc:'소비세 환급액 [소비세정산]',dr:'122',cr:'154',amt:remainder,edt:'2026-05-31',pdt:'2026-05-31',cur:'JPY',exp:'',vendor:'',taxCls:''});
    } else {
      // 납부: DR 211(가수소비세) / CR 206(미지급소비세)
      D.journals.push({id:nid(),dt:'5/31',no:genSlipNo('2026-05','211','206'),desc:'소비세 납부액 [소비세정산]',dr:'211',cr:'206',amt:remainder,edt:'2026-05-31',pdt:'2026-05-31',cur:'JPY',exp:'',vendor:'',taxCls:''});
    }
    count++;
  }
  saveD();
  toast('소비세 정산전표 '+count+'건 생성 ('+(isRefund?'환급 ':'납부 ')+fm(remainder)+'엔)');
  go('fs');
}

// --- 기존 전표 소비세 분리 마이그레이션 ---
function migrateTaxSplit(){
  var expCodes={};D.accts.filter(function(ac){return ac.g==='비용';}).forEach(function(ac){expCodes[ac.c]=true;});
  var revCodes={};D.accts.filter(function(ac){return ac.g==='수익';}).forEach(function(ac){revCodes[ac.c]=true;});
  // Find entries that have taxCls but no [소비세] companion AND are not 537 (537 already has separate tax entries)
  var targets=D.journals.filter(function(j){
    if(j.taxCls!=='과세10%'&&j.taxCls!=='경감8%') return false;
    if(j.dr==='154'||j.cr==='211') return false; // already a tax entry
    if(j.dr==='537') return false; // 537 already has separate 소비세 entries in data.js
    if(j.desc&&j.desc.indexOf('[소비세]')>=0) return false;
    if(!expCodes[j.dr]&&!revCodes[j.cr]) return false; // not expense/revenue
    // Check if companion [소비세] entry already exists for this specific entry
    var desc=j.desc;
    var hasCompanion=D.journals.some(function(j2){
      return j2.desc==='[소비세] '+desc&&j2.dt===j.dt;
    });
    return !hasCompanion;
  });
  if(targets.length===0){toast('전환할 전표가 없습니다');return;}
  if(!confirm(targets.length+'건의 과세 전표를 세빼기로 전환합니다.\n계속하시겠습니까?')) return;
  var count=0,totalTax=0;
  targets.forEach(function(j){
    var rate=j.taxCls==='경감8%'?8:10;
    var taxAmt=Math.round(j.amt*rate/(100+rate));
    if(taxAmt<=0) return;
    var netAmt=j.amt-taxAmt;
    var isExp=expCodes[j.dr];
    var isRev=revCodes[j.cr];
    j.amt=netAmt;
    var taxDr=isExp?'154':j.dr;
    var taxCr=isRev?'211':j.cr;
    D.journals.push({
      id:nid(),dt:j.dt,no:genSlipNo(j.edt||'2026-03',taxDr,taxCr),desc:'[소비세] '+j.desc,
      dr:taxDr,cr:taxCr,amt:taxAmt,
      edt:j.edt||'',pdt:j.pdt||'',cur:j.cur||'JPY',exp:'',vendor:j.vendor||'',taxCls:j.taxCls
    });
    count++;totalTax+=taxAmt;
  });
  saveD();
  toast('세빼기 전환 완료: '+count+'건, 소비세 합계 '+fm(totalTax)+'엔');
  go('fs');
}


// ===== 원천징수세 관리 (155 가지급법인세) =====
function rWithholding(){
  // 155계정(가지급법인세) 관련 전표 조회
  var items=[];
  D.journals.forEach(function(j){
    if(j.dr==='155'||j.cr==='155'){
      items.push({
        id:j.id, dt:jDispDate(j), no:j.no, desc:j.desc, amt:j.amt,
        isDr:j.dr==='155',
        source:j.dr==='155'?j.cr:j.dr
      });
    }
  });
  
  var bal155=acctBal('155');
  var taxBal=acctBal('550'); // 법인세등
  var netTax=taxBal-bal155;
  
  // Summary
  var html='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">';
  html+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#2563eb">가지급법인세 (155)</div><div style="font-size:16px;font-weight:700">'+fm(bal155)+'</div></div>';
  html+='<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#dc2626">법인세등 (550)</div><div style="font-size:16px;font-weight:700">'+fm(taxBal)+'</div></div>';
  html+='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:#059669">결산 시 납부세액</div><div style="font-size:16px;font-weight:700">'+fm(netTax)+'</div><div style="font-size:9px;color:#64748b">법인세 - 가지급법인세</div></div>';
  html+='</div>';
  
  // How to use guide
  html+='<div class="ib" style="font-size:10px;margin-bottom:12px">';
  html+='<b>사용법:</b> 이자·배당 수령 시 원천징수된 세금을 155(가지급법인세)로 기표합니다.<br>';
  html+='• 이자 원천징수: <b>DR 155 가지급법인세 / CR 401 수취이자</b> (원천세액 부분)<br>';
  html+='• 배당 원천징수: <b>DR 155 가지급법인세 / CR 402 수취배당금</b> (원천세액 부분)<br>';
  html+='• 결산 시: 법인세(550)에서 가지급법인세(155)를 차감하여 실제 납부세액 산출';
  html+='</div>';
  
  // Quick entry buttons
  html+='<div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap">';
  html+='<button class="bt" onclick="addWithholding(\'interest\')" style="background:#2563eb;font-size:11px">+ 이자 원천징수 기표</button>';
  html+='<button class="bt" onclick="addWithholding(\'dividend\')" style="background:#7c3aed;font-size:11px">+ 배당 원천징수 기표</button>';
  html+='</div>';
  
  // Transaction list
  if(items.length>0){
    html+='<div style="font-size:12px;font-weight:700;margin-bottom:6px">155 계정 전표 내역 ('+items.length+'건)</div>';
    html+='<table><thead><tr><th>일자</th><th>전표</th><th>적요</th><th>상대계정</th><th class="r">차변(납부)</th><th class="r">대변(환급)</th><th class="r">잔액</th></tr></thead><tbody>';
    var runBal=0;
    items.forEach(function(it,i){
      runBal+=it.isDr?it.amt:-it.amt;
      var srcAcct=D.accts.find(function(x){return x.c===it.source;});
      html+='<tr class="'+(i%2?'a':'')+'">';
      html+='<td class="mu m">'+it.dt+'</td>';
      html+='<td style="color:#2563eb;font-size:10px">'+it.no+'</td>';
      html+='<td>'+it.desc+'</td>';
      html+='<td style="font-size:10px">'+(srcAcct?srcAcct.k:it.source)+'</td>';
      html+='<td class="r m gn">'+(it.isDr?fm(it.amt):'')+'</td>';
      html+='<td class="r m rd">'+(!it.isDr?fm(it.amt):'')+'</td>';
      html+='<td class="r m b">'+fm(runBal)+'</td>';
      html+='</tr>';
    });
    html+='</tbody></table>';
  } else {
    html+='<div style="text-align:center;padding:30px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">💰</div>아직 원천징수세 기표 내역이 없습니다.<br>이자·배당 수령 시 위 버튼으로 간편 기표하세요.</div>';
  }
  
  return html;
}

function addWithholding(type){
  var title=type==='interest'?'이자 원천징수 기표':'배당 원천징수 기표';
  var crAcct=type==='interest'?'401':'402';
  var crName=type==='interest'?'수취이자(401)':'수취배당금(402)';
  var rate=type==='interest'?'15.315%':'20.315%';
  
  showModal(title,
    '<div class="fg">'+
    '<div><label>일자</label><input type="date" id="wh_dt" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
    '<div><label>적요</label><input id="wh_desc" placeholder="예: 보통예금이자 원천징수" value="'+(type==='interest'?'보통예금이자 원천징수':'배당금 원천징수')+'"></div>'+
    '<div><label>총수령액 (세전)</label><input type="number" id="wh_gross" placeholder="0" oninput="calcWithholding(\''+type+'\')"></div>'+
    '<div><label>원천세율</label><input id="wh_rate" value="'+rate+'" disabled style="background:#f1f3f6"></div>'+
    '<div><label>원천세액 (자동계산)</label><input type="number" id="wh_tax" placeholder="0" style="background:#fffbeb"></div>'+
    '<div><label>세후수령액</label><input type="number" id="wh_net" placeholder="0" disabled style="background:#f1f3f6"></div>'+
    '<div class="full" style="padding:8px;background:#f8fafc;border:1px solid #e2e6ed;border-radius:6px;font-size:10px">'+
      '생성 전표:<br>① DR 110 보통예금 <b id="wh_p1">0</b> / CR '+crName+' <b id="wh_p1b">0</b> (세후수령)<br>'+
      '② DR 155 가지급법인세 <b id="wh_p2">0</b> / CR '+crName+' <b id="wh_p2b">0</b> (원천세)'+
    '</div>'+
    '<div class="full" style="display:flex;gap:8px;justify-content:flex-end">'+
      '<button class="bt gh" onclick="closeModal()">취소</button>'+
      '<button class="bt" onclick="doAddWithholding(\''+type+'\')">전표 생성</button>'+
    '</div></div>');
}

function calcWithholding(type){
  var gross=+(document.getElementById('wh_gross').value)||0;
  var rate=type==='interest'?0.15315:0.20315;
  var tax=Math.floor(gross*rate);
  var net=gross-tax;
  document.getElementById('wh_tax').value=tax;
  document.getElementById('wh_net').value=net;
  // Preview
  var p1=document.getElementById('wh_p1');if(p1)p1.textContent=fm(net);
  var p1b=document.getElementById('wh_p1b');if(p1b)p1b.textContent=fm(net);
  var p2=document.getElementById('wh_p2');if(p2)p2.textContent=fm(tax);
  var p2b=document.getElementById('wh_p2b');if(p2b)p2b.textContent=fm(tax);
}

function doAddWithholding(type){
  var dt=document.getElementById('wh_dt').value;
  var desc=document.getElementById('wh_desc').value;
  var tax=+(document.getElementById('wh_tax').value)||0;
  var net=+(document.getElementById('wh_net').value)||0;
  if(!dt||!tax||!net){alert('금액을 입력하세요');return;}
  
  var crAcct=type==='interest'?'401':'402';
  var mo=String(parseInt(dt.split('-')[1]||'1'));
  var dtStr=mo+'/'+String(parseInt(dt.split('-')[2]||'1'));
  
  // Create 2 journal entries
  var id1=nid(), id2=nid()+1;
  var no1=genSlipNo(dt,'110',crAcct);
  var no2=genSlipNo(dt,'155',crAcct);
  
  D.journals.push({id:id1,dt:dtStr,no:no1,desc:desc+' (세후수령)',dr:'110',cr:crAcct,amt:net,edt:dt});
  D.journals.push({id:id2,dt:dtStr,no:no2,desc:desc+' (원천징수세)',dr:'155',cr:crAcct,amt:tax,edt:dt});
  
  saveD();
  closeModal();
  toast('원천징수 전표 2건 생성 완료');
  go('fs');
  // Switch to withholding tab
  setTimeout(function(){
    var tabs=document.querySelectorAll('.tab');
    tabs.forEach(function(t){t.classList.remove('on');if(t.dataset.tab==='withholding')t.classList.add('on');});
    var tc=document.getElementById('TC');
    if(tc) tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">💰 원천징수세 관리 (155)</div>'+rWithholding()+'</div>';
  },200);
}

// ===== 시산표 (일계표/월계표/합계잔액시산표) =====
function rTrialBalance(mode,dateVal){
  mode=mode||'monthly';
  // Default date
  if(!dateVal){
    var now=new Date();
    if(mode==='daily') dateVal=now.toISOString().slice(0,10);
    else if(mode==='monthly') dateVal=now.toISOString().slice(0,7);
    else dateVal='FY1'; // 연도=회기
  }
  
  // Parse journals by date (jFullDate handles fiscal year correctly)
  
  // Filter: before period (for carry-forward) and current period
  var beforeJ=[],curJ=[];
  D.journals.forEach(function(j){
    var ed=jFullDate(j);
    if(mode==='daily'){
      if(ed<dateVal) beforeJ.push(j);
      else if(ed===dateVal) curJ.push(j);
    }else if(mode==='monthly'){
      var ym=ed.slice(0,7);
      if(ym<dateVal) beforeJ.push(j);
      else if(ym===dateVal) curJ.push(j);
    }else{
      // Annual: FY1=2025-06~2026-05
      curJ=D.journals.slice(); // 전체
    }
  });
  
  // Collect all account codes with activity
  var codes={};
  D.accts.forEach(function(a){codes[a.c]={n:a.k,g:a.g,bf_dr:0,bf_cr:0,cur_dr:0,cur_cr:0};});
  beforeJ.forEach(function(j){
    if(codes[j.dr]) codes[j.dr].bf_dr+=j.amt;
    if(codes[j.cr]) codes[j.cr].bf_cr+=j.amt;
  });
  curJ.forEach(function(j){
    if(codes[j.dr]) codes[j.dr].cur_dr+=j.amt;
    if(codes[j.cr]) codes[j.cr].cur_cr+=j.amt;
  });
  
  // Calculate balances - DR positive for assets/expenses, CR positive for liabilities/revenue/equity
  function bal(a){
    var total_dr=a.bf_dr+a.cur_dr, total_cr=a.bf_cr+a.cur_cr;
    return total_dr-total_cr;
  }
  function bfBal(a){return a.bf_dr-a.bf_cr;}
  
  // Build active accounts list
  var active=[];
  Object.keys(codes).forEach(function(c){
    var a=codes[c];
    if(a.bf_dr||a.bf_cr||a.cur_dr||a.cur_cr) active.push({c:c,n:a.n,g:a.g,bf_dr:a.bf_dr,bf_cr:a.bf_cr,cur_dr:a.cur_dr,cur_cr:a.cur_cr});
  });
  active.sort(function(a,b){return a.c.localeCompare(b.c);});
  
  // Group by category
  var groups=[
    {label:'자산',filter:'자산',color:'#2563eb'},
    {label:'부채',filter:'부채',color:'#d97706'},
    {label:'순자산',filter:'순자산',color:'#059669'},
    {label:'수익',filter:'수익',color:'#059669'},
    {label:'비용',filter:'비용',color:'#dc2626'}
  ];
  
  // Period label
  var periodLabel='';
  if(mode==='daily') periodLabel=dateVal;
  else if(mode==='monthly'){var sp=dateVal.split('-');periodLabel=sp[0]+'년 '+parseInt(sp[1])+'월';}
  else periodLabel='제1기 (2025.06~2026.05)';
  
  // Mode selector + date input
  var modeHtml='<div style="display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap">';
  modeHtml+='<button class="bt '+(mode==='daily'?'':'gh')+'" onclick="document.getElementById(\'TC\').innerHTML=rTrialBalance(\'daily\')" style="font-size:11px">일계표</button>';
  modeHtml+='<button class="bt '+(mode==='monthly'?'':'gh')+'" onclick="document.getElementById(\'TC\').innerHTML=rTrialBalance(\'monthly\')" style="font-size:11px">월계표</button>';
  modeHtml+='<button class="bt '+(mode==='annual'?'':'gh')+'" onclick="document.getElementById(\'TC\').innerHTML=rTrialBalance(\'annual\')" style="font-size:11px">연간</button>';
  if(mode==='daily'){
    modeHtml+='<input type="date" value="'+dateVal+'" onchange="document.getElementById(\'TC\').innerHTML=rTrialBalance(\'daily\',this.value)" style="padding:4px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">';
  }else if(mode==='monthly'){
    modeHtml+='<input type="month" value="'+dateVal+'" onchange="document.getElementById(\'TC\').innerHTML=rTrialBalance(\'monthly\',this.value)" style="padding:4px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">';
  }
  modeHtml+='<span style="font-size:12px;color:#1e3a5f;font-weight:600;margin-left:8px">'+periodLabel+'</span>';
  modeHtml+='</div>';
  
  // Title
  var titleMap={daily:'일 계 표',monthly:'월 계 표 (합계잔액시산표)',annual:'합계잔액시산표 (연간)'};
  
  // Table
  var tHtml='<div style="overflow-x:auto"><table style="font-size:11px"><thead><tr>';
  tHtml+='<th style="min-width:60px">코드</th><th style="min-width:100px">계정과목</th>';
  if(mode!=='annual') tHtml+='<th class="r" style="min-width:90px">전기이월</th>';
  tHtml+='<th class="r" style="min-width:90px">차변 합계</th><th class="r" style="min-width:90px">대변 합계</th>';
  tHtml+='<th class="r" style="min-width:90px">잔액</th></tr></thead><tbody>';
  
  var totBf=0,totDr=0,totCr=0,totBal=0;
  var totBfCr=0; // for double-entry display
  
  groups.forEach(function(grp){
    var items=active.filter(function(a){return a.g===grp.filter;});
    if(items.length===0) return;
    tHtml+='<tr style="background:#f1f3f6"><td colspan="'+(mode!=='annual'?6:5)+'" style="font-weight:700;color:'+grp.color+';padding:6px">'+grp.label+'</td></tr>';
    items.forEach(function(a){
      var bf=bfBal(a);
      var endBal=bal(a);
      // Display: assets/expenses show DR balance positive; liabilities/revenue/equity show CR balance positive
      var isDebitNormal=(a.g==='자산'||a.g==='비용');
      var dispBf=isDebitNormal?bf:-bf;
      var dispBal=isDebitNormal?endBal:-endBal;
      
      tHtml+='<tr><td style="color:#2563eb">'+a.c+'</td><td>'+a.n+'</td>';
      if(mode!=='annual') tHtml+='<td class="r m">'+(dispBf?fm(dispBf):'')+'</td>';
      tHtml+='<td class="r m">'+(a.cur_dr?fm(a.cur_dr):'')+'</td>';
      tHtml+='<td class="r m">'+(a.cur_cr?fm(a.cur_cr):'')+'</td>';
      var balColor=dispBal<0?'color:#dc2626':'';
      tHtml+='<td class="r m b" style="'+balColor+'">'+fm(dispBal)+'</td></tr>';
      
      totDr+=a.cur_dr;totCr+=a.cur_cr;
      if(isDebitNormal){totBf+=bf;totBal+=endBal;}
      else{totBfCr+=(-bf);totBal+=endBal;}
    });
  });
  
  // Totals row
  tHtml+='<tr style="background:#1e293b;color:#fff;font-weight:700"><td colspan="2">합계</td>';
  if(mode!=='annual') tHtml+='<td class="r m">—</td>';
  tHtml+='<td class="r m">'+fm(totDr)+'</td><td class="r m">'+fm(totCr)+'</td>';
  var diffCheck=totDr-totCr;
  tHtml+='<td class="r m" style="color:'+(Math.abs(diffCheck)<2?'#6ee7b7':'#fca5a5')+'">차대차이: '+fm(diffCheck)+'</td></tr>';
  
  tHtml+='</tbody></table></div>';
  
  // Summary
  var sumHtml='<div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#64748b">';
  sumHtml+='<span>전표 수: <b>'+curJ.length+'건</b></span>';
  sumHtml+='<span>차변 합계: <b style="color:#2563eb">'+fm(totDr)+'</b></span>';
  sumHtml+='<span>대변 합계: <b style="color:#2563eb">'+fm(totCr)+'</b></span>';
  if(Math.abs(diffCheck)<2) sumHtml+='<span style="color:#059669;font-weight:600">✓ 차대일치</span>';
  else sumHtml+='<span style="color:#dc2626;font-weight:600">✗ 차대불일치 '+fm(diffCheck)+'</span>';
  sumHtml+='</div>';
  
  return '<div class="pn" style="padding:14px"><div style="text-align:center;margin-bottom:12px"><div style="font-size:16px;font-weight:700">'+titleMap[mode]+'</div><div style="font-size:12px;color:#64748b">태성주식회사 (단위:엔)</div></div>'+modeHtml+tHtml+sumHtml+'</div>';
}

// ===== 자산관리: 고정자산대장 / 리스·렌탈 / 계약서 관리 =====

// --- 감가상각 계산 ---
function calcDepreciation(asset){
  // Returns: {monthly, annual, accumulated, bookValue, depRate}
  if(!asset||!asset.acquiredDate||!asset.amount||!asset.usefulLife) return {monthly:0,annual:0,accumulated:0,bookValue:asset?asset.amount:0,depRate:0};
  var amt=asset.amount;
  var life=asset.usefulLife;
  var salvage=asset.salvageValue||1; // 잔존가액 (일본: 비망가액 1엔)
  var depBase=amt-salvage;
  var method=asset.depMethod||'SL'; // SL=정액법, DB=정률법
  var acqDate=new Date(asset.acquiredDate);
  var now=new Date();
  // Months elapsed since acquisition
  var moElapsed=(now.getFullYear()-acqDate.getFullYear())*12+(now.getMonth()-acqDate.getMonth());
  if(moElapsed<0) moElapsed=0;
  var totalMo=life*12;
  if(method==='SL'){
    // 정액법 (Straight-Line)
    var annual=Math.round(depBase/life);
    var monthly=Math.round(annual/12);
    var accumulated=Math.min(Math.round(monthly*moElapsed),depBase);
    var bookValue=amt-accumulated;
    if(bookValue<salvage) {accumulated=depBase;bookValue=salvage;}
    return {monthly:monthly,annual:annual,accumulated:accumulated,bookValue:bookValue,depRate:Math.round(10000/life)/100};
  } else {
    // 정률법 (Declining Balance) — 200% declining balance (일본 기준)
    var rate=Math.round((2/life)*10000)/10000;
    var accumulated=0;
    var bv=amt;
    // Calculate year by year
    var years=Math.floor(moElapsed/12);
    var remMo=moElapsed%12;
    for(var y=0;y<years;y++){
      var depY=Math.round(bv*rate);
      if(bv-depY<salvage) depY=bv-salvage;
      accumulated+=depY;
      bv=amt-accumulated;
      if(bv<=salvage) break;
    }
    // Partial year
    if(remMo>0 && bv>salvage){
      var depPartial=Math.round(bv*rate*remMo/12);
      if(bv-depPartial<salvage) depPartial=bv-salvage;
      accumulated+=depPartial;
      bv=amt-accumulated;
    }
    return {monthly:Math.round(bv*rate/12),annual:Math.round(bv*rate),accumulated:accumulated,bookValue:bv,depRate:Math.round(rate*10000)/100};
  }
}

// --- 고정자산 CRUD ---
function addFixedAsset(){
  var nm=document.getElementById('fa_name').value.trim();
  var nmJa=document.getElementById('fa_nameJa').value.trim();
  var acct=document.getElementById('fa_acct').value;
  var acqDate=document.getElementById('fa_acqDate').value;
  var amt=parseInt(document.getElementById('fa_amount').value)||0;
  var life=parseInt(document.getElementById('fa_life').value)||0;
  var method=document.getElementById('fa_method').value;
  var salvage=parseInt(document.getElementById('fa_salvage').value)||1;
  var memo=document.getElementById('fa_memo').value.trim();
  if(!nm||!acqDate||!amt||!life){toast('필수 항목을 입력하세요','warn');return;}
  D.fixedAssets.push({id:nid(),name:nm,nameJa:nmJa,acctCode:acct,acquiredDate:acqDate,amount:amt,usefulLife:life,depMethod:method,salvageValue:salvage,memo:memo,disposed:false,disposedDate:null});
  saveD();toast('고정자산 등록 완료');go('asset');
}

function editFixedAsset(id){
  var a=D.fixedAssets.find(function(x){return x.id===id;});
  if(!a) return;
  var acctOpts=ACCT_INIT.filter(function(ac){return ac.c>='160'&&ac.c<='185';}).map(function(ac){return '<option value="'+ac.c+'" '+(a.acctCode===ac.c?'selected':'')+'>'+ac.c+' '+ac.k+'</option>';}).join('');
  document.getElementById('modal').className='mo';
  document.getElementById('modal').innerHTML='<div class="mc"><h3>고정자산 수정</h3><div class="fg">'+
    '<div><label>자산명</label><input id="efa_name" value="'+a.name+'"></div>'+
    '<div><label>자산명(日)</label><input id="efa_nameJa" value="'+(a.nameJa||'')+'"></div>'+
    '<div><label>계정과목</label><select id="efa_acct">'+acctOpts+'</select></div>'+
    '<div><label>취득일</label><input type="date" id="efa_acqDate" value="'+a.acquiredDate+'"></div>'+
    '<div><label>취득가액 (¥)</label><input type="number" id="efa_amount" value="'+a.amount+'"></div>'+
    '<div><label>내용연수 (년)</label><input type="number" id="efa_life" value="'+a.usefulLife+'"></div>'+
    '<div><label>상각방법</label><select id="efa_method"><option value="SL" '+(a.depMethod==='SL'?'selected':'')+'>정액법</option><option value="DB" '+(a.depMethod==='DB'?'selected':'')+'>정률법</option></select></div>'+
    '<div><label>잔존가액 (¥)</label><input type="number" id="efa_salvage" value="'+(a.salvageValue||1)+'"></div>'+
    '<div class="full"><label>비고</label><input id="efa_memo" value="'+(a.memo||'')+'"></div>'+
    '</div><div style="margin-top:14px;display:flex;gap:8px">'+
    '<button class="bt" onclick="doEditFA('+id+')">저장</button>'+
    '<button class="bt gh" onclick="document.getElementById(\'modal\').className=\'hidden\'">취소</button>'+
    (a.disposed?'<button class="bt gn" onclick="restoreFA('+id+')">복구</button>':'<button class="bt rd" onclick="disposeFA('+id+')">처분</button>')+
    '</div></div>';
}

function doEditFA(id){
  var a=D.fixedAssets.find(function(x){return x.id===id;});
  if(!a) return;
  a.name=document.getElementById('efa_name').value.trim();
  a.nameJa=document.getElementById('efa_nameJa').value.trim();
  a.acctCode=document.getElementById('efa_acct').value;
  a.acquiredDate=document.getElementById('efa_acqDate').value;
  a.amount=parseInt(document.getElementById('efa_amount').value)||0;
  a.usefulLife=parseInt(document.getElementById('efa_life').value)||0;
  a.depMethod=document.getElementById('efa_method').value;
  a.salvageValue=parseInt(document.getElementById('efa_salvage').value)||1;
  a.memo=document.getElementById('efa_memo').value.trim();
  saveD();toast('수정 완료');document.getElementById('modal').className='hidden';go('asset');
}

function disposeFA(id){
  if(!confirm('이 자산을 처분 처리하시겠습니까?')) return;
  var a=D.fixedAssets.find(function(x){return x.id===id;});
  if(!a) return;
  a.disposed=true;a.disposedDate=new Date().toISOString().slice(0,10);
  saveD();toast('자산 처분 처리 완료');document.getElementById('modal').className='hidden';go('asset');
}

function restoreFA(id){
  var a=D.fixedAssets.find(function(x){return x.id===id;});
  if(!a) return;
  a.disposed=false;a.disposedDate=null;
  saveD();toast('자산 복구 완료');document.getElementById('modal').className='hidden';go('asset');
}

function delFixedAsset(id){
  if(!confirm('정말 삭제하시겠습니까? (복구 불가)')) return;
  D.fixedAssets=D.fixedAssets.filter(function(x){return x.id!==id;});
  saveD();toast('삭제 완료');go('asset');
}

// --- 리스/렌탈 CRUD ---
function addLease(){
  var nm=document.getElementById('ls_name').value.trim();
  var nmJa=document.getElementById('ls_nameJa').value.trim();
  var tp=document.getElementById('ls_type').value;
  var sd=document.getElementById('ls_start').value;
  var ed=document.getElementById('ls_end').value;
  var mAmt=parseInt(document.getElementById('ls_monthly').value)||0;
  var vendor=document.getElementById('ls_vendor').value.trim();
  var acct=document.getElementById('ls_acct').value;
  var memo=document.getElementById('ls_memo').value.trim();
  if(!nm||!sd||!mAmt){toast('필수 항목을 입력하세요','warn');return;}
  D.leases.push({id:nid(),name:nm,nameJa:nmJa,type:tp,startDate:sd,endDate:ed,monthlyAmt:mAmt,vendor:vendor,acctCode:acct,memo:memo,active:true});
  saveD();toast('리스/렌탈 등록 완료');go('asset');
}

function editLease(id){
  var l=D.leases.find(function(x){return x.id===id;});
  if(!l) return;
  var leaseAccts=[{c:'526',k:'임차료'},{c:'548',k:'리스료'},{c:'527',k:'보험료'},{c:'531',k:'차량비'}];
  var acctOpts=leaseAccts.map(function(ac){return '<option value="'+ac.c+'" '+(l.acctCode===ac.c?'selected':'')+'>'+ac.c+' '+ac.k+'</option>';}).join('');
  document.getElementById('modal').className='mo';
  document.getElementById('modal').innerHTML='<div class="mc"><h3>리스/렌탈 수정</h3><div class="fg">'+
    '<div><label>명칭</label><input id="els_name" value="'+l.name+'"></div>'+
    '<div><label>명칭(日)</label><input id="els_nameJa" value="'+(l.nameJa||'')+'"></div>'+
    '<div><label>구분</label><select id="els_type"><option value="lease" '+(l.type==='lease'?'selected':'')+'>리스</option><option value="rental" '+(l.type==='rental'?'selected':'')+'>렌탈</option></select></div>'+
    '<div><label>비용계정</label><select id="els_acct">'+acctOpts+'</select></div>'+
    '<div><label>시작일</label><input type="date" id="els_start" value="'+l.startDate+'"></div>'+
    '<div><label>종료일</label><input type="date" id="els_end" value="'+(l.endDate||'')+'"></div>'+
    '<div><label>월 금액 (¥)</label><input type="number" id="els_monthly" value="'+l.monthlyAmt+'"></div>'+
    '<div><label>거래처</label><input id="els_vendor" value="'+(l.vendor||'')+'"></div>'+
    '<div class="full"><label>비고</label><input id="els_memo" value="'+(l.memo||'')+'"></div>'+
    '</div><div style="margin-top:14px;display:flex;gap:8px">'+
    '<button class="bt" onclick="doEditLease('+id+')">저장</button>'+
    '<button class="bt gh" onclick="document.getElementById(\'modal\').className=\'hidden\'">취소</button>'+
    '<button class="bt '+(l.active?'rd':'gn')+'" onclick="toggleLease('+id+')">'+(l.active?'비활성화':'활성화')+'</button>'+
    '</div></div>';
}

function doEditLease(id){
  var l=D.leases.find(function(x){return x.id===id;});
  if(!l) return;
  l.name=document.getElementById('els_name').value.trim();
  l.nameJa=document.getElementById('els_nameJa').value.trim();
  l.type=document.getElementById('els_type').value;
  l.acctCode=document.getElementById('els_acct').value;
  l.startDate=document.getElementById('els_start').value;
  l.endDate=document.getElementById('els_end').value;
  l.monthlyAmt=parseInt(document.getElementById('els_monthly').value)||0;
  l.vendor=document.getElementById('els_vendor').value.trim();
  l.memo=document.getElementById('els_memo').value.trim();
  saveD();toast('수정 완료');document.getElementById('modal').className='hidden';go('asset');
}

function toggleLease(id){
  var l=D.leases.find(function(x){return x.id===id;});
  if(!l) return;
  l.active=!l.active;
  saveD();toast(l.active?'활성화 완료':'비활성화 완료');document.getElementById('modal').className='hidden';go('asset');
}

function delLease(id){
  if(!confirm('정말 삭제하시겠습니까?')) return;
  D.leases=D.leases.filter(function(x){return x.id!==id;});
  saveD();toast('삭제 완료');go('asset');
}

// --- 계약서 관리 CRUD ---
function addContract(){
  var nm=document.getElementById('ct_name').value.trim();
  var tp=document.getElementById('ct_type').value;
  var cp=document.getElementById('ct_counterparty').value.trim();
  var sd=document.getElementById('ct_start').value;
  var ed=document.getElementById('ct_end').value;
  var amt=parseInt(document.getElementById('ct_amount').value)||0;
  var alert=parseInt(document.getElementById('ct_alert').value)||30;
  var memo=document.getElementById('ct_memo').value.trim();
  var autoR=document.getElementById('ct_autoRenew').checked;
  if(!nm){toast('계약명을 입력하세요','warn');return;}
  D.contracts.push({id:nid(),name:nm,type:tp,counterparty:cp,startDate:sd,endDate:ed,amount:amt,alertDays:alert,memo:memo,autoRenew:autoR,active:true});
  saveD();toast('계약 등록 완료');go('asset');
}

function editContract(id){
  var c=D.contracts.find(function(x){return x.id===id;});
  if(!c) return;
  document.getElementById('modal').className='mo';
  document.getElementById('modal').innerHTML='<div class="mc"><h3>계약 수정</h3><div class="fg">'+
    '<div><label>계약명</label><input id="ect_name" value="'+c.name+'"></div>'+
    '<div><label>구분</label><select id="ect_type">'+
    '<option value="securities" '+(c.type==='securities'?'selected':'')+'>증권</option>'+
    '<option value="banking" '+(c.type==='banking'?'selected':'')+'>은행</option>'+
    '<option value="lease" '+(c.type==='lease'?'selected':'')+'>리스</option>'+
    '<option value="insurance" '+(c.type==='insurance'?'selected':'')+'>보험</option>'+
    '<option value="service" '+(c.type==='service'?'selected':'')+'>서비스</option>'+
    '<option value="other" '+(c.type==='other'?'selected':'')+'>기타</option>'+
    '</select></div>'+
    '<div><label>상대방</label><input id="ect_counterparty" value="'+(c.counterparty||'')+'"></div>'+
    '<div><label>알림 (일전)</label><input type="number" id="ect_alert" value="'+(c.alertDays||30)+'"></div>'+
    '<div><label>시작일</label><input type="date" id="ect_start" value="'+(c.startDate||'')+'"></div>'+
    '<div><label>종료일</label><input type="date" id="ect_end" value="'+(c.endDate||'')+'"></div>'+
    '<div><label>금액 (¥)</label><input type="number" id="ect_amount" value="'+(c.amount||0)+'"></div>'+
    '<div><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ect_autoRenew" '+(c.autoRenew?'checked':'')+' style="width:auto"> 자동갱신</label></div>'+
    '<div class="full"><label>비고</label><input id="ect_memo" value="'+(c.memo||'')+'"></div>'+
    '</div><div style="margin-top:14px;display:flex;gap:8px">'+
    '<button class="bt" onclick="doEditContract('+id+')">저장</button>'+
    '<button class="bt gh" onclick="document.getElementById(\'modal\').className=\'hidden\'">취소</button>'+
    '</div></div>';
}

function doEditContract(id){
  var c=D.contracts.find(function(x){return x.id===id;});
  if(!c) return;
  c.name=document.getElementById('ect_name').value.trim();
  c.type=document.getElementById('ect_type').value;
  c.counterparty=document.getElementById('ect_counterparty').value.trim();
  c.alertDays=parseInt(document.getElementById('ect_alert').value)||30;
  c.startDate=document.getElementById('ect_start').value;
  c.endDate=document.getElementById('ect_end').value;
  c.amount=parseInt(document.getElementById('ect_amount').value)||0;
  c.autoRenew=document.getElementById('ect_autoRenew').checked;
  c.memo=document.getElementById('ect_memo').value.trim();
  saveD();toast('수정 완료');document.getElementById('modal').className='hidden';go('asset');
}

function delContract(id){
  if(!confirm('정말 삭제하시겠습니까?')) return;
  D.contracts=D.contracts.filter(function(x){return x.id!==id;});
  saveD();toast('삭제 완료');go('asset');
}

// --- 자산관리 탭별 렌더링 ---

// --- 감가상각 전표 자동생성 ---
function genDepJournals(ym){
  if(!ym){toast('연월을 선택하세요','warn');return;}
  var parts=ym.split('-');
  var yr=parseInt(parts[0]),mo=parseInt(parts[1]);
  var moStr=mo+'/1'; // 전표 날짜 형식
  var dtFull=ym; // edt(편집날짜) 형식
  var activeFA=(D.fixedAssets||[]).filter(function(a){return !a.disposed;});
  if(activeFA.length===0){toast('감가상각 대상 자산이 없습니다','warn');return;}
  // 중복 체크: 해당 월에 이미 감가상각 전표가 있는지
  var dupTag='[감가상각_'+ym+']';
  var existing=D.journals.filter(function(j){return j.desc&&j.desc.indexOf(dupTag)>=0;});
  if(existing.length>0){
    if(!confirm('⚠️ '+ym+' 감가상각 전표가 이미 '+existing.length+'건 있습니다.\n중복 생성하시겠습니까?')) return;
  }
  var count=0,totalAmt=0;
  var _batchId=nid();
  activeFA.forEach(function(a){
    var dep=calcDepreciation(a);
    if(dep.monthly<=0) return; // 상각 완료
    // 취득일 이전 월은 스킵
    var acqParts=a.acquiredDate.split('-');
    var acqYM=parseInt(acqParts[0])*100+parseInt(acqParts[1]);
    var targetYM=yr*100+mo;
    if(targetYM<acqYM) return;
    var slipNo=genSlipNo(dtFull,'529',a.acctCode);
    var acctName=(D.accts.find(function(ac){return ac.c===a.acctCode;})||{}).k||a.acctCode;
    D.journals.push({
      id:nid(),dt:moStr,no:slipNo,
      desc:a.name+' 감가상각 ('+acctName+') '+dupTag,
      dr:'529',cr:a.acctCode,amt:dep.monthly,
      edt:dtFull+'-28',pdt:dtFull+'-28',cur:'JPY',exp:'',vendor:'',taxCls:''
    });
    count++;totalAmt+=dep.monthly;
  });
  if(count>0){
    saveD();
    toast(ym+' 감가상각 전표 '+count+'건 생성 (합계 '+totalAmt.toLocaleString()+'엔)');
    go('asset');
  } else {
    toast('생성할 감가상각 전표가 없습니다 (모두 상각 완료 또는 미취득)','warn');
  }
}

// --- 리스/렌탈 전표 자동생성 ---
function genLeaseJournals(ym){
  if(!ym){toast('연월을 선택하세요','warn');return;}
  var parts=ym.split('-');
  var yr=parseInt(parts[0]),mo=parseInt(parts[1]);
  var moStr=mo+'/1';
  var dtFull=ym;
  var activeLS=(D.leases||[]).filter(function(l){return l.active;});
  if(activeLS.length===0){toast('활성 리스/렌탈이 없습니다','warn');return;}
  // 중복 체크
  var dupTag='[리스_'+ym+']';
  var existing=D.journals.filter(function(j){return j.desc&&j.desc.indexOf(dupTag)>=0;});
  if(existing.length>0){
    if(!confirm('⚠️ '+ym+' 리스/렌탈 전표가 이미 '+existing.length+'건 있습니다.\n중복 생성하시겠습니까?')) return;
  }
  var count=0,totalAmt=0;
  var today=new Date(yr,mo-1,28);
  activeLS.forEach(function(l){
    // 계약기간 체크
    if(l.startDate){
      var sd=new Date(l.startDate);
      if(today<sd) return; // 아직 시작 안됨
    }
    if(l.endDate){
      var ed=new Date(l.endDate);
      if(today>ed) return; // 이미 종료
    }
    var slipNo=genSlipNo(dtFull,l.acctCode,'110');
    var typeLabel=l.type==='lease'?'리스료':'렌탈료';
    D.journals.push({
      id:nid(),dt:moStr,no:slipNo,
      desc:l.name+' '+typeLabel+' '+dupTag,
      dr:l.acctCode,cr:'110',amt:l.monthlyAmt,
      edt:dtFull+'-28',pdt:dtFull+'-28',cur:'JPY',exp:'',vendor:l.vendor||'',taxCls:''
    });
    count++;totalAmt+=l.monthlyAmt;
  });
  if(count>0){
    saveD();
    toast(ym+' 리스/렌탈 전표 '+count+'건 생성 (합계 '+totalAmt.toLocaleString()+'엔)');
    go('asset');
  } else {
    toast('생성할 리스/렌탈 전표가 없습니다 (계약기간 외)','warn');
  }
}

function rFATab(){
  // 고정자산대장
  var acctOpts=ACCT_INIT.filter(function(ac){return ac.c>='160'&&ac.c<='185';}).map(function(ac){return '<option value="'+ac.c+'">'+ac.c+' '+ac.k+'</option>';}).join('');
  var html='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">🏗️ 고정자산 등록</div>';
  html+='<div class="fg">';
  html+='<div><label>자산명 *</label><input id="fa_name" placeholder="예: 업무용 노트북"></div>';
  html+='<div><label>자산명(日)</label><input id="fa_nameJa" placeholder="業務用ノートPC"></div>';
  html+='<div><label>계정과목</label><select id="fa_acct">'+acctOpts+'</select></div>';
  html+='<div><label>취득일 *</label><input type="date" id="fa_acqDate"></div>';
  html+='<div><label>취득가액 (¥) *</label><input type="number" id="fa_amount" placeholder="200000"></div>';
  html+='<div><label>내용연수 (년) *</label><input type="number" id="fa_life" placeholder="4" value="4"></div>';
  html+='<div><label>상각방법</label><select id="fa_method"><option value="SL">정액법 (定額法)</option><option value="DB">정률법 (定率法)</option></select></div>';
  html+='<div><label>잔존가액 (¥)</label><input type="number" id="fa_salvage" value="1" placeholder="1 (비망가액)"></div>';
  html+='<div class="full"><label>비고</label><input id="fa_memo" placeholder="메모"></div>';
  html+='</div><div style="margin-top:10px"><button class="bt" onclick="addFixedAsset()">등록</button></div></div>';

  // 목록
  var items=D.fixedAssets||[];
  var activeItems=items.filter(function(a){return !a.disposed;});
  var disposedItems=items.filter(function(a){return a.disposed;});
  var totalBook=0,totalDep=0,totalAcq=0;

  if(activeItems.length>0){
    html+='<div class="pn" style="margin-top:14px"><div class="ph"><span>보유 자산 ('+activeItems.length+'건)</span></div>';
    html+='<div style="overflow-x:auto"><table><thead><tr><th>자산명</th><th>계정</th><th>취득일</th><th class="r">취득가액</th><th>연수</th><th>방법</th><th class="r">상각누계</th><th class="r">장부가액</th><th class="r">월상각액</th><th></th></tr></thead><tbody>';
    activeItems.forEach(function(a){
      var dep=calcDepreciation(a);
      totalAcq+=a.amount;totalDep+=dep.accumulated;totalBook+=dep.bookValue;
      var acctName=(D.accts.find(function(ac){return ac.c===a.acctCode;})||{}).k||a.acctCode;
      var methodLabel=a.depMethod==='DB'?'정률':'정액';
      // Progress bar
      var pct=a.amount>0?Math.round(dep.accumulated/a.amount*100):0;
      html+='<tr><td><a href="javascript:void(0)" onclick="editFixedAsset('+a.id+')" style="color:#2563eb;text-decoration:underline">'+a.name+'</a>'+(a.nameJa?'<br><span style="font-size:9px;color:#64748b">'+a.nameJa+'</span>':'')+'</td>';
      html+='<td>'+acctName+'</td><td>'+a.acquiredDate+'</td><td class="r m">'+fm(a.amount)+'</td>';
      html+='<td>'+a.usefulLife+'년</td><td>'+methodLabel+'</td>';
      html+='<td class="r m rd">'+fm(dep.accumulated)+'</td><td class="r m b">'+fm(dep.bookValue)+'</td>';
      html+='<td class="r m">'+fm(dep.monthly)+'</td>';
      html+='<td><button class="del" onclick="delFixedAsset('+a.id+')">삭제</button></td></tr>';
      html+='<tr><td colspan="9" style="padding:2px 6px 6px"><div style="background:#e2e6ed;border-radius:3px;height:4px;overflow:hidden"><div style="background:#2563eb;height:100%;width:'+pct+'%"></div></div><span style="font-size:9px;color:#64748b">상각률 '+pct+'%</span></td><td></td></tr>';
    });
    html+='</tbody><tfoot><tr class="t"><td colspan="3">합계</td><td class="r m">'+fm(totalAcq)+'</td><td colspan="2"></td><td class="r m rd">'+fm(totalDep)+'</td><td class="r m">'+fm(totalBook)+'</td><td></td><td></td></tr></tfoot></table></div></div>';
  }

  if(disposedItems.length>0){
    html+='<div class="pn" style="margin-top:14px"><div class="ph"><span>처분 자산 ('+disposedItems.length+'건)</span></div>';
    html+='<div style="overflow-x:auto"><table><thead><tr><th>자산명</th><th>취득일</th><th class="r">취득가액</th><th>처분일</th><th></th></tr></thead><tbody>';
    disposedItems.forEach(function(a){
      html+='<tr style="opacity:0.6"><td><a href="javascript:void(0)" onclick="editFixedAsset('+a.id+')" style="color:#64748b">'+a.name+'</a></td>';
      html+='<td>'+a.acquiredDate+'</td><td class="r m">'+fm(a.amount)+'</td><td>'+(a.disposedDate||'-')+'</td>';
      html+='<td><button class="del" onclick="delFixedAsset('+a.id+')">삭제</button></td></tr>';
    });
    html+='</tbody></table></div></div>';
  }

  if(items.length===0){
    html+='<div class="ib" style="margin-top:14px">등록된 고정자산이 없습니다. 차량, PC, 사무기기 등을 등록하세요.</div>';
  }

  // 감가상각 참고표
  html+='<div class="ib" style="margin-top:14px;font-size:10px">💡 <b>일본 감가상각 기준:</b> 잔존가액 = 비망가액 1엔 (税法基準). 정액법: 매년 균등 상각. 정률법: 200%정률법 (取得日 기준). 내용연수 예시: PC 4년, 차량 6년, 건물(목조) 22년, 건물(RC) 47년, 비품 5~15년</div>';

  // 전표 자동생성 버튼
  if(activeItems.length>0){
    var nowYM=new Date().toISOString().slice(0,7);
    html+='<div class="pn" style="margin-top:14px;padding:14px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 감가상각 전표 자동생성</div>';
    html+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html+='<input type="month" id="fa_genMonth" value="'+nowYM+'" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">';
    html+='<button class="bt" onclick="genDepJournals(document.getElementById(\'fa_genMonth\').value)">DR 529 감가상각비 전표 생성</button>';
    html+='<span style="font-size:10px;color:#64748b">선택한 월의 감가상각비 전표를 일괄 생성합니다 (DR 529 / CR 자산계정)</span>';
    html+='</div>';
    // 생성 이력 표시
    var depJournals=D.journals.filter(function(j){return j.desc&&j.desc.indexOf('[감가상각_')>=0;});
    if(depJournals.length>0){
      html+='<div style="margin-top:10px;font-size:10px;color:#64748b"><b>생성 이력:</b> ';
      var months={};
      depJournals.forEach(function(j){var m=j.desc.match(/\[감가상각_(\d{4}-\d{2})\]/);if(m)months[m[1]]=(months[m[1]]||0)+1;});
      Object.keys(months).sort().forEach(function(m){html+=m+'('+months[m]+'건) ';});
      html+='</div>';
    }
    html+='</div>';
  }

  return html;
}

function rLeaseTab(){
  var leaseAccts=[{c:'526',k:'임차료'},{c:'548',k:'리스료'},{c:'527',k:'보험료'},{c:'531',k:'차량비'}];
  var acctOpts=leaseAccts.map(function(ac){return '<option value="'+ac.c+'">'+ac.c+' '+ac.k+'</option>';}).join('');
  var html='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">📋 리스/렌탈 등록</div>';
  html+='<div class="fg">';
  html+='<div><label>명칭 *</label><input id="ls_name" placeholder="예: 사무실 임차"></div>';
  html+='<div><label>명칭(日)</label><input id="ls_nameJa" placeholder="事務所賃貸"></div>';
  html+='<div><label>구분</label><select id="ls_type"><option value="lease">리스</option><option value="rental">렌탈</option></select></div>';
  html+='<div><label>비용계정</label><select id="ls_acct">'+acctOpts+'</select></div>';
  html+='<div><label>시작일 *</label><input type="date" id="ls_start"></div>';
  html+='<div><label>종료일</label><input type="date" id="ls_end"></div>';
  html+='<div><label>월 금액 (¥) *</label><input type="number" id="ls_monthly" placeholder="50000"></div>';
  html+='<div><label>거래처</label><input id="ls_vendor" placeholder="임대인/리스사"></div>';
  html+='<div class="full"><label>비고</label><input id="ls_memo" placeholder="메모"></div>';
  html+='</div><div style="margin-top:10px"><button class="bt" onclick="addLease()">등록</button></div></div>';

  var items=D.leases||[];
  var activeItems=items.filter(function(l){return l.active;});
  var inactiveItems=items.filter(function(l){return !l.active;});
  var today=new Date();
  var totalMonthly=0;

  if(activeItems.length>0){
    html+='<div class="pn" style="margin-top:14px"><div class="ph"><span>활성 계약 ('+activeItems.length+'건)</span></div>';
    html+='<div style="overflow-x:auto"><table><thead><tr><th>명칭</th><th>구분</th><th>계정</th><th>시작일</th><th>종료일</th><th class="r">월 금액</th><th>거래처</th><th>잔여기간</th><th></th></tr></thead><tbody>';
    activeItems.forEach(function(l){
      totalMonthly+=l.monthlyAmt;
      var acctName=(D.accts.find(function(ac){return ac.c===l.acctCode;})||{}).k||l.acctCode;
      var typeLabel=l.type==='lease'?'리스':'렌탈';
      // Remaining days
      var remaining='-';
      if(l.endDate){
        var endD=new Date(l.endDate);
        var diffD=Math.ceil((endD-today)/(1000*60*60*24));
        if(diffD<0) remaining='<span style="color:#dc2626;font-weight:600">만료</span>';
        else if(diffD<=30) remaining='<span style="color:#d97706;font-weight:600">'+diffD+'일</span>';
        else remaining=diffD+'일';
      }
      html+='<tr><td><a href="javascript:void(0)" onclick="editLease('+l.id+')" style="color:#2563eb;text-decoration:underline">'+l.name+'</a>'+(l.nameJa?'<br><span style="font-size:9px;color:#64748b">'+l.nameJa+'</span>':'')+'</td>';
      html+='<td><span class="bg '+(l.type==='lease'?'p':'n')+'">'+typeLabel+'</span></td>';
      html+='<td>'+acctName+'</td><td>'+(l.startDate||'-')+'</td><td>'+(l.endDate||'없음')+'</td>';
      html+='<td class="r m b">'+fm(l.monthlyAmt)+'</td><td>'+(l.vendor||'-')+'</td><td>'+remaining+'</td>';
      html+='<td><button class="del" onclick="delLease('+l.id+')">삭제</button></td></tr>';
    });
    html+='</tbody><tfoot><tr class="t"><td colspan="5">월 합계</td><td class="r m">'+fm(totalMonthly)+'</td><td colspan="3"></td></tr>';
    html+='<tr class="t"><td colspan="5">연간 추정</td><td class="r m">'+fm(totalMonthly*12)+'</td><td colspan="3"></td></tr></tfoot></table></div></div>';
  }

  if(inactiveItems.length>0){
    html+='<div class="pn" style="margin-top:14px"><div class="ph"><span>비활성 계약 ('+inactiveItems.length+'건)</span></div>';
    html+='<div style="overflow-x:auto"><table><thead><tr><th>명칭</th><th>구분</th><th>종료일</th><th class="r">월 금액</th><th></th></tr></thead><tbody>';
    inactiveItems.forEach(function(l){
      html+='<tr style="opacity:0.6"><td><a href="javascript:void(0)" onclick="editLease('+l.id+')" style="color:#64748b">'+l.name+'</a></td>';
      html+='<td>'+(l.type==='lease'?'리스':'렌탈')+'</td><td>'+(l.endDate||'-')+'</td>';
      html+='<td class="r m">'+fm(l.monthlyAmt)+'</td>';
      html+='<td><button class="del" onclick="delLease('+l.id+')">삭제</button></td></tr>';
    });
    html+='</tbody></table></div></div>';
  }

  if(items.length===0){
    html+='<div class="ib" style="margin-top:14px">등록된 리스/렌탈이 없습니다. 사무실, 차량, 복합기 등의 리스/렌탈 계약을 등록하세요.</div>';
  }

  html+='<div class="ib" style="margin-top:14px;font-size:10px">💡 <b>리스 vs 렌탈:</b> 리스 = 장기 계약(보통 3~7년), 중도해지 불가. 렌탈 = 단기 계약, 해지 자유. 비용계정: 리스→548(リース料), 렌탈→526(地代家賃)으로 분류</div>';

  // 전표 자동생성 버튼
  if(activeItems.length>0){
    var nowYM=new Date().toISOString().slice(0,7);
    html+='<div class="pn" style="margin-top:14px;padding:14px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📋 리스/렌탈 전표 자동생성</div>';
    html+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html+='<input type="month" id="ls_genMonth" value="'+nowYM+'" style="padding:5px 8px;border:1px solid #e2e6ed;border-radius:5px;font-size:12px">';
    html+='<button class="bt gn" onclick="genLeaseJournals(document.getElementById(\'ls_genMonth\').value)">DR 리스료/임차료 전표 생성</button>';
    html+='<span style="font-size:10px;color:#64748b">선택한 월의 활성 리스/렌탈 전표를 일괄 생성합니다 (DR 비용계정 / CR 110 보통예금)</span>';
    html+='</div>';
    // 생성 이력
    var leaseJournals=D.journals.filter(function(j){return j.desc&&j.desc.indexOf('[리스_')>=0;});
    if(leaseJournals.length>0){
      html+='<div style="margin-top:10px;font-size:10px;color:#64748b"><b>생성 이력:</b> ';
      var months={};
      leaseJournals.forEach(function(j){var m=j.desc.match(/\[리스_(\d{4}-\d{2})\]/);if(m)months[m[1]]=(months[m[1]]||0)+1;});
      Object.keys(months).sort().forEach(function(m){html+=m+'('+months[m]+'건) ';});
      html+='</div>';
    }
    html+='</div>';
  }

  return html;
}

function rContractTab(){
  var typeLabels={securities:'증권',banking:'은행',lease:'리스',insurance:'보험',service:'서비스',other:'기타'};
  var typeColors={securities:'#2563eb',banking:'#059669',lease:'#d97706',insurance:'#7c3aed',service:'#0891b2',other:'#64748b'};

  var html='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:12px">📁 계약 등록</div>';
  html+='<div class="fg">';
  html+='<div><label>계약명 *</label><input id="ct_name" placeholder="예: SMBC닛코증권 특정구좌"></div>';
  html+='<div><label>구분</label><select id="ct_type"><option value="securities">증권</option><option value="banking">은행</option><option value="lease">리스</option><option value="insurance">보험</option><option value="service">서비스</option><option value="other">기타</option></select></div>';
  html+='<div><label>상대방</label><input id="ct_counterparty" placeholder="SMBC日興証券"></div>';
  html+='<div><label>만기 알림 (일전)</label><input type="number" id="ct_alert" value="30"></div>';
  html+='<div><label>시작일</label><input type="date" id="ct_start"></div>';
  html+='<div><label>종료일</label><input type="date" id="ct_end"></div>';
  html+='<div><label>금액 (¥)</label><input type="number" id="ct_amount" placeholder="0"></div>';
  html+='<div><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ct_autoRenew" style="width:auto"> 자동갱신</label></div>';
  html+='<div class="full"><label>비고</label><input id="ct_memo" placeholder="메모"></div>';
  html+='</div><div style="margin-top:10px"><button class="bt" onclick="addContract()">등록</button></div></div>';

  var items=(D.contracts||[]).filter(function(c){return c.active!==false;});
  var today=new Date();

  if(items.length>0){
    // Sort by end date (nearest first)
    var sorted=items.slice().sort(function(a,b){
      if(!a.endDate && !b.endDate) return 0;
      if(!a.endDate) return 1;
      if(!b.endDate) return -1;
      return new Date(a.endDate)-new Date(b.endDate);
    });

    html+='<div class="pn" style="margin-top:14px"><div class="ph"><span>계약 목록 ('+items.length+'건)</span></div>';
    html+='<div style="overflow-x:auto"><table><thead><tr><th>계약명</th><th>구분</th><th>상대방</th><th>시작일</th><th>종료일</th><th class="r">금액</th><th>갱신</th><th>상태</th><th></th></tr></thead><tbody>';
    sorted.forEach(function(c){
      var tl=typeLabels[c.type]||c.type;
      var tc=typeColors[c.type]||'#64748b';
      // Status
      var status='-';
      if(c.endDate){
        var endD=new Date(c.endDate);
        var diffD=Math.ceil((endD-today)/(1000*60*60*24));
        if(diffD<0) status='<span style="color:#dc2626;font-weight:700">만료</span>';
        else if(diffD<=(c.alertDays||30)) status='<span style="color:#d97706;font-weight:700">D-'+diffD+'</span>';
        else status='<span style="color:#059669">'+diffD+'일</span>';
      } else {
        status='<span style="color:#64748b">무기한</span>';
      }
      html+='<tr><td><a href="javascript:void(0)" onclick="editContract('+c.id+')" style="color:#2563eb;text-decoration:underline">'+c.name+'</a></td>';
      html+='<td><span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:'+tc+'22;color:'+tc+'">'+tl+'</span></td>';
      html+='<td>'+(c.counterparty||'-')+'</td><td>'+(c.startDate||'-')+'</td><td>'+(c.endDate||'없음')+'</td>';
      html+='<td class="r m">'+(c.amount?fm(c.amount):'-')+'</td>';
      html+='<td>'+(c.autoRenew?'<span style="color:#059669">자동</span>':'수동')+'</td>';
      html+='<td>'+status+'</td>';
      html+='<td><button class="del" onclick="delContract('+c.id+')">삭제</button></td></tr>';
    });
    html+='</tbody></table></div></div>';
  } else {
    html+='<div class="ib" style="margin-top:14px">등록된 계약이 없습니다. 증권계좌, 은행계좌, 보험, 리스 등의 계약을 등록하세요.</div>';
  }

  // 만기 임박 요약
  var expiring=(D.contracts||[]).filter(function(c){
    if(!c.endDate||c.active===false) return false;
    var diffD=Math.ceil((new Date(c.endDate)-today)/(1000*60*60*24));
    return diffD>=0 && diffD<=(c.alertDays||30);
  });
  if(expiring.length>0){
    html+='<div class="pn" style="margin-top:14px;border-left:4px solid #d97706"><div class="ph" style="color:#d97706">⚠️ 만기 임박 계약 ('+expiring.length+'건)</div><div style="padding:8px 12px">';
    expiring.forEach(function(c){
      var diffD=Math.ceil((new Date(c.endDate)-today)/(1000*60*60*24));
      html+='<div style="padding:4px 0;font-size:12px"><span style="color:#d97706;font-weight:600">D-'+diffD+'</span> '+c.name+' ('+c.endDate+') '+(c.autoRenew?'<span style="color:#059669;font-size:10px">자동갱신</span>':'')+'</div>';
    });
    html+='</div></div>';
  }

  html+='<div class="ib" style="margin-top:14px;font-size:10px">💡 만기 알림은 대시보드에도 표시됩니다. 알림 일수(기본 30일)를 계약별로 설정할 수 있습니다.</div>';
  return html;
}

// --- 자산관리 메인 페이지 ---
function rAsset(){
  return '<div class="pt">자산관리</div>'+
  '<div class="tabs">'+
    '<div class="tab on" data-tab="fa">🏗️ 고정자산</div>'+
    '<div class="tab" data-tab="lease">📋 리스/렌탈</div>'+
    '<div class="tab" data-tab="contract">📁 계약서</div>'+
  '</div>'+
  '<div id="TC">'+rFATab()+'</div>';
}

// ===== ROUTING =====
const pages={dash:rDash,slip:rSlip,jrn:rJrn,gl:rGL,fs:rFS,sec:rSec,bank:rBank,rpt:rRpt,oi:rOI,asset:rAsset,set:rSet};
let cur='dash';

function go(p){
  cur=p;
  document.getElementById('M').innerHTML=pages[p]();
  if(p==='rpt'){setTimeout(restoreRptEdits,100);}
  if(p==='dash'){var tc=document.getElementById('trendChart');if(tc)tc.innerHTML=renderTrendChart('month');}
  document.querySelectorAll('.ni').forEach(el=>el.classList.toggle('on',el.dataset.page===p));
  // Tab events
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));this.classList.add('on');
    const tc=document.getElementById('TC'),id=this.dataset.tab;if(!tc)return;
    if(cur==='sec'){if(id==='real')tc.innerHTML=rRealTab();else go('sec');}
    if(cur==='fs'){if(id==='bs')tc.innerHTML=rBSTab();else if(id==='tx')tc.innerHTML=rTxTab();else if(id==='expense'){tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">📊 월별 비용분석</div>'+rExpenseAnalysis()+'</div>';}else if(id==='monthly')tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">📅 월차 추이</div>'+rMonthlyTable()+'</div>';else if(id==='cashflow')tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">💰 월별 현금흐름표</div>'+rCashFlow()+'</div>';else if(id==='taxsum')tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">🧾 소비세 집계표</div>'+rTaxSummary()+'</div>';else if(id==='withholding')tc.innerHTML='<div class="pn" style="padding:14px"><div style="font-size:14px;font-weight:700;margin-bottom:10px">💰 원천징수세 관리 (155)</div>'+rWithholding()+'</div>';else if(id==='trial')tc.innerHTML=rTrialBalance();else go('fs');}
    if(cur==='asset'){if(id==='fa')tc.innerHTML=rFATab();else if(id==='lease')tc.innerHTML=rLeaseTab();else if(id==='contract')tc.innerHTML=rContractTab();}
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
  // 사업세: 누진세율 (자본금1억엔이하, 3단계)
  var jigyouzei=0;
  if(oi>0){
    if(oi<=4000000) jigyouzei=Math.round(oi*0.035);
    else if(oi<=8000000) jigyouzei=Math.round(4000000*0.035+(oi-4000000)*0.053);
    else jigyouzei=Math.round(4000000*0.035+4000000*0.053+(oi-8000000)*0.07);
  }
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
    '<div class="fr i" style="font-size:10px;color:#64748b"><span>　※자본금1억엔이하·소득800만이하 경감세율</span></div>'+
    '<div class="fr i"><span>지방법인세 (법인세×10.3%)</span><span class="m">'+fm(chihou_houjin)+'</span></div>'+
    '<div style="height:6px"></div>'+
    '<div class="fr h" style="color:#d97706"><span>② 도도부현세 (도쿄도)</span></div>'+
    '<div class="fr i"><span>법인사업세 (누진: 3.5%/5.3%/7%)</span><span class="m">'+fm(jigyouzei)+'</span></div>'+
    '<div class="fr i" style="font-size:10px;color:#64748b"><span>　※400万以下3.5% / 400~800万5.3% / 800万超7%</span></div>'+
    '<div class="fr i"><span>특별법인사업세 (사업세×37%)</span><span class="m">'+fm(tokubetsu_jigyou)+'</span></div>'+
    '<div class="fr i"><span>법인도민세 (법인세×7%)</span><span class="m">'+fm(touminzei)+'</span></div>'+
    '<div class="fr i"><span>균등할 (도쿄도 최저)</span><span class="m">'+fm(kintou)+'</span></div>'+
    '<div style="height:8px"></div>'+
    '<div class="fr b tl" style="color:#dc2626;font-size:13px"><span>법인세 등 합계</span><span class="m">'+fm(totalTax)+'</span></div>'+
    '<div class="fr" style="font-size:11px;color:#64748b"><span>실효세율</span><span class="m">'+effectiveRate+'%</span></div>'+
    '<div style="height:10px"></div>'+
    '<div class="ib" style="font-size:9px">💡 참고용 추정치입니다. 실제 세액은 세무사 확인이 필요합니다.<br>'+
    '사업세는 손금산입 가능하나 여기서는 미반영. 결손금 이월공제 미반영.</div>'+
    '<div style="margin-top:10px;padding:10px;background:#f8fafc;border:1px solid #e2e6ed;border-radius:6px;font-size:10px">'+
    '<div style="font-weight:600;margin-bottom:6px">📋 법인사업세 누진세율 (자본금1억엔이하)</div>'+
    '<table style="font-size:10px;width:100%"><thead><tr><th style="text-align:left">과세소득</th><th style="text-align:right">세율</th></tr></thead><tbody>'+
    '<tr><td>400만엔 이하</td><td style="text-align:right">3.5%</td></tr>'+
    '<tr><td>400만~800만엔</td><td style="text-align:right">5.3%</td></tr>'+
    '<tr><td>800만엔 초과</td><td style="text-align:right">7.0%</td></tr>'+
    '</tbody></table>'+
    '<div style="margin-top:6px;color:#64748b">※ 특별법인사업세: 사업세 × 37%<br>※ 방위특별법인세: 2026.04.01 이후 개시 사업연도부터 (1기 해당없음)</div>'+
    '</div>'+
    '<div style="margin-top:12px"><button class="bt" onclick="updateTaxJournal()" style="background:#dc2626">📋 이 금액으로 법인세 전표 갱신</button></div>'+
    '</div>';
}

// Calculator
let cS={d:"0",p:null,o:null,f:true};
function cP(v){let{d,p,o,f}=cS;if(v==='C'){d="0";p=null;o=null;f=true;}else if(['+','-','×','÷'].includes(v)){p=parseFloat(d);o=v;f=true;}else if(v==='='){if(p!=null&&o){const c=parseFloat(d);let r=0;if(o==='+')r=p+c;if(o==='-')r=p-c;if(o==='×')r=p*c;if(o==='÷')r=c?p/c:0;d=String(Math.round(r*1e8)/1e8);p=null;o=null;f=true;}}else if(v==='.'){if(!d.includes('.')){d+='.';f=false;}}else{d=f?(v==='0'?'0':v):(d==='0'?v:d+v);f=false;}cS={d,p,o,f};document.getElementById('cD').textContent=isNaN(d)?d:Number(d).toLocaleString('ja-JP',{maximumFractionDigits:8});}

// toggleLang() in lang.js

// Init

// updateNavLabels() defined in lang.js


document.addEventListener('DOMContentLoaded',function(){
  // 초기화 시 보존된 스냅샷/월차마감 복원
  try{
    var preserved=localStorage.getItem(DKEY+'_preserve');
    if(preserved){
      var pData=JSON.parse(preserved);
      if(pData.snapshots&&pData.snapshots.length>0&&(!D.snapshots||D.snapshots.length===0)){
        D.snapshots=pData.snapshots;
      }
      if(pData.monthlyClosed&&Object.keys(pData.monthlyClosed).length>0&&(!D.monthlyClosed||Object.keys(D.monthlyClosed).length===0)){
        D.monthlyClosed=pData.monthlyClosed;
      }
      saveD();
      localStorage.removeItem(DKEY+'_preserve');
    }
  }catch(e){}
  go('dash');updateNavLabels();
  // Auto-fix ADJ entries
  if(D.journals.some(function(j){return j.no&&j.no.startsWith('ADJ');})){fixAdjEntries();}
  // Auto-fix 531/570→520 reclassification
  var reclass=0;
  D.journals.forEach(function(j){
    if(j.dr==='531'&&j.desc!=='コバヤシタイヤ'){j.dr='520';reclass++;}
    if(j.dr==='570'){j.dr='520';reclass++;}
  });
  if(reclass>0){saveD();toast(reclass+'건 계정 재분류 완료 (→여비교통비)');go('dash');}
  // Auto-delete S0400 (평가손 전표 → 결산 시 생성으로 변경)
  var s0400=D.journals.findIndex(function(j){return j.no==='S0400';});
  if(s0400>=0){D.journals.splice(s0400,1);saveD();toast('평가손익 전표(S0400) 삭제 → 결산 시 생성으로 변경');}

  // === 소비세 세빼기 마이그레이션 (1회만 실행) ===
  if(!D._taxMigrated){
    var taxChanges=0;
    var newTaxEntries=[];
    // Helper: check if account is expense
    var expSet={};D.accts.filter(function(ac){return ac.g==='비용';}).forEach(function(ac){expSet[ac.c]=true;});
    var revSet={};D.accts.filter(function(ac){return ac.g==='수익';}).forEach(function(ac){revSet[ac.c]=true;});

    D.journals.forEach(function(j){
      // 1) 537 "소비세" 전표 → DR을 154(가지급소비세)로 변경
      if(j.dr==='537'&&j.desc&&j.desc.indexOf('소비세')>=0){
        j.dr='154';j.taxCls='과세10%';taxChanges++;return;
      }
      // 이미 taxCls가 있으면 스킵
      if(j.taxCls) return;
      // 2) 비용 계정별 분류
      var dr=j.dr,cr=j.cr;
      // 과세10% 비용 (세포함 → 분리 대상)
      if(['520','523','526','527','528','529','531','532','533','534','536','538','539','548','570'].indexOf(dr)>=0){
        // 마이너스 금액(정산/조정)은 불과세 처리
        if(j.amt<=0){j.taxCls='불과세';taxChanges++;return;}
        j.taxCls='과세10%';
        // 세빼기 분리: 본체 감액 + 소비세 전표 생성 (마이너스/제로 제외)
        var taxAmt=Math.round(j.amt*10/110);
        if(taxAmt>0&&j.amt>0){
          j.amt=j.amt-taxAmt; // 본체를 세빼기 금액으로 조정
          var taxSlipNo=genSlipNo(j.edt||'2026-03','154',j.cr);
          newTaxEntries.push({id:nid(),dt:j.dt,no:taxSlipNo,desc:'[소비세] '+j.desc,dr:'154',cr:j.cr,amt:taxAmt,edt:j.edt||'',pdt:j.pdt||'',cur:j.cur||'JPY',exp:'',vendor:j.vendor||'',taxCls:'과세10%'});
        }
        taxChanges++;return;
      }
      // 537 수수료 (이미 별도 소비세 전표가 있으므로 분리 불필요, 라벨만)
      if(dr==='537'){j.taxCls='과세10%';taxChanges++;return;}
      // 해외출장비 → 불과세
      if(dr==='521'){j.taxCls='불과세';taxChanges++;return;}
      // 지급이자 → 비과세
      if(dr==='540'){j.taxCls='비과세';taxChanges++;return;}
      // 설립비·법인세 → 불과세
      if(['550','551','552','553','560','561'].indexOf(dr)>=0){j.taxCls='불과세';taxChanges++;return;}
      // 3) 수익 계정별 분류
      if(cr==='401'){j.taxCls='비과세';taxChanges++;return;} // 수취이자
      if(cr==='402'){j.taxCls='불과세';taxChanges++;return;} // 배당금
      if(cr==='403'){j.taxCls='비과세';taxChanges++;return;} // 유가증권매각(非課税)
      if(cr==='405'){j.taxCls='불과세';taxChanges++;return;} // 잡수입
      // 4) 자산간 이동, 자본, 차입 → 불과세
      if(['110','130','191'].indexOf(dr)>=0||['110','130','191','300','221'].indexOf(cr)>=0){j.taxCls='불과세';taxChanges++;return;}
    });
    // 소비세 분리 전표 추가
    newTaxEntries.forEach(function(e){D.journals.push(e);});
    D._taxMigrated=true;
    if(taxChanges>0){
      saveD();
      toast('소비세 세빼기 마이그레이션 완료 ('+taxChanges+'건 분류, '+newTaxEntries.length+'건 소비세 분리)');
      go('dash');
    }
  }
  document.querySelectorAll('.ni').forEach(el=>el.addEventListener('click',()=>go(el.dataset.page)));
  const ks=['C','±','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','0','.','='];
  const kd=document.getElementById('cK');
  ks.forEach((k,i)=>{const b=document.createElement('button');b.textContent=k;b.onclick=()=>cP(k);const isOp=['+','-','×','÷','='].includes(k);b.style.cssText=`padding:8px 0;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;${k==='0'&&i===16?'grid-column:span 2;':''}background:${isOp?'#2563eb':['C','±','%'].includes(k)?'#f1f3f6':'#f8f9fb'};color:${isOp?'#fff':'#1a2030'}`;kd.appendChild(b);});
});
