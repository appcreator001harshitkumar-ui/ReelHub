/* ============================================================
   ReelHub - app.js PART 1/3 (FIXED)
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const CLOUDINARY_CLOUD_NAME = "s3eresx6";
const CLOUDINARY_UPLOAD_PRESET = "reelhub_upload";
const ADMIN_EMAILS = ["appcreator001.harshitkumar@gmail.com", "satender8510815609@gmail.com"];
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
const MONETIZATION_REQUIREMENTS = { followers: 10, watchTime: 3600, views: 50 };

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
let adSettings = { masterDisabled: false, typeDisabled: { banner: false, popup: false, video: false }, userDisabled: {} };
let adSettingsUnsubscribe = null;
let userAdsUnsubscribe = null;

const $ = id => document.getElementById(id);

/* ============ ✅ FORCE SHOW LOGIN ON LOAD ============ */
function forceShowLogin(){
  const login = $("loginPage");
  const appEl = $("app");
  const splash = $("splashScreen");
  if(splash) splash.style.display = "none";
  if(appEl) appEl.classList.add("hidden");
  if(login){
    login.classList.remove("hidden");
    login.style.display = "flex";
  }
  console.log("✅ Login page forced visible");
}
window.forceShowLogin = forceShowLogin;

/* ============ HELPERS ============ */
function esc(v){
  return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function timeValue(v){
  if(!v) return 0;
  if(typeof v.toMillis === "function") return v.toMillis();
  return new Date(v).getTime() || 0;
}
function avatar(url, name){
  return url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(name || "User") + "&background=7c3aed&color=fff";
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
  if(!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
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
function isAdminUser(){ return currentUser && ADMIN_EMAILS.includes(currentUser.email); }
function isUserBlocked(uid){ return blockedUsersCache.has(uid); }

function canShowAd(adType, userId){
  if(adSettings.masterDisabled === true) return false;
  if(userId && adSettings.userDisabled[userId] === true) return false;
  if(adType && adSettings.typeDisabled[adType] === true) return false;
  return true;
}
window.showMyAd = function(adType, targetUserId, adCallback){
  if(!canShowAd(adType, targetUserId || currentUser?.uid)) return;
  if(typeof adCallback === "function") adCallback();
};
function startAdSettingsListener(){
  if(adSettingsUnsubscribe){ adSettingsUnsubscribe(); adSettingsUnsubscribe = null; }
  if(userAdsUnsubscribe){ userAdsUnsubscribe(); userAdsUnsubscribe = null; }
  adSettingsUnsubscribe = onSnapshot(doc(db, "ad_settings", "global"), snap => {
    if(snap.exists()){
      const d = snap.data();
      adSettings.masterDisabled = d.masterDisabled === true;
      adSettings.typeDisabled = d.typeDisabled || { banner: false, popup: false, video: false };
    }
  }, error => console.error("Ad settings listener error:", error));
  userAdsUnsubscribe = onSnapshot(collection(db, "ad_settings", "global", "users"), snap => {
    const map = {};
    snap.forEach(d => { map[d.id] = d.data().disabled === true; });
    adSettings.userDisabled = map;
  }, error => console.error("User ads listener error:", error));
}

function showModal(id){
  const el = $(id);
  if(!el) return;
  if(el.classList.contains("show")) return;
  el.classList.add("show");
  try{ window.history.pushState({ modalId: id, reelhubModal: true }, "", window.location.href); modalHistoryStack.push(id); }catch(e){}
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
    if(videoEl){ videoEl.pause(); videoEl.src = ""; videoEl.style.transform = ""; videoEl.muted = false; }
    if(window.__videoAudio){ window.__videoAudio.pause(); window.__videoAudio = null; }
  }
}

function hideSplash(){
  if(splashHidden) return;
  splashHidden = true;
  document.body.classList.add("app-ready");
  const splash = $("splashScreen");
  if(splash){ splash.classList.add("fade-out"); setTimeout(()=> splash.remove(), 500); }
}

function showSuspensionScreen(profile){
  const screen = $("suspensionScreen");
  if(!screen) return;
  const reason = profile.suspendReason || "Violation of Terms";
  const duration = profile.suspendDuration || "Temporary";
  const until = profile.suspendUntil ? new Date(timeValue(profile.suspendUntil)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "Permanent";
  const date = profile.suspendedAt ? new Date(timeValue(profile.suspendedAt)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : "—";
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
        await updateDoc(doc(db, "profiles", snap.docs[0].id), { suspended: false, suspendReason: "", suspendDuration: "", suspendUntil: null, autoUnsuspendedAt: serverTimestamp() });
        return false;
      }
    }
    showSuspensionScreen(profileData);
    return true;
  }catch(e){ console.error("Suspension check error:", e); return false; }
}
$("suspensionLogoutBtn")?.addEventListener("click", async ()=>{
  if(!confirm("Logout?")) return;
  try{ await signOut(auth); window.location.reload(); }catch(e){}
});

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
  }catch(e){}
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") stopWatchTimer(); });
window.addEventListener("beforeunload", () => { stopWatchTimer(); });

function uploadToCloudinary(file, onProgress){
  return new Promise((resolve,reject)=>{
    let resource = "image";
    if(file.type.startsWith("video/")) resource = "video";
    else if(!file.type.startsWith("image/")) resource = "raw";
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resource}/upload`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 5 * 60 * 1000;
    xhr.onload = ()=>{ if(xhr.status >= 200 && xhr.status < 300){ try{ resolve(JSON.parse(xhr.responseText).secure_url); }catch(e){ reject(e); } } else reject(new Error("Upload failed: " + xhr.status)); };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.ontimeout = ()=> reject(new Error("Upload timeout"));
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
    xhr.timeout = 5 * 60 * 1000;
    xhr.onload = ()=>{ if(xhr.status >= 200 && xhr.status < 300){ try{ resolve(JSON.parse(xhr.responseText).secure_url); }catch(e){ reject(e); } } else reject(new Error("Upload failed: " + xhr.status)); };
    xhr.onerror = ()=> reject(new Error("Network error"));
    xhr.ontimeout = ()=> reject(new Error("Audio upload timeout"));
    xhr.upload.onprogress = e=>{ if(e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    const form = new FormData();
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    form.append("resource_type", "video");
    form.append("file", file);
    xhr.send(form);
  });
}

/* ============ AUTH TABS ============ */
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if(tabName === "login"){ $("loginForm")?.classList.remove("hidden"); $("signupForm")?.classList.add("hidden"); }
    else { $("loginForm")?.classList.add("hidden"); $("signupForm")?.classList.remove("hidden"); }
    const status = $("loginStatus");
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  });
});
$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const status = $("loginStatus");
  if(!email || !password){ if(status){ status.textContent = "Email and password required"; status.style.color = "#ed4956"; } return; }
  if(status){ status.textContent = "Logging in..."; status.style.color = "#7c3aed"; }
  try{
    await signInWithEmailAndPassword(auth, email, password);
    if(status){ status.textContent = ""; status.style.color = "#ed4956"; }
  }
  catch(err){
    console.error("Login error:", err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});
$("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const status = $("loginStatus");
  if(!name || !email || !password){ if(status){ status.textContent = "All fields required"; status.style.color = "#ed4956"; } return; }
  if(password.length < 6){ if(status){ status.textContent = "Password must be 6+ chars"; status.style.color = "#ed4956"; } return; }
  if(status){ status.textContent = "Creating account..."; status.style.color = "#7c3aed"; }
  try{
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: name });
    try{ await sendEmailVerification(userCred.user); }catch(e){}
    if(status){ status.textContent = "✅ Account created!"; status.style.color = "#22c55e"; }
  }catch(err){
    console.error("Signup error:", err);
    if(status){ status.textContent = getAuthError(err.code); status.style.color = "#ed4956"; }
  }
});
$("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const status = $("loginStatus");
  if(!email){ if(status){ status.textContent = "Enter your email first"; status.style.color = "#ed4956"; } return; }
  try{
    await sendPasswordResetEmail(auth, email);
    if(status){ status.textContent = "✅ Reset email sent!"; status.style.color = "#22c55e"; }
    setTimeout(() => { if(status) status.style.color = "#ed4956"; }, 4000);
  }
  catch(err){
    console.error("Reset error:", err);
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
    "auth/operation-not-allowed": "Email/Password login is not enabled"
  };
  return errors[code] || "Something went wrong. Please try again";
}

/* ============ GOOGLE LOGIN ============ */
function attachGoogleLogin(){
  const btn = document.getElementById("googleLogin");
  if(!btn){ console.error("❌ googleLogin button not found"); return false; }
  if(btn.dataset.listenerAttached === "1") return true;
  btn.dataset.listenerAttached = "1";
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const status = document.getElementById("loginStatus");
    if(status){ status.textContent = "Opening Google..."; status.style.color = "#7c3aed"; }
    try{
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if(status){ status.textContent = "✅ Login successful!"; status.style.color = "#22c55e"; }
    }catch(error){
      console.error("❌ Google error:", error);
      alert("❌ Google Login Error\n\nCode: " + (error.code || "unknown") + "\n\nMessage: " + (error.message || "no message"));
      if(status){ status.textContent = "❌ " + (error.code || "error"); status.style.color = "#ed4956"; }
    }
  });
  return true;
}
if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", () => { if(!attachGoogleLogin()){ setTimeout(attachGoogleLogin, 500); setTimeout(attachGoogleLogin, 1500); } }); }
else { if(!attachGoogleLogin()){ setTimeout(attachGoogleLogin, 500); setTimeout(attachGoogleLogin, 1500); } }

/* ============ PROFILE ============ */
async function createProfile(){
  const ref = doc(db, "profiles", currentUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const displayName = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User");
    await setDoc(ref, {
      uid: currentUser.uid, name: displayName,
      username: displayName.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20) || "user" + Date.now().toString().slice(-5),
      age: "", gender: "", bio: "", photo: currentUser.photoURL || "",
      followers: 0, following: 0, videos: 0, private: false, suspended: false,
      suspendReason: "", suspendDuration: "", suspendUntil: null, suspendedAt: null,
      bannerType: "gradient", bannerGradient: "linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL: "",
      vaultPin: "", vaultEnabled: false, totalWatchTime: 0, totalViews: 0,
      monetizationStatus: "none", upiId: "", pinnedVideos: [], createdAt: serverTimestamp()
    });
  }
}
async function getProfile(uid){
  const snap = await getDoc(doc(db, "profiles", uid));
  if(!snap.exists()) return { uid, name:"User", username:"user", age:"", gender:"", bio:"", photo:"", followers:0, following:0, videos:0, private:false, suspended:false, bannerType:"gradient", bannerGradient:"linear-gradient(135deg, #7c3aed, #ec4899)", bannerURL:"", vaultPin: "", vaultEnabled: false, totalWatchTime: 0, totalViews: 0, monetizationStatus: "none", upiId: "", pinnedVideos: [] };
  const d = snap.data();
  return { uid, ...d,
    followers: Number(d.followers || 0), following: Number(d.following || 0), videos: Number(d.videos || 0),
    private: d.private === true, suspended: d.suspended === true,
    bannerType: d.bannerType || "gradient",
    bannerGradient: d.bannerGradient || "linear-gradient(135deg, #7c3aed, #ec4899)",
    bannerURL: d.bannerURL || "", vaultPin: d.vaultPin || "", vaultEnabled: d.vaultEnabled === true,
    totalWatchTime: Number(d.totalWatchTime || 0), totalViews: Number(d.totalViews || 0),
    monetizationStatus: d.monetizationStatus || "none", upiId: d.upiId || "",
    pinnedVideos: Array.isArray(d.pinnedVideos) ? d.pinnedVideos : []
  };
}
async function loadProfile(){
  if(!currentUser) return;
  currentProfile = await getProfile(currentUser.uid);
  if($("profileName")) $("profileName").textContent = currentProfile.name || "User";
  if($("profileUsername")) $("profileUsername").textContent = "@" + (currentProfile.username || "user");
  if($("profilePhoto")) $("profilePhoto").src = avatar(currentProfile.photo, currentProfile.name);
  if($("navProfileAvatar")) $("navProfileAvatar").src = avatar(currentProfile.photo, currentProfile.name);
  if($("followersCount")) $("followersCount").textContent = currentProfile.followers || 0;
  if($("followingCount")) $("followingCount").textContent = currentProfile.following || 0;
  if($("videosCount")) $("videosCount").textContent = currentProfile.videos || 0;
  let extra = [];
  if(currentProfile.age) extra.push("Age: " + currentProfile.age);
  if(currentProfile.gender) extra.push(currentProfile.gender);
  if($("profileExtra")) $("profileExtra").textContent = extra.join(" · ");
  if($("profileBio")) $("profileBio").textContent = currentProfile.bio || "";
  if(typeof updatePrivateToggleUI === "function") updatePrivateToggleUI();
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
  try{ const snap = await getDocs(query(collection(db,"follows"), where("follower","==",currentUser.uid))); snap.forEach(d => myFollowsCache.add(d.data().following)); }catch(e){}
}
async function loadMySaves(){
  if(!currentUser) return;
  mySavesCache = new Set();
  try{ const snap = await getDocs(query(collection(db,"saves"), where("userId","==",currentUser.uid))); snap.forEach(d => mySavesCache.add(d.data().videoId)); }catch(e){}
}
async function loadMySentRequests(){
  if(!currentUser) return;
  mySentRequestsCache = new Set();
  try{ const snap = await getDocs(query(collection(db,"follow_requests"), where("from","==",currentUser.uid))); snap.forEach(d => mySentRequestsCache.add(d.data().to)); }catch(e){}
}
async function loadBlockedUsers(){
  if(!currentUser) return;
  blockedUsersCache = new Set();
  try{ const snap = await getDocs(query(collection(db, "blocked_users"), where("blockerId", "==", currentUser.uid))); snap.forEach(d => blockedUsersCache.add(d.data().blockedId)); }catch(e){}
}
async function loadWatchHistory(){
  if(!currentUser) return;
  watchHistoryCache = [];
  continueWatchingCache = [];
  try{
    const snap = await getDocs(query(collection(db, "watch_history"), where("userId", "==", currentUser.uid)));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a,b)=> timeValue(b.watchedAt) - timeValue(a.watchedAt));
    watchHistoryCache = items;
    continueWatchingCache = items.filter(i => i.progress > 3 && i.duration > 0 && i.progress < (i.duration - 5)).slice(0, 10);
  }catch(e){}
}
function stopAllPresenceListeners(){
  presenceListenersMap.forEach(unsub => { try{ unsub(); }catch(e){} });
  presenceListenersMap.clear();
}

/* ============ AUTH STATE — MAIN SWITCH ============ */
onAuthStateChanged(auth, async user => {
  console.log("🔐 Auth state changed:", user ? "user found" : "no user");
  if(user){
    currentUser = user;
    const isSuspended = await checkSuspension(user.uid);
    if(isSuspended){ hideSplash(); authResolved = true; return; }
    
    $("loginPage")?.classList.add("hidden");
    const appEl = $("app");
    if(appEl){ appEl.classList.remove("hidden"); appEl.style.display = "block"; }
    hideSplash();

    try{
      await createProfile();
      await loadProfile();
      await loadMyFollows();
      await loadMySaves();
      await loadMySentRequests();
      await loadBlockedUsers();
      await loadWatchHistory();
    }catch(e){ console.error("Data load error:", e); }

    if(typeof startRealtimeVideos === "function") startRealtimeVideos();
    if(typeof startStoriesListener === "function") startStoriesListener();
    if(typeof startAdSettingsListener === "function") startAdSettingsListener();
    if(typeof startBlockedUsersListener === "function") startBlockedUsersListener();

    authResolved = true;
    console.log("✅ User logged in, app visible");
  } else {
    if(currentUser && typeof markOffline === "function") await markOffline();
    currentUser = null; currentProfile = null;
    videosCache = []; storiesCache = []; groupedStories = [];
    myFollowsCache.clear(); mySavesCache.clear(); mySentRequestsCache.clear(); blockedUsersCache.clear();
    if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }
    if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
    if(adSettingsUnsubscribe){ adSettingsUnsubscribe(); adSettingsUnsubscribe = null; }
    if(userAdsUnsubscribe){ userAdsUnsubscribe(); userAdsUnsubscribe = null; }
    if(blockedUsersUnsubscribe){ blockedUsersUnsubscribe(); blockedUsersUnsubscribe = null; }
    stopAllPresenceListeners();
    
    const appEl = $("app");
    if(appEl){ appEl.classList.add("hidden"); appEl.style.display = "none"; }
    forceShowLogin();
    hideSplash();
    authResolved = true;
    console.log("✅ No user, login page visible");
  }
});

/* ============ FALLBACK ============ */
setTimeout(() => {
  const login = $("loginPage");
  const appEl = $("app");
  if(!authResolved){
    console.log("⚠️ Auth not resolved in 4s, forcing login page");
    forceShowLogin();
    hideSplash();
  }
}, 4000);

setTimeout(() => { if(!splashHidden) hideSplash(); }, 2000);

console.log("✅ Part 1/3 loaded");
console.log("✅ Part 1/3 COMPLETE");