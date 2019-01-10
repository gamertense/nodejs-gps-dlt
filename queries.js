let pg = require('pg')
const moment = require('moment');
const config = require('./config')
const fs = require('fs');
const Pool = pg.Pool
const pool = new Pool(config)

//Handle incorrect time
pg.types.setTypeParser(1114, str => moment.utc(str).format());

const vender_id = '155'
const model_id = 'TLT1'
const gps_model_id = (vender_id + model_id).padStart(7, '0')

const extractJSON = (dataArray) => {
    let locationsArray = []
    let devices = require('./temp_data/devices.json');
    let sequence = 0

    for (let i = 0; i < dataArray.length; i++) {
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
            const findDevice = devices.find(x => x.deviceid === data.deviceid && x.acctime === data.acctime) //Check whether the device id has been seen and compare acc_time.
            if (findDevice.seq < 65535)
                findDevice.seq += 1 // Sequence + 1 when acc_time is still the same (the trip is not ended).
            else
                findDevice.seq = 0
            sequence = findDevice.seq
        }
        console.log(data.deviceid + ' ' + data.acctime)
        console.log(data.deviceid + ' ' + data.gpstime)

        dltjson = {
            unit_id: gps_model_id + data.deviceid.padStart(20, '0'),
            driver_id: null,
            seq: sequence,
            utc_ts: data.gpstime,
            recv_utc_ts: data.tstamp,
            lat: data.lat,
            lon: data.lon,
            alt: 0,
            speed: data.speed,
            engine_status: data.car_status === 'online' ? 1 : 0,
            fix: 1,
            license: null,
            course: data.direction,
            hdrop: 0,
            num_sats: data.satellite,
            gsm_cell: 0,
            gsm_loc: 0,
            gsm_rssi: 0,
            mileage: data.tripmileage,
            ext_power_status: 1,
            ext_power: 24,
            high_acc_count: null,
            high_de_acc_count: null,
            over_speed_count: null,
            max_speed: null
        }
        locationsArray.push(dltjson)
    }
    return { devices, locationsArray }
}

const getCarTrack = (request, response) => {
    const q = `SELECT distinct on (deviceid) deviceid, *
    FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    where tstamp::date = (NOW() + interval '7 hour')::date
    and to_char(tstamp, 'HH') = to_char(NOW() + interval '7 hour', 'HH')
    and to_char(tstamp, 'MI') = to_char(NOW(), 'MI')
    and gpstime::date = (NOW() + interval '7 hour')::date
    and to_char(gpstime, 'HH') = to_char(now() + interval '7 hour', 'HH')
    and to_char(gpstime, 'MI') = to_char(NOW(), 'MI')
    order by deviceid, idcartrack desc
    LIMIT 100`
    // const temp_q = `SELECT distinct on (deviceid) deviceid, * FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    // where tstamp::date = TO_TIMESTAMP('2018-11-05 13:34:00','YYYY-MM-DD HH24:MI:SS')::date
    // and to_char(tstamp, 'HH') = to_char(TO_TIMESTAMP('2018-11-05 13:34:00','YYYY-MM-DD HH24:MI:SS'), 'HH')
    // and to_char(tstamp, 'MI') = to_char(TO_TIMESTAMP('2018-11-05 13:34:00','YYYY-MM-DD HH24:MI:SS'), 'MI')
    // order by deviceid, idcartrack desc
    // LIMIT 100
    // `
    pool.query(q, (error, results) => {
        if (error) {
            throw error
        }
        // setInterval(function () {
        const extracted = extractJSON(results.rows)
        const devices = extracted.devices
        const locationsArray = extracted.locationsArray

        writeDLT(locationsArray)
        writeDevices(devices)
        // }, 60000);
        response.status(200).json(results.rows)
    })
}

//A demo for sending a POST request by writing to a JSON file.
const writeDLT = (locationArray) => {
    var postData = {
        vender_id: vender_id,
        locations_count: locationArray.length,
        locations: locationArray
    };

    const data = JSON.stringify(postData);
    let dt = new Date().toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/, '')
        .replace(':', '-')
        .replace('2019-01-10', '')
        .replace(' ', '')
    dt = dt.slice(0, dt.length - 3);
    fs.writeFileSync(`./temp_data/dlt${dt}.json`, data);
}

const writeDevices = (devices) => {
    let data = JSON.stringify(devices);
    fs.writeFileSync('./temp_data/devices.json', data);
}

module.exports = {
    getCarTrack,
}