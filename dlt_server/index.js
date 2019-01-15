const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fs = require('fs');
const moment = require('moment');

const writeDLT = (postdata) => {
    const data = JSON.stringify(postdata);
    const time = moment().format('hh-mm');
    console.log(time)
    fs.writeFileSync(`./temp_data/dlt${time}.json`, data);
}

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

app.post("/dlt", function (request, response) {
    writeDLT(request.body)
    response.status(200).send({
        code: 1,
        message: "ok",
        received_records: 2
    });
});

app.listen(8080);