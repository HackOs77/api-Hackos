const axios = require('axios')

async function main() {
    let res = await axios({
        method: "post",
        url: "http://localhost:3000/v1/logout",
        // data: JSON.stringify({
        //     username: "0000",
        //     password: "111111",
        //     confirmPassword: "111111",
        //     roles: "USER",
        //     timeout: "1",
        //     name: "xT1s"
        // }),
        headers: {
            "Content-Type": "application/json",
        }
    })
    console.log(res.data)
}

main()