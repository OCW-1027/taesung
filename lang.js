// Language system - Korean / Japanese
let LANG = localStorage.getItem('taesung_lang') || 'ko';

const TX = {
  // Nav & App
  app:['법인 재무관리','法人財務管理'],co:['태성주식회사','泰成株式会社'],
  dash:['대시보드','ダッシュボード'],slip:['전표처리','伝票処理'],jrn:['전표조회','伝票照会'],
  gl:['총계정원장','総勘定元帳'],fs:['재무제표','財務諸表'],sec:['유가증권','有価証券'],
  bank:['법인계좌','法人口座'],rpt:['운용보고서','運用報告書'],set:['설정','設定'],calc:['계산기','計算機'],
  // Table headers
  code:['코드','コード'],name:['종목명','銘柄名'],qty:['수량','数量'],
  buyAmt:['매수금액','買付金額'],fee:['수수료','手数料'],tc:['취득원가','取得原価'],
  bep:['BEP','BEP'],cp:['현재가','現在値'],mv:['평가액','評価額'],
  pl:['손익','損益'],rr:['수익률','収益率'],tot:['합계','合計'],
  // Securities
  holdJP:['가) 일본','イ) 日本'],holdUS:['나) 미국','ロ) 米国'],holdAll:['다) 전체','ハ) 全体'],
  cpUsd:['현재가(USD)','現在値(USD)'],rate:['환율','為替'],
  sellAmt:['매도금액','売却金額'],sellFee:['매도수수료','売却手数料'],netPL:['순수익','純利益'],
  realized:['수익실현','収益実現'],holdings:['보유현황','保有現況'],
  evalPL:['평가손익','評価損益'],realPL:['실현손익','実現損益'],totalPL:['총합손익','総合損益'],
  evalAmt:['유가증권평가액','有価証券評価額'],
  buyFee:['매수수수료','買付手数料'],buyTax:['매수소비세','買付消費税'],
  sellComm:['매도수수료','売却手数料'],sellTax:['매도소비세','売却消費税'],
  sellPx:['매도가','売却単価'],realDt:['확정일','確定日'],
  // Bank
  bankBal:['법인계좌 잔액','法人口座残高'],totIn:['총입금','総入金'],totOut:['총출금','総出金'],
  dep:['입금','入金'],wd:['출금','出金'],bal:['잔액','残高'],
  cum:['누적','累積'],cat:['구분','区分'],dt:['일자','日付'],
  depAmt:['입금금액(엔)','入金額(円)'],wdAmt:['출금금액(엔)','出金額(円)'],
  cumIn:['누적입금액(엔)','累積入金額(円)'],cumOut:['누적출금액(엔)','累積出金額(円)'],
  // Financial Statements
  plStmt:['손익계산서','損益計算書'],bsStmt:['대차대조표','貸借対照表'],taxEst:['법인세추정','法人税推定'],
  plTitle:['손 익 계 산 서 (잠정)','損 益 計 算 書（暫定）'],
  sales:['Ⅰ 매출고','Ⅰ 売上高'],grossP:['매출총이익','売上総利益'],
  sgaTitle:['Ⅱ 판매비및일반관리비','Ⅱ 販売費及び一般管理費'],sgaTot:['판관비 합계','販管費合計'],
  startupCost:['창립비','創立費'],opLoss:['영업손실','営業損失'],
  noiTitle:['Ⅲ 영업외수익','Ⅲ 営業外収益'],noiTot:['영업외수익 합계','営業外収益合計'],
  noeTitle:['Ⅳ 영업외비용','Ⅳ 営業外費用'],noeTot:['영업외비용 합계','営業外費用合計'],
  ordInc:['경상이익(세전)','経常利益（税引前）'],
  corpTaxTitle:['Ⅴ 법인세등(추정)','Ⅴ 法人税等（推定）'],
  netIncome:['세후 당기순이익','税引後当期純利益'],ni:['당기순이익','当期純利益'],
  assetDiv:['【자산의 부】','【資産の部】'],liabDiv:['【부채의 부】','【負債の部】'],eqDiv:['【순자산의 부】','【純資産の部】'],
  cashTot:['현금·예금계','現金・預金計'],secMV:['유가증권(시가)','有価証券（時価）'],
  assetTot:['자산합계','資産合計'],liabTot:['부채합계','負債合計'],eqTot:['순자산합계','純資産合計'],
  liabEqTot:['부채·순자산합계','負債・純資産合計'],
  feeDetail:['유가증권 매매수수료 내역 (소비세 분리)','有価証券売買手数料内訳（消費税分離）'],
  buyCommTot:['매수수수료','買付手数料'],buyTaxTot:['매수소비세','買付消費税'],
  sellCommTot:['매도수수료','売却手数料'],sellTaxTot:['매도소비세','売却消費税'],
  feeTotalLabel:['수수료 총합계','手数料総合計'],
  taxBefore:['세전','税抜'],taxAmount:['소비세','消費税'],
  // Report
  rptTitle:['태성㈜ 자금운용보고서','泰成㈱ 資金運用報告書'],
  sec1:['1. 총자산내역','1. 総資産内訳'],
  sec2:['2. 유가증권 평가 및 손익 현황','2. 有価証券評価及び損益現況'],
  sec3:['3. 수익실현내역','3. 収益実現内訳'],
  sec4:['4. 은행 법인 계좌 상세 내역','4. 銀行法人口座詳細内訳'],
  item:['구분','区分'],detail:['내역(엔)','内訳（円）'],note:['비고','備考'],
  capital:['자본금','資本金'],income:['수입','収入'],expense:['지출','支出'],
  bankBal1:['법인계좌잔액---(1)','法人口座残高---(1)'],secDep:['증권예수금','証券預り金'],
  evalAmtLabel:['유가증권평가액','有価証券評価額'],
  secBal1:['증권계좌잔액---(2)','証券口座残高---(2)'],totalHold:['총보유자산','総保有資産'],bankBal:['법인계좌','法人口座'],realPL:['실현손익','実現損益'],evalPL:['평가손익','評価損益'],totalPL:['총합손익','総合損益'],evalAmt:['유가증권평가액','有価証券評価額'],
  summary:['총괄 요약','総括要約'],totalEval:['총 평가액','総評価額'],totalEvalPL:['총 평가손익','総評価損益'],
  inDetail:['입금 상세내역','入金詳細内訳'],outDetail:['출금 상세내역','出金詳細内訳'],
  // Slip
  slipTitle:['대체전표','振替伝票'],approve:['본인전결','本人専決'],
  evidDt:['증빙일자','証憑日付'],postDt:['전기일자','転記日付'],
  desc:['적요','摘要'],currency:['통화','通貨'],
  drCr:['차/대','借/貸'],dr:['차변','借方'],cr:['대변','貸方'],
  acct:['계정과목','勘定科目'],amt:['금액','金額'],taxRate:['소비세','消費税'],
  taxAmt:['세액','税額'],costType:['원가구분','原価区分'],
  addRow:['+ 행추가','+ 行追加'],addAcct:['+ 과목추가','+ 科目追加'],
  submitSlip:['승인·기표','承認・起票'],
  slipList:['전표일람','伝票一覧'],balanced:['✓ 차대일치','✓ 貸借一致'],unbalanced:['✗ 불일치','✗ 不一致'],
  period:['회기','会期'],month:['월','月'],
  // Settings
  rateSet:['💱 환율 설정','💱 為替設定'],rptDateSet:['📄 보고서 기준일','📄 報告書基準日'],
  companyInfo:['🏢 회사 정보','🏢 会社情報'],dataReset:['🔄 데이터 초기화','🔄 データ初期化'],
  save:['💾 저장','💾 保存'],
  // Actions
  print:['🖨 인쇄 (A4)','🖨 印刷（A4）'],wordExport:['📝 워드 내보내기','📝 Word出力'],
  priceUpdate:['📊 시세 업데이트','📊 時価更新'],addEntry:['+ 내역추가','+ 内訳追加'],
  cancel:['취소','取消'],close:['닫기','閉じる'],add:['추가','追加'],edit:['수정','修正'],save2:['저장','保存'],mv:['평가액','評価額'],
  noSlip:['기표된 전표가 없습니다','起票された伝票がありません'],
  items:['건','件'],accts:['개 과목','科目'],
  mitsui:['미츠이스미토모','三井住友'],nikko:['SMBC닛코증권','SMBC日興証券'],
  basis:['기준','基準'],
  // P&L items
  sga_entertainment:['접대교제비','交際接待費'],sga_vehicle:['차량비','車両費'],
  sga_travel:['여비교통비','旅費交通費'],sga_overseas:['해외출장비','海外渡航費'],
  sga_supplies:['소모품비','消耗品費'],sga_ebfee:['지급수수료(EB)','支払手数料（EB）'],
  sga_secfee:['유가증권매매수수료','有価証券売買手数料'],sga_misc:['잡비','雑費'],
  noi_gain:['유가증권매각이익(총액)','有価証券売却益（総額）'],noi_div:['배당금','配当金'],
  noi_interest:['이자수입(세후)','受取利息（税引後）'],noi_misc:['잡수입','雑収入'],
  noe_eval:['유가증권평가손(미실현)','有価証券評価損（未実現）'],
  noe_interest:['지급이자(임원차입 연1%)','支払利息（役員借入金年1%）'],
  // BS items
  bs_deposit:['보통예금','普通預金'],bs_secdep:['증권예수금','証券預り金'],
  bs_loan:['임원차입금','役員借入金'],bs_intpay:['미지급이자','未払利息'],
  bs_unpaid:['미지급금(설립비)','未払金（設立費）'],bs_taxpay:['미지급법인세등','未払法人税等'],
  bs_capital:['자본금','資本金'],bs_retained:['이익잉여금','利益剰余金'],
  // Tax items
  tx_income:['과세소득','課税所得'],tx_corp:['법인세','法人税'],
  tx_local:['지방법인세','地方法人税'],tx_metro:['도민세(할)','都民税（割）'],
  tx_metrofix:['도민세(균등)','都民税（均等）'],tx_biz:['사업세','事業税'],
  tx_specbiz:['특별사업세','特別事業税'],
  tx_prepaid:['기납부원천세','既納付源泉税'],tx_foreign:['외국세액공제','外国税額控除'],
  tx_due:['차감납부액','差引納付額'],
};

function t(k){return TX[k]?TX[k][LANG==='ja'?1:0]:(k);}
function tAcct(code){const a=D.accts.find(x=>x.c===code);return a?(LANG==='ja'?a.n:a.k):code;}

function toggleLang(){
  LANG=LANG==='ko'?'ja':'ko';
  localStorage.setItem('taesung_lang',LANG);
  updateNavLabels();
  go(cur);
}

function updateNavLabels(){
  const labels={dash:t('dash'),slip:t('slip'),jrn:t('jrn'),gl:t('gl'),fs:t('fs'),sec:t('sec'),bank:t('bank'),rpt:t('rpt'),set:t('set')};
  document.querySelectorAll('.ni').forEach(el=>{
    const pg=el.dataset.page;if(pg&&labels[pg]){const sp=el.querySelectorAll('span');if(sp[1])sp[1].textContent=labels[pg];}
  });
  document.getElementById('langBtn').textContent=LANG==='ko'?'🌐 日本語':'🌐 한국어';
  document.querySelector('.nav-hd h3').textContent=t('app');
  document.querySelector('.nav-hd p').textContent=t('co');
  const cb=document.getElementById('calcBtn');if(cb)cb.textContent='🧮 '+t('calc');
}
