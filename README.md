# 광고 등록 도우미

쇼핑검색 · 파워링크 · 디스플레이 네이티브 · 쇼핑 프로모션 등록을 돕는 로컬 웹툴입니다. 와이드 청바지 1개와 신규 샘플 이미지가 기본 설정되어 있습니다.

## 실행

Node.js 22 이상과 Google Chrome을 설치한 후 실행하세요.

```bash
npm ci
cp data/shopping-search-campaign.example.json data/shopping-search-campaign.json
npm run web
```

브라우저에서 http://localhost:5178 을 여세요. Windows에서는 `cp` 대신 `copy`를 사용하세요.

## 실제 등록 전

- 주소의 `sample`, 상품 ID, 광고 계정·캠페인 ID는 가상 예시입니다. 본인 값으로 바꾸세요.
- 광고 계정 ID(`naverAdAccountId`)는 `data/shopping-search-campaign.json`에서 수정하고, 각 광고 유형의 캠페인 URL과 상품 URL도 본인 값으로 입력하세요.
- `로그인 열기`로 본인 광고 계정에 로그인한 뒤 문구·예산·이미지를 확인하고 `HTTP 등록`을 누르세요. 실제 광고가 생성됩니다.
- 디스플레이 이미지는 `이미지 크기·용량 검증`으로 미리 확인할 수 있습니다.

개인 설정, 로그인 프로필, 업로드 파일, 실행 로그는 Git에서 제외됩니다. 원본 프로젝트의 Git 이력은 포함하지 않았습니다.

## 검사

```bash
npm run typecheck
node --import tsx --test tests/*.test.ts
```

브라우저 테스트는 기본적으로 macOS Chrome 경로를 사용합니다. 다른 환경에서는 `CHROME_PATH`를 지정하세요.

샘플 사진은 내장 이미지 생성 도구로 생성했습니다. 프롬프트: 아이보리 배경에 중청 와이드 청바지 한 벌의 전체 형태가 보이는 제품 사진, 로고·문구 없음.
