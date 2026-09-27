/* ============================================================
   ReelHub - app.js PART 1/3
   Config + Auth + Profile + Feed + Stories
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
function isAdminUser(){
  return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}
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
function prepareInitialState(){
  $("loginPage")?.classList.add("hidden");
  $("app")?.classList.add("hidden");
  document.body.classList.remove("app-ready");
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
        toast("✅ Suspension ended");
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
  if(typeof updateProfileTabCounts === "function") updateProfileTabCounts();
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
function startBlockedUsersListener(){
  if(blockedUsersUnsubscribe){ blockedUsersUnsubscribe(); blockedUsersUnsubscribe = null; }
  if(!currentUser) return;
  blockedUsersUnsubscribe = onSnapshot(query(collection(db, "blocked_users"), where("blockerId", "==", currentUser.uid)),
    snapshot=>{
      blockedUsersCache = new Set();
      snapshot.forEach(d => blockedUsersCache.add(d.data().blockedId));
      if(typeof renderFeed === "function") renderFeed();
      if(typeof renderShorts === "function") renderShorts();
    }, error=>console.error("Blocked listener error:", error));
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
function startPresenceHeartbeat(){
  if(!currentUser) return;
  if(heartbeatInterval) clearInterval(heartbeatInterval);
  updatePresence();
  heartbeatInterval = setInterval(updatePresence, 30000);
  if(!window.__presenceVisibilityBound){
    window.__presenceVisibilityBound = true;
    document.addEventListener("visibilitychange", ()=>{
      if(document.visibilityState === "hidden") markOffline();
      else updatePresence();
    });
    window.addEventListener("beforeunload", markOffline);
  }
}

onAuthStateChanged(auth, async user => {
  if(user){
    currentUser = user;
    $("loginPage")?.classList.add("hidden");

    const isSuspended = await checkSuspension(user.uid);
    if(isSuspended){ hideSplash(); authResolved = true; return; }

    $("app")?.classList.remove("hidden");
    hideSplash();

    await createProfile();
    await loadProfile();
    await loadMyFollows();
    await loadMySaves();
    await loadMySentRequests();
    await loadBlockedUsers();
    await loadWatchHistory();

    if(typeof startRealtimeVideos === "function") startRealtimeVideos();
    if(typeof startNotifications === "function") startNotifications();
    if(typeof startChatsListListener === "function") startChatsListListener();
    if(typeof startPlaylistsListener === "function") startPlaylistsListener();
    if(typeof startPresenceHeartbeat === "function") startPresenceHeartbeat();
    if(typeof startFollowRequestsListener === "function") startFollowRequestsListener();
    if(typeof startStoriesListener === "function") startStoriesListener();
    if(typeof startVaultListener === "function") startVaultListener();
    if(typeof startMyGroupsListener === "function") startMyGroupsListener();
    if(typeof startSongLibraryListener === "function") startSongLibraryListener();
    if(typeof updateAdminVisibility === "function") updateAdminVisibility();
    if(typeof startAdSettingsListener === "function") startAdSettingsListener();
    if(typeof startBlockedUsersListener === "function") startBlockedUsersListener();
    if(typeof startWatchHistoryListener === "function") startWatchHistoryListener();

    try{ window.history.replaceState({ reelhubHome: true }, "", window.location.href); }catch(e){}
    try{ window.history.pushState({ reelhubApp: true }, "", window.location.href); }catch(e){}
    setTimeout(() => { if(typeof checkDeepLink === "function") checkDeepLink(); }, 1500);
    authResolved = true;
  } else {
    if(currentUser && typeof markOffline === "function") await markOffline();
    currentUser = null; currentProfile = null;
    videosCache = []; storiesCache = []; groupedStories = []; vaultFilesCache = [];
    myGroupsCache = []; songLibraryCache = []; watchHistoryCache = []; continueWatchingCache = [];
    myFollowsCache.clear(); mySavesCache.clear(); mySentRequestsCache.clear(); blockedUsersCache.clear();
    onlineUsersCache = {}; unreadChatsCache = {}; chatLastReadCache = {}; modalHistoryStack = []; vaultPinVerified = false;
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
    if(adSettingsUnsubscribe){ adSettingsUnsubscribe(); adSettingsUnsubscribe = null; }
    if(userAdsUnsubscribe){ userAdsUnsubscribe(); userAdsUnsubscribe = null; }
    if(blockedUsersUnsubscribe){ blockedUsersUnsubscribe(); blockedUsersUnsubscribe = null; }
    if(watchHistoryUnsubscribe){ watchHistoryUnsubscribe(); watchHistoryUnsubscribe = null; }
    adSettings = { masterDisabled: false, typeDisabled: { banner: false, popup: false, video: false }, userDisabled: {} };
    stopAllPresenceListeners();
    processingLikes.clear(); processingSaves.clear(); processingViews.clear(); processingMessages.clear();
    $("app")?.classList.add("hidden"); $("loginPage")?.classList.remove("hidden"); $("suspensionScreen")?.classList.add("hidden");
    hideSplash();
    authResolved = true;
  }
});
console.log("✅ Part 1/3 loaded");

/* ========== FEED + SHORTS + STORIES ========== */
function createVideoCard(v){
  const views = Number(v.views || 0);
  const mine = currentUser && v.userId === currentUser.uid;
  const isAdmin = isAdminUser();
  const isPhoto = v.isPhoto === true;
  let songBadge = "";
  if(v.song && v.song.name){ songBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:rgba(124,58,237,0.15);color:var(--primary);font-size:10px;font-weight:600;border-radius:8px;margin-top:4px">🎵 ${esc(v.song.name)}</span>`; }
  const filterStyle = v.filter && v.filter !== "none" ? `filter: ${v.filter};` : "";
  let thumbnailHTML;
  if(isPhoto){ thumbnailHTML = `<img src="${esc(v.videoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;${filterStyle}" loading="lazy">`; }
  else if(v.thumbnail){ thumbnailHTML = `<img src="${esc(v.thumbnail)}" alt="" style="width:100%;height:100%;object-fit:cover;${filterStyle}">`; }
  else { thumbnailHTML = `<video src="${esc(v.videoURL)}#t=0.5" preload="metadata" muted playsinline style="${filterStyle}"></video>`; }
  return `
  <div class="video-card" data-id="${esc(v.id)}" data-open-video="${esc(v.id)}">
    <div class="thumbnail" style="position:relative">
      ${thumbnailHTML}
      ${!isPhoto ? `<span class="duration" data-duration-for="${esc(v.id)}">0:00</span>` : `<span class="duration" style="background:rgba(124,58,237,0.9)">📷</span>`}
    </div>
    <div class="video-info">
      <img class="channel-avatar post-open-user" data-uid="${esc(v.userId)}" src="${avatar(v.userPhoto, v.userName)}" alt="${esc(v.userName)}">
      <div class="video-details">
        <h3 class="video-title">${esc(v.title || "Untitled")}</h3>
        <p class="channel-name">${esc(v.username || v.userName || "User")}</p>
        <p class="video-meta">${formatViewsShort(views)} views <span class="dot">•</span> ${timeAgoYouTube(v.createdAt)}</p>
        ${songBadge}
      </div>
      ${mine || isAdmin ? `<button class="video-more" onclick="event.stopPropagation();event.preventDefault();window.openVideoMenuModal('${esc(v.id)}')">⋮</button>` : ""}
    </div>
  </div>`;
}

function renderFeed(){
  const feed = $("feed");
  if(!feed) return;
  let list = videosCache.filter(v => v.type !== "short" && (v.visibility !== "private" || v.userId === currentUser?.uid) && !isUserBlocked(v.userId));
  if(currentCategory === "trending"){
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    list = list.filter(v => timeValue(v.createdAt) > sevenDaysAgo);
    list.sort((a,b)=> (b.views || 0) - (a.views || 0));
    list = list.slice(0, 50);
  } else if(currentCategory !== "all"){ list = list.filter(v => v.category === currentCategory); }
  if(!list.length){
    feed.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="icon">📹</span><h3>No videos yet</h3><p>Upload your first video</p></div>`;
    return;
  }
  feed.innerHTML = list.map(v => createVideoCard(v)).join("");
}

document.querySelectorAll("#categoryChips .chip").forEach(chip => {
  chip.addEventListener("click", ()=>{
    document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentCategory = chip.dataset.cat || "all";
    renderFeed();
  });
});

function startRealtimeVideos(){
  if(videosUnsubscribe){ videosUnsubscribe(); videosUnsubscribe = null; }
  videosUnsubscribe = onSnapshot(collection(db,"videos"),
    snapshot=>{
      videosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      videosCache.sort((a,b)=> timeValue(b.createdAt) - timeValue(a.createdAt));
      renderFeed();
      renderShorts();
    }, error => console.error("Videos listener error:", error));
}

function renderShorts(){
  const container = $("reelsContainer");
  if(!container) return;
  const list = videosCache.filter(v => v.type === "short" && (v.visibility !== "private" || v.userId === currentUser?.uid) && !isUserBlocked(v.userId));
  if(!list.length){
    container.innerHTML = `<div class="reel-empty"><div style="font-size:56px;margin-bottom:14px">🎞️</div><h3 style="font-size:17px;margin-bottom:6px">No Shorts yet</h3><p>Upload your first Short</p></div>`;
    return;
  }
  container.innerHTML = list.map(v => `
  <div class="reel-item" data-id="${esc(v.id)}">
    <video src="${esc(v.videoURL)}" loop playsinline webkit-playsinline preload="metadata" muted data-video-id="${esc(v.id)}"></video>
    <div class="reel-overlay">
      <div class="reel-info">
        <div class="reel-user">
          <img class="post-open-user" data-uid="${esc(v.userId)}" src="${avatar(v.userPhoto, v.userName)}">
          <strong>@${esc(v.username || v.userName)}</strong>
        </div>
        ${v.title ? `<div class="reel-title">${esc(v.title)}</div>` : ""}
      </div>
    </div>
    <div class="reel-actions">
      <div class="reel-action like-btn" data-like-video="${esc(v.id)}" data-reel="true"><span class="icon">🤍</span><small class="like-count">${v.likes || 0}</small></div>
      <div class="reel-action" data-comment-video="${esc(v.id)}"><span class="icon">💬</span><small>Comment</small></div>
      <div class="reel-action" data-share-video="${esc(v.id)}"><span class="icon">📤</span><small>Share</small></div>
      <div class="reel-action save-btn" data-save-video="${esc(v.id)}"><span class="icon">📑</span><small>Save</small></div>
    </div>
  </div>`).join("");
  setTimeout(setupReelsObserver, 100);
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

function startStoriesListener(){
  if(storiesUnsubscribe){ storiesUnsubscribe(); storiesUnsubscribe = null; }
  if(!currentUser) return;
  storiesUnsubscribe = onSnapshot(collection(db, "stories"),
    snapshot=>{
      const now = Date.now();
      storiesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (now - timeValue(s.createdAt)) < STORY_LIFETIME_MS && !isUserBlocked(s.userId));
      storiesCache.sort((a,b)=> timeValue(a.createdAt) - timeValue(b.createdAt));
      groupStories();
      renderStoriesBar();
    }, error=>console.error("Stories listener error:", error));
}
function groupStories(){
  const map = {};
  storiesCache.forEach(s=>{
    if(!map[s.userId]){ map[s.userId] = { userId: s.userId, userName: s.userName || "User", userPhoto: s.userPhoto || "", stories: [], latestAt: 0 }; }
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
  html += `<div class="story-item" data-my-story="true"><div class="story-ring ${myHasStory ? 'active' : 'yours'}"><img src="${avatar(myPhoto, myName)}" alt="You">${!myHasStory ? `<span class="add-icon">+</span>` : ""}</div><div class="story-name">Your Story</div></div>`;
  otherGroups.forEach((g)=>{
    html += `<div class="story-item" data-story-user="${esc(g.userId)}"><div class="story-ring active"><img src="${avatar(g.userPhoto, g.userName)}" alt="${esc(g.userName)}"></div><div class="story-name">${esc(g.userName.split(" ")[0])}</div></div>`;
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
    } else openCreateStoryModal();
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
  storyUploadFile = null; storyMediaType = null;
  const imgPrev = $("storyImagePreview"); const vidPrev = $("storyVideoPreview"); const zone = $("storyUploadZone"); const btn = $("storyUploadBtn"); const prog = $("storyUploadProgress"); const status = $("storyUploadStatus"); const tools = $("storyEditorTools");
  if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); }
  if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); }
  if(zone) zone.classList.remove("hidden");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.remove("active");
  if(status) status.textContent = "";
  if(tools) tools.classList.add("hidden");
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
  const imgPrev = $("storyImagePreview"); const vidPrev = $("storyVideoPreview"); const zone = $("storyUploadZone"); const btn = $("storyUploadBtn"); const tools = $("storyEditorTools");
  if(zone) zone.classList.add("hidden");
  if(tools) tools.classList.remove("hidden");
  const url = URL.createObjectURL(file);
  if(storyMediaType === "image"){ if(imgPrev){ imgPrev.src = url; imgPrev.classList.remove("hidden"); } if(vidPrev){ vidPrev.src = ""; vidPrev.classList.add("hidden"); } }
  else { if(vidPrev){ vidPrev.src = url; vidPrev.classList.remove("hidden"); } if(imgPrev){ imgPrev.src = ""; imgPrev.classList.add("hidden"); } }
  if(btn) btn.disabled = false;
});
$("storyUploadBtn")?.addEventListener("click", async ()=>{
  if(!storyUploadFile || !currentUser){ toast("Select a file first"); return; }
  const btn = $("storyUploadBtn"); const prog = $("storyUploadProgress"); const progBar = $("storyUploadProgressBar"); const status = $("storyUploadStatus");
  if(btn) btn.disabled = true;
  if(prog) prog.classList.add("active");
  if(status) status.textContent = "Uploading...";
  try{
    const url = await uploadToCloudinary(storyUploadFile, (pct)=>{
      if(progBar) progBar.style.width = pct + "%";
      if(status) status.textContent = "Uploading " + pct + "%";
    });
    const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS);
    const storyData = { userId: currentUser.uid, userName: currentProfile?.name || currentUser.displayName || "User", userPhoto: currentProfile?.photo || currentUser.photoURL || "", username: currentProfile?.username || "", mediaURL: url, mediaType: storyMediaType, createdAt: serverTimestamp(), expiresAt: expiresAt };
    await addDoc(collection(db, "stories"), storyData);
    if(status) status.textContent = "✅ Story shared!";
    toast("✅ Story added");
    setTimeout(()=>{ hideModal("createStoryModal"); }, 500);
  }catch(err){ if(status) status.textContent = "Error: " + err.message; toast("Story upload failed"); }
  finally{ if(btn) btn.disabled = false; }
});

function openStoryViewer(userIndex, storyIndex){
  if(!groupedStories.length) return;
  currentStoryUserIndex = userIndex;
  currentStoryIndex = storyIndex || 0;
  const viewer = $("storyViewer");
  if(viewer){ viewer.classList.add("show"); try{ window.history.pushState({ storyViewer: true }, "", window.location.href); }catch(e){} }
  loadCurrentStory();
}
function closeStoryViewer(){
  const viewer = $("storyViewer");
  if(viewer) viewer.classList.remove("show");
  stopStoryTimer();
  const media = $("storyMedia");
  if(media) media.innerHTML = "";
}
function loadCurrentStory(){
  stopStoryTimer();
  const group = groupedStories[currentStoryUserIndex];
  if(!group || !group.stories.length){ closeStoryViewer(); return; }
  const story = group.stories[currentStoryIndex];
  if(!story){
    if(currentStoryUserIndex < groupedStories.length - 1){ currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory(); }
    else closeStoryViewer();
    return;
  }
  const avatarEl = $("storyViewerAvatar"); const nameEl = $("storyViewerName"); const timeEl = $("storyViewerTime");
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
      vid.addEventListener("loadedmetadata", ()=>{ const dur = Math.min((vid.duration || 5) * 1000, STORY_DURATION_VIDEO_MAX); startStoryTimer(dur); });
      vid.addEventListener("ended", ()=>{ nextStory(); });
      vid.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(vid);
      vid.play().catch(()=>{});
    } else {
      const img = document.createElement("img");
      img.src = story.mediaURL; img.alt = "";
      img.addEventListener("load", ()=>{ startStoryTimer(STORY_DURATION_IMAGE); });
      img.addEventListener("error", ()=>{ nextStory(); });
      mediaContainer.appendChild(img);
    }
  }
  if(story.userId !== currentUser?.uid) markStoryViewed(story.id);
  const footer = $("storyFooter");
  if(footer){
    if(story.userId === currentUser?.uid) footer.style.display = "none";
    else { footer.style.display = "flex"; const input = $("storyReplyInput"); if(input) input.value = ""; }
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
function startStoryTimer(duration){ stopStoryTimer(); storyDuration = duration; storyStartTime = Date.now(); storyElapsed = 0; storyPaused = false; updateStoryProgressLoop(); }
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
function stopStoryTimer(){ if(storyProgressRAF){ cancelAnimationFrame(storyProgressRAF); storyProgressRAF = null; } }
function nextStory(){
  stopStoryTimer();
  const group = groupedStories[currentStoryUserIndex];
  if(!group){ closeStoryViewer(); return; }
  if(currentStoryIndex < group.stories.length - 1){ currentStoryIndex++; loadCurrentStory(); }
  else { if(currentStoryUserIndex < groupedStories.length - 1){ currentStoryUserIndex++; currentStoryIndex = 0; loadCurrentStory(); } else closeStoryViewer(); }
}
function prevStory(){
  stopStoryTimer();
  if(currentStoryIndex > 0){ currentStoryIndex--; loadCurrentStory(); }
  else { if(currentStoryUserIndex > 0){ currentStoryUserIndex--; const group = groupedStories[currentStoryUserIndex]; currentStoryIndex = group ? group.stories.length - 1 : 0; loadCurrentStory(); } }
}
async function markStoryViewed(storyId){
  if(!currentUser || !storyId) return;
  try{ const viewRef = doc(db, "stories", storyId, "views", currentUser.uid); const snap = await getDoc(viewRef); if(!snap.exists()) await setDoc(viewRef, { userId: currentUser.uid, viewedAt: serverTimestamp() }); }catch(e){}
}
$("storyNextZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); nextStory(); });
$("storyPrevZone")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); prevStory(); });
$("storyCloseBtn")?.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); closeStoryViewer(); });
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
    await addDoc(collection(db, "chats", chatId, "messages"), { userId: currentUser.uid, userName: currentProfile?.name || "User", text: "📸 Replied to story: " + text, type: "text", createdAt: serverTimestamp() });
    await updateDoc(doc(db, "chats", chatId), { lastMessage: "📸 Replied to story", updatedAt: serverTimestamp() });
    input.value = "";
    toast("✅ Reply sent");
  }catch(err){ toast("Reply failed"); }
}

/* ========== INIT ========== */
prepareInitialState();
const firstPanel = $("homePanel");
if(firstPanel) firstPanel.classList.remove("hidden");

setTimeout(() => { if(!splashHidden) hideSplash(); }, 1000);
setTimeout(() => {
  if(!authResolved){
    hideSplash();
    if(!currentUser){ $("loginPage")?.classList.remove("hidden"); $("app")?.classList.add("hidden"); }
  }
}, 3000);

console.log("✅ Part 1/3 COMPLETE");

/* ========== GLOBAL ERROR HANDLERS ========== */
window.addEventListener("error", (e) => { console.error("🚨 ERROR:", e.message, e.filename, e.lineno); });
window.addEventListener("unhandledrejection", (e) => { console.error("🚨 PROMISE:", e.reason); });