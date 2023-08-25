const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const config = require('./config.js');
const Limiter = require('./tools/limiter.tool');
const mongoose = require("mongoose");

const app = express();

// CONNECTION TO DATABASE
var user = ""; //User is optional if auth not enabled
if (config.mongo_user && config.mongo_pass)
    user = config.mongo_user + ":" + config.mongo_pass + "@";

var connect = "mongodb://" + user + config.mongo_host + ":" + config.mongo_port + "/" + config.mongo_db + "?authSource=admin";
mongoose.set('strictQuery', false);
mongoose.connect(connect);
mongoose.connection.on("connected", () => {
    console.log("Mongoose is connected!");
});

//Limiter to prevent attacks
Limiter.limit(app);

//Headers
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Expose-Headers', 'Content-Length');
    res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');

    if (req.method === 'OPTIONS') {
        return res.send(200);
    } else {
        return next();
    }
});

//Parse JSON body
app.use(express.json({ limit: "100kb" }));

//Log request
app.use((req, res, next) => {
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var date_tag = "[" + date + " " + time + "]";
    console.log(date_tag + " " + req.method + " " + req.originalUrl);
    next();
})

//Route root DIR
app.get('/', function (req, res) {
    res.status(200).send(config.api_title + " " + config.version);
});

//Public folder 
app.use('/', express.static('public'))

//Routing
const AuthorizationRouter = require('./authorization/auth.routes');
AuthorizationRouter.route(app);

const UsersRouter = require('./users/users.routes');
UsersRouter.route(app);

const CardsRouter = require('./cards/cards.routes');
CardsRouter.route(app);

const PacksRouter = require('./packs/packs.routes');
PacksRouter.route(app);

const DecksRouter = require('./decks/decks.routes');
DecksRouter.route(app);

const MatchesRouter = require('./matches/matches.routes');
MatchesRouter.route(app);

const RewardsRouter = require('./rewards/rewards.routes');
RewardsRouter.route(app);

const MarketRouter = require('./market/market.routes');
MarketRouter.route(app);

const ActivityRouter = require("./activity/activity.routes");
ActivityRouter.route(app);


//HTTP
if (config.allow_http) {
    var httpServer = http.createServer(app);
    httpServer.listen(config.port, function () {
        console.log('http listening port %s', config.port);
    });
}

//HTTPS
if (config.allow_https && fs.existsSync(config.https_key)) {
    var privateKey = fs.readFileSync(config.https_key, 'utf8');
    //var certificate = fs.readFileSync(config.https_cert, 'utf8');
    //var cert_authority = fs.readFileSync(config.https_ca, 'utf8');
    var credentials = { key: privateKey };
    var httpsServer = https.createServer(credentials, app);
    httpsServer.listen(config.port_https, function () {
        console.log('https listening port %s', config.port_https);
    });
}

//Start jobs
const Jobs = require("./jobs/jobs");
Jobs.InitJobs();




//-------------------------ECPAY-----------------------------------

const uuid = require('uuid');
const bodyParser = require("body-parser");
const { setRtnCode, getEcpayReturnData } = require('/Users/eason/Desktop/資策會/apiFinal/ecpayfunction.js')
const { UserModel } = require('../apiFinal/users/users.model.js');

app.use(bodyParser.json()); // 解析 JSON 格式的請求主體
app.use(bodyParser.urlencoded({ extended: true })); // 解析 URL 編碼格式的請求主體

app.get("/ecpayCheckout", function (request, response) {
    // 生成一個唯一識別碼作為 MerchantTradeNo
    const merchantTradeNo = uuid.v4().replace(/-/g, '').substr(0, 20);


    const ecpay_payment = require('../apiFinal/node_modules/ecpay_aio_nodejs/lib/ecpay_payment.js')

    let base_param = {
        MerchantTradeNo: merchantTradeNo,
        MerchantTradeDate: '2023/07/13 15:45:30', //ex: 2017/02/13 15:45:30
        TotalAmount: '500',
        TradeDesc: '測試交易描述',
        ItemName: '遊戲幣',
        ReturnURL: '  https://b308-114-38-26-201.ngrok-free.app/ecpayReturn',
        // ChooseSubPayment: '',
        OrderResultURL: 'https://b308-114-38-26-201.ngrok-free.app/returnOther' //跳轉到自製網頁
        // NeedExtraPaidInfo: '1',
        // ClientBackURL: 'https://www.google.com',
        // ItemURL: 'http://item.test.tw',

    }
    let inv_params = {
    }
    const options = require('../apiFinal/node_modules/ecpay_aio_nodejs/conf/config-example.js'),
        create = new ecpay_payment(options),
        htm = create.payment_client.aio_check_out_credit_onetime(parameters = base_param, invoice = inv_params)
    //console.log(htm)
    const htmlContent = htm;

    // 設定回傳檔案的標頭
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Content-Disposition', 'inline; filename="output.html"');

    // 回傳字串內容作為 HTML 檔案
    response.send(htmlContent);

});


app.post("/returnOther", function (request, response) {
    response.redirect("http://localhost:5173");
});


//login
const AuthTool = require('./authorization/auth.tool.js');
app.post("/login", function (request, response) {
    const username = request.body.username;
    const password = request.body.password;



    if (!username || !password) {
        response.status(400).send("not found username");
        return
    }
    UserModel.findOne({ username })
        .then(result => {
            if (!result) {
                response.status(404).send("user not found");
                return;
            }
            const responseData = {
                username: result.username,
                coins: result.coins
            };

            response.send(responseData);


        })


    app.post("/ecpayReturn", function (request, response) {
        const merchantTradeNo = request.body.MerchantTradeNo;
        const RtnCode = request.body.RtnCode;
        console.log("接收到的MerchantTradeNo:", merchantTradeNo);
        console.log('接收成功', RtnCode);
        setRtnCode(RtnCode);
        let result = getEcpayReturnData();

        //更改coins 資料
        if (result.rtnCode == '1') {
            console.log(result.rtnCode);
            const update = {
                $inc: {
                    coins: 500
                }
            };

            UserModel.updateOne({ username }, update)
                .then(result => {
                    if (result.modifiedCount === 1) {
                        console.log('User updated');
                    } else {
                        console.log('User not found');
                    }
                })
                .catch(error => {
                    console.error('Failed to update user:', error);
                });


        }
        
    });
    app.post("/find", function (request, response) {
        UserModel.findOne({ username: username })
            .then(result => {
                if (result) {
                    const responseData = {
                        username: result.username,
                        coins: result.coins
                    };
                    console.log(responseData)
                    response.send(responseData);
                } else {
                    console.log("User not found");
                }
            })
            .catch(error => {
                console.error('Failed to query user:', error);
                return
            });
    });

})








module.exports = app