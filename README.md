# 맛과 길 — 맛집·여행 노트

성민의 맛집·여행 기록을 모으는 정적 블로그입니다. 빌드 도구 없이 HTML/CSS/JS와 JSON 데이터만으로
동작하며, GitHub Pages에 그대로 배포됩니다.

- 라이브: https://mrblue000-cmd.github.io/
- 저장소: https://github.com/mrblue000-cmd/mrblue000-cmd.github.io

## 구조

```
index.html               화면 뼈대 (히어로 · 필터 · 그리드 · 지도 · 모달)
assets/css/style.css     디자인 (색·서체·간격은 :root 토큰에서 한 번에 바꿉니다)
assets/js/app.js         데이터 로딩, 필터/검색, 카드 렌더링, Leaflet 지도, 상세 모달
assets/img/              포스트 사진 (커버는 16:10, 1600×1000 권장)
assets/vendor/leaflet/   Leaflet 1.9.4 (CDN 없이 로컬에서 로드)
data/site.json           블로그 이름·소개·카테고리·지역 목록·지도 중심 좌표
data/posts.json          포스트 목록 (이 파일만 고치면 글이 늘어납니다)
```

## 블로그 이름 바꾸기

`data/site.json`의 `title`, `tagline`, `description`을 고치면 헤더·푸터·탭 제목에 모두 반영됩니다.
`index.html`의 `<title>`, `og:title`도 함께 바꾸면 검색·공유 미리보기까지 맞출 수 있습니다.

## 새 글 추가하기

1. 사진을 `assets/img/`에 넣습니다. 커버는 16:10(예: 1600×1000), 본문 사진은 가로 1200px 정도면 충분합니다.
2. `data/posts.json`의 `posts` 배열 맨 앞에 아래 형식으로 한 항목을 추가합니다.

```json
{
  "id": "busan-market",
  "title": "부산 시장, 아침 국밥 한 그릇",
  "oneline": "카드에 보이는 한 줄 요약",
  "category": "맛집",              // 맛집 | 여행
  "region": "국내여행",             // site.json의 regions 중 하나
  "area": "부산",
  "date": "2026-11-20",
  "rating": 4.6,                    // 없으면 null 또는 빼기
  "tags": ["국밥", "시장", "아침"],
  "cover": "assets/img/busan-market-1.jpg",
  "coverAlt": "사진 설명 (접근성)",
  "gallery": [
    { "src": "assets/img/busan-market-2.jpg", "alt": "사진 설명" }
  ],
  "place": {
    "name": "가게·장소 이름",
    "address": "지역 수준 주소",
    "lat": 35.1796,
    "lng": 129.0756
  },
  "body": ["첫 문단", "두 번째 문단"]
}
```

3. 저장하고 `main`에 푸시하면 1분 안에 사이트에 반영됩니다. (예시 글의 `예시` 표시를 없애려면
   `assets/js/app.js`의 `badge--sample` 부분과 `.card-foot`의 `예시` 스팬을 지우면 됩니다.)

## 지역·카테고리 추가

`data/site.json`의 `regions` / `categories`에 항목을 넣고, 글의 `region` / `category` 값으로 사용합니다.

## 지도

Leaflet + OpenStreetMap 타일을 사용합니다. 핀 좌표는 각 글의 `place.lat` / `place.lng`이며,
지도의 기본 중심·줌은 `site.json`의 `mapCenter`, `mapZoom`으로 정합니다.
