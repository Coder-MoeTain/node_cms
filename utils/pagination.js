function getPagination(req, defaultLimit = 10) {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.max(parseInt(req.query.limit || defaultLimit, 10), 1);
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
