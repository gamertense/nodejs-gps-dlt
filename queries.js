let pg = require('pg')
const moment = require('moment');
const config = require('./config')
const Pool = pg.Pool
const pool = new Pool(config)

//Handle incorrect time
pg.types.setTypeParser(1114, str => moment.utc(str).format());

const vender_id = '155'
const model_id = 'TLT1'
const gps_model_id = (vender_id + model_id).padStart(7, '0')

const extractJSON = (dataArray) => {
    let locationsArray = []
    let devices = []
    let sequence = 0

    for (let i = 0; i < dataArray.length; i++) {
        // console.log(data[i].deviceid)
        const data = dataArray[i]
        const dupDevices = devices.filter(x => x.deviceid === data.deviceid && x.acctime === data.acctime)
        if (dupDevices.length === 0) {
            devices.push({
                deviceid: data.deviceid,
                acctime: data.acctime,
                seq: 0
            })
            sequence = 0
        } else {
            const findDevice = devices.find(x => x.deviceid === data.deviceid && x.acctime === data.acctime)
            if (findDevice.seq < 65535)
                findDevice.seq += 1
            else
                findDevice.seq = 0
            sequence = findDevice.seq
        }

        dltjson = {
            vender_id: vender_id,
            locations_count: data.length,
            unit_id: gps_model_id + data.deviceid.padStart(20, '0'),
            driver_id: null,
            seq: sequence,
            utc_ts: data.gpstime,
            recv_utc_ts: data.tstamp,
            lat: data.lat,
            lon: data.lon,
            speed: data.speed,
            engine_status: data.car_status === 'online' ? 1 : 0,
            fix: 1,
            license: null,
            course: data.direction,
            ext_power_status: 0,

        }
        locationsArray.push(dltjson)
    }
    return locationsArray
}

const getCarTrack = (request, response) => {
    const q = 'SELECT * FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid ORDER BY idcartrack desc LIMIT 100';
    pool.query(q, (error, results) => {
        if (error) {
            throw error
        }
        // response.status(200).json(results.rows)
        const locationsArray = extractJSON(results.rows)
        response.status(200).json(locationsArray)
        // writeDLT(locationsArray)
        // const unique = [...new Set(locationsArray.map(item => item.unit_id))];
    })
}

const writeDLT = (locationArray) => {
    var postData = {
        vender_id: 1,
        locations_count: locationArray.length,
        locations: locationArray
    };

    const fs = require('fs');
    let data = JSON.stringify(postData);
    fs.writeFileSync('dlt.json', data);
}

module.exports = {
    getCarTrack,
}