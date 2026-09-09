/** Pure filtering helpers shared by the browser UI and tests. */
export function normalizeFilters(input = {}) {
  const toSet = (value) => value instanceof Set ? new Set(value) : new Set(Array.isArray(value) ? value.filter(Boolean) : []);
  return { schools: toSet(input.schools), tags: toSet(input.tags), query: typeof input.query === 'string' ? input.query : '' };
}

function searchableText(advisor, schools = [], tags = []) {
  const school = schools.find((item) => item.id === advisor.school_id);
  const tagLabels = (advisor.site_tag_ids || []).map((id) => tags.find((tag) => tag.id === id)?.label).filter(Boolean);
  return [
    advisor.name,
    school?.name,
    ...(advisor.official_directions || []),
    ...(advisor.site_tags || []),
    ...tagLabels,
    ...(advisor.papers || []).flatMap((paper) => [paper?.title, paper?.name]),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export function matchesFilters(advisor, rawFilters = {}, { schools = [], tags = [] } = {}) {
  const filters = normalizeFilters(rawFilters);
  const schoolMatch = !filters.schools.size || filters.schools.has(advisor.school_id);
  const advisorTagIds = new Set(advisor.site_tag_ids || []);
  const tagMatch = !filters.tags.size || [...filters.tags].some((id) => advisorTagIds.has(id));
  const query = filters.query.trim().toLocaleLowerCase();
  return schoolMatch && tagMatch && (!query || searchableText(advisor, schools, tags).includes(query));
}

export function filterAdvisors(advisors = [], rawFilters = {}, catalog = {}) {
  const filters = normalizeFilters({ ...rawFilters, query: catalog.query ?? rawFilters.query });
  return advisors.filter((advisor) => matchesFilters(advisor, filters, catalog));
}

export function removeFilterChip(rawFilters = {}, group, id) {
  const filters = normalizeFilters(rawFilters);
  if (group === 'school') filters.schools.delete(id);
  if (group === 'tag') filters.tags.delete(id);
  return filters;
}
