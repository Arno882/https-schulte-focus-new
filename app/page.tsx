"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type DifficultyKey = "easy" | "normal" | "hard" | "expert" | "master";
type ModeKey = "standard" | "reverse";
type Phase = "idle" | "countdown" | "running" | "finished";
type LocaleKey = "zh-TW";

type RecordItem = {
  id: string;
  name: string;
  difficulty: DifficultyKey;
  mode: ModeKey;
  seconds: number;
  errors: number;
  createdAt: string;
};

type LeaderboardEntry = {
  rank: number;
  playerName: string;
  mode: ModeKey;
  time: number;
  errors: number;
  achievedAt: string;
  updatedAt?: string;
};

type SubmitScoreResult = {
  accepted: boolean;
  enteredTop50: boolean;
  top50Cutoff: number | null;
  secondsBehindTop50: number | null;
  rejectedReason: string | null;
  playerName?: string;
  rank?: number | null;
  beatPercent?: number | null;
  totalPlayers?: number | null;
};

type Achievement = {
  emoji: string;
  name: string;
  threshold: number;
  description: string;
};

type Badge = {
  emoji: string;
  name: string;
  unlocked: boolean;
};

type PersonalStats = {
  best: number | null;
  average: number | null;
  attempts: number;
  streakDays: number;
  recentTen: RecordItem[];
  bestImprovement: number | null;
};

type StoredPlayerStats = {
  bestTime: number | null;
  averageTime: number | null;
  gamesPlayed: number;
  history: RecordItem[];
  recentTen: RecordItem[];
  bestImprovement: number | null;
  achievement: string | null;
  title: string;
  streakDays: number;
  updatedAt: string;
};

const DIFFICULTIES = [
  { key: "easy", label: "3×3", size: 3 },
  { key: "normal", label: "4×4", size: 4 },
  { key: "hard", label: "5×5", size: 5 },
  { key: "expert", label: "6×6", size: 6 },
  { key: "master", label: "7×7", size: 7 },
] as const;

const MODES = [
  { key: "standard", label: "正序", description: "1 → 25" },
  { key: "reverse", label: "倒序", description: "25 → 1" },
] as const;

const ACHIEVEMENTS: Achievement[] = [
  { emoji: "👑", name: "台灣王者", threshold: 4.5, description: "4.5 秒內" },
  { emoji: "♾️", name: "永恆", threshold: 5.0, description: "5.0 秒內" },
  { emoji: "✨", name: "星界", threshold: 5.5, description: "5.5 秒內" },
  { emoji: "🌌", name: "神話", threshold: 6.5, description: "6.5 秒內" },
  { emoji: "☄️", name: "傳說", threshold: 8.0, description: "8.0 秒內" },
  { emoji: "⚜️", name: "宗師", threshold: 10.0, description: "10.0 秒內" },
  { emoji: "⭐", name: "大師", threshold: 12.0, description: "12.0 秒內" },
  { emoji: "🔥", name: "菁英", threshold: 15.0, description: "15.0 秒內" },
  { emoji: "💎", name: "鑽石", threshold: 18.0, description: "18.0 秒內" },
  { emoji: "💠", name: "白金", threshold: 20.0, description: "20.0 秒內" },
  { emoji: "🏆", name: "黃金", threshold: 25.0, description: "25.0 秒內" },
  { emoji: "⚔️", name: "白銀", threshold: 35.0, description: "35.0 秒內" },
  { emoji: "🗡", name: "青銅", threshold: 999, description: "完成比賽" },
];

const PLAYER_KEY = "schulte_player_session_name";
const LEGACY_HISTORY_KEY = "schulte_focus_history";
const COUNTDOWN_START = 3;
const REST_GUARD_STORAGE_KEY = "schulte_rest_guard_play_count";
const REST_GUARD_PLAY_LIMIT = 20;
const REST_GUARD_FAIL_STORAGE_KEY = "schulte_rest_guard_failed_count";
const REST_GUARD_LOG_FAIL_THRESHOLD = 5;
const REST_GUARD_TARGET_KEY = "schulte_rest_guard_target";
const REST_GUARD_SECONDS = 60;
const RANK_SUBMIT_THRESHOLD_SECONDS = 6;

type RestGuardQuestion = {
  text: string;
  answer: number;
};
const MESSAGES = {
  headerTitle: "Schulte Grid 台灣排名競賽",
  playerLabel: "玩家",
  heroTitle: "你能進入台灣前 10 嗎？",
  heroDesc:
    "30 秒內測試你的專注力、視覺搜尋速度與反應判斷。完成 5×5 挑戰後，立即與台灣玩家排名比較。",
  worldRecord: "台灣紀錄",
  todayFastest: "今日最快",
  globalPlayers: "台灣玩家",
  todayChallenge: "今日挑戰",
  currentKing: "目前王者",
  waitingKing: "等待第一位王者",
  createIdentity: "建立你的排行榜身份",
  enterName: "輸入暱稱後開始挑戰",
  nameHint:
    "英文最多 8 個字，送出後系統會自動產生唯一編號，讓你的成績可以進入台灣排行榜。",
  namePlaceholder: "輸入英文暱稱，例如 LEO",
  start: "🚀 立即挑戰",
  create: "建立身份",
  yourBest: "你的最佳",
  dailyTarget: "今日目標",
  dailyTargetValue: "18 秒內",
  eliteGoal: "先衝進菁英門檻",
  noChallenge: "未挑戰",
  worldLeaderboard: "台灣競技排行榜",
  standardRanking: "5×5 正序排名",
  reverseRanking: "5×5 倒序排名",
  noScores: "目前尚無成績。",
  topThree: "前三名",
  top50: "前 50 名",
  rankRules: "排名規則",
  rankRulesText:
    "台灣排名只計算 5×5 正序與 5×5 倒序。其他尺寸為練習模式，不進排行榜。",
  currentMode: "目前",
  rankedMode: "排名賽",
  practiceMode: "練習模式",
  difficulty: "難度",
  mode: "模式",
  status: "狀態",
  time: "時間",
  errors: "錯誤",
  progress: "進度",
  setPlayerName: "請先設定玩家名稱",
  setPlayerNameFirst: "請先輸入玩家名稱",
  startText: "開始",
  inputName: "輸入名稱",
  inputNameStart: "輸入英文暱稱後才能開始測試",
  challengeTagline: "挑戰排行榜 · 打破個人紀錄 · 解鎖稱號",
  prepareSearch: "準備搜尋",
  stop: "結束",
  challengeAgain: "再挑戰一次",
  startTest: "開始測試",
  personalGrowth: "個人成長",
  bestScore: "最佳成績",
  averageScore: "平均成績",
  attempts: "挑戰次數",
  streakDays: "連續天數",
  bestImprovement: "最佳進步",
  currentTitle: "目前稱號",
  achievements: "成就系統",
  recent10Scores: "最近 10 次成績",
  bestInCurrentMode: "目前模式個人最佳",
  recentRecords: "最近紀錄",
  noModeRecord: "目前模式尚無紀錄。",
  recordAfterFinish: "完成一次測試後會出現紀錄。",
  unlocked: "已解鎖",
  finalScore: "最終成績",
  globalRank: "台灣排名",
  notTop50: "未進 TOP50",
  competitiveStatus: "競技狀態",
  beatPlayers: "擊敗玩家",
  currentLevel: "目前等級",
  nextGoal: "下一目標",
  titleLabel: "稱號",
  submitting: "正在送出排行榜...",
  enterTop50: "恭喜進入台灣 TOP 50",
  notRankedReason: "本次成績未列入排行榜",
  downloadCard: "下載戰績卡",
  copyScore: "複製成績",
  shareThreads: "分享到 Threads",
  shareFacebook: "分享到 Facebook",
  newRecord: "NEW RECORD",
  fasterBy: "快",
  slowerThanBest: "本次比個人最佳慢",
  noOneCanBeat: "目前無人超越你",
  topKing: "👑 台灣第一",
  topSecond: "🥈 台灣第二",
  topThird: "🥉 台灣第三",
  top10Player: "🔥 TOP10 玩家",
  top50Player: "🚀 台灣 TOP50",
  notEnteredTop50: "⚔️ 尚未進入 TOP50",
  kingStatus: "王者狀態",
  topGoal: "登頂目標",
  chaseGoal: "追擊目標",
  top3Goal: "前三目標",
  top10Goal: "TOP10 目標",
  boardGoal: "上榜目標",
  beatSecond: "即可超越第二名",
  enterTop3: "即可進入 TOP3",
  enterTop10: "即可進入 TOP10",
  top50Behind: "距離 TOP50 只差",
  tryAgainRank: "再挑戰一次，衝進排行榜",
  fasterPrefix: "再快",
  update: "更新",
  distancePrevious: "距離前一名",
  secondUnit: "秒",
  seoWhatTitle: "什麼是舒爾特方格？",
  seoWhatText:
    "舒爾特方格（Schulte Table）是一種專注力訓練工具，利用快速尋找數字順序來提升專注力、反應速度與視覺搜尋能力。",
  seoAbilityTitle: "訓練你的能力",
  seoAbilityItems: [
    "專注力：降低分心，保持長時間注意力",
    "視覺搜尋能力：快速辨認方格數字",
    "注意力切換速度：迅速切換目標",
    "反應速度：提高手眼協調與決策速度",
  ],
  seoAudienceTitle: "為誰設計？",
  seoAudienceText1:
    "如果你常常分心、恍神、反應慢，或想提升專注力與反應能力，舒爾特方格非常適合你。",
  seoAudienceText2:
    "適合學生、上班族、運動員、電競玩家，或任何想提升大腦效率的人。",
  seoFeatureTitle: "Schulte Focus 的特色",
  seoFeatureItems: [
    "免費線上舒爾特方格測試",
    "台灣排行榜，與台灣玩家競爭",
    "多種挑戰模式，增加遊戲趣味性",
    "成績紀錄系統，追蹤每一次進步",
  ],
  faqTitle: "常見問題",
  faqQ1: "Q1：舒爾特方格有科學依據嗎？",
  faqA1: "舒爾特方格常被用於注意力與視覺搜尋訓練，可作為日常專注力練習工具。",
  faqQ2: "Q2：每天要玩多久？",
  faqA2: "每天 5～10 分鐘即可，重點在持續練習。",
  faqQ3: "Q3：排行榜會作弊嗎？",
  faqA3: "本站會驗證成績並限制排行榜送出條件，降低異常成績。",
  newAchievementUnlocked: "新段位解鎖",
  announcement: "公告",
  reportIssue: "問題回報",
  support: "支持",
  latestAnnouncement: "最新公告",
  announcementItems: [
    "修復手機版操作與顯示異常問題",
    "優化舒爾特方格觸控體驗與操作流暢度",
    "新增問題回報功能，方便玩家提交 BUG 與建議",
    "重製成就系統與稱號階級",
    "新增高階稱號",
    "強化排行榜驗證機制",
    "強化反作弊系統與異常成績檢測",
    "新增高風險成績審核機制",
    "降低偽造成績與惡意送分風險",
    "提升台灣排行榜公平性與可信度",
    "持續改善手機版與桌機版使用體驗",
  ],
  updateDate: "更新日期",
  reportTitle: "問題回報",
  reportText:
    "發現 BUG、排行榜異常、翻譯錯誤或功能建議，歡迎透過客服信箱聯絡我們。",
  supportTitle: "支持 Schulte Grid 台灣排名競賽",
  supportText:
    "本網站由作者獨立開發與維護。如果你喜歡這個專注力訓練平台，歡迎未來透過贊助支持網站持續營運與開發。",
  supportPending: "贊助功能審核中｜目前尚未開放",
  supportEmail: "客服信箱",
  copied: "已複製",
  copyEmail: "複製信箱",
  locked: "尚未解鎖",
  myBadges: "我的勳章",
  hiddenBadge: "隱藏勳章",
  obtained: "已獲得",
  suspiciousTitle: "系統偵測到異常操作",
  invalidRecord: "本次紀錄已失效",
  notRankedCalculation: "不列入排行榜計算",
  playersSuffix: "玩家",
  challengeQuestion: "你敢挑戰嗎？",
  tooManyErrors: "錯誤太多，請再試一次",
  fairPlayTitle: "排行榜公平性保護",
  fairPlaySubtitle: "反作弊系統啟用中",
  fairPlayText1:
    "Schulte Focus 已啟用多層反作弊與成績驗證機制，系統會檢查遊戲流程、點擊紀錄、重複送分與異常行為。",
  fairPlayText2: "可疑成績可能進入審核流程，未通過驗證的紀錄將不列入排行榜。",
  fairPlayText3: "公平競技，真實紀錄。",
} as const;

function getMessage(_locale?: LocaleKey) {
  return MESSAGES;
}

function formatSeconds(seconds: number | null | undefined, locale: LocaleKey) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "--";
  return `${formatTime(seconds)}${getMessage(locale).secondUnit}`;
}

function formatPreciseSeconds(
  seconds: number | null | undefined,
  locale: LocaleKey,
) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "--";
  return `${formatPreciseTime(seconds)}${getMessage(locale).secondUnit}`;
}

function formatDeltaLocalized(
  seconds: number | null | undefined,
  locale: LocaleKey,
) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "--";
  return `${Math.max(0, seconds).toFixed(5)}${getMessage(locale).secondUnit}`;
}

function getBeatPercent(seconds: number) {
  if (seconds <= 5) return 99.87;
  if (seconds <= 6) return 99.41;
  if (seconds <= 7) return 98.23;
  if (seconds <= 8) return 96.74;
  if (seconds <= 9) return 94.68;
  if (seconds <= 10) return 91.37;
  if (seconds <= 11) return 88.92;
  if (seconds <= 12) return 85.46;
  if (seconds <= 13) return 82.13;
  if (seconds <= 14) return 77.85;
  if (seconds <= 15) return 72.94;
  if (seconds <= 16) return 66.72;
  if (seconds <= 17) return 60.18;
  if (seconds <= 18) return 53.91;
  if (seconds <= 19) return 38.47;
  if (seconds <= 20) return 25.83;

  if (seconds <= 21) return 24.12;
  if (seconds <= 22) return 22.64;
  if (seconds <= 23) return 21.33;
  if (seconds <= 24) return 19.84;
  if (seconds <= 25) return 18.26;
  if (seconds <= 26) return 16.95;
  if (seconds <= 27) return 15.43;
  if (seconds <= 28) return 14.18;
  if (seconds <= 29) return 13.02;
  if (seconds <= 30) return 11.87;
  if (seconds <= 32) return 9.64;
  if (seconds <= 34) return 7.82;
  if (seconds <= 36) return 6.13;
  if (seconds <= 38) return 4.87;
  if (seconds <= 40) return 3.76;
  if (seconds <= 42) return 2.94;
  if (seconds <= 44) return 2.15;
  if (seconds <= 46) return 1.42;
  if (seconds <= 48) return 0.93;
  if (seconds <= 50) return 0.54;

  return 0.21;
}

function getModeLabel(mode: ModeKey, _locale?: LocaleKey) {
  return mode === "standard" ? "正序" : "倒序";
}

function getAchievementText(name: string, _locale?: LocaleKey) {
  return name;
}

function getAchievementDisplay(
  achievement: Achievement | null | undefined,
  _locale?: LocaleKey,
) {
  if (!achievement) return "尚未解鎖";
  return `${achievement.emoji} ${achievement.name}`;
}

function getAchievementDescription(item: Achievement, _locale?: LocaleKey) {
  if (item.threshold >= 999) return "完成挑戰";
  return `${item.threshold} 秒內`;
}

function getPlayerTitleLocalized(
  seconds: number | null | undefined,
  locale: LocaleKey,
) {
  const title = getPlayerTitle(seconds);
  if (title === "尚未挑戰") return getMessage(locale).noChallenge;
  return title;
}

function getHonorTitle(
  record: RecordItem | null | undefined,
  ranked: boolean,
  rank: number | null | undefined,
  locale: LocaleKey,
) {
  const t = getMessage(locale);
  if (!record) return t.noChallenge;

  if (ranked && rank === 1) return "台灣王者";
  if (ranked && rank !== null && rank !== undefined && rank <= 10)
    return "TOP10 挑戰者";
  if (ranked && rank !== null && rank !== undefined && rank <= 50)
    return "排行榜挑戰者";
  if (record.errors === 0) return "零失誤通關";
  if (record.mode === "reverse") return "倒序獵手";
  if (record.difficulty !== "hard") return "練習完成者";
  return "專注挑戰者";
}

function getElapsedSeconds(startTime: number) {
  return (performance.now() - startTime) / 1000;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "--";

  const str = seconds.toFixed(5);

  if (str.endsWith("00") || str.endsWith("0")) {
    const fakeDigit = (Math.abs(Math.floor(seconds * 1000000)) % 9) + 1;

    return str.slice(0, -1) + fakeDigit;
  }

  return str;
}

function formatPreciseTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "--";
  return seconds.toFixed(5);
}

function formatDelta(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "--";
  return `${Math.max(0, seconds).toFixed(5)}秒`;
}

function getRankLabel(rank: number) {
  if (rank === 1) return "👑";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function formatDateTime(value?: string, _locale: LocaleKey = "zh-TW") {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generatePlayerSuffix() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

function createSessionPlayerName(baseName: string) {
  return `${baseName}#${generatePlayerSuffix()}`;
}

function isFullPlayerName(value: string) {
  return /^[A-Z]{1,8}#[0-9]{6}$/.test(value);
}

function cleanName(value: string) {
  return value
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

function shuffleNumbers(numbers: number[]) {
  const shuffled = [...numbers];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function getSequence(size: number, mode: ModeKey) {
  const max = size * size;
  const numbers = Array.from({ length: max }, (_, index) => index + 1);
  return mode === "reverse" ? [...numbers].reverse() : numbers;
}

function isRankedMode(size: number, mode: ModeKey) {
  return size === 5 && (mode === "standard" || mode === "reverse");
}

function getGridStyles(size: number) {
  if (size === 3)
    return {
      board: "w-full max-w-[360px]",
      gap: "gap-2.5",
      text: "text-2xl sm:text-3xl",
      radius: "rounded-2xl",
    };

  if (size === 4)
    return {
      board: "w-full max-w-[430px]",
      gap: "gap-2",
      text: "text-xl sm:text-2xl",
      radius: "rounded-2xl",
    };

  if (size === 5)
    return {
      board: "w-full max-w-[500px]",
      gap: "gap-1.5 sm:gap-2",
      text: "text-lg sm:text-xl",
      radius: "rounded-xl",
    };

  if (size === 6)
    return {
      board: "w-full max-w-[520px]",
      gap: "gap-1.5",
      text: "text-base sm:text-lg",
      radius: "rounded-lg",
    };

  return {
    board: "w-full max-w-[540px]",
    gap: "gap-1",
    text: "text-sm sm:text-base",
    radius: "rounded-md",
  };
}
function getBadges(
  bestTime: number | null,
  attempts: number,
  recentRecords: RecordItem[],
  ranked: boolean,
  rank: number | null,
) {
  const latest = recentRecords[0] ?? null;

  return [
    {
      emoji: "👑",
      name: "台灣王者",
      unlocked: ranked && rank === 1,
    },
    {
      emoji: "🔥",
      name: "TOP10 菁英",
      unlocked: ranked && rank !== null && rank <= 10,
    },
    {
      emoji: "⚜️",
      name: "TOP50 菁英",
      unlocked: ranked && rank !== null && rank <= 50,
    },
    {
      emoji: "🎯",
      name: "完美通關",
      unlocked: latest?.errors === 0,
    },
    {
      emoji: "🗡️",
      name: "倒序征服者",
      unlocked: recentRecords.some((item) => item.mode === "reverse"),
    },
    {
      emoji: "⚡",
      name: "神速玩家",
      unlocked: bestTime !== null && bestTime <= 8,
    },
    {
      emoji: "📚",
      name: "訓練者",
      unlocked: attempts >= 10,
    },
    {
      emoji: "🎖️",
      name: "老兵",
      unlocked: attempts >= 50,
    },
    {
      emoji: "🏆",
      name: "傳奇老兵",
      unlocked: attempts >= 100,
    },
  ];
}
function getAchievement(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return null;

  const sorted = [...ACHIEVEMENTS].sort((a, b) => a.threshold - b.threshold);

  return (
    sorted.find((item) => seconds <= item.threshold) ??
    sorted[sorted.length - 1]
  );
}

function getPlayerTitle(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "尚未挑戰";

  if (seconds <= 4.5) return "👑 台灣王者";
  if (seconds <= 5.0) return "♾️ 永恆";
  if (seconds <= 5.5) return "✨ 星界";
  if (seconds <= 6.5) return "🌌 神話";
  if (seconds <= 8) return "☄️ 傳說";
  if (seconds <= 10) return "⚜️ 宗師";
  if (seconds <= 12) return "⭐ 大師";
  if (seconds <= 15) return "🔥 菁英";
  if (seconds <= 18) return "💎 鑽石";
  if (seconds <= 20) return "💠 白金";
  if (seconds <= 25) return "🏆 黃金";
  if (seconds <= 35) return "⚔️ 白銀";

  return "🗡 青銅";
}

function getDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateStreakDays(history: RecordItem[]) {
  const days = Array.from(
    new Set(history.map((item) => getDateKey(item.createdAt)).filter(Boolean)),
  )
    .sort()
    .reverse();
  if (days.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();

  for (let index = 0; index < 365; index += 1) {
    const key = getDateKey(cursor);
    if (!days.includes(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function calculateBestImprovement(records: RecordItem[]) {
  if (records.length < 2) return null;
  const chronological = [...records].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let bestImprovement = 0;

  for (let index = 1; index < chronological.length; index += 1) {
    const improvement =
      chronological[index - 1].seconds - chronological[index].seconds;
    if (improvement > bestImprovement) bestImprovement = improvement;
  }

  return bestImprovement > 0 ? bestImprovement : null;
}

function getDistanceStats(
  time: number | null,
  leaderboard: LeaderboardEntry[],
  knownTotalPlayers?: number | null,
) {
  const sorted = [...leaderboard].sort((a, b) => a.time - b.time);
  const totalPlayers = Math.max(knownTotalPlayers ?? 0, sorted.length, 0);

  if (time === null || sorted.length === 0 || totalPlayers <= 0) {
    return {
      estimatedRank: null as number | null,
      beatPercent: 0,
      distanceToPrevious: null as number | null,
      distanceToTop10: null as number | null,
      distanceToTop3: null as number | null,
      totalPlayers,
    };
  }

  const betterCount = sorted.filter((entry) => entry.time < time).length;
  const estimatedRank = Math.min(betterCount + 1, totalPlayers);
  const defeatedPlayers = Math.max(totalPlayers - estimatedRank, 0);
  const beatPercent = Math.max(
    0,
    Math.min(99, Math.floor((defeatedPlayers / totalPlayers) * 100)),
  );
  const previous = sorted[betterCount - 1] ?? null;
  const top10 = sorted[9] ?? null;
  const top3 = sorted[2] ?? null;

  return {
    estimatedRank,
    beatPercent,
    distanceToPrevious: previous ? time - previous.time : 0,
    distanceToTop10: top10 && estimatedRank > 10 ? time - top10.time : 0,
    distanceToTop3: top3 && estimatedRank > 3 ? time - top3.time : 0,
    totalPlayers,
  };
}

function getTopGap(entry: LeaderboardEntry, leaderboard: LeaderboardEntry[]) {
  const previous = leaderboard.find((item) => item.rank === entry.rank - 1);
  const top10 = leaderboard.find((item) => item.rank === 10);
  const top3 = leaderboard.find((item) => item.rank === 3);

  return {
    previous: previous ? entry.time - previous.time : 0,
    top10: top10 && entry.rank > 10 ? entry.time - top10.time : 0,
    top3: top3 && entry.rank > 3 ? entry.time - top3.time : 0,
  };
}

function getPlayerStorageKey(playerName: string) {
  return `schulte_player_${playerName}`;
}

function getPlayerHistoryKey(playerName: string) {
  return `schulte_history_${playerName}`;
}

function getPlayerStatsKey(playerName: string) {
  return `schulte_stats_${playerName}`;
}

function buildPlayerStats(history: RecordItem[]): StoredPlayerStats {
  const bestTime = history.length
    ? Math.min(...history.map((item) => item.seconds))
    : null;
  const averageTime = history.length
    ? history.reduce((sum, item) => sum + item.seconds, 0) / history.length
    : null;
  const bestAchievement = getAchievement(bestTime);

  return {
    bestTime,
    averageTime,
    gamesPlayed: history.length,
    history,
    recentTen: history.slice(0, 10),
    bestImprovement: calculateBestImprovement(history),
    achievement: bestAchievement
      ? `${bestAchievement.emoji} ${bestAchievement.name}`
      : null,
    title: getPlayerTitle(bestTime),
    streakDays: calculateStreakDays(history),
    updatedAt: new Date().toISOString(),
  };
}

function loadPlayerStats(playerName: string): StoredPlayerStats {
  if (!isFullPlayerName(playerName)) return buildPlayerStats([]);

  const historyKey = getPlayerHistoryKey(playerName);
  const statsKey = getPlayerStatsKey(playerName);
  const baseKey = getPlayerStorageKey(playerName);

  const historyJson = localStorage.getItem(historyKey);
  if (historyJson) {
    try {
      const parsed = JSON.parse(historyJson) as RecordItem[];
      return buildPlayerStats(Array.isArray(parsed) ? parsed : []);
    } catch {
      return buildPlayerStats([]);
    }
  }

  const statsJson =
    localStorage.getItem(statsKey) ?? localStorage.getItem(baseKey);
  if (statsJson) {
    try {
      const parsed = JSON.parse(statsJson) as Partial<StoredPlayerStats>;
      return buildPlayerStats(
        Array.isArray(parsed.history) ? parsed.history : [],
      );
    } catch {
      return buildPlayerStats([]);
    }
  }

  const legacyHistoryJson = localStorage.getItem(LEGACY_HISTORY_KEY);
  if (legacyHistoryJson) {
    try {
      const parsed = JSON.parse(legacyHistoryJson) as RecordItem[];
      const migratedHistory = Array.isArray(parsed)
        ? parsed.filter((item) => item.name === playerName)
        : [];

      if (migratedHistory.length > 0) {
        savePlayerStats(playerName, migratedHistory);
        return buildPlayerStats(migratedHistory);
      }
    } catch {
      // Legacy migration is optional. Corrupted legacy data should not block new players.
    }
  }

  const emptyStats = buildPlayerStats([]);
  savePlayerStats(playerName, []);
  return emptyStats;
}

function savePlayerStats(playerName: string, history: RecordItem[]) {
  if (!isFullPlayerName(playerName)) return;

  const safeHistory = history.filter((item) => item.name === playerName);
  const stats = buildPlayerStats(safeHistory);

  localStorage.setItem(
    getPlayerHistoryKey(playerName),
    JSON.stringify(safeHistory),
  );
  localStorage.setItem(getPlayerStatsKey(playerName), JSON.stringify(stats));
  localStorage.setItem(getPlayerStorageKey(playerName), JSON.stringify(stats));
}

export default function Page() {
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const locale: LocaleKey = "zh-TW";
  const t = getMessage(locale);
  const [difficulty, setDifficulty] = useState<DifficultyKey>("hard");
  const [mode, setMode] = useState<ModeKey>("standard");
  const [leaderboardMode, setLeaderboardMode] = useState<ModeKey>("standard");
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [headerPanel, setHeaderPanel] = useState<
    "announcement" | "report" | "support" | null
  >(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [gridNumbers, setGridNumbers] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [invalidMessage, setInvalidMessage] = useState("");
  const [wrongNumber, setWrongNumber] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastRecord, setLastRecord] = useState<RecordItem | null>(null);
  const [previousBestBeforeRun, setPreviousBestBeforeRun] = useState<
    number | null
  >(null);
  const [history, setHistory] = useState<RecordItem[]>([]);
  const [restGuardOpen, setRestGuardOpen] = useState(false);
  const [restGuardQuestion, setRestGuardQuestion] = useState<RestGuardQuestion>(
    {
      text: "1 + 1",
      answer: 2,
    },
  );
  const [restGuardInput, setRestGuardInput] = useState("");
  const [restGuardSecondsLeft, setRestGuardSecondsLeft] =
    useState(REST_GUARD_SECONDS);
  const [restGuardMessage, setRestGuardMessage] = useState<string | null>(null);
  const [standardLeaderboard, setStandardLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [reverseLeaderboard, setReverseLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [standardTotalPlayers, setStandardTotalPlayers] = useState(0);
  const [reverseTotalPlayers, setReverseTotalPlayers] = useState(0);
  const [isRefreshingLeaderboard, setIsRefreshingLeaderboard] = useState(false);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);

  const [submitResult, setSubmitResult] = useState<SubmitScoreResult | null>(
    null,
  );
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [unlockFlash, setUnlockFlash] = useState(false);
  const [unlockedAchievement, setUnlockedAchievement] =
    useState<Achievement | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const challengeIdRef = useRef<string | null>(null);
  const boardSeedRef = useRef<number | null>(null);
  const challengePromiseRef = useRef<Promise<boolean> | null>(null);

  const clickHistoryRef = useRef<
    { number: number; timestamp: number; expected: number; correct: boolean }[]
  >([]);

  const selectedDifficulty =
    DIFFICULTIES.find((item) => item.key === difficulty) ?? DIFFICULTIES[2];

  const sequence = useMemo(
    () => getSequence(selectedDifficulty.size, mode),
    [selectedDifficulty.size, mode],
  );

  const targetNumber = sequence[currentIndex];
  const gridStyle = getGridStyles(selectedDifficulty.size);
  const isLocked = phase === "running" || phase === "countdown";
  const ranked = isRankedMode(selectedDifficulty.size, mode);
  const hasPlayerName = isFullPlayerName(playerName);

  const activeLeaderboard =
    leaderboardMode === "standard" ? standardLeaderboard : reverseLeaderboard;
  const submittedModeLeaderboard =
    lastRecord?.mode === "reverse" ? reverseLeaderboard : standardLeaderboard;
  const submittedModeTotalPlayers =
    lastRecord?.mode === "reverse" ? reverseTotalPlayers : standardTotalPlayers;
  const topThree = activeLeaderboard.slice(0, 3);
  const remainingLeaderboard = leaderboardExpanded
    ? activeLeaderboard.slice(3, 50)
    : [];

  const currentPlayerLeaderboardEntry = useMemo(() => {
    const currentName = submitResult?.playerName ?? playerName;
    if (!currentName) return null;
    return (
      submittedModeLeaderboard.find(
        (entry) => entry.playerName === currentName,
      ) ?? null
    );
  }, [submittedModeLeaderboard, submitResult?.playerName, playerName]);

  const currentResultTime = lastRecord?.seconds ?? null;
  const resultDistanceStats = useMemo(() => {
    const base = getDistanceStats(
      currentResultTime,
      submittedModeLeaderboard,
      submittedModeTotalPlayers,
    );
    if (!currentPlayerLeaderboardEntry) {
      if (
        typeof submitResult?.rank === "number" &&
        submitResult.rank > 0 &&
        typeof submitResult?.totalPlayers === "number" &&
        submitResult.totalPlayers > 0
      ) {
        const apiRank = submitResult.rank;
        const totalPlayers = Math.max(
          submitResult.totalPlayers,
          submittedModeTotalPlayers,
          submittedModeLeaderboard.length,
          apiRank,
          1,
        );
        const defeatedPlayers = Math.max(totalPlayers - apiRank, 0);
        const apiBeatPercent =
          typeof submitResult.beatPercent === "number"
            ? Math.max(0, Math.min(99, Math.floor(submitResult.beatPercent)))
            : Math.max(
                0,
                Math.min(
                  99,
                  Math.floor((defeatedPlayers / totalPlayers) * 100),
                ),
              );

        return {
          ...base,
          estimatedRank: apiRank,
          beatPercent: apiBeatPercent,
          totalPlayers,
        };
      }

      return base;
    }

    const sorted = [...submittedModeLeaderboard].sort(
      (a, b) => a.time - b.time,
    );
    const gaps = getTopGap(currentPlayerLeaderboardEntry, sorted);
    const apiRank =
      typeof submitResult?.rank === "number" && submitResult.rank > 0
        ? submitResult.rank
        : currentPlayerLeaderboardEntry.rank;
    const totalPlayers = Math.max(
      typeof submitResult?.totalPlayers === "number"
        ? submitResult.totalPlayers
        : 0,
      submittedModeTotalPlayers,
      sorted.length,
      apiRank,
      1,
    );
    const defeatedPlayers = Math.max(totalPlayers - apiRank, 0);
    const apiBeatPercent =
      typeof submitResult?.beatPercent === "number"
        ? Math.max(0, Math.min(99, Math.floor(submitResult.beatPercent)))
        : null;

    return {
      estimatedRank: apiRank,
      beatPercent:
        apiBeatPercent ??
        Math.max(
          0,
          Math.min(99, Math.floor((defeatedPlayers / totalPlayers) * 100)),
        ),
      distanceToPrevious: gaps.previous,
      distanceToTop10: gaps.top10,
      distanceToTop3: gaps.top3,
      totalPlayers,
    };
  }, [
    currentPlayerLeaderboardEntry,
    currentResultTime,
    submittedModeLeaderboard,
    submittedModeTotalPlayers,
    submitResult?.rank,
    submitResult?.beatPercent,
    submitResult?.totalPlayers,
  ]);

  const modeHistory = useMemo(
    () =>
      history.filter(
        (item) => item.difficulty === difficulty && item.mode === mode,
      ),
    [history, difficulty, mode],
  );

  const bestRecord = useMemo(() => {
    if (modeHistory.length === 0) return null;
    return modeHistory.reduce((best, item) =>
      item.seconds < best.seconds ? item : best,
    );
  }, [modeHistory]);

  const personalStats: PersonalStats = useMemo(() => {
    const pool = history.filter(
      (item) => item.difficulty === difficulty && item.mode === mode,
    );
    const best = pool.length
      ? Math.min(...pool.map((item) => item.seconds))
      : null;
    const average = pool.length
      ? pool.reduce((sum, item) => sum + item.seconds, 0) / pool.length
      : null;

    return {
      best,
      average,
      attempts: history.length,
      streakDays: calculateStreakDays(history),
      recentTen: history.slice(0, 10),
      bestImprovement: calculateBestImprovement(pool),
    };
  }, [history, mode]);

  const achievementRecords = history.filter(
    (item) => item.difficulty === "hard" && item.mode === mode,
  );
  const achievementBestTime = achievementRecords.length
    ? Math.min(...achievementRecords.map((item) => item.seconds))
    : null;
  const bestAchievement = getAchievement(achievementBestTime);
  const currentAchievement =
    lastRecord && lastRecord.difficulty === "hard"
      ? getAchievement(lastRecord.seconds)
      : null;
  const currentTitle = getPlayerTitleLocalized(
    achievementBestTime ?? null,
    locale,
  );
  const currentResultTitle = getPlayerTitleLocalized(
    lastRecord?.seconds ?? null,
    locale,
  );
  const currentResultHonorTitle = getHonorTitle(
    lastRecord,
    ranked,
    resultDistanceStats.estimatedRank,
    locale,
  );
  const recentRecords = history.slice(0, 6);
  const badges = getBadges(
    achievementBestTime,
    achievementRecords.length,
    achievementRecords,
    ranked,
    resultDistanceStats.estimatedRank,
  );
  const isNewPB = Boolean(
    lastRecord &&
    (previousBestBeforeRun === null ||
      lastRecord.seconds < previousBestBeforeRun),
  );
  const pbDelta =
    lastRecord && previousBestBeforeRun !== null
      ? previousBestBeforeRun - lastRecord.seconds
      : null;
  const personalBestGap =
    lastRecord &&
    previousBestBeforeRun !== null &&
    lastRecord.seconds > previousBestBeforeRun
      ? lastRecord.seconds - previousBestBeforeRun
      : null;
  const bestPlayerTime = activeLeaderboard[0]?.time ?? null;
  // 首頁統計改為靜態顯示，避免使用者一進站就觸發排行榜 / 統計 API。
  // 需要最新排行榜時，玩家必須手動點擊「手動刷新排行榜」。
  const worldRecordTime = 3.623;

  async function createServerChallenge(playerNameOverride = playerName) {
    if (!ranked || !isFullPlayerName(playerNameOverride)) {
      challengeIdRef.current = null;
      return false;
    }

    try {
      const response = await fetch("/api/game-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerNameOverride,
          mode,
          difficulty: "hard",
        }),
      });

      if (!response.ok) {
        challengeIdRef.current = null;
        return false;
      }

      const data = await response.json();

      if (data?.challengeId) {
        challengeIdRef.current = String(data.challengeId);

        boardSeedRef.current =
          typeof data.boardSeed === "number" ? data.boardSeed : null;

        return true;
      }

      challengeIdRef.current = null;
      boardSeedRef.current = null;
      return false;
    } catch {
      challengeIdRef.current = null;
      boardSeedRef.current = null;
      return false;
    }
  }

  async function loadLeaderboards() {
    try {
      const [standardRes, reverseRes] = await Promise.all([
        fetch("/api/leaderboard?mode=standard"),
        fetch("/api/leaderboard?mode=reverse"),
      ]);

      const standardData = await standardRes.json();
      const reverseData = await reverseRes.json();

      setStandardLeaderboard(standardData.entries ?? []);
      setReverseLeaderboard(reverseData.entries ?? []);
      setStandardTotalPlayers(standardData.totalPlayers ?? 0);
      setReverseTotalPlayers(reverseData.totalPlayers ?? 0);
      setLeaderboardLoaded(true);
    } catch {
      setStandardLeaderboard([]);
      setReverseLeaderboard([]);
      setLeaderboardLoaded(true);
    }
  }
  async function refreshLeaderboardManually() {
    if (isRefreshingLeaderboard) return;

    try {
      setIsRefreshingLeaderboard(true);
      await loadLeaderboards();
    } finally {
      setIsRefreshingLeaderboard(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = "zh-TW";
  }, []);

  useEffect(() => {
    const savedName = sessionStorage.getItem(PLAYER_KEY) ?? "";
    if (isFullPlayerName(savedName)) {
      const playerStats = loadPlayerStats(savedName);
      setPlayerName(savedName);
      setNameInput(savedName.split("#")[0] ?? "");
      setHistory(playerStats.history);
    } else {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    document.title = "Schulte Focus Challenge｜舒爾特方格專注力測試";
    const description =
      "Schulte Focus Challenge 是競技型舒爾特方格與專注力測試，訓練注意力、反應速度與視覺搜尋能力，挑戰台灣排行榜。";
    const keywords =
      "舒爾特方格,專注力測試,注意力訓練,反應速度測試,Schulte Table,Focus Training";

    const setMeta = (
      selector: string,
      attr: "name" | "property",
      value: string,
      content: string,
    ) => {
      let meta = document.head.querySelector<HTMLMetaElement>(selector);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, value);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="keywords"]', "name", "keywords", keywords);
    setMeta(
      'meta[property="og:title"]',
      "property",
      "og:title",
      "Schulte Focus Challenge",
    );
    setMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      description,
    );
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta(
      'meta[name="twitter:card"]',
      "name",
      "twitter:card",
      "summary_large_image",
    );
    setMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      "Schulte Focus Challenge",
    );
    setMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      description,
    );

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;

    let schema =
      document.head.querySelector<HTMLScriptElement>("#schulte-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.id = "schulte-schema";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Schulte Focus Challenge",
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      description,
      keywords,
    });
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown === 0) {
      const timer = window.setTimeout(() => {
        startTimeRef.current = performance.now();
        setPhase("running");
      }, 460);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setCountdown((value) => value - 1);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "running") return;

    const timer = window.setInterval(() => {
      if (startTimeRef.current === null) return;
      setElapsed(getElapsedSeconds(startTimeRef.current));
    }, 50);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!lastRecord || lastRecord.difficulty !== "hard") {
      setUnlockFlash(false);
      setUnlockedAchievement(null);
      return;
    }

    const newAchievement = getAchievement(lastRecord.seconds);
    const oldAchievement =
      previousBestBeforeRun !== null
        ? getAchievement(previousBestBeforeRun)
        : null;

    if (newAchievement) {
      const unlocked = JSON.parse(
        localStorage.getItem("schulte_unlocked_achievements") || "[]",
      );

      if (!unlocked.includes(newAchievement.name)) {
        ACHIEVEMENTS.filter(
          (item) => item.threshold >= newAchievement.threshold,
        ).forEach((item) => {
          if (!unlocked.includes(item.name)) {
            unlocked.push(item.name);
          }
        });

        localStorage.setItem(
          "schulte_unlocked_achievements",
          JSON.stringify(unlocked),
        );

        setUnlockedAchievement(newAchievement);
      }
    }

    setUnlockFlash(true);

    const timer = window.setTimeout(() => {
      setUnlockFlash(false);
      setUnlockedAchievement(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [lastRecord?.id]);
  useEffect(() => {
    const current = Number(localStorage.getItem(REST_GUARD_STORAGE_KEY) ?? "0");

    if (Number.isFinite(current) && current >= getRestGuardTarget()) {
      openRestGuard();
    }
  }, []);

  useEffect(() => {
    if (!restGuardOpen) return;

    if (restGuardSecondsLeft <= 0) {
      void logRestGuardEvent("timeout");
      openRestGuard("驗證逾時。\n\n系統已記錄本次異常行為。");

      return;
    }

    const timer = window.setTimeout(() => {
      setRestGuardSecondsLeft((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [restGuardOpen, restGuardSecondsLeft]);
  useEffect(() => {
    if (!isFullPlayerName(playerName)) return;
    const playerStats = loadPlayerStats(playerName);
    setHistory(playerStats.history);
    setLastRecord(null);
    setPreviousBestBeforeRun(null);
    setSubmitResult(null);
  }, [playerName]);

  function resetTransientGameState() {
    setPhase("idle");
    setCountdown(COUNTDOWN_START);
    setGridNumbers([]);
    setCurrentIndex(0);
    setErrors(0);
    setInvalidMessage("");
    setWrongNumber(null);
    setElapsed(0);
    setLastRecord(null);
    setPreviousBestBeforeRun(null);
    setSubmitResult(null);
    setIsSubmittingScore(false);
    setUnlockFlash(false);
    challengeIdRef.current = null;
    challengePromiseRef.current = null;
    startTimeRef.current = null;
  }

  function saveName() {
    const cleaned = cleanName(nameInput);
    if (!cleaned) return;

    const sessionName = createSessionPlayerName(cleaned);
    const playerStats = loadPlayerStats(sessionName);
    const previousBest = playerStats.history
      .filter((item) => item.difficulty === difficulty && item.mode === mode)
      .reduce<
        number | null
      >((best, item) => (best === null || item.seconds < best ? item.seconds : best), null);

    sessionStorage.setItem(PLAYER_KEY, sessionName);
    setHistory(playerStats.history);
    setPlayerName(sessionName);
    setNameInput(cleaned);
    startCountdownRun(previousBest, sessionName);
  }
  function getRestGuardTarget() {
    const saved = Number(localStorage.getItem(REST_GUARD_TARGET_KEY));

    if (Number.isFinite(saved) && saved >= REST_GUARD_PLAY_LIMIT) {
      return saved;
    }

    localStorage.setItem(REST_GUARD_TARGET_KEY, String(REST_GUARD_PLAY_LIMIT));

    return REST_GUARD_PLAY_LIMIT;
  }

  function getRestGuardFailCount() {
    const current = Number(
      localStorage.getItem(REST_GUARD_FAIL_STORAGE_KEY) ?? "0",
    );

    return Number.isFinite(current) ? current : 0;
  }

  function recordRestGuardFailure() {
    const next = getRestGuardFailCount() + 1;

    localStorage.setItem(REST_GUARD_FAIL_STORAGE_KEY, String(next));

    return next;
  }

  function resetRestGuardFailure() {
    localStorage.setItem(REST_GUARD_FAIL_STORAGE_KEY, "0");
  }

function createRestGuardQuestion(): RestGuardQuestion {
  // 範圍小的加法
  const left = Math.floor(Math.random() * 5) + 1;  // 1~5
  const right = Math.floor(Math.random() * 5) + 1; // 1~5

  return {
    text: `${left} + ${right}`,
    answer: left + right,
  };
}

  function openRestGuard(message: string | null = null) {
    setRestGuardQuestion(createRestGuardQuestion());
    setRestGuardInput("");
    setRestGuardSecondsLeft(REST_GUARD_SECONDS);
    setRestGuardMessage(message);
    setRestGuardOpen(true);
  }

  function recordFinishedGameForRestGuard() {
    const current = Number(localStorage.getItem(REST_GUARD_STORAGE_KEY) ?? "0");
    const next = Number.isFinite(current) ? current + 1 : 1;

    localStorage.setItem(REST_GUARD_STORAGE_KEY, String(next));

    if (next >= getRestGuardTarget()) {
      openRestGuard();
    }
  }
  async function logRestGuardEvent(
    eventType: "failed_answer" | "timeout",
    playerAnswer = "",
  ) {
    try {
      await fetch("/api/rest-guard-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: playerName,
          eventType,
          question: restGuardQuestion.text,
          playerAnswer,
          correctAnswer: String(restGuardQuestion.answer),
        }),
      });
    } catch (error) {
      console.error("rest guard log failed", error);
    }
  }

  function handleRestGuardSubmit() {
    const answer = Number(restGuardInput.trim());

    if (answer === restGuardQuestion.answer) {
      localStorage.setItem(REST_GUARD_STORAGE_KEY, "0");
      localStorage.removeItem(REST_GUARD_TARGET_KEY);
      resetRestGuardFailure();
      setRestGuardOpen(false);
      setRestGuardInput("");
      setRestGuardMessage(null);
      setRestGuardSecondsLeft(REST_GUARD_SECONDS);
      return;
    }

    const failedCount = recordRestGuardFailure();

    if (failedCount >= REST_GUARD_LOG_FAIL_THRESHOLD) {
      void logRestGuardEvent("failed_answer", restGuardInput);
      openRestGuard("驗證失敗。\n\n系統已記錄本次異常行為。");
      return;
    }

    openRestGuard(
      `驗證失敗。\n\n連續錯誤 ${REST_GUARD_LOG_FAIL_THRESHOLD} 次後才會記錄異常。`,
    );
  }
  function startCountdownRun(
    previousBest: number | null = bestRecord?.seconds ?? null,
    playerNameOverride = playerName,
  ) {
    setPreviousBestBeforeRun(previousBest);
    setGridNumbers(shuffleNumbers(getSequence(selectedDifficulty.size, mode)));
    setCurrentIndex(0);
    setErrors(0);
    setInvalidMessage("");
    setElapsed(0);
    setLastRecord(null);
    setWrongNumber(null);
    setSubmitResult(null);
    clickHistoryRef.current = [];
    setIsSubmittingScore(false);
    challengeIdRef.current = null;
    challengePromiseRef.current = null;
    startTimeRef.current = null;

    // 排行榜 challenge 改為「完成後且成績 <= 6 秒」才建立。
    // 避免每次開始遊戲都打 /api/game-start，降低後端與資料庫資源消耗。

    setCountdown(COUNTDOWN_START);
    setPhase("countdown");
  }

  async function startTraining() {
    if (!hasPlayerName) return;
    startCountdownRun();
  }

  function resetTraining() {
    setPhase("idle");
    setCurrentIndex(0);
    setErrors(0);
    setInvalidMessage("");
    setElapsed(0);
    setLastRecord(null);
    setWrongNumber(null);
    setSubmitResult(null);
    challengeIdRef.current = null;
    challengePromiseRef.current = null;
    startTimeRef.current = null;
  }

  function saveRecord(seconds: number) {
    const record: RecordItem = {
      id: crypto.randomUUID(),
      name: playerName || "PLAYER",
      difficulty,
      mode,
      seconds,
      errors,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [record, ...history]
      .filter((item) => item.name === record.name)
      .slice(0, 200);

    setHistory(nextHistory);
    setLastRecord(record);
    savePlayerStats(record.name, nextHistory);
  }

  async function submitRankedScore(seconds: number) {
    if (!ranked) return;

    if (seconds > RANK_SUBMIT_THRESHOLD_SECONDS) {
      setSubmitResult({
        accepted: true,
        enteredTop50: false,
        top50Cutoff: null,
        secondsBehindTop50: null,
        rejectedReason: null,
        playerName: isFullPlayerName(playerName) ? playerName : undefined,
        rank: null,
        beatPercent: null,
        totalPlayers: null,
      });
      return;
    }

    const rankedPlayerName = isFullPlayerName(playerName)
      ? playerName
      : createSessionPlayerName(cleanName(nameInput || "PLAYER"));
    if (!isFullPlayerName(rankedPlayerName)) return;

    if (rankedPlayerName !== playerName) {
      sessionStorage.setItem(PLAYER_KEY, rankedPlayerName);
      setHistory(loadPlayerStats(rankedPlayerName).history);
      setPlayerName(rankedPlayerName);
    }

    setIsSubmittingScore(true);
    setSubmitResult(null);

    if (!challengeIdRef.current && challengePromiseRef.current) {
      await challengePromiseRef.current;
    }

    if (!challengeIdRef.current) {
      challengePromiseRef.current = createServerChallenge();
      await challengePromiseRef.current;
    }

    if (!challengeIdRef.current) {
      setSubmitResult({
        accepted: false,
        enteredTop50: false,
        top50Cutoff: null,
        secondsBehindTop50: null,
        rejectedReason: "challenge_create_failed",
      });
      setIsSubmittingScore(false);
      return;
    }

    try {
      const response = await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: rankedPlayerName,
          mode,
          difficulty: "hard",
          challengeId: challengeIdRef.current,
          clientCompleteTime: Number(seconds.toFixed(5)),
          errors: Math.max(0, Math.min(errors, 999)),
          clickHistory: clickHistoryRef.current,
        }),
      });

      const data = (await response.json()) as SubmitScoreResult;
      setSubmitResult(data);

      if (data.playerName && isFullPlayerName(data.playerName)) {
        sessionStorage.setItem(PLAYER_KEY, data.playerName);
        if (data.playerName !== playerName) {
          setHistory(loadPlayerStats(data.playerName).history);
        }
        setPlayerName(data.playerName);
      }
    } catch {
      setSubmitResult({
        accepted: false,
        enteredTop50: false,
        top50Cutoff: null,
        secondsBehindTop50: null,
        rejectedReason: "submit_failed",
      });
    } finally {
      setIsSubmittingScore(false);
    }
  }

  function handleCellClick(number: number) {
    if (phase !== "running") return;

    clickHistoryRef.current.push({
      number,
      timestamp: performance.now(),
      expected: targetNumber,
      correct: number === targetNumber,
    });

    if (number !== targetNumber) {
      setErrors((value) => {
        const next = value + 1;

        if (next >= 10) {
          setPhase("finished");
          setInvalidMessage(t.tooManyErrors);
          startTimeRef.current = null;
        }

        return next;
      });

      setWrongNumber(number);
      window.setTimeout(() => setWrongNumber(null), 180);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= sequence.length) {
      const finalSeconds =
        startTimeRef.current !== null
          ? getElapsedSeconds(startTimeRef.current)
          : elapsed;

      setElapsed(finalSeconds);
      saveRecord(finalSeconds);
      void submitRankedScore(finalSeconds);
      recordFinishedGameForRestGuard();
      setPhase("finished");
      return;
    }

    setCurrentIndex(nextIndex);
  }

  function shareResultCard() {
    if (!lastRecord) return;

    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resultDifficulty =
      DIFFICULTIES.find((item) => item.key === lastRecord.difficulty) ??
      selectedDifficulty;
    const modeText = getModeLabel(lastRecord.mode, locale);
    const rankedText = isRankedMode(resultDifficulty.size, lastRecord.mode)
      ? t.rankedMode
      : t.practiceMode;
    const levelText = getAchievementDisplay(currentAchievement, locale);
    const shareBeatPercent = getBeatPercent(lastRecord.seconds).toFixed(1);

    function drawRoundRect(
      drawingContext: CanvasRenderingContext2D,
      x: number,
      y: number,
      rectWidth: number,
      rectHeight: number,
      radius: number,
    ) {
      const ctx = drawingContext;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + rectWidth - radius, y);
      ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
      ctx.lineTo(x + rectWidth, y + rectHeight - radius);
      ctx.quadraticCurveTo(
        x + rectWidth,
        y + rectHeight,
        x + rectWidth - radius,
        y + rectHeight,
      );
      ctx.lineTo(x + radius, y + rectHeight);
      ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    ctx.fillStyle = "#f8f8f7";
    ctx.fillRect(0, 0, width, height);

    drawRoundRect(ctx, 58, 58, width - 116, height - 116, 46);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#18181b";
    ctx.font = "800 56px Arial, sans-serif";
    ctx.fillText("Schulte Focus", width / 2, 190);

    ctx.fillStyle = "#71717a";
    ctx.font = "500 30px Arial, sans-serif";
    ctx.fillText(
      `${resultDifficulty.label} · ${modeText} · ${rankedText}`,
      width / 2,
      246,
    );

    drawRoundRect(ctx, 258, 302, 564, 78, 39);
    ctx.fillStyle = "#f4f4f5";
    ctx.fill();
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#52525b";
    ctx.font = "700 26px Arial, sans-serif";
    ctx.fillText(t.finalScore, width / 2, 352);

    ctx.fillStyle = "#09090b";
    ctx.font = "900 172px Arial, sans-serif";
    ctx.fillText(formatTime(lastRecord.seconds), width / 2, 560);

    ctx.fillStyle = "#71717a";
    ctx.font = "700 38px Arial, sans-serif";
    ctx.fillText(t.secondUnit, width / 2, 630);

    drawRoundRect(ctx, 132, 720, 392, 178, 34);
    ctx.fillStyle = "#fafafa";
    ctx.fill();
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#71717a";
    ctx.font = "600 28px Arial, sans-serif";
    ctx.fillText(t.currentLevel, 328, 784);
    ctx.fillStyle = "#18181b";
    ctx.font = "800 40px Arial, sans-serif";
    ctx.fillText(levelText, 328, 844);

    drawRoundRect(ctx, 556, 720, 392, 178, 34);
    ctx.fillStyle = "#fafafa";
    ctx.fill();
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#71717a";
    ctx.font = "600 28px Arial, sans-serif";
    ctx.fillText(t.beatPlayers, 752, 784);
    ctx.fillStyle = "#18181b";
    ctx.font = "900 54px Arial, sans-serif";
    ctx.fillText(`${shareBeatPercent}%`, 752, 852);

    if (ranked && resultDistanceStats.estimatedRank) {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "500 24px Arial, sans-serif";
      ctx.fillText(
        `${t.globalRank} #${resultDistanceStats.estimatedRank}`,
        width / 2,
        970,
      );
    }

    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(220, 1040);
    ctx.lineTo(860, 1040);
    ctx.stroke();

    ctx.fillStyle = "#52525b";
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText("Focus training · Taiwan ranking", width / 2, 1110);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "500 24px Arial, sans-serif";
    ctx.fillText("Designed for fast, clean sharing", width / 2, 1160);

    const link = document.createElement("a");
    link.download = `schulte-focus-${formatTime(lastRecord.seconds)}s.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <>
      {restGuardOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[2rem] border border-white/30 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-zinc-700/70 dark:bg-zinc-950/90">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Health Verification
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              你已經連續遊玩很多次了
            </h2>

            <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <p>為了保護眼睛，請先休息一下。</p>
              <p>請完成下方簡單驗證後再繼續。</p>
              <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                注意：連續答錯 5 次或 60 秒內未完成，系統可能暫時限制此裝置/IP。
              </p>
            </div>

            {restGuardMessage && (
              <div className="mt-4 whitespace-pre-line rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {restGuardMessage}
              </div>
            )}

            <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">請回答</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                {restGuardQuestion.text} = ?
              </p>
              <p className="mt-3 text-sm font-medium text-red-500">
                倒數計時：{restGuardSecondsLeft} 秒
              </p>
            </div>

            <input
              value={restGuardInput}
              onChange={(event) => setRestGuardInput(event.target.value)}
              inputMode="numeric"
              className="mt-5 h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-center text-lg font-semibold outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="輸入答案"
            />

            <button
              type="button"
              onClick={handleRestGuardSubmit}
              className="mt-4 h-12 w-full rounded-2xl bg-zinc-950 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98] dark:bg-white dark:text-zinc-950"
            >
              確認答案
            </button>
          </div>
        </div>
      )}

      {unlockedAchievement && (
        <div className="fixed left-4 right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[9999] mx-auto max-w-md animate-float-up rounded-3xl border border-zinc-200 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-3xl dark:bg-zinc-800">
              {unlockedAchievement.emoji}
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-500">
                {t.newAchievementUnlocked}
              </div>
              <div className="mt-1 text-2xl font-black text-zinc-950 dark:text-zinc-50">
                {getAchievementText(unlockedAchievement.name, locale)}
              </div>
            </div>
          </div>
        </div>
      )}
      {phase === "finished" && (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-zinc-200 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800 dark:bg-zinc-950/95">
          <button
            type="button"
            onClick={startTraining}
            className="mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-zinc-950 text-base font-black text-zinc-100 shadow-md active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-950"
          >
            🚀 {t.challengeAgain}
          </button>
        </div>
      )}
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f4f5_38%,#e4e4e7_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-zinc-950 antialiased dark:bg-[radial-gradient(circle_at_top,#18181b_0%,#09090b_52%,#000_100%)] dark:text-zinc-50">
        <style>{`
        @keyframes popIn { 0% { transform: scale(.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes recordFade { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes floatUp { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .animate-pop-in { animation: popIn .34s ease-out both; }
        .animate-float-up { animation: floatUp .38s ease-out both; }
        .animate-record-glow { animation: recordFade .35s ease-out both; }
        button, input, select { -webkit-tap-highlight-color: transparent; }
        html { overscroll-behavior-y: none; }
      `}</style>

        <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-3 sm:px-6 lg:px-8 lg:py-6">
          <header className="sticky top-0 z-50 -mx-3 mb-3 border-b border-zinc-200/70 bg-zinc-50/92 px-3 py-2 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/92 sm:static sm:mx-0 sm:mb-5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
                  Schulte Focus
                </p>
                <h1 className="truncate text-base font-black tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
                  台灣排名競賽
                </h1>
              </div>

              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(PLAYER_KEY);
                  setPlayerName("");
                  setNameInput("");
                  setHistory([]);
                  setLastRecord(null);
                  setSubmitResult(null);
                }}
                className="min-h-11 max-w-[46vw] rounded-2xl border border-zinc-200 bg-white px-3 text-right shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-[10px] font-semibold text-zinc-500">玩家</p>
                <p className="truncate text-xs font-black sm:text-sm">
                  {playerName || "設定名稱"}
                </p>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
              {(["announcement", "report", "support"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setHeaderPanel(headerPanel === item ? null : item)
                  }
                  className={`min-h-10 rounded-2xl border px-2 text-xs font-semibold transition active:scale-[0.98] ${
                    headerPanel === item
                      ? "border-zinc-400 bg-zinc-900/90 text-zinc-100 dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-950"
                      : "border-zinc-200 bg-white/80 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
                  }`}
                >
                  {item === "announcement"
                    ? t.announcement
                    : item === "report"
                      ? t.reportIssue
                      : t.support}
                </button>
              ))}
            </div>

            {headerPanel && (
              <div className="mt-3 rounded-3xl border border-zinc-200 bg-white/85 p-4 text-sm leading-6 text-zinc-600 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
                {headerPanel === "announcement" && (
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      {t.latestAnnouncement}
                    </h2>
                    <ul className="mt-3 space-y-1.5">
                      {t.announcementItems.slice(0, 6).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-zinc-500">
                      {t.updateDate}：2026/06/04
                    </p>
                  </div>
                )}

                {headerPanel === "report" && (
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      {t.reportTitle}
                    </h2>
                    <p className="mt-2">{t.reportText}</p>
                    <p className="mt-3 font-semibold">{t.supportEmail}</p>
                  </div>
                )}

                {headerPanel === "support" && (
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      {t.supportTitle}
                    </h2>
                    <p className="mt-2">{t.supportText}</p>
                    <p className="mt-3 rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500 dark:bg-zinc-950">
                      {t.supportPending}
                    </p>
                  </div>
                )}
              </div>
            )}
          </header>

          <section className="mb-3 w-full overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/85 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/85 sm:rounded-[2rem]">
            <div className="grid min-w-0 gap-0">
              <div className="relative min-w-0 overflow-hidden bg-zinc-950 p-4 text-white sm:p-7">
                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

                <div className="relative">
                  <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-200">
                    Schulte Focus Challenge
                  </div>

                  <h2 className="mt-3 max-w-2xl break-words text-2xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                    {t.heroTitle}
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
                    {t.heroDesc}
                  </p>

                  <div className="mt-4 min-w-0 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur sm:rounded-[1.75rem] sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-300">
                      🏆 {t.worldRecord}
                    </p>
                    <p className="mt-2 break-words text-3xl font-black leading-tight tracking-tight tabular-nums sm:text-5xl">
                      {formatSeconds(worldRecordTime, locale)}
                    </p>
                    <p className="mt-2 truncate text-sm text-zinc-300">
                      排行榜採手動更新，減少伺服器與資料庫負載
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
            <aside className="order-2 space-y-3 lg:order-1 lg:sticky lg:top-6">
              <Card title={t.worldLeaderboard}>
                <div className="space-y-3">
                  <select
                    value={leaderboardMode}
                    onChange={(event) => {
                      setLeaderboardMode(event.target.value as ModeKey);
                      setLeaderboardExpanded(false);
                    }}
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="standard">{t.standardRanking}</option>
                    <option value="reverse">{t.reverseRanking}</option>
                  </select>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="mb-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      排行榜已改為手動更新，減少伺服器與資料庫負載。
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        void refreshLeaderboardManually();
                      }}
                      disabled={isRefreshingLeaderboard}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white text-sm font-semibold transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      {isRefreshingLeaderboard ? "刷新中..." : "手動刷新排行榜"}
                    </button>
                  </div>

                  {!leaderboardLoaded ? (
                    <p className="rounded-2xl bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-500 dark:bg-zinc-950">
                      尚未載入排行榜。點擊上方「手動刷新排行榜」才會讀取資料。
                    </p>
                  ) : activeLeaderboard.length === 0 ? (
                    <p className="rounded-2xl bg-zinc-50 px-4 py-4 text-sm text-zinc-500 dark:bg-zinc-950">
                      {t.noScores}
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        {topThree.map((entry) => (
                          <TopHeroCard
                            key={`${entry.mode}-${entry.rank}-${entry.playerName}`}
                            entry={entry}
                            locale={locale}
                          />
                        ))}
                      </div>

                      {leaderboardExpanded && (
                        <div className="max-h-[560px] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                          {remainingLeaderboard.map((entry) => {
                            const gaps = getTopGap(entry, activeLeaderboard);
                            return (
                              <LeaderboardRow
                                key={`${entry.mode}-${entry.rank}-${entry.playerName}-${entry.time}`}
                                entry={entry}
                                gaps={gaps}
                                locale={locale}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {activeLeaderboard.length > 3 && (
                    <button
                      onClick={() => setLeaderboardExpanded((value) => !value)}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white text-sm font-semibold transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      {leaderboardExpanded ? t.topThree : t.top50}
                    </button>
                  )}
                </div>
              </Card>

              <Card title={t.rankRules}>
                <p className="text-sm leading-6 text-zinc-500">
                  {t.rankRulesText}
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {t.currentMode}：{ranked ? t.rankedMode : t.practiceMode}
                </p>
              </Card>

              <Card title={t.difficulty}>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTIES.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (difficulty !== item.key) {
                          resetTransientGameState();
                          setDifficulty(item.key);
                        }
                      }}
                      disabled={isLocked}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        difficulty === item.key
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950"
                      }`}
                    >
                      <span className="block font-medium">{item.label}</span>
                      <span className="text-xs opacity-70">
                        {item.size}×{item.size}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title={t.mode}>
                <div className="space-y-2">
                  {MODES.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (mode !== item.key) {
                          resetTransientGameState();
                          setMode(item.key);
                        }
                      }}
                      disabled={isLocked}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        mode === item.key
                          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950"
                      }`}
                    >
                      <span className="font-medium">
                        {getModeLabel(item.key, locale)}
                      </span>
                      <span className="text-xs opacity-70">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title={t.status}>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <Stat
                    label={t.time}
                    value={formatPreciseSeconds(elapsed, locale)}
                  />
                  <Stat label={t.errors} value={`${errors}`} />
                </div>
              </Card>
            </aside>

            <section className="order-1 min-w-0 lg:order-2">
              <div
                className={`mx-auto w-full max-w-[500px] rounded-[1.6rem] border border-white/80 bg-white/90 p-2 shadow-xl shadow-zinc-200/60 backdrop-blur-xl sm:max-w-[620px] sm:rounded-[2rem] sm:p-5 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-black/30 ${
                  phase === "finished"
                    ? "min-h-[520px] overflow-visible sm:min-h-[590px]"
                    : "aspect-square overflow-hidden"
                }`}
              >
                <div className="flex h-full w-full items-center justify-center">
                  {phase === "idle" && !hasPlayerName && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveName();
                      }}
                      className="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-zinc-50/90 px-5 text-center dark:bg-zinc-950/90"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.createIdentity}
                      </p>
                      <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-5xl">
                        {t.inputName}
                      </h2>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                        輸入英文暱稱後會直接進入倒數，不需要再往下滑。
                      </p>

                      <div className="mt-6 w-full max-w-sm space-y-3">
                        <input
                          value={nameInput}
                          onChange={(event) =>
                            setNameInput(cleanName(event.target.value))
                          }
                          placeholder={t.namePlaceholder}
                          autoComplete="off"
                          inputMode="text"
                          className="min-h-14 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-center text-lg font-black uppercase tracking-[0.12em] text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-800"
                        />

                        <button
                          type="submit"
                          disabled={!mounted || !cleanName(nameInput)}
                          suppressHydrationWarning
                          className="min-h-14 w-full rounded-2xl bg-zinc-900 px-5 text-base font-black text-zinc-100 shadow-lg shadow-zinc-900/15 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950"
                        >
                          {t.start}
                        </button>
                      </div>

                      <p className="mt-5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-500 shadow-sm dark:bg-zinc-900">
                        {t.challengeTagline}
                      </p>
                    </form>
                  )}

                  {phase === "idle" && hasPlayerName && (
                    <button
                      onClick={startTraining}
                      className="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-zinc-50/90 px-5 text-center transition hover:bg-zinc-100 active:scale-[0.995] dark:bg-zinc-950/90"
                    >
                      <p className="text-sm text-zinc-500">
                        {ranked ? t.rankedMode : t.practiceMode}
                      </p>
                      <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-6xl">
                        {t.startText}
                      </h2>
                      <p className="mt-4 text-sm text-zinc-500">
                        {`${selectedDifficulty.size}×${selectedDifficulty.size} · ${getModeLabel(mode, locale)}`}
                      </p>
                      <p className="mt-6 rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-500 shadow-sm dark:bg-zinc-900">
                        {playerName}
                      </p>
                    </button>
                  )}

                  {phase === "countdown" && (
                    <div className="text-center animate-pop-in">
                      <p className="text-8xl font-black tabular-nums sm:text-9xl">
                        {countdown === 0 ? "GO" : countdown}
                      </p>
                      <p className="mt-4 text-sm font-semibold text-zinc-500">
                        {t.prepareSearch} {targetNumber}
                      </p>
                    </div>
                  )}

                  {phase === "running" && (
                    <div
                      className="flex h-full w-full touch-none select-none items-center justify-center overscroll-none"
                      style={{
                        touchAction: "none",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }}
                    >
                      <div
                        className={`grid aspect-square touch-none select-none overscroll-none ${gridStyle.board} ${gridStyle.gap}`}
                        style={{
                          gridTemplateColumns: `repeat(${selectedDifficulty.size}, minmax(0, 1fr))`,
                          touchAction: "none",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                        }}
                      >
                        {gridNumbers.map((number) => {
                          const isCompleted = sequence
                            .slice(0, currentIndex)
                            .includes(number);
                          const isWrong = wrongNumber === number;

                          return (
                            <button
                              key={number}
                              type="button"
                              onPointerDown={(event) => {
                                event.preventDefault();
                                handleCellClick(number);
                              }}
                              onContextMenu={(event) => event.preventDefault()}
                              className={`flex aspect-square min-h-0 min-w-0 touch-none select-none items-center justify-center overflow-hidden border font-black tabular-nums shadow-sm transition active:scale-95 ${gridStyle.radius} ${gridStyle.text} ${
                                isCompleted
                                  ? "border-zinc-300 bg-zinc-200 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                                  : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950"
                              } ${isWrong ? "scale-95 border-red-400 bg-red-50 text-red-600 dark:bg-red-950" : ""}`}
                            >
                              {number}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {phase === "finished" && invalidMessage && (
                    <div className="w-full px-3 text-center animate-pop-in">
                      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        {invalidMessage}
                      </div>
                    </div>
                  )}

                  {phase === "finished" && lastRecord && (
                    <ResultHero
                      record={lastRecord}
                      ranked={ranked}
                      isSubmittingScore={isSubmittingScore}
                      submitResult={submitResult}
                      rank={resultDistanceStats.estimatedRank}
                      beatPercent={resultDistanceStats.beatPercent}
                      distanceToPrevious={
                        resultDistanceStats.distanceToPrevious
                      }
                      distanceToTop10={resultDistanceStats.distanceToTop10}
                      distanceToTop3={resultDistanceStats.distanceToTop3}
                      isNewPB={isNewPB}
                      pbDelta={pbDelta}
                      personalBestGap={personalBestGap}
                      achievement={currentAchievement}
                      title={currentResultHonorTitle}
                      playerName={submitResult?.playerName ?? playerName}
                      onShare={shareResultCard}
                      onRestart={startTraining}
                      unlockFlash={unlockFlash}
                      locale={locale}
                    />
                  )}
                </div>
              </div>
              {phase !== "finished" && hasPlayerName && (
                <button
                  onClick={isLocked ? resetTraining : startTraining}
                  className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto block w-auto max-w-[500px] rounded-2xl bg-zinc-900 px-5 py-4 text-sm font-black text-zinc-100 shadow-2xl transition active:scale-[0.98] hover:opacity-90 dark:bg-white dark:text-zinc-950 sm:static sm:mt-4 sm:w-full sm:max-w-[620px]"
                >
                  {isLocked ? t.stop : t.startTest}
                </button>
              )}
            </section>
          </div>
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card title={t.bestInCurrentMode}>
              {bestRecord ? (
                <div>
                  <p className="text-4xl font-semibold tabular-nums">
                    {formatPreciseSeconds(bestRecord.seconds, locale)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {selectedDifficulty.size}×{selectedDifficulty.size} ·{" "}
                    {getModeLabel(mode, locale)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t.noModeRecord}</p>
              )}
            </Card>

            <Card title={t.recentRecords}>
              {recentRecords.length > 0 ? (
                <div className="space-y-2">
                  {recentRecords.map((item) => {
                    const diff = DIFFICULTIES.find(
                      (d) => d.key === item.difficulty,
                    );
                    const modeLabel = MODES.find(
                      (m) => m.key === item.mode,
                    )?.label;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-950"
                      >
                        <span className="text-zinc-500">
                          {diff?.size}×{diff?.size} ·{" "}
                          {getModeLabel(item.mode, locale)}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatPreciseSeconds(item.seconds, locale)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t.recordAfterFinish}</p>
              )}
            </Card>
          </section>
          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            {ranked && (
              <Card title={t.achievements}>
                <div className="space-y-2">
                  {ACHIEVEMENTS.map((item) => {
                    const unlocked =
                      achievementBestTime !== null &&
                      achievementBestTime <= item.threshold;
                    const active = bestAchievement?.name === item.name;
                    return (
                      <div
                        key={item.name}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${active ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-50 dark:bg-zinc-950"}`}
                      >
                        <span className="font-semibold">
                          {unlocked
                            ? getAchievementDisplay(item, locale)
                            : `🔒 ${t.locked}`}
                        </span>

                        <span
                          className={
                            unlocked ? "font-semibold" : "text-zinc-500"
                          }
                        >
                          {unlocked ? t.unlocked : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {ranked && (
              <Card title={`🏅 ${t.myBadges}`}>
                <div className="space-y-2">
                  {badges.map((badge) => (
                    <div
                      key={badge.name}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${
                        badge.unlocked
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                          : "bg-zinc-50 text-zinc-400 dark:bg-zinc-950"
                      }`}
                    >
                      <span className="font-semibold">
                        {badge.unlocked
                          ? `${badge.emoji} ${badge.name}`
                          : `🔒 ${t.hiddenBadge}`}
                      </span>
                      <span className="text-xs font-semibold">
                        {badge.unlocked ? t.obtained : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          <section className="mx-auto mt-12 max-w-5xl space-y-8 px-4 md:px-0">
            <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
              <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl">
                {t.seoWhatTitle}
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                {t.seoWhatText}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t.seoAbilityTitle}
              </h3>
              <ul className="list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
                {t.seoAbilityItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t.seoAudienceTitle}
              </h3>
              <p className="mb-2 text-gray-700 dark:text-gray-300">
                {t.seoAudienceText1}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                {t.seoAudienceText2}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t.seoFeatureTitle}
              </h3>
              <ul className="list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300">
                {t.seoFeatureItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg dark:bg-gray-800">
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t.faqTitle}
              </h3>
              <div className="space-y-2">
                <details className="rounded-2xl bg-gray-100 p-3 dark:bg-gray-700">
                  <summary className="cursor-pointer font-medium">
                    {t.faqQ1}
                  </summary>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {t.faqA1}
                  </p>
                </details>
                <details className="rounded-2xl bg-gray-100 p-3 dark:bg-gray-700">
                  <summary className="cursor-pointer font-medium">
                    {t.faqQ2}
                  </summary>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {t.faqA2}
                  </p>
                </details>
                <details className="rounded-2xl bg-gray-100 p-3 dark:bg-gray-700">
                  <summary className="cursor-pointer font-medium">
                    {t.faqQ3}
                  </summary>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {t.faqA3}
                  </p>
                </details>
              </div>
            </div>
          </section>

          {/* SEO 內容區塊結束 */}
        </div>
      </main>
    </>
  );
}

function ResultHero({
  record,
  ranked,
  isSubmittingScore,
  submitResult,
  rank,
  beatPercent,
  distanceToPrevious,
  distanceToTop10,
  distanceToTop3,
  isNewPB,
  pbDelta,
  personalBestGap,
  achievement,
  title,
  playerName,
  onShare,
  onRestart,
  unlockFlash,
  locale,
}: {
  record: RecordItem;
  ranked: boolean;
  isSubmittingScore: boolean;
  submitResult: SubmitScoreResult | null;
  rank: number | null;
  beatPercent: number;
  distanceToPrevious: number | null;
  distanceToTop10: number | null;
  distanceToTop3: number | null;
  isNewPB: boolean;
  pbDelta: number | null;
  personalBestGap: number | null;
  achievement: Achievement | null;
  title: string;
  playerName: string;
  onShare: () => void;
  onRestart: () => void;
  unlockFlash: boolean;
  locale: LocaleKey;
}) {
  const t = getMessage(locale);
  const localBeatPercent = getBeatPercent(record.seconds);
  const levelText = getAchievementDisplay(achievement, locale);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "https://schulte-focus-wine.vercel.app/";
  const recordDifficulty =
    DIFFICULTIES.find((item) => item.key === record.difficulty) ??
    DIFFICULTIES[2];
  const recordModeLabel = getModeLabel(record.mode, locale);
  const practiceLabel = `${recordDifficulty.label} · ${recordModeLabel}`;
  const scoreText = formatTime(record.seconds);
  const shareText = `我在 Schulte Focus 完成 ${practiceLabel}，成績 ${formatSeconds(record.seconds, locale)}，擊敗玩家 ${localBeatPercent.toFixed(1)}%。`;

  function copyResultText() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
  }

  return (
    <div
      className={`flex min-h-[520px] w-full flex-col items-center justify-center px-3 py-6 text-center animate-pop-in ${
        unlockFlash ? "animate-record-glow" : ""
      }`}
    >
      <div className="w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white px-4 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:px-6 sm:py-6">
        {isNewPB && (
          <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-black tracking-[0.14em] text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            ✨ {t.newRecord}
            {pbDelta !== null && pbDelta > 0
              ? ` · ${t.fasterBy} ${formatSeconds(pbDelta, locale)}`
              : ""}
          </div>
        )}

        {!isNewPB && personalBestGap !== null && (
          <div className="mx-auto mb-4 inline-flex rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            {t.slowerThanBest} {formatSeconds(personalBestGap, locale)}
          </div>
        )}

        <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-400">
          {t.finalScore}
        </p>

        <div className="mt-2 flex items-end justify-center gap-2 tabular-nums">
          <h2 className="text-6xl font-black tracking-[-0.08em] text-zinc-950 dark:text-zinc-50 sm:text-7xl">
            {scoreText}
          </h2>
          <span className="mb-2 text-lg font-bold text-zinc-400">
            {t.secondUnit}
          </span>
        </div>

        <div className="mx-auto mt-5 grid w-full grid-cols-2 gap-2 text-left">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs font-semibold text-zinc-500">目前等級</p>
            <p className="mt-2 truncate text-xl font-black text-zinc-950 dark:text-zinc-50">
              {levelText}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs font-semibold text-zinc-500">擊敗玩家</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-zinc-950 dark:text-zinc-50">
              {localBeatPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {ranked && (
          <div className="mx-auto mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-xs font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
            排名資訊 #{record.seconds > RANK_SUBMIT_THRESHOLD_SECONDS ? "99+" : rank !== null ? rank : "計算中"}
          </div>
        )}

        {!isSubmittingScore && submitResult && !submitResult.accepted && (
          <div className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-center dark:border-red-500/30 dark:bg-red-950/20">
            <div className="text-sm font-bold text-red-600 dark:text-red-300">
              ⚠️ {t.suspiciousTitle}
            </div>
            <div className="mt-1 text-xs font-semibold text-red-500 dark:text-red-300">
              {t.invalidRecord} · {t.notRankedCalculation}
            </div>
          </div>
        )}

        <div className="mx-auto mt-5 grid w-full gap-2">
          <button
            onClick={onRestart}
            className="h-14 rounded-2xl bg-zinc-950 px-4 text-base font-black text-white shadow-md transition active:scale-[0.98] dark:bg-zinc-50 dark:text-zinc-950"
          >
            🚀 {t.challengeAgain}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onShare}
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {t.downloadCard}
            </button>
            <button
              onClick={copyResultText}
              className="h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {t.copyScore}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopHeroCard({
  entry,
  locale,
}: {
  entry: LeaderboardEntry;
  locale: LocaleKey;
}) {
  const t = getMessage(locale);
  const styles =
    entry.rank === 1
      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
      : "bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50";

  return (
    <div className={`rounded-3xl px-4 py-4 shadow-sm ${styles}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-3xl">{getRankLabel(entry.rank)}</span>
        <span className="text-xs font-semibold opacity-70">#{entry.rank}</span>
      </div>
      <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.16em] opacity-80 dark:bg-zinc-950/10">
        {entry.rank === 1
          ? "WORLD RECORD"
          : entry.rank <= 3
            ? "TOP 3"
            : entry.rank <= 10
              ? "TOP 10"
              : "TOP 50"}
      </p>
      <p className="mt-3 truncate text-lg font-black">{entry.playerName}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">
        {formatSeconds(entry.time, locale)}
      </p>
      <p className="mt-2 text-xs opacity-70">
        {t.update}：
        {formatDateTime(entry.updatedAt ?? entry.achievedAt, locale)}
      </p>
    </div>
  );
}

function LeaderboardRow({
  entry,
  gaps,
  locale,
}: {
  entry: LeaderboardEntry;
  gaps: { previous: number; top10: number; top3: number };
  locale: LocaleKey;
}) {
  const t = getMessage(locale);
  let chaseText = `${t.distancePrevious} ${formatDeltaLocalized(gaps.previous, locale)}`;

  if (entry.rank <= 10) {
    chaseText = `${t.fasterPrefix} ${formatDeltaLocalized(gaps.top3, locale)} ${t.enterTop3}`;
  } else {
    chaseText = `${t.fasterPrefix} ${formatDeltaLocalized(gaps.top10, locale)} ${t.enterTop10} · ${t.fasterPrefix} ${formatDeltaLocalized(gaps.top3, locale)} ${t.enterTop3}`;
  }

  return (
    <div className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-base font-black tabular-nums">
          #{entry.rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {entry.playerName}
          </span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">
            {t.update}：
            {formatDateTime(entry.updatedAt ?? entry.achievedAt, locale)}
          </span>
        </span>
        <span className="shrink-0 font-black tabular-nums">
          {formatSeconds(entry.time, locale)}
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-zinc-500">
        {chaseText}
      </p>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-xl font-black tracking-tight tabular-nums sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
function formatTimeDisplay(seconds: number) {
  if (!Number.isFinite(seconds)) return "--";

  const str = seconds.toFixed(5);

  // 如果最後兩位是 00，用「偽尾數」補最後一位
  if (str.endsWith("00")) {
    const fakeDigit = Math.abs(Math.floor(seconds * 1000000)) % 10;
    return str.slice(0, -1) + fakeDigit;
  }

  return str;
}
