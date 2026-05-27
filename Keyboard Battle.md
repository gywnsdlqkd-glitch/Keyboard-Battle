# CLAUDE.md — Keyboard Fight

## 프로젝트 개요
**Keyboard Fight**는 웹 기반 실시간 멀티플레이어 타이핑 대전 게임입니다.
`.io` 게임 스타일로, 별도의 설치 없이 브라우저에서 바로 접속하여 다른 유저들과 타이핑 속도/정확도를 겨루는 경쟁형 게임 사이트입니다.

### 핵심 컨셉
- **즉시 접속**: 닉네임만 입력하면 바로 게임 참여 가능 (.io 스타일)
- **실시간 대전**: WebSocket 기반 실시간 멀티플레이어
- **채팅 경쟁**: 채팅창에 제시어를 먼저 정확히 타이핑하면 승리
- **랭킹 시스템**: 실시간 리더보드 및 전적 관리

---

## 기술 스택

### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript** (프레임워크 없음)
- 반응형 디자인 (모바일/데스크톱 대응)
- CSS 애니메이션 및 트랜지션 활용
- Google Fonts 사용 (Inter, Noto Sans KR 등)

### Backend
- **Node.js** + **Express** (HTTP 서버)
- **Socket.IO** (실시간 양방향 통신)

### 데이터
- 인메모리 저장 (초기 단계)
- 추후 필요 시 SQLite 또는 JSON 파일 기반 영속화

---

## 프로젝트 구조 (목표)

```
Keyboard Fight/
├── CLAUDE.md              # 이 파일 (프로젝트 가이드)
├── package.json           # Node.js 의존성 관리
├── server.js              # Express + Socket.IO 서버 진입점
├── public/                # 정적 파일 (프론트엔드)
│   ├── index.html         # 메인 페이지 (로비)
│   ├── game.html          # 게임 플레이 화면
│   ├── css/
│   │   └── style.css      # 메인 스타일시트
│   ├── js/
│   │   ├── main.js        # 로비 로직
│   │   ├── game.js        # 게임 클라이언트 로직
│   │   └── socket.js      # Socket.IO 클라이언트 래퍼
│   └── assets/            # 이미지, 사운드 등
└── game/                  # 서버 사이드 게임 로직
    ├── Room.js            # 게임 방 관리
    ├── Player.js          # 플레이어 모델
    ├── WordManager.js     # 제시어 관리
    └── GameEngine.js      # 게임 진행 엔진
```

---

## 게임 플로우

1. **접속** → 닉네임 입력 (로그인 불필요)
2. **로비** → 방 목록 확인 / 방 생성 / 빠른 참가
3. **대기실** → 참가자 목록, 채팅, 준비 상태
4. **게임 진행** → 제시어가 화면에 표시 → 가장 먼저 정확히 타이핑한 사람이 점수 획득
5. **결과** → 라운드/게임 결과, 랭킹 업데이트

---

## 개발 명령어

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (기본 포트: 3000)
npm run dev

# 프로덕션 실행
npm start
```

---

## 코딩 컨벤션

### JavaScript
- **변수/함수명**: camelCase (`playerScore`, `handleInput`)
- **클래스명**: PascalCase (`GameRoom`, `PlayerManager`)
- **상수**: UPPER_SNAKE_CASE (`MAX_PLAYERS`, `ROUND_TIME`)
- **들여쓰기**: 2 spaces
- **문자열**: 작은따옴표(`'`) 사용, 템플릿 리터럴 허용
- **ES6+ 문법** 적극 사용 (arrow functions, destructuring, async/await 등)
- **세미콜론** 필수

### CSS
- **BEM 네이밍** 권장: `.block__element--modifier`
- **CSS 변수** 활용하여 디자인 토큰 관리
- 다크 테마 기본

### HTML
- 시맨틱 태그 적극 사용 (`<header>`, `<main>`, `<section>` 등)
- 각 인터랙티브 요소에 고유 `id` 부여
- 접근성(a11y) 고려

---

## 디자인 가이드

### 테마
- **다크 모드 기본** (게이밍 감성)
- 네온/글로우 효과 활용
- 그라데이션 배경
- 글래스모피즘(Glassmorphism) UI 요소

### 색상 팔레트
- Primary: `hsl(260, 85%, 60%)` (보라)
- Accent: `hsl(170, 80%, 50%)` (시안/민트)
- Danger: `hsl(0, 75%, 55%)` (레드)
- Success: `hsl(145, 70%, 50%)` (그린)
- Background: `hsl(230, 25%, 10%)` (다크 네이비)
- Surface: `hsl(230, 20%, 15%)` (서피스)
- Text: `hsl(0, 0%, 95%)` (라이트)

### 타이포그래피
- 영문: `'Inter'`, `'Outfit'`
- 한글: `'Noto Sans KR'`
- 코드/타이핑 영역: `'JetBrains Mono'`, `monospace`

---

## 주의사항 / 규칙

### 반드시 지켜야 할 것
- 모든 실시간 통신은 **Socket.IO**를 통해 처리
- 게임 판정 로직은 반드시 **서버 사이드**에서 처리 (치팅 방지)
- 클라이언트는 입력 전송 + 결과 렌더링만 담당
- 한국어/영어 제시어 모두 지원
- 모바일 환경에서도 플레이 가능하도록 반응형 구현

### 하지 말아야 할 것
- 프론트엔드 프레임워크(React, Vue 등) 사용 금지 — Vanilla JS만 사용
- 외부 게임 엔진(Phaser 등) 사용 금지
- jQuery 사용 금지
- 인라인 스타일 사용 금지 (CSS 파일로 분리)
- `var` 키워드 사용 금지 (`let`, `const`만 사용)

### 성능
- 불필요한 DOM 조작 최소화
- WebSocket 메시지는 최소한의 데이터만 포함
- 에셋은 가능한 경량화

---

## Socket.IO 이벤트 네이밍 규칙

### 클라이언트 → 서버
- `player:join` — 게임 참가
- `player:ready` — 준비 완료
- `player:input` — 타이핑 입력 전송
- `chat:message` — 채팅 메시지
- `room:create` — 방 생성
- `room:join` — 방 참가
- `room:leave` — 방 퇴장

### 서버 → 클라이언트
- `game:start` — 게임 시작
- `game:round` — 새 라운드 (제시어 전달)
- `game:score` — 점수 업데이트
- `game:end` — 게임 종료
- `room:update` — 방 상태 업데이트
- `player:list` — 플레이어 목록 갱신
- `chat:broadcast` — 채팅 브로드캐스트

---

## 향후 확장 계획
- [ ] 1vs1 랭크 매칭
- [ ] 커스텀 제시어 세트
- [ ] 관전 모드
- [ ] 프로필 및 통계 페이지
- [ ] 사운드 이펙트 및 배경음악
- [ ] 이모지 리액션
- [ ] 시즌 랭킹 시스템
