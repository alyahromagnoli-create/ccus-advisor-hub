const LATIN_TOKEN = /[a-z]+/g;

function latinTokens(value) {
  return String(value || '').toLowerCase().match(LATIN_TOKEN) || [];
}

function titleCase(value) {
  return value ? value[0].toUpperCase() + value.slice(1).toLowerCase() : '';
}

function romanizedTokens(advisor = {}) {
  const prefix = `${advisor.school_id || ''}-`;
  const raw = String(advisor.id || '').startsWith(prefix)
    ? String(advisor.id).slice(prefix.length)
    : '';
  return raw.split('-').filter(Boolean);
}

export function buildAuthorSearchNames(advisor = {}) {
  const tokens = romanizedTokens(advisor);
  const names = [];
  if (tokens.length >= 2) {
    const family = titleCase(tokens[0]);
    const given = tokens.slice(1).map(titleCase).join('');
    names.push(`${given} ${family}`, `${family} ${given}`);
  }
  if (String(advisor.name || '').trim()) names.push(String(advisor.name).trim());
  return [...new Set(names)];
}

function institutionMatches(school = {}, candidate = {}) {
  const schoolName = String(school.name || '').toLowerCase();
  const candidateNames = (candidate.last_known_institutions || [])
    .map((item) => String(item?.display_name || '').toLowerCase());
  if (!candidateNames.length) return false;
  if (/中国科学院/.test(schoolName)) {
    return candidateNames.some((name) => /chinese academy of sciences|university of chinese academy/.test(name));
  }
  const aliases = {
    cqu: ['chongqing university'], nju: ['nanjing university'], sjtu: ['shanghai jiao tong university'],
    sustech: ['southern university of science and technology'], westlake: ['westlake university'],
    xjtu: ["xi'an jiaotong university", 'xian jiaotong university'], tsinghua: ['tsinghua university'],
    pku: ['peking university'], zju: ['zhejiang university'], cupbeijing: ['china university of petroleum beijing'],
    upc: ['china university of petroleum east china'], cug: ['china university of geosciences'],
    ustc: ['university of science and technology of china'], hit: ['harbin institute of technology'],
    scu: ['sichuan university'],
  };
  const expected = aliases[school.id] || [];
  return candidateNames.some((name) => expected.some((alias) => name.includes(alias)));
}

export function scoreAuthorCandidate(advisor = {}, school = {}, candidate = {}) {
  const expected = romanizedTokens(advisor).sort();
  const actual = latinTokens(candidate.display_name).sort();
  const sameName = expected.length >= 2 && expected.join('') === actual.join('');
  const sameChineseName = String(candidate.display_name || '').trim() === String(advisor.name || '').trim();
  if (!sameName && !sameChineseName) return 0;
  let score = sameName ? 65 : 55;
  if (institutionMatches(school, candidate)) score += 30;
  if (candidate.orcid) score += 5;
  return Math.min(score, 100);
}

const TOPIC_ALIASES = [
  ['co2', /co₂|co2|二氧化碳/i], ['carbon capture', /碳捕集|捕集/i], ['storage', /封存|储层|地下储能/i],
  ['hydrate', /水合物/i], ['multiphase', /多相流/i], ['porous', /多孔介质/i], ['battery', /电池|储能材料/i],
  ['catal', /催化/i], ['hydrogen', /氢能|制氢/i], ['combust', /燃烧/i], ['environment', /环境/i],
  ['geothermal', /地热/i], ['rock', /岩石|岩土/i], ['solar', /太阳能/i], ['heat transfer', /传热|热物理/i],
];

function relevanceTerms(advisor = {}) {
  const text = (advisor.official_directions || []).join(' ');
  return TOPIC_ALIASES.filter(([, pattern]) => pattern.test(text)).map(([term]) => term);
}

export function rankRepresentativeWorks(advisor = {}, works = [], limit = 2) {
  const terms = relevanceTerms(advisor);
  return works
    .filter((work) => work && !work.is_retracted && ['article', 'review'].includes(work.type || 'article'))
    .map((work) => {
      const title = String(work.title || '').toLowerCase();
      const topicHits = terms.filter((term) => title.includes(term)).length;
      const citations = Math.max(0, Number(work.cited_by_count) || 0);
      const year = Number(work.publication_year) || 0;
      const score = topicHits * 100 + Math.log10(citations + 1) * 10 + Math.max(0, year - 2018);
      return { ...work, representative_score: Number(score.toFixed(2)), topic_hits: topicHits };
    })
    .filter((work) => work.topic_hits > 0)
    .sort((a, b) => b.representative_score - a.representative_score)
    .slice(0, limit);
}

export function normalizeJournalMetric(summaryStats = {}) {
  const value = Number(summaryStats.two_year_mean_citedness);
  return {
    jif: null,
    jif_year: null,
    jif_source_url: null,
    openalex_2yr_mean_citedness: Number.isFinite(value) ? value : null,
    metric_note: 'OpenAlex 两年平均被引次数（非 JIF）',
  };
}

export function metricText(paper = {}) {
  const year = /^\d{4}$/.test(String(paper.jif_year || ''));
  if (Number.isFinite(paper.jif) && year) return `期刊 JIF（${paper.jif_year}）：${paper.jif}`;
  if (Number.isFinite(paper.openalex_2yr_mean_citedness)) return `OpenAlex 两年平均被引次数：${paper.openalex_2yr_mean_citedness}（非 JIF）`;
  return '期刊 JIF（年份）待核验';
}
