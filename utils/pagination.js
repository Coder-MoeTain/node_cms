function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPagination(req, defaultLimit = 10, maxLimit = 100) {
  const page = Math.max(parsePositiveInteger(req.query.page, 1), 1);
  const requestedLimit = parsePositiveInteger(req.query.limit, defaultLimit);
  const limit = Math.min(Math.max(requestedLimit, 1), maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function pageMeta(count, page, limit) {
  return {
    total: count,
    page,
    limit,
    pages: Math.max(Math.ceil(count / limit), 1)
  };
}

module.exports = { getPagination, pageMeta };
