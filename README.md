# 선술집 기록보관소

하스스톤 정규전 티어와 추천 덱 코드를 직업별로 보여 주는 한국어 웹앱입니다. [웹앱 열기](https://rockyhong-a11y.github.io/GP_test/). 로컬 설치 없이 GitHub Actions가 수집하고 GitHub Pages가 제공합니다.

## 티어 기준

- **Vicious Syndicate 최신 Data Reaper 보고서 · 전설 상위 1,000명** 기준입니다. [공개 Power Rankings](https://www.vicioussyndicate.com/drr/vs-power-rankings-data-reaper-report/)의 Tier 1~4를 그대로 읽으며 승률이나 개인 전적으로 임의 계산하지 않습니다.
- 원본의 공개 Tableau 표를 Chromium에서 정상 렌더링하고, 같은 티어 행에 속한 덱 유형을 읽습니다. 비공개 API, 로그인 정보, 보안 확인 우회는 사용하지 않습니다.
- 같은 보고서의 추천 구성과 덱 유형을 정확히 연결합니다. 예를 들어 Dragon Warrior 평가를 Cannoneer Dragon Warrior 코드에 붙이며, unrelated 유형이나 잘못된 코드는 제외합니다.
- 보고서 번호·발행일·평가 등급 구간·원문 링크를 화면에 표시합니다. 수집 시각과 **티어 평가 날짜**를 구분합니다. 하루 4회 확인하더라도 원본 평가는 새 보고서 발행 때 바뀝니다.
- 보고서에 추천 덱이 없는 직업은 [Hearthstone-Decks.net](https://hearthstone-decks.net/standard-deck/)의 공개 전설 덱을 보완하여 표시합니다. 이런 덱은 **평가 없음**으로 구분하며 티어를 만들어 넣지 않습니다.
- 덱 유형 평가가 개별 구성의 승률을 뜻하지 않습니다. 제공되지 않은 승률·표본은 숫자로 표시하지 않습니다.

## 자동 갱신

한국시간 **매일 00·06·12·18시**에 수집 → 검증 → 데이터 커밋 → Pages 배포를 실행합니다. GitHub 예약은 부하에 따라 늦어질 수 있습니다. Actions의 **Refresh deck data → Run workflow**로 수동 실행할 수도 있습니다.

티어 표 누락, 모호한 행 구조, 출처 변경 또는 네트워크 실패 시 기존 정상 덱과 수집 시각을 보존합니다. 실패 메타데이터만 갱신·배포하고 실행은 실패로 표시합니다. 모든 티어가 빈 값인 데이터로 조용히 덮어쓰지 않습니다.

## 검증

- 실제 공개 표를 읽는 통합 검증은 GitHub 서버에서 수행합니다.
- 같은 덱 유형과 추천 코드 연결, Tier 1 필터에 덱이 실제로 남는지, 모호한 티어 행 거부, 날짜 파싱, 잘린 deckstring 및 사이드보드, 데이터 유실 방지 회귀 테스트를 포함합니다.
- deckstring의 base64·헤더·varint·30~40장 합계·사이드보드를 파싱합니다. 개별 카드의 현재 정규전 적합성을 별도 카드 DB와 대조하는 검사는 아닙니다.
- 출처의 robots.txt를 확인하고 상세 페이지 요청 사이에 기본 1초 간격을 둡니다.

## 개발자용

Node 24 이상에서 npm ci, npm test, npm run validate:data, npm run build를 사용할 수 있습니다. 실데이터 수집에는 Playwright 1.63.0과 Chromium이 필요하며 GitHub 워크플로에서 버전을 고정해 설치합니다. 서버를 로컬에서 계속 켜 둘 필요는 없습니다.

앱은 11개 직업 필터, 한국어 직업 검색, 티어·승률 정렬, 복사 버튼과 수동 복사, 오류·오래된 데이터 표시를 제공합니다.
