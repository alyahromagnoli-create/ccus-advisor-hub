export const escapeHtml = (value = '') => String(value).replace(
  /[&<>"']/g,
  (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character],
);

export function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function textOrPending(value, pending = '待核验') {
  return typeof value === 'string' && value.trim() ? value.trim() : pending;
}

function listOrPending(values, pending = '待核验') {
  return Array.isArray(values) && values.length
    ? values.map((value) => textOrPending(value)).join(' · ')
    : pending;
}

export function isValidMatchScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function matchScore(value) {
  return isValidMatchScore(value) ? `${value}%` : '待核验';
}

function jifText(paper = {}) {
  const year = typeof paper.jif_year === 'number' || typeof paper.jif_year === 'string'
    ? String(paper.jif_year).trim()
    : '';
  const hasValidYear = /^\d{4}$/.test(year);
  return Number.isFinite(paper.jif) && hasValidYear
    ? `期刊 JIF（${year}）：${paper.jif}`
    : '期刊 JIF（年份）待核验';
}

function externalLink(url, label, className = '') {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return '';
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : '';
  return `<a${classAttribute} href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function officialProfile(advisor) {
  const directUrl = safeHttpUrl(advisor.official_profile_url || advisor.official_url || advisor.profile_url);
  if (directUrl) {
    const matchingSource = (Array.isArray(advisor.sources) ? advisor.sources : [])
      .find((item) => safeHttpUrl(item?.url) === directUrl);
    return { url: directUrl, label: matchingSource?.label || '教师官网' };
  }
  const source = (Array.isArray(advisor.sources) ? advisor.sources : []).find((item) => {
    if (!safeHttpUrl(item?.url)) return false;
    const type = String(item?.type || '').toLowerCase();
    const label = String(item?.label || '');
    return ['official_profile', 'faculty_profile', 'official', 'faculty'].includes(type)
      || /教师|导师|个人主页/.test(label);
  });
  return source ? { url: source.url, label: source.label || '教师官网' } : null;
}

function paperDetails(paper) {
  if (!paper) return { title: '代表论文待核验', jif: '期刊 JIF（年份）待核验' };
  return {
    title: textOrPending(paper.title, '代表论文待核验'),
    jif: jifText(paper),
  };
}

function evidenceLinks(advisor) {
  const candidates = [];
  const profile = officialProfile(advisor);
  if (profile) candidates.push(profile);
  for (const source of Array.isArray(advisor.sources) ? advisor.sources : []) {
    candidates.push({ url: source?.url, label: source?.label || source?.url || '证据来源' });
  }
  for (const paper of Array.isArray(advisor.papers) ? advisor.papers : []) {
    candidates.push({ url: paper?.source_url || paper?.url, label: paper?.source_label || `${textOrPending(paper?.title, '代表论文')}来源` });
    for (const source of Array.isArray(paper?.sources) ? paper.sources : []) {
      candidates.push({ url: source?.url, label: source?.label || source?.url || '论文来源' });
    }
  }
  const seen = new Set();
  return candidates.filter((candidate) => {
    const url = safeHttpUrl(candidate.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    candidate.url = url;
    return true;
  });
}

export function renderAdvisorCard(advisor, school) {
  const paper = paperDetails(Array.isArray(advisor.papers) ? advisor.papers[0] : null);
  const profile = officialProfile(advisor);
  const profileLink = profile
    ? externalLink(profile.url, profile.label, 'official-link')
    : '<span class="unavailable-source">教师官网待核验</span>';
  const tags = (Array.isArray(advisor.site_tags) ? advisor.site_tags : [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `<article class="advisor-card" data-advisor-id="${escapeHtml(advisor.id)}">
    <div class="card-top">
      <div>
        <h3>${escapeHtml(textOrPending(advisor.name, '导师姓名待核验'))}</h3>
        <p class="advisor-role">${escapeHtml(textOrPending(advisor.title, '职称待核验'))} · ${escapeHtml(textOrPending(advisor.degree_supervision, '导师资格待核验'))}</p>
        <p class="institution">${escapeHtml(textOrPending(school?.name, '院校待核验'))}</p>
      </div>
      <div class="card-badges">
        <span class="relevance-badge">CCUS 相关度：${escapeHtml(textOrPending(advisor.ccus_relevance))}</span>
        <span class="evidence-badge">${escapeHtml(textOrPending(advisor.review_status))}</span>
      </div>
    </div>
    <div class="card-section">
      <span class="card-label">研究方向</span>
      <p class="card-directions">${escapeHtml(listOrPending(advisor.official_directions, '研究方向待核验'))}</p>
      <div class="card-tags">${tags}</div>
    </div>
    <div class="paper-summary">
      <span class="card-label">代表论文</span>
      <strong>${escapeHtml(paper.title)}</strong>
      <span class="jif-label">${escapeHtml(paper.jif)}</span>
    </div>
    <div class="card-links">${profileLink}</div>
    <div class="card-footer">
      <span>匹配度 <span class="match-score">${escapeHtml(matchScore(advisor.match_score))}</span></span>
      <span>核验日期 ${escapeHtml(textOrPending(advisor.checked_at))}</span>
      <button class="card-button" type="button" data-profile="${escapeHtml(advisor.id)}">查看档案</button>
    </div>
  </article>`;
}

function renderPaper(paper, index) {
  const details = paperDetails(paper);
  const relevance = textOrPending(paper?.relevance || paper?.ccus_relevance, '相关性待核验');
  const highImpact = paper?.high_impact === true
    ? '<span class="paper-badge high-impact">高影响力代表作</span>'
    : '<span class="paper-badge pending">高影响力待核验</span>';
  return `<article class="profile-paper">
    <span class="card-label">代表论文 ${index + 1}</span>
    <h4>${escapeHtml(details.title)}</h4>
    <div class="paper-badges"><span class="paper-badge relevance">${escapeHtml(relevance)}</span>${highImpact}</div>
    <p class="paper-meta">${escapeHtml(textOrPending(paper?.journal, '期刊待核验'))} · ${escapeHtml(details.jif)}</p>
  </article>`;
}

export function renderProfileContent(advisor, school, privateRecord = {}) {
  const links = evidenceLinks(advisor);
  const papers = Array.isArray(advisor.papers) && advisor.papers.length
    ? advisor.papers.map(renderPaper).join('')
    : '<div class="unavailable-block"><span class="evidence-badge">待核验</span><p>代表论文、论文相关性与期刊 JIF（年份）待核验。</p></div>';
  const sourceList = links.length
    ? links.map((source) => externalLink(source.url, source.label)).join('')
    : '<span class="evidence-badge">来源待核验</span>';
  const tags = (Array.isArray(advisor.site_tags) ? advisor.site_tags : [])
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `<div class="profile-head">
    <span class="eyebrow">导师档案</span>
    <h2 id="dialog-name">${escapeHtml(textOrPending(advisor.name, '导师姓名待核验'))}</h2>
    <p class="institution">${escapeHtml(textOrPending(school?.name, '院校待核验'))} · ${escapeHtml(textOrPending(advisor.title, '职称待核验'))} · ${escapeHtml(textOrPending(advisor.degree_supervision, '导师资格待核验'))}</p>
    <div class="profile-status"><span class="relevance-badge">CCUS 相关度：${escapeHtml(textOrPending(advisor.ccus_relevance))}</span><span class="evidence-badge">${escapeHtml(textOrPending(advisor.review_status))}</span><span>核验日期 ${escapeHtml(textOrPending(advisor.checked_at))}</span></div>
  </div>
  <section class="profile-section" aria-labelledby="direction-heading">
    <h3 id="direction-heading">研究方向匹配</h3>
    <p>${escapeHtml(textOrPending(advisor.direction_match || advisor.direction_match_summary || advisor.match_reason, '研究方向匹配说明待核验'))}</p>
    <p>${escapeHtml(listOrPending(advisor.official_directions, '研究方向待核验'))}</p>
    <div class="card-tags">${tags}</div>
  </section>
  <section class="profile-section" aria-labelledby="papers-heading">
    <h3 id="papers-heading">代表论文</h3>
    <div class="profile-papers">${papers}</div>
  </section>
  <section class="profile-section" aria-labelledby="sources-heading">
    <h3 id="sources-heading">全部证据来源</h3>
    <div class="source-list">${sourceList}</div>
  </section>
  <div class="private-box">
    <label for="contact-status">私密进度</label>
    <select id="contact-status"><option>未处理</option><option>已收藏</option><option>待联系</option><option>已联系</option><option>不考虑</option></select>
    <label for="private-note" class="private-note-label">备注</label>
    <textarea id="private-note" placeholder="仅自己可见…">${escapeHtml(privateRecord.note || '')}</textarea>
    <div id="private-state-editor-message" class="private-state-editor-message" role="status" aria-live="polite"></div>
    <div class="private-note">私密内容仅保存在当前浏览器。</div>
  </div>`;
}

export function createProfileDialogController(dialog) {
  let trigger = null;
  dialog.addEventListener('close', () => {
    const returnTarget = trigger;
    trigger = null;
    returnTarget?.focus?.();
  });

  return {
    open(nextTrigger) {
      trigger = nextTrigger?.focus ? nextTrigger : null;
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
