// Vercel 서버리스 함수 엔드포인트 URL (/api/dust?sido=시도이름)
const API_URL = '/api/dust';

// Chart.js 인스턴스 전역 변수
let dustChartInstance = null;

// 현재 조회된 원본 측정소 데이터 목록 캐시
let currentStationsData = [];

// 현재 선택된 등급 필터 상태 ('all', '1', '2', '3', '4')
let selectedGradeFilter = 'all';

// DOM 요소 참조
const sidoSelect = document.getElementById('sidoSelect');
const refreshBtn = document.getElementById('refreshBtn');
const selectedRegionName = document.getElementById('selectedRegionName');
const baseTimeText = document.getElementById('baseTimeText');

// 공기 신호등 요소
const trafficLightCard = document.getElementById('trafficLightCard');
const trafficEmoji = document.getElementById('trafficEmoji');
const trafficGradeText = document.getElementById('trafficGradeText');
const trafficAvgValue = document.getElementById('trafficAvgValue');
const trafficAdviceText = document.getElementById('trafficAdviceText');

// Best & Worst 하이라이트 요소
const bestStationName = document.getElementById('bestStationName');
const bestStationValue = document.getElementById('bestStationValue');
const bestStationGrade = document.getElementById('bestStationGrade');
const bestStationDetail = document.getElementById('bestStationDetail');

const worstStationName = document.getElementById('worstStationName');
const worstStationValue = document.getElementById('worstStationValue');
const worstStationGrade = document.getElementById('worstStationGrade');
const worstStationDetail = document.getElementById('worstStationDetail');

// 대기질 분포 요소
const distBarGood = document.getElementById('distBarGood');
const distBarNormal = document.getElementById('distBarNormal');
const distBarBad = document.getElementById('distBarBad');
const distBarVeryBad = document.getElementById('distBarVeryBad');
const countGoodEl = document.getElementById('countGood');
const countNormalEl = document.getElementById('countNormal');
const countBadEl = document.getElementById('countBad');
const countVeryBadEl = document.getElementById('countVeryBad');
const distSummaryText = document.getElementById('distSummaryText');

// 생활 지수 요소
const lifeVentText = document.getElementById('lifeVentText');
const lifeVentDesc = document.getElementById('lifeVentDesc');
const lifeExerciseText = document.getElementById('lifeExerciseText');
const lifeExerciseDesc = document.getElementById('lifeExerciseDesc');
const lifeMaskText = document.getElementById('lifeMaskText');
const lifeMaskDesc = document.getElementById('lifeMaskDesc');
const lifeWashText = document.getElementById('lifeWashText');
const lifeWashDesc = document.getElementById('lifeWashDesc');

// 검색 및 필터 요소
const stationSearchInput = document.getElementById('stationSearchInput');
const filterChips = document.querySelectorAll('.filter-chip');

// 카드 목록 및 상태 메시지
const cardContainer = document.getElementById('cardContainer');
const statusMessageEl = document.getElementById('statusMessage');
const stationCountText = document.getElementById('stationCountText');

// 날짜/시간 포맷 함수: '2026-11-03 13:00' -> '2026년 11월 3일 13시 기준'
function formatKoreanDateTime(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return '시간 정보 없음';
  }
  const regex = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/;
  const match = dateStr.match(regex);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    return `${year}년 ${month}월 ${day}일 ${hour}시 기준`;
  }
  return `${dateStr} 기준`;
}

// 측정값 포맷팅 ('-' 등 결측치 처리)
function formatValue(value, unit = '㎍/㎥') {
  if (!value || value.trim() === '-' || value.trim() === '') {
    return '측정 안 됨';
  }
  return `${value} ${unit}`;
}

// 등급 메타데이터 반환 (색상, 뱃지, 클래스)
function getGradeMeta(grade) {
  if (grade === '1') {
    return {
      code: '1',
      className: 'good',
      cardClass: 'card-grade-good',
      themeClass: 'theme-good',
      text: '좋음',
      emoji: '🔵',
      color: '#2563eb',
      bgColor: 'rgba(37, 99, 235, 0.85)',
      badgeBg: '#2563eb'
    };
  }
  if (grade === '2') {
    return {
      code: '2',
      className: 'normal',
      cardClass: 'card-grade-normal',
      themeClass: 'theme-normal',
      text: '보통',
      emoji: '🟢',
      color: '#16a34a',
      bgColor: 'rgba(22, 163, 74, 0.85)',
      badgeBg: '#16a34a'
    };
  }
  if (grade === '3') {
    return {
      code: '3',
      className: 'bad',
      cardClass: 'card-grade-bad',
      themeClass: 'theme-bad',
      text: '나쁨',
      emoji: '🟠',
      color: '#ea580c',
      bgColor: 'rgba(234, 88, 12, 0.85)',
      badgeBg: '#ea580c'
    };
  }
  if (grade === '4') {
    return {
      code: '4',
      className: 'very-bad',
      cardClass: 'card-grade-very-bad',
      themeClass: 'theme-very-bad',
      text: '매우나쁨',
      emoji: '🔴',
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.85)',
      badgeBg: '#dc2626'
    };
  }
  return {
    code: '0',
    className: 'unknown',
    cardClass: 'card-grade-unknown',
    themeClass: 'theme-neutral',
    text: '정보 없음',
    emoji: '⚪',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.85)',
    badgeBg: '#64748b'
  };
}

// 평균 PM10 기반 신호등 상태 산출
function getTrafficLightState(avg) {
  if (avg === null) {
    return {
      emoji: '⚪',
      gradeText: '측정 불가',
      themeClass: 'theme-neutral',
      adviceText: '유효한 측정 데이터가 부족합니다.'
    };
  }

  const num = parseFloat(avg);
  if (num <= 30) {
    return {
      emoji: '🔵',
      gradeText: '좋음',
      themeClass: 'theme-good',
      adviceText: '공기가 맑고 쾌적해요! 안심하고 야외활동을 즐기세요.'
    };
  }
  if (num <= 80) {
    return {
      emoji: '🟢',
      gradeText: '보통',
      themeClass: 'theme-normal',
      adviceText: '공기 상태가 무난한 날이에요. 일상 활동에 지장 없어요.'
    };
  }
  if (num <= 150) {
    return {
      emoji: '🟠',
      gradeText: '나쁨',
      themeClass: 'theme-bad',
      adviceText: '외출 시 마스크를 챙기세요! 호흡기 건강에 유의하세요.'
    };
  }
  return {
    emoji: '🔴',
    gradeText: '매우나쁨',
    themeClass: 'theme-very-bad',
    adviceText: '외출 시 마스크를 챙기세요! 장시간 야외 활동은 자제하세요.'
  };
}

// 평균 PM10 계산
function calculateAverage(items) {
  const validValues = [];
  items.forEach(function (item) {
    const rawVal = item.pm10Value;
    if (rawVal && rawVal.trim() !== '-' && rawVal.trim() !== '') {
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        validValues.push(num);
      }
    }
  });

  if (validValues.length === 0) return null;

  const sum = validValues.reduce(function (acc, cur) {
    return acc + cur;
  }, 0);

  return (sum / validValues.length).toFixed(1);
}

// 1. 공기 신호등 UI 업데이트
function updateTrafficLightUI(avg, latestTime) {
  const state = getTrafficLightState(avg);
  trafficLightCard.className = `traffic-light-card ${state.themeClass}`;
  trafficEmoji.textContent = state.emoji;
  trafficGradeText.textContent = state.gradeText;
  trafficAvgValue.textContent = avg !== null ? avg : '-';
  trafficAdviceText.textContent = state.adviceText;
  baseTimeText.textContent = formatKoreanDateTime(latestTime);
}

// 2. Best vs Worst 하이라이트 위젯 계산 및 표시
function updateBestAndWorst(items) {
  const validList = [];
  items.forEach(function (item) {
    const rawVal = item.pm10Value;
    if (rawVal && rawVal.trim() !== '-' && rawVal.trim() !== '') {
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        validList.push({
          name: item.stationName,
          pm10: num,
          pm25: item.pm25Value,
          grade: item.pm10Grade
        });
      }
    }
  });

  if (validList.length === 0) {
    bestStationName.textContent = '정보 없음';
    bestStationValue.textContent = '-';
    worstStationName.textContent = '정보 없음';
    worstStationValue.textContent = '-';
    return;
  }

  // 오름차순 정렬 (0번째: 가장 맑은 곳 Best, 마지막: 가장 나쁜 곳 Worst)
  validList.sort(function (a, b) {
    return a.pm10 - b.pm10;
  });

  const best = validList[0];
  const worst = validList[validList.length - 1];

  // Best 카드 렌더링
  const bestMeta = getGradeMeta(best.grade);
  bestStationName.textContent = best.name;
  bestStationValue.textContent = `${best.pm10} ㎍/㎥`;
  bestStationGrade.textContent = bestMeta.text;
  bestStationGrade.style.backgroundColor = bestMeta.badgeBg;
  bestStationDetail.textContent = `초미세먼지(PM2.5): ${formatValue(best.pm25)}`;

  // Worst 카드 렌더링
  const worstMeta = getGradeMeta(worst.grade);
  worstStationName.textContent = worst.name;
  worstStationValue.textContent = `${worst.pm10} ㎍/㎥`;
  worstStationGrade.textContent = worstMeta.text;
  worstStationGrade.style.backgroundColor = worstMeta.badgeBg;
  worstStationDetail.textContent = `초미세먼지(PM2.5): ${formatValue(worst.pm25)}`;
}

// 3. 등급별 분포 비율 바 및 통계 업데이트
function updateDistributionBar(items) {
  let gCount = 0;
  let nCount = 0;
  let bCount = 0;
  let vCount = 0;

  items.forEach(function (item) {
    if (item.pm10Grade === '1') gCount++;
    else if (item.pm10Grade === '2') nCount++;
    else if (item.pm10Grade === '3') bCount++;
    else if (item.pm10Grade === '4') vCount++;
  });

  const total = gCount + nCount + bCount + vCount;

  countGoodEl.textContent = gCount;
  countNormalEl.textContent = nCount;
  countBadEl.textContent = bCount;
  countVeryBadEl.textContent = vCount;

  if (total === 0) {
    distBarGood.style.width = '0%';
    distBarNormal.style.width = '0%';
    distBarBad.style.width = '0%';
    distBarVeryBad.style.width = '0%';
    distSummaryText.textContent = '유효한 등급 데이터가 없습니다.';
    return;
  }

  const gPercent = ((gCount / total) * 100).toFixed(1);
  const nPercent = ((nCount / total) * 100).toFixed(1);
  const bPercent = ((bCount / total) * 100).toFixed(1);
  const vPercent = ((vCount / total) * 100).toFixed(1);

  distBarGood.style.width = `${gPercent}%`;
  distBarNormal.style.width = `${nPercent}%`;
  distBarBad.style.width = `${bPercent}%`;
  distBarVeryBad.style.width = `${vPercent}%`;

  distSummaryText.textContent = `총 ${total}곳 중 쾌적한 지역이 ${(parseFloat(gPercent) + parseFloat(nPercent)).toFixed(0)}%를 차지합니다.`;
}

// 4. 생활 맞춤 행동 지수 업데이트
function updateLifestyleGuide(avg) {
  if (avg === null) {
    lifeVentText.textContent = '확인 불가';
    lifeExerciseText.textContent = '확인 불가';
    lifeMaskText.textContent = '확인 불가';
    lifeWashText.textContent = '확인 불가';
    return;
  }

  const num = parseFloat(avg);

  if (num <= 30) {
    // 좋음
    lifeVentText.textContent = '적극 권장';
    lifeVentText.style.color = '#1d4ed8';
    lifeVentDesc.textContent = '하루 3번 30분 이상';

    lifeExerciseText.textContent = '야외 추천';
    lifeExerciseText.style.color = '#1d4ed8';
    lifeExerciseDesc.textContent = '산책·러닝 모두 OK';

    lifeMaskText.textContent = '불필요';
    lifeMaskText.style.color = '#1d4ed8';
    lifeMaskDesc.textContent = '상쾌한 자연 공기';

    lifeWashText.textContent = '최적기';
    lifeWashText.style.color = '#1d4ed8';
    lifeWashDesc.textContent = '세차 효과 오래 지속';
  } else if (num <= 80) {
    // 보통
    lifeVentText.textContent = '환기 가능';
    lifeVentText.style.color = '#15803d';
    lifeVentDesc.textContent = '자연 환기 10~20분';

    lifeExerciseText.textContent = '보통';
    lifeExerciseText.style.color = '#15803d';
    lifeExerciseDesc.textContent = '가벼운 야외 운동 가능';

    lifeMaskText.textContent = '선택 착용';
    lifeMaskText.style.color = '#15803d';
    lifeMaskDesc.textContent = '민감군은 착용 권장';

    lifeWashText.textContent = '무난함';
    lifeWashText.style.color = '#15803d';
    lifeWashDesc.textContent = '세차하기에 무난해요';
  } else if (num <= 150) {
    // 나쁨
    lifeVentText.textContent = '짧게 환기';
    lifeVentText.style.color = '#c2410c';
    lifeVentDesc.textContent = '공기청정기 가동 필수';

    lifeExerciseText.textContent = '실내 추천';
    lifeExerciseText.style.color = '#c2410c';
    lifeExerciseDesc.textContent = '격한 운동 자제';

    lifeMaskText.textContent = '마스크 필수';
    lifeMaskText.style.color = '#c2410c';
    lifeMaskDesc.textContent = 'KF80 이상 착용';

    lifeWashText.textContent = '미루기';
    lifeWashText.style.color = '#c2410c';
    lifeWashDesc.textContent = '먼지가 금방 쌓여요';
  } else {
    // 매우나쁨
    lifeVentText.textContent = '환기 금지';
    lifeVentText.style.color = '#b91c1c';
    lifeVentDesc.textContent = '창문을 꼭 닫아두세요';

    lifeExerciseText.textContent = '외출 자제';
    lifeExerciseText.style.color = '#b91c1c';
    lifeExerciseDesc.textContent = '실내 휴식 권장';

    lifeMaskText.textContent = 'KF94 필수';
    lifeMaskText.style.color = '#b91c1c';
    lifeMaskDesc.textContent = '외출 시 밀착 착용';

    lifeWashText.textContent = '세차 금지';
    lifeWashText.style.color = '#b91c1c';
    lifeWashDesc.textContent = '비산먼지 오염 주의';
  }
}

// 5. Chart.js 가로 막대그래프 (상위 10개)
function renderDustChart(items) {
  const validStations = [];
  items.forEach(function (item) {
    const rawVal = item.pm10Value;
    if (rawVal && rawVal.trim() !== '-' && rawVal.trim() !== '') {
      const num = parseFloat(rawVal);
      if (!isNaN(num)) {
        validStations.push({
          stationName: item.stationName,
          pm10: num,
          grade: item.pm10Grade
        });
      }
    }
  });

  validStations.sort(function (a, b) {
    return b.pm10 - a.pm10;
  });

  const top10 = validStations.slice(0, 10);

  const labels = top10.map(function (item) {
    return item.stationName;
  });

  const dataValues = top10.map(function (item) {
    return item.pm10;
  });

  const backgroundColors = top10.map(function (item) {
    return getGradeMeta(item.grade).bgColor;
  });

  const borderColors = top10.map(function (item) {
    return getGradeMeta(item.grade).color;
  });

  if (dustChartInstance) {
    dustChartInstance.destroy();
  }

  const ctx = document.getElementById('dustChart').getContext('2d');

  dustChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '미세먼지(PM10) 수치 (㎍/㎥)',
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.raw} ㎍/㎥`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Pretendard' } }
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Pretendard', weight: 'bold' } }
        }
      }
    }
  });
}

// 6. 개별 측정소 카드 생성 (선명한 풀 채움 디자인)
function createStationCard(item) {
  const stationName = item.stationName || '알 수 없음';
  const pm10 = formatValue(item.pm10Value);
  const pm25 = formatValue(item.pm25Value);
  const timeFormatted = formatKoreanDateTime(item.dataTime);
  const gradeMeta = getGradeMeta(item.pm10Grade);

  const card = document.createElement('div');
  card.className = `station-card ${gradeMeta.cardClass}`;

  card.innerHTML = `
    <div class="card-header">
      <h3 class="station-name">${stationName}</h3>
      <span class="grade-badge">${gradeMeta.text}</span>
    </div>
    <div class="card-body">
      <div class="data-row">
        <span class="data-label">미세먼지 (PM10)</span>
        <span class="data-value">${pm10}</span>
      </div>
      <div class="data-row">
        <span class="data-label">초미세먼지 (PM2.5)</span>
        <span class="data-value">${pm25}</span>
      </div>
    </div>
    <div class="card-footer">
      <span>${timeFormatted}</span>
    </div>
  `;

  return card;
}

// 7. 검색어 및 등급 필터에 따른 카드 렌더링
function renderFilteredCards() {
  cardContainer.innerHTML = '';
  const searchKeyword = stationSearchInput.value.trim().toLowerCase();

  const filtered = currentStationsData.filter(function (item) {
    // 1. 검색어 필터링
    const matchSearch = item.stationName && item.stationName.toLowerCase().includes(searchKeyword);
    // 2. 등급 칩 필터링
    const matchGrade = (selectedGradeFilter === 'all') || (item.pm10Grade === selectedGradeFilter);

    return matchSearch && matchGrade;
  });

  stationCountText.textContent = `검색 결과 ${filtered.length}개 / 전체 ${currentStationsData.length}개 측정소`;

  if (filtered.length === 0) {
    statusMessageEl.textContent = '조건에 일치하는 측정소가 없습니다.';
    return;
  }

  statusMessageEl.textContent = '';
  filtered.forEach(function (item) {
    const card = createStationCard(item);
    cardContainer.appendChild(card);
  });
}

// 실시간 대기질 데이터 호출 및 대시보드 전체 갱신 메인 함수
async function fetchAirQualityData(sidoName) {
  cardContainer.innerHTML = '';
  statusMessageEl.textContent = `'${sidoName}' 지역의 실시간 대기 정보를 불러오는 중...`;
  selectedRegionName.textContent = sidoName;
  stationCountText.textContent = '불러오는 중...';

  // 신호등 로딩 상태
  trafficLightCard.className = 'traffic-light-card theme-neutral';
  trafficEmoji.textContent = '⏳';
  trafficGradeText.textContent = '불러오는 중...';
  trafficAvgValue.textContent = '-';
  trafficAdviceText.textContent = '잠시만 기다려주세요. 실시간 대기 정보를 분석하고 있습니다...';
  baseTimeText.textContent = '- 기준';

  try {
    const response = await fetch(`${API_URL}?sido=${encodeURIComponent(sidoName)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '데이터를 불러오지 못했습니다.');
    }

    if (!data.response || !data.response.body || !data.response.body.items) {
      throw new Error('응답 데이터 구조가 올바르지 않습니다.');
    }

    const items = data.response.body.items;
    currentStationsData = items;

    if (items.length === 0) {
      statusMessageEl.textContent = '조회된 측정소 데이터가 없습니다.';
      updateTrafficLightUI(null, '');
      stationCountText.textContent = '0개 측정소';
      if (dustChartInstance) dustChartInstance.destroy();
      return;
    }

    const latestTime = items[0]?.dataTime || '';
    const avg = calculateAverage(items);

    // 1. 공기 신호등 UI 갱신
    updateTrafficLightUI(avg, latestTime);

    // 2. Best vs Worst 갱신
    updateBestAndWorst(items);

    // 3. 등급 분포 바 갱신
    updateDistributionBar(items);

    // 4. 생활 행동 지수 갱신
    updateLifestyleGuide(avg);

    // 5. 차트 렌더링
    renderDustChart(items);

    // 6. 카드 목록 렌더링 (검색 & 필터 적용)
    renderFilteredCards();

  } catch (error) {
    console.error('대기질 데이터 조회 실패:', error);
    statusMessageEl.textContent = `데이터를 가져오는 중 문제가 발생했습니다: ${error.message}`;
    trafficLightCard.className = 'traffic-light-card theme-neutral';
    trafficEmoji.textContent = '⚠️';
    trafficGradeText.textContent = '오류 발생';
    trafficAvgValue.textContent = '!';
    trafficAdviceText.textContent = error.message;
  }
}

// ===================================================
// 이벤트 리스너 등록
// ===================================================

// 시도 변경 시
sidoSelect.addEventListener('change', function (event) {
  stationSearchInput.value = '';
  selectedGradeFilter = 'all';
  filterChips.forEach(function (chip) {
    chip.classList.toggle('active', chip.dataset.grade === 'all');
  });
  fetchAirQualityData(event.target.value);
});

// 새로고침 버튼 클릭 시
refreshBtn.addEventListener('click', function () {
  refreshBtn.classList.add('rotating');
  fetchAirQualityData(sidoSelect.value).finally(function () {
    setTimeout(function () {
      refreshBtn.classList.remove('rotating');
    }, 600);
  });
});

// 검색어 입력 시 실시간 필터링
stationSearchInput.addEventListener('input', function () {
  renderFilteredCards();
});

// 등급 필터 칩 클릭 시
filterChips.forEach(function (chip) {
  chip.addEventListener('click', function () {
    filterChips.forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    selectedGradeFilter = chip.dataset.grade;
    renderFilteredCards();
  });
});

// 페이지 초기 로드
window.addEventListener('DOMContentLoaded', function () {
  fetchAirQualityData(sidoSelect.value);
});
