# SmartTag
Track your SmartTag device and get notified when it moves too much.
This was implemented by reverse engineering of the SmartThings website.

# How to use it

1. Login to the [SmartThings](https://smartthingsfind.samsung.com/) website, then obtain the cookie `JSESSIONID`.
2. Enter the cookie value in the `JSESSIONID` constant inside `index.js` file.
3. Install dependencies by running `npm install`.
4. Run the code using `npm run start`.
5. (optional) Read the ID of the device you want to track.
6. (optional) Copy the ID and replace it into the `GEOFENCE_DEVICE_ID` constant inside `index.js` file.


# Disclaimer

This content is intended solely for educational purposes and is not to be used with any malicious intent.
Additionally, I cannot guarantee the longevity of its functionality or the duration for which the token will be accepted by the website. It may be necessary to regenerate the token weekly or monthly.