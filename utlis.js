const jwt = require("jsonwebtoken");
const config = require('./config')

function auth(req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader) return next();
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer")
    return res.status(400).fail("Unsupported authentication type");
  if (!token) return res.status(400).fail("Token is not provided");

  jwt.verify(token, config.SECRET, (err, decoded) => {
    if (err) return res.status(400).fail(err);
    const user = {
      _id: decoded?._id,
      roles: decoded?.roles,
    };

    req.user = user;
    next();
  });
}

function checkLogin(req, res, next) {
  if (req.session.isLogged) {
    return res.status(401).fail('โปรด logout อีกเครื่องหนึ่ง ก่อนเข้าสู่ระบบใหม่')
  }
  next()
}

function hasRole(roles) {
  const middleware = (req, res, next) => {
    if (!req.user) {
      return res.status(401).fail("Unauthorized");
    }

    if (roles !== undefined && !req.user.roles.some((r) => r === roles)) {
      return res.status(400).fail("no permission");
    }

    next();
  };
  return middleware;
}

function responser(req, res, next) {
  const success = (data) => {
    res.json({
      status: "success",
      data: data || null,
    });
  };

  const fail = (data) => {
    res.json({
      status: "fail",
      data: data || null,
    });
  };

  const error = (message) => {
    res.json({
      status: "error",
      data: message,
    });
  };
  res.success = success;
  res.fail = fail;
  res.error = error;

  next();
}

module.exports = { responser, auth, hasRole, checkLogin };
