const express = require("express");
const app = express();
const path = require("path");
const port = process.env.PORT || 4000;
var request = require('request');
var cheerio = require('cheerio');
const ejs = require('ejs');

const static_path = path.join(__dirname, "../views");

app.use(express.static(static_path));

app.set('view engine', 'ejs');
// app.use("views", static_path);

app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.get("/",  (req,res) => {
    res.render("index");
});

app.post("/status", (req,res) => {
    console.log(req.body)
    try{
        request({
            uri: 'https://parivahan.gov.in/rcdlstatus/?pur_cd=101',
            method: "GET",
            followAllRedirects: true,
            ignoreHttpErrors: true
        }, function(error, response, body) {
            var cookies = response.headers['set-cookie'];
            const $ = cheerio.load(body);
            var element = $('input[name="javax.faces.ViewState"]').val();
            var btnId = $('button[id^="form_rcdl:j_idt"]').first().attr('id').trim();

            var nheaders = {
                'Cookie': cookies,
                "Content-Type": "application/x-www-form-urlencoded",
                'Host': "parivahan.gov.in",
                'Accept': "application/xml, text/xml, */*; q=0.01",
                'Accept-Language': "en-US,en;q=0.5",
                'Accept-Encoding': "gzip, deflate, br",
                "X-Requested-With": "XMLHttpRequest",
                "Faces-Request": "partial/ajax",
                "Origin": "https://parivahan.gov.in",
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36"
            };

            var data = {
                'javax.faces.partial.ajax': 'true',
                'javax.faces.source': btnId,
                'javax.faces.partial.execute': '@all',
                'javax.faces.partial.render': 'form_rcdl:pnl_show form_rcdl:pg_show form_rcdl:rcdl_pnl',
                'form_rcdl:j_idt42': btnId,
                "form_rcdl": 'form_rcdl',
                'form_rcdl:tf_dlNO': req.body.DLnum.toUpperCase(),
                'form_rcdl:tf_dob_input': req.body.DLdob,
                'javax.faces.ViewState': element
            };
            data[btnId] = btnId;
            //console.log(data);
            
            request({
                uri: 'https://parivahan.gov.in/rcdlstatus/vahan/rcDlHome.xhtml',
                method: "POST",
                followAllRedirects: true,
                cookies: cookies,
                refferer: "https://parivahan.gov.in/rcdlstatus/?pur_cd=101",
                headers: nheaders,
                form: data
            }, function(error1, response1, body1) {
                if(error1){
                    console.log("Error in connection");
                } else {
                    var vehicleDetailsPage = cheerio.load(body1);
                    var dlResponse = {};
                    var vehiclesPermitedArray = [];
                    vehicleDetailsPage('table').find('td').each(function(index, element) {
                        if (vehicleDetailsPage(this).children().length) {
                            if (vehicleDetailsPage(this).children().hasClass('font-bold')) {
                                if (vehicleDetailsPage(this).next().children().length) {
                                    if (vehicleDetailsPage(this).next().children().hasClass('font-bold')) {
                                        if (vehicleDetailsPage(this).children().text() == "Non-Transport") {
                                            dlResponse[vehicleDetailsPage(this).children().text()] = vehicleDetailsPage(this).nextAll().text();
                                        } else if(vehicleDetailsPage(this).children().text() == "Transport") {
                                            dlResponse[vehicleDetailsPage(this).children().text()] = vehicleDetailsPage(this).nextAll().text();
                                        }
                                        else {
                                            dlResponse[vehicleDetailsPage(this).children().text()] = '';
                                        }  
                                    } else {
                                        dlResponse[vehicleDetailsPage(this).children().text()] = vehicleDetailsPage(this).next().children().text();
                                    }
                                } else {
                                    dlResponse[vehicleDetailsPage(this).children().text()] = vehicleDetailsPage(this).next().text();
                                }
                            }
                        }
                    });
                    console.log(dlResponse)
                    if (JSON.stringify(dlResponse) !== "{}") {

                        vehicleDetailsPage('table').last().find('td:not(:first-child):not(:last-child)').each(function(index, element) {
                            vehiclesPermitedArray.push(vehicleDetailsPage(this).text());
                            dlResponse["Vehicles permited"] = vehiclesPermitedArray.join();
                        });

                        var validPeriod = dlResponse["Non-Transport"];
                        var splitperiod = validPeriod.split(" ");
                        var expiry = splitperiod[2];
                        var expiryDate = new Date(expiry);
                        dlResponse["expiryDate"] = expiryDate.toString('dddd, MMMM ,yyyy');
                    }

                    if (JSON.stringify(dlResponse) === "{}") {
                        res.render("status", 
                            {success :false, message: "Invalid Data! please check the data you submitted!"}
                        );
                    } else {
                        res.render("status", 
                            {data: dlResponse, success :true, message: "valid data"}
                        );
                    }
                }
                res.end();
            });
        });
    }
    catch(error) {
        res.status(400).send(error);
    }
});

app.listen(port,  (req,res) => {
    console.log("server is running at port number:"+port);
});