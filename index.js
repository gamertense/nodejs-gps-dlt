const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const db = require('./queries')
const port = 3000

app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

// app.get('/', (request, response) => {
//     response.json({ info: 'Node.js, Express, and Postgres API' })
// })

app.get('/', db.getCarTrack)

app.listen(port, () => {
    console.log(`App running on port ${port}.`)
})

// var minutes = 2, the_interval = minutes * 60 * 1000;
// setInterval(function () {
//     console.log("I am doing my 1 minute check");
// }, the_interval);