# 태성㈜ 재무관리시스템 - 기술 문서

## 시스템 개요

| 항목 | 내용 |
|------|------|
| 회사명 | 태성주식회사 (泰成株式会社) |
| 사업 | 투자·자산관리 (일본주식/미국주식) |
| 회계연도 | FY2025 (2025.06.02 ~ 2026.05.31) |
| 자본금 | 10,000,000엔 |
| 배포 | GitHub Pages (https://ocw-1027.github.io/taesung/) |
| DB | localStorage + Firebase Firestore |

---

## 파일 구조

### index.html (3KB)
- 사이드바 네비게이션 (10개 메뉴 + 동기화 + 계산기)
- Firebase SDK 로드 (CDN)
- 캐시 방지 메타태그 + 파일 버전 번호
- PIN 잠금 화면 (현재 비활성)

### style.css (7KB)
- CSS 변수 기반 테마
- 모바일 반응형 (768px / 400px 브레이크포인트)
- PIN 키패드 스타일
- 인쇄 스타일 (.no-print)

### data.js (34KB)
- `ACCT_INIT`: 계정과목 마스터 200+ (코드, 한국어명, 일본어명, 그룹)
- `INIT_JOURNALS`: 전표 181건 (177건 + 조정 4건)
- `INIT_HOLD_JP`: 일본 보유종목 6종목
- `INIT_HOLD_US`: 미국 보유종목 1종목
- `INIT_REAL`: 수익실현 9건
- `INIT_BK_IN` / `INIT_BK_OUT`: 은행 입출금
- `FS`: 재무제표 기본값
- `SEC_DEP`: 증권예수금 초기값
- `INIT_VENDORS`: 거래처 마스터
- `SET`: 환율/보고서 설정

### lang.js (1KB)
- 한국어 전용 (일본어 제거됨)
- `t(k)`, `tAcct(code)` 패스스루 함수

### app.js (130KB)
- 전체 앱 로직

---

## app.js 주요 함수 구조

### 데이터 관리
```
loadJ(key, default)     localStorage에서 JSON 로드
saveD()                 D를 localStorage에 저장
saveS()                 SET를 localStorage에 저장
nid()                   고유 ID 생성
```

### 계정 집계
```
acctBal(code)           전표에서 계정 잔액 계산 (차변-대변 or 대변-차변)
dynamicFS()             재무제표 전체 계산 (P/L + B/S)
calc()                  대시보드용 종합 계산 (유가증권 시가 포함)
```

### 페이지 렌더링
```
rDash()                 대시보드
rSlip()                 전표처리
rJrn()                  전표조회
rGL()                   총계정원장
rFS()                   재무제표 (손익계산서)
rBSTab()                대차대조표 탭
rTxTab()                법인세추정 탭
rSec()                  유가증권
rBank()                 법인계좌
rRpt()                  운용보고서
rSet()                  설정
```

### Firebase 동기화
```
fbSave()                Firestore에 업로드
fbLoad()                Firestore에서 다운로드
doFbUpload()            수동 업로드 (UI)
doFbDownload()          수동 다운로드 (UI, 속성별 복사)
showSyncModal()         동기화 모달
```

### 내보내기
```
exportGLExcel()         총계정원장 → Excel (일본어)
exportFSWord()          재무제표 → Word (일본어)
exportWord()            운용보고서 → Word
exportBackup()          전체 데이터 → JSON
importBackup()          JSON → 데이터 복원
```

### 결산
```
autoEvalAdjust()        유가증권 평가손 조정전표 자동생성
updateTaxJournal()      법인세 전표 갱신 (추정탭 기준)
saveMonthlyClose()      월차 마감 스냅샷 저장
```

---

## 계정과목 체계

### 자산 (100~199)
| 코드 | 계정명 | 일본어 |
|------|--------|--------|
| 100 | 현금 | 現金 |
| 110 | 보통예금 | 普通預金 |
| 130 | 유가증권 | 有価証券 |
| 150 | 선급비용 | 前払費用 |
| 180 | 보증금 | 保証金 |
| 191 | 증권예수금 | 証券預り金 |

### 부채 (200~299)
| 코드 | 계정명 | 일본어 |
|------|--------|--------|
| 203 | 미지급금 | 未払金 |
| 205 | 미지급법인세 | 未払法人税等 |
| 221 | 임원차입금 | 役員借入金 |
| 224 | 미지급이자 | 未払利息 |

### 순자산 (300~399)
| 코드 | 계정명 | 일본어 |
|------|--------|--------|
| 300 | 자본금 | 資本金 |

### 수익 (400~499)
| 코드 | 계정명 | 일본어 |
|------|--------|--------|
| 401 | 수취이자 | 受取利息 |
| 402 | 수취배당금 | 受取配当金 |
| 403 | 유가증권매각이익 | 有価証券売却益 |
| 405 | 잡수입 | 雑収入 |

### 비용 (500~599)
| 코드 | 계정명 | 표시 위치 |
|------|--------|----------|
| 520 | 여비교통비 | 판관비 |
| 521 | 해외출장비 | 판관비 |
| 523 | 소모품비 | 판관비 |
| 531 | 차량비 | 판관비 |
| 532 | 접대교제비 | 판관비 |
| 536 | 지급수수료 | 판관비 |
| 537 | 유가증권매매수수료 | 판관비 |
| 540 | 지급이자 | 영업외비용 |
| 542 | 유가증권평가손 | 영업외비용 |
| 550 | 법인세등 | 법인세 |
| 560 | 설립비 | 설립비 |
| 570 | 잡비 | 판관비 |

---

## 데이터 흐름

```
[전표 기표] → D.journals에 저장 → localStorage
    ↓
[재무제표] ← acctBal()로 전표 집계
    ↓
[손익계산서]
  판관비: 비용계정 (500~539, 570~) 동적 스캔
  영업외수익: 수익계정 (400~) 동적 스캔
  영업외비용:
    - 유가증권평가손 ← 보유종목 시가 기준 (실시간)
    - 지급이자 ← acctBal('540')
  법인세 ← acctBal('550') 또는 추정
    ↓
[대차대조표]
  보통예금 ← acctBal('110')
  증권예수금 ← acctBal('191')
  유가증권 ← 장부가 - 시가조정액 (evalAdj)
  부채 ← 모든 부채계정 동적 스캔
  순자산 ← 모든 순자산계정 + 이익잉여금(당기순이익)
  ※ 자산합계 = 부채+순자산합계 (DIFF=0 보장)
```

### 시가 반영 구조
```
evalLoss = max(0, 총취득원가 - 총시가평가액)  ← 실시간
journalEvalLoss = acctBal('542')               ← 전표상 평가손
evalAdj = evalLoss - journalEvalLoss           ← 조정액
secForBS = 장부가(130) - evalAdj               ← BS 유가증권

→ P/L 평가손이 증가하면 BS 유가증권도 동일 금액 감소
→ 차대 항상 일치
```

---

## Firebase 설정

### Firestore 구조
```
Collection: appdata
  Document: taesung_main
    Fields:
      - data: string (JSON, 전체 D 객체)
      - settings: string (JSON, SET 객체)
      - updatedAt: string (ISO datetime)
      - device: string (User-Agent)
```

### 보안 규칙 (테스트 모드)
현재 테스트 모드 (30일 제한). 운용 시 규칙 변경 필요:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appdata/{document} {
      allow read, write: if true;  // 추후 Auth 추가 시 변경
    }
  }
}
```

### localStorage 키
| 키 | 내용 |
|-----|------|
| taesung_data | 전체 데이터 (D 객체) |
| taesung_settings | 환율/보고서 설정 |
| taesung_pin | PIN (현재 미사용) |

---

## 법인세 추정 구조

```
경상이익 (oi)
├── 법인세: oi × 15% (자본금1억이하, 소득800만이하)
├── 지방법인세: 법인세 × 10.3%
├── 법인사업세: oi × 7%
├── 특별법인사업세: 사업세 × 37%
├── 법인도민세: 법인세 × 7% (도쿄도)
└── 균등할: 70,000엔 (도쿄도 최저)
= 법인세 등 합계 (실효세율 ~28%)
```

---

## 커스터마이즈 포인트

### 다른 회사에 적용 시 변경할 것

1. **data.js**
   - `INIT_JOURNALS`: 전표 데이터 (빈 배열로)
   - `INIT_HOLD_JP/US`: 보유종목 (빈 배열로)
   - `INIT_BK_IN/OUT`: 은행 데이터 (빈 배열로)
   - `SEC_DEP`: 증권예수금 초기값

2. **index.html**
   - 회사명
   - Firebase config (별도 프로젝트)
   - FY 표시

3. **app.js**
   - 회사명 (태성㈜ → 새 회사)
   - localStorage 키
   - Word 내보내기 회사명/기간
   - 법인세 세율 (지역에 따라 다름)

4. **법인세 세율** (지역별)
   - 법인사업세: 표준세율 7% (지역에 따라 다름)
   - 도민세/현민세: 7%~12% (지역에 따라 다름)
   - 균등할: 7만~380만엔 (자본금/종업원수에 따라)
