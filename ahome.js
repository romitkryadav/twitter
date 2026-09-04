/**
 * X Video Downloader - Client Side controller
 */

// =========================================================================
// CONFIGURATION
// =========================================================================
// 1. If your Cloudflare Worker is deployed on the same domain (recommended),
//    keep this as a relative path "/api".
// 2. If your Worker is hosted on a separate subdomain (e.g. your-worker.workers.dev),
//    change this value to "https://your-worker.workers.dev/api".
const API_BASE = "https://xvid.romitkr5539.workers.dev/api";

// DOM Elements
const downloaderForm = document.getElementById("downloaderForm");
const videoUrl = document.getElementById("videoUrl");
const clearBtn = document.getElementById("clearBtn");
const pasteBtn = document.getElementById("pasteBtn");
const loaderState = document.getElementById("loaderState");
const errorCard = document.getElementById("errorCard");
const errorMsg = document.getElementById("errorMsg");
const resultCard = document.getElementById("resultCard");

// Result details elements
const authorHeader = document.getElementById("authorHeader");
const authorAvatar = document.getElementById("authorAvatar");
const authorName = document.getElementById("authorName");
const authorHandle = document.getElementById("authorHandle");
const previewPlayer = document.getElementById("previewPlayer");
const videoDuration = document.getElementById("videoDuration");
const activeQuality = document.getElementById("activeQuality");
const captionBox = document.getElementById("captionBox");
const captionText = document.getElementById("captionText");
const qualitiesList = document.getElementById("qualitiesList");

// Modal Elements
const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");

let currentVideos = [];

// =========================================================================
// FORM & SEARCH EVENTS
// =========================================================================

// Handle Clear/Paste button states on input change
videoUrl.addEventListener("input", () => {
    if (videoUrl.value.trim().length > 0) {
        clearBtn.style.display = "block";
    } else {
        clearBtn.style.display = "none";
    }
});

clearBtn.addEventListener("click", () => {
    videoUrl.value = "";
    clearBtn.style.display = "none";
    videoUrl.focus();
});

// Paste from Clipboard helper
pasteBtn.addEventListener("click", async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            videoUrl.value = text;
            clearBtn.style.display = "block";
            hideError();
        }
    } catch (err) {
        showError("Please paste the link manually into the box.");
    }
});

// Use Example URL helper
function useExample(exampleUrl) {
    videoUrl.value = exampleUrl;
    clearBtn.style.display = "block";
    hideError();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Normalize Twitter/X Url formats
function normalizeUrl(input) {
    let clean = input.trim();
    // Normalize mobile, standard, x or twitter subdomains to x.com for parsing
    clean = clean.replace(/^(https?:\/\/)?(mobile\.)?twitter\.com/i, "https://x.com");
    return clean;
}

// Download Submit Trigger
downloaderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    hideResult();

    const urlValue = normalizeUrl(videoUrl.value);

    if (!urlValue) {
        showError("Please paste a Twitter/X post URL first.");
        return;
    }

    const isTwitterUrl = /^(https?:\/\/)?(x|twitter)\.com\/[a-zA-Z0-9_]+\/status\/\d+/i.test(urlValue);
    if (!isTwitterUrl) {
        showError("Invalid URL format. Please paste a valid status link, e.g., https://x.com/username/status/123456789");
        return;
    }

    showLoader(true);

    try {
        const fetchUrl = `${API_BASE}/download?url=${encodeURIComponent(urlValue)}`;
        const response = await fetch(fetchUrl);
        const data = await response.json();

        if (!response.ok || !data.success) {
            showError(data.error || "We couldn't retrieve downloadable formats. Ensure the post is public and contains video.");
        } else {
            renderDownloadResult(data);
        }
    } catch (err) {
        console.error(err);
        showError("Unable to connect to the downloader API. Please check your network and try again.");
    } finally {
        showLoader(false);
    }
});

// =========================================================================
// UI DISPLAY HELPERS
// =========================================================================

function showLoader(visible) {
    loaderState.style.display = visible ? "block" : "none";
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorCard.style.display = "block";
}

function hideError() {
    errorCard.style.display = "none";
}

function hideResult() {
    resultCard.style.display = "none";
    previewPlayer.src = "";
}

// Formats duration (seconds -> MM:SS)
function formatDuration(seconds) {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Render dynamic results
function renderDownloadResult(data) {
    currentVideos = data.videos || [];
    if (currentVideos.length === 0) {
        showError("No downloadable MP4 video formats found in this post.");
        return;
    }

    // Set author header
    if (data.author) {
        authorHeader.style.display = "flex";
        authorAvatar.src = data.author.avatar || "";
        authorName.textContent = data.author.name || "Twitter User";
        authorHandle.textContent = `@${data.author.username || "user"}`;
    } else {
        authorHeader.style.display = "none";
    }

    // Duration & caption
    videoDuration.textContent = data.duration ? `Duration: ${formatDuration(data.duration)}` : "Duration: N/A";
    
    if (data.text) {
        captionBox.style.display = "block";
        captionText.textContent = `"${data.text}"`;
    } else {
        captionBox.style.display = "none";
    }

    // Set preview player poster and select first item
    previewPlayer.poster = data.thumbnail || "";
    selectQuality(currentVideos[0]); // highest resolution

    // Render list rows
    qualitiesList.innerHTML = "";
    currentVideos.forEach((vid) => {
        const row = document.createElement("div");
        row.className = "quality-row";
        row.id = `quality-row-${vid.quality}`;
        
        const isCurrent = previewPlayer.src === vid.url;
        if (isCurrent) row.classList.add("active");

        row.onclick = () => {
            selectQuality(vid);
            document.querySelectorAll(".quality-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");
        };

        const formatName = vid.contentType.split("/")[1]?.toUpperCase() || "MP4";

        row.innerHTML = `
            <div class="quality-info">
                <div class="quality-badge">${vid.quality.toUpperCase()}</div>
                <div class="quality-meta">
                    <h5>${vid.quality} Resolution</h5>
                    <p>${vid.width} × ${vid.height} • ${formatName}</p>
                </div>
            </div>
            <a 
                href="${vid.url}" 
                download="X_video_${vid.quality}.mp4" 
                target="_blank" 
                rel="noreferrer" 
                class="btn-download-quality primary"
                onclick="event.stopPropagation();"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download</span>
            </a>
        `;
        qualitiesList.appendChild(row);
    });

    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth" });
}

// Choose different active quality preview
function selectQuality(videoObj) {
    previewPlayer.src = videoObj.url;
    activeQuality.textContent = `${videoObj.quality} Selected`;
    
    // update current active visual row
    document.querySelectorAll(".quality-row").forEach((row) => {
        row.classList.remove("active");
        if (row.id === `quality-row-${videoObj.quality}`) {
            row.classList.add("active");
        }
    });
}

// =========================================================================
// FAQ ACCORDION HANDLERS
// =========================================================================
document.querySelectorAll(".faq-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
        const parent = trigger.parentElement;
        const isActive = parent.classList.contains("active");

        // Close all other items
        document.querySelectorAll(".faq-item").forEach((item) => {
            item.classList.remove("active");
            item.querySelector(".faq-content").style.maxHeight = null;
        });

        if (!isActive) {
            parent.classList.add("active");
            const content = parent.querySelector(".faq-content");
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
});

// =========================================================================
// UNIVERSAL MODALS CONTROLLERS
// =========================================================================

const modalData = {
    about: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <h3>About X Video Downloader</h3>
        </div>
        <div class="modal-body-text">
            <p>X Video Downloader was built with a clear focus on digital preservation and user privacy. We provide a lightweight interface to download public videos and GIFs without the weight of intrusive tracking codes or heavy ad networks.</p>
            <p>Our backend extracts information in real-time, connecting you directly to official Twitter CDNs for unthrottled and completely secure file transfers.</p>
        </div>
    `,
    contact: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h3>Contact Support</h3>
        </div>
        <div class="modal-body-text">
            <p>Have some ideas, security feedback, or require assistance? Drop us an email:</p>
            <p style="font-family: var(--font-mono); color: var(--color-brand); font-weight: 600; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px;">
                romitkryadav@gmail.com
            </p>
            <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.5rem;">We aim to respond to queries within 48 business hours.</p>
        </div>
    `,
    privacy: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h3>Privacy Policy</h3>
        </div>
        <div class="modal-body-text">
            <p><strong>Effective Date:</strong> July 21, 2026</p>
            <p>At X Video Downloader, your privacy is a hard constraint. We enforce the following rules:</p>
            <h4>1. No Registrations</h4>
            <p>You can fetch content 100% anonymously. We never request email addresses, credentials, or personal profiles.</p>
            <h4>2. No Content Caching</h4>
            <p>We do not copy or store downloaded videos on our cloud systems. All video URLs reference native CDN addresses.</p>
        </div>
    `,
    terms: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>Terms of Service</h3>
        </div>
        <div class="modal-body-text">
            <p>By accessing X Video Downloader, you agree to these legal conditions:</p>
            <h4>1. Copyright Rules</h4>
            <p>You should only save videos for personal, educational, and archiving purposes. All ownership copyrights remain properties of their respective authors.</p>
            <h4>2. Disclaimer</h4>
            <p>We present this tool "as is". Should Twitter update their metadata formats, our parser may experience functional limitations which we work to resolve quickly.</p>
        </div>
    `,
    disclaimer: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3>Affiliation Disclaimer</h3>
        </div>
        <div class="modal-body-text">
            <p>This software utility is an <strong>independent third-party product</strong>.</p>
            <p>We are not affiliated with, endorsed by, sponsored by, or partner to X Corp., Twitter, or any subsidiary entities.</p>
            <p>All brand graphics, trademarks, and references to Twitter and X belong exclusively to X Corp.</p>
        </div>
    `,
    dmca: `
        <div class="modal-header-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <h3>DMCA Copyright Notice</h3>
        </div>
        <div class="modal-body-text">
            <p>X Video Downloader does not host, clone, or store any files on its servers. When a download is performed, users directly link to Twitter's official CDNs.</p>
            <p>Therefore, we cannot perform deletions of video materials. Please address all takedowns directly to X Corp. or the original post author.</p>
            <p>For landing page inquiries, reach us at <span style="font-family: var(--font-mono); color: var(--color-brand);">romitkryadav@gmail.com</span>.</p>
        </div>
    `
};

function showModal(type) {
    if (modalData[type]) {
        modalContent.innerHTML = modalData[type];
        modalOverlay.style.display = "flex";
        document.body.style.overflow = "hidden"; // block background scrolls
    }
}

function closeModal() {
    modalOverlay.style.display = "none";
    document.body.style.overflow = "auto";
}

// Close modal if clicking outside card
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});
