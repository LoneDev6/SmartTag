const axios = require('axios');
const qs = require('qs');

const JSESSIONID = '<YOUR_JSESSIONID>';
const GEOFENCE_DEVICE_ID = '<YOUR_DEVICE_ID>';
const GEOFENCE_DISTANCE_THRESHOLD = 0.5; // 500 meters
const GEOFENCE_CHECK_INTERVAL_MS = 60000; // 1 minute;

const URL_GET_CSRF = "https://smartthingsfind.samsung.com/chkLogin.do";
const URL_DEVICE_LIST = "https://smartthingsfind.samsung.com/device/getDeviceList.do";
const URL_REQUEST_LOC_UPDATE = "https://smartthingsfind.samsung.com/device/setLastSelect.do";

// Function to log in and get the CSRF token
async function getCsrfToken(session) {
    try {
        const response = await session.get(URL_GET_CSRF);
        return response.headers['_csrf']; // Assuming the token is in the headers
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
        return null;
    }
}

// Function to get the list of devices
async function getDevices(session, csrfToken) {
    try {
        const response = await session.post(URL_DEVICE_LIST, null, {
            headers: {
                '_csrf': csrfToken,
            },
        });
        return response.data.deviceList;
    } catch (error) {
        console.error('Failed to get devices:', error);
        return [];
    }
}

// Function to get the device location
async function getDeviceLocation(session, csrfToken, deviceId) {
    try {
        const response = await session.post(URL_REQUEST_LOC_UPDATE, {
            dvceId: deviceId,
            operation: "CHECK_CONNECTION_WITH_LOCATION"
        }, {
            headers: {
                '_csrf': csrfToken,
            },
        });

        const locationData = response.data.operation.find(op => op.oprnType === 'LOCATION' || op.oprnType === 'LASTLOC');
        if (locationData) {
            return { latitude: locationData.latitude, longitude: locationData.longitude, lastUpdate: locationData.extra.gpsUtcDt };
        } else {
            console.error('Location not found for device:', deviceId);
            return null;
        }
    } catch (error) {
        console.error('Failed to get device location:', error);
        return null;
    }
}

function convertGpsUtcDt(gpsUtcDt) {
    const year = parseInt(gpsUtcDt.slice(0, 4), 10);
    const month = parseInt(gpsUtcDt.slice(4, 6), 10) - 1; // Months start from 0.
    const day = parseInt(gpsUtcDt.slice(6, 8), 10);
    const hour = parseInt(gpsUtcDt.slice(8, 10), 10);
    const minute = parseInt(gpsUtcDt.slice(10, 12), 10);

    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1); 
    const dLon = deg2rad(lon2 - lon1); 
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

async function checkGeofence(session, csrfToken, deviceId, lastStableLocation) {
    const currentLocation = await getDeviceLocation(session, csrfToken, deviceId);
    if (currentLocation) {
        const { latitude, longitude } = currentLocation;
        const distance = getDistanceFromLatLonInKm(
            lastStableLocation.latitude, 
            lastStableLocation.longitude, 
            latitude, 
            longitude
        );

        console.log(`Distance from last stable location: ${distance} km`);

        if (distance > GEOFENCE_DISTANCE_THRESHOLD) {
            notifyUser(`The device has moved too far from the stable location. Distance: ${distance} km`);
            return {changed: true, currentLocation};
        }

        return {changed: false};
    }
}

function notifyUser(message) {
    console.log(`[?] ${message}`);
}

async function main() {
    const session = axios.create({
        withCredentials: true,
        headers: {
            'Cookie': `JSESSIONID=${JSESSIONID}`,
        },
    });

    // Step 1: Get CSRF token
    const csrfToken = await getCsrfToken(session);
    if (!csrfToken) {
        console.log('Failed to get CSRF token, JSESSIONID might be invalid or expired.');
        return;
    }

    // Step 2: Get devices
    const devices = await getDevices(session, csrfToken);
    if (devices.length === 0) {
        console.log('No devices found');
        return;
    }

    // Step 3: Get location for each device
    for (const device of devices) {
        const location = await getDeviceLocation(session, csrfToken, device.dvceID);
        if (location) {
            console.log(`Device: ${device.modelName} - ${device.dvceID}`);
            console.log(`Latitude: ${location.latitude}`);
            console.log(`Longitude: ${location.longitude}`);
            console.log(`Date: ${convertGpsUtcDt(location.lastUpdate)}`);
        }
        console.log(``);
    }

    if(GEOFENCE_DEVICE_ID && GEOFENCE_DEVICE_ID !== "<YOUR_DEVICE_ID>") {
        // Check geo-fence every minute.
        let lastStableLocation = await getDeviceLocation(session, csrfToken, GEOFENCE_DEVICE_ID);
        setInterval(() => {
            let result = checkGeofence(session, csrfToken, GEOFENCE_DEVICE_ID, lastStableLocation);
            if(result.changed) {
                lastStableLocation = result.currentLocation;
            }
        }, GEOFENCE_CHECK_INTERVAL_MS);
    }
}

main();
