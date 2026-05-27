export const TOPIC_CATEGORIES = [
  {
    label: '🍕 음식',
    topics: ['짜장면 vs 짬뽕', '치킨 vs 피자', '아아 vs 뜨아', '라면 vs 국밥', '편의점 vs 배달'],
  },
  {
    label: '💕 연애',
    topics: ['직진 vs 밀당', '카톡 고백 vs 직접 고백', '장거리 vs 근거리 연애', '선고백 vs 후고백'],
  },
  {
    label: '🎮 게임',
    topics: ['PC 게임 vs 모바일 게임', '솔플 vs 팀플', '롤 vs 오버워치', '스팀 vs 플스'],
  },
  {
    label: '🤔 철학',
    topics: ['운명 vs 자유의지', '돈 vs 행복', '현실 vs 이상', '혼자 vs 함께'],
  },
  {
    label: '🏢 직장',
    topics: ['재택 vs 출근', '칼퇴 vs 야근', '대기업 vs 스타트업', '월급 vs 성과급'],
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
