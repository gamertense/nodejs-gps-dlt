const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fs = require('fs');
const moment = require('moment');

const writeDLT = (postdata) => {
    const data = JSON.stringify(postdata);
    const time = moment().format('hh-mm');
    fs.writeFileSync(`./temp_data/dlt${time}.json`, data);
}

const writeMaster = (postdata) => {
    const data = JSON.stringify(postdata);
    const time = moment().format('hh-mm');
    fs.writeFileSync(`./masterfile/${time}.json`, data);
}

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

app.post("/gps/add/locations", function (request, response) {
    writeDLT(request.body)
    response.status(200).send({
        code: 1,
        message: "ok",
        received_records: request.body.locations.length
    });
});

app.post("/masterfile/add", function (request, response) {
    writeMaster(request.body)
    response.status(200).send({
        code: 1,
        message: "ok",
        received_records: 1
    });
});

app.listen(8080);