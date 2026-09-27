/* ============================================================
   ReelHub - app.js  PART 1/3  (Refactored / Cleaned)
   Same behavior & identifiers as before — formatting,
   structure and minor redundancies cleaned up only.
   No new features added.
============================================================ */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ============================================================
   FIREBASE CONFIG
============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyCAiAXZjIFcbmueefZpx1SXc-_ELa57-rE",
  authDomain: "reelhu.firebaseapp.com",
  projectId: "reelhu",
  storageBucket: "reelhu.firebasestorage.app",
  messagingSenderId: "883255506643",
  appId: "1:883255506643:web:600256ed9bb47a4f828626",
  measurementId: "G-FY9N5XNF6Z"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ============================================================
   CONFIG
============================================================ */

const CLOUDINARY_CLOUD_NAME = "s3eresx6";
const CLOUDINARY_UPLOAD_PRESET = "reelhub_upload";

const ADMIN_EMAILS = [
  "appcreator001.harshitkumar@gmail.com",
  "satender8510815609@gmail.com"
];

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORY_DURATION_IMAGE = 5000;
const STORY_DURATION_VIDEO_MAX = 15000;

const VAULT_AUTO_LOCK_MS = 5 * 60 * 1000;
const VAULT_MAX_FILE_SIZE = 30 * 1024 * 1024;
const VAULT_MAX_FILES = 100;

const MESSAGE_COOLDOWN = 1500;
const GROUP_MAX_MEMBERS = 100;

const GROUP_MAX_PDF_SIZE = 50 * 1024 * 1024;
const GROUP_MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const GROUP_MAX_PHOTO_SIZE = 20 * 1024 * 1024;

const MONETIZATION_REQUIREMENTS = {
  followers: 10,
  watchTime: 3600,
  views: 50
};

/* ============================================================
   GLOBAL STATE
   (kept flat & identically named — Parts 2 & 3 depend on these)
============================================================ */

let currentUser = null;
let currentProfile = null;

let videosCache = [];
let myFollowsCache = new Set();
let mySavesCache = new Set();
let myChatsCache = [];
let myPlaylistsCache = [];
let myFollowRequestsCache = [];
let mySentRequestsCache = new Set();
let blockedUsersCache = new Set();

let watchHistoryCache = [];
let continueWatchingCache = [];

let videosUnsubscribe = null;
let notificationsUnsubscribe = null;
let commentsUnsubscribe = null;
let chatUnsubscribe = null;
let chatsListUnsubscribe = null;
let playlistsUnsubscribe = null;
let presenceUnsubscribe = null;
let followRequestsUnsubscribe = null;
let storiesUnsubscribe = null;
let vaultUnsubscribe = null;

let heartbeatInterval = null;
let blockedUsersUnsubscribe = null;
let watchHistoryUnsubscribe = null;

let onlineUsersCache = {};
let unreadChatsCache = {};
let chatLastReadCache = {};

let currentCommentVideoId = null;
let currentChatId = null;
let currentChatUser = null;

let shareVideoId = null;

let uploadVisibility = "public";
let uploadType = "long";
let uploadCategory = "all";

let currentProfileTab = "videos";
let currentPlaylistVideoId = null;
let selectedPlaylists = new Set();
let currentPlaylistView = null;

let deepLinkChecked = false;
let viewingProfileUid = null;

let uploadContentType = "video";
let pendingThumbnailFile = null;

let pendingVideoFilter = "none";
let pendingVideoSpeed = 1;
let pendingTextOverlay = "";
let pendingTextPosition = "top";

let videoMenuVideoId = null;

let reportTargetType = "video";
let reportTargetId = null;

let currentCategory = "all";

let storiesCache = [];
let groupedStories = [];

let currentStoryUserIndex = 0;
let currentStoryIndex = 0;

let storyProgressRAF = null;
let storyPaused = false;
let storyStartTime = 0;
let storyDuration = 5000;
let storyElapsed = 0;

let storyUploadFile = null;
let storyMediaType = null;
let currentStoryId = null;
let currentStoryData = null;

let pendingStorySong = null;
let pendingStorySticker = null;

let pendingStoryTrim = { start: 0, end: 0, applied: false };

let pendingVideoSong = null;
let pendingVideoSticker = null;

let pendingVideoTrim = { start: 0, end: 0, applied: false };

let pendingVideoRotation = 0;
let pendingVideoMuted = false;

let trimVideoElement = null;
let trimVideoDuration = 0;

let myGroupsCache = [];
let currentGroupId = null;
let currentGroupData = null;
let groupJoinRequestsCache = [];

let myGroupsUnsubscribe = null;
let groupRequestsUnsubscribe = null;
let groupChatUnsubscribe = null;

let songLibraryCache = [];
let songLibraryUnsubscribe = null;

let selectedSongForApply = null;
let songPickerContext = null;

let stickerPickerContext = null;
let selectedStickerColor = "#ffffff";
let selectedStickerEmoji = null;

let previewAudio = null;
let editingSongId = null;
let pendingSongFile = null;

let modalHistoryStack = [];

let vaultPinVerified = false;
let vaultUnlockTime = 0;
let vaultAutoLockEnabled = true;
let vaultFilesCache = [];
let vaultUploading = false;

let splashHidden = false;
let authResolved = false;

const presenceListenersMap = new Map();
const processingMessages = new Set();

let lastSentMessageTime = 0;

const processingLikes = new Set();
const processingViews = new Set();
const processingSaves = new Set();

let currentWatchSession = { videoId: null, startTime: null };

let adSettings = {
  masterDisabled: false,
  typeDisabled: { banner: false, popup: false, video: false },
  userDisabled: {}
};

let adSettingsUnsubscribe = null;
let userAdsUnsubscribe = null;

/* ============================================================
   HELPER
============================================================ */

const $ = id => document.getElementById(id);

/* ============================================================
   STARTUP / SPLASH
============================================================ */

function hideSplash(force = false) {
  if (splashHidden && !force) return;
  splashHidden = true;

  document.body.classList.add("app-ready");

  const splash = $("splashScreen");
  if (!splash) return;

  splash.classList.add("fade-out");
  setTimeout(() => {
    try { splash.remove(); } catch (e) {}
  }, 500);
}

/* ============================================================
   LOGIN SCREEN
============================================================ */

function showLoginScreen() {
  const login = $("loginPage");
  const appEl = $("app");

  if (appEl) {
    appEl.classList.add("hidden");
    appEl.style.display = "none";
  }

  if (login) {
    login.classList.remove("hidden");
    login.style.display = "flex";
  }

  hideSplash(true);

  console.log("✅ Login screen visible");
}

function hideLoginScreen() {
  const login = $("loginPage");
  if (!login) return;

  login.classList.add("hidden");
  login.style.display = "none";
}

function forceShowLogin() {
  showLoginScreen();
}
window.forceShowLogin = forceShowLogin;

/* ============================================================
   BASIC HELPERS
============================================================ */

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeValue(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();

  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function avatar(url, name) {
  if (url) return url;
  return "https://ui-avatars.com/api/?name=" +
    encodeURIComponent(name || "User") +
    "&background=7c3aed&color=fff";
}

function toast(msg) {
  const el = $("toast");
  if (!el) {
    console.log(msg);
    return;
  }

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

function timeAgo(v) {
  const t = timeValue(v);
  if (!t) return "";

  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m";

  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h";

  const day = Math.floor(hr / 24);
  if (day < 7) return day + "d";

  const wk = Math.floor(day / 7);
  if (wk < 4) return wk + "w";

  return new Date(t).toLocaleDateString();
}

function timeAgoShort(v) {
  const t = timeValue(v);
  if (!t) return "";

  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "now";

  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m";

  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h";

  return Math.floor(hr / 24) + "d";
}

function timeAgoYouTube(v) {
  const t = timeValue(v);
  if (!t) return "";

  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return min + " minutes ago";

  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + " hours ago";

  const day = Math.floor(hr / 24);
  if (day < 7) return day + " days ago";

  const wk = Math.floor(day / 7);
  if (wk < 4) return wk + " weeks ago";

  const mo = Math.floor(day / 30);
  if (mo < 12) return mo + " months ago";

  return Math.floor(day / 365) + " years ago";
}

function formatViews(num) {
  num = Number(num || 0);
  if (num < 1000) return num + " views";
  if (num < 1000000) return (num / 1000).toFixed(1).replace(".0", "") + "K views";
  if (num < 1000000000) return (num / 1000000).toFixed(1).replace(".0", "") + "M views";
  return (num / 1000000000).toFixed(1) + "B views";
}

function formatViewsShort(num) {
  num = Number(num || 0);
  if (num < 1000) return String(num);
  if (num < 1000000) return (num / 1000).toFixed(1).replace(".0", "") + "K";
  if (num < 1000000000) return (num / 1000000).toFixed(1).replace(".0", "") + "M";
  return (num / 1000000000).toFixed(1) + "B";
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";

  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));

  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function getFileIcon(fileName, fileType) {
  const name = (fileName || "").toLowerCase();
  const type = (fileType || "").toLowerCase();

  if (type.includes("pdf") || name.endsWith(".pdf")) return { icon: "📄", cls: "pdf" };
  if (name.endsWith(".doc") || name.endsWith(".docx")) return { icon: "📝", cls: "doc" };
  if (name.endsWith(".zip") || name.endsWith(".rar")) return { icon: "🗜️", cls: "zip" };
  if (
    name.endsWith(".ppt") || name.endsWith(".pptx") ||
    name.endsWith(".xls") || name.endsWith(".xlsx")
  ) return { icon: "📊", cls: "doc" };
  if (name.endsWith(".txt")) return { icon: "📃", cls: "other" };

  return { icon: "📎", cls: "other" };
}

function isAdminUser() {
  return !!(
    currentUser &&
    currentUser.email &&
    ADMIN_EMAILS.includes(currentUser.email.toLowerCase())
  );
}

function isUserBlocked(uid) {
  return !!(uid && blockedUsersCache.has(uid));
}

/* ============================================================
   ADS
============================================================ */

function canShowAd(adType, userId) {
  if (adSettings.masterDisabled === true) return false;
  if (userId && adSettings.userDisabled[userId] === true) return false;
  if (adType && adSettings.typeDisabled[adType] === true) return false;
  return true;
}

window.showMyAd = function (adType, targetUserId, adCallback) {
  if (!canShowAd(adType, targetUserId || currentUser?.uid)) return;
  if (typeof adCallback === "function") adCallback();
};

function startAdSettingsListener() {
  if (adSettingsUnsubscribe) {
    try { adSettingsUnsubscribe(); } catch (e) {}
    adSettingsUnsubscribe = null;
  }

  if (userAdsUnsubscribe) {
    try { userAdsUnsubscribe(); } catch (e) {}
    userAdsUnsubscribe = null;
  }

  adSettingsUnsubscribe = onSnapshot(
    doc(db, "ad_settings", "global"),
    snap => {
      if (!snap.exists()) return;
      const d = snap.data();

      adSettings.masterDisabled = d.masterDisabled === true;
      adSettings.typeDisabled = {
        banner: false,
        popup: false,
        video: false,
        ...(d.typeDisabled || {})
      };
    },
    error => console.error("Ad settings listener error:", error)
  );

  userAdsUnsubscribe = onSnapshot(
    collection(db, "ad_settings", "global", "users"),
    snap => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data().disabled === true; });
      adSettings.userDisabled = map;
    },
    error => console.error("User ads listener error:", error)
  );
}

/* ============================================================
   MODALS
============================================================ */

function showModal(id) {
  const el = $(id);
  if (!el || el.classList.contains("show")) return;

  el.classList.add("show");

  try {
    window.history.pushState({ modalId: id, reelhubModal: true }, "", window.location.href);
    modalHistoryStack.push(id);
  } catch (e) {}
}

function hideModal(id) {
  const el = $(id);
  if (!el || !el.classList.contains("show")) return;

  el.classList.remove("show");

  const idx = modalHistoryStack.indexOf(id);
  if (idx > -1) modalHistoryStack.splice(idx, 1);

  if (id === "videoPlayerModal") {
    const videoEl = $("videoPlayerVideo");

    if (videoEl) {
      try { videoEl.pause(); } catch (e) {}
      videoEl.src = "";
      videoEl.style.transform = "";
      videoEl.muted = false;
    }

    if (window.__videoAudio) {
      try { window.__videoAudio.pause(); } catch (e) {}
      window.__videoAudio = null;
    }
  }
}

/* ============================================================
   SUSPENSION
============================================================ */

function showSuspensionScreen(profile) {
  const screen = $("suspensionScreen");
  if (!screen) return;

  const reason = profile.suspendReason || "Violation of Terms";
  const duration = profile.suspendDuration || "Temporary";

  const dateOpts = { day: "numeric", month: "short", year: "numeric" };

  const until = profile.suspendUntil
    ? new Date(timeValue(profile.suspendUntil)).toLocaleDateString("en-IN", dateOpts)
    : "Permanent";

  const date = profile.suspendedAt
    ? new Date(timeValue(profile.suspendedAt)).toLocaleDateString("en-IN", dateOpts)
    : "—";

  if ($("suspensionReason")) $("suspensionReason").textContent = reason;
  if ($("suspensionDuration")) $("suspensionDuration").textContent = duration;
  if ($("suspensionUntil")) $("suspensionUntil").textContent = until;
  if ($("suspensionDate")) $("suspensionDate").textContent = date;

  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");

  hideSplash();

  screen.classList.remove("hidden");
}

async function checkSuspension(uid) {
  if (!uid) return false;

  try {
    // Profile document ID == UID, so a direct doc lookup is enough (no query needed).
    const ref = doc(db, "profiles", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return false;

    const profileData = snap.data();
    if (profileData.suspended !== true) return false;

    if (profileData.suspendUntil) {
      const untilTime = timeValue(profileData.suspendUntil);

      if (untilTime && Date.now() > untilTime) {
        // Expired suspension — try to auto-clear it, but don't block login
        // if Firestore rules reject the write.
        try {
          await updateDoc(ref, {
            suspended: false,
            suspendReason: "",
            suspendDuration: "",
            suspendUntil: null,
            autoUnsuspendedAt: serverTimestamp()
          });
        } catch (updateError) {
          console.warn("Auto-unsuspend update failed:", updateError);
        }

        return false;
      }
    }

    showSuspensionScreen(profileData);
    return true;

  } catch (e) {
    console.error("Suspension check error:", e);
    // A Firebase error here should never leave the user on a permanent blank screen.
    return false;
  }
}

/* ============================================================
   SUSPENSION LOGOUT
============================================================ */

$("suspensionLogoutBtn")?.addEventListener("click", async () => {
  if (!confirm("Logout?")) return;

  try {
    await signOut(auth);
    window.location.reload();
  } catch (e) {
    console.error("Suspension logout error:", e);
  }
});

/* ============================================================
   WATCH TIME
============================================================ */

function startWatchTimer(videoId) {
  if (!currentUser || !videoId) return;

  if (currentWatchSession.videoId === videoId && currentWatchSession.startTime) return;

  if (currentWatchSession.videoId && currentWatchSession.startTime) {
    stopWatchTimer();
  }

  currentWatchSession = { videoId, startTime: Date.now() };
}

async function stopWatchTimer() {
  if (!currentWatchSession.videoId || !currentWatchSession.startTime) return;

  if (!currentUser) {
    currentWatchSession = { videoId: null, startTime: null };
    return;
  }

  const elapsed = Math.floor((Date.now() - currentWatchSession.startTime) / 1000);
  const videoId = currentWatchSession.videoId;

  currentWatchSession = { videoId: null, startTime: null };

  if (elapsed < 3) return;

  try {
    const videoRef = doc(db, "videos", videoId);
    const videoSnap = await getDoc(videoRef);

    if (!videoSnap.exists()) return;

    const data = videoSnap.data();
    const ownerId = data.userId;

    if (!ownerId || ownerId === currentUser.uid) return;

    await updateDoc(videoRef, { watchTime: increment(elapsed) });

    try {
      await updateDoc(doc(db, "profiles", ownerId), {
        totalWatchTime: increment(elapsed)
      });
    } catch (profileError) {
      console.warn("Watch time profile update failed:", profileError);
    }

  } catch (e) {
    console.warn("Watch timer save failed:", e);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") stopWatchTimer();
});

// pagehide is more reliable than beforeunload on mobile browsers.
window.addEventListener("pagehide", () => stopWatchTimer());

/* ============================================================
   CLOUDINARY UPLOAD
============================================================ */

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }

    let resource = "image";
    if (file.type && file.type.startsWith("video/")) {
      resource = "video";
    } else if (!file.type || !file.type.startsWith("image/")) {
      resource = "raw";
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resource}/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.timeout = 5 * 60 * 1000;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);

          if (!result.secure_url) {
            reject(new Error("Cloudinary URL missing"));
            return;
          }

          resolve(result.secure_url);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error("Upload failed: " + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timeout"));

    xhr.upload.onprogress = event => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("file", file);

    xhr.send(form);
  });
}

function uploadAudioToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No audio file selected"));
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.timeout = 5 * 60 * 1000;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);

          if (!result.secure_url) {
            reject(new Error("Audio URL missing"));
            return;
          }

          resolve(result.secure_url);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error("Audio upload failed: " + xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Audio upload timeout"));

    xhr.upload.onprogress = event => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("resource_type", "video");
    form.append("file", file);

    xhr.send(form);
  });
}

/* ============================================================
   AUTH TABS
============================================================ */

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;

    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    if (tabName === "login") {
      $("loginForm")?.classList.remove("hidden");
      $("signupForm")?.classList.add("hidden");
    } else {
      $("loginForm")?.classList.add("hidden");
      $("signupForm")?.classList.remove("hidden");
    }

    const status = $("loginStatus");
    if (status) {
      status.textContent = "";
      status.style.color = "#ed4956";
    }
  });
});

/* ============================================================
   EMAIL LOGIN
============================================================ */

$("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const email = $("loginEmail")?.value?.trim();
  const password = $("loginPassword")?.value || "";
  const status = $("loginStatus");

  if (!email || !password) {
    if (status) {
      status.textContent = "Email and password required";
      status.style.color = "#ed4956";
    }
    return;
  }

  if (status) {
    status.textContent = "Logging in...";
    status.style.color = "#7c3aed";
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);

    if (status) {
      status.textContent = "Login successful!";
      status.style.color = "#22c55e";
    }
  } catch (err) {
    console.error("Login error:", err);

    if (status) {
      status.textContent = getAuthError(err.code);
      status.style.color = "#ed4956";
    }
  }
});

/* ============================================================
   SIGNUP
============================================================ */

$("signupForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("signupName")?.value?.trim();
  const email = $("signupEmail")?.value?.trim();
  const password = $("signupPassword")?.value || "";
  const status = $("loginStatus");

  if (!name || !email || !password) {
    if (status) {
      status.textContent = "All fields required";
      status.style.color = "#ed4956";
    }
    return;
  }

  if (password.length < 6) {
    if (status) {
      status.textContent = "Password must be 6+ chars";
      status.style.color = "#ed4956";
    }
    return;
  }

  if (status) {
    status.textContent = "Creating account...";
    status.style.color = "#7c3aed";
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCred.user, { displayName: name });

    try {
      await sendEmailVerification(userCred.user);
    } catch (verificationError) {
      console.warn("Verification email failed:", verificationError);
    }

    if (status) {
      status.textContent = "✅ Account created!";
      status.style.color = "#22c55e";
    }
  } catch (err) {
    console.error("Signup error:", err);

    if (status) {
      status.textContent = getAuthError(err.code);
      status.style.color = "#ed4956";
    }
  }
});

/* ============================================================
   FORGOT PASSWORD
============================================================ */

$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail")?.value?.trim();
  const status = $("loginStatus");

  if (!email) {
    if (status) {
      status.textContent = "Enter your email first";
      status.style.color = "#ed4956";
    }
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    if (status) {
      status.textContent = "✅ Reset email sent!";
      status.style.color = "#22c55e";
    }

    setTimeout(() => {
      if (status) status.style.color = "#ed4956";
    }, 4000);

  } catch (err) {
    console.error("Reset error:", err);

    if (status) {
      status.textContent = getAuthError(err.code);
      status.style.color = "#ed4956";
    }
  }
});

/* ============================================================
   AUTH ERROR
============================================================ */

function getAuthError(code) {
  const errors = {
    "auth/email-already-in-use": "This email is already registered",
    "auth/invalid-email": "Invalid email address",
    "auth/weak-password": "Password too weak (min 6 characters)",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/invalid-credential": "Invalid email or password",
    "auth/too-many-requests": "Too many attempts. Try again later",
    "auth/network-request-failed": "Network error. Check your internet",
    "auth/user-disabled": "This account has been disabled",
    "auth/operation-not-allowed": "Email/Password login is not enabled",
    "auth/popup-closed-by-user": "Google login cancelled",
    "auth/popup-blocked": "Google popup was blocked. Allow popups",
    "auth/unauthorized-domain": "This website is not authorized in Firebase",
    "auth/account-exists-with-different-credential": "This email already uses another login method"
  };

  return errors[code] || "Something went wrong. Please try again";
}

/* ============================================================
   GOOGLE LOGIN
============================================================ */

function attachGoogleLogin() {
  const btn = document.getElementById("googleLogin");

  if (!btn) {
    console.warn("Google login button not found");
    return false;
  }

  if (btn.dataset.listenerAttached === "1") return true;
  btn.dataset.listenerAttached = "1";

  btn.addEventListener("click", async e => {
    e.preventDefault();
    e.stopPropagation();

    const status = document.getElementById("loginStatus");

    if (status) {
      status.textContent = "Opening Google...";
      status.style.color = "#7c3aed";
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await signInWithPopup(auth, provider);

      if (status) {
        status.textContent = "✅ Login successful!";
        status.style.color = "#22c55e";
      }
    } catch (error) {
      console.error("Google login error:", error);

      if (status) {
        status.textContent = getAuthError(error.code);
        status.style.color = "#ed4956";
      }
      // No alert() here on purpose — keeps the mobile UI clean.
    }
  });

  return true;
}

/* ============================================================
   GOOGLE BUTTON INITIALIZATION
============================================================ */

function initGoogleLogin() {
  if (attachGoogleLogin()) return;

  setTimeout(attachGoogleLogin, 500);
  setTimeout(attachGoogleLogin, 1500);
  setTimeout(attachGoogleLogin, 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGoogleLogin, { once: true });
} else {
  initGoogleLogin();
}

/* ============================================================
   PROFILE
============================================================ */

async function createProfile() {
  if (!currentUser) return;

  const ref = doc(db, "profiles", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const displayName = currentUser.displayName ||
    (currentUser.email ? currentUser.email.split("@")[0] : "User");

  let username = displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (!username) username = "user" + Date.now().toString().slice(-6);

  await setDoc(ref, {
    uid: currentUser.uid,
    name: displayName,
    username,

    age: "",
    gender: "",
    bio: "",

    photo: currentUser.photoURL || "",

    followers: 0,
    following: 0,
    videos: 0,

    private: false,
    suspended: false,

    suspendReason: "",
    suspendDuration: "",
    suspendUntil: null,
    suspendedAt: null,

    bannerType: "gradient",
    bannerGradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
    bannerURL: "",

    vaultPin: "",
    vaultEnabled: false,

    totalWatchTime: 0,
    totalViews: 0,

    monetizationStatus: "none",
    upiId: "",

    pinnedVideos: [],

    createdAt: serverTimestamp()
  });
}

/* ============================================================
   GET PROFILE
============================================================ */

function defaultProfile(uid = "") {
  return {
    uid,
    name: "User",
    username: "user",
    age: "",
    gender: "",
    bio: "",
    photo: "",
    followers: 0,
    following: 0,
    videos: 0,
    private: false,
    suspended: false,
    bannerType: "gradient",
    bannerGradient: "linear-gradient(135deg,#7c3aed,#ec4899)",
    bannerURL: "",
    vaultPin: "",
    vaultEnabled: false,
    totalWatchTime: 0,
    totalViews: 0,
    monetizationStatus: "none",
    upiId: "",
    pinnedVideos: []
  };
}

async function getProfile(uid) {
  if (!uid) return defaultProfile();

  const snap = await getDoc(doc(db, "profiles", uid));
  if (!snap.exists()) return defaultProfile(uid);

  const d = snap.data();

  return {
    uid,
    ...d,
    followers: Number(d.followers || 0),
    following: Number(d.following || 0),
    videos: Number(d.videos || 0),
    private: d.private === true,
    suspended: d.suspended === true,
    bannerType: d.bannerType || "gradient",
    bannerGradient: d.bannerGradient || "linear-gradient(135deg,#7c3aed,#ec4899)",
    bannerURL: d.bannerURL || "",
    vaultPin: d.vaultPin || "",
    vaultEnabled: d.vaultEnabled === true,
    totalWatchTime: Number(d.totalWatchTime || 0),
    totalViews: Number(d.totalViews || 0),
    monetizationStatus: d.monetizationStatus || "none",
    upiId: d.upiId || "",
    pinnedVideos: Array.isArray(d.pinnedVideos) ? d.pinnedVideos : []
  };
}

/* ============================================================
   LOAD MY PROFILE
============================================================ */

async function loadProfile() {
  if (!currentUser) return;

  currentProfile = await getProfile(currentUser.uid);

  if ($("profileName")) $("profileName").textContent = currentProfile.name || "User";
  if ($("profileUsername")) $("profileUsername").textContent = "@" + (currentProfile.username || "user");

  if ($("profilePhoto")) {
    $("profilePhoto").src = avatar(currentProfile.photo, currentProfile.name);
  }

  if ($("navProfileAvatar")) {
    $("navProfileAvatar").src = avatar(currentProfile.photo, currentProfile.name);
  }

  if ($("followersCount")) $("followersCount").textContent = currentProfile.followers || 0;
  if ($("followingCount")) $("followingCount").textContent = currentProfile.following || 0;
  if ($("videosCount")) $("videosCount").textContent = currentProfile.videos || 0;

  const extra = [];
  if (currentProfile.age) extra.push("Age: " + currentProfile.age);
  if (currentProfile.gender) extra.push(currentProfile.gender);

  if ($("profileExtra")) $("profileExtra").textContent = extra.join(" · ");
  if ($("profileBio")) $("profileBio").textContent = currentProfile.bio || "";

  if (typeof updatePrivateToggleUI === "function") updatePrivateToggleUI();
}

function updatePrivateToggleUI() {
  const toggle = $("privateAccountToggle");
  if (!toggle) return;

  if (currentProfile?.private) {
    toggle.textContent = "ON";
    toggle.style.color = "#22c55e";
  } else {
    toggle.textContent = "OFF";
    toggle.style.color = "var(--muted)";
  }
}

/* ============================================================
   LOAD FOLLOWS
============================================================ */

async function loadMyFollows() {
  if (!currentUser) return;

  myFollowsCache = new Set();

  try {
    const snap = await getDocs(
      query(collection(db, "follows"), where("follower", "==", currentUser.uid))
    );

    snap.forEach(d => {
      const data = d.data();
      if (data.following) myFollowsCache.add(data.following);
    });
  } catch (e) {
    console.warn("Load follows failed:", e);
  }
}

/* ============================================================
   LOAD SAVES
============================================================ */

async function loadMySaves() {
  if (!currentUser) return;

  mySavesCache = new Set();

  try {
    const snap = await getDocs(
      query(collection(db, "saves"), where("userId", "==", currentUser.uid))
    );

    snap.forEach(d => {
      const data = d.data();
      if (data.videoId) mySavesCache.add(data.videoId);
    });
  } catch (e) {
    console.warn("Load saves failed:", e);
  }
}

/* ============================================================
   LOAD SENT REQUESTS
============================================================ */

async function loadMySentRequests() {
  if (!currentUser) return;

  mySentRequestsCache = new Set();

  try {
    const snap = await getDocs(
      query(collection(db, "follow_requests"), where("from", "==", currentUser.uid))
    );

    snap.forEach(d => {
      const data = d.data();
      if (data.to) mySentRequestsCache.add(data.to);
    });
  } catch (e) {
    console.warn("Load sent requests failed:", e);
  }
}

/* ============================================================
   BLOCKED USERS
============================================================ */

async function loadBlockedUsers() {
  if (!currentUser) return;

  blockedUsersCache = new Set();

  try {
    const snap = await getDocs(
      query(collection(db, "blocked_users"), where("blockerId", "==", currentUser.uid))
    );

    snap.forEach(d => {
      const data = d.data();
      if (data.blockedId) blockedUsersCache.add(data.blockedId);
    });
  } catch (e) {
    console.warn("Load blocked users failed:", e);
  }
}

/* ============================================================
   WATCH HISTORY
============================================================ */

async function loadWatchHistory() {
  if (!currentUser) return;

  watchHistoryCache = [];
  continueWatchingCache = [];

  try {
    const snap = await getDocs(
      query(collection(db, "watch_history"), where("userId", "==", currentUser.uid))
    );

    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    items.sort((a, b) => timeValue(b.watchedAt) - timeValue(a.watchedAt));

    watchHistoryCache = items;

    continueWatchingCache = items
      .filter(i => i.progress > 3 && i.duration > 0 && i.progress < (i.duration - 5))
      .slice(0, 10);

  } catch (e) {
    console.warn("Watch history failed:", e);
  }
}

/* ============================================================
   PRESENCE CLEANUP
============================================================ */

function stopAllPresenceListeners() {
  presenceListenersMap.forEach(unsub => {
    try { unsub(); } catch (e) {}
  });

  presenceListenersMap.clear();
}

/* ============================================================
   AUTH STATE
============================================================ */

onAuthStateChanged(auth, async user => {
  console.log("🔐 Auth state changed:", user ? "user found" : "no user");

  if (user) {
    currentUser = user;

    // Suspension check happens before anything else.
    const isSuspended = await checkSuspension(user.uid);

    if (isSuspended) {
      hideSplash();
      authResolved = true;
      return;
    }

    hideLoginScreen();

    const appEl = $("app");
    if (appEl) {
      appEl.classList.remove("hidden");
      appEl.style.display = "block";
    }

    hideSplash();

    // Profile/data initialization — one failure should never blank the whole app.
    try { await createProfile(); } catch (e) { console.error("Create profile error:", e); }
    try { await loadProfile(); } catch (e) { console.error("Load profile error:", e); }
    try { await loadMyFollows(); } catch (e) { console.error("Load follows error:", e); }
    try { await loadMySaves(); } catch (e) { console.error("Load saves error:", e); }
    try { await loadMySentRequests(); } catch (e) { console.error("Load requests error:", e); }
    try { await loadBlockedUsers(); } catch (e) { console.error("Load blocked users error:", e); }
    try { await loadWatchHistory(); } catch (e) { console.error("Load history error:", e); }

    // Part 2 / Part 3 functions (guarded — may not be loaded yet).
    try {
      if (typeof startRealtimeVideos === "function") startRealtimeVideos();
    } catch (e) { console.error("Videos initialization error:", e); }

    try {
      if (typeof startStoriesListener === "function") startStoriesListener();
    } catch (e) { console.error("Stories initialization error:", e); }

    try {
      if (typeof startAdSettingsListener === "function") startAdSettingsListener();
    } catch (e) { console.error("Ads initialization error:", e); }

    try {
      if (typeof startBlockedUsersListener === "function") startBlockedUsersListener();
    } catch (e) { console.error("Blocked listener error:", e); }

    authResolved = true;
    console.log("✅ User logged in, app visible");

  } else {
    // User logged out.
    try {
      if (currentUser && typeof markOffline === "function") await markOffline();
    } catch (e) {
      console.warn("Offline status error:", e);
    }

    currentUser = null;
    currentProfile = null;

    videosCache = [];
    storiesCache = [];
    groupedStories = [];

    myFollowsCache.clear();
    mySavesCache.clear();
    mySentRequestsCache.clear();
    blockedUsersCache.clear();

    // Realtime listener cleanup.
    const unsubscribers = [
      ["videos", videosUnsubscribe],
      ["stories", storiesUnsubscribe],
      ["ads", adSettingsUnsubscribe],
      ["userAds", userAdsUnsubscribe],
      ["blocked", blockedUsersUnsubscribe],
      ["notifications", notificationsUnsubscribe],
      ["comments", commentsUnsubscribe],
      ["chat", chatUnsubscribe],
      ["chatsList", chatsListUnsubscribe],
      ["playlists", playlistsUnsubscribe],
      ["presence", presenceUnsubscribe],
      ["followRequests", followRequestsUnsubscribe],
      ["watchHistory", watchHistoryUnsubscribe],
      ["vault", vaultUnsubscribe],
      ["groups", myGroupsUnsubscribe],
      ["groupRequests", groupRequestsUnsubscribe],
      ["groupChat", groupChatUnsubscribe],
      ["songs", songLibraryUnsubscribe]
    ];

    unsubscribers.forEach(([, unsub]) => {
      if (typeof unsub === "function") {
        try { unsub(); } catch (e) {}
      }
    });

    videosUnsubscribe = null;
    storiesUnsubscribe = null;
    adSettingsUnsubscribe = null;
    userAdsUnsubscribe = null;
    blockedUsersUnsubscribe = null;
    notificationsUnsubscribe = null;
    commentsUnsubscribe = null;
    chatUnsubscribe = null;
    chatsListUnsubscribe = null;
    playlistsUnsubscribe = null;
    presenceUnsubscribe = null;
    followRequestsUnsubscribe = null;
    watchHistoryUnsubscribe = null;
    vaultUnsubscribe = null;
    myGroupsUnsubscribe = null;
    groupRequestsUnsubscribe = null;
    groupChatUnsubscribe = null;
    songLibraryUnsubscribe = null;

    stopAllPresenceListeners();

    const appEl = $("app");
    if (appEl) {
      appEl.classList.add("hidden");
      appEl.style.display = "none";
    }

    showLoginScreen();

    authResolved = true;
    console.log("✅ No user, login page visible");
  }
});

/* ============================================================
   SAFE STARTUP FALLBACK
   Gives Firebase time to respond instead of blindly forcing
   the login screen after a fixed delay.
============================================================ */

setTimeout(() => {
  if (!authResolved) {
    console.warn("⚠️ Auth still loading...");
    // Hide the splash, but don't force the login screen yet —
    // wait for Firebase to actually respond.
    hideSplash();
  }
}, 4000);

// Final safety net: if no auth event ever arrives, show login after 8s.
setTimeout(() => {
  if (!authResolved) {
    console.warn("⚠️ Auth timeout - showing login");
    showLoginScreen();
    authResolved = true;
  }
}, 8000);

/* ============================================================
   GLOBAL ERROR LOG
============================================================ */

window.addEventListener("error", event => {
  console.error("❌ ReelHub JavaScript Error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", event => {
  console.error("❌ ReelHub Promise Error:", event.reason);
});

console.log("✅ ReelHub Part 1/3 loaded");
console.log("✅ ReelHub Part 1/3 COMPLETE");
