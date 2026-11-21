const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUuidParam = (name) => (req, res, next) => {
  if (!UUID_PATTERN.test(req.params[name] || "")) {
    return res.status(400).json({ success: false, message: `${name} must be a valid UUID` });
  }
  return next();
};

module.exports = validateUuidParam;
module.exports.isValidUuid = (value) => UUID_PATTERN.test(value || "");
