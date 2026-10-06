/**
 * 대진전자통신고등학교 학사일정 및 행사 알리미 (app.js)
 * 
 * 주요 기능:
 * 1. NEIS 오픈 API 실시간 연동 (기본: 대진전자통신고 C10, 7150597)
 * 2. 인터랙티브 월간/주간 캘린더 렌더링 & 카테고리/학년 필터
 * 3. 행사 상세 설명 모달 & 맥락 가이드 (NEIS EVENT_CNTNT 보강)
 * 4. 주요 일정 D-Day 카운트다운 & 사용자 맞춤 D-Day 추가/북마크
 * 5. 학생 인기/기대 행사(축제, 방학, 시험, 수능, 체육대회) 하이라이트
 * 6. 브라우저 Web Notification 기반 맞춤형 시간 일일 브리핑 알림
 * 7. 타 학교 검색 및 즉시 전환 조회
 */

// Global State
const state = {
  school: {
    officeCode: 'C10',
    officeName: '부산광역시교육청',
    schoolCode: '7150597',
    schoolName: '대진전자통신고등학교',
    address: '부산광역시 금정구 수림로 92'
  },
  currentYear: 2026,
  currentMonth: 10, // 1-indexed (2026년 10월)
  currentDay: 6,
  selectedDate: '2026-10-06',
  viewMode: 'month', // 'month' | 'week'
  filterCategory: 'all', // 'all' | 'exam' | 'vacation' | 'festival' | 'holiday' | 'regular'
  filterGrade: 'all', // 'all' | '1' | '2' | '3'
  events: [], // Array of event objects
  bookmarkedEvents: JSON.parse(localStorage.getItem('dj_bookmarks') || '[]'),
  customDdays: JSON.parse(localStorage.getItem('dj_custom_ddays') || '[]'),
  notifConfig: JSON.parse(localStorage.getItem('dj_notif_config') || JSON.stringify({
    enabled: true,
    time: '08:00',
    lastNotifiedDate: ''
  })),
  currentModalEvent: null,
  cachedMonths: new Set()
};

// Curated Event Descriptions & Context database for school events
const EVENT_KNOWLEDGE_BASE = {
  '중간고사': {
    category: 'exam',
    desc: '학기 중 학습 성취도를 점검하는 정기 지필평가입니다. 학년별 시간표 및 고사실 배치를 사전에 반드시 확인하세요.',
    tip: '시험 10분 전 입실 완료, 신분증 및 컴퓨터용 수성 사인펜과 수정테이프를 지참하세요.'
  },
  '기말고사': {
    category: 'exam',
    desc: '학기말 종합 평가 지필고사입니다. 학기말 성적 반영 비중이 높으므로 취약 과목 복습에 집중하세요.',
    tip: '시험 범위 요약 노트와 오답 노트를 마지막으로 점검하세요.'
  },
  '2학기고사': {
    category: 'exam',
    desc: '3학년 졸업 전 마지막 학기말 성적 산출을 위한 정기 지필평가입니다.',
    tip: '대입 수시 및 취업 포트폴리오 마감과 병행되므로 일정 관리가 중요합니다.'
  },
  '영어듣기평가': {
    category: 'exam',
    desc: '전국 시·도교육청 공동주관 영어듣기능력평가입니다. 방송 상태와 문제지를 사전에 점검합니다.',
    tip: '방송 청취 중 집중력을 유지하고 정답 마킹을 정확히 하세요.'
  },
  '축제': {
    category: 'festival',
    desc: '대진전자통신고등학교의 자랑, 대진 솔빛 축제! 학생 동아리 발표회, e스포츠 대회, 무대 공연, 체험 부스가 성대하게 열립니다.',
    tip: '다양한 전공 동아리 부스 체험과 밴드/댄스 공연을 함께 즐겨보세요!'
  },
  '체육대회': {
    category: 'festival',
    desc: '전교생과 교직원이 하나 되는 열정의 대진 한마음 체육한마당입니다. 반별 축구, 농구, 계주, 줄다리기 경기가 진행됩니다.',
    tip: '충분한 수분 섭취와 준비운동으로 안전사고에 유의하세요!'
  },
  '수학여행': {
    category: 'festival',
    desc: '친구들과 잊지 못할 추억을 만드는 현장체험학습(수학여행)입니다.',
    tip: '모둠별 지정 집결 시간 준수 및 개인 안전 수칙을 철저히 지킵니다.'
  },
  '여름방학식': {
    category: 'vacation',
    desc: '1학기 교육과정을 마무리하고 알찬 자기계발과 휴식을 위한 여름방학의 시작일입니다.',
    tip: '방학 중 전공 자격증 취득 및 2학기 예습 계획을 세워보세요.'
  },
  '겨울방학식': {
    category: 'vacation',
    desc: '한 해의 학사일정을 마무리하는 겨울방학식입니다. 방학 중 동계 방과후학교 및 전공 실습이 병행됩니다.',
    tip: '추운 겨울 건강 관리에 유의하고 다음 학년 준비를 시작하세요.'
  },
  '입학식': {
    category: 'festival',
    desc: '새로운 대진인들의 출발을 축하하는 신입생 입학식입니다. 대진전자통신고등학교 가족이 되신 것을 환영합니다!',
    tip: '학교 생활 규정과 전공 학과별 오리엔테이션 내용을 꼼꼼히 확인하세요.'
  },
  '개학식': {
    category: 'regular',
    desc: '새 학기 학사 일정이 본격적으로 시작되는 개학식입니다.',
    tip: '새 학기 교과서 배부 및 학급 자치회 구성이 진행됩니다.'
  },
  '졸업식': {
    category: 'festival',
    desc: '정든 학교를 떠나 더 큰 사회와 대학으로 힘차게 도약하는 졸업생들을 축하하는 졸업식입니다.',
    tip: '선생님과 친구들에게 감사의 마음을 전하는 소중한 날입니다.'
  },
  '수능': {
    category: 'exam',
    desc: '대학수학능력시험일입니다. 수험생들을 위해 학교 전체가 응원하며, 재학생은 휴업일 또는 재량휴업이 적용됩니다.',
    tip: '대진 수험생 여러분의 멋진 도전을 응원합니다!'
  }
};

// Curated high-impact highlight seed events for Daejin High School 2026
const CURATED_HIGHLIGHTS_2026 = [
  {
    name: '2학기 중간고사 (1·2학년)',
    date: '2026-10-20',
    category: 'exam',
    icon: '📝',
    desc: '2학기 성적의 핵심! 지필평가 기간입니다.'
  },
  {
    name: '대진 솔빛 축제 & 학예제',
    date: '2026-11-06',
    category: 'festival',
    icon: '🎉',
    desc: '동아리 부스, e스포츠 결승, 밴드 공연'
  },
  {
    name: '대학수학능력시험 (수능일)',
    date: '2026-11-19',
    category: 'exam',
    icon: '🎯',
    desc: '수험생 선배 응원 및 재량휴업일'
  },
  {
    name: '2학기 기말고사',
    date: '2026-12-14',
    category: 'exam',
    icon: '📊',
    desc: '학년 마무리 종합 지필평가'
  },
  {
    name: '겨울방학식 & 종업식',
    date: '2027-01-08',
    category: 'vacation',
    icon: '❄️',
    desc: '겨울방학 시작 및 새 학년 준비 기간'
  }
];

// Helper: Determine Event Category & Enrichment
function categorizeEvent(eventName, rawContent, deductType) {
  const name = eventName || '';
  for (const [key, val] of Object.entries(EVENT_KNOWLEDGE_BASE)) {
    if (name.includes(key)) {
      return {
        category: val.category,
        desc: rawContent && rawContent.trim() ? rawContent : val.desc,
        tip: val.tip
      };
    }
  }

  // Fallbacks by keywords
  if (name.includes('고사') || name.includes('시험') || name.includes('평가') || name.includes('능력')) {
    return {
      category: 'exam',
      desc: rawContent && rawContent.trim() ? rawContent : '학습 성취도 평가를 위한 공식 시험 일정입니다.',
      tip: '시험 일정과 과목별 준비물을 점검하세요.'
    };
  }
  if (name.includes('방학') || name.includes('휴업') || name.includes('개학')) {
    return {
      category: 'vacation',
      desc: rawContent && rawContent.trim() ? rawContent : '방학 및 학기 전환 관련 공식 학사일정입니다.',
      tip: '일정을 미리 확인하여 방학 계획을 수립하세요.'
    };
  }
  if (name.includes('축제') || name.includes('체육') || name.includes('대회') || name.includes('수련') || name.includes('입학식') || name.includes('졸업식')) {
    return {
      category: 'festival',
      desc: rawContent && rawContent.trim() ? rawContent : '학생과 교직원이 함께하는 교내 행사입니다.',
      tip: '학급 및 동아리와 함께 즐거운 추억을 만드세요.'
    };
  }
  if (deductType === '공휴일' || name.includes('절') || name.includes('날') || name.includes('공휴일')) {
    return {
      category: 'holiday',
      desc: rawContent && rawContent.trim() ? rawContent : '법정 공휴일 또는 국가 지정 휴일입니다.',
      tip: '가족과 함께 의미 있는 시간을 보내세요.'
    };
  }
  return {
    category: 'regular',
    desc: rawContent && rawContent.trim() ? rawContent : '대진전자통신고등학교 정규 학사일정입니다.',
    tip: '학사일정에 맞춰 수업 준비를 진행하세요.'
  };
}

// Helper: Format Date YYYYMMDD -> YYYY-MM-DD
function parseYmd(ymdStr) {
  if (!ymdStr || ymdStr.length !== 8) return ymdStr;
  return `${ymdStr.substring(0, 4)}-${ymdStr.substring(4, 6)}-${ymdStr.substring(6, 8)}`;
}

// Helper: Calculate D-Day
function calculateDDay(targetDateStr) {
  const today = new Date(2026, 9, 6); // Mocked / PRD base date: 2026-10-06
  const target = new Date(targetDateStr);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'D-Day', value: 0, class: 'today' };
  if (diffDays > 0) return { text: `D-${diffDays}`, value: diffDays, class: diffDays <= 7 ? 'urgent' : 'upcoming' };
  return { text: `D+${Math.abs(diffDays)}`, value: diffDays, class: 'past' };
}

// Helper: Toast Message
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Helper: Get target grade string
function getGradeString(ev) {
  const g1 = ev.ONE_GRADE_EVENT_YN === 'Y';
  const g2 = ev.TW_GRADE_EVENT_YN === 'Y';
  const g3 = ev.THREE_GRADE_EVENT_YN === 'Y';
  if (g1 && g2 && g3) return '전체 학년';
  const grades = [];
  if (g1) grades.push('1학년');
  if (g2) grades.push('2학년');
  if (g3) grades.push('3학년');
  return grades.length > 0 ? grades.join(', ') : '해당없음';
}

/* ==========================================================================
   NEIS Open API Fetcher
   ========================================================================== */
async function fetchNeisMonthSchedule(year, month) {
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const cacheKey = `${yyyy}-${mm}`;

  if (state.cachedMonths.has(cacheKey)) {
    return;
  }

  const lastDay = new Date(year, month, 0).getDate();
  const fromYmd = `${yyyy}${mm}01`;
  const toYmd = `${yyyy}${mm}${String(lastDay).padStart(2, '0')}`;

  const apiUrl = `https://open.neis.go.kr/hub/SchoolSchedule?Type=json&ATPT_OFCDC_SC_CODE=${state.school.officeCode}&SD_SCHUL_CODE=${state.school.schoolCode}&AA_FROM_YMD=${fromYmd}&AA_TO_YMD=${toYmd}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('네트워크 응답 오류');
    const data = await res.json();

    if (data.SchoolSchedule && data.SchoolSchedule[1] && data.SchoolSchedule[1].row) {
      const rows = data.SchoolSchedule[1].row;
      rows.forEach(row => {
        // Exclude generic saturday offs if preferred, or keep as holiday
        const dateStr = parseYmd(row.AA_YMD);
        const enriched = categorizeEvent(row.EVENT_NM, row.EVENT_CNTNT, row.SBTR_DD_SC_NM);
        
        // Avoid duplicate push
        const exists = state.events.some(e => e.date === dateStr && e.title === row.EVENT_NM);
        if (!exists) {
          state.events.push({
            id: `${row.AA_YMD}_${row.EVENT_NM}_${Math.random().toString(36).substr(2, 4)}`,
            date: dateStr,
            title: row.EVENT_NM,
            category: enriched.category,
            content: enriched.desc,
            tip: enriched.tip,
            deduct: row.SBTR_DD_SC_NM || '해당없음',
            gradeStr: getGradeString(row),
            ONE_GRADE_EVENT_YN: row.ONE_GRADE_EVENT_YN,
            TW_GRADE_EVENT_YN: row.TW_GRADE_EVENT_YN,
            THREE_GRADE_EVENT_YN: row.THREE_GRADE_EVENT_YN,
            isNeis: true
          });
        }
      });
      state.cachedMonths.add(cacheKey);
      document.getElementById('syncStatusPill').className = 'status-pill online';
      document.getElementById('syncStatusPill').innerHTML = '<span class="pulse-dot"></span> NEIS 실시간 연동';
    } else {
      state.cachedMonths.add(cacheKey);
    }
  } catch (err) {
    console.warn(`NEIS fetch error for ${year}-${month}:`, err);
    document.getElementById('syncStatusPill').className = 'status-pill';
    document.getElementById('syncStatusPill').innerHTML = '⚠️ 로컬 캐시 모드';
  }
}

// Initial Batch Fetch for surrounding months (2026 Autumn & Winter)
async function initScheduleData() {
  // Inject Curated Highlight Events into events state as fallback / rich events
  CURATED_HIGHLIGHTS_2026.forEach(h => {
    const exists = state.events.some(e => e.date === h.date && e.title === h.name);
    if (!exists) {
      state.events.push({
        id: `curated_${h.date}_${h.name}`,
        date: h.date,
        title: h.name,
        category: h.category,
        content: h.desc,
        tip: '대진전자통신고 공식 추천 학사 행사입니다.',
        deduct: '해당없음',
        gradeStr: '전체 학년',
        ONE_GRADE_EVENT_YN: 'Y',
        TW_GRADE_EVENT_YN: 'Y',
        THREE_GRADE_EVENT_YN: 'Y',
        isHighlight: true
      });
    }
  });

  // Pre-fetch Oct, Nov, Dec 2026
  await fetchNeisMonthSchedule(2026, 10);
  await fetchNeisMonthSchedule(2026, 11);
  await fetchNeisMonthSchedule(2026, 12);
  await fetchNeisMonthSchedule(2027, 1);

  renderAll();
  updateLiveBriefingBanner();
  setupScheduler();
}

/* ==========================================================================
   Calendar Rendering Logic
   ========================================================================== */
function renderAll() {
  updatePeriodHeader();
  if (state.viewMode === 'month') {
    renderMonthView();
  } else {
    renderWeekView();
  }
  renderDDaySidebar();
  renderHighlightsSidebar();
  renderSelectedDayEvents(state.selectedDate);
}

function updatePeriodHeader() {
  const lbl = document.getElementById('currentPeriodLabel');
  if (state.viewMode === 'month') {
    lbl.textContent = `${state.currentYear}년 ${state.currentMonth}월`;
  } else {
    lbl.textContent = `${state.currentYear}년 ${state.currentMonth}월 (주간)`;
  }
}

function filterEventPass(event) {
  // Category filter
  if (state.filterCategory !== 'all') {
    if (event.category !== state.filterCategory) return false;
  }
  // Grade filter
  if (state.filterGrade !== 'all') {
    if (state.filterGrade === '1' && event.ONE_GRADE_EVENT_YN !== 'Y') return false;
    if (state.filterGrade === '2' && event.TW_GRADE_EVENT_YN !== 'Y') return false;
    if (state.filterGrade === '3' && event.THREE_GRADE_EVENT_YN !== 'Y') return false;
  }
  // Filter out excessive "토요휴업일" unless filter is holiday
  if (event.title === '토요휴업일' && state.filterCategory !== 'holiday') {
    return false;
  }
  return true;
}

// Render Month View
function renderMonthView() {
  const container = document.getElementById('calendarContainer');
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  // Weekday Headers
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  weekdays.forEach((day, idx) => {
    const header = document.createElement('div');
    header.className = `cal-weekday ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}`;
    header.textContent = day;
    grid.appendChild(header);
  });

  const year = state.currentYear;
  const month = state.currentMonth;

  // First day of current month (0: Sun, 1: Mon...)
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  // Total days in current month
  const totalDays = new Date(year, month, 0).getDate();
  // Total days in previous month
  const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

  // Prev month padding cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const cell = createDayCell(year, month - 1, dayNum, true);
    grid.appendChild(cell);
  }

  // Current month cells
  for (let day = 1; day <= totalDays; day++) {
    const cell = createDayCell(year, month, day, false);
    grid.appendChild(cell);
  }

  // Next month padding cells (fill up to multiple of 7, up to 35 or 42 cells)
  const currentTotalCells = firstDayIndex + totalDays;
  const nextMonthCells = (currentTotalCells % 7 === 0) ? 0 : 7 - (currentTotalCells % 7);
  for (let day = 1; day <= nextMonthCells; day++) {
    const cell = createDayCell(year, month + 1, day, true);
    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

function createDayCell(y, m, d, isOtherMonth) {
  // Normalize year & month
  let actualYear = y;
  let actualMonth = m;
  if (m === 0) {
    actualYear--;
    actualMonth = 12;
  } else if (m === 13) {
    actualYear++;
    actualMonth = 1;
  }

  const dateStr = `${actualYear}-${String(actualMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayOfWeek = new Date(actualYear, actualMonth - 1, d).getDay();

  const cell = document.createElement('div');
  cell.className = 'cal-day-cell';
  if (isOtherMonth) cell.classList.add('other-month');
  if (dateStr === '2026-10-06') cell.classList.add('today');
  if (dateStr === state.selectedDate) cell.classList.add('selected');

  // Day Header (number & star badge if bookmarked)
  const header = document.createElement('div');
  header.className = 'day-header';

  const numSpan = document.createElement('span');
  numSpan.className = `day-num ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`;
  numSpan.textContent = d;
  header.appendChild(numSpan);

  const isBookmarked = state.bookmarkedEvents.some(b => b.date === dateStr);
  if (isBookmarked) {
    const badgeDiv = document.createElement('div');
    badgeDiv.className = 'day-badges';
    badgeDiv.innerHTML = '<span class="star-badge" title="중요 북마크 일정">⭐</span>';
    header.appendChild(badgeDiv);
  }

  cell.appendChild(header);

  // Events Container
  const eventsDiv = document.createElement('div');
  eventsDiv.className = 'day-events-container';

  const dayEvents = state.events.filter(e => e.date === dateStr && filterEventPass(e));

  // Render up to 3 chips, show "+N" if more
  const maxDisplay = 3;
  dayEvents.slice(0, maxDisplay).forEach(ev => {
    const chip = document.createElement('div');
    chip.className = `event-chip cat-${ev.category}`;
    chip.textContent = ev.title;
    chip.title = `${ev.title} (${ev.gradeStr})`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      openEventDetailModal(ev);
    });
    eventsDiv.appendChild(chip);
  });

  if (dayEvents.length > maxDisplay) {
    const moreTag = document.createElement('div');
    moreTag.className = 'more-events-tag';
    moreTag.textContent = `+${dayEvents.length - maxDisplay}개 더보기`;
    eventsDiv.appendChild(moreTag);
  }

  cell.appendChild(eventsDiv);

  // Cell click -> select day
  cell.addEventListener('click', () => {
    document.querySelectorAll('.cal-day-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    state.selectedDate = dateStr;
    renderSelectedDayEvents(dateStr);
  });

  return cell;
}

// Render Week View
function renderWeekView() {
  const container = document.getElementById('calendarContainer');
  container.innerHTML = '';

  const weekGrid = document.createElement('div');
  weekGrid.className = 'week-grid';

  // Determine the 7 days of the currently selected date's week
  const curr = new Date(state.selectedDate);
  const day = curr.getDay(); // 0 is Sun
  const firstDayOfWeek = new Date(curr);
  firstDayOfWeek.setDate(curr.getDate() - day);

  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  for (let i = 0; i < 7; i++) {
    const dateIter = new Date(firstDayOfWeek);
    dateIter.setDate(firstDayOfWeek.getDate() + i);

    const y = dateIter.getFullYear();
    const m = dateIter.getMonth() + 1;
    const d = dateIter.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const col = document.createElement('div');
    col.className = 'week-day-col';
    if (dateStr === '2026-10-06') col.classList.add('today');

    const colHeader = document.createElement('div');
    colHeader.className = 'week-day-header';
    colHeader.innerHTML = `
      <div class="week-day-name ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${weekdays[i]}</div>
      <div class="week-day-date">${m}.${d}</div>
    `;
    col.appendChild(colHeader);

    const eventsList = document.createElement('div');
    eventsList.className = 'week-day-events';

    const dayEvents = state.events.filter(e => e.date === dateStr && filterEventPass(e));
    if (dayEvents.length === 0) {
      eventsList.innerHTML = '<span class="placeholder-text" style="font-size:0.75rem; padding:12px 0;">일정 없음</span>';
    } else {
      dayEvents.forEach(ev => {
        const card = document.createElement('div');
        card.className = `week-event-card cat-${ev.category}`;
        card.innerHTML = `
          <strong>${ev.title}</strong>
          <div style="font-size:0.7rem; opacity:0.85; margin-top:2px;">${ev.gradeStr}</div>
        `;
        card.addEventListener('click', () => openEventDetailModal(ev));
        eventsList.appendChild(card);
      });
    }

    col.appendChild(eventsList);
    weekGrid.appendChild(col);
  }

  container.appendChild(weekGrid);
}

/* ==========================================================================
   Sidebar: D-Day & Highlights
   ========================================================================== */
function renderDDaySidebar() {
  const container = document.getElementById('ddayList');
  container.innerHTML = '';

  // Combine bookmarked events, custom D-days, and core academic milestones
  const allDdayItems = [];

  // Core Exam & Milestone Fallbacks
  const milestones = [
    { title: '2학기 중간고사', date: '2026-10-20', category: 'exam' },
    { title: '대진 솔빛 축제', date: '2026-11-06', category: 'festival' },
    { title: '대학수학능력시험(수능)', date: '2026-11-19', category: 'exam' },
    { title: '2학기 기말고사', date: '2026-12-14', category: 'exam' },
    { title: '겨울방학식', date: '2027-01-08', category: 'vacation' }
  ];

  milestones.forEach(m => {
    allDdayItems.push(m);
  });

  // Add bookmarks
  state.bookmarkedEvents.forEach(b => {
    if (!allDdayItems.some(x => x.title === b.title && x.date === b.date)) {
      allDdayItems.push({ title: `⭐ ${b.title}`, date: b.date, category: b.category });
    }
  });

  // Add custom ddays
  state.customDdays.forEach(c => {
    allDdayItems.push({ title: `📌 ${c.title}`, date: c.date, category: c.category });
  });

  // Sort by upcoming date
  allDdayItems.sort((a, b) => new Date(a.date) - new Date(b.date));

  allDdayItems.slice(0, 6).forEach(item => {
    const dday = calculateDDay(item.date);
    const div = document.createElement('div');
    div.className = 'dday-item';
    div.innerHTML = `
      <div class="dday-info">
        <span class="dday-title">${item.title}</span>
        <span class="dday-date">${item.date}</span>
      </div>
      <div class="dday-badge ${dday.class}">${dday.text}</div>
    `;
    div.addEventListener('click', () => {
      // Find event if exists or create dummy
      const match = state.events.find(e => e.date === item.date) || {
        title: item.title,
        date: item.date,
        category: item.category,
        content: '주요 D-Day 등록 일정입니다.',
        gradeStr: '전체',
        deduct: '해당없음'
      };
      openEventDetailModal(match);
    });
    container.appendChild(div);
  });
}

function renderHighlightsSidebar() {
  const container = document.getElementById('highlightList');
  container.innerHTML = '';

  CURATED_HIGHLIGHTS_2026.forEach(item => {
    const dday = calculateDDay(item.date);
    const div = document.createElement('div');
    div.className = 'highlight-item';
    div.innerHTML = `
      <div class="highlight-icon-box">${item.icon}</div>
      <div class="highlight-details">
        <div class="highlight-name">${item.name}</div>
        <div class="highlight-meta">${item.date} · <strong>${dday.text}</strong></div>
      </div>
    `;
    div.addEventListener('click', () => {
      openEventDetailModal({
        title: item.name,
        date: item.date,
        category: item.category,
        content: item.desc,
        tip: '대진전자통신고 학생 인기 행사 하이라이트입니다.',
        gradeStr: '전체 학년',
        deduct: '해당없음'
      });
    });
    container.appendChild(div);
  });
}

function renderSelectedDayEvents(dateStr) {
  const title = document.getElementById('selectedDateTitle');
  const container = document.getElementById('selectedDayEvents');
  title.textContent = `${dateStr} 일정`;
  container.innerHTML = '';

  const dayEvents = state.events.filter(e => e.date === dateStr);

  if (dayEvents.length === 0) {
    container.innerHTML = '<p class="placeholder-text">해당 날짜에 등록된 공식 학사일정이 없습니다.</p>';
    return;
  }

  dayEvents.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'day-event-detail-item';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong style="color:#fff; font-size:0.92rem;">${ev.title}</strong>
        <span class="cat-pill active" style="font-size:0.7rem; padding:2px 8px;">${ev.gradeStr}</span>
      </div>
      <p style="font-size:0.8rem; color:#94a3b8; line-height:1.4;">${ev.content || '세부 설명 정보가 없습니다.'}</p>
    `;
    item.addEventListener('click', () => openEventDetailModal(ev));
    container.appendChild(item);
  });
}

/* ==========================================================================
   Modals & Interaction
   ========================================================================== */
function openEventDetailModal(ev) {
  state.currentModalEvent = ev;
  const modal = document.getElementById('eventDetailModal');

  document.getElementById('modalEventCategoryBadge').textContent = 
    ev.category === 'exam' ? '시험 / 지필평가' :
    ev.category === 'vacation' ? '방학 / 학기전환' :
    ev.category === 'festival' ? '교내 축제 / 행사' :
    ev.category === 'holiday' ? '공휴일 / 휴업' : '정규 학사일정';

  document.getElementById('modalEventDate').textContent = `${ev.date}`;
  document.getElementById('modalEventTitle').textContent = ev.title;
  document.getElementById('modalEventTargetGrade').textContent = ev.gradeStr || '전체 학년';
  document.getElementById('modalEventDeduct').textContent = ev.deduct || '해당없음';

  const dday = calculateDDay(ev.date);
  document.getElementById('modalEventDDay').textContent = dday.text;

  document.getElementById('modalEventContent').textContent = ev.content || '등록된 추가 설명이 없습니다.';
  
  const tipsBox = document.getElementById('modalEventTips');
  if (ev.tip) {
    tipsBox.style.display = 'block';
    tipsBox.innerHTML = `<strong>💡 대진 꿀팁 & 안내:</strong> ${ev.tip}`;
  } else {
    tipsBox.style.display = 'none';
  }

  // Check bookmark status
  const isBookmarked = state.bookmarkedEvents.some(b => b.title === ev.title && b.date === ev.date);
  document.getElementById('bookmarkIcon').textContent = isBookmarked ? '⭐' : '☆';
  document.getElementById('btnToggleBookmark').innerHTML = `<span id="bookmarkIcon">${isBookmarked ? '⭐' : '☆'}</span> ${isBookmarked ? 'D-Day 고정 해제' : '중요 일정(D-Day)에 고정'}`;

  modal.style.display = 'flex';
}

function closeEventDetailModal() {
  document.getElementById('eventDetailModal').style.display = 'none';
}

function toggleBookmarkCurrentEvent() {
  if (!state.currentModalEvent) return;
  const ev = state.currentModalEvent;
  const idx = state.bookmarkedEvents.findIndex(b => b.title === ev.title && b.date === ev.date);

  if (idx >= 0) {
    state.bookmarkedEvents.splice(idx, 1);
    showToast(`'${ev.title}' D-Day 고정이 해제되었습니다.`, 'info');
  } else {
    state.bookmarkedEvents.push({
      title: ev.title,
      date: ev.date,
      category: ev.category
    });
    showToast(`'${ev.title}' 일정이 D-Day에 고정되었습니다!`, 'success');
  }
  localStorage.setItem('dj_bookmarks', JSON.stringify(state.bookmarkedEvents));
  renderAll();
  closeEventDetailModal();
}

/* ==========================================================================
   Today's Briefing & Web Notification Service
   ========================================================================== */
function updateLiveBriefingBanner() {
  const bannerContent = document.getElementById('bannerContent');
  const bannerDate = document.getElementById('bannerTodayDate');

  const todayStr = '2026-10-06';
  bannerDate.textContent = '2026년 10월 6일 (화)';

  const todayEvents = state.events.filter(e => e.date === todayStr);

  if (todayEvents.length === 0) {
    // If no events today, show upcoming D-Day preview
    const nextExamDday = calculateDDay('2026-10-20');
    bannerContent.innerHTML = `
      오늘은 예정된 특별 학사일정이 없습니다. 정규 수업이 진행됩니다. 
      <strong>(다음 주요 일정: 중간고사 ${nextExamDday.text})</strong>
    `;
  } else {
    const titles = todayEvents.map(e => e.title).join(', ');
    bannerContent.innerHTML = `
      좋은 아침입니다! 오늘 ${state.school.schoolName}의 학사일정: 
      <strong>${titles}</strong> 이(가) 예정되어 있습니다.
    `;
  }

  // Update preview text in modal
  const preview = document.getElementById('notifPreviewText');
  preview.textContent = `"좋은 아침입니다! 오늘은 ${state.school.schoolName}의 2026년 10월 6일이며, 중간고사 D-14 및 정규 학사일정이 진행됩니다."`;
}

function triggerBriefingNotification(isManualTest = false) {
  const title = `[${state.school.schoolName}] 오늘의 학사 브리핑`;
  const body = `좋은 아침입니다! 2026년 10월 6일 일정 브리핑: 2학기 중간고사 D-14, 대진 솔빛 축제 D-31 남았습니다. 오늘도 힘찬 하루 되세요!`;

  if (!("Notification" in window)) {
    showToast(`브라우저가 시스템 알림을 지원하지 않아 화면 토스트로 표시합니다:\n${body}`, 'info');
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: 'favicon.ico'
    });
    showToast('📢 일일 학사 브리핑 알림이 성공적으로 전송되었습니다!', 'success');
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body: body });
        showToast('알림 권한이 허용되었습니다. 브리핑이 발송되었습니다.', 'success');
      } else {
        showToast('알림 권한이 거부되어 토스트로 표시합니다.', 'warning');
      }
    });
  } else {
    showToast('알림 권한이 차단되어 있습니다. 브라우저 설정에서 권한을 허용해 주세요.', 'warning');
  }
}

// Background Time Scheduler for Daily Briefing
function setupScheduler() {
  const updateIndicator = () => {
    const indicator = document.getElementById('notifActiveIndicator');
    indicator.style.display = state.notifConfig.enabled ? 'inline-block' : 'none';
  };
  updateIndicator();

  // Check every 30 seconds
  setInterval(() => {
    if (!state.notifConfig.enabled) return;
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;

    const todayDateStr = now.toISOString().slice(0, 10);

    if (currentTimeStr === state.notifConfig.time && state.notifConfig.lastNotifiedDate !== todayDateStr) {
      triggerBriefingNotification(false);
      state.notifConfig.lastNotifiedDate = todayDateStr;
      localStorage.setItem('dj_notif_config', JSON.stringify(state.notifConfig));
    }
  }, 30000);
}

/* ==========================================================================
   Other School Search & Sync (4.1 타 학교 코드 조회)
   ========================================================================== */
async function searchSchools(keyword) {
  const listContainer = document.getElementById('schoolResultList');
  listContainer.innerHTML = '<p class="placeholder-text">전국 학교 정보를 조회 중입니다...</p>';

  if (!keyword || keyword.trim().length < 2) {
    listContainer.innerHTML = '<p class="placeholder-text">학교명을 2자 이상 입력해주세요.</p>';
    return;
  }

  const encoded = encodeURIComponent(keyword.trim());
  const url = `https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=${encoded}&pSize=20`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
      listContainer.innerHTML = '';
      data.schoolInfo[1].row.forEach(school => {
        const item = document.createElement('div');
        item.className = 'school-item';
        item.innerHTML = `
          <div>
            <div class="school-item-name">${school.SCHUL_NM}</div>
            <div class="school-item-meta">${school.ATPT_OFCDC_SC_NM} · 코드: ${school.SD_SCHUL_CODE} · ${school.ORG_RDNMA || ''}</div>
          </div>
          <button class="btn btn-xs btn-primary">선택</button>
        `;
        item.addEventListener('click', () => {
          selectSchool(school.ATPT_OFCDC_SC_CODE, school.ATPT_OFCDC_SC_NM, school.SD_SCHUL_CODE, school.SCHUL_NM, school.ORG_RDNMA);
        });
        listContainer.appendChild(item);
      });
    } else {
      listContainer.innerHTML = '<p class="placeholder-text">검색 결과가 없습니다.</p>';
    }
  } catch (err) {
    listContainer.innerHTML = '<p class="placeholder-text">학교 검색 중 오류가 발생했습니다.</p>';
  }
}

async function selectSchool(officeCode, officeName, schoolCode, schoolName, address) {
  state.school = {
    officeCode,
    officeName,
    schoolCode,
    schoolName,
    address
  };
  state.events = [];
  state.cachedMonths.clear();

  document.getElementById('currentSchoolName').textContent = schoolName;
  document.getElementById('currentSchoolSub').textContent = `${officeName} · 코드 ${schoolCode} · 학사일정 & 행사 알리미`;
  document.getElementById('schoolSearchModal').style.display = 'none';

  showToast(`${schoolName}(으)로 변경되었습니다. 최신 학사일정을 동기화합니다.`, 'success');
  await initScheduleData();
}

/* ==========================================================================
   Event Listeners & Bootstrapping
   ========================================================================== */
function setupEventListeners() {
  // Navigation
  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    if (state.currentMonth === 1) {
      state.currentYear--;
      state.currentMonth = 12;
    } else {
      state.currentMonth--;
    }
    fetchNeisMonthSchedule(state.currentYear, state.currentMonth).then(renderAll);
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    if (state.currentMonth === 12) {
      state.currentYear++;
      state.currentMonth = 1;
    } else {
      state.currentMonth++;
    }
    fetchNeisMonthSchedule(state.currentYear, state.currentMonth).then(renderAll);
  });

  document.getElementById('btnGoToday').addEventListener('click', () => {
    state.currentYear = 2026;
    state.currentMonth = 10;
    state.selectedDate = '2026-10-06';
    renderAll();
  });

  // View Mode Segments (Month / Week)
  document.getElementById('viewModeMonth').addEventListener('click', (e) => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.viewMode = 'month';
    renderAll();
  });

  document.getElementById('viewModeWeek').addEventListener('click', (e) => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    state.viewMode = 'week';
    renderAll();
  });

  // Category Pills
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterCategory = btn.dataset.cat;
      renderAll();
    });
  });

  // Grade Filter
  document.getElementById('gradeFilter').addEventListener('change', (e) => {
    state.filterGrade = e.target.value;
    renderAll();
  });

  // Modals Close
  document.getElementById('btnCloseEventModal').addEventListener('click', closeEventDetailModal);
  document.getElementById('btnCloseEventModalBtn').addEventListener('click', closeEventDetailModal);
  document.getElementById('btnToggleBookmark').addEventListener('click', toggleBookmarkCurrentEvent);

  // Notification Modal
  document.getElementById('btnOpenNotificationSettings').addEventListener('click', () => {
    const modal = document.getElementById('notificationModal');
    document.getElementById('notifTimeInput').value = state.notifConfig.time;
    document.getElementById('notifAutoSwitch').checked = state.notifConfig.enabled;
    const permStatus = document.getElementById('notifPermStatus');
    if (!("Notification" in window)) {
      permStatus.textContent = '미지원 브라우저';
    } else {
      permStatus.textContent = Notification.permission === 'granted' ? '허용됨 (정상 작동)' :
        Notification.permission === 'denied' ? '차단됨' : '권한 필요';
    }
    modal.style.display = 'flex';
  });

  document.getElementById('btnCloseNotifModal').addEventListener('click', () => {
    document.getElementById('notificationModal').style.display = 'none';
  });

  document.getElementById('btnRequestNotifPerm').addEventListener('click', () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(p => {
        document.getElementById('notifPermStatus').textContent = p === 'granted' ? '허용됨' : '차단됨';
        showToast(p === 'granted' ? '알림 권한이 허용되었습니다.' : '알림 권한이 거부되었습니다.', p === 'granted' ? 'success' : 'warning');
      });
    }
  });

  document.getElementById('btnSaveNotifSettings').addEventListener('click', () => {
    state.notifConfig.time = document.getElementById('notifTimeInput').value;
    state.notifConfig.enabled = document.getElementById('notifAutoSwitch').checked;
    localStorage.setItem('dj_notif_config', JSON.stringify(state.notifConfig));
    document.getElementById('notificationModal').style.display = 'none';
    showToast(`브리핑 알림 설정이 저장되었습니다. (매일 ${state.notifConfig.time})`, 'success');
    document.getElementById('notifActiveIndicator').style.display = state.notifConfig.enabled ? 'inline-block' : 'none';
  });

  document.getElementById('btnTestNotifNow').addEventListener('click', () => {
    triggerBriefingNotification(true);
  });

  document.getElementById('btnSimulateBriefing').addEventListener('click', () => {
    triggerBriefingNotification(true);
  });

  // School Search Modal
  document.getElementById('btnSchoolSearchModal').addEventListener('click', () => {
    document.getElementById('schoolSearchModal').style.display = 'flex';
  });

  document.getElementById('btnCloseSchoolModal').addEventListener('click', () => {
    document.getElementById('schoolSearchModal').style.display = 'none';
  });

  document.getElementById('btnRunSchoolSearch').addEventListener('click', () => {
    searchSchools(document.getElementById('schoolSearchInput').value);
  });

  document.getElementById('schoolSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchSchools(e.target.value);
    }
  });

  document.querySelectorAll('.quick-preset-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectSchool(chip.dataset.office, '부산광역시교육청', chip.dataset.code, chip.dataset.name, '');
    });
  });

  // Custom D-Day Modal
  document.getElementById('btnCustomDdayModal').addEventListener('click', () => {
    document.getElementById('customDdayModal').style.display = 'flex';
  });

  document.getElementById('btnCloseCustomDdayModal').addEventListener('click', () => {
    document.getElementById('customDdayModal').style.display = 'none';
  });

  document.getElementById('btnCancelCustomDday').addEventListener('click', () => {
    document.getElementById('customDdayModal').style.display = 'none';
  });

  document.getElementById('btnSaveCustomDday').addEventListener('click', () => {
    const title = document.getElementById('customDdayTitle').value.trim();
    const date = document.getElementById('customDdayDate').value;
    const category = document.getElementById('customDdayCategory').value;

    if (!title || !date) {
      showToast('일정 이름과 목표 날짜를 모두 입력해주세요.', 'warning');
      return;
    }

    state.customDdays.push({ title, date, category });
    localStorage.setItem('dj_custom_ddays', JSON.stringify(state.customDdays));
    document.getElementById('customDdayModal').style.display = 'none';
    document.getElementById('customDdayTitle').value = '';
    document.getElementById('customDdayDate').value = '';
    renderDDaySidebar();
    showToast(`'${title}' D-Day가 성공적으로 추가되었습니다.`, 'success');
  });

  // Backdrop click to close modals
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = 'none';
      }
    });
  });
}

// Startup
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initScheduleData();
});
