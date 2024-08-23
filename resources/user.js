const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const { Users } = require("../schema");
const { hasRole } = require("../utlis");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const buddhistEra = require ("dayjs/plugin/buddhistEra");
const chalk = require("chalk");
const requestIP = require("request-ip");
const request = require("request");
const config = require("../config");

const url_line_notification = "https://notify-api.line.me/api/notify";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("th");
dayjs.tz.setDefault("Asia/Bangkok");
dayjs.extend(buddhistEra);


let save = {}

function signJwt(_id, exp, roles) {
  return new Promise((resolve, reject) => {
    jwt.sign(
      { _id: _id, exp: exp, roles: roles },
      config.SECRET,
      (err, token) => {
        if (err) reject(err);
        resolve(token);
      }
    );
  });
}

module.exports = function (api) {
  api.get("/", async (req, res) => {
    res.send({
      message: `Api HackOs v.2`,
      ip: req.clientIp
    });
  });

  api.get("/me", hasRole(), async (req, res) => {
    const result = await Users.findOne({ _id: req.user._id });
    // console.log(result)
    // console.log('req.headers.authorization:', req.headers.authorization.split('Bearer ')[1])
    // jwt.verify(result.jwt, config.SECRET, (err, decoded) => {
    //   if (err) return res.status(400).fail(err);
    //   console.log(decoded)
    // });

    if (result) {
      // if (req.headers.authorization.split('Bearer ')[1] !== result.jwt) return res.status(403).error('หมดอายุ')
      if (result.roles !== "VIP" && result.roles !== "ADMIN" && req.headers.authorization.split('Bearer ')[1] !== result.jwt) return res.status(403).error('หมดอายุ')

      const timeout = dayjs(new Date(result.timeout));
      const date = dayjs();

      if (date >= timeout) return res.status(403).error("หมดอายุแล้ว");

      if (!result) return res.status(401).fail("username not found");
      res.status(201).success({
        _id: result._id,
        username: result.username,
        name: result.name,
        roles: result.roles,
        timeout: result.timeout,
      });
    }
  });

  api.post('/changeUserIp',
    body("username").notEmpty(),
    body("ip").notEmpty(),
    // hasRole("ADMIN"),
    async (req, res) => {
      const { username, ip } = req.body;
      if (!(username || ip)) return res.status(400).send('Sonething went wrong')

      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('username not found')

      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          access_ip: [ip],
        },
        { new: true }
      );

      console.log(`
        ${chalk.bgGreen("[+] Chnage ip")} ${chalk.bgYellow("REQUEST USER")}
        Username : ${req.body.username}
        Request_IP : ${requestIP.getClientIp(req)}
        ChnageIp_Date : ${dayjs().format("DD MMMM YY, HH:mm:ss")}
        `);
      return res.status(200).send(result);
    })

  api.post('/Logout',
    body("username").notEmpty(),
    async (req, res) => {
      const { username } = req.body;
      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('username not found')
      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          login: false,
        },
        { new: true }
      );
      //console.log('[-] Remove Session Username:', result.username ,'[-]' )
      console.log(`${chalk.bgYellow("[-] User Logout [-]")}  \nUsername: ${user.username} LogoutSuccess Date: ${dayjs().format("DD MMMM YY - HH:mm:ss")}`)
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[-] ออกระบบ [-]\nUsername : ${result.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nIP : ${requestIP.getClientIp(req)}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });
      return res.status(200).success("เรียบร้อย")
    })

  api.post(
    "/addUserTimeoutHackos",
    body("username").notEmpty(),
    body("timeout").notEmpty(),
    hasRole("ADMIN"),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).fail("Something went wrong");

      const user = await Users.findOne({ username: req.body.username });
      if (!user) return res.status(401).fail("username not found");

      const date = new Date(Date.now() + 3600 * 1000 * 24 * req.body.timeout);

      if (!req.body.password) {
        const result = await Users.findOneAndUpdate(
          { username: req.body.username },
          {
            timeout: date,
            login: false,
          },
          { new: true }
        );

        console.log(`
        ${chalk.bgGreen("[+] Added Time")} ${chalk.bgRed("REQUEST ADMIN")}
        Username : ${req.body.username}
        Timeout : ${dayjs(date).format("DD MMMM YY, HH:mm:ss")}
      
        `);

        request({
          method: "POST",
          uri: url_line_notification,
          header: {
            "Content-Type": "multipart/form-data",
          },
          auth: { bearer: config.LINE_TOKEN },
          form: {
            message: `[+] เพิ่มวันใช้งาน [+]\nUsername : ${req.body.username}\nExpire : ${dayjs(date).format("DD MMMM YY, HH:mm:ss")}`,
          },
        });

        return res.status(201).success(result);
      } else {
        const result = await Users.findOneAndUpdate(
          { username: req.body.username },
          {
            timeout: date,
          },
          { new: true }
        );

        return res.status(201).success(result);
      }
    }
  );

  const signUpLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // หน่วยเวลาเป็น มิลลิวินาที ในนี้คือ 15 นาที (1000 มิลลิวินาที = 1 วินาที)
    max: 10, // จำนวนการเรียกใช้สูงสุดต่อ IP Address ต่อเวลาใน windowMS
    standardHeaders: true, // คืน rate limit ไปยัง `RateLimit-*` ใน headers 
    legacyHeaders: false, // ปิด `X-RateLimit-*` ใน headers 
    message: async (req, res) => {
      res
        .status(401)
        .fail("ท่านเข้าสู่ระบบผิดหลายรอบเกินไปกรุณาเข้าใหม่ภายหลัง 10 นาที");
    },
  });

  api.post(
    "/signIn",
    // signUpLimiter,
    body("username").notEmpty(),
    body("password").notEmpty(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).fail(errors.array());

      const user = await Users.findOne({ username: req.body.username });
      if (!user) return res.status(401).fail("ไม่พบบัญชี ติดต่อแอดมิน Line ID : @646zbdqd มี@ด้วย");

      if (!bcrypt.compareSync(req.body.password, user.password))
        return res.status(401).fail("Username หรือ Password ผิดพลาด");
      const timeout = dayjs(new Date(user.timeout));
      const date = dayjs();
      
      if (date >= timeout) return res.status(403).error("หมดอายุแล้ว ติดต่อแอดมิน Line ID : @646zbdqd มี@ด้วย");

      // if (user.login && user.roles === "VIP") {

      // } else if (user.login && user.roles === "USER") {
      //   signUpLimiter,
      //     request({
      //       method: "POST",
      //       uri: url_line_notification,
      //       header: {
      //         "Content-Type": "multipart/form-data",
      //       },
      //       auth: { bearer: config.LINE_TOKEN },
      //       form: {
      //         message: `[-] เตือนเข้าระบบซ้ำ [-]\nUsername : ${req.body.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nIP : ${requestIP.getClientIp(req)}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
      //       },
      //     });
      //   console.log(`
      //   ${chalk.bgRed("[-] เตือนเข้าระบบซ้ำ [-]")}
      //   Username : ${req.body.username}
      //   IP : ${requestIP.getClientIp(req)}
      //   Date : ${dayjs().format("DD MMMM YY, HH:mm:ss")}
      //   `);
      //   return res.status(401).fail("โปรด logout ระบบอีกเครื่องหนึ่งก่อนเข้าสู่ระบบอีกครั้ง ติดต่อแอดมิน Line ID : @646zbdqd มี@ด้วย")
      // }
      const token = await signJwt(user._id, dayjs().add(1, "hour").valueOf(), [
        user.roles,
      ]);
      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          login: true, jwt: token
        },
        { new: true }
      );
      console.log(`${chalk.bgBlue("[+] User Login [+]")}  \nUsername: ${user.username} LoginSuccess Date: ${dayjs().format("DD MMMM YY - HH:mm:ss")}`)
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[+] User SignIn [+]\nUsername : ${req.body.username}\nExpire : ${dayjs(user.timeout).format("DD/MM/YY, HH:mm:ss")}\nIP : ${requestIP.getClientIp(req)}\nDate : ${dayjs().format("DD/MM/YY, HH:mm:ss")}`,
        },
      });
      save["user"] = req.body.username
      res.status(201).success({ jwt: token });
    }
  );

  api.post('/Logout',
    body("username").notEmpty(),
    async (req, res) => {
      const { username } = req.body;
      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('username not found')
      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          login: false,
        },
        { new: true }
      );
      //console.log('[-] Remove Session Username:', result.username ,'[-]' )
      console.log(`${chalk.bgYellow("[-] User Logout [-]")}  \nUsername: ${user.username} LogoutSuccess Date: ${dayjs().format("DD MMMM YY - HH:mm:ss")}`)
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[-] ออกระบบ [-]\nUsername : ${result.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nIP : ${requestIP.getClientIp(req)}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });
      return res.status(200).success("เรียบร้อย")
    })


  /////////////////////////////////////////////////////////////////////////////
  api.post('/ErrorLogout',
    body("username").notEmpty(),
    async (req, res) => {
      const { username } = req.body;
      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('ไม่มี Username ในระบบ')
      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          login: false, jwt: "HackOs"
        },
        { new: true }
      );
      console.log('[-] Remove Session bY Admin Username:', result.username, '[-]')
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[-] แก้ค้างระบบ [-]\nUsername : ${result.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });
      return res.status(200).send("ลบ User ค้างระบบเรียบร้อย")
    })

  api.post('/Repassword',
    body("username").notEmpty(),
    body("password").notEmpty(),
    // hasRole("ADMIN"),
    async (req, res) => {
      const { username, password } = req.body;
      if (!(username || password)) return res.status(400).send('Sonething went wrong')

      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('ไม่มี Username ในระบบ')

      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          password: await bcrypt.hash(req.body.password, 10),
        },
        { new: true }
      );
      console.log('[-] RePassword Username:', result.username, '[-]')
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[-] เปลี่ยนรหัสผ่าน [-]\nUsername : ${result.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });
      return res.status(200).send("เปลี่ยนรหัสผ่านเรียบร้อย")
    })

  api.post('/roles',
    body("username").notEmpty(),
    body("roles").notEmpty(),
    // hasRole("ADMIN"),
    async (req, res) => {
      const { username, roles } = req.body;
      if (!(username || roles)) return res.status(400).send('Sonething went wrong')

      const user = await Users.findOne({ username: username });
      if (!user) return res.status(401).send('ไม่มี Username ในระบบ')

      const result = await Users.findOneAndUpdate(
        { username: req.body.username },
        {
          roles: (req.body.roles),
        },
        { new: true }
      );
      console.log('[+] VIP level Update Username:', result.username, '[+]')
      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[+] อัพเดทระดับ VIP [+]\nUsername : ${result.username}\nExpire : ${dayjs(user.timeout).format("DD MMMM YY, HH:mm:ss")}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });
      return res.status(200).send("อัพเดทระดับ VIP เรียบร้อย")
    })



  api.post(
    "/signUpHackos",
    body("username").notEmpty(),
    body("password").notEmpty(),
    body("confirmPassword").notEmpty(),
    body("name").notEmpty(),
    body("timeout").notEmpty(),
    hasRole("ADMIN"),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).fail(errors.array());

      const result = await Users.findOne({ username: req.body.username });
      if (result) return res.status(401).fail("username already exists");

      if (req.body.username.length <= 3)
        return res.status(400).fail("username more than 4 characters");

      if (req.body.password.length <= 3)
        return res.status(400).fail("password more than 4 characters");

      if (req.body.username.name <= 3)
        return res.status(400).fail("name more than 4 characters");

      if (req.body.confirmPassword !== req.body.password)
        return res.status(400).fail("passwords do not match");

      if (req.body.roles !== ("USER" || "VIP" || "ADMIN"))
        return res.status(400).fail("The role value is invalid");

      const date = new Date(Date.now() + 3600 * 1000 * 24 * req.body.timeout);

      const create = await Users.create({
        username: req.body.username,
        password: await bcrypt.hash(req.body.password, 10),
        name: req.body.name,
        roles: req.body.roles,
        createtime: Date.now(),
        timeout: date,
        access_ip: [],
      });

      console.log(`
        ${chalk.bgGreen("[+] Create User")} ${chalk.bgRed("REQUEST ADMIN")}
        Username : ${req.body.username}
        Name : ${req.body.name}
        Roles : ${chalk.bgGreen("USER")}
        Timeout : ${dayjs(date).format("DD MMMM YY, HH:mm:ss")}
        Request_IP : ${requestIP.getClientIp(req)}
        Creation_Date : ${dayjs().format("DD MMMM YY, HH:mm:ss")}
        `);

      request({
        method: "POST",
        uri: url_line_notification,
        header: {
          "Content-Type": "multipart/form-data",
        },
        auth: { bearer: config.LINE_TOKEN },
        form: {
          message: `[+] เพิ่มผู้ใช้งาน [+]\nUsername : ${req.body.username}\nName : ${req.body.name}\nRoles : USER\nExpire : ${dayjs(date).format("DD MMMM YY, HH:mm:ss")}\nIP : ${requestIP.getClientIp(req)}\nDate : ${dayjs().format("DD MMMM YY, HH:mm:ss")}`,
        },
      });

      const token = await signJwt(
        create._id,
        dayjs().add(1, "hour").valueOf(),
        [create.roles]
      );
      res.status(201).success({ jwt: token });
    }
  );
};