(() => {
  'use strict';
  const APIs = { video: 'https://xvid.romitkr5539.workers.dev/api', image: 'https://ximage.romitkr3018.workers.dev', profile: 'https://xdp.romitkr3018.workers.dev' };
  const form = document.getElementById('homeForm');
  const input = document.getElementById('mediaUrl');
  const error = document.getElementById('formError');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = document.getElementById('submitLabel');
  const results = document.getElementById('downloadResults');
  const pasteButton = document.getElementById('pasteInputBtn');
  pasteButton.addEventListener('click', async () => {
    try {
      input.value = (await navigator.clipboard.readText()).trim();
      input.focus();
    } catch {
      input.focus();
    }
  });

  input.placeholder = 'Paste an X post link, profile link, or @username';
  document.getElementById('inputHint').textContent = 'We detect whether the link is a post or profile and load available media here.';
  submitLabel.textContent = 'Find media';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.style.display = 'none';
    results.hidden = true;
    results.replaceChildren();
    const raw = input.value.trim();
    if (!raw) return;
    submit.disabled = true;
    submitLabel.textContent = 'Loading…';
    results.hidden = false;
    const loading = document.createElement('p');
    loading.className = 'result-message';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Checking for videos and images…';
    results.append(loading);

    try {
      const source = classifyInput(raw);
      if (source.kind === 'profile') await loadProfile(source.username);
      else await loadPost(source.url);
    } catch (err) {
      results.hidden = true;
      results.replaceChildren();
      error.textContent = err.message || 'Could not load media. Check the link and try again.';
      error.style.display = 'block';
    } finally {
      submit.disabled = false;
      submitLabel.textContent = 'Find media';
    }
  });

  function classifyInput(raw) {
    if (/^(javascript|data|file):/i.test(raw)) throw new Error('Enter a valid X or Twitter post link, profile link, or username.');
    if (/^@?[A-Za-z0-9_]{1,15}$/.test(raw)) return { kind: 'profile', username: raw.replace(/^@/, '') };

    let url;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); }
    catch { throw new Error('Enter a valid X or Twitter link or username.'); }
    const hosts = ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'];
    if (!hosts.includes(url.hostname.toLowerCase())) throw new Error('Only x.com and twitter.com links are supported.');

    const status = url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,50}|i)\/status(?:es)?\/(\d+)/i);
    if (status) {
      const parts = url.pathname.split('/').filter(Boolean);
      const author = parts[0] === 'i' ? 'i' : parts[0];
      return { kind: 'post', url: `https://x.com/${author}/status/${status[1]}` };
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 1 && /^[A-Za-z0-9_]{1,15}$/.test(segments[0].replace(/^@/, ''))) {
      return { kind: 'profile', username: segments[0].replace(/^@/, '') };
    }
    throw new Error('Use a post link with /status/ID, or a profile link such as https://x.com/username.');
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || 'No public media was found.');
    return data;
  }

  async function loadPost(url) {
    const [videoResult, imageResult] = await Promise.allSettled([
      getJson(`${APIs.video}/download?url=${encodeURIComponent(url)}`),
      getJson(`${APIs.image}/api/x-images?url=${encodeURIComponent(url)}`)
    ]);
    const videos = videoResult.status === 'fulfilled' && Array.isArray(videoResult.value.videos) ? videoResult.value.videos : [];
    const imageData = imageResult.status === 'fulfilled' ? imageResult.value : null;
    const images = imageData && Array.isArray(imageData.images) ? imageData.images : [];
    if (!videos.length && !images.length) {
      const reason = videoResult.status === 'rejected' ? videoResult.reason : imageResult.reason;
      throw new Error(reason?.message || 'No downloadable video or images were found. The post may be private or contain unsupported media.');
    }

    const section = makeResultsSection('Media ready to download', `Found ${videos.length ? `${videos.length} video${videos.length === 1 ? '' : 's'}` : ''}${videos.length && images.length ? ' and ' : ''}${images.length ? `${images.length} image${images.length === 1 ? '' : 's'}` : ''} in this public post.`);
    if (videos.length) section.append(renderVideos(videos, videoResult.value));
    if (images.length) section.append(renderImages(images));
    showResults(section);
  }

function renderVideos(videos, data) {
    const group = document.createElement('div');
    group.className = 'media-group';
    const heading = document.createElement('h3');
    heading.textContent = 'Video';
    group.append(heading);

    const preview = document.createElement('video');
    preview.className = 'media-preview video-preview';
    preview.controls = true;
    preview.playsInline = true;
    if (data.thumbnail) preview.poster = data.thumbnail;
    preview.src = proxyVideoUrl(videos[0].url);
    const previewError = document.createElement('p');
    previewError.className = 'download-status download-error';
    previewError.hidden = true;
    previewError.textContent = 'Video preview could not load. Try another quality or download it below.';
    preview.addEventListener('error', () => { previewError.hidden = false; });
    group.append(preview, previewError);

    const list = document.createElement('div');
    list.className = 'download-list';
    videos.forEach((video, index) => {
      const row = document.createElement('div');
      row.className = 'download-row';
      const info = document.createElement('span');
      info.textContent = `${video.quality || 'Video'}${video.width && video.height ? ` · ${video.width} × ${video.height}` : ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-primary';
      button.textContent = 'Download';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        downloadVideo(proxyVideoUrl(video.url, true), `X_video_${video.quality || index + 1}.mp4`, button);
      });
      row.append(info, button);
      row.addEventListener('click', () => {
        preview.src = proxyVideoUrl(video.url);
        preview.load();
        previewError.hidden = true;
      });
      list.append(row);
    });
    group.append(list);
    return group;
  }
  function proxyVideoUrl(url, forDownload = false) {
    const params = new URLSearchParams({ url });
    if (forDownload) params.set('dl', '1');
    return `${APIs.video}/proxy?${params.toString()}`;
  }

  async function downloadVideo(url, filename, button) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Downloading…';
    let status = button.parentElement.querySelector('.download-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'download-status';
      status.setAttribute('role', 'status');
      button.parentElement.append(status);
    }
    status.textContent = '';
    status.classList.remove('download-error');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const blob = await response.blob();
      if (!blob.size) throw new Error('The downloaded video was empty.');
      const blobUrl = URL.createObjectURL(blob);
      const saveLink = document.createElement('a');
      saveLink.href = blobUrl;
      saveLink.download = filename;
      saveLink.hidden = true;
      document.body.append(saveLink);
      saveLink.click();
      saveLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      status.textContent = 'Download started.';
      button.textContent = 'Download again';
    } catch (err) {
      status.textContent = err.message || 'Could not download the video. Please try again.';
      status.classList.add('download-error');
      button.textContent = originalLabel;
    } finally {
      button.disabled = false;
    }
  }
  function renderImages(images) {
    const group = document.createElement('div');
    group.className = 'media-group';
    const heading = document.createElement('h3');
    heading.textContent = 'Images';
    const grid = document.createElement('div');
    grid.className = 'result-image-grid';
    images.forEach((image, index) => {
      const card = document.createElement('article');
      card.className = 'result-image-card';
      const preview = document.createElement('img');
      preview.src = image.previewUrl || image.url;
      preview.alt = `Image ${index + 1} from X post`;
      preview.loading = 'lazy';
      const filename = image.downloadFilename || `x-image-${index + 1}.jpg`;
      const link = document.createElement('a');
      link.className = 'btn-primary';
      link.href = `${APIs.image}/api/x-image-download?url=${encodeURIComponent(image.url)}&filename=${encodeURIComponent(filename)}`;
      link.download = filename;
      link.target = 'downloadFrame';
      link.textContent = 'Download image';
      card.append(preview, link);
      grid.append(card);
    });
    group.append(heading, grid);
    return group;
  }

  async function loadProfile(username) {
    const data = await getJson(`${APIs.profile}/api/x-dp?username=${encodeURIComponent(username)}`);
    if (!data.image?.url || !data.profile) throw new Error('No public profile picture was found.');
    const section = makeResultsSection(data.profile.name || `@${data.profile.username}`, `Profile picture · @${data.profile.username}`);
    const preview = document.createElement('img');
    preview.className = 'media-preview profile-preview';
    preview.src = data.image.url;
    preview.alt = `${data.profile.name || data.profile.username}'s X profile picture`;
    preview.onerror = () => { preview.src = `${APIs.profile}/api/x-dp-download?url=${encodeURIComponent(data.image.url)}&username=${encodeURIComponent(data.profile.username)}`; };
    const download = document.createElement('a');
    download.className = 'btn-primary result-download';
    download.href = `${APIs.profile}/api/x-dp-download?url=${encodeURIComponent(data.image.url)}&username=${encodeURIComponent(data.profile.username)}`;
    download.download = `x-dp-${data.profile.username}.jpg`;
    download.target = 'downloadFrame';
    download.textContent = 'Download profile picture';
    section.append(preview, download);
    showResults(section);
  }

  function makeResultsSection(title, subtitle) {
    const section = document.createElement('section');
    section.className = 'results-card';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const description = document.createElement('p');
    description.className = 'results-subtitle';
    description.textContent = subtitle;
    section.append(heading, description);
    return section;
  }

  function showResults(section) {
    results.replaceChildren(section);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();











