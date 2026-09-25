/* ============================================================
   ReelHub - app.js (Full Clean Version)
   PART 1/2
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
const provider = new GoogleAuthProvider();

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
   STATE
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

let onlineUsersCache = {};
let unreadChatsCache = {};
let chatLastReadCache = {};

let currentCommentVideoId = null;
let currentChatId = null;
let currentChatUser = null;
let shareVideoId = null;
let uploadVisibility = "public";
let uploadType = "long";
let currentProfileTab = "videos";
let currentPlaylistVideoId = null;
let selectedPlaylists = new Set();
let currentPlaylistView = null;
let deepLinkChecked = false;
let viewingProfileUid = null;

/* Stories */
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

/* Story Editor */
let pendingStorySong = null;
let pendingStorySticker = null;
let pendingStoryTrim = { start: 0, end: 0, applied: false };

/* Video Editor */
let pendingVideoSong = null;
let pendingVideoSticker = null;
let pendingVideoTrim = { start: 0, end: 0, applied: false };
let pendingVideoRotation = 0;
let pendingVideoMuted = false;

/* Trim */
let trimVideoElement = null;
let trimVideoDuration = 0;

/* Group */
let myGroupsCache = [];
let currentGroupId = null;
let currentGroupData = null;
let groupJoinRequestsCache = [];
let groupMessagesCache = [];
let myGroupsUnsubscribe = null;
let groupRequestsUnsubscribe = null;
let groupChatUnsubscribe = null;

/* Song */
let songLibraryCache = [];
let songLibraryUnsubscribe = null;
let selectedSongForApply = null;
let songPickerContext = null;
let stickerPickerContext = null;
let selectedStickerColor = "#ffffff";
let selectedStickerEmoji = null;
let selectedStickerText = null;
let previewAudio = null;

/* Modals */
let modalHistoryStack = [];

/* Vault */
let vaultPinVerified = false;
let vaultUnlockTime = 0;
let vaultAutoLockEnabled = true;
let vaultFilesCache = [];
let vaultUploading = false;

/* Splash */
let splashHidden = false;
let authResolved = false;

/* Prevention */
const processingMessages = new Set();
let lastSentMessageTime = 0;
const processingLikes = new Set();
const processingViews = new Set();
const processingSaves = new Set();

/* ============================================================
   HELPERS
============================================================ */
const $ = id => document.getElementById(id);

function esc(v){
  return String(v ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function timeValue(v){
  if(!v) return 0;
  if(typeof v.toMillis === "function") return v.toMillis();
  return new Date(v).getTime() || 0;
}

function avatar(url, name){
  return url || "https://ui-avatars.com/api/?name=" +
    encodeURIComponent(name || "User") +
    "&background=7c3aed&color=fff";
}

function toast(msg){
  const el = $("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.classList.remove("show"), 2500);
}

function timeAgo(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + "m";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + "h";
  const day = Math.floor(hr/24);
  if(day < 7) return day + "d";
  const wk = Math.floor(day/7);
  if(wk < 4) return wk + "w";
  return new Date(t).toLocaleDateString();
}

function timeAgoShort(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + "m";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + "h";
  return Math.floor(hr/24) + "d";
}

function timeAgoYouTube(v){
  const t = timeValue(v);
  if(!t) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff/1000);
  if(sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if(min < 60) return min + " minutes ago";
  const hr = Math.floor(min/60);
  if(hr < 24) return hr + " hours ago";
  const day = Math.floor(hr/24);
  if(day < 7) return day + " days ago";
  const wk = Math.floor(day/7);
  if(wk < 4) return wk + " weeks ago";
  const mo = Math.floor(day/30);
  if(mo < 12) return mo + " months ago";
  return Math.floor(day/365) + " years ago";
}

function formatViews(num){
  num = Number(num || 0);
  if(num < 1000) return num + " views";
  if(num < 1000000) return (num/1000).toFixed(1).replace(".0","") + "K views";
  if(num < 1000000000) return (num/1000000).toFixed(1).replace(".0","") + "M views";
  return (num/1000000000).toFixed(1) + "B views";
}

function formatViewsShort(num){
  num = Number(num || 0);
  if(num < 1000) return String(num);
  if(num < 1000000) return (num/1000).toFixed(1).replace(".0","") + "K";
  if(num < 1000000000) return (num/1000000).toFixed(1).replace(".0","") + "M";
  return (num/1000000000).toFixed(1) + "B";
}

function formatDuration(seconds){
  if(!seconds || isNaN(seconds)) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if(h > 0) return h + ":" + String(m).padStart(2,"0") + ":" + String(sec).padStart(2,"0");
  return m + ":" + String(sec).padStart(2,"0");
}

function formatFileSize(bytes){
  if(!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function getFileIcon(fileName, fileType){
  const name = (fileName || "").toLowerCase();
  const type = (fileType || "").toLowerCase();
  if(type.includes("pdf") || name.endsWith(".pdf")) return { icon: "📄", cls: "pdf" };
  if(name.endsWith(".doc") || name.endsWith(".docx")) return { icon: "📝", cls: "doc" };
  if(name.endsWith(".zip") || name.endsWith(".rar")) return { icon: "🗜️", cls: "zip" };
  if(name.endsWith(".ppt") || name.endsWith(".pptx")) return { icon: "📊", cls: "doc" };
  if(name.endsWith(".xls") || name.endsWith(".xlsx")) return { icon: "📊", cls: "doc" };
  if(name.endsWith(".txt")) return { icon: "📃", cls: "other" };
  return { icon: "📎", cls: "other" };
}

function isAdminUser(){
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}

/* ============================================================
   MODAL MANAGEMENT
============================================================ */
function showModal(id){
  const el = $(id);
  if(!el) return;
  if(el.classList.contains("show")) return;
  el.classList.add("show");
  try{
    window.history.pushState({ modalId: id, reelhubModal: true }, "", window.location.href);
    modalHistoryStack.push(id);
  }catch(e){}
}

function hideModal(id){
  const el = $(id);
  if(!el) return;
  if(!el.classList.contains("show")) return;
  el.classList.remove("show");
  const idx = modalHistoryStack.indexOf(id);
  if(idx > -1) modalHistoryStack.splice(idx, 1);

  if(id === "videoPlayerModal"){
    const videoEl = $("videoPlayerVideo");
    if(videoEl){
      videoEl.pause();
      videoEl.src = "";
      videoEl.style.transform = "";
      videoEl.muted = false;
    }
    if(window.__videoAudio){
      window.__videoAudio.pause();
      window.__videoAudio = null;
    }
  }
}

/* ============================================================
   SPLASH
============================================================ */
function hideSplash(){
  if(splashHidden) return;
  splashHidden = true;
  document.body.classList.add("app-ready");
  const splash = $("splashScreen");
  if(splash){
    splash.classList.add("fade-out");
    setTimeout(()=> splash.remove(), 500);
  }
}

function prepareInitialState(){
  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  document.body.classList.remove("app-ready");
}

/* ============================================================
   SUSPENSION
============================================================ */
function showSuspensionScreen(profile){
  const screen = $("suspensionScreen");
  if(!screen) return;
  const reason = profile.suspendReason || "Violation of Terms";
  const duration = profile.suspendDuration || "Temporary";
  const until = profile.suspendUntil ? 
    new Date(timeValue(profile.suspendUntil)).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : "Permanent";
  const date = profile.suspendedAt ?
    new Date(timeValue(profile.suspendedAt)).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : "—";

  if($("suspensionReason")) $("suspensionReason").textContent = reason;
  if($("suspensionDuration")) $("suspensionDuration").textContent = duration;
  if($("suspensionUntil")) $("suspensionUntil").textContent = until;
  if($("suspensionDate")) $("suspensionDate").textContent = date;

  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  hideSplash();
  screen.classList.remove("hidden");
}

async function checkSuspension(uid){
  if(!uid) return false;
  try{
    const snap = await getDocs(query(collection(db, "profiles"), where("uid", "==", uid)));
    if(snap.empty) return false;
    const profileData = snap.docs[0].data();
    if(!profileData.suspended) return false;

    if(profileData.suspendUntil){
      const untilTime = timeValue(profileData.suspendUntil);
      if(Date.now() > untilTime){
        await updateDoc(doc(db, "profiles", snap.docs[0].id), {
          suspended: false, suspendReason: "", suspendDuration: "",
          suspendUntil: null, autoUnsuspendedAt: serverTimestamp()
        });
        toast("✅ Suspension ended");
        return false;
      }
    }
    showSuspensionScreen(profileData);
    return true;
  }catch(e){
    console.error("Suspension check error:", e);
    return false;
  }
}

$("suspensionLogoutBtn")?.addEventListener("click", async ()=>{
  if(!confirm("Logout?")) return;
  try{
    await signOut(auth);
    window.location.reload();
  }catch(e){ console.error(e); }
});

/* ============================================================
   WATCH TIME
============================================================ */
let currentWatchSession = { videoId: null, startTime: null };

function startWatchTimer(videoId){
  if(!currentUser || !videoId) return;
  if(currentWatchSession.videoId === videoId && currentWatchSession.startTime) return;
  if(currentWatchSession.videoId && currentWatchSession.startTime) stopWatchTimer();
  currentWatchSession = { videoId, startTime: Date.now() };
}

async function stopWatchTimer(){
  if(!currentWatchSession.videoId || !currentWatchSession.startTime) return;
  if(!currentUser) return;
  const elapsed = Math.floor((Date.now() - currentWatchSession.startTime) / 1000);
  const videoId = currentWatchSession.videoId;
  currentWatchSession = { videoId: null, startTime: null };
  if(elapsed < 3) return;
  try{
    const videoRef = doc(db, "videos", videoId);
    const videoSnap = await getDoc(videoRef);
    if(!videoSnap.exists()) return;
    const ownerId = videoSnap.data().userId;
    if(ownerId === currentUser.uid) return;
    await updateDoc(videoRef, { watchTime: increment(elapsed) });
    await updateDoc(doc(db, "profiles", ownerId), { totalWatchTime: increment(elapsed) });
  }catch(e){ console.error("Watch timer error:", e); }
}

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "hidden") stopWatchTimer();
});

window.addEventListener("beforeunload", () => { stopWatchTimer(); });

/* ============================================================
   CLOUDINARY UPLOAD
============================================================ */
function uploadToCloudinary(file, onProgress){
  return new Promise((resolve,reject)=>{
    const resource = file.type.startsWith("video/") ? "video" : "image";
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resource}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.onload = ()=>{
      if(xhr.status >= 200 && xhr.status < 300){
        try{ resolve(JSON.parse(xhr.responseText).secure_url); }
        catch(e){ reject(e); }
      }else reject(new Error("Upload failed: " + xhr.status));
    };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("file", file);
    xhr.send(form);
  });
}

function uploadAudioToCloudinary(file, onProgress){
  return new Promise((resolve, reject)=>{
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.onload = ()=>{
      if(xhr.status >= 200 && xhr.status < 300){
        try{
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        }catch(e){ reject(e); }
      }else reject(new Error("Upload failed: " + xhr.status));
    };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };

    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("resource_type", "video");
    form.append("file", file);
    xhr.send(form);
  });
}

/* ============================================================
   AUTH
============================================================ */
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if(tabName === "login"){
      $("loginForm")?.classList.remove("hidden");
      $("signupForm")?.classList.add("hidden");
    }else{
      $("loginForm")?.classList.add("hidden");
      $("signupForm")?.classList.remove("hidden");
    }
    const status = $("loginStatus");
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  });
});

$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const status = $("loginStatus");

  if(!email || !password){
    if(status){ status.textContent = "Email and password required"; status.style.color = "#ed4956"; }
    return;
  }
  if(status){ status.textContent = "Logging in..."; status.style.color = "#7c3aed"; }

  try{
    await signInWithEmailAndPassword(auth, email, password);
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  }catch(err){
    console.error(err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});

$("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const status = $("loginStatus");

  if(!name || !email || !password){
    if(status){ status.textContent = "All fields required"; status.style.color = "#ed4956"; }
    return;
  }
  if(password.length < 6){
    if(status){ status.textContent = "Password must be 6+ chars"; status.style.color = "#ed4956"; }
    return;
  }
  if(status){ status.textContent = "Creating account..."; status.style.color = "#7c3aed"; }

  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: name });
    try{ await sendEmailVerification(userCred.user); }catch(e){}
    if(status){ status.textContent = "✅ Account created!"; status.style.color = "#22c55e"; }
  }catch(err){
    console.error(err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});

$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const status = $("loginStatus");
  if(!email){
    if(status){ status.textContent = "Enter your email first"; status.style.color = "#ed4956"; }
    return;
  }
  try{
    await sendPasswordResetEmail(auth, email);
    if(status){ status.textContent = "✅ Reset email sent!"; status.style.color = "#22c55e"; }
    setTimeout(() => { if(status) status.style.color = "#ed4956"; }, 4000);
  }catch(err){
    console.error(err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});

function getAuthError(code){
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
    "auth/missing-password": "Please enter your password",
    "auth/missing-email": "Please enter your email"
  };
  return errors[code] || "Something went wrong. Please try again";
}

$("googleLogin")?.addEventListener("click", async()=>{
  $("loginStatus").textContent = "Opening Google...";
  try{ await signInWithPopup(auth, provider); }
  catch(error){
    if(error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user"){
      try{ await signInWithRedirect(auth, provider); }
      catch(e){ $("loginStatus").textContent = e.message; }
    }else $("loginStatus").textContent = error.message;
  }
});

getRedirectResult(auth).catch(console.error);

/* ============================================================
   PROFILE
============================================================ */
async function createProfile(){
  const ref = doc(db, "profiles", currentUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const displayName = currentUser.displayName || 
      (currentUser.email ? currentUser.email.split("@")[0] : "User");
    await setDoc(ref, {
      uid: currentUser.uid,
      name: displayName,
      username: displayName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20) ||
        "user" + Date.now().toString().slice(-5),
      age: "", gender: "", bio: "", photo: currentUser.photoURL || "",
      followers: 0, following: 0, videos: 0, private: false, suspended: false,
      suspendReason: "", suspendDuration: "", suspendUntil: null, suspendedAt: null,
      bannerType: "gradient", bannerGradient: "linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL: "",
      vaultPin: "", vaultEnabled: false, totalWatchTime: 0, totalViews: 0,
      monetizationStatus: "none", upiId: "", createdAt: serverTimestamp()
    });
  }
}

async function getProfile(uid){
  const snap = await getDoc(doc(db, "profiles", uid));
  if(!snap.exists()){
    return { uid, name:"User", username:"user", age:"", gender:"", bio:"",
             photo:"", followers:0, following:0, videos:0, private:false,
             suspended:false, bannerType:"gradient",
             bannerGradient:"linear-gradient(135deg, #7c3aed, #ec4899)",
             bannerURL:"", vaultPin: "", vaultEnabled: false,
             totalWatchTime: 0, totalViews: 0, monetizationStatus: "none", upiId: "" };
  }
  const d = snap.data();
  return {
    uid, ...d,
    followers: Number(d.followers || 0),
    following: Number(d.following || 0),
    videos: Number(d.videos || 0),
    private: d.private === true,
    suspended: d.suspended === true,
    bannerType: d.bannerType || "gradient",
    bannerGradient: d.bannerGradient || "linear-gradient(135deg, #7c3aed, #ec4899)",
    bannerURL: d.bannerURL || "",
    vaultPin: d.vaultPin || "",
    vaultEnabled: d.vaultEnabled === true,
    totalWatchTime: Number(d.totalWatchTime || 0),
    totalViews: Number(d.totalViews || 0),
    monetizationStatus: d.monetizationStatus || "none",
    upiId: d.upiId || ""
  };
}

async function loadProfile(){
  if(!currentUser) return;
  currentProfile = await getProfile(currentUser.uid);
  $("profileName").textContent = currentProfile.name || "User";
  $("profileUsername").textContent = "@" + (currentProfile.username || "user");
  $("profilePhoto").src = avatar(currentProfile.photo, currentProfile.name);
  $("navProfileAvatar").src = avatar(currentProfile.photo, currentProfile.name);
  $("followersCount").textContent = currentProfile.followers || 0;
  $("followingCount").textContent = currentProfile.following || 0;
  $("videosCount").textContent = currentProfile.videos || 0;

  let extra = [];
  if(currentProfile.age) extra.push("Age: " + currentProfile.age);
  if(currentProfile.gender) extra.push(currentProfile.gender);
  $("profileExtra").textContent = extra.join(" · ");
  $("profileBio").textContent = currentProfile.bio || "";

  updateProfileTabCounts();
  updatePrivateToggleUI();
  applyBanner(currentProfile);
  addBannerEditButton();
}

function updatePrivateToggleUI(){
  const toggle = $("privateAccountToggle");
  if(!toggle) return;
  if(currentProfile?.private){ toggle.textContent = "ON"; toggle.style.color = "#22c55e"; }
  else { toggle.textContent = "OFF"; toggle.style.color = "var(--muted)"; }
}

async function loadMyFollows(){
  if(!currentUser) return;
  myFollowsCache = new Set();
  try{
    const q = query(collection(db,"follows"), where("follower","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => myFollowsCache.add(d.data().following));
  }catch(e){ console.error(e); }
}

async function loadMySaves(){
  if(!currentUser) return;
  mySavesCache = new Set();
  try{
    const q = query(collection(db,"saves"), where("userId","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => mySavesCache.add(d.data().videoId));
  }catch(e){ console.error(e); }
}

async function loadMySentRequests(){
  if(!currentUser) return;
  mySentRequestsCache = new Set();
  try{
    const q = query(collection(db,"follow_requests"), where("from","==",currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => mySentRequestsCache.add(d.data().to));
  }catch(e){ console.error(e); }
}

/* ============================================================
   AUTH STATE
============================================================ */
onAuthStateChanged(auth, async user => {
  if(user){
    currentUser = user;
    $("loginPage")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");
    hideSplash();

    const isSuspended = await checkSuspension(user.uid);
    if(isSuspended){ authResolved = true; return; }

    await createProfile();
    await loadProfile();
    await loadMyFollows();
    await loadMySaves();
    await loadMySentRequests();

    startRealtimeVideos();
    startNotifications();
    startChatsListListener();
    startPlaylistsListener();
    startPresenceHeartbeat();
    startFollowRequestsListener();
    startStoriesListener();
    startVaultListener();
    startMyGroupsListener();
    startSongLibraryListener();
    updateAdminVisibility();

    try{ window.history.replaceState({ reelhubHome: true }, "", window.location.href); }catch(e){}
    try{ window.history.pushState({ reelhubApp: true }, "", window.location.href); }catch(e){}

    setTimeout(checkDeepLink, 1500);
    authResolved = true;
  }else{
    if(currentUser) await markOffline();
    currentUser = null;
    currentProfile = null;
    videosCache = [];
    storiesCache = [];
    groupedStories = [];
    vaultFilesCache = [];
    myGroupsCache = [];
    songLibraryCache = [];
    myFollowsCache.clear();
    mySavesCache.clear();
    mySentRequestsCache.clear();
    onlineUsersCache = {};
    unreadChatsCache = {};
    chatLastReadCache = {};
    modalHistoryStack = [];
    vaultPinVerified = false;

    if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }
    if(notificationsUnsubscribe){ notificationsUnsubscribe(); notificationsUnsubscribe = null; }
    if(chatsListUnsubscribe){ chatsListUnsubscribe(); chatsListUnsubscribe = null; }
    if(playlistsUnsubscribe){ playlistsUnsubscribe(); playlistsUnsubscribe = null; }
    if(presenceUnsubscribe){ presenceUnsubscribe(); presenceUnsubscribe = null; }
    if(followRequestsUnsubscribe){ followRequestsUnsubscribe(); followRequestsUnsubscribe = null; }
    if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
    if(vaultUnsubscribe){ vaultUnsubscribe(); vaultUnsubscribe = null; }
    if(myGroupsUnsubscribe){ myGroupsUnsubscribe(); myGroupsUnsubscribe = null; }
    if(groupRequestsUnsubscribe){ groupRequestsUnsubscribe(); groupRequestsUnsubscribe = null; }
    if(groupChatUnsubscribe){ groupChatUnsubscribe(); groupChatUnsubscribe = null; }
    if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }
    if(heartbeatInterval){ clearInterval(heartbeatInterval); heartbeatInterval = null; }

    $("app")?.classList.add("hidden");
    $("loginPage")?.classList.remove("hidden");
    $("suspensionScreen")?.classList.add("hidden");
    hideSplash();
    authResolved = true;
  }
});

/* ============================================================
   VIDEO CARD
============================================================ */
function createVideoCard(v){
  const views = Number(v.views || 0);
  const mine = currentUser && v.userId === currentUser.uid;
  const isAdmin = isAdminUser();

  let songBadge = "";
  if(v.song && v.song.name){
    songBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(124,58,237,0.15);color:var(--primary);font-size:10px;font-weight:600;border-radius:8px;margin-top:4px">🎵 ${esc(v.song.name)}</span>`;
  }
  let stickerBadge = "";
  if(v.sticker){
    const icon = v.sticker.type === "emoji" ? v.sticker.icon : v.sticker.text;
    if(icon){
      stickerBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(236,72,153,0.15);color:#ec4899;font-size:10px;font-weight:600;border-radius:8px;margin-top:4px;margin-left:4px">${esc(icon)}</span>`;
    }
  }

  const rotationStyle = v.rotation ? `transform: rotate(${v.rotation}deg);` : "";
  const scaleStyle = (v.rotation === 90 || v.rotation === 270) ? "scale(1.3);" : "";

  return `
  <div class="video-card" data-id="${esc(v.id)}" data-open-video="${esc(v.id)}">
    <div class="thumbnail">
      <video src="${esc(v.videoURL)}#t=0.5" preload="metadata" muted playsinline
             style="${rotationStyle}${scaleStyle}"></video>
      <span class="duration" data-duration-for="${esc(v.id)}">0:00</span>
      ${v.muted ? `<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;font-size:11px;padding:3px 8px;border-radius:8px;font-weight:600">🔇</span>` : ""}
    </div>
    <div class="video-info">
      <img class="channel-avatar post-open-user" data-uid="${esc(v.userId)}"
           src="${avatar(v.userPhoto, v.userName)}" alt="${esc(v.userName)}">
      <div class="video-details">
        <h3 class="video-title">${esc(v.title || "Untitled")}</h3>
        <p class="channel-name">${esc(v.username || v.userName || "User")} <span class="verified">✓</span></p>
        <p class="video-meta">${formatViewsShort(views)} views <span class="dot">•</span> ${timeAgoYouTube(v.createdAt)}</p>
        ${songBadge || stickerBadge ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${songBadge}${stickerBadge}</div>` : ""}
      </div>
      ${mine || isAdmin ? `<button class="video-more" onclick="event.stopPropagation();event.preventDefault();openVideoMenu('${esc(v.id)}')">⋮</button>` : ""}
    </div>
  </div>
  `;
}

function renderFeed(){
  const feed = $("feed");
  if(!feed) return;

  const list = videosCache.filter(v =>
    v.type !== "short" &&
    (v.visibility !== "private" || v.userId === currentUser?.uid)
  );

  if(!list.length){
    feed.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="icon">📹</span>
        <h3>No videos yet</h3>
        <p>Upload your first video or follow creators</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = list.map(v => createVideoCard(v)).join("");
  list.forEach(v => loadVideoDuration(v.id, v.videoURL));
}

function loadVideoDuration(videoId, videoURL){
  if(!videoURL) return;
  const tempVideo = document.createElement("video");
  tempVideo.preload = "metadata";
  tempVideo.src = videoURL;

  tempVideo.addEventListener("loadedmetadata", () => {
    const duration = formatDuration(tempVideo.duration);
    const badge = document.querySelector(`[data-duration-for="${videoId}"]`);
    if(badge) badge.textContent = duration;
    tempVideo.src = "";
  });

  tempVideo.addEventListener("error", () => {
    const badge = document.querySelector(`[data-duration-for="${videoId}"]`);
    if(badge) badge.textContent = "0:00";
  });
}

function startRealtimeVideos(){
  if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }

  videosUnsubscribe = onSnapshot(collection(db,"videos"), snapshot=>{
    videosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    videosCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));

    renderFeed();
    renderShorts();
    loadMyVideos();

    if(mySavesCache.size > 0){
      renderSavedVideos();
      updateProfileTabCounts();
    }

    if($("publicProfileModal")?.classList.contains("show")){
      const uid = $("publicProfileModal").dataset.uid;
      if(uid) loadPublicVideos(uid);
    }
  });
}

/* ============================================================
   SHORTS
============================================================ */
function renderShorts(){
  const container = $("reelsContainer");
  if(!container) return;

  const list = videosCache.filter(v =>
    v.type === "short" &&
    (v.visibility !== "private" || v.userId === currentUser?.uid)
  );

  if(!list.length){
    container.innerHTML = `<div class="reel-empty">
      <div style="font-size:56px;margin-bottom:14px">🎞️</div>
      <h3 style="font-size:17px;margin-bottom:6px">No Shorts yet</h3>
      <p>Upload your first Short to see it here</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(v => createReel(v)).join("");
  setTimeout(setupReelsObserver, 100);
}

function createReel(v){
  const isFollowing = myFollowsCache.has(v.userId);
  const mine = currentUser && v.userId === currentUser.uid;
  const isSaved = mySavesCache.has(v.id);
  const views = Number(v.views || 0);

  return `
  <div class="reel-item" data-id="${esc(v.id)}">
    <video src="${esc(v.videoURL)}" loop playsinline webkit-playsinline
           preload="metadata" muted data-video-id="${esc(v.id)}"></video>
    <div class="reel-overlay">
      <div class="reel-info">
        <div class="reel-user">
          <img class="post-open-user" data-uid="${esc(v.userId)}"
               src="${avatar(v.userPhoto, v.userName)}">
          <strong>@${esc(v.username || v.userName)}</strong>
          ${!mine ? `<button class="follow-btn-sm" data-follow-uid="${esc(v.userId)}" data-action="follow">${isFollowing ? "Following" : "Follow"}</button>` : ""}
        </div>
        ${v.title ? `<div class="reel-title">${esc(v.title)}</div>` : ""}
        ${v.description ? `<div class="reel-desc">${esc(v.description)}</div>` : ""}
      </div>
    </div>
    <div class="reel-views">👁️ ${formatViewsShort(views)}</div>
    <div class="reel-actions">
      <div class="reel-action like-btn" id="reel-like-${esc(v.id)}" data-like-video="${esc(v.id)}" data-reel="true">
        <span class="icon">🤍</span>
        <small class="like-count">${v.likes || 0}</small>
      </div>
      <div class="reel-action" data-comment-video="${esc(v.id)}">
        <span class="icon">💬</span><small>Comment</small>
      </div>
      <div class="reel-action" data-share-video="${esc(v.id)}">
        <span class="icon">📤</span><small>Share</small>
      </div>
      <div class="reel-action save-btn ${isSaved?"saved":""}" data-save-video="${esc(v.id)}">
        <span class="icon">${isSaved ? "🔖" : "📑"}</span><small>Save</small>
      </div>
    </div>
  </div>
  `;
}

let reelObserver = null;
function setupReelsObserver(){
  if(reelObserver) reelObserver.disconnect();
  const container = $("reelsContainer");
  if(!container) return;
  const videos = container.querySelectorAll("video");
  reelObserver = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const vid = entry.target;
      if(entry.isIntersecting) vid.play().catch(()=>{});
      else vid.pause();
    });
  }, { threshold: 0.6, root: container });
  videos.forEach(v => reelObserver.observe(v));
}

/* ============================================================
   STORIES
============================================================ */
function startStoriesListener(){
  if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
  if(!currentUser) return;
  storiesUnsubscribe = onSnapshot(collection(db, "stories"), snapshot=>{
    const now = Date.now();
    storiesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(s => (now - timeValue(s.createdAt)) < STORY_LIFETIME_MS);
    storiesCache.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
    groupStories();
    renderStoriesBar();
  }, error=>console.error("Stories listener error:", error));
}

function groupStories(){
  const map = {};
  storiesCache.forEach(s=>{
    if(!map[s.userId]){
      map[s.userId] = { userId: s.userId, userName: s.userName || "User", userPhoto: s.userPhoto || "", stories: [], latestAt: 0 };
    }
    map[s.userId].stories.push(s);
    const t = timeValue(s.createdAt);
    if(t > map[s.userId].latestAt) map[s.userId].latestAt = t;
  });
  groupedStories = Object.values(map);
  groupedStories.forEach(g=>{ g.stories.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt)); });
  groupedStories.sort((a,b)=>{
    if(a.userId === currentUser?.uid) return -1;
    if(b.userId === currentUser?.uid) return 1;
    return b.latestAt - a.latestAt;
  });
}

function renderStoriesBar(){
  const bar = $("storiesBar");
  if(!bar) return;
  if(!currentUser){ bar.innerHTML = ""; return; }

  const myGroup = groupedStories.find(g => g.userId === currentUser.uid);
  const otherGroups = groupedStories.filter(g => g.userId !== currentUser.uid);

  let html = "";
  const myPhoto = currentProfile?.photo || "";
  const myName = currentProfile?.name || "You";
  const myHasStory = myGroup && myGroup.stories.length > 0;

  html += `
    <div class="story-item" data-my-story="true">
      <div class="story-ring ${myHasStory ? 'active' : 'yours'}">
        <img src="${avatar(myPhoto, myName)}" alt="You">
        ${!myHasStory ? `<span class="add-icon">+</span>` : ""}
      </div>
      <div class="story-name">Your Story</div>
    </div>
  `;

  otherGroups.forEach((g)=>{
    html += `
      <div class="story-item" data-story-user="${esc(g.userId)}">
        <div class="story-ring active">
          <img src="${avatar(g.userPhoto, g.userName)}" alt="${esc(g.userName)}">
        </div>
        <div class="story-name">${esc(g.userName.split(" ")[0])}</div>
      </div>
    `;
  });

  bar.innerHTML = html;
}

document.addEventListener("click", (e)=>{
  const myStory = e.target.closest("[data-my-story]");
  if(myStory){
    e.preventDefault(); e.stopPropagation();
    const myGroup = groupedStories.find(g => g.userId === currentUser?.uid);
    if(myGroup && myGroup.stories.length > 0){
      const idx = groupedStories.findIndex(g => g.userId === currentUser.uid);
      openStoryViewer(idx, 0);
    }else openCreateStoryModal();
    return;
  }
  const storyUser = e.target.closest("[data-story-user]");
  if(storyUser){
    e.preventDefault(); e.stopPropagation();
    const uid = storyUser.dataset.storyUser;
    const idx = groupedStories.findIndex(g => g.userId === uid);
    if(idx >= 0) openStoryViewer(idx, 0);
    return;
  }
});

function openCreateStoryModal(){
  storyUploadFile = null;
  storyMediaType = null;
  pendingStorySong = null;
  pendingStorySticker = null;
  pendingStoryTrim = { start: 0, end: 0, applied: false };

  const imgPrev = $("storyImagePreview");
  const vidPrev = $("storyVideoPreview");
  const zone = $("storyUploadZone");
  const btn = $("storyUploadBtn");
  const prog = $("storyUploadProgress");
  const status = $("storyUploadStatus");
  const tools = $("storyEditorTools");

  if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  if(zone) zone.classList.remove("hidden");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.remove("active");
  if(status) status.textContent = "";
  if(tools) tools.classList.add("hidden");

  const songBtn = $("storyAddSongBtn");
  if(songBtn){ songBtn.innerHTML = "🎵 Song"; songBtn.style.borderColor = ""; songBtn.style.color = ""; }
  const stickerBtn = $("storyAddStickerBtn");
  if(stickerBtn){ stickerBtn.innerHTML = "😀 Sticker"; stickerBtn.style.borderColor = ""; stickerBtn.style.color = ""; }

  const progressBar = $("storyUploadProgressBar");
  if(progressBar) progressBar.style.width = "0%";

  showModal("createStoryModal");
}

$("storyUploadZone")?.addEventListener("click", ()=>{ $("storyFile")?.click(); });

$("storyFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 30 * 1024 * 1024){ toast("File too large (max 30MB)"); e.target.value = ""; return; }

  storyUploadFile = file;
  storyMediaType = file.type.startsWith("video/") ? "video" : "image";

  const imgPrev = $("storyImagePreview");
  const vidPrev = $("storyVideoPreview");
  const zone = $("storyUploadZone");
  const btn = $("storyUploadBtn");
  const tools = $("storyEditorTools");

  if(zone) zone.classList.add("hidden");
  if(tools) tools.classList.remove("hidden");

  const url = URL.createObjectURL(file);

  if(storyMediaType === "image"){
    if(imgPrev){ imgPrev.src = url; imgPrev.classList.remove("hidden"); }
    if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  }else{
    if(vidPrev){ vidPrev.src = url; vidPrev.classList.remove("hidden"); }
    if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  }

  if(btn) btn.disabled = false;
});

$("storyUploadBtn")?.addEventListener("click", async ()=>{
  if(!storyUploadFile || !currentUser){ toast("Select a file first"); return; }

  const btn = $("storyUploadBtn");
  const prog = $("storyUploadProgress");
  const progBar = $("storyUploadProgressBar");
  const status = $("storyUploadStatus");

  if(btn) btn.disabled = true;
  if(prog) prog.classList.add("active");
  if(status) status.textContent = "Uploading...";

  try{
    const url = await uploadToCloudinary(storyUploadFile, (pct)=>{
      if(progBar) progBar.style.width = pct + "%";
      if(status) status.textContent = "Uploading " + pct + "%";
    });

    const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS);

    const storyData = {
      userId: currentUser.uid,
      userName: currentProfile?.name || currentUser.displayName || "User",
      userPhoto: currentProfile?.photo || currentUser.photoURL || "",
      username: currentProfile?.username || "",
      mediaURL: url,
      mediaType: storyMediaType,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt
    };

    if(pendingStorySong) storyData.song = pendingStorySong;
    if(pendingStorySticker) storyData.sticker = pendingStorySticker;
    if(pendingStoryTrim.applied){
      storyData.trimStart = pendingStoryTrim.start;
      storyData.trimEnd = pendingStoryTrim.end;
    }

    await addDoc(collection(db, "stories"), storyData);

    if(status) status.textContent = "✅ Story shared!";
    toast("✅ Story added");

    setTimeout(()=>{ hideModal("createStoryModal"); }, 500);

  }catch(err){
    console.error("Story upload error:", err);
    if(status) status.textContent = "Error: " + err.message;
    toast("Story upload failed");
  }finally{
    if(btn) btn.disabled = false;
  }
});

/* ============================================================
   STORY VIEWER
============================================================ */
function openStoryViewer(userIndex, storyIndex){
  if(!groupedStories.length) return;
  currentStoryUserIndex = userIndex;
  currentStoryIndex = storyIndex || 0;
  const viewer = $("storyViewer");
  if(viewer){
    viewer.classList.add("show");
    try{ window.history.pushState({ storyViewer: true }, "", window.location.href); }catch(e){}
  }
  loadCurrentStory();
}

function closeStoryViewer(){
  const viewer = $("storyViewer");
  if(viewer) viewer.classList.remove("show");
  stopStoryTimer();

  if(window.__storyAudio){
    window.__storyAudio.pause();
    window.__storyAudio = null;
  }

  const media = $("storyMedia");
  if(media) media.innerHTML = "";

  const songOverlay = $("storySongOverlay");
  if(songOverlay) songOverlay.classList.add("hidden");

  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){ stickerOverlay.style.display = "none"; stickerOverlay.textContent = ""; }
}

function loadCurrentStory(){
  stopStoryTimer();
  if(window.__storyAudio){ window.__storyAudio.pause(); window.__storyAudio = null; }

  const group = groupedStories[currentStoryUserIndex];
  if(!group || !group.stories.length){ closeStoryViewer(); return; }

  const story = group.stories[currentStoryIndex];
  if(!story){
    if(currentStoryUserIndex < groupedStories.length - 1){
      currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory();
    }else closeStoryViewer();
    return;
  }

  const avatarEl = $("storyViewerAvatar");
  const nameEl = $("storyViewerName");
  const timeEl = $("storyViewerTime");
  if(avatarEl) avatarEl.src = avatar(group.userPhoto, group.userName);
  if(nameEl) nameEl.textContent = group.userName;
  if(timeEl) timeEl.textContent = timeAgoShort(story.createdAt) + " ago";

  renderStoryProgress(group.stories.length, currentStoryIndex);

  const mediaContainer = $("storyMedia");
  if(mediaContainer){
    mediaContainer.innerHTML = "";
    if(story.mediaType === "video"){
      const vid = document.createElement("video");
      vid.src = story.mediaURL;
      vid.autoplay = true; vid.playsInline = true; vid.muted = false; vid.preload = "auto";

      vid.addEventListener("loadedmetadata", ()=>{
        const dur = Math.min((vid.duration || 5) * 1000, STORY_DURATION_VIDEO_MAX);
        startStoryTimer(dur);

        if(story.trimStart && story.trimEnd){
          vid.currentTime = story.trimStart;
          vid.addEventListener("timeupdate", ()=>{
            if(vid.currentTime >= story.trimEnd){ vid.currentTime = story.trimStart; }
          });
        }
      });

      vid.addEventListener("ended", ()=>{ nextStory(); });
      vid.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(vid);
      vid.play().catch(()=>{});
    }else{
      const img = document.createElement("img");
      img.src = story.mediaURL;
      img.alt = "";
      img.addEventListener("load", ()=>{ startStoryTimer(STORY_DURATION_IMAGE); });
      img.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(img);
    }
  }

  // Song
  const songOverlay = $("storySongOverlay");
  if(songOverlay){
    if(story.song && story.song.audioURL){
      songOverlay.classList.remove("hidden");
      $("storySongTitle").textContent = story.song.name || "Song";
      $("storySongArtist").textContent = story.song.artist || "Unknown";

      window.__storyAudio = new Audio(story.song.audioURL);
      window.__storyAudio.loop = true;
      window.__storyAudio.volume = 0.5;
      window.__storyAudio.play().catch(()=>{});
    }else songOverlay.classList.add("hidden");
  }

  // Sticker
  const stickerOverlay = $("storyStickerOverlay");
  if(stickerOverlay){
    if(story.sticker){
      stickerOverlay.style.display = "block";
      if(story.sticker.type === "emoji"){
        stickerOverlay.textContent = story.sticker.icon || "😀";
        stickerOverlay.style.color = "";
        stickerOverlay.style.fontSize = "80px";
        stickerOverlay.style.fontWeight = "";
        stickerOverlay.style.textShadow = "0 2px 8px rgba(0,0,0,0.4)";
      }else if(story.sticker.type === "text"){
        stickerOverlay.textContent = story.sticker.text || "";
        stickerOverlay.style.color = story.sticker.color || "#ffffff";
        stickerOverlay.style.fontSize = "40px";
        stickerOverlay.style.fontWeight = "900";
        stickerOverlay.style.textShadow = "2px 2px 8px rgba(0,0,0,0.6)";
      }
    }else{
      stickerOverlay.style.display = "none";
      stickerOverlay.textContent = "";
    }
  }

  const viewsCounter = $("storyViewsCounter");
  if(viewsCounter) viewsCounter.classList.add("hidden");

  if(story.userId !== currentUser?.uid) markStoryViewed(story.id);

  const footer = $("storyFooter");
  if(footer){
    if(story.userId === currentUser?.uid) footer.style.display = "none";
    else {
      footer.style.display = "flex";
      const input = $("storyReplyInput");
      if(input) input.value = "";
    }
  }
}

function renderStoryProgress(total, current){
  const bar = $("storyProgressBar");
  if(!bar) return;
  let html = "";
  for(let i = 0; i < total; i++){
    let fillClass = i < current ? "complete" : "";
    html += `<div class="story-progress-segment"><div class="story-progress-fill ${fillClass}" data-seg="${i}"></div></div>`;
  }
  bar.innerHTML = html;
}

function startStoryTimer(duration){
  stopStoryTimer();
  storyDuration = duration;
  storyStartTime = Date.now();
  storyElapsed = 0;
  storyPaused = false;
  updateStoryProgressLoop();
}

function updateStoryProgressLoop(){
  if(storyPaused) return;
  const elapsed = Date.now() - storyStartTime;
  storyElapsed = elapsed;
  const pct = Math.min((elapsed / storyDuration) * 100, 100);
  const fill = document.querySelector(`[data-seg="${currentStoryIndex}"]`);
  if(fill) fill.style.width = pct + "%";
  if(elapsed >= storyDuration){ nextStory(); return; }
  storyProgressRAF = requestAnimationFrame(updateStoryProgressLoop);
}

function stopStoryTimer(){
  if(storyProgressRAF){ cancelAnimationFrame(storyProgressRAF); storyProgressRAF = null; }
}

function pauseStoryTimer(){
  if(storyPaused) return;
  storyPaused = true;
  storyElapsed = Date.now() - storyStartTime;
  if(window.__storyAudio) window.__storyAudio.pause();
  if(storyProgressRAF){ cancelAnimationFrame(storyProgressRAF); storyProgressRAF = null; }
}

function resumeStoryTimer(){
  if(!storyPaused) return;
  storyPaused = false;
  storyStartTime = Date.now() - storyElapsed;
  if(window.__storyAudio) window.__storyAudio.play().catch(()=>{});
  updateStoryProgressLoop();
}

function nextStory(){
  stopStoryTimer();
  const group = groupedStories[currentStoryUserIndex];
  if(!group) { closeStoryViewer(); return; }
  if(currentStoryIndex < group.stories.length - 1){
    currentStoryIndex++; loadCurrentStory();
  }else{
    if(currentStoryUserIndex < groupedStories.length - 1){
      currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory();
    }else closeStoryViewer();
  }
}

function prevStory(){
  stopStoryTimer();
  if(currentStoryIndex > 0){
    currentStoryIndex--; loadCurrentStory();
  }else{
    if(currentStoryUserIndex > 0){
      currentStoryUserIndex--;
      const group = groupedStories[currentStoryUserIndex];
      currentStoryIndex = group ? group.stories.length - 1 : 0;
      loadCurrentStory();
    }
  }
}

async function markStoryViewed(storyId){
  if(!currentUser || !storyId) return;
  try{
    const viewRef = doc(db, "stories", storyId, "views", currentUser.uid);
    const snap = await getDoc(viewRef);
    if(!snap.exists()){
      await setDoc(viewRef, { userId: currentUser.uid, viewedAt: serverTimestamp() });
    }
  }catch(e){ console.error("markStoryViewed:", e); }
}

$("storyProgressBar")?.addEventListener("click", (e)=>{
  const seg = e.target.closest("[data-seg]");
  if(!seg) return;
  const idx = Number(seg.dataset.seg);
  if(!Number.isNaN(idx)){ currentStoryIndex = idx; loadCurrentStory(); }
});

$("storyNextZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); nextStory(); });
$("storyPrevZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); prevStory(); });
$("storyCloseBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeStoryViewer(); });

let storyHoldTimer = null;
const storyMediaEl = $("storyMedia");
if(storyMediaEl){
  storyMediaEl.addEventListener("touchstart", ()=>{ storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250); }, { passive: true });
  storyMediaEl.addEventListener("touchend", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); }, { passive: true });
  storyMediaEl.addEventListener("mousedown", ()=>{ storyHoldTimer = setTimeout(()=>{ pauseStoryTimer(); }, 250); });
  storyMediaEl.addEventListener("mouseup", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); });
  storyMediaEl.addEventListener("mouseleave", ()=>{ if(storyHoldTimer){ clearTimeout(storyHoldTimer); storyHoldTimer = null; } resumeStoryTimer(); });
}

$("storySendBtn")?.addEventListener("click", async (e)=>{ e.preventDefault(); e.stopPropagation(); await sendStoryReply(); });
$("storyReplyInput")?.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); sendStoryReply(); } });

async function sendStoryReply(){
  const input = $("storyReplyInput");
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  const group = groupedStories[currentStoryUserIndex];
  if(!group || group.userId === currentUser?.uid) return;

  const targetUid = group.userId;
  const chatId = [currentUser.uid, targetUid].sort().join("_");

  try{
    await setDoc(doc(db, "chats", chatId), { members: [currentUser.uid, targetUid], updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      text: "📸 Replied to story: " + text,
      type: "text",
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "chats", chatId), { lastMessage: "📸 Replied to story", updatedAt: serverTimestamp() });
    input.value = "";
    toast("✅ Reply sent");
  }catch(err){ toast("Reply failed"); }
}

document.addEventListener("keydown", (e)=>{
  const viewer = $("storyViewer");
  if(!viewer || !viewer.classList.contains("show")) return;
  if(e.key === "ArrowRight") nextStory();
  else if(e.key === "ArrowLeft") prevStory();
  else if(e.key === "Escape") closeStoryViewer();
});

/* ============================================================
   STORY MENU
============================================================ */
$("storyMoreBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const group = groupedStories[currentStoryUserIndex];
  if(!group) return;
  const story = group.stories[currentStoryIndex];
  if(!story) return;
  if(story.userId !== currentUser?.uid && !isAdminUser()){
    toast("You can only manage your own story");
    return;
  }
  currentStoryId = story.id;
  currentStoryData = story;
  pauseStoryTimer();
  showModal("storyMenuModal");
});

$("storyMenuEditBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!currentStoryId) return;
  hideModal("storyMenuModal");
  await openEditStoryModal(currentStoryId);
});

async function openEditStoryModal(storyId){
  try{
    const storySnap = await getDoc(doc(db, "stories", storyId));
    if(!storySnap.exists()){ toast("Story not found"); return; }
    const story = { id: storyId, ...storySnap.data() };
    if(story.userId !== currentUser.uid && !isAdminUser()){ toast("Not your story"); return; }

    if(story.mediaType === "video"){
      $("editStoryPreview").classList.add("hidden");
      $("editStoryVideoPreview").classList.remove("hidden");
      $("editStoryVideoPreview").src = story.mediaURL;
    }else{
      $("editStoryVideoPreview").classList.add("hidden");
      $("editStoryPreview").classList.remove("hidden");
      $("editStoryPreview").src = story.mediaURL;
    }

    $("editStoryCaption").value = story.caption || "";
    window.__editingStorySong = story.song || null;
    window.__editingStorySticker = story.sticker || null;
    $("editStoryStatus").textContent = "";
    updateEditStoryButtons();
    showModal("editStoryModal");
  }catch(e){ toast("Failed to open"); }
}

function updateEditStoryButtons(){
  const songBtn = $("editStoryChangeSongBtn");
  if(songBtn){
    if(window.__editingStorySong){
      songBtn.innerHTML = `🎵 ${esc(window.__editingStorySong.name || "Song")} ✓`;
      songBtn.style.borderColor = "var(--primary)";
      songBtn.style.color = "var(--primary)";
    }else{
      songBtn.innerHTML = "🎵 Add Song";
      songBtn.style.borderColor = "";
      songBtn.style.color = "";
    }
  }
  const stickerBtn = $("editStoryChangeStickerBtn");
  if(stickerBtn){
    if(window.__editingStorySticker){
      stickerBtn.innerHTML = `${window.__editingStorySticker.icon || "😀"} Sticker ✓`;
      stickerBtn.style.borderColor = "var(--primary)";
      stickerBtn.style.color = "var(--primary)";
    }else{
      stickerBtn.innerHTML = "😀 Add Sticker";
      stickerBtn.style.borderColor = "";
      stickerBtn.style.color = "";
    }
  }
}

$("saveStoryEditBtn")?.addEventListener("click", async ()=>{
  if(!currentStoryId) return;
  const caption = $("editStoryCaption").value.trim();
  const status = $("editStoryStatus");
  const btn = $("saveStoryEditBtn");

  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  status.textContent = "Saving...";
  status.style.color = "#7c3aed";

  try{
    await updateDoc(doc(db, "stories", currentStoryId), {
      caption,
      song: window.__editingStorySong || null,
      sticker: window.__editingStorySticker || null,
      updatedAt: serverTimestamp()
    });
    status.textContent = "✅ Saved!";
    status.style.color = "#22c55e";
    toast("✅ Story updated");

    setTimeout(async ()=>{
      hideModal("editStoryModal");
      closeStoryViewer();
      await new Promise(r => setTimeout(r, 300));
      startStoriesListener();
    }, 700);
  }catch(err){
    status.textContent = "Error: " + err.message;
    status.style.color = "#ed4956";
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "✅ Save Changes"; }
  }
});

$("storyMenuDeleteBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!currentStoryId) return;
  if(!confirm("Delete this story permanently?")) return;
  try{
    await deleteDoc(doc(db, "stories", currentStoryId));
    hideModal("storyMenuModal");
    closeStoryViewer();
    toast("🗑️ Story deleted");
  }catch(e){ toast("Failed to delete"); }
});

/* ============================================================
   SONG LIBRARY
============================================================ */
function startSongLibraryListener(){
  if(songLibraryUnsubscribe){ songLibraryUnsubscribe(); songLibraryUnsubscribe = null; }
  songLibraryUnsubscribe = onSnapshot(
    query(collection(db, "song_library")),
    snapshot=>{
      songLibraryCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      songLibraryCache.sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt));
    },
    error=>console.error("Song library listener:", error)
  );
}

function updateAdminVisibility(){
  const adminBtn = $("adminSongLibraryBtn");
  if(!adminBtn) return;
  adminBtn.style.display = isAdminUser() ? "flex" : "none";
}

function openSongPicker(context){
  songPickerContext = context || "story";
  selectedSongForApply = null;
  showModal("songPickerModal");
  renderSongPickerList("");
}

function renderSongPickerList(searchText){
  const container = $("songPickerList");
  if(!container) return;

  const q = (searchText || "").toLowerCase().trim();
  let list = songLibraryCache;

  if(q){
    list = list.filter(s => 
      (s.name || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q)
    );
  }

  if(!list.length){
    container.innerHTML = `<div class="song-library-empty"><span class="icon">🎵</span><h3>No songs ${q ? "found" : "yet"}</h3><p>${q ? "Try another search" : "Admin will add songs soon"}</p></div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="song-picker-item" data-pick-song="${esc(s.id)}">
      <div class="song-thumb">🎵</div>
      <div class="song-info">
        <strong>${esc(s.name || "Untitled")}</strong>
        <small>${esc(s.artist || "Unknown")} · ${esc(s.category || "")}</small>
      </div>
      <div class="check-icon"></div>
    </div>
  `).join("");
}

$("songSearchInput")?.addEventListener("input", (e)=>{
  renderSongPickerList(e.target.value);
});

document.addEventListener("click", (e)=>{
  const pickerItem = e.target.closest("[data-pick-song]");
  if(pickerItem){
    e.preventDefault(); e.stopPropagation();
    const songId = pickerItem.dataset.pickSong;
    document.querySelectorAll("#songPickerList .song-picker-item").forEach(el => {
      el.classList.remove("selected");
      const check = el.querySelector(".check-icon");
      if(check) check.textContent = "";
    });
    pickerItem.classList.add("selected");
    const check = pickerItem.querySelector(".check-icon");
    if(check) check.textContent = "✓";
    selectedSongForApply = songLibraryCache.find(s => s.id === songId) || null;
  }
});

$("confirmSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!selectedSongForApply){ toast("Select a song first"); return; }

  if(songPickerContext === "story") applySongToStory(selectedSongForApply);
  else if(songPickerContext === "video") applySongToVideo(selectedSongForApply);
  else if(songPickerContext === "story_edit") applySongToStoryEdit(selectedSongForApply);

  hideModal("songPickerModal");
});

$("removeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(songPickerContext === "story") removeSongFromStory();
  else if(songPickerContext === "video") removeSongFromVideo();
  else if(songPickerContext === "story_edit") removeSongFromStoryEdit();
  hideModal("songPickerModal");
});

function applySongToStory(song){
  pendingStorySong = song;
  const btn = $("storyAddSongBtn");
  if(btn){ btn.innerHTML = `🎵 ${esc(song.name).slice(0, 12)} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
  toast("🎵 Song added");
}

function removeSongFromStory(){
  pendingStorySong = null;
  const btn = $("storyAddSongBtn");
  if(btn){ btn.innerHTML = "🎵 Song"; btn.style.borderColor = ""; btn.style.color = ""; }
  toast("🔇 Song removed");
}

function applySongToVideo(song){
  pendingVideoSong = song;
  const status = $("videoEditStatus");
  if(status) status.textContent = "🎵 " + song.name + " selected";
  const btn = $("editVideoSongBtn");
  if(btn){ btn.innerHTML = `🎵 ${esc(song.name).slice(0, 10)} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
  toast("🎵 Song selected");
}

function removeSongFromVideo(){
  pendingVideoSong = null;
  const btn = $("editVideoSongBtn");
  if(btn){ btn.innerHTML = "🎵 Song"; btn.style.borderColor = ""; btn.style.color = ""; }
  toast("🔇 Song removed");
}

function applySongToStoryEdit(song){
  window.__editingStorySong = song;
  updateEditStoryButtons();
  hideModal("songPickerModal");
  showModal("editStoryModal");
  toast("🎵 " + song.name + " selected");
}

function removeSongFromStoryEdit(){
  window.__editingStorySong = null;
  updateEditStoryButtons();
  hideModal("songPickerModal");
  showModal("editStoryModal");
  toast("🔇 Song removed");
}

/* ============================================================
   STICKER PICKER
============================================================ */
function openStickerPicker(context){
  stickerPickerContext = context || "story";
  selectedStickerEmoji = null;
  selectedStickerText = null;
  selectedStickerColor = "#ffffff";

  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  document.querySelector('#stickerTabs .yt-tab[data-stab="emoji"]')?.classList.add("active");
  $("stickerEmojiTab")?.classList.remove("hidden");
  $("stickerTextTab")?.classList.add("hidden");

  document.querySelectorAll(".sticker-item").forEach(el=>{ el.style.background = ""; el.style.color = ""; });
  if($("textStickerInput")) $("textStickerInput").value = "";

  showModal("stickerPickerModal");
}

document.addEventListener("click", (e)=>{
  const tab = e.target.closest("#stickerTabs .yt-tab");
  if(!tab) return;
  e.preventDefault(); e.stopPropagation();
  const stab = tab.dataset.stab;
  document.querySelectorAll("#stickerTabs .yt-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  if(stab === "emoji"){
    $("stickerEmojiTab")?.classList.remove("hidden");
    $("stickerTextTab")?.classList.add("hidden");
  }else{
    $("stickerEmojiTab")?.classList.add("hidden");
    $("stickerTextTab")?.classList.remove("hidden");
  }
});

document.addEventListener("click", (e)=>{
  const item = e.target.closest(".sticker-item");
  if(!item) return;
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll(".sticker-item").forEach(el=>{ el.style.background = ""; el.style.color = ""; });
  item.style.background = "var(--primary)";
  item.style.color = "white";
  selectedStickerEmoji = item.dataset.sticker;
  selectedStickerText = null;
});

document.addEventListener("click", (e)=>{
  const colorEl = e.target.closest(".text-sticker-color");
  if(!colorEl) return;
  e.preventDefault(); e.stopPropagation();
  document.querySelectorAll(".text-sticker-color").forEach(el=>{ el.classList.remove("selected"); });
  colorEl.classList.add("selected");
  selectedStickerColor = colorEl.dataset.color;
});

$("confirmStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  let sticker = null;

  if(selectedStickerEmoji){
    sticker = { type: "emoji", icon: selectedStickerEmoji };
  }else{
    const text = $("textStickerInput")?.value.trim();
    if(text){
      sticker = { type: "text", text: text, icon: text.slice(0, 3) || "✏️", color: selectedStickerColor };
    }
  }

  if(!sticker){ toast("Select emoji or enter text"); return; }

  if(stickerPickerContext === "story") applyStickerToStory(sticker);
  else if(stickerPickerContext === "video") applyStickerToVideo(sticker);
  else if(stickerPickerContext === "story_edit") applyStickerToStoryEdit(sticker);

  hideModal("stickerPickerModal");
});

$("removeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(stickerPickerContext === "story") removeStickerFromStory();
  else if(stickerPickerContext === "video") removeStickerFromVideo();
  else if(stickerPickerContext === "story_edit") removeStickerFromStoryEdit();
  hideModal("stickerPickerModal");
});

function applyStickerToStory(sticker){
  pendingStorySticker = sticker;
  const btn = $("storyAddStickerBtn");
  if(btn){ btn.innerHTML = `${sticker.icon || "😀"} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
  toast("😀 Sticker added");
}

function removeStickerFromStory(){
  pendingStorySticker = null;
  const btn = $("storyAddStickerBtn");
  if(btn){ btn.innerHTML = "😀 Sticker"; btn.style.borderColor = ""; btn.style.color = ""; }
  toast("Sticker removed");
}

function applyStickerToVideo(sticker){
  pendingVideoSticker = sticker;
  const status = $("videoEditStatus");
  if(status) status.textContent = `${sticker.icon || "😀"} Sticker selected`;
  const btn = $("editVideoStickerBtn");
  if(btn){ btn.innerHTML = `${sticker.icon || "😀"} ✓`; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
  toast("😀 Sticker selected");
}

function removeStickerFromVideo(){
  pendingVideoSticker = null;
  const btn = $("editVideoStickerBtn");
  if(btn){ btn.innerHTML = "😀 Sticker"; btn.style.borderColor = ""; btn.style.color = ""; }
  toast("Sticker removed");
}

function applyStickerToStoryEdit(sticker){
  window.__editingStorySticker = sticker;
  updateEditStoryButtons();
  hideModal("stickerPickerModal");
  showModal("editStoryModal");
  toast("😀 Sticker added");
}

function removeStickerFromStoryEdit(){
  window.__editingStorySticker = null;
  updateEditStoryButtons();
  hideModal("stickerPickerModal");
  showModal("editStoryModal");
  toast("Sticker removed");
}

/* ============================================================
   BUTTON HANDLERS
============================================================ */
$("storyAddSongBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSongPicker("story"); });
$("storyAddStickerBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openStickerPicker("story"); });
$("editVideoSongBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openSongPicker("video"); });
$("editVideoStickerBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openStickerPicker("video"); });

$("editStoryChangeSongBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  selectedSongForApply = window.__editingStorySong;
  hideModal("editStoryModal");
  openSongPicker("story_edit");
  setTimeout(()=>{
    if(window.__editingStorySong){
      const item = document.querySelector(`[data-pick-song="${window.__editingStorySong.id}"]`);
      if(item){ item.classList.add("selected"); const check = item.querySelector(".check-icon"); if(check) check.textContent = "✓"; }
    }
  }, 300);
});

$("editStoryChangeStickerBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  hideModal("editStoryModal");
  openStickerPicker("story_edit");
  setTimeout(()=>{
    if(window.__editingStorySticker){
      if(window.__editingStorySticker.type === "emoji"){
        document.querySelectorAll(".sticker-item").forEach(el=>{
          if(el.dataset.sticker === window.__editingStorySticker.icon){
            el.style.background = "var(--primary)";
            el.style.color = "white";
          }
        });
      }
      if(window.__editingStorySticker.type === "text"){
        $("stickerTabs")?.querySelector('[data-stab="text"]')?.click();
        $("textStickerInput").value = window.__editingStorySticker.text || "";
      }
    }
  }, 300);
});

/* ============================================================
   VIDEO EDITOR
============================================================ */
$("editVideoRotateBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }
  pendingVideoRotation = (pendingVideoRotation + 90) % 360;
  videoEl.style.transform = `rotate(${pendingVideoRotation}deg)`;
  videoEl.style.transition = "transform 0.3s ease";
  const btn = $("editVideoRotateBtn");
  if(btn){
    btn.innerHTML = `🔄 ${pendingVideoRotation}°`;
    if(pendingVideoRotation !== 0){ btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
    else { btn.style.borderColor = ""; btn.style.color = ""; }
  }
  const status = $("videoEditStatus");
  if(status) status.textContent = `🔄 Rotated ${pendingVideoRotation}°`;
  toast(`🔄 Rotated ${pendingVideoRotation}°`);
});

$("editVideoMuteBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }
  pendingVideoMuted = !pendingVideoMuted;
  videoEl.muted = pendingVideoMuted;
  const btn = $("editVideoMuteBtn");
  if(btn){
    if(pendingVideoMuted){ btn.innerHTML = "🔇 Muted"; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
    else { btn.innerHTML = "🔊 Sound"; btn.style.borderColor = ""; btn.style.color = ""; }
  }
  const status = $("videoEditStatus");
  if(status) status.textContent = pendingVideoMuted ? "🔇 Video muted" : "🔊 Sound on";
  toast(pendingVideoMuted ? "🔇 Muted" : "🔊 Sound on");
});

$("editVideoPreviewBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  const videoEl = $("uploadPreview");
  if(!videoEl || !videoEl.src){ toast("Select a video first"); return; }

  const playerVideo = $("videoPlayerVideo");
  if(playerVideo){
    playerVideo.src = videoEl.src;
    playerVideo.muted = pendingVideoMuted;
    playerVideo.style.transform = `rotate(${pendingVideoRotation}deg)`;

    ["videoPlayerLikeBtn", "videoPlayerCommentBtn", "videoPlayerShareBtn",
     "videoPlayerSaveBtn", "videoPlayerPlaylistBtn"].forEach(id => {
      const btn = $(id);
      if(btn) btn.style.display = "none";
    });

    if($("videoPlayerTitle")) $("videoPlayerTitle").textContent = "🎬 Preview";

    const metaEl = $("videoPlayerMeta");
    if(metaEl){
      let info = [];
      if(pendingVideoRotation) info.push(`Rotate: ${pendingVideoRotation}°`);
      if(pendingVideoMuted) info.push("Muted");
      if(pendingVideoTrim.applied) info.push(`Trim: ${formatDuration(pendingVideoTrim.start)} - ${formatDuration(pendingVideoTrim.end)}`);
      if(pendingVideoSong) info.push(`🎵 ${pendingVideoSong.name}`);
      if(pendingVideoSticker) info.push(`😀 ${pendingVideoSticker.icon}`);
      metaEl.textContent = info.join(" · ") || "Original video";
    }

    if($("videoPlayerDesc")){
      $("videoPlayerDesc").textContent = $("videoTitle")?.value || "";
      $("videoPlayerDesc").style.display = $("videoPlayerDesc").textContent ? "block" : "none";
    }

    setTimeout(()=>{ playerVideo.play().catch(()=>{}); }, 300);
    showModal("videoPlayerModal");
  }
});

function openVideoTrimModal(videoEl){
  if(!videoEl || !videoEl.src){ toast("No video selected"); return; }
  trimVideoElement = videoEl;
  const trimPreview = $("trimPreviewVideo");
  trimPreview.src = videoEl.src;
  trimPreview.load();
  trimPreview.addEventListener("loadedmetadata", ()=>{
    trimVideoDuration = trimPreview.duration || 0;
    $("trimStartRange").max = trimVideoDuration;
    $("trimEndRange").max = trimVideoDuration;
    $("trimStartRange").value = 0;
    $("trimEndRange").value = trimVideoDuration;
    updateTrimLabels();
  }, { once: true });
  showModal("videoTrimModal");
}

function updateTrimLabels(){
  const start = Number($("trimStartRange").value) || 0;
  const end = Number($("trimEndRange").value) || 0;
  $("trimStartLabel").textContent = formatDuration(start);
  $("trimEndLabel").textContent = formatDuration(end);
  $("trimDurationLabel").textContent = formatDuration(Math.max(0, end - start));
}

$("trimStartRange")?.addEventListener("input", ()=>{
  const start = Number($("trimStartRange").value);
  const end = Number($("trimEndRange").value);
  if(start > end) $("trimEndRange").value = start;
  updateTrimLabels();
});

$("trimEndRange")?.addEventListener("input", ()=>{
  const start = Number($("trimStartRange").value);
  const end = Number($("trimEndRange").value);
  if(end < start) $("trimStartRange").value = end;
  updateTrimLabels();
});

$("trimCancelBtn")?.addEventListener("click", ()=>{ hideModal("videoTrimModal"); trimVideoElement = null; });

$("trimSaveBtn")?.addEventListener("click", ()=>{
  const start = Number($("trimStartRange").value) || 0;
  const end = Number($("trimEndRange").value) || 0;
  if(end - start < 1){ toast("Minimum 1 second required"); return; }

  const trimData = { start, end, applied: true, duration: end - start };

  if(window.__trimContext === "story"){
    pendingStoryTrim = trimData;
    const status = $("storySelectedMedia");
    if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`;
    toast("✂️ Trim applied to story");
  }else if(window.__trimContext === "video"){
    pendingVideoTrim = trimData;
    const status = $("videoEditStatus");
    if(status) status.textContent = `✂️ Trimmed: ${formatDuration(start)} - ${formatDuration(end)}`;
    toast("✂️ Trim applied to video");
  }

  hideModal("videoTrimModal");
  trimVideoElement = null;
});

$("editVideoTrimBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); window.__trimContext = "video"; openVideoTrimModal($("uploadPreview")); });
$("storyTrimBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(storyMediaType !== "video"){ toast("Trim only for videos"); return; }
  window.__trimContext = "story";
  openVideoTrimModal($("storyVideoPreview"));
});

/* ============================================================
   SHOW EDIT BARS
============================================================ */
$("videoFile")?.addEventListener("change", ()=>{
  setTimeout(()=>{
    const editBar = $("videoEditBar");
    if(editBar && $("videoFile").files[0]) editBar.style.display = "block";
  }, 200);
});

/* ============================================================
   END OF PART 1
============================================================ */

console.log("✅ app.js PART 1/2 loaded!");
/* ============================================================
   ReelHub - app.js
   PART 2/2
============================================================ */

/* ============================================================
   VIDEO MENU (⋮)
============================================================ */
window.openVideoMenu = function(videoId){
  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Not found"); return; }

  const mine = currentUser && v.userId === currentUser.uid;
  const isAdmin = isAdminUser();
  const canDelete = mine || isAdmin;
  const canEdit = mine;

  if(!canDelete && !canEdit){ toast("You can't manage this video"); return; }

  let options = [];
  if(canEdit) options.push("1 = ✏️ Edit");
  if(canDelete) options.push("2 = 🗑️ Delete" + (isAdmin && !mine ? " (ADMIN)" : ""));
  options.push("3 = ❌ Cancel");

  const action = prompt("Choose action:\n\n" + options.join("\n") + "\n\nEnter number:");

  if(action === "1" && canEdit) openEditVideo(videoId);
  else if(action === "2" && canDelete) window.deleteVideo(videoId);
};

/* ============================================================
   DELETE VIDEO — User (own) + Admin (any)
============================================================ */
window.deleteVideo = async function(videoId){
  if(!currentUser) return;

  const ref = doc(db, "videos", videoId);
  const snap = await getDoc(ref);

  if(!snap.exists()){ toast("Video not found"); return; }

  const videoData = snap.data();
  const ownerId = videoData.userId;
  const isOwnerUser = ownerId === currentUser.uid;
  const isAdmin = isAdminUser();

  if(!isOwnerUser && !isAdmin){ toast("You can't delete this video"); return; }

  if(!confirm(isAdmin && !isOwnerUser ? "ADMIN: Delete this video?" : "Delete this video?")) return;

  try{
    const comments = await getDocs(collection(db, "videos", videoId, "comments"));
    for(const c of comments.docs) await deleteDoc(c.ref);

    const likes = await getDocs(collection(db, "videos", videoId, "likes"));
    for(const l of likes.docs) await deleteDoc(l.ref);

    const views = await getDocs(collection(db, "videos", videoId, "views"));
    for(const v of views.docs) await deleteDoc(v.ref);

    await deleteDoc(ref);

    const q = query(collection(db, "videos"), where("userId", "==", ownerId));
    const ownerVideos = await getDocs(q);
    await updateDoc(doc(db, "profiles", ownerId), { videos: ownerVideos.size });

    toast(isAdmin && !isOwnerUser ? "🗑️ Video deleted (admin)" : "🗑️ Video deleted");
  }catch(e){
    console.error("deleteVideo error:", e);
    toast("Failed: " + e.message);
  }
};

/* ============================================================
   EDIT VIDEO
============================================================ */
async function openEditVideo(videoId){
  const snap = await getDoc(doc(db,"videos",videoId));
  if(!snap.exists()) return;
  const v = snap.data();
  if(v.userId !== currentUser.uid && !isAdminUser()){ toast("Not yours"); return; }

  $("editVideoId").value = videoId;
  $("editVideoTitle").value = v.title || "";
  $("editVideoDescription").value = v.description || "";
  $("editVideoVisibility").value = v.visibility || "public";
  $("editVideoType").value = v.type || "long";
  showModal("editVideoModal");
}

$("saveVideoEditBtn")?.addEventListener("click", async ()=>{
  const id = $("editVideoId").value;
  if(!id) return;
  try{
    const ref = doc(db,"videos",id);
    const snap = await getDoc(ref);
    if(!snap.exists()) return;
    if(snap.data().userId !== currentUser.uid && !isAdminUser()) return;

    await updateDoc(ref, {
      title: $("editVideoTitle").value.trim(),
      description: $("editVideoDescription").value.trim(),
      visibility: $("editVideoVisibility").value,
      type: $("editVideoType").value,
      updatedAt: serverTimestamp()
    });
    hideModal("editVideoModal");
    toast("✅ Updated");
  }catch(e){ toast("Update failed"); }
});

/* ============================================================
   VIDEO PLAYER
============================================================ */
window.openVideoPlayer = function(videoId){
  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Video not found"); return; }
  if(v.visibility === "private" && v.userId !== currentUser?.uid){ toast("Private video"); return; }

  trackView(videoId);

  const videoEl = $("videoPlayerVideo");
  if(videoEl){
    videoEl.src = v.videoURL;
    videoEl.playbackRate = 1;
    videoEl.muted = v.muted || false;

    if(v.rotation){
      videoEl.style.transition = "transform 0.3s ease";
      if(v.rotation === 90 || v.rotation === 270){
        videoEl.style.transform = `rotate(${v.rotation}deg) scale(1.3)`;
      }else{
        videoEl.style.transform = `rotate(${v.rotation}deg)`;
      }
    }else{
      videoEl.style.transform = "";
    }

    videoEl.play().catch(()=>{});
  }

  if(v.song && v.song.audioURL){
    if(window.__videoAudio) window.__videoAudio.pause();
    window.__videoAudio = new Audio(v.song.audioURL);
    window.__videoAudio.loop = true;
    window.__videoAudio.volume = 0.5;
    window.__videoAudio.play().catch(()=>{});
  }

  document.querySelectorAll(".speed-btn").forEach(btn => {
    const speed = Number(btn.dataset.speed);
    if(speed === 1){ btn.style.background = "#7c3aed"; btn.classList.add("active"); }
    else { btn.style.background = "rgba(255,255,255,0.15)"; btn.classList.remove("active"); }
  });

  if($("videoPlayerTitle")) $("videoPlayerTitle").textContent = v.title || "Untitled";

  const metaEl = $("videoPlayerMeta");
  if(metaEl){
    let extraInfo = [];
    if(v.song) extraInfo.push(`🎵 ${v.song.name}`);
    if(v.muted) extraInfo.push("🔇 Muted");
    if(v.rotation) extraInfo.push(`🔄 ${v.rotation}°`);
    const baseMeta = formatViews(v.views) + " · " + timeAgo(v.createdAt);
    if(extraInfo.length){
      metaEl.innerHTML = `${baseMeta}<br><span style="font-size:11px;color:var(--primary)">${extraInfo.join(" · ")}</span>`;
    }else{
      metaEl.textContent = baseMeta;
    }
  }

  if($("videoPlayerDesc")){
    $("videoPlayerDesc").textContent = v.description || "";
    $("videoPlayerDesc").style.display = v.description ? "block" : "none";
  }
  if($("videoPlayerLikes")) $("videoPlayerLikes").textContent = (v.likes || 0);

  ["videoPlayerLikeBtn", "videoPlayerShareBtn", "videoPlayerCommentBtn",
   "videoPlayerSaveBtn", "videoPlayerPlaylistBtn", "videoPlayerSpeedBtn"]
    .forEach(id => { const btn = $(id); if(btn) btn.style.display = ""; });

  updateVideoPlayerLike(videoId);
  updateVideoPlayerSave(videoId);

  const likeBtn = $("videoPlayerLikeBtn");
  if(likeBtn) likeBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); toggleLike(videoId, likeBtn, false); setTimeout(async () => { const snap = await getDoc(doc(db, "videos", videoId)); if(snap.exists()){ if($("videoPlayerLikes")) $("videoPlayerLikes").textContent = snap.data().likes || 0; } }, 500); };

  const commentBtn = $("videoPlayerCommentBtn");
  if(commentBtn) commentBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); hideModal("videoPlayerModal"); setTimeout(() => openComments(videoId), 200); };

  const shareBtn = $("videoPlayerShareBtn");
  if(shareBtn) shareBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); openShareSheet(videoId); };

  const saveBtn = $("videoPlayerSaveBtn");
  if(saveBtn) saveBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); toggleSave(videoId, saveBtn); };

  const playlistBtn = $("videoPlayerPlaylistBtn");
  if(playlistBtn) playlistBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); openAddToPlaylist(videoId); };

  const speedBtn = $("videoPlayerSpeedBtn");
  if(speedBtn) speedBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); const sc = $("speedControl"); if(sc) sc.style.display = sc.style.display === "none" ? "block" : "none"; };

  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const speed = Number(btn.dataset.speed);
      if($("videoPlayerVideo")) $("videoPlayerVideo").playbackRate = speed;
      document.querySelectorAll(".speed-btn").forEach(b => { b.style.background = "rgba(255,255,255,0.15)"; b.classList.remove("active"); });
      btn.style.background = "#7c3aed"; btn.classList.add("active");
      toast(`Speed: ${speed}x`);
      setTimeout(() => { const sc = $("speedControl"); if(sc) sc.style.display = "none"; }, 800);
    };
  });

  showModal("videoPlayerModal");
};

async function updateVideoPlayerSave(videoId){
  if(!currentUser) return;
  const saveBtn = $("videoPlayerSaveBtn");
  if(!saveBtn) return;
  const isSaved = mySavesCache.has(videoId);
  const icon = saveBtn.querySelector(".icon");
  const label = saveBtn.querySelector("small");
  if(isSaved){ if(icon) icon.textContent = "🔖"; if(label) label.textContent = "Saved"; saveBtn.style.color = "var(--primary)"; }
  else { if(icon) icon.textContent = "📑"; if(label) label.textContent = "Save"; saveBtn.style.color = ""; }
}

async function updateVideoPlayerLike(videoId){
  if(!currentUser) return;
  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const snap = await getDoc(likeRef);
    const btn = $("videoPlayerLikeBtn");
    if(!btn) return;
    if(snap.exists()){ btn.classList.add("liked"); btn.querySelector(".icon").textContent = "❤️"; }
    else { btn.classList.remove("liked"); btn.querySelector(".icon").textContent = "🤍"; }
  }catch(e){}
}

function resetVideoPlayer(){
  const videoEl = $("videoPlayerVideo");
  if(videoEl){ videoEl.pause(); videoEl.playbackRate = 1; videoEl.style.transform = ""; videoEl.muted = false; }
  const sc = $("speedControl");
  if(sc) sc.style.display = "none";
  if(window.__videoAudio){ window.__videoAudio.pause(); window.__videoAudio = null; }
  stopWatchTimer();
}

/* ============================================================
   VIEW COUNT / LIKE / SAVE
============================================================ */
async function trackView(videoId){
  if(!currentUser || !videoId) return;
  if(processingViews.has(videoId)) return;
  processingViews.add(videoId);
  try{
    const viewRef = doc(db, "videos", videoId, "views", currentUser.uid);
    const snap = await getDoc(viewRef);
    if(!snap.exists()){
      await setDoc(viewRef, { userId: currentUser.uid, viewedAt: serverTimestamp() });
      const videoRef = doc(db, "videos", videoId);
      await updateDoc(videoRef, { views: increment(1) });
      try{
        const videoSnap = await getDoc(videoRef);
        if(videoSnap.exists()){
          const ownerId = videoSnap.data().userId;
          if(ownerId && ownerId !== currentUser.uid){
            await updateDoc(doc(db, "profiles", ownerId), { totalViews: increment(1) });
          }
        }
      }catch(err){}
    }
  }catch(e){ console.error("trackView error:", e); }
  finally { setTimeout(() => processingViews.delete(videoId), 5000); }
}

document.addEventListener("play", (e)=>{
  if(e.target.tagName === "VIDEO"){
    const vid = e.target.dataset.videoId;
    if(vid){ trackView(vid); startWatchTimer(vid); }
  }
}, true);

document.addEventListener("pause", (e)=>{
  if(e.target.tagName === "VIDEO"){
    const vid = e.target.dataset.videoId;
    if(vid) stopWatchTimer();
  }
}, true);

document.addEventListener("ended", (e)=>{
  if(e.target.tagName === "VIDEO"){
    const vid = e.target.dataset.videoId;
    if(vid) stopWatchTimer();
  }
}, true);

async function toggleLike(videoId, btnEl, isReel=false){
  if(!currentUser){ toast("Login required"); return; }
  if(!videoId) return;
  if(processingLikes.has(videoId)) return;
  processingLikes.add(videoId);

  try{
    const likeRef = doc(db,"videos",videoId,"likes",currentUser.uid);
    const videoRef = doc(db,"videos",videoId);
    const [likeSnap, videoSnap] = await Promise.all([getDoc(likeRef), getDoc(videoRef)]);
    if(!videoSnap.exists()) return;
    const ownerId = videoSnap.data().userId;
    const wasLiked = likeSnap.exists();

    if(wasLiked){
      await deleteDoc(likeRef);
      await updateDoc(videoRef, { likes: increment(-1) });
      if(btnEl){ btnEl.classList.remove("liked"); const icon = btnEl.querySelector(".icon"); if(icon) icon.textContent = "🤍"; }
    }else{
      await setDoc(likeRef, { userId: currentUser.uid, createdAt: serverTimestamp() });
      await updateDoc(videoRef, { likes: increment(1) });
      if(btnEl){ btnEl.classList.add("liked"); const icon = btnEl.querySelector(".icon"); if(icon) icon.textContent = "❤️"; }
      if(ownerId !== currentUser.uid){
        await addDoc(collection(db,"notifications"), {
          to: ownerId, from: currentUser.uid,
          title: "❤️ New Like",
          message: (currentProfile?.name || "Someone") + " liked your video",
          createdAt: serverTimestamp()
        });
      }
    }

    const freshSnap = await getDoc(videoRef);
    if(freshSnap.exists()){
      const newCount = Math.max(0, Number(freshSnap.data().likes || 0));
      const likesEl = $("likes-" + videoId);
      if(likesEl) likesEl.textContent = newCount + " likes";
      if(btnEl){ const count = btnEl.querySelector(".like-count"); if(count) count.textContent = newCount; }
    }
  }catch(e){ console.error("toggleLike error:", e); }
  finally { setTimeout(() => processingLikes.delete(videoId), 1000); }
}

async function toggleSave(videoId, btnEl){
  if(!currentUser){ toast("Login required"); return; }
  if(!videoId) return;
  if(processingSaves.has(videoId)) return;
  processingSaves.add(videoId);

  const saveId = currentUser.uid + "_" + videoId;
  const saveRef = doc(db, "saves", saveId);

  try{
    const snap = await getDoc(saveRef);
    if(snap.exists()){
      await deleteDoc(saveRef);
      mySavesCache.delete(videoId);
      updateAllSaveButtons(videoId, false);
      updateProfileTabCounts();
      renderSavedVideos();
      updateVideoPlayerSave(videoId);
      toast("Removed from saved");
    }else{
      await setDoc(saveRef, { userId: currentUser.uid, videoId: videoId, savedAt: serverTimestamp() });
      mySavesCache.add(videoId);
      updateAllSaveButtons(videoId, true);
      updateProfileTabCounts();
      renderSavedVideos();
      updateVideoPlayerSave(videoId);
      toast("✅ Saved");
    }
  }catch(e){ toast("Save failed"); }
  finally { setTimeout(() => processingSaves.delete(videoId), 1500); }
}

function updateAllSaveButtons(videoId, isSaved){
  document.querySelectorAll(`[data-save-video="${videoId}"]`).forEach(btn=>{
    btn.classList.toggle("saved", isSaved);
    const icon = btn.querySelector(".icon");
    if(icon) icon.textContent = isSaved ? "🔖" : "📑";
  });
}

/* ============================================================
   PROFILE TABS
============================================================ */
function updateProfileTabCounts(){
  const vc = $("tabVideosCount");
  const sc = $("tabSavedCount");
  const pc = $("tabPlaylistsCount");
  if(vc) vc.textContent = videosCache.filter(v => v.userId === currentUser?.uid).length;
  if(sc) sc.textContent = mySavesCache.size;
  if(pc) pc.textContent = myPlaylistsCache.length;
}

document.querySelectorAll("#profileTabs .yt-tab").forEach(tab=>{
  tab.addEventListener("click", ()=>{
    const tabName = tab.dataset.tab;
    if(!tabName) return;
    document.querySelectorAll("#profileTabs .yt-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentProfileTab = tabName;
    $("myVideos")?.classList.add("hidden");
    $("playlistsTab")?.classList.add("hidden");
    $("savedVideos")?.classList.add("hidden");
    $("monetizationTab")?.classList.add("hidden");
    $("aboutTab")?.classList.add("hidden");

    if(tabName === "videos") $("myVideos")?.classList.remove("hidden");
    else if(tabName === "saved"){ $("savedVideos")?.classList.remove("hidden"); renderSavedVideos(); }
    else if(tabName === "playlists"){ $("playlistsTab")?.classList.remove("hidden"); renderPlaylistsTab(); }
    else if(tabName === "monetization"){ $("monetizationTab")?.classList.remove("hidden"); renderMonetizationTab(); }
    else if(tabName === "about"){ $("aboutTab")?.classList.remove("hidden"); renderAboutTab(); }
  });
});

function renderAboutTab(){
  const container = $("aboutTab");
  if(!container || !currentProfile) return;
  let rows = [];
  rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Name</div><div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.name || "User")}</div></div>`);
  rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Username</div><div style="font-size:14px;font-weight:500;margin-top:2px">@${esc(currentProfile.username || "user")}</div></div>`);
  if(currentProfile.age) rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Age</div><div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.age)}</div></div>`);
  if(currentProfile.gender) rows.push(`<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-size:12px;color:var(--muted)">Gender</div><div style="font-size:14px;font-weight:500;margin-top:2px">${esc(currentProfile.gender)}</div></div>`);
  if(currentProfile.bio) rows.push(`<div style="padding:12px 16px"><div style="font-size:12px;color:var(--muted)">Bio</div><div style="font-size:14px;margin-top:2px;line-height:1.5">${esc(currentProfile.bio)}</div></div>`);
  container.innerHTML = rows.join("");
}

function renderSavedVideos(){
  const container = $("savedVideos");
  if(!container) return;
  if(!mySavesCache.size){
    container.innerHTML = `<div class="saved-empty"><span class="icon">📑</span><h3>No saved videos</h3><p>Videos you save will appear here</p></div>`;
    return;
  }
  const savedList = videosCache.filter(v => mySavesCache.has(v.id));
  if(!savedList.length){
    container.innerHTML = `<div class="saved-empty"><span class="icon">📑</span><h3>No saved videos</h3><p>Videos you save will appear here</p></div>`;
    return;
  }
  container.innerHTML = savedList.map(v => createYTVideoItem(v, v.userId === currentUser?.uid)).join("");
}

/* ============================================================
   PLAYLIST
============================================================ */
async function loadMyPlaylists(){
  if(!currentUser) return;
  try{
    const q = query(collection(db, "playlists"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    myPlaylistsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myPlaylistsCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
    updateProfileTabCounts();
    renderPlaylistsTab();
  }catch(e){ console.error("loadMyPlaylists:", e); }
}

function startPlaylistsListener(){
  if(playlistsUnsubscribe){ playlistsUnsubscribe(); playlistsUnsubscribe = null; }
  if(!currentUser) return;
  playlistsUnsubscribe = onSnapshot(
    query(collection(db,"playlists"), where("userId","==",currentUser.uid)),
    snapshot=>{
      myPlaylistsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      myPlaylistsCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      updateProfileTabCounts();
      renderPlaylistsTab();
      if(currentPlaylistView) renderPlaylistDetail(currentPlaylistView);
    }
  );
}

function renderPlaylistsTab(){
  const container = $("playlistsTab");
  if(!container) return;
  if(!myPlaylistsCache.length){
    container.innerHTML = `<div class="playlist-empty"><span class="icon">🎵</span><h3>No playlists yet</h3><p>Organize your favorite videos into playlists</p><button class="playlist-create-btn" id="createFirstPlaylistBtn">➕ Create Playlist</button></div>`;
    $("createFirstPlaylistBtn")?.addEventListener("click", ()=>{ $("playlistName").value = ""; $("playlistDesc").value = ""; showModal("createPlaylistModal"); });
    return;
  }
  container.innerHTML = `
    <button class="playlist-create-btn" id="createNewPlaylistBtn" style="margin-bottom:14px">➕ New Playlist</button>
    ${myPlaylistsCache.map(p => {
      const count = p.videoCount || 0;
      const firstVideo = p.coverVideoURL || "";
      return `
      <div class="playlist-card" data-open-playlist="${esc(p.id)}">
        <div class="playlist-cover">${firstVideo ? `<video src="${esc(firstVideo)}" preload="metadata" muted></video><span class="cover-icon">▶️</span>` : `<span class="cover-icon">🎵</span>`}</div>
        <div class="playlist-info"><h4>${esc(p.name || "Untitled")}</h4><div class="meta">${count} ${count === 1 ? "video" : "videos"}</div></div>
        <div class="playlist-actions"><button class="playlist-delete-btn" data-delete-playlist="${esc(p.id)}">Delete</button></div>
      </div>`;
    }).join("")}
  `;
  $("createNewPlaylistBtn")?.addEventListener("click", ()=>{ $("playlistName").value = ""; $("playlistDesc").value = ""; showModal("createPlaylistModal"); });
}

async function openPlaylistDetail(playlistId){
  const playlist = myPlaylistsCache.find(p => p.id === playlistId);
  if(!playlist) return;
  currentPlaylistView = playlistId;
  $("playlistDetailTitle").textContent = playlist.name || "Playlist";
  showModal("playlistDetailModal");
  await renderPlaylistDetail(playlistId);
}

async function renderPlaylistDetail(playlistId){
  const playlist = myPlaylistsCache.find(p => p.id === playlistId);
  if(!playlist) return;
  const container = $("playlistDetailContent");
  container.innerHTML = `<div class="yt-empty" style="padding:30px">Loading...</div>`;
  try{
    const itemsSnap = await getDocs(collection(db, "playlists", playlistId, "items"));
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a,b)=> timeValue(b.addedAt) - timeValue(a.addedAt));
    const videoIds = items.map(i => i.videoId);
    const videos = videosCache.filter(v => videoIds.includes(v.id));
    const firstVideo = videos[0];
    container.innerHTML = `
      <div class="playlist-detail-header">
        <div class="playlist-detail-cover">${firstVideo ? `<video src="${esc(firstVideo.videoURL)}" preload="metadata" muted></video>` : `🎵`}</div>
        <div class="playlist-detail-info"><h3>${esc(playlist.name)}</h3><div class="meta">${videos.length} ${videos.length === 1 ? "video" : "videos"}</div></div>
      </div>
      ${videos.length === 0 
        ? `<div class="playlist-empty" style="padding:30px"><span class="icon">📭</span><p>No videos</p></div>`
        : videos.map(v => `
            <div class="playlist-video-item" data-playlist-video="${esc(v.id)}">
              <div class="thumb"><video src="${esc(v.videoURL)}" preload="metadata" muted></video></div>
              <div class="info"><h4>${esc(v.title || "Untitled")}</h4><div class="stats">${formatViews(v.views)} · ${timeAgo(v.createdAt)}</div></div>
              <button class="remove-btn" data-remove-from-playlist="${esc(v.id)}|${esc(playlistId)}">Remove</button>
            </div>`).join("")}
    `;
  }catch(e){ container.innerHTML = `<div class="yt-empty" style="padding:30px">Error</div>`; }
}

$("createPlaylistBtn")?.addEventListener("click", async()=>{
  if(!currentUser) return;
  const name = $("playlistName").value.trim();
  const description = $("playlistDesc").value.trim();
  if(!name){ toast("Playlist name डालो"); return; }
  try{
    $("createPlaylistBtn").disabled = true;
    await addDoc(collection(db, "playlists"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      name, description, videoCount: 0, coverVideoURL: "", createdAt: serverTimestamp()
    });
    hideModal("createPlaylistModal");
    toast("✅ Playlist created");
  }catch(e){ toast("Failed"); }
  finally { $("createPlaylistBtn").disabled = false; }
});

async function openAddToPlaylist(videoId){
  currentPlaylistVideoId = videoId;
  selectedPlaylists = new Set();
  showModal("addToPlaylistModal");
  const container = $("playlistSelectList");
  container.innerHTML = `<div class="yt-empty" style="padding:20px">Loading...</div>`;
  if(!myPlaylistsCache.length){
    container.innerHTML = `<div class="playlist-empty" style="padding:20px"><p style="font-size:13px">No playlists yet</p></div>`;
    return;
  }
  for(const p of myPlaylistsCache){
    try{
      const itemId = p.id + "_" + videoId;
      const snap = await getDoc(doc(db, "playlists", p.id, "items", itemId));
      if(snap.exists()) selectedPlaylists.add(p.id);
    }catch(e){}
  }
  container.innerHTML = myPlaylistsCache.map(p => {
    const checked = selectedPlaylists.has(p.id);
    return `<div class="playlist-select-item ${checked ? "checked" : ""}" data-toggle-playlist="${esc(p.id)}"><div class="playlist-select-check">${checked ? "✓" : ""}</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">${esc(p.name)}</div><div style="font-size:12px;color:var(--muted)">${p.videoCount || 0} videos</div></div></div>`;
  }).join("");
}

$("saveToPlaylistBtn")?.addEventListener("click", async()=>{
  if(!currentPlaylistVideoId){ toast("Video not found"); return; }
  const btn = $("saveToPlaylistBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  try{
    let savedCount = 0, removedCount = 0;
    for(const p of myPlaylistsCache){
      const itemId = p.id + "_" + currentPlaylistVideoId;
      const itemRef = doc(db, "playlists", p.id, "items", itemId);
      const snap = await getDoc(itemRef);
      if(selectedPlaylists.has(p.id)){
        if(!snap.exists()){ await setDoc(itemRef, { videoId: currentPlaylistVideoId, addedAt: serverTimestamp() }); savedCount++; }
      }else{
        if(snap.exists()){ await deleteDoc(itemRef); removedCount++; }
      }
    }
    for(const p of myPlaylistsCache){
      const items = await getDocs(collection(db, "playlists", p.id, "items"));
      let coverVideoURL = "";
      if(items.size > 0){
        const firstItem = items.docs[0].data();
        const v = videosCache.find(x => x.id === firstItem.videoId);
        if(v) coverVideoURL = v.videoURL;
      }
      await updateDoc(doc(db, "playlists", p.id), { videoCount: items.size, coverVideoURL });
    }
    await loadMyPlaylists();
    hideModal("addToPlaylistModal");
    if(savedCount > 0) toast(`✅ Saved`);
    else if(removedCount > 0) toast(`Removed`);
    else toast("No changes");
  }catch(e){ toast("Failed"); }
  finally { if(btn){ btn.disabled = false; btn.textContent = "Done"; } }
});

async function syncAllPlaylistCounts(){
  for(const p of myPlaylistsCache){
    try{
      const items = await getDocs(collection(db, "playlists", p.id, "items"));
      let coverVideoURL = "";
      if(items.size > 0){
        const firstItem = items.docs[0].data();
        const v = videosCache.find(x => x.id === firstItem.videoId);
        if(v) coverVideoURL = v.videoURL;
      }
      await updateDoc(doc(db, "playlists", p.id), { videoCount: items.size, coverVideoURL });
    }catch(e){}
  }
}

$("newPlaylistFromAddBtn")?.addEventListener("click", ()=>{ hideModal("addToPlaylistModal"); $("playlistName").value = ""; $("playlistDesc").value = ""; showModal("createPlaylistModal"); });

/* ============================================================
   UPLOAD VIDEO
============================================================ */
$("dropzone")?.addEventListener("click", ()=> $("videoFile").click());

$("videoFile")?.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(!file) return;
  const preview = $("uploadPreview");
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  $("dropzone").classList.add("hidden");
});

$("visibilityGroup")?.addEventListener("click", e=>{
  const el = e.target.closest(".yt-radio");
  if(!el) return;
  $("visibilityGroup").querySelectorAll(".yt-radio").forEach(x => x.classList.remove("selected"));
  el.classList.add("selected");
  uploadVisibility = el.dataset.value;
});

$("typeGroup")?.addEventListener("click", e=>{
  const el = e.target.closest(".yt-radio");
  if(!el) return;
  $("typeGroup").querySelectorAll(".yt-radio").forEach(x => x.classList.remove("selected"));
  el.classList.add("selected");
  uploadType = el.dataset.value;
});

$("publishBtn")?.addEventListener("click", async()=>{
  const file = $("videoFile").files[0];
  const title = $("videoTitle").value.trim();
  const description = $("videoDescription").value.trim();

  if(!file){ toast("Select video first"); return; }
  if(!title){ toast("Title डालो"); return; }
  if(!currentUser){ toast("Login required"); return; }

  $("publishBtn").disabled = true;
  $("uploadProgressWrap").classList.add("active");
  $("uploadStatus").textContent = "Uploading...";

  try{
    const url = await uploadToCloudinary(file, pct=>{
      $("uploadProgressBar").style.width = pct + "%";
      $("uploadStatus").textContent = "Uploading " + pct + "%";
    });

    const videoData = {
      userId: currentUser.uid,
      userName: currentProfile?.name || currentUser.displayName || "User",
      username: currentProfile?.username || "",
      userPhoto: currentProfile?.photo || currentUser.photoURL || "",
      videoURL: url,
      title,
      description,
      visibility: uploadVisibility,
      type: uploadType,
      likes: 0,
      views: 0,
      watchTime: 0,
      createdAt: serverTimestamp()
    };

    if(pendingVideoRotation) videoData.rotation = pendingVideoRotation;
    if(pendingVideoMuted) videoData.muted = true;
    if(pendingVideoSong) videoData.song = pendingVideoSong;
    if(pendingVideoSticker) videoData.sticker = pendingVideoSticker;
    if(pendingVideoTrim.applied){ videoData.trimStart = pendingVideoTrim.start; videoData.trimEnd = pendingVideoTrim.end; }

    await addDoc(collection(db,"videos"), videoData);
    await syncVideoCount(currentUser.uid);

    $("videoFile").value = "";
    $("videoTitle").value = "";
    $("videoDescription").value = "";
    $("uploadPreview").classList.add("hidden");
    $("dropzone").classList.remove("hidden");
    $("uploadProgressBar").style.width = "0%";
    $("uploadProgressWrap").classList.remove("active");
    $("uploadStatus").textContent = "";
    $("videoEditBar").style.display = "none";

    pendingVideoSong = null;
    pendingVideoSticker = null;
    pendingVideoTrim = { start: 0, end: 0, applied: false };
    pendingVideoRotation = 0;
    pendingVideoMuted = false;

    toast("✅ Video published!");
    openPanel("homePanel");
  }catch(error){
    console.error(error);
    $("uploadStatus").textContent = "Error: " + error.message;
    toast("Upload failed");
  }finally{
    $("publishBtn").disabled = false;
  }
});

async function syncVideoCount(uid){
  try{
    const q = query(collection(db,"videos"), where("userId","==",uid));
    const snap = await getDocs(q);
    await updateDoc(doc(db,"profiles",uid), { videos: snap.size });
    if(currentProfile && currentProfile.uid === uid){
      currentProfile.videos = snap.size;
      $("videosCount").textContent = snap.size;
    }
  }catch(e){}
}

/* ============================================================
   BANNER
============================================================ */
function applyBanner(profile){
  const bannerEl = document.querySelector("#profilePanel .yt-banner");
  if(!bannerEl || !profile) return;
  if(profile.bannerType === "image" && profile.bannerURL){
    bannerEl.style.background = `url(${profile.bannerURL}) center/cover no-repeat`;
    bannerEl.classList.add("banner-image");
  }else if(profile.bannerGradient){
    bannerEl.style.background = profile.bannerGradient;
    bannerEl.classList.remove("banner-image");
  }
}

function addBannerEditButton(){
  const bannerEl = document.querySelector("#profilePanel .yt-banner");
  if(!bannerEl) return;
  bannerEl.querySelector(".banner-edit-btn")?.remove();
  const btn = document.createElement("button");
  btn.className = "banner-edit-btn";
  btn.innerHTML = "🎨 Edit";
  btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); showModal("bannerOptionsModal"); });
  bannerEl.style.position = "relative";
  bannerEl.appendChild(btn);
}

$("changeBannerBtn")?.addEventListener("click", ()=>{ hideModal("settingsModal"); showModal("bannerOptionsModal"); });
$("uploadBannerBtn")?.addEventListener("click", ()=>{ hideModal("bannerOptionsModal"); $("bannerFile")?.click(); });
$("chooseGradientBtn")?.addEventListener("click", ()=>{ hideModal("bannerOptionsModal"); showModal("bannerGradientModal"); });

document.querySelectorAll(".banner-gradient-item").forEach(item => {
  item.addEventListener("click", async () => {
    const gradient = item.dataset.gradient;
    if(!gradient || !currentUser) return;
    try{
      await updateDoc(doc(db, "profiles", currentUser.uid), { bannerType: "gradient", bannerGradient: gradient, bannerURL: "", updatedAt: serverTimestamp() });
      currentProfile.bannerType = "gradient";
      currentProfile.bannerGradient = gradient;
      currentProfile.bannerURL = "";
      applyBanner(currentProfile);
      document.querySelectorAll(".banner-gradient-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      hideModal("bannerGradientModal");
      toast("✅ Banner updated");
    }catch(e){ toast("Failed"); }
  });
});

$("bannerFile")?.addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if(!file || !currentUser) return;
  try{
    toast("Uploading banner...");
    const url = await uploadToCloudinary(file);
    await updateDoc(doc(db, "profiles", currentUser.uid), { bannerType: "image", bannerURL: url, bannerGradient: "", updatedAt: serverTimestamp() });
    currentProfile.bannerType = "image";
    currentProfile.bannerURL = url;
    currentProfile.bannerGradient = "";
    applyBanner(currentProfile);
    toast("✅ Banner updated");
  }catch(e){ toast("Failed"); }
  finally { e.target.value = ""; }
});

/* ============================================================
   FOLLOW SYSTEM
============================================================ */
async function canViewUser(uid){
  if(!uid) return false;
  if(uid === currentUser?.uid) return true;
  const profile = await getProfile(uid);
  if(!profile.private) return true;
  if(myFollowsCache.has(uid)) return true;
  return false;
}

async function canViewUserVideos(uid){ return await canViewUser(uid); }

async function sendFollowRequest(targetUid){
  if(!currentUser || targetUid === currentUser.uid) return;
  const reqId = currentUser.uid + "_" + targetUid;
  try{
    await setDoc(doc(db, "follow_requests", reqId), {
      from: currentUser.uid, fromName: currentProfile?.name || "User",
      fromPhoto: currentProfile?.photo || "", to: targetUid,
      status: "pending", createdAt: serverTimestamp()
    });
    mySentRequestsCache.add(targetUid);
    await addDoc(collection(db, "notifications"), {
      to: targetUid, from: currentUser.uid, title: "🔒 Follow Request",
      message: (currentProfile?.name || "Someone") + " wants to follow you",
      createdAt: serverTimestamp()
    });
    toast("✅ Follow request sent");
  }catch(e){ toast("Request failed"); }
}

async function cancelFollowRequest(targetUid){
  if(!currentUser) return;
  try{
    await deleteDoc(doc(db, "follow_requests", currentUser.uid + "_" + targetUid));
    mySentRequestsCache.delete(targetUid);
    toast("Request cancelled");
  }catch(e){}
}

async function acceptFollowRequest(fromUid){
  if(!currentUser) return;
  try{
    await setDoc(doc(db, "follows", fromUid + "_" + currentUser.uid), {
      follower: fromUid, following: currentUser.uid, createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "follow_requests", fromUid + "_" + currentUser.uid));
    await syncFollowCounts(fromUid);
    await syncFollowCounts(currentUser.uid);
    await addDoc(collection(db, "notifications"), {
      to: fromUid, from: currentUser.uid, title: "✅ Request Accepted",
      message: (currentProfile?.name || "User") + " accepted your follow request",
      createdAt: serverTimestamp()
    });
    toast("✅ Request accepted");
    renderFollowRequests();
  }catch(e){ toast("Failed"); }
}

async function rejectFollowRequest(fromUid){
  if(!currentUser) return;
  try{
    await deleteDoc(doc(db, "follow_requests", fromUid + "_" + currentUser.uid));
    toast("Request rejected");
    renderFollowRequests();
  }catch(e){ toast("Failed"); }
}

function startFollowRequestsListener(){
  if(followRequestsUnsubscribe){ followRequestsUnsubscribe(); followRequestsUnsubscribe = null; }
  if(!currentUser) return;
  followRequestsUnsubscribe = onSnapshot(
    query(collection(db, "follow_requests"), where("to", "==", currentUser.uid)),
    snapshot=>{
      myFollowRequestsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const badge = $("followRequestsBadge");
      if(badge){
        if(myFollowRequestsCache.length > 0){ badge.textContent = myFollowRequestsCache.length; badge.style.display = "inline"; }
        else badge.style.display = "none";
      }
    }
  );
}

async function renderFollowRequests(){
  const container = $("followRequestsList");
  if(!container) return;
  if(!myFollowRequestsCache.length){
    container.innerHTML = `<div class="yt-empty" style="padding:40px 20px"><div style="font-size:48px;margin-bottom:12px">📬</div><h3 style="font-size:16px;margin-bottom:6px">No requests</h3></div>`;
    return;
  }
  const reqs = [];
  for(const req of myFollowRequestsCache){
    const p = await getProfile(req.from);
    reqs.push({ uid: req.from, name: p.name || "User", username: p.username || "", photo: p.photo || "" });
  }
  container.innerHTML = reqs.map(r=>`
    <div class="person-item">
      <img src="${avatar(r.photo, r.name)}" class="people-open-btn" data-uid="${esc(r.uid)}">
      <div class="info people-open-btn" data-uid="${esc(r.uid)}"><strong>${esc(r.name)}</strong><small>@${esc(r.username)}</small></div>
      <button class="follow-btn" data-accept-request="${esc(r.uid)}" style="background:#22c55e">Accept</button>
      <button class="follow-btn following" data-reject-request="${esc(r.uid)}">Reject</button>
    </div>
  `).join("");
}

$("privateAccountBtn")?.addEventListener("click", async()=>{
  if(!currentUser || !currentProfile) return;
  const newValue = !currentProfile.private;
  if(newValue && !confirm("Make private?")) return;
  if(!newValue && !confirm("Make public?")) return;
  try{
    await updateDoc(doc(db, "profiles", currentUser.uid), { private: newValue });
    currentProfile.private = newValue;
    updatePrivateToggleUI();
    toast(newValue ? "🔒 Private" : "🌍 Public");
  }catch(e){ toast("Failed"); }
});

$("followRequestsBtn")?.addEventListener("click", ()=>{ hideModal("settingsModal"); showModal("followRequestsModal"); renderFollowRequests(); });

/* ============================================================
   TOGGLE FOLLOW
============================================================ */
async function toggleFollow(targetUid, btnEl){
  if(!currentUser || targetUid === currentUser.uid) return;
  if(btnEl){ btnEl.disabled = true; btnEl.style.opacity = "0.6"; }

  const id = currentUser.uid + "_" + targetUid;
  const ref = doc(db,"follows",id);

  try{
    const snap = await getDoc(ref);
    const targetProfile = await getProfile(targetUid);

    if(snap.exists()){
      await deleteDoc(ref);
      myFollowsCache.delete(targetUid);
      updateAllFollowButtons(targetUid, false);
      await syncFollowCounts(currentUser.uid);
      await syncFollowCounts(targetUid);
    }else{
      if(targetProfile.private){
        if(mySentRequestsCache.has(targetUid)){ await cancelFollowRequest(targetUid); updateAllFollowButtons(targetUid, "cancelled"); }
        else { await sendFollowRequest(targetUid); updateAllFollowButtons(targetUid, "requested"); }
      }else{
        await setDoc(ref, { follower: currentUser.uid, following: targetUid, createdAt: serverTimestamp() });
        myFollowsCache.add(targetUid);
        updateAllFollowButtons(targetUid, true);
        await addDoc(collection(db,"notifications"), {
          to: targetUid, from: currentUser.uid, title: "👤 New Follower",
          message: (currentProfile?.name || "Someone") + " started following you",
          createdAt: serverTimestamp()
        });
        await syncFollowCounts(currentUser.uid);
        await syncFollowCounts(targetUid);
      }
    }

    if($("publicProfileModal")?.classList.contains("show")){
      const uid = $("publicProfileModal").dataset.uid;
      if(uid === targetUid){ await updateFollowButtonState(targetUid); await loadPublicVideos(targetUid); }
    }
  }catch(e){ toast("Follow failed"); }
  finally { if(btnEl){ btnEl.disabled = false; btnEl.style.opacity = "1"; } }
}

function updateAllFollowButtons(targetUid, state){
  document.querySelectorAll(`[data-follow-uid="${targetUid}"]`).forEach(btn=>{
    if(state === true){ btn.textContent = "Following"; btn.classList.add("following"); }
    else if(state === false){ btn.textContent = "Follow"; btn.classList.remove("following"); }
    else if(state === "requested"){ btn.textContent = "Requested"; btn.classList.remove("following"); }
    else if(state === "cancelled"){ btn.textContent = "Follow"; btn.classList.remove("following"); }
  });
}

async function updateFollowButtonState(targetUid){
  const followed = myFollowsCache.has(targetUid);
  const requested = mySentRequestsCache.has(targetUid);
  const btn = $("publicFollowBtn");
  if(!btn) return;
  if(followed){ btn.textContent = "Following"; btn.className = "yt-btn yt-btn-gray"; }
  else if(requested){ btn.textContent = "Requested"; btn.className = "yt-btn yt-btn-gray"; }
  else { btn.textContent = "Follow"; btn.className = "yt-btn yt-btn-primary"; }
}

async function syncFollowCounts(uid){
  try{
    const [followersSnap, followingSnap] = await Promise.all([
      getDocs(query(collection(db,"follows"), where("following","==",uid))),
      getDocs(query(collection(db,"follows"), where("follower","==",uid)))
    ]);
    await updateDoc(doc(db,"profiles",uid), { followers: followersSnap.size, following: followingSnap.size });
    if(currentProfile && currentProfile.uid === uid){
      currentProfile.followers = followersSnap.size;
      currentProfile.following = followingSnap.size;
      $("followersCount").textContent = followersSnap.size;
      $("followingCount").textContent = followingSnap.size;
    }
  }catch(e){}
}

/* ============================================================
   PUBLIC PROFILE
============================================================ */
async function openPublicProfile(uid){
  if(!uid){ toast("Invalid user"); return; }
  try{
    viewingProfileUid = uid;
    const p = await getProfile(uid);
    $("publicProfileModal").dataset.uid = uid;
    $("publicPhoto").src = avatar(p.photo, p.name);
    $("publicName").textContent = p.name || "User";
    $("publicUsername").textContent = "@" + (p.username || "user");

    let extra = [];
    if(p.age) extra.push("Age: " + p.age);
    if(p.gender) extra.push(p.gender);
    if(p.private) extra.push("🔒 Private");
    if(p.suspended) extra.push("🚫 Suspended");
    if(p.monetizationStatus === "approved") extra.push("💰 Monetized");
    $("publicExtra").textContent = extra.join(" · ");

    $("publicFollowers").textContent = p.followers || 0;
    $("publicFollowing").textContent = p.following || 0;
    $("publicVideos").textContent = p.videos || 0;

    const publicBanner = document.querySelector("#publicProfileModal .yt-banner");
    if(publicBanner){
      if(p.bannerType === "image" && p.bannerURL) publicBanner.style.background = `url(${p.bannerURL}) center/cover no-repeat`;
      else if(p.bannerGradient) publicBanner.style.background = p.bannerGradient;
    }

    const followBtn = $("publicFollowBtn");
    const newFollowBtn = followBtn.cloneNode(true);
    followBtn.parentNode.replaceChild(newFollowBtn, followBtn);

    const msgBtn = $("publicMessageBtn");
    const newMsgBtn = msgBtn.cloneNode(true);
    msgBtn.parentNode.replaceChild(newMsgBtn, msgBtn);

    const canView = await canViewUser(uid);

    if(currentUser && uid === currentUser.uid){
      newFollowBtn.style.display = "none";
      newMsgBtn.style.display = "none";
      $("privateAccountNotice").classList.add("hidden");
    }else{
      newFollowBtn.style.display = "";
      newMsgBtn.style.display = "";
      await updateFollowButtonState(uid);
      newFollowBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleFollow(uid, newFollowBtn); });
      newMsgBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openChatFromProfile(uid); });
      if(!canView && p.private) $("privateAccountNotice").classList.remove("hidden");
      else $("privateAccountNotice").classList.add("hidden");
    }

    await loadPublicVideos(uid);

    const fBtn = $("publicFollowersBtn");
    const newFBtn = fBtn.cloneNode(true);
    fBtn.parentNode.replaceChild(newFBtn, fBtn);
    newFBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openPeople(uid, "followers"); });

    const fwBtn = $("publicFollowingBtn");
    const newFwBtn = fwBtn.cloneNode(true);
    fwBtn.parentNode.replaceChild(newFwBtn, fwBtn);
    newFwBtn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openPeople(uid, "following"); });

    startPresenceListener([uid]);
    showModal("publicProfileModal");
  }catch(e){ console.error("openPublicProfile:", e); toast("Error"); }
}

async function loadPublicVideos(uid){
  const canView = await canViewUserVideos(uid);
  const container = $("publicVideosList");
  if(!canView){ container.innerHTML = ""; return; }
  const list = videosCache.filter(v => v.userId === uid && (v.visibility !== "private" || uid === currentUser?.uid));
  if(!list.length){
    container.innerHTML = `<div class="yt-empty" style="padding:30px 0;font-size:13px">No videos yet</div>`;
    return;
  }
  container.innerHTML = list.map(v => createYTVideoItem(v, uid === currentUser?.uid)).join("");
}

function createYTVideoItem(v, isMine){
  const views = Number(v.views || 0);
  return `
  <div class="yt-video-item" data-open-video="${esc(v.id)}">
    <div class="yt-video-thumb">
      <video src="${esc(v.videoURL)}" preload="metadata" muted></video>
      <div class="view-badge">👁️ ${formatViewsShort(views)}</div>
    </div>
    <div class="yt-video-meta">
      <h4>${esc(v.title || "Untitled")}</h4>
      <div class="views">${formatViews(views)}</div>
      <div class="stats">${v.likes || 0} likes · ${timeAgo(v.createdAt)}</div>
      ${isMine ? `<div class="btns" data-stop-propagation>
        <button class="yt-mini-btn primary" data-edit-video="${esc(v.id)}">Edit</button>
        <button class="yt-mini-btn danger" data-delete-video="${esc(v.id)}">Delete</button>
      </div>` : ""}
    </div>
  </div>`;
}

async function loadMyVideos(){
  if(!currentUser) return;
  const list = videosCache.filter(v => v.userId === currentUser.uid);
  const container = $("myVideos");
  if(!container) return;
  if(!list.length){
    container.innerHTML = `<div class="yt-empty" style="padding:40px 20px"><div style="font-size:48px;margin-bottom:12px">📹</div><h3 style="font-size:16px;margin-bottom:6px">No videos yet</h3><p style="font-size:13px">Upload your first video</p></div>`;
    return;
  }
  container.innerHTML = list.map(v => createYTVideoItem(v, true)).join("");
  updateProfileTabCounts();
}

async function openPeople(uid, type){
  if(!uid) return;
  $("peopleTitle").textContent = type === "followers" ? "Followers" : "Following";
  $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">Loading...</div>`;
  showModal("peopleModal");
  try{
    const q = type === "followers"
      ? query(collection(db,"follows"), where("following","==",uid))
      : query(collection(db,"follows"), where("follower","==",uid));
    const snap = await getDocs(q);
    if(!snap.size){ $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">No users yet</div>`; return; }

    const people = [];
    for(const d of snap.docs){
      const data = d.data();
      const personUid = type === "followers" ? data.follower : data.following;
      try{ people.push(await getProfile(personUid)); }catch(e){}
    }

    $("peopleList").innerHTML = people.map(p=>{
      const followed = myFollowsCache.has(p.uid);
      const requested = mySentRequestsCache.has(p.uid);
      const isMe = currentUser && p.uid === currentUser.uid;
      let btnText = "Follow";
      if(followed) btnText = "Following";
      else if(requested) btnText = "Requested";
      return `<div class="person-item">
        <img class="people-open-btn" data-uid="${esc(p.uid)}" src="${avatar(p.photo, p.name)}">
        <div class="info people-open-btn" data-uid="${esc(p.uid)}"><strong>${esc(p.name)}</strong><small>@${esc(p.username)}</small></div>
        ${!isMe && currentUser ? `<button class="follow-btn ${followed?"following":""}" data-follow-uid="${esc(p.uid)}" data-action="follow">${btnText}</button>` : ""}
      </div>`;
    }).join("");
  }catch(e){ $("peopleList").innerHTML = `<div class="yt-empty" style="padding:30px">Error</div>`; }
}

$("myFollowersBtn")?.addEventListener("click", ()=>{ if(currentUser) openPeople(currentUser.uid, "followers"); });
$("myFollowingBtn")?.addEventListener("click", ()=>{ if(currentUser) openPeople(currentUser.uid, "following"); });

/* ============================================================
   SEARCH
============================================================ */
$("topSearchBtn")?.addEventListener("click", ()=>{ showModal("searchModal"); setTimeout(()=> $("searchInput").focus(), 100); });

let searchTimeout = null;
$("searchInput")?.addEventListener("input", e=>{
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(()=> doSearch(e.target.value), 300);
});

async function doSearch(value){
  value = value.trim().toLowerCase();
  const container = $("searchResults");
  if(!value){ container.innerHTML = ""; return; }
  container.innerHTML = `<div class="yt-empty" style="padding:20px">Searching...</div>`;
  try{
    const snap = await getDocs(collection(db,"profiles"));
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(p => String(p.name||"").toLowerCase().includes(value) || String(p.username||"").toLowerCase().includes(value.replace("@","")))
      .slice(0,30);
    if(!users.length){ container.innerHTML = `<div class="yt-empty" style="padding:20px">No user found</div>`; return; }

    container.innerHTML = users.map(p=>{
      const followed = myFollowsCache.has(p.uid);
      const requested = mySentRequestsCache.has(p.uid);
      const isMe = currentUser && p.uid === currentUser.uid;
      let btnText = "Follow";
      if(followed) btnText = "Following";
      else if(requested) btnText = "Requested";
      return `<div class="person-item">
        <img class="search-open-btn" data-uid="${esc(p.uid)}" src="${avatar(p.photo, p.name)}">
        <div class="info search-open-btn" data-uid="${esc(p.uid)}"><strong>${esc(p.name)}${p.private ? " 🔒" : ""}</strong><small>@${esc(p.username)}</small></div>
        ${!isMe && currentUser ? `<button class="follow-btn ${followed?"following":""}" data-follow-uid="${esc(p.uid)}" data-action="follow">${btnText}</button>` : ""}
      </div>`;
    }).join("");
  }catch(e){ container.innerHTML = `<div class="yt-empty" style="padding:20px">Error</div>`; }
}

/* ============================================================
   EDIT PROFILE / SETTINGS
============================================================ */
$("editProfileBtn")?.addEventListener("click", async()=>{
  const p = await getProfile(currentUser.uid);
  $("editName").value = p.name || "";
  $("editUsername").value = p.username || "";
  $("editAge").value = p.age || "";
  $("editGender").value = p.gender || "";
  $("editBio").value = p.bio || "";
  $("editPhotoPreview").src = avatar(p.photo, p.name);
  $("profilePhotoFile").value = "";
  showModal("editProfileModal");
});

$("profilePhotoFile")?.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(file) $("editPhotoPreview").src = URL.createObjectURL(file);
});

$("saveProfileBtn")?.addEventListener("click", async()=>{
  if(!currentUser) return;
  const name = $("editName").value.trim();
  const username = $("editUsername").value.trim().toLowerCase().replace(/^@/,"").replace(/[^a-z0-9_]/g,"");
  const age = $("editAge").value.trim();
  const gender = $("editGender").value;
  const bio = $("editBio").value.trim();
  if(!name){ toast("Name डालो"); return; }
  if(!username){ toast("Username डालो"); return; }

  try{
    $("profileSaveStatus").textContent = "Saving...";
    $("saveProfileBtn").disabled = true;

    const q = query(collection(db,"profiles"), where("username","==",username));
    const snap = await getDocs(q);
    if(snap.docs.some(d => d.id !== currentUser.uid)){ $("profileSaveStatus").textContent = "Username taken"; $("saveProfileBtn").disabled = false; return; }

    let photo = currentProfile?.photo || "";
    const file = $("profilePhotoFile").files[0];
    if(file){ $("profileSaveStatus").textContent = "Uploading photo..."; photo = await uploadToCloudinary(file); }

    await updateDoc(doc(db,"profiles",currentUser.uid), { name, username, age, gender, bio, photo, updatedAt: serverTimestamp() });
    await loadProfile();
    hideModal("editProfileModal");
    $("profileSaveStatus").textContent = "";
    toast("✅ Profile updated");
  }catch(e){ $("profileSaveStatus").textContent = e.message; }
  finally { $("saveProfileBtn").disabled = false; }
});

$("settingsBtn")?.addEventListener("click", ()=> showModal("settingsModal"));

$("darkModeBtn")?.addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("reelhubDark", document.body.classList.contains("dark") ? "1" : "0");
});

if(localStorage.getItem("reelhubDark") === "1") document.body.classList.add("dark");

$("privacyPolicyBtn")?.addEventListener("click", ()=>{ window.location.href = "/ReelHub/privacy.html"; });
$("termsOfServiceBtn")?.addEventListener("click", ()=>{ window.location.href = "/ReelHub/terms.html"; });
$("deleteAccountBtn")?.addEventListener("click", ()=>{ window.location.href = "/ReelHub/delete-account.html"; });
$("contactUsBtn")?.addEventListener("click", ()=>{ window.location.href = "/ReelHub/contact.html"; });

$("logoutBtn")?.addEventListener("click", async()=>{
  if(!confirm("Logout?")) return;
  await markOffline();
  await signOut(auth);
});

$("shareAppBtn")?.addEventListener("click", async()=>{
  const data = { title: "ReelHub", text: "Join me on ReelHub 🎬", url: location.href };
  try{
    if(navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
  }catch(e){}
});

/* ============================================================
   NOTIFICATIONS
============================================================ */
function startNotifications(){
  if(notificationsUnsubscribe){ notificationsUnsubscribe(); notificationsUnsubscribe = null; }
  if(!currentUser) return;
  notificationsUnsubscribe = onSnapshot(
    query(collection(db,"notifications"), where("to","==",currentUser.uid)),
    snapshot=>{
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));

      const badge = $("alertsBadge");
      if(list.length > 0){ badge.textContent = Math.min(list.length, 99); badge.classList.remove("hidden"); }
      else badge.classList.add("hidden");

      if(!list.length){
        $("notificationsList").innerHTML = `<div class="yt-empty" style="padding:30px"><div style="font-size:42px;margin-bottom:10px">🔔</div><p>No notifications</p></div>`;
        return;
      }
      $("notificationsList").innerHTML = list.slice(0,50).map(n=>`
        <div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <strong style="font-size:14px">${esc(n.title || "")}</strong>
          <p style="font-size:13px;color:var(--muted);margin-top:4px">${esc(n.message || "")}</p>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${timeAgo(n.createdAt)}</div>
        </div>`).join("");
    }
  );
}

$("topAlertsBtn")?.addEventListener("click", ()=> showModal("alertsModal"));

/* ============================================================
   PRESENCE
============================================================ */
async function updatePresence(){
  if(!currentUser) return;
  try{
    await setDoc(doc(db, "presence", currentUser.uid), {
      userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "",
      lastSeen: serverTimestamp(),
      online: true
    }, { merge: true });
  }catch(e){}
}

async function markOffline(){
  if(!currentUser) return;
  try{ await updateDoc(doc(db, "presence", currentUser.uid), { online: false, lastSeen: serverTimestamp() }); }catch(e){}
}

function startPresenceHeartbeat(){
  if(!currentUser) return;
  if(heartbeatInterval) clearInterval(heartbeatInterval);
  updatePresence();
  heartbeatInterval = setInterval(updatePresence, 30000);
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "hidden") markOffline();
    else updatePresence();
  });
  window.addEventListener("beforeunload", markOffline);
}

function startPresenceListener(uids){
  if(presenceUnsubscribe){ presenceUnsubscribe(); presenceUnsubscribe = null; }
  if(!uids || !uids.length) return;
  const uniqueUids = [...new Set(uids)].filter(u => u && u !== currentUser?.uid);
  if(!uniqueUids.length) return;
  const limitedUids = uniqueUids.slice(0, 10);
  presenceUnsubscribe = onSnapshot(
    query(collection(db, "presence"), where("userId", "in", limitedUids)),
    snapshot=>{
      snapshot.docs.forEach(d=>{
        const data = d.data();
        onlineUsersCache[data.userId] = { online: data.online, lastSeen: data.lastSeen };
      });
      updateOnlineIndicators();
    }
  );
}

function updateOnlineIndicators(){
  document.querySelectorAll("[data-presence-uid]").forEach(el=>{
    const uid = el.dataset.presenceUid;
    const status = onlineUsersCache[uid];
    if(!status){ el.classList.remove("online"); el.classList.add("offline"); el.textContent = ""; return; }
    if(status.online){ el.classList.add("online"); el.classList.remove("offline"); el.textContent = "Active now"; }
    else { el.classList.remove("online"); el.classList.add("offline"); el.textContent = ""; }
  });
  document.querySelectorAll("[data-dot-uid]").forEach(el=>{
    const uid = el.dataset.dotUid;
    const status = onlineUsersCache[uid];
    el.style.display = status?.online ? "block" : "none";
  });
}

function getOnlineText(uid){
  const status = onlineUsersCache[uid];
  if(!status) return "";
  if(status.online) return "Active now";
  return "";
}

async function markChatAsRead(chatId){
  if(!currentUser || !chatId) return;
  try{
    const userKey = "readBy_" + currentUser.uid;
    await updateDoc(doc(db, "chats", chatId), { [userKey]: serverTimestamp() });
    chatLastReadCache[chatId] = Date.now();
    unreadChatsCache[chatId] = 0;
    updateMsgBadge();
  }catch(e){}
}

async function countUnreadMessages(chatId, lastReadTimestamp){
  if(!currentUser) return 0;
  try{
    const snap = await getDocs(collection(db, "chats", chatId, "messages"));
    let unreadCount = 0;
    snap.forEach(d => {
      const msg = d.data();
      if(msg.userId === currentUser.uid) return;
      if(timeValue(msg.createdAt) > lastReadTimestamp) unreadCount++;
    });
    return unreadCount;
  }catch(e){ return 0; }
}

function updateMsgBadge(){
  const badge = $("msgBadge");
  if(!badge) return;
  let unreadChatCount = 0;
  Object.values(unreadChatsCache).forEach(count => { if(count > 0) unreadChatCount++; });
  if(unreadChatCount > 0){ badge.textContent = unreadChatCount; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");
}

async function calculateAllUnread(){
  if(!currentUser || !myChatsCache.length){ updateMsgBadge(); return; }
  for(const chat of myChatsCache){
    try{
      const userKey = "readBy_" + currentUser.uid;
      const lastRead = timeValue(chat[userKey]);
      unreadChatsCache[chat.id] = await countUnreadMessages(chat.id, lastRead);
    }catch(e){ unreadChatsCache[chat.id] = 0; }
  }
  updateMsgBadge();
}

/* ============================================================
   DM CHAT
============================================================ */
function startChatsListListener(){
  if(chatsListUnsubscribe){ chatsListUnsubscribe(); chatsListUnsubscribe = null; }
  if(!currentUser) return;
  chatsListUnsubscribe = onSnapshot(
    query(collection(db,"chats"), where("members","array-contains",currentUser.uid)),
    async snapshot=>{
      myChatsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      myChatsCache.sort((a,b)=> timeValue(b.updatedAt) - timeValue(a.updatedAt));
      await calculateAllUnread();
      const inbox = $("dmInboxView");
      if(inbox && !inbox.classList.contains("hidden")) renderDMInbox();
      const chatUids = myChatsCache.map(c => c.members.find(uid => uid !== currentUser.uid));
      if(chatUids.length) startPresenceListener(chatUids);
    }
  );
}

function showDMInbox(){
  const inbox = $("dmInboxView");
  const chat = $("dmChatView");
  if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
  if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }
  if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
  currentChatId = null; currentChatUser = null;
  renderDMInbox();
}

function renderDMInbox(){
  const container = $("dmInboxList");
  if(!container) return;
  if(!myChatsCache.length){
    container.innerHTML = `<div class="dm-empty"><span class="icon">💬</span><h3>No messages yet</h3><p>Start a conversation</p></div>`;
    return;
  }
  container.innerHTML = myChatsCache.map(c=>{
    const otherUid = c.members.find(uid => uid !== currentUser.uid);
    const unreadCount = unreadChatsCache[c.id] || 0;
    const unreadDot = unreadCount > 0 ? `<span class="dm-unread-dot"></span>` : "";
    return `<div class="dm-inbox-item ${unreadCount > 0 ? 'unread' : ''}" data-open-chat="${esc(otherUid)}">
      <div class="avatar-wrapper">
        <img src="${avatar("", "U")}" class="dm-inbox-avatar-${esc(otherUid)}">
        <span class="online-indicator" data-dot-uid="${esc(otherUid)}" style="display:none"></span>
      </div>
      <div class="dm-inbox-info">
        <strong class="dm-inbox-name-${esc(otherUid)}">${unreadDot}Loading...</strong>
        <small>${esc(c.lastMessage || "Started a chat")}</small>
      </div>
      <div class="dm-inbox-time">${timeAgo(c.updatedAt)}</div>
    </div>`;
  }).join("");
  myChatsCache.forEach(async c=>{
    const otherUid = c.members.find(uid => uid !== currentUser.uid);
    try{
      const p = await getProfile(otherUid);
      document.querySelectorAll(".dm-inbox-avatar-" + otherUid).forEach(img=>{ img.src = avatar(p.photo, p.name); });
      document.querySelectorAll(".dm-inbox-name-" + otherUid).forEach(el=>{ el.innerHTML = (unreadChatsCache[c.id] > 0 ? `<span class="dm-unread-dot"></span>` : "") + p.name; });
    }catch(e){}
  });
  updateOnlineIndicators();
}

async function openChat(uid){
  if(!currentUser || uid === currentUser.uid) return;
  const p = await getProfile(uid);
  currentChatUser = p;
  currentChatId = [currentUser.uid, uid].sort().join("_");
  setTimeout(()=> markChatAsRead(currentChatId), 500);

  const avatarEl = $("dmChatAvatar");
  const nameEl = $("dmChatName");
  const inbox = $("dmInboxView");
  const chat = $("dmChatView");
  if(avatarEl) avatarEl.src = avatar(p.photo, p.name);
  if(nameEl) nameEl.textContent = p.name || "User";
  if(inbox){ inbox.classList.add("hidden"); inbox.style.display = "none"; }
  if(chat){ chat.classList.remove("hidden"); chat.style.display = "flex"; }

  const statusEl = document.querySelector(".dm-chat-header .info small");
  if(statusEl){
    statusEl.dataset.presenceUid = uid;
    statusEl.textContent = getOnlineText(uid);
    statusEl.classList.add("dm-chat-status");
    if(getOnlineText(uid) === "") statusEl.classList.add("offline");
    else statusEl.classList.remove("offline");
  }

  const profileBtn = $("dmChatProfileBtn");
  if(profileBtn) profileBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); openPublicProfile(uid); };

  hideModal("publicProfileModal");
  hideModal("searchModal");
  startPresenceListener([uid]);

  try{ await setDoc(doc(db,"chats",currentChatId), { members: [currentUser.uid, uid], updatedAt: serverTimestamp() }, { merge: true }); }catch(e){}
  startChatListener();
}

function openChatFromProfile(uid){
  if(!uid) return;
  hideModal("publicProfileModal");
  hideModal("searchModal");
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $("messagesPanel").classList.remove("hidden");
  $("mainTopbar").classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
  document.querySelector('[data-panel="messagesPanel"]')?.classList.add("active");
  setTimeout(()=> openChat(uid), 200);
}

function startChatListener(){
  if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
  if(!currentChatId) return;
  chatUnsubscribe = onSnapshot(collection(db,"chats",currentChatId,"messages"), snapshot=>{
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
    const container = $("dmMessages");
    if(!container) return;
    if(!list.length){
      container.innerHTML = `<div class="yt-empty" style="padding:40px 20px;color:var(--muted)"><p style="font-size:13px">No messages yet. Say hi! 👋</p></div>`;
      return;
    }
    container.innerHTML = list.map(m=>{
      const mine = m.userId === currentUser.uid;
      if(m.type === "shared_video" && m.videoId){
        return `<div class="dm-msg ${mine?"me":"them"}"><div class="dm-shared-video" data-open-shared="${esc(m.videoId)}"><video src="${esc(m.videoURL || "")}" muted preload="metadata"></video><div class="info"><strong>${esc(m.videoTitle || "Video")}</strong></div></div><small>${timeAgo(m.createdAt)}</small></div>`;
      }
      if(m.type === "image" && m.imageURL){
        return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent"><div class="dm-msg-image" data-open-image="${esc(m.imageURL)}"><img src="${esc(m.imageURL)}" alt="Photo"></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
      }
      if(m.type === "chat_video" && m.videoURL){
        return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent"><div class="dm-msg-image"><video src="${esc(m.videoURL)}" controls playsinline preload="metadata" style="width:100%;display:block;border-radius:12px;max-height:280px;background:#000"></video></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
      }
      if(m.type === "file" && m.fileURL){
        const fInfo = getFileIcon(m.fileName, m.fileType);
        return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent"><div class="group-msg-file" data-open-file="${esc(m.fileURL)}" data-file-name="${esc(m.fileName)}"><div class="file-icon ${fInfo.cls}">${fInfo.icon}</div><div class="file-info"><strong>${esc(m.fileName || "File")}</strong><small>${formatFileSize(m.fileSize || 0)}</small></div><div class="file-download">⬇️</div></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
      }
      return `<div class="dm-msg ${mine?"me":"them"}">${esc(m.text)}<small>${timeAgo(m.createdAt)}</small></div>`;
    }).join("");
    container.scrollTop = container.scrollHeight;
  });
}

$("dmSendBtn")?.addEventListener("click", sendDM);
$("dmInput")?.addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); sendDM(); } });

async function sendDM(){
  const input = $("dmInput");
  if(!input) return;
  const text = input.value.trim();
  if(!text || !currentChatId) return;
  if(processingMessages.has(text)) return;
  const now = Date.now();
  if(now - lastSentMessageTime < MESSAGE_COOLDOWN) return;
  processingMessages.add(text); lastSentMessageTime = now;
  input.value = "";

  try{
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      text, type: "text", createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"chats",currentChatId), { lastMessage: text, updatedAt: serverTimestamp() });
  }catch(e){ toast("Send failed"); input.value = text; }
  finally { setTimeout(() => processingMessages.delete(text), 2000); }
}

$("dmBackBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); if(currentChatId) markChatAsRead(currentChatId); showDMInbox(); });
$("newMsgBtn")?.addEventListener("click", ()=>{ showModal("searchModal"); setTimeout(()=> $("searchInput").focus(), 100); });

$("dmAttachBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("dmAttachMenu")?.classList.toggle("show"); });

document.addEventListener("click", (e)=>{
  const menu = $("dmAttachMenu");
  const btn = $("dmAttachBtn");
  if(!menu || !btn) return;
  if(!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove("show");
});

$("attachPhotoBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("dmAttachMenu")?.classList.remove("show"); $("dmPhotoFile")?.click(); });
$("attachVideoBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("dmAttachMenu")?.classList.remove("show"); $("dmVideoFile")?.click(); });
$("attachPdfBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("dmAttachMenu")?.classList.remove("show"); $("dmPdfFile")?.click(); });

$("dmPhotoFile")?.addEventListener("change", async (e)=>{ const file = e.target.files[0]; if(!file || !currentChatId) return; await sendPhotoInChat(file); e.target.value = ""; });
$("dmVideoFile")?.addEventListener("change", async (e)=>{ const file = e.target.files[0]; if(!file || !currentChatId) return; await sendChatVideo(file); e.target.value = ""; });
$("dmPdfFile")?.addEventListener("change", async (e)=>{ const file = e.target.files[0]; if(!file || !currentChatId) return; await sendPdfInChat(file); e.target.value = ""; });

async function sendPhotoInChat(file){
  try{
    toast("Uploading photo...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("Photo " + pct + "%"); });
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      text: "", type: "image", imageURL: url, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"chats",currentChatId), { lastMessage: "📷 Photo", updatedAt: serverTimestamp() });
    toast("✅ Photo sent");
  }catch(e){ toast("Photo failed"); }
}

async function sendChatVideo(file){
  try{
    toast("Uploading video...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("Video " + pct + "%"); });
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      text: "", type: "chat_video", videoURL: url, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"chats",currentChatId), { lastMessage: "🎥 Video", updatedAt: serverTimestamp() });
    toast("✅ Video sent");
  }catch(e){ toast("Video failed"); }
}

async function sendPdfInChat(file){
  try{
    if(file.size > GROUP_MAX_PDF_SIZE){ toast("File too large (max 50MB)"); return; }
    toast("Uploading file...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("File " + pct + "%"); });
    await addDoc(collection(db,"chats",currentChatId,"messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      text: "", type: "file", fileURL: url, fileName: file.name, fileSize: file.size, fileType: file.type,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"chats",currentChatId), { lastMessage: "📄 File", updatedAt: serverTimestamp() });
    toast("✅ File sent");
  }catch(e){ toast("File failed"); }
}

$("dmSearchInput")?.addEventListener("input", e=>{
  const val = e.target.value.toLowerCase().trim();
  document.querySelectorAll("#dmInboxList .dm-inbox-item").forEach(item=>{
    const name = item.querySelector("strong")?.textContent.toLowerCase() || "";
    item.style.display = name.includes(val) ? "" : "none";
  });
});

/* ============================================================
   GROUPS
============================================================ */
function openCreateGroupModal(){
  $("groupName").value = "";
  $("groupDescription").value = "";
  $("createGroupStatus").textContent = "";
  $("groupPhotoPreview").src = "https://ui-avatars.com/api/?name=G&size=200&background=7c3aed&color=fff";

  document.querySelectorAll("#groupTypeGroup .yt-radio").forEach(r => r.classList.remove("selected"));
  document.querySelector('#groupTypeGroup .yt-radio[data-value="public"]')?.classList.add("selected");

  window.__selectedGroupType = "public";
  window.__groupPhotoFile = null;

  hideModal("advancedSettingsModal");
  showModal("createGroupModal");
}

document.addEventListener("click", (e)=>{
  const typeRadio = e.target.closest("#groupTypeGroup .yt-radio");
  if(typeRadio){
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll("#groupTypeGroup .yt-radio").forEach(r => r.classList.remove("selected"));
    typeRadio.classList.add("selected");
    window.__selectedGroupType = typeRadio.dataset.value;
  }
});

$("groupPhotoPick")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("groupPhotoFile")?.click(); });

$("groupPhotoFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > GROUP_MAX_PHOTO_SIZE){ toast("Photo too large"); e.target.value = ""; return; }
  window.__groupPhotoFile = file;
  $("groupPhotoPreview").src = URL.createObjectURL(file);
});

$("createGroupBtn")?.addEventListener("click", async ()=>{
  if(!currentUser){ toast("Login required"); return; }
  const name = $("groupName").value.trim();
  const description = $("groupDescription").value.trim();
  const type = window.__selectedGroupType || "public";
  const status = $("createGroupStatus");

  if(!name){ status.style.color = "#ed4956"; status.textContent = "Group name required"; return; }

  const btn = $("createGroupBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Creating..."; }
  status.style.color = "#7c3aed"; status.textContent = "Creating...";

  try{
    let photoURL = "";
    if(window.__groupPhotoFile){
      status.textContent = "Uploading photo...";
      photoURL = await uploadToCloudinary(window.__groupPhotoFile, (pct)=>{ status.textContent = "Photo " + pct + "%"; });
    }

    const groupData = {
      name, description, photo: photoURL, type,
      createdBy: currentUser.uid,
      createdByName: currentProfile?.name || "User",
      createdByPhoto: currentProfile?.photo || "",
      members: [currentUser.uid], admins: [currentUser.uid], memberCount: 1,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      lastMessage: "Group created", lastMessageAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "groups"), groupData);

    await setDoc(doc(db, "groups", docRef.id, "members", currentUser.uid), {
      userId: currentUser.uid, name: currentProfile?.name || "User",
      username: currentProfile?.username || "", photo: currentProfile?.photo || "",
      role: "admin", joinedAt: serverTimestamp()
    });

    await addDoc(collection(db, "groups", docRef.id, "messages"), {
      userId: "system", userName: "System", text: `Group "${name}" was created`,
      type: "system", createdAt: serverTimestamp()
    });

    status.style.color = "#22c55e"; status.textContent = "✅ Created!";
    window.__groupPhotoFile = null;
    toast("✅ Group created");

    setTimeout(() => { hideModal("createGroupModal"); openGroupView(docRef.id); }, 600);
  }catch(err){
    console.error("Create group error:", err);
    status.style.color = "#ed4956"; status.textContent = "Error: " + err.message;
  }finally{ if(btn){ btn.disabled = false; btn.textContent = "✅ Create Group"; } }
});

function startMyGroupsListener(){
  if(myGroupsUnsubscribe){ myGroupsUnsubscribe(); myGroupsUnsubscribe = null; }
  if(!currentUser) return;
  myGroupsUnsubscribe = onSnapshot(
    query(collection(db, "groups"), where("members", "array-contains", currentUser.uid)),
    snapshot=>{
      myGroupsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      myGroupsCache.sort((a,b)=> timeValue(b.lastMessageAt || b.createdAt) - timeValue(a.lastMessageAt || a.createdAt));
      renderGroupsList();
    }
  );
}

function renderGroupsList(){
  const container = $("dmGroupsList");
  if(!container) return;
  if(!currentUser){ container.innerHTML = ""; return; }
  if(!myGroupsCache.length){
    container.innerHTML = `<div class="group-empty"><span class="icon">👥</span><h3>No groups yet</h3><p>Create your first group</p><button class="create-btn" id="createFirstGroupBtn">➕ Create Group</button></div>`;
    $("createFirstGroupBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openCreateGroupModal(); });
    return;
  }
  container.innerHTML = myGroupsCache.map(g => {
    const badge = g.type === "public" ? `<span class="group-type-badge public">🌍 Public</span>` : `<span class="group-type-badge private">🔒 Private</span>`;
    return `<div class="group-inbox-item" data-open-group="${esc(g.id)}">
      <img src="${avatar(g.photo, g.name)}" alt="">
      <div class="group-inbox-info"><strong>${esc(g.name)} ${badge}</strong><small>${esc(g.lastMessage || "No messages")}</small></div>
      <div class="group-inbox-time">${timeAgo(g.lastMessageAt || g.createdAt)}</div>
    </div>`;
  }).join("");
}

async function openGroupView(groupId){
  if(!groupId){ toast("Invalid group"); return; }
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()){ toast("Group not found"); return; }
    currentGroupId = groupId;
    currentGroupData = { id: groupId, ...groupSnap.data() };

    $("groupViewModal").dataset.groupId = groupId;
    $("groupViewTitle").textContent = currentGroupData.name || "Group";
    $("groupViewPhoto").src = avatar(currentGroupData.photo, currentGroupData.name);
    $("groupViewName").textContent = currentGroupData.name || "Group";
    $("groupViewMeta").textContent = `${currentGroupData.memberCount || currentGroupData.members?.length || 0} members`;
    $("groupViewType").innerHTML = currentGroupData.type === "public" ? "🌍 Public Group" : "🔒 Private Group";
    $("groupViewDesc").textContent = currentGroupData.description || "No description";

    const isMember = currentGroupData.members?.includes(currentUser.uid);
    const isAdmin = currentGroupData.admins?.includes(currentUser.uid);

    const joinBtn = $("groupJoinBtn");
    const chatBtn = $("groupOpenChatBtn");
    const leaveBtn = $("groupLeaveBtn");
    const requestsTab = $("groupRequestsTab");

    if(isMember){
      if(joinBtn) joinBtn.style.display = "none";
      if(chatBtn) chatBtn.style.display = "block";
      if(leaveBtn) leaveBtn.style.display = "block";
      if(requestsTab && isAdmin) requestsTab.style.display = "block";
    }else{
      if(joinBtn){
        joinBtn.style.display = "block";
        joinBtn.textContent = currentGroupData.type === "public" ? "Join Group" : "Request to Join";
        joinBtn.onclick = async ()=>{
          if(currentGroupData.type === "public") await joinPublicGroup(groupId);
          else await sendGroupJoinRequest(groupId);
        };
      }
      if(chatBtn) chatBtn.style.display = "none";
      if(leaveBtn) leaveBtn.style.display = "none";
      if(requestsTab) requestsTab.style.display = "none";
    }

    $("groupInfoCreator").textContent = currentGroupData.createdByName || "Unknown";
    $("groupInfoDate").textContent = new Date(timeValue(currentGroupData.createdAt)).toLocaleDateString();
    $("groupInfoId").textContent = groupId;

    const editBtn = $("editGroupBtn");
    if(editBtn) editBtn.style.display = (isAdmin || currentGroupData.createdBy === currentUser.uid) ? "flex" : "none";

    await loadGroupMembers(groupId);
    if(isAdmin) startGroupRequestsListener(groupId);

    document.querySelectorAll("#groupTabs .yt-tab").forEach(t => t.classList.remove("active"));
    document.querySelector("#groupTabs .yt-tab[data-gtab='members']")?.classList.add("active");
    $("groupMembersTab")?.classList.remove("hidden");
    $("groupRequestsTabContent")?.classList.add("hidden");
    $("groupInfoTab")?.classList.add("hidden");

    showModal("groupViewModal");
  }catch(e){ console.error("openGroupView:", e); toast("Error"); }
}

async function loadGroupMembers(groupId){
  const container = $("groupMembersTab");
  if(!container) return;
  try{
    const snap = await getDocs(collection(db, "groups", groupId, "members"));
    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(!members.length){ container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No members</div>`; return; }
    const isAdmin = currentGroupData?.admins?.includes(currentUser.uid);
    container.innerHTML = members.map(m => {
      const isMemAdmin = currentGroupData?.admins?.includes(m.userId);
      return `<div class="group-member-item">
        <img src="${avatar(m.photo, m.name)}" class="group-member-open" data-uid="${esc(m.userId)}">
        <div class="info group-member-open" data-uid="${esc(m.userId)}"><strong>${esc(m.name || "User")}</strong><small>@${esc(m.username || "user")}</small></div>
        ${isMemAdmin ? `<span class="admin-badge">👑 Admin</span>` : ""}
        ${isAdmin && m.userId !== currentUser.uid ? `<button class="remove-btn" data-remove-member="${esc(m.userId)}">Remove</button>` : ""}
      </div>`;
    }).join("");
  }catch(e){ container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">Error</div>`; }
}

async function joinPublicGroup(groupId){
  if(!currentUser){ toast("Login required"); return; }
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    const group = groupSnap.data();
    if(group.members?.includes(currentUser.uid)){ toast("Already member"); return; }
    if((group.memberCount || 0) >= GROUP_MAX_MEMBERS){ toast(`Group full`); return; }

    await updateDoc(doc(db, "groups", groupId), {
      members: [...(group.members || []), currentUser.uid],
      memberCount: increment(1), updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "groups", groupId, "members", currentUser.uid), {
      userId: currentUser.uid, name: currentProfile?.name || "User",
      username: currentProfile?.username || "", photo: currentProfile?.photo || "",
      role: "member", joinedAt: serverTimestamp()
    });
    await addDoc(collection(db, "groups", groupId, "messages"), {
      userId: "system", userName: "System",
      text: `${currentProfile?.name || "Someone"} joined the group`,
      type: "system", createdAt: serverTimestamp()
    });
    toast("✅ Joined");
    await openGroupView(groupId);
  }catch(e){ toast("Failed"); }
}

async function sendGroupJoinRequest(groupId){
  if(!currentUser) return;
  try{
    const reqId = currentUser.uid + "_" + groupId;
    const reqSnap = await getDoc(doc(db, "group_join_requests", reqId));
    if(reqSnap.exists()){ toast("Request already sent"); return; }

    await setDoc(doc(db, "group_join_requests", reqId), {
      groupId, userId: currentUser.uid,
      userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "",
      username: currentProfile?.username || "",
      status: "pending", createdAt: serverTimestamp()
    });

    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(groupSnap.exists()){
      const admins = groupSnap.data().admins || [];
      for(const adminUid of admins){
        await addDoc(collection(db, "notifications"), {
          to: adminUid, from: currentUser.uid, title: "👥 Join Request",
          message: `${currentProfile?.name || "Someone"} wants to join "${groupSnap.data().name}"`,
          createdAt: serverTimestamp()
        });
      }
    }
    toast("✅ Request sent");
  }catch(e){ toast("Failed"); }
}

function startGroupRequestsListener(groupId){
  if(groupRequestsUnsubscribe){ groupRequestsUnsubscribe(); groupRequestsUnsubscribe = null; }
  if(!groupId) return;
  groupRequestsUnsubscribe = onSnapshot(
    query(collection(db, "group_join_requests"), where("groupId", "==", groupId)),
    snapshot=>{
      groupJoinRequestsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      groupJoinRequestsCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      const badge = $("groupRequestsCount");
      if(badge) badge.textContent = groupJoinRequestsCache.length ? `(${groupJoinRequestsCache.length})` : "";
      renderGroupRequests();
    }
  );
}

function renderGroupRequests(){
  const container = $("groupRequestsTabContent");
  if(!container) return;
  if(!groupJoinRequestsCache.length){
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No pending requests</div>`;
    return;
  }
  container.innerHTML = groupJoinRequestsCache.map(r => `
    <div class="group-request-item">
      <img src="${avatar(r.userPhoto, r.userName)}" class="group-request-open" data-uid="${esc(r.userId)}">
      <div class="info group-request-open" data-uid="${esc(r.userId)}"><strong>${esc(r.userName)}</strong><small>@${esc(r.username || "user")}</small></div>
      <div class="group-request-actions">
        <button class="accept-btn" data-accept-group-request="${esc(r.id)}">Accept</button>
        <button class="reject-btn" data-reject-group-request="${esc(r.id)}">Reject</button>
      </div>
    </div>
  `).join("");
}

async function acceptGroupJoinRequest(reqId){
  try{
    const reqSnap = await getDoc(doc(db, "group_join_requests", reqId));
    if(!reqSnap.exists()) return;
    const req = reqSnap.data();
    const groupId = req.groupId;
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    const group = groupSnap.data();

    if((group.memberCount || 0) >= GROUP_MAX_MEMBERS){ toast("Group full"); return; }

    await updateDoc(doc(db, "groups", groupId), {
      members: [...(group.members || []), req.userId],
      memberCount: increment(1), updatedAt: serverTimestamp()
    });
    await setDoc(doc(db, "groups", groupId, "members", req.userId), {
      userId: req.userId, name: req.userName || "User",
      username: req.username || "", photo: req.userPhoto || "",
      role: "member", joinedAt: serverTimestamp()
    });
    await addDoc(collection(db, "groups", groupId, "messages"), {
      userId: "system", userName: "System",
      text: `${req.userName || "Someone"} joined the group`,
      type: "system", createdAt: serverTimestamp()
    });
    await addDoc(collection(db, "notifications"), {
      to: req.userId, from: currentUser.uid, title: "✅ Request Accepted",
      message: `Your request to join "${group.name}" was accepted`,
      createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "group_join_requests", reqId));
    toast("✅ Accepted");
  }catch(e){ toast("Failed"); }
}

async function rejectGroupJoinRequest(reqId){
  try{
    const reqSnap = await getDoc(doc(db, "group_join_requests", reqId));
    if(!reqSnap.exists()) return;
    const req = reqSnap.data();
    await addDoc(collection(db, "notifications"), {
      to: req.userId, from: currentUser.uid, title: "❌ Request Rejected",
      message: "Your request was rejected", createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "group_join_requests", reqId));
    toast("Rejected");
  }catch(e){ toast("Failed"); }
}

async function leaveGroup(groupId){
  if(!currentUser) return;
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    const group = groupSnap.data();
    if(group.createdBy === currentUser.uid){ toast("You are creator. Delete instead."); return; }

    await updateDoc(doc(db, "groups", groupId), {
      members: (group.members || []).filter(uid => uid !== currentUser.uid),
      memberCount: increment(-1), updatedAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "groups", groupId, "members", currentUser.uid));
    await addDoc(collection(db, "groups", groupId, "messages"), {
      userId: "system", userName: "System",
      text: `${currentProfile?.name || "Someone"} left the group`,
      type: "system", createdAt: serverTimestamp()
    });
    hideModal("groupViewModal");
    toast("✅ Left group");
  }catch(e){ toast("Failed"); }
}

async function deleteGroup(groupId){
  if(!currentUser) return;
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    const group = groupSnap.data();
    if(group.createdBy !== currentUser.uid && !isAdminUser()){ toast("Only creator can delete"); return; }
    if(!confirm(`Delete "${group.name}"?`)) return;

    const messages = await getDocs(collection(db, "groups", groupId, "messages"));
    for(const m of messages.docs) await deleteDoc(m.ref);
    const members = await getDocs(collection(db, "groups", groupId, "members"));
    for(const m of members.docs) await deleteDoc(m.ref);
    const reqs = await getDocs(query(collection(db, "group_join_requests"), where("groupId", "==", groupId)));
    for(const r of reqs.docs) await deleteDoc(r.ref);

    await deleteDoc(doc(db, "groups", groupId));
    hideModal("groupViewModal"); hideModal("groupMenuModal");
    toast("🗑️ Group deleted");
  }catch(e){ toast("Failed"); }
}

async function removeGroupMember(groupId, memberUid){
  if(!currentUser) return;
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    const group = groupSnap.data();
    if(!group.admins?.includes(currentUser.uid)){ toast("Only admins"); return; }
    if(memberUid === currentUser.uid){ toast("Can't remove self"); return; }

    await updateDoc(doc(db, "groups", groupId), {
      members: (group.members || []).filter(uid => uid !== memberUid),
      memberCount: increment(-1), updatedAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "groups", groupId, "members", memberUid));
    toast("✅ Removed");
    await loadGroupMembers(groupId);
  }catch(e){ toast("Failed"); }
}

async function openEditGroupModal(){
  if(!currentGroupId || !currentGroupData){ toast("Group not loaded"); return; }
  const isAdmin = currentGroupData.admins?.includes(currentUser.uid);
  const isCreator = currentGroupData.createdBy === currentUser.uid;
  if(!isAdmin && !isCreator){ toast("Only admins can edit"); return; }

  $("editGroupName").value = currentGroupData.name || "";
  $("editGroupDescription").value = currentGroupData.description || "";
  $("editGroupPhotoPreview").src = avatar(currentGroupData.photo, currentGroupData.name);
  $("editGroupPhotoFile").value = "";
  $("editGroupStatus").textContent = "";

  document.querySelectorAll("#editGroupTypeGroup .yt-radio").forEach(r => r.classList.remove("selected"));
  document.querySelector(`#editGroupTypeGroup .yt-radio[data-value="${currentGroupData.type}"]`)?.classList.add("selected");

  window.__editGroupType = currentGroupData.type;
  window.__editGroupPhotoFile = null;

  hideModal("groupViewModal");
  showModal("editGroupModal");
}

document.addEventListener("click", (e)=>{
  const typeRadio = e.target.closest("#editGroupTypeGroup .yt-radio");
  if(typeRadio){
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll("#editGroupTypeGroup .yt-radio").forEach(r => r.classList.remove("selected"));
    typeRadio.classList.add("selected");
    window.__editGroupType = typeRadio.dataset.value;
  }
});

$("editGroupPhotoPick")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("editGroupPhotoFile")?.click(); });

$("editGroupPhotoFile")?.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > GROUP_MAX_PHOTO_SIZE){ toast("Too large"); e.target.value = ""; return; }
  window.__editGroupPhotoFile = file;
  $("editGroupPhotoPreview").src = URL.createObjectURL(file);
});

$("saveGroupEditBtn")?.addEventListener("click", async ()=>{
  if(!currentGroupId) return;
  const name = $("editGroupName").value.trim();
  const description = $("editGroupDescription").value.trim();
  const type = window.__editGroupType || "public";
  const status = $("editGroupStatus");

  if(!name){ status.style.color = "#ed4956"; status.textContent = "Name required"; return; }

  const btn = $("saveGroupEditBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Saving..."; }
  status.style.color = "#7c3aed"; status.textContent = "Saving...";

  try{
    let photoURL = currentGroupData.photo || "";
    if(window.__editGroupPhotoFile){
      status.textContent = "Uploading photo...";
      photoURL = await uploadToCloudinary(window.__editGroupPhotoFile, (pct)=>{ status.textContent = "Photo " + pct + "%"; });
    }

    await updateDoc(doc(db, "groups", currentGroupId), {
      name, description, photo: photoURL, type, updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, "groups", currentGroupId, "messages"), {
      userId: "system", userName: "System",
      text: `Group info was updated by ${currentProfile?.name || "admin"}`,
      type: "system", createdAt: serverTimestamp()
    });

    status.style.color = "#22c55e"; status.textContent = "✅ Saved!";
    window.__editGroupPhotoFile = null;
    toast("✅ Group updated");

    setTimeout(() => { hideModal("editGroupModal"); openGroupView(currentGroupId); }, 700);
  }catch(err){
    status.style.color = "#ed4956"; status.textContent = "Error: " + err.message;
  }finally{ if(btn){ btn.disabled = false; btn.textContent = "✅ Save Changes"; } }
});

/* Group Click Handlers */
document.addEventListener("click", async (e)=>{
  const t = e.target;

  const openGroup = t.closest("[data-open-group]");
  if(openGroup){ e.preventDefault(); e.stopPropagation(); const gid = openGroup.dataset.openGroup; if(gid) await openGroupView(gid); return; }

  const memberOpen = t.closest(".group-member-open");
  if(memberOpen){ e.preventDefault(); e.stopPropagation(); const uid = memberOpen.dataset.uid; if(uid) openPublicProfile(uid); return; }

  const reqOpen = t.closest(".group-request-open");
  if(reqOpen){ e.preventDefault(); e.stopPropagation(); const uid = reqOpen.dataset.uid; if(uid) openPublicProfile(uid); return; }

  const acceptReq = t.closest("[data-accept-group-request]");
  if(acceptReq){ e.preventDefault(); e.stopPropagation(); const reqId = acceptReq.dataset.acceptGroupRequest; if(reqId) await acceptGroupJoinRequest(reqId); return; }

  const rejectReq = t.closest("[data-reject-group-request]");
  if(rejectReq){ e.preventDefault(); e.stopPropagation(); const reqId = rejectReq.dataset.rejectGroupRequest; if(reqId) await rejectGroupJoinRequest(reqId); return; }

  const removeMember = t.closest("[data-remove-member]");
  if(removeMember){
    e.preventDefault(); e.stopPropagation();
    const memberUid = removeMember.dataset.removeMember;
    if(memberUid && currentGroupId && confirm("Remove this member?")) await removeGroupMember(currentGroupId, memberUid);
    return;
  }

  const editGroupBtn = t.closest("#editGroupBtn");
  if(editGroupBtn){ e.preventDefault(); e.stopPropagation(); await openEditGroupModal(); return; }
});

$("createGroupFromSettingsBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openCreateGroupModal(); });
$("myGroupsBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  hideModal("advancedSettingsModal");
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $("messagesPanel")?.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
  document.querySelector('[data-panel="messagesPanel"]')?.classList.add("active");
  switchToGroupsTab();
});
$("newGroupBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); openCreateGroupModal(); });

function switchToChatsTab(){
  document.querySelectorAll("#dmTabs .dm-tab").forEach(t => { t.classList.remove("active"); t.style.borderBottomColor = "transparent"; t.style.color = "var(--muted)"; });
  const tab = document.querySelector('#dmTabs .dm-tab[data-dmtab="chats"]');
  if(tab){ tab.classList.add("active"); tab.style.borderBottomColor = "var(--primary)"; tab.style.color = "var(--primary)"; }
  $("dmInboxList")?.classList.remove("hidden");
  $("dmGroupsList")?.classList.add("hidden");
}

function switchToGroupsTab(){
  document.querySelectorAll("#dmTabs .dm-tab").forEach(t => { t.classList.remove("active"); t.style.borderBottomColor = "transparent"; t.style.color = "var(--muted)"; });
  const tab = document.querySelector('#dmTabs .dm-tab[data-dmtab="groups"]');
  if(tab){ tab.classList.add("active"); tab.style.borderBottomColor = "var(--primary)"; tab.style.color = "var(--primary)"; }
  $("dmInboxList")?.classList.add("hidden");
  $("dmGroupsList")?.classList.remove("hidden");
  renderGroupsList();
}

document.addEventListener("click", (e)=>{
  const tab = e.target.closest("#dmTabs .dm-tab");
  if(!tab) return;
  e.preventDefault(); e.stopPropagation();
  if(tab.dataset.dmtab === "groups") switchToGroupsTab();
  else switchToChatsTab();
});

/* Group Chat */
async function openGroupChat(groupId){
  if(!groupId) return;
  try{
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if(!groupSnap.exists()) return;
    currentGroupId = groupId;
    currentGroupData = { id: groupId, ...groupSnap.data() };

    $("groupChatAvatar").src = avatar(currentGroupData.photo, currentGroupData.name);
    $("groupChatName").textContent = currentGroupData.name || "Group";
    $("groupChatMeta").textContent = `${currentGroupData.memberCount || 0} members`;

    hideModal("groupViewModal");
    showModal("groupChatModal");
    startGroupChatListener(groupId);
    setTimeout(()=> $("groupChatInput")?.focus(), 300);
  }catch(e){ toast("Error"); }
}

function startGroupChatListener(groupId){
  if(groupChatUnsubscribe){ groupChatUnsubscribe(); groupChatUnsubscribe = null; }
  if(!groupId) return;
  groupChatUnsubscribe = onSnapshot(
    query(collection(db, "groups", groupId, "messages")),
    snapshot=>{
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
      renderGroupMessages(list);
    }
  );
}

function renderGroupMessages(list){
  const container = $("groupChatMessages");
  if(!container) return;

  if(!list.length){
    container.innerHTML = `<div class="group-chat-empty"><span class="icon">💬</span><p>No messages yet</p></div>`;
    return;
  }

  container.innerHTML = list.map(m => {
    const mine = m.userId === currentUser.uid;

    if(m.type === "system"){
      return `<div style="text-align:center;padding:10px 20px;font-size:11.5px;color:var(--muted);font-style:italic">${esc(m.text)}</div>`;
    }

    const senderName = mine ? "" : `<span class="sender-name">${esc(m.userName || "User")}</span>`;

    if(m.type === "text" || !m.type){
      return `<div class="dm-msg ${mine?"me":"them"}">${senderName}${esc(m.text)}<small>${timeAgo(m.createdAt)}</small></div>`;
    }
    if(m.type === "image" && m.imageURL){
      return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent">${senderName}<div class="group-msg-image" data-open-group-image="${esc(m.imageURL)}"><img src="${esc(m.imageURL)}" alt="Photo"></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
    }
    if(m.type === "video" && m.videoURL){
      return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent">${senderName}<div class="group-msg-video"><video src="${esc(m.videoURL)}" controls playsinline preload="metadata"></video></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
    }
    if(m.type === "file" && m.fileURL){
      const fInfo = getFileIcon(m.fileName, m.fileType);
      return `<div class="dm-msg ${mine?"me":"them"}" style="padding:5px;background:transparent">${senderName}<div class="group-msg-file" data-open-group-file="${esc(m.fileURL)}" data-file-name="${esc(m.fileName)}"><div class="file-icon ${fInfo.cls}">${fInfo.icon}</div><div class="file-info"><strong>${esc(m.fileName || "File")}</strong><small>${formatFileSize(m.fileSize || 0)}</small></div><div class="file-download">⬇️</div></div><small style="margin-left:8px">${timeAgo(m.createdAt)}</small></div>`;
    }
    return "";
  }).join("");

  container.scrollTop = container.scrollHeight;
}

$("groupChatSendBtn")?.addEventListener("click", sendGroupMessage);
$("groupChatInput")?.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); sendGroupMessage(); } });

async function sendGroupMessage(){
  const input = $("groupChatInput");
  if(!input || !currentGroupId) return;
  const text = input.value.trim();
  if(!text) return;

  const now = Date.now();
  if(now - lastSentMessageTime < MESSAGE_COOLDOWN) return;
  lastSentMessageTime = now;
  input.value = "";

  try{
    await addDoc(collection(db, "groups", currentGroupId, "messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "", text, type: "text",
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "groups", currentGroupId), {
      lastMessage: text, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  }catch(e){ toast("Send failed"); input.value = text; }
}

$("groupAttachBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("groupAttachMenu")?.classList.toggle("show"); });

document.addEventListener("click", (e)=>{
  const menu = $("groupAttachMenu");
  const btn = $("groupAttachBtn");
  if(!menu || !btn) return;
  if(!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove("show");
});

$("groupAttachPhotoBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("groupAttachMenu")?.classList.remove("show"); $("groupPhotoFile2")?.click(); });
$("groupAttachVideoBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("groupAttachMenu")?.classList.remove("show"); $("groupVideoFile2")?.click(); });
$("groupAttachPdfBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); $("groupAttachMenu")?.classList.remove("show"); $("groupPdfFile")?.click(); });

$("groupPhotoFile2")?.addEventListener("change", async (e)=>{ const f = e.target.files[0]; if(!f || !currentGroupId) return; await sendGroupPhoto(f); e.target.value = ""; });
$("groupVideoFile2")?.addEventListener("change", async (e)=>{ const f = e.target.files[0]; if(!f || !currentGroupId) return; await sendGroupVideo(f); e.target.value = ""; });
$("groupPdfFile")?.addEventListener("change", async (e)=>{ const f = e.target.files[0]; if(!f || !currentGroupId) return; await sendGroupPdf(f); e.target.value = ""; });

async function sendGroupPhoto(file){
  if(file.size > GROUP_MAX_PHOTO_SIZE){ toast("Photo too large"); return; }
  try{
    toast("Uploading photo...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("Photo " + pct + "%"); });
    await addDoc(collection(db, "groups", currentGroupId, "messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "", text: "", type: "image", imageURL: url,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "groups", currentGroupId), { lastMessage: "📷 Photo", lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
    toast("✅ Photo sent");
  }catch(e){ toast("Photo failed"); }
}

async function sendGroupVideo(file){
  if(file.size > GROUP_MAX_VIDEO_SIZE){ toast("Video too large"); return; }
  try{
    toast("Uploading video...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("Video " + pct + "%"); });
    await addDoc(collection(db, "groups", currentGroupId, "messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "", text: "", type: "video", videoURL: url,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "groups", currentGroupId), { lastMessage: "🎥 Video", lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
    toast("✅ Video sent");
  }catch(e){ toast("Video failed"); }
}

async function sendGroupPdf(file){
  if(file.size > GROUP_MAX_PDF_SIZE){ toast("File too large"); return; }
  try{
    toast("Uploading file...");
    const url = await uploadToCloudinary(file, (pct)=>{ if(pct % 25 === 0) toast("File " + pct + "%"); });
    await addDoc(collection(db, "groups", currentGroupId, "messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "", text: "", type: "file",
      fileURL: url, fileName: file.name, fileSize: file.size, fileType: file.type,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "groups", currentGroupId), { lastMessage: "📄 " + file.name, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
    toast("✅ File sent");
  }catch(e){ toast("File failed"); }
}

document.addEventListener("click", (e)=>{
  const img = e.target.closest("[data-open-group-image]");
  if(img){
    e.preventDefault(); e.stopPropagation();
    const url = img.dataset.openGroupImage;
    if(url){ if($("largeChatImage")) $("largeChatImage").src = url; showModal("imageViewerModal"); }
    return;
  }
  const file = e.target.closest("[data-open-group-file]");
  if(file){
    e.preventDefault(); e.stopPropagation();
    const url = file.dataset.openGroupFile;
    const name = file.dataset.fileName || "file";
    if(url){
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast("Opening...");
    }
    return;
  }
});

$("groupChatInfoBtn")?.addEventListener("click", (e)=>{
  e.preventDefault(); e.stopPropagation();
  hideModal("groupChatModal");
  if(currentGroupId) openGroupView(currentGroupId);
});

$("groupOpenChatBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); if(currentGroupId) openGroupChat(currentGroupId); });

$("groupLeaveBtn")?.addEventListener("click", async (e)=>{
  e.preventDefault(); e.stopPropagation();
  if(!currentGroupId) return;
  if(confirm("Leave this group?")) await leaveGroup(currentGroupId);
});

document.addEventListener("click", (e)=>{
  const tab = e.target.closest("#groupTabs .yt-tab");
  if(!tab) return;
  e.preventDefault(); e.stopPropagation();
  const gtab = tab.dataset.gtab;
  if(!gtab) return;
  document.querySelectorAll("#groupTabs .yt-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  $("groupMembersTab")?.classList.add("hidden");
  $("groupRequestsTabContent")?.classList.add("hidden");
  $("groupInfoTab")?.classList.add("hidden");
  if(gtab === "members") $("groupMembersTab")?.classList.remove("hidden");
  else if(gtab === "requests") $("groupRequestsTabContent")?.classList.remove("hidden");
  else if(gtab === "info") $("groupInfoTab")?.classList.remove("hidden");
});

/* ============================================================
   COMMENTS
============================================================ */
function openComments(videoId){
  currentCommentVideoId = videoId;
  showModal("commentsModal");
  loadComments(videoId);
}

function loadComments(videoId){
  if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; }
  commentsUnsubscribe = onSnapshot(collection(db,"videos",videoId,"comments"), snapshot=>{
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
    if(!list.length){
      $("commentsList").innerHTML = `<div class="yt-empty"><div style="font-size:42px;margin-bottom:10px">💬</div><p>No comments yet</p></div>`;
      return;
    }
    $("commentsList").innerHTML = list.map(c=>{
      const mine = currentUser && c.userId === currentUser.uid;
      return `<div class="comment-item">
        <img src="${avatar(c.userPhoto, c.userName)}">
        <div class="comment-content">
          <div class="name">${esc(c.userName || "User")}</div>
          <div class="text">${esc(c.text)}</div>
          <div class="actions">
            <span style="font-size:11px;color:var(--muted)">${timeAgo(c.createdAt)}</span>
            ${mine || isAdminUser() ? `<button data-delete-comment="${esc(videoId)}|${esc(c.id)}">Delete</button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");
  });
}

$("sendCommentBtn")?.addEventListener("click", sendComment);
$("commentInput")?.addEventListener("keydown", e=>{ if(e.key === "Enter") sendComment(); });

async function sendComment(){
  const text = $("commentInput").value.trim();
  if(!text || !currentCommentVideoId) return;
  try{
    await addDoc(collection(db,"videos",currentCommentVideoId,"comments"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      userPhoto: currentProfile?.photo || "", text, createdAt: serverTimestamp()
    });
    const videoSnap = await getDoc(doc(db,"videos",currentCommentVideoId));
    if(videoSnap.exists()){
      const ownerId = videoSnap.data().userId;
      if(ownerId !== currentUser.uid){
        await addDoc(collection(db,"notifications"), {
          to: ownerId, from: currentUser.uid, title: "💬 New Comment",
          message: (currentProfile?.name || "Someone") + ": " + text.slice(0,50),
          createdAt: serverTimestamp()
        });
      }
    }
    $("commentInput").value = "";
  }catch(e){ toast("Comment failed"); }
}

async function deleteComment(videoId, commentId){
  const ref = doc(db,"videos",videoId,"comments",commentId);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  if(snap.data().userId !== currentUser.uid && !isAdminUser()) return;
  if(!confirm("Delete comment?")) return;
  await deleteDoc(ref);
}

/* ============================================================
   SHARE
============================================================ */
async function openShareSheet(videoId){
  shareVideoId = videoId;
  showModal("shareSheet");
  const list = $("shareUserList");
  list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">Loading...</div>`;
  try{
    const chatUids = new Set();
    myChatsCache.forEach(c=>{ const other = c.members.find(uid => uid !== currentUser.uid); if(other) chatUids.add(other); });
    const allUids = new Set([...myFollowsCache, ...chatUids]);
    if(!allUids.size){ list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">Follow users to share</div>`; return; }

    const chips = [];
    for(const uid of Array.from(allUids).slice(0, 20)){
      const p = await getProfile(uid);
      chips.push(`<div class="share-user-chip" data-share-user="${esc(uid)}"><img src="${avatar(p.photo, p.name)}"><span>${esc(p.name.split(" ")[0])}</span></div>`);
    }
    list.innerHTML = chips.join("");
  }catch(e){ list.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px">Error</div>`; }
}

async function shareToUser(uid){
  if(!shareVideoId || !uid) return;
  const v = videosCache.find(x => x.id === shareVideoId);
  if(!v) return;
  const chatId = [currentUser.uid, uid].sort().join("_");
  try{
    await setDoc(doc(db,"chats",chatId), { members: [currentUser.uid, uid], updatedAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(db,"chats",chatId,"messages"), {
      userId: currentUser.uid, userName: currentProfile?.name || "User",
      text: "", type: "shared_video", videoId: shareVideoId, videoURL: v.videoURL, videoTitle: v.title || "Video",
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"chats",chatId), { lastMessage: "📹 Shared a video", updatedAt: serverTimestamp() });
    hideModal("shareSheet");
    toast("✅ Video shared");
  }catch(e){ toast("Share failed"); }
}

$("shareCopyLink")?.addEventListener("click", async()=>{
  if(!shareVideoId) return;
  const url = location.origin + location.pathname + "?video=" + shareVideoId;
  try{ await navigator.clipboard.writeText(url); toast("Link copied"); hideModal("shareSheet"); }
  catch(e){ toast("Copy failed"); }
});

$("shareNative")?.addEventListener("click", async()=>{
  if(!shareVideoId) return;
  const url = location.origin + location.pathname + "?video=" + shareVideoId;
  try{
    if(navigator.share){ await navigator.share({ title: "ReelHub Video", text: "Watch on ReelHub 🎬", url }); }
    else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    hideModal("shareSheet");
  }catch(e){}
});

/* ============================================================
   DEEP LINK
============================================================ */
function getVideoIdFromURL(){
  const params = new URLSearchParams(location.search);
  return params.get("video");
}

async function openVideoByDeepLink(videoId){
  if(!videoId) return;
  let attempts = 0;
  while(videosCache.length === 0 && attempts < 20){ await new Promise(r => setTimeout(r, 300)); attempts++; }
  const v = videosCache.find(x => x.id === videoId);
  if(!v){ toast("Video not found"); return; }
  if(v.visibility === "private" && v.userId !== currentUser?.uid){ toast("Private video"); return; }
  const canView = await canViewUserVideos(v.userId);
  if(!canView){ toast("Private account"); return; }
  await trackView(videoId);
  const banner = $("deepLinkBanner");
  if(banner){ banner.classList.add("show"); setTimeout(()=> banner.classList.remove("show"), 3000); }
  window.openVideoPlayer(videoId);
}

async function checkDeepLink(){
  if(deepLinkChecked) return;
  const vid = getVideoIdFromURL();
  if(!vid) return;
  deepLinkChecked = true;
  await openVideoByDeepLink(vid);
}

/* ============================================================
   MONETIZATION
============================================================ */
async function renderMonetizationTab(){
  const container = $("monetizationTab");
  if(!container || !currentUser) return;
  try{
    const profile = await getProfile(currentUser.uid);
    const followers = Number(profile.followers || 0);
    const watchTime = Number(profile.totalWatchTime || 0);
    const views = Number(profile.totalViews || 0);
    const status = profile.monetizationStatus || "none";

    const followersComplete = followers >= MONETIZATION_REQUIREMENTS.followers;
    const watchTimeComplete = watchTime >= MONETIZATION_REQUIREMENTS.watchTime;
    const viewsComplete = views >= MONETIZATION_REQUIREMENTS.views;
    const allComplete = followersComplete && watchTimeComplete && viewsComplete;

    let statusBadge = "", actionButton = "";
    if(status === "approved"){
      statusBadge = `<div class="monetization-status-badge approved">✅ Active</div>`;
      actionButton = `<p style="font-size:13px;color:var(--muted);margin-top:10px">🎉 Monetized!</p>`;
    }else if(status === "pending"){
      statusBadge = `<div class="monetization-status-badge pending">⏳ Pending</div>`;
      actionButton = `<p style="font-size:13px;color:var(--muted);margin-top:10px">Under review.</p>`;
    }else if(status === "rejected"){
      statusBadge = `<div class="monetization-status-badge rejected">❌ Rejected</div>`;
      actionButton = `<p style="font-size:13px;color:var(--muted);margin-top:10px">Try again.</p>`;
    }else{
      statusBadge = `<div class="monetization-status-badge none">💰 Not Applied</div>`;
      actionButton = allComplete 
        ? `<button class="monetization-apply-btn" id="openMonetizationModalBtn">💰 Apply</button>`
        : `<button class="monetization-apply-btn" disabled>🔒 Complete requirements</button>`;
    }

    container.innerHTML = `
      <div class="monetization-tab">
        <div class="monetization-card">
          <span class="icon">💰</span>
          <h3>Monetize Your Channel</h3>
          <p>Earn money from your content.</p>
          ${statusBadge}
          ${actionButton}
        </div>
        <div class="req-list-tab">
          <div class="title">📋 Requirements</div>
          <div class="req-row ${followersComplete ? 'completed' : ''}"><span class="req-icon">👥</span><span class="req-text">Followers</span><span class="req-count">${followers} / ${MONETIZATION_REQUIREMENTS.followers}</span><span class="req-status">${followersComplete ? '✅' : '⏳'}</span></div>
          <div class="req-row ${watchTimeComplete ? 'completed' : ''}"><span class="req-icon">⏱️</span><span class="req-text">Watch Time</span><span class="req-count">${Math.floor(watchTime / 60)} min / 60 min</span><span class="req-status">${watchTimeComplete ? '✅' : '⏳'}</span></div>
          <div class="req-row ${viewsComplete ? 'completed' : ''}"><span class="req-icon">👁️</span><span class="req-text">Total Views</span><span class="req-count">${views} / ${MONETIZATION_REQUIREMENTS.views}</span><span class="req-status">${viewsComplete ? '✅' : '⏳'}</span></div>
        </div>
      </div>`;

    $("openMonetizationModalBtn")?.addEventListener("click", () => openMonetizationModal(followers, watchTime, views));
  }catch(e){ container.innerHTML = `<div class="yt-empty" style="padding:30px">Error</div>`; }
}

function openMonetizationModal(followers, watchTime, views){
  const followersComplete = followers >= MONETIZATION_REQUIREMENTS.followers;
  const watchTimeComplete = watchTime >= MONETIZATION_REQUIREMENTS.watchTime;
  const viewsComplete = views >= MONETIZATION_REQUIREMENTS.views;

  $("reqFollowersCount").textContent = followers;
  $("reqWatchTimeCount").textContent = watchTime;
  $("reqViewsCount").textContent = views;
  $("reqFollowersStatus").textContent = followersComplete ? "✅" : "⏳";
  $("reqWatchTimeStatus").textContent = watchTimeComplete ? "✅" : "⏳";
  $("reqViewsStatus").textContent = viewsComplete ? "✅" : "⏳";

  const p1 = Math.min(100, (followers / MONETIZATION_REQUIREMENTS.followers) * 100);
  const p2 = Math.min(100, (watchTime / MONETIZATION_REQUIREMENTS.watchTime) * 100);
  const p3 = Math.min(100, (views / MONETIZATION_REQUIREMENTS.views) * 100);
  const overallProgress = Math.round((p1 + p2 + p3) / 3);

  $("reqProgressBar").style.width = overallProgress + "%";
  $("reqProgressPercent").textContent = overallProgress + "%";

  if(currentProfile?.upiId) $("monetizationUpiId").value = currentProfile.upiId;

  const allComplete = followersComplete && watchTimeComplete && viewsComplete;
  if($("submitMonetizationBtn")) $("submitMonetizationBtn").disabled = !allComplete;

  showModal("monetizationModal");
}

$("submitMonetizationBtn")?.addEventListener("click", async () => {
  if(!currentUser) return;
  const upiId = $("monetizationUpiId").value.trim();
  const statusEl = $("monetizationStatus");
  if(!upiId){ statusEl.textContent = "Enter UPI ID"; statusEl.style.color = "#ef4444"; return; }
  if(!upiId.includes("@") || upiId.length < 5){ statusEl.textContent = "Invalid UPI"; statusEl.style.color = "#ef4444"; return; }

  const btn = $("submitMonetizationBtn");
  btn.disabled = true; btn.textContent = "Submitting...";

  try{
    const profile = await getProfile(currentUser.uid);
    await updateDoc(doc(db, "profiles", currentUser.uid), {
      upiId, monetizationStatus: "pending", monetizationRequestedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await addDoc(collection(db, "monetization_requests"), {
      userId: currentUser.uid, userName: profile.name || "User", username: profile.username || "",
      userPhoto: profile.photo || "", followers: profile.followers || 0,
      totalWatchTime: profile.totalWatchTime || 0, totalViews: profile.totalViews || 0,
      upiId, status: "pending", createdAt: serverTimestamp()
    });
    statusEl.textContent = "✅ Submitted!";
    statusEl.style.color = "#22c55e";
    currentProfile = await getProfile(currentUser.uid);
    setTimeout(() => { hideModal("monetizationModal"); renderMonetizationTab(); }, 1200);
  }catch(e){ statusEl.textContent = "Error"; statusEl.style.color = "#ef4444"; btn.disabled = false; btn.textContent = "Submit"; }
});

/* ============================================================
   VAULT
============================================================ */
async function saveVaultPin(pin){
  if(!currentUser) return false;
  try{
    const pinHash = btoa("reelhub_vault_" + pin);
    await updateDoc(doc(db, "profiles", currentUser.uid), { vaultPin: pinHash, vaultEnabled: true, vaultCreatedAt: serverTimestamp() });
    currentProfile.vaultPin = pinHash;
    currentProfile.vaultEnabled = true;
    return true;
  }catch(e){ return false; }
}

async function hasVaultPin(){ return !!(currentProfile && currentProfile.vaultPin); }

async function verifyVaultPin(pin){
  if(!currentProfile || !currentProfile.vaultPin) return false;
  const hash = btoa("reelhub_vault_" + pin);
  return currentProfile.vaultPin === hash;
}

function startVaultListener(){
  if(vaultUnsubscribe){ vaultUnsubscribe(); vaultUnsubscribe = null; }
  if(!currentUser) return;
  vaultUnsubscribe = onSnapshot(
    query(collection(db, "vault_files"), where("userId", "==", currentUser.uid)),
    snapshot=>{
      vaultFilesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      vaultFilesCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      if($("vaultViewerModal")?.classList.contains("show")) renderVaultContent();
    }
  );
}

async function openVaultFlow(){
  if(!currentUser) return;
  currentProfile = await getProfile(currentUser.uid);
  const hasPin = await hasVaultPin();

  if(!hasPin){
    $("newPinInput").value = "";
    $("confirmPinInput").value = "";
    $("pinSetupStatus").textContent = "";
    hideModal("settingsModal"); hideModal("advancedSettingsModal");
    showModal("pinSetupModal");
    return;
  }

  if(vaultPinVerified && (Date.now() - vaultUnlockTime) < VAULT_AUTO_LOCK_MS){
    hideModal("settingsModal"); hideModal("advancedSettingsModal");
    openVaultViewer();
    return;
  }

  vaultPinVerified = false;
  $("vaultPinInput").value = "";
  $("pinEntryStatus").textContent = "";
  hideModal("settingsModal"); hideModal("advancedSettingsModal");
  showModal("pinEntryModal");
  setTimeout(() => $("vaultPinInput").focus(), 300);
}

$("savePinBtn")?.addEventListener("click", async () => {
  const pin = $("newPinInput").value.trim();
  const confirm = $("confirmPinInput").value.trim();
  const status = $("pinSetupStatus");

  if(!/^\d{4}$/.test(pin)){ status.style.color = "#ed4956"; status.textContent = "PIN must be 4 digits"; return; }
  if(pin !== confirm){ status.style.color = "#ed4956"; status.textContent = "PINs don't match"; return; }

  status.style.color = "#7c3aed"; status.textContent = "Saving...";
  const ok = await saveVaultPin(pin);
  if(ok){
    status.style.color = "#22c55e"; status.textContent = "✅ PIN set!";
    vaultPinVerified = true;
    vaultUnlockTime = Date.now();
    setTimeout(() => { hideModal("pinSetupModal"); openVaultViewer(); }, 600);
  }else{
    status.style.color = "#ed4956"; status.textContent = "Failed";
  }
});

$("unlockVaultBtn")?.addEventListener("click", async () => {
  const pin = $("vaultPinInput").value.trim();
  const status = $("pinEntryStatus");
  const input = $("vaultPinInput");

  if(!/^\d{4}$/.test(pin)){
    status.textContent = "Enter 4-digit PIN";
    input.classList.add("pin-error");
    setTimeout(() => input.classList.remove("pin-error"), 400);
    return;
  }

  const valid = await verifyVaultPin(pin);
  if(valid){
    status.style.color = "#22c55e"; status.textContent = "✅ Unlocked!";
    vaultPinVerified = true;
    vaultUnlockTime = Date.now();
    setTimeout(() => { hideModal("pinEntryModal"); openVaultViewer(); }, 400);
  }else{
    status.style.color = "#ed4956"; status.textContent = "❌ Wrong PIN";
    input.value = "";
    input.classList.add("pin-error");
    setTimeout(() => input.classList.remove("pin-error"), 400);
  }
});

$("vaultPinInput")?.addEventListener("keydown", (e) => { if(e.key === "Enter") $("unlockVaultBtn")?.click(); });

function openVaultViewer(){
  renderVaultContent();
  updateVaultFileCount();
  showModal("vaultViewerModal");
  startVaultListener();
}

function updateVaultFileCount(){
  const countEl = $("vaultFileCount");
  if(countEl) countEl.textContent = vaultFilesCache.length + " file" + (vaultFilesCache.length === 1 ? "" : "s");
}

function renderVaultContent(){
  const container = $("vaultContent");
  if(!container) return;
  if(!vaultFilesCache.length){
    container.innerHTML = `<div class="vault-empty"><span class="icon">🔐</span><h3>Vault is empty</h3><p>Tap "Add Files" to add photos/videos</p></div>`;
    updateVaultFileCount();
    return;
  }
  let html = `<div class="vault-grid">`;
  vaultFilesCache.forEach(f => {
    if(f.mediaType === "video"){
      html += `<div class="vault-item" data-vault-file="${esc(f.id)}"><video src="${esc(f.mediaURL)}" preload="metadata" muted></video><span class="vault-item-type">🎬</span></div>`;
    }else{
      html += `<div class="vault-item" data-vault-file="${esc(f.id)}"><img src="${esc(f.mediaURL)}" alt=""><span class="vault-item-type">📷</span></div>`;
    }
  });
  html += `</div>`;
  container.innerHTML = html;
  updateVaultFileCount();
}

$("vaultAddFilesBtn")?.addEventListener("click", (e) => {
  e.preventDefault(); e.stopPropagation();
  if(vaultUploading){ toast("Upload in progress..."); return; }
  const input = $("vaultFileInput");
  if(input){ input.value = ""; input.click(); }
});

$("vaultFileInput")?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  if(!currentUser){ toast("Login required"); e.target.value = ""; return; }
  if(vaultFilesCache.length + files.length > VAULT_MAX_FILES){ toast(`Max ${VAULT_MAX_FILES} files`); e.target.value = ""; return; }
  for(const f of files){
    if(f.size > VAULT_MAX_FILE_SIZE){ toast(`"${f.name}" too large`); e.target.value = ""; return; }
  }
  vaultUploading = true;
  const progressWrap = $("vaultUploadProgress");
  const progressBar = $("vaultUploadBar");
  const progressLabel = $("vaultUploadLabel");
  if(progressWrap) progressWrap.style.display = "block";

  let completed = 0, failed = 0;
  for(let i = 0; i < files.length; i++){
    const file = files[i];
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    if(progressLabel) progressLabel.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}`;
    try{
      const url = await uploadToCloudinary(file, (pct)=>{ if(progressBar) progressBar.style.width = pct + "%"; });
      await addDoc(collection(db, "vault_files"), {
        userId: currentUser.uid, mediaURL: url, mediaType: mediaType,
        fileName: file.name, fileSize: file.size, createdAt: serverTimestamp()
      });
      completed++;
    }catch(err){ failed++; }
  }
  vaultUploading = false;
  if(progressBar) progressBar.style.width = "0%";
  if(progressWrap) progressWrap.style.display = "none";
  e.target.value = "";
  if(completed > 0) toast(`✅ ${completed} added`);
  else toast("❌ Failed");
});

document.addEventListener("click", (e) => {
  const vaultItem = e.target.closest("[data-vault-file]");
  if(vaultItem){
    e.preventDefault(); e.stopPropagation();
    const fileId = vaultItem.dataset.vaultFile;
    const f = vaultFilesCache.find(x => x.id === fileId);
    if(!f) return;
    if(f.mediaType === "video") openVaultVideoPlayer(f);
    else { if($("largeChatImage")) $("largeChatImage").src = f.mediaURL; showModal("imageViewerModal"); }
  }
});

function openVaultVideoPlayer(f){
  hideModal("vaultViewerModal");
  const videoEl = $("videoPlayerVideo");
  if(videoEl){ videoEl.src = f.mediaURL; videoEl.play().catch(()=>{}); }
  if($("videoPlayerTitle")) $("videoPlayerTitle").textContent = f.fileName || "Vault Video";
  if($("videoPlayerMeta")) $("videoPlayerMeta").textContent = timeAgo(f.createdAt);
  ["videoPlayerLikeBtn", "videoPlayerCommentBtn", "videoPlayerShareBtn", "videoPlayerSaveBtn", "videoPlayerPlaylistBtn", "videoPlayerSpeedBtn"]
    .forEach(id => { const btn = $(id); if(btn) btn.style.display = "none"; });
  showModal("videoPlayerModal");
}

$("advancedSettingsBtn")?.addEventListener("click", () => { hideModal("settingsModal"); showModal("advancedSettingsModal"); });
$("openVaultBtn")?.addEventListener("click", () => { openVaultFlow(); });
$("changePinBtn")?.addEventListener("click", async () => {
  if(!confirm("Change vault PIN?")) return;
  hideModal("advancedSettingsModal");
  $("newPinInput").value = ""; $("confirmPinInput").value = ""; $("pinSetupStatus").textContent = "";
  showModal("pinSetupModal");
});
$("vaultSettingsBtn")?.addEventListener("click", () => { hideModal("advancedSettingsModal"); showModal("vaultSettingsModal"); updateVaultAutoLockUI(); });

function updateVaultAutoLockUI(){
  const toggle = $("vaultAutoLockToggle");
  if(!toggle) return;
  toggle.textContent = vaultAutoLockEnabled ? "ON" : "OFF";
  toggle.style.color = vaultAutoLockEnabled ? "#22c55e" : "var(--muted)";
}

$("vaultAutoLockBtn")?.addEventListener("click", () => {
  vaultAutoLockEnabled = !vaultAutoLockEnabled;
  localStorage.setItem("reelhubVaultAutoLock", vaultAutoLockEnabled ? "1" : "0");
  updateVaultAutoLockUI();
});

if(localStorage.getItem("reelhubVaultAutoLock") === "0") vaultAutoLockEnabled = false;

$("clearVaultBtn")?.addEventListener("click", async () => {
  if(!vaultFilesCache.length){ toast("Empty"); return; }
  if(!confirm(`Delete all ${vaultFilesCache.length} files?`)) return;
  let count = 0;
  for(const f of vaultFilesCache){ try{ await deleteDoc(doc(db, "vault_files", f.id)); count++; }catch(e){} }
  toast(`🗑️ ${count} deleted`);
  hideModal("vaultSettingsModal");
});

$("removeVaultBtn")?.addEventListener("click", async () => {
  if(!confirm("Remove Vault completely?")) return;
  for(const f of vaultFilesCache){ try{ await deleteDoc(doc(db, "vault_files", f.id)); }catch(e){} }
  await updateDoc(doc(db, "profiles", currentUser.uid), { vaultPin: "", vaultEnabled: false, updatedAt: serverTimestamp() });
  currentProfile.vaultPin = "";
  currentProfile.vaultEnabled = false;
  vaultFilesCache = [];
  vaultPinVerified = false;
  toast("✅ Removed");
  hideModal("vaultSettingsModal"); hideModal("advancedSettingsModal"); hideModal("vaultViewerModal");
});

/* ============================================================
   ADMIN — SONG LIBRARY
============================================================ */
function openAdminSongLibrary(){
  if(!isAdminUser()){ toast("Only admin"); return; }
  hideModal("advancedSettingsModal");
  showModal("adminSongLibraryModal");
  renderAdminSongLibrary();
  startSongLibraryListener();
}

let editingSongId = null;
let pendingSongFile = null;

function renderAdminSongLibrary(){
  const container = $("songLibraryList");
  if(!container) return;
  const countEl = $("songCount");
  if(countEl) countEl.textContent = songLibraryCache.length + " songs";

  if(!songLibraryCache.length){
    container.innerHTML = `<div class="song-library-empty"><span class="icon">🎵</span><h3>No songs yet</h3><p>Tap "Add New Song" to add</p></div>`;
    return;
  }

  container.innerHTML = songLibraryCache.map(s => `
    <div class="song-library-item">
      <div class="song-thumb">🎵</div>
      <div class="song-info">
        <strong>${esc(s.name || "Untitled")}</strong>
        <small>${esc(s.artist || "Unknown")} · ${esc(s.category || "Other")}</small>
      </div>
      <div class="song-actions">
        <button class="play-btn" data-play-song="${esc(s.id)}">▶</button>
        <button class="edit-btn" data-edit-song="${esc(s.id)}">✏️</button>
        <button class="delete-btn" data-delete-song="${esc(s.id)}">🗑️</button>
      </div>
    </div>
  `).join("");
}

function openAddSongModal(){
  editingSongId = null;
  pendingSongFile = null;
  $("addSongTitle").textContent = "➕ Add Song";
  $("songName").value = "";
  $("songArtist").value = "";
  $("songCategory").value = "Bollywood";
  $("songFile").value = "";
  $("songFileSelected").style.display = "none";
  $("songUploadStatus").textContent = "";
  $("songUploadProgress").classList.remove("active");
  $("songUploadProgressBar").style.width = "0%";
  hideModal("adminSongLibraryModal");
  showModal("addSongModal");
}

function openEditSongModal(songId){
  const song = songLibraryCache.find(s => s.id === songId);
  if(!song) return;
  editingSongId = songId;
  pendingSongFile = null;
  $("addSongTitle").textContent = "✏️ Edit Song";
  $("songName").value = song.name || "";
  $("songArtist").value = song.artist || "";
  $("songCategory").value = song.category || "Bollywood";
  $("songFile").value = "";
  $("songFileName").textContent = song.name + " (current)";
  $("songFileSelected").style.display = "flex";
  $("songUploadStatus").textContent = "";
  hideModal("adminSongLibraryModal");
  showModal("addSongModal");
}

$("songUploadZone")?.addEventListener("click", () => { $("songFile")?.click(); });

$("songFile")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  if(file.size > 100 * 1024 * 1024){ toast("File too large"); e.target.value = ""; return; }
  pendingSongFile = file;
  $("songFileName").textContent = file.name;
  $("songFileSelected").style.display = "flex";
});

$("songFileRemoveBtn")?.addEventListener("click", (e) => {
  e.preventDefault(); e.stopPropagation();
  pendingSongFile = null;
  $("songFile").value = "";
  $("songFileSelected").style.display = "none";
});

$("saveSongBtn")?.addEventListener("click", async () => {
  const name = $("songName").value.trim();
  const artist = $("songArtist").value.trim();
  const category = $("songCategory").value;
  const status = $("songUploadStatus");

  if(!name){ status.style.color = "#ef4444"; status.textContent = "Name required"; return; }
  if(!editingSongId && !pendingSongFile){ status.style.color = "#ef4444"; status.textContent = "Select file"; return; }

  const btn = $("saveSongBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";
  status.style.color = "#a78bfa";
  status.textContent = "Saving...";

  try{
    let audioURL = "";
    if(pendingSongFile){
      status.textContent = "Uploading...";
      $("songUploadProgress").classList.add("active");
      audioURL = await uploadAudioToCloudinary(pendingSongFile, (pct) => {
        $("songUploadProgressBar").style.width = pct + "%";
        status.textContent = "Uploading " + pct + "%";
      });
    } else if(editingSongId){
      const existing = songLibraryCache.find(s => s.id === editingSongId);
      audioURL = existing?.audioURL || "";
    }

    if(editingSongId){
      await updateDoc(doc(db, "song_library", editingSongId), { name, artist, category, audioURL, updatedAt: serverTimestamp() });
      toast("✅ Updated");
    } else {
      await addDoc(collection(db, "song_library"), {
        name, artist, category, audioURL,
        createdBy: currentUser.uid,
        createdByName: currentProfile?.name || "Admin",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      toast("✅ Song added");
    }

    status.style.color = "#22c55e";
    status.textContent = "✅ Saved!";

    setTimeout(() => { hideModal("addSongModal"); showModal("adminSongLibraryModal"); }, 700);
  } catch(err) {
    console.error(err);
    status.style.color = "#ef4444";
    status.textContent = "Error: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Save Song";
    $("songUploadProgress").classList.remove("active");
  }
});

$("addSongModalClose")?.addEventListener("click", () => { hideModal("addSongModal"); });
$("cancelSongBtn")?.addEventListener("click", () => { hideModal("addSongModal"); });

function playSongPreview(songId){
  const song = songLibraryCache.find(s => s.id === songId);
  if(!song || !song.audioURL){ toast("No audio"); return; }
  if(previewAudio){ previewAudio.pause(); previewAudio = null; }
  previewAudio = new Audio(song.audioURL);
  previewAudio.play().then(() => toast("▶ " + song.name)).catch(() => toast("Play failed"));
  previewAudio.onended = () => { previewAudio = null; };
}

async function deleteSong(songId){
  const song = songLibraryCache.find(s => s.id === songId);
  if(!song) return;
  if(!confirm(`Delete "${song.name}"?`)) return;
  try{ await deleteDoc(doc(db, "song_library", songId)); toast("🗑️ Deleted"); }
  catch(e){ toast("Failed"); }
}

document.addEventListener("click", (e)=>{
  const t = e.target;
  const adminBtn = t.closest("#adminSongLibraryBtn");
  if(adminBtn){ e.preventDefault(); e.stopPropagation(); openAdminSongLibrary(); return; }

  const addBtn = t.closest("#addSongBtn");
  if(addBtn){ e.preventDefault(); e.stopPropagation(); openAddSongModal(); return; }

  const playBtn = t.closest("[data-play-song]");
  if(playBtn){ e.preventDefault(); e.stopPropagation(); playSongPreview(playBtn.dataset.playSong); return; }

  const editBtn = t.closest("[data-edit-song]");
  if(editBtn){ e.preventDefault(); e.stopPropagation(); openEditSongModal(editBtn.dataset.editSong); return; }

  const delBtn = t.closest("[data-delete-song]");
  if(delBtn){ e.preventDefault(); e.stopPropagation(); await deleteSong(delBtn.dataset.deleteSong); return; }
});

/* ============================================================
   GLOBAL CLICK HANDLER
============================================================ */
document.addEventListener("click", async (e)=>{
  const t = e.target;

  const acceptReq = t.closest("[data-accept-request]");
  if(acceptReq){ e.preventDefault(); e.stopPropagation(); const uid = acceptReq.dataset.acceptRequest; if(uid) await acceptFollowRequest(uid); return; }

  const rejectReq = t.closest("[data-reject-request]");
  if(rejectReq){ e.preventDefault(); e.stopPropagation(); const uid = rejectReq.dataset.rejectRequest; if(uid) await rejectFollowRequest(uid); return; }

  const openUser = t.closest(".post-open-user");
  if(openUser){ e.preventDefault(); e.stopPropagation(); const uid = openUser.dataset.uid; if(uid) openPublicProfile(uid); return; }

  const followBtn = t.closest('[data-action="follow"]');
  if(followBtn){ e.preventDefault(); e.stopPropagation(); const uid = followBtn.dataset.followUid; if(uid) toggleFollow(uid, followBtn); return; }

  const likeBtn = t.closest("[data-like-video]");
  if(likeBtn){ e.preventDefault(); e.stopPropagation(); const vid = likeBtn.dataset.likeVideo; const isReel = likeBtn.dataset.reel === "true"; if(vid) toggleLike(vid, likeBtn, isReel); return; }

  const commentBtn = t.closest("[data-comment-video]");
  if(commentBtn){ e.preventDefault(); e.stopPropagation(); const vid = commentBtn.dataset.commentVideo; if(vid) openComments(vid); return; }

  const shareBtn = t.closest("[data-share-video]");
  if(shareBtn){ e.preventDefault(); e.stopPropagation(); const vid = shareBtn.dataset.shareVideo; if(vid) openShareSheet(vid); return; }

  const saveBtn = t.closest("[data-save-video]");
  if(saveBtn){ e.preventDefault(); e.stopPropagation(); const vid = saveBtn.dataset.saveVideo; if(vid) toggleSave(vid, saveBtn); return; }

  const deleteBtn = t.closest("[data-delete-video]");
  if(deleteBtn){ e.preventDefault(); e.stopPropagation(); const vid = deleteBtn.dataset.deleteVideo; if(vid) window.deleteVideo(vid); return; }

  const editBtn = t.closest("[data-edit-video]");
  if(editBtn){ e.preventDefault(); e.stopPropagation(); const vid = editBtn.dataset.editVideo; if(vid) openEditVideo(vid); return; }

  const openVideoBtn = t.closest("[data-open-video]");
  if(openVideoBtn){
    const insideStop = t.closest("[data-stop-propagation]");
    if(!insideStop){
      e.preventDefault(); e.stopPropagation();
      const vid = openVideoBtn.dataset.openVideo;
      if(vid){ hideModal("playlistDetailModal"); hideModal("publicProfileModal"); setTimeout(()=> window.openVideoPlayer(vid), 100); }
    }
    return;
  }

  const searchOpen = t.closest(".search-open-btn");
  if(searchOpen){ e.preventDefault(); e.stopPropagation(); const uid = searchOpen.dataset.uid; if(uid){ hideModal("searchModal"); setTimeout(()=> openPublicProfile(uid), 150); } return; }

  const peopleOpen = t.closest(".people-open-btn");
  if(peopleOpen){ e.preventDefault(); e.stopPropagation(); const uid = peopleOpen.dataset.uid; if(uid){ hideModal("peopleModal"); hideModal("followRequestsModal"); setTimeout(()=> openPublicProfile(uid), 150); } return; }

  const delC = t.closest("[data-delete-comment]");
  if(delC){ e.preventDefault(); e.stopPropagation(); const [vid, cid] = delC.dataset.deleteComment.split("|"); if(vid && cid) await deleteComment(vid, cid); return; }

  const chatItem = t.closest("[data-open-chat]");
  if(chatItem){ e.preventDefault(); e.stopPropagation(); const uid = chatItem.dataset.openChat; if(uid) openChat(uid); return; }

  const sharedVid = t.closest("[data-open-shared]");
  if(sharedVid){ e.preventDefault(); e.stopPropagation(); const vid = sharedVid.dataset.openShared; if(vid) window.openVideoPlayer(vid); return; }

  const chatImage = t.closest("[data-open-image]");
  if(chatImage){ e.preventDefault(); e.stopPropagation(); const url = chatImage.dataset.openImage; if(url){ if($("largeChatImage")) $("largeChatImage").src = url; showModal("imageViewerModal"); } return; }

  const chatFile = t.closest("[data-open-file]");
  if(chatFile){
    e.preventDefault(); e.stopPropagation();
    const url = chatFile.dataset.openFile;
    const name = chatFile.dataset.fileName || "file";
    if(url){ const a = document.createElement("a"); a.href = url; a.download = name; a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a); toast("Opening..."); }
    return;
  }

  const openP = t.closest("[data-open-playlist]");
  if(openP){ e.preventDefault(); e.stopPropagation(); const pid = openP.dataset.openPlaylist; if(pid) await openPlaylistDetail(pid); return; }

  const delP = t.closest("[data-delete-playlist]");
  if(delP){
    e.preventDefault(); e.stopPropagation();
    const pid = delP.dataset.deletePlaylist;
    if(pid && confirm("Delete playlist?")){
      try{
        const items = await getDocs(collection(db, "playlists", pid, "items"));
        for(const item of items.docs) await deleteDoc(item.ref);
        await deleteDoc(doc(db, "playlists", pid));
        toast("🗑️ Deleted");
        if(currentPlaylistView === pid){ hideModal("playlistDetailModal"); currentPlaylistView = null; }
      }catch(err){ toast("Failed"); }
    }
    return;
  }

  const toggleP = t.closest("[data-toggle-playlist]");
  if(toggleP){
    e.preventDefault(); e.stopPropagation();
    const pid = toggleP.dataset.togglePlaylist;
    if(selectedPlaylists.has(pid)){
      selectedPlaylists.delete(pid); toggleP.classList.remove("checked");
      const check = toggleP.querySelector(".playlist-select-check"); if(check) check.textContent = "";
    }else{
      selectedPlaylists.add(pid); toggleP.classList.add("checked");
      const check = toggleP.querySelector(".playlist-select-check"); if(check) check.textContent = "✓";
    }
    return;
  }

  const rmFromP = t.closest("[data-remove-from-playlist]");
  if(rmFromP){
    e.preventDefault(); e.stopPropagation();
    const [vid, pid] = rmFromP.dataset.removeFromPlaylist.split("|");
    if(vid && pid){
      try{
        await deleteDoc(doc(db, "playlists", pid, "items", pid + "_" + vid));
        await syncAllPlaylistCounts();
        toast("Removed");
        if(currentPlaylistView === pid) await renderPlaylistDetail(pid);
      }catch(err){ toast("Failed"); }
    }
    return;
  }

  const openPV = t.closest("[data-playlist-video]");
  if(openPV){ e.preventDefault(); e.stopPropagation(); const vid = openPV.dataset.playlistVideo; if(vid){ hideModal("playlistDetailModal"); setTimeout(()=> window.openVideoPlayer(vid), 200); } return; }

  const chip = t.closest("[data-share-user]");
  if(chip){ e.preventDefault(); e.stopPropagation(); shareToUser(chip.dataset.shareUser); return; }
});

/* ============================================================
   MODAL CLOSE / BACK
============================================================ */
document.querySelectorAll("[data-close]").forEach(btn=>{
  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const id = btn.dataset.close;
    hideModal(id);

    if(id === "commentsModal"){ currentCommentVideoId = null; if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; } }
    if(id === "publicProfileModal"){ delete $("publicProfileModal").dataset.uid; $("privateAccountNotice")?.classList.add("hidden"); }
    if(id === "playlistDetailModal") currentPlaylistView = null;
    if(id === "videoPlayerModal") resetVideoPlayer();
    if(id === "imageViewerModal"){ if($("largeChatImage")) $("largeChatImage").src = ""; }
    if(id === "groupChatModal"){ if(groupChatUnsubscribe){ groupChatUnsubscribe(); groupChatUnsubscribe = null; } currentGroupId = null; }
  });
});

document.querySelectorAll(".modal").forEach(modal=>{
  modal.addEventListener("click", e=>{
    if(e.target === modal){
      modal.classList.remove("show");
      if(modal.id === "commentsModal"){ currentCommentVideoId = null; if(commentsUnsubscribe){ commentsUnsubscribe(); commentsUnsubscribe = null; } }
      if(modal.id === "publicProfileModal"){ delete $("publicProfileModal").dataset.uid; $("privateAccountNotice")?.classList.add("hidden"); }
      if(modal.id === "playlistDetailModal") currentPlaylistView = null;
      if(modal.id === "videoPlayerModal") resetVideoPlayer();
      if(modal.id === "imageViewerModal"){ if($("largeChatImage")) $("largeChatImage").src = ""; }
    }
  });
});

$("shareSheet")?.addEventListener("click", e=>{ if(e.target === $("shareSheet")) $("shareSheet").classList.remove("show"); });

/* ============================================================
   NAVIGATION
============================================================ */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", ()=>{
    const panelId = btn.dataset.panel;
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    $(panelId)?.classList.remove("hidden");
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    if(panelId === "shortsPanel") $("mainTopbar")?.classList.add("hidden");
    else $("mainTopbar")?.classList.remove("hidden");

    if(panelId === "profilePanel"){ loadProfile(); loadMyVideos(); loadMyPlaylists(); }

    if(panelId === "messagesPanel"){
      const inbox = $("dmInboxView");
      const chat = $("dmChatView");
      if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
      if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }
      if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
      currentChatId = null; currentChatUser = null;
      showDMInbox();
    }

    if(panelId === "shortsPanel") setTimeout(setupReelsObserver, 100);
  });
});

function openPanel(id){
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
  document.querySelector(`[data-panel="${id}"]`)?.classList.add("active");
  if(id === "shortsPanel"){ $("mainTopbar")?.classList.add("hidden"); setTimeout(setupReelsObserver, 100); }
  else $("mainTopbar")?.classList.remove("hidden");
  if(id === "messagesPanel"){
    const inbox = $("dmInboxView");
    const chat = $("dmChatView");
    if(inbox){ inbox.classList.remove("hidden"); inbox.style.display = "flex"; }
    if(chat){ chat.classList.add("hidden"); chat.style.display = "none"; }
    showDMInbox();
  }
}

/* ============================================================
   START / INIT
============================================================ */
prepareInitialState();
openPanel("homePanel");

setTimeout(() => { if(!splashHidden) hideSplash(); }, 1000);

setTimeout(() => {
  if(!authResolved){
    hideSplash();
    if(!currentUser){ $("loginPage")?.classList.remove("hidden"); $("app")?.classList.add("hidden"); }
  }
}, 3000);

/* BACK BUTTON */
window.addEventListener("popstate", (e) => {
  const storyViewer = $("storyViewer");
  if(storyViewer && storyViewer.classList.contains("show")){
    closeStoryViewer();
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }

  const openModals = document.querySelectorAll(".modal.show");
  if(openModals.length > 0){
    const topModal = openModals[openModals.length - 1];
    const id = topModal.id;
    if(id === "videoPlayerModal") resetVideoPlayer();
    topModal.classList.remove("show");
    const idx = modalHistoryStack.indexOf(id);
    if(idx > -1) modalHistoryStack.splice(idx, 1);
    try{ window.history.pushState({ reelhubModal: true }, "", window.location.href); }catch(err){}
    return;
  }
}, { passive: true });

/* ============================================================
   EMERGENCY ERROR CATCHER
============================================================ */
window.addEventListener("error", (e) => {
  console.error("🚨 RUNTIME ERROR:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("🚨 PROMISE ERROR:", e.reason);
});

/* ============================================================
   FINAL LOG
============================================================ */
console.log("✅ ReelHub app.js FULL loaded!");
console.log("🎉 All features active:");
console.log("  ✅ Video Feed + Shorts + Upload");
console.log("  ✅ Stories (Edit + Song + Sticker)");
console.log("  ✅ DM Chat (text + photo + video + PDF)");
console.log("  ✅ Groups (Public/Private + Edit)");
console.log("  ✅ Group Chat (text + photo + video + PDF)");
console.log("  ✅ Song Library (Admin)");
console.log("  ✅ Video Editor (Trim/Rotate/Mute)");
console.log("  ✅ Vault + Monetization + Notifications");