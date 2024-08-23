const { hasRole } = require("../utlis");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const { Users, TradeApprove, Items } = require("../schema");
const { body, param, validationResult } = require("express-validator");

module.exports = function (api) {
  api.get("/getUsers", async (req, res) => {
    const user = await Users.find();

    return res.status(201).success(user);
  });


};
