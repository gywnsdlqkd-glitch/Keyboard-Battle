export const TOPIC_CATEGORIES = [
  {
    label: '🍕 음식',
    topics: [
      '짜장면 vs 짬뽕', '치킨 vs 피자', '아아 vs 뜨아', '라면 vs 국밥', '편의점 vs 배달',
      '초밥 vs 삼겹살', '마라탕 vs 떡볶이', '스타벅스 vs 이디야', '버거킹 vs 맥도날드',
      '한식 vs 양식', '아이스크림 vs 빙수', '도넛 vs 베이글', '술 vs 안 마심',
      '매운 음식 vs 안 매운 음식', '혼술 vs 혼밥', '편의점 도시락 vs 집밥',
      '탕수육 부먹 vs 찍먹', '냉면 vs 비빔냉면',
    ],
  },
  {
    label: '💕 연애',
    topics: [
      '직진 vs 밀당', '카톡 고백 vs 직접 고백', '장거리 vs 근거리 연애', '선고백 vs 후고백',
      '일반인 vs 연예인 스타일', '첫눈에 반함 vs 정으로 사귐', '감성파 vs 현실파',
      '연상 vs 연하', '솔직한 연애 vs 밀당 연애', '데이트 계획 vs 즉흥 데이트',
      '기념일 챙기기 vs 안 챙기기', '커플룩 vs 각자 스타일', '사귀기 전 친구 vs 바로 연애',
    ],
  },
  {
    label: '🎮 게임',
    topics: [
      'PC 게임 vs 모바일 게임', '솔플 vs 팀플', '롤 vs 오버워치', '스팀 vs 플스',
      'FPS vs RPG', '싱글플레이 vs 멀티플레이', '무과금 vs 과금러',
      '스트리머 시청 vs 직접 플레이', '패드 vs 키보드마우스',
      '닌텐도 vs 소니', '게임 공략 봄 vs 안 봄', '배그 vs 포트나이트',
    ],
  },
  {
    label: '🤔 철학',
    topics: [
      '운명 vs 자유의지', '돈 vs 행복', '현실 vs 이상', '혼자 vs 함께',
      '과거 vs 미래', '용기 vs 지혜', '빠르게 vs 느리게 사는 삶',
      '외향형 vs 내향형', '머리 vs 가슴', '정의 vs 용서', '변화 vs 안정',
      '말 vs 행동', '경험 vs 이론',
    ],
  },
  {
    label: '🏢 직장',
    topics: [
      '재택 vs 출근', '칼퇴 vs 야근', '대기업 vs 스타트업', '월급 vs 성과급',
      '회식 vs 야유회', '직장 동료 vs 직장 상사', '사무직 vs 현장직',
      '월급쟁이 vs 자영업', '팀워크 vs 개인플레이', '워라밸 vs 커리어',
      '직장 내 친목 vs 선 긋기', '승진 vs 이직',
    ],
  },
  {
    label: '🌏 문화',
    topics: [
      '국내여행 vs 해외여행', '영화관 vs OTT', '콘서트 vs 뮤지컬',
      '카페 vs 집', '책 vs 영상', '운동 vs 게임', '캠핑 vs 호캉스',
      '혼자 여행 vs 같이 여행', '사진 많이 찍음 vs 눈으로만 봄',
      '도심 관광 vs 자연 여행',
    ],
  },
  {
    label: '📱 기술',
    topics: [
      '아이폰 vs 갤럭시', '유튜브 vs 틱톡', '노트북 vs 데스크탑',
      'AI vs 인간', '인스타 vs X(트위터)', '카카오 vs 라인', '유선 이어폰 vs 무선 이어폰',
      '클라우드 vs 외장하드', '다크모드 vs 라이트모드',
    ],
  },
  {
    label: '⚡ 인생',
    topics: [
      '혼밥 vs 같이 밥', '도시 vs 시골', '일찍 자고 일찍 일어남 vs 늦게 자고 늦게 일어남',
      '반려동물 vs 반려식물', '돈 많은 백수 vs 바쁜 직장인', '결혼 vs 비혼',
      '아는 척 vs 모르는 척', '솔직함 vs 눈치', '미니멀리스트 vs 맥시멀리스트',
      '계획적 vs 즉흥적', '절약 vs 탕진', '건강 챙김 vs 먹고 싶은 거 먹음',
    ],
  },
  {
    label: '🎲 랜덤',
    topics: [],
  },
]

export function getRandomTopic(categoryLabel) {
  const allTopics = TOPIC_CATEGORIES.filter(c => c.label !== '🎲 랜덤').flatMap(c => c.topics)

  if (categoryLabel === '🎲 랜덤') {
    return allTopics[Math.floor(Math.random() * allTopics.length)]
  }

  const category = TOPIC_CATEGORIES.find(c => c.label === categoryLabel)
  if (!category || category.topics.length === 0) return ''

  return category.topics[Math.floor(Math.random() * category.topics.length)]
}
