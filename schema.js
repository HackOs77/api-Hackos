const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const users = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  roles: { type: String, required: true },
  createtime: { type: String, required: true },
  timeout: { type: String, required: true },
  access_ip: { type: [String], required: false, default: [''] },
  login: { type: Boolean, required: false, default: false },
  jwt: { type: String }
});

const Users = mongoose.model("Users", users);

module.exports = { Users };