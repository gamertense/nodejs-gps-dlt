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
            ext_power_status: 0,
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
    const q = `SELECT * FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    where tstamp::date = (now() at time zone 'utc' at time zone 'ict')::date
    and to_char(tstamp, 'HH') = to_char(now() at time zone 'utc' at time zone 'ict', 'HH')
    and to_char(tstamp, 'MI') >= to_char(now() at time zone 'utc' at time zone 'ict' - INTERVAL '2 minutes', 'MI')
    and to_char(tstamp, 'MI') < to_char(now() at time zone 'utc' at time zone 'ict', 'MI')
    LIMIT 100;`
    // const temp_q = `SELECT * FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    // where tstamp::date = TO_TIMESTAMP('2019-01-03 7:39:00','YYYY-MM-DD HH:MI:SS')::date
    // and to_char(tstamp, 'HH') = to_char(TO_TIMESTAMP('2019-01-03 7:39:00','YYYY-MM-DD HH:MI:SS'), 'HH')
    // and to_char(tstamp, 'MI') >= to_char(TO_TIMESTAMP('2019-01-03 7:39:00','YYYY-MM-DD HH:MI:SS') - INTERVAL '2 minutes', 'MI')
    // and to_char(tstamp, 'MI') < to_char(TO_TIMESTAMP('2019-01-03 7:39:00','YYYY-MM-DD HH:MI:SS'), 'MI')
    // LIMIT 100;`
    pool.query(q, (error, results) => {
        if (error) {
            throw error
        }
        setInterval(function () {
            const extracted = extractJSON(results.rows)
            const devices = extracted.devices
            const locationsArray = extracted.locationsArray

            writeDLT(locationsArray)
            writeDevices(devices)
        }, 120000);
        response.status(200).json('Done')
    })
}

//A demo for sending a POST request by writing to a JSON file.
const writeDLT = (locationArray) => {
    var postData = {
        vender_id: vender_id,
        locations_count: locationArray.length,
        locations: locationArray
    };

    let data = JSON.stringify(postData);
    fs.writeFileSync('./temp_data/dlt-' + Math.random().toString(36).substr(2, 9) + '.json', data);
}

const writeDevices = (devices) => {
    let data = JSON.stringify(devices);
    fs.writeFileSync('./temp_data/devices.json', data);
}

module.exports = {
    getCarTrack,
}