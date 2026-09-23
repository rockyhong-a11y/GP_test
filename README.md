# 선술집 기록보관소

하스스톤 **정규전(기본값: 다이아몬드~전설)** 티어 덱을 직업별로 찾아 덱 코드를 바로 복사하는 한국어 정적 웹앱입니다. GitHub Pages에서 `/GP_test/` 하위 경로로 동작하며, 서버측 수집은 GitHub Actions가 담당합니다.

## 데이터 원칙과 현재 상태

- 공개된 [Hearthstone-Decks.net 정규전 덱](https://hearthstone-decks.net/standard-deck/) 목록과 실제 덱 상세 페이지만 요청합니다. 비공개 API를 추측하거나 접근 제한을 우회하지 않습니다.
- `robots.txt`를 먼저 확인하고 수집 경로가 금지되면 즉시 중단합니다. 요청은 식별 가능한 User-Agent, 15초 timeout, 지수형 retry(최대 3회), 상세 페이지 사이 기본 1초 간격을 적용합니다.
- 이 출처는 메타 티어/전체 승률을 제공하지 않으므로 덱을 **미평가**로 표시합니다. 상세 페이지의 Score는 해당 플레이어의 개인 전적이므로 승률·표본·티어로 변환하지 않습니다. 게시 날짜(`sourceDate`)와 실제 수집 시각(`collectedAt`)도 별도로 보관합니다.
- 모든 deckstring은 정규 base64, 예약 헤더, 버전/게임 형식, varint 영웅·카드 구간, 30~40장 합계와 후행 데이터를 끝까지 파싱한 경우에만 게시합니다. 외부 카드 DB에 존재하는 카드인지까지 확인하는 검사는 아닙니다. 명시적 데이터 스키마 검증 후 임시 파일을 rename하는 원자적 저장을 사용합니다.
- 수집 실패 시 기존 `decks`와 원래 `collectedAt`을 그대로 보존하고 `collectionAttemptedAt`과 `collectionError`만 갱신합니다. 앱은 성공 수집 시각과 최근 시도 시각을 구분하고 실패/12시간 초과 데이터를 경고합니다.
- 저장소의 초기 JSON은 **데모를 최신 데이터처럼 제시하지 않기 위해 비어 있으며 `collectedAt`도 `null`입니다.** 2026-09-23 확인 결과 승인 프록시가 HSGuru와 대체 출처에 대한 CONNECT 요청을 HTTP 403으로 거부했습니다. 따라서 실데이터를 만들 수 없었으며 Actions의 `workflow_dispatch`로 최초 수집을 실행해야 합니다.

HTML 구조가 바뀌어 수집이 실패하면 마지막 정상 데이터가 계속 제공되며 워크플로는 실패 상태가 됩니다. 이는 조용히 부정확한 자료를 게시하는 것보다 의도된 동작입니다.

## 자동 갱신과 배포

`.github/workflows/refresh.yml`은 `0 3,9,15,21 * * *` UTC, 즉 한국시간 **매일 00/06/12/18시**에 실행됩니다. GitHub 예약 실행은 부하에 따라 지연될 수 있습니다. `workflow_dispatch`도 지원하므로 Actions → **Refresh deck data** → Run workflow에서 최초/수동 실행할 수 있습니다.

수집 성공 → 검증/테스트 → 변경 JSON 커밋 → 빌드 → Pages 배포 순입니다. `GITHUB_TOKEN`이 만든 push는 다른 workflow를 자동 실행하지 않으므로 refresh workflow 자체에 Pages 배포 job을 두었습니다. 수집 실패 시에도 보존 데이터와 `collectionError`를 커밋·배포한 뒤 별도 report job이 workflow를 실패로 표시합니다. 두 배포 workflow는 같은 concurrency 그룹을 사용하며 진행 중 배포를 취소하지 않아 이전 데이터가 뒤늦게 덮어쓰는 경쟁을 막습니다.

### 저장소 설정

1. PR을 병합한 뒤 **Settings → Pages → Source**를 `GitHub Actions`로 설정합니다.
2. Actions 쓰기 권한과 Pages 환경을 허용합니다. 워크플로 권한은 job별로 `contents: write`(수집 commit)와 `pages: write`/`id-token: write`(배포)만 사용합니다.
3. **Refresh deck data**를 한 번 수동 실행해 최초 실데이터를 만들고 배포 결과를 확인합니다.

## 로컬 검증(개발자용)

```bash
npm ci
npm test
npm run validate:data
npm run build
python3 -m http.server 4173
```

수집기는 일반 환경에서 `npm run collect`, 승인 프록시 환경에서는 `npm run collect:proxy`로 실행합니다. Node 24의 `--use-env-proxy`만 사용하며 프록시를 우회하거나 비밀값을 출력하지 않습니다. 테스트 fixture는 네트워크 차단으로 실제 페이지를 저장한 것이 아닌 파서 계약용 최소 마크업입니다. 운영 배포 전 실제 HTML 수집이 성공하고 유효한 덱이 하나 이상 없으면 collector는 실패합니다. 운영 데이터 파일은 `public/data/decks.json`이며 수집 시각은 UTC ISO 문자열로 저장하고 UI에서 KST로 변환합니다.

## UI

11개 전 직업 섹션/필터, 한국어 검색, 티어 필터, 티어·승률 정렬, 통계/표본/출처 링크, 갱신 시각, 빈 결과·로딩·오류·stale 상태를 제공합니다. 복사 버튼은 Clipboard API 실패 시 코드 영역을 열고 자동 선택해 키보드나 모바일의 수동 복사를 지원합니다.
