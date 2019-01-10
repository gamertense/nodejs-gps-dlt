const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const fs = require('fs');

const writeDLT = (postdata) => {
    const data = JSON.stringify(postdata);
    let dt = new Date().toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/, '')
        .replace(':', '-')
        .replace('2019-01-10', '')
        .replace(' ', '')
    dt = dt.slice(0, dt.length - 3);
    fs.writeFileSync(`./temp_data/dlt${dt}.json`, data);
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