let pg = require('pg')
const moment = require('moment');
const config = require('./config')
const fs = require('fs');
const Pool = pg.Pool
const pool = new Pool(config)
const axios = require('axios')

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

const getDriverID = () => {
    // const dl3 = "+             4100            10            9999958  00100                     ?"
    const dl3 = "+             24            1            9999958  00100                     ?"
    let filtered = dl3.split(" ").filter(v => v != "")
    filtered.splice(0, 1)  // Remove first element (+)
    filtered.splice(-1, 1) // and last element (?) from array.

    switch (dl3.length) {
        case 77: // public transport
            break;
        case 80: //private car
            filtered[1] = filtered[1].slice(0, -1); // Remove 0 from 10
            break;
        default:
            console.log("Incorrect format!")
    }

    const branch = filtered[3].slice(3, 5);

    filtered[3] = filtered[3].slice(0, 3); // Remvoe last two 0's from 00100
    filtered.push(branch)
    console.log(filtered)
    return filtered.join('')
}

const getCarTrack = (request, response) => {
    // const q = `SELECT distinct on (cartrack.deviceid) cartrack.deviceid, *
    // FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    // where cartrack.tstamp::date = (NOW() + interval '7 hour')::date
    // and to_char(cartrack.tstamp, 'HH') = to_char(NOW() + interval '7 hour', 'HH')
    // and to_char(cartrack.tstamp, 'MI') = to_char(NOW(), 'MI')
    // and cartrack.gpstime::date = (NOW() + interval '7 hour')::date
    // and to_char(cartrack.gpstime, 'HH') = to_char(now() + interval '7 hour', 'HH')
    // and to_char(cartrack.gpstime, 'MI') = to_char(NOW(), 'MI')
    // order by cartrack.deviceid, idcartrack desc
    // LIMIT 100`
    const q = `SELECT distinct on (deviceid) deviceid, * FROM cars INNER JOIN cartrack on cars.idobd = cartrack.deviceid
    where tstamp::date = TO_TIMESTAMP('2018-11-05','YYYY-MM-DD')::date
    and to_char(tstamp, 'HH') = to_char(TO_TIMESTAMP('13:34:00','HH24:MI:SS'), 'HH')
    and to_char(tstamp, 'MI') = to_char(TO_TIMESTAMP('13:34:00','HH24:MI:SS'), 'MI')
    order by deviceid, idcartrack desc
    LIMIT 100
    `
    pool.query(q, (error, results) => {
        if (error) {
            throw error
        }
        // setInterval(function () {
        const extracted = extractJSON(results.rows)
        const devices = extracted.devices
        const locationsArray = extracted.locationsArray

        postRealtime(locationsArray)
        writeDevices(devices)

        // }, 60000);
        response.status(200).json(results.rows)
    })
}

const postMaster = (request, response) => {
    const q = `SELECT unit_id, vehicle_id, brand_name, vehicle_chassis_no, code, card_reader, province_code
    FROM vehicle INNER JOIN vehicletype on vehicle.vehicle_register_type = vehicletype.vtypeid
    join vehicle_brand on vehicle.vehicle_type = vehicle_brand.brandid
    where vehicle.vehicle_id = '0กย6980'
    `
    pool.query(q, (error, results) => {
        if (error) {
            throw error
        }

        const data = results.rows[0]
        const postData = {
            vender_id: vender_id,
            unit_id: data.unit_id,
            vehicle_id: data.vehicle_id,
            vehicle_type: data.brand_name,
            vehicle_chassis_no: data.vehicle_chassis_no,
            vehicle_register_type: data.code,
            card_reader: data.card_reader,
            province_code: data.province_code
        }

        axios.post('http://localhost:8080/masterfile/add', postData)
            .then((res) => {
                console.log(res.data)
            })
            .catch((error) => {
                console.error(error)
            })

        response.status(200).json(results.rows)
    })
}

const postRealtime = (locationArray) => {
    let postData = {
        vender_id: vender_id,
        locations_count: locationArray.length,
        locations: locationArray
    };

    axios.post('http://localhost:8080/gps/backup/add/locations', postData)
        .then((res) => {
            console.log(res.data)
        })
        .catch((error) => {
            console.error(error)
        })
}

const writeDevices = (devices) => {
    let data = JSON.stringify(devices);
    fs.writeFileSync('./temp_data/devices.json', data);
}

module.exports = {
    getCarTrack,
    postMaster
}