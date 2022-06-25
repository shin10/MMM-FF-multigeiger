/* Magic Mirror
 * Module: MMM-FF-multigeiger
 *
 * By Michael Trenkler
 * ISC Licensed.
 */

const axios = require("axios").default;
const dayjs = require("dayjs");
const AKT_DATA_URL = "mapdata/getaktdata";
const SENSOR_PROPS_URL = "api/getprops";
const SENSOR_ONE_DAY_URL = "fsdata/getfs/oneday";
const SENSOR_ONE_WEEK_URL = "fsdata/getfs/oneweek";
const SENSOR_ONE_MONTH_URL = "fsdata/getfs/onemonth";

const NOW = "now";
const DAY = "day";
const WEEK = "week";
const MONTH = "month";
const RANDOM = "random";
const REVERSE = "reverse";
const DEFAULT = "default";
const DEFAULT_AVG_TIME = 60;

const DataFetcher = function (nodeHelper, config) {
  var {
    moduleId,
    baseURL,
    sequence,
    timeout,
    updateOnSuspension,
    updateInterval
  } = config;

  var sensorDataListItems = config.sensorList;

  // public for filtering
  this.moduleId = moduleId;

  var __errors = [];
  var __sensorPropertyCache = {};
  var __sensorDataListItem = null;
  var __sensorDataListItemIdx = 0;
  var __avgs = null;
  var __avgsFiltered = null;
  var __chartData = {};
  var __minVals = {};
  var __maxVals = {};
  var __avg48Vals = {};
  var __latestVals = {};

  var hidden = true;
  var timerObj = null;
  var updateOnVisibilityChangeRequested = false;

  const startInterval = () => {
    stopInterval();

    updateOnVisibilityChangeRequested = false;

    if (updateInterval === null) return;
    timerObj = setTimeout(() => intervalCallback(), updateInterval);
    timerObj.unref();
  };

  const stopInterval = () => {
    __errors = [];
    if (!timerObj) return;
    if (timerObj) clearTimeout(timerObj);
    timerObj = null;
  };

  const intervalCallback = () => {
    stopInterval();
    if (!hidden && updateOnSuspension !== true) {
      proceed();
    } else if (hidden && updateOnSuspension === null) {
      proceed();
    } else {
      updateOnVisibilityChangeRequested = true;
    }
  };

  const prepareNotificationConfig = () => {
    const copy = Object.assign(
      {},
      { config: config, sensorListConfig: __sensorDataListItem }
    );
    return copy;
  };

  const filterAVGs = (avgs, ids) => {
    return avgs?.filter((_) => ids.includes(_.id));
  };

  const processAVGs = () => {
    __avgs?.forEach((avg) => {
      avg.status = Math.min(Number.parseInt(avg.cpm), 0) + 2;
      avg.statusString = ["disabled", "unreachable", "ok"][avg.status];
    });
  };

  const serverTest = async () => {
    await axios
      .get(baseURL.replace(/^(https?:\/\/\w+?\.)(.*\..*)$/i, "http://$2"), {
        timeout: timeout
      })
      .then((response) => {
        console.log("citysensor server seems ok");
      })
      .catch((error) => {
        console.error(error.response);
        __errors.push(error);
        updateFrontendData();
      });
    return;
  };

  const getAVGs = async () => {
    if (__avgs) {
      return __avgs;
    } else {
      showPreloader();

      const url = baseURL + AKT_DATA_URL;
      await axios
        .get(url, { timeout: timeout })
        .then((response) => {
          __avgs = response.data.avgs ?? [];
        })
        .catch((error) => {
          __errors.push(error);
          updateFrontendData();
          serverTest();
        })
        .finally(() => {
          processAVGs();
          __avgsFiltered = filterAVGs(
            __avgs,
            __sensorDataListItem?.sensors.map((_) => _.id)
          );
        });
    }
  };

  const updateFrontendData = () => {
    const data = prepareNotificationConfig();
    Object.assign(data, {
      sensorProperties: __sensorPropertyCache,
      avgs: __avgs,
      avgsFiltered: __avgsFiltered,
      chartData: __chartData,
      minVals: __minVals,
      maxVals: __maxVals,
      latestVals: __latestVals,
      avg48Vals: __avg48Vals,
      errors: __errors
    });

    nodeHelper.sendSocketNotification("UPDATE_SENSOR_DATA", data);
  };

  const proceed = () => {
    stopInterval(config);
    let sensorDataListItemUpcoming;

    switch (sequence) {
      case RANDOM:
        sensorDataListItemUpcoming = getSensorListItemRandom();
        break;
      case REVERSE:
        sensorDataListItemUpcoming = getSensorListItemPrevious();
        break;
      default:
      case DEFAULT:
        sensorDataListItemUpcoming = getSensorListItemNext();
        break;
    }

    fetchData(sensorDataListItemUpcoming);
  };

  const fetchData = async (sensorDataListItem) => {
    stopInterval(config);
    showPreloader();
    __sensorDataListItem = sensorDataListItem;
    __avgs = __avgsFiltered = null;

    await getAVGs();
    await getSensorProperties();

    switch (sensorDataListItem.type ?? config.type) {
      case MONTH:
        await getMonthData();
        break;
      case WEEK:
        await getWeekData();
        break;
      case DAY:
      default:
        await get24HourData();
    }

    updateFrontendData();
    startInterval();
  };

  this.getSensorDataInitial = () => {
    __sensorDataListItem = getSensorListItemInitial();
    fetchData();
  };

  this.getSensorDataInitial = () => fetchData(getSensorListItemInitial());
  this.getSensorDataPrevious = () => fetchData(getSensorListItemPrevious());
  this.getSensorDataNext = () => fetchData(getSensorListItemNext());
  this.getSensorDataRandom = () => fetchData(getSensorListItemRandom());
  this.updateConfig = (_config) => {
    config = _config;
    if (__sensorDataListItem) {
      __sensorDataListItem = config.sensorList.filter(
        (_) => __sensorDataListItem.__id === _.__id
      )[0];
    }
    fetchData(__sensorDataListItem);
  };

  const getSensorListItemInitial = () => {
    let idx;
    switch (sequence) {
      case RANDOM:
        this.getRandomSensorDataListItem();
        return;
      case REVERSE:
        idx = sensorDataListItems.length - 1;
        break;
      default:
      case DEFAULT:
        idx = 0;
        break;
    }
    const initialSensorListItem = sensorDataListItems[idx];
    return initialSensorListItem;
  };

  const getSensorListItemPrevious = () => {
    __sensorDataListItemIdx =
      (sensorDataListItems.length + --__sensorDataListItemIdx) %
      sensorDataListItems.length;
    return sensorDataListItems[__sensorDataListItemIdx];
  };

  const getSensorListItemNext = () => {
    __sensorDataListItemIdx =
      ++__sensorDataListItemIdx % sensorDataListItems.length;
    return sensorDataListItems[__sensorDataListItemIdx];
  };

  const getSensorListItemRandom = () => {
    if (!sensorDataListItems.length) return;
    let weightCorrectedItems = sensorDataListItems.map((_) => {
      _.weight =
        _.weight !== undefined ? _.weight : 1 / sensorDataListItems.length;
      return _;
    });
    let weightTotal = weightCorrectedItems
      .map((_) => _.weight)
      .reduce((a, b) => a + b);
    let p = Math.random() * weightTotal;
    let wSum = 0;
    let randomSensorListItem = null;
    weightCorrectedItems.every((item) => {
      wSum += item.weight || 0;
      if (p > wSum) {
        return true;
      } else {
        randomSensorListItem = item;
        return false;
      }
    });
    return randomSensorListItem;
  };

  const getSensorProperties = async () => {
    let sensorIds = __sensorDataListItem?.sensors?.map((_) => _.id);

    // prepare property requests for uncached sensors
    let requests = [];
    sensorIds.forEach((id) => {
      if (!__sensorPropertyCache[id]) {
        requests.push(
          axios.get(baseURL + SENSOR_PROPS_URL, {
            timeout: timeout,
            params: {
              sensorid: id
            }
          })
        );

        // create property object with description from config
        __sensorPropertyCache[id] = {
          description: __sensorDataListItem?.sensors?.filter(
            (sensor) => sensor.id === id
          )[0].description
        };
      }
    });

    if (!requests.length) return;

    // fetch
    await axios
      .all(requests)
      .then(
        axios.spread((...responses) => {
          responses.forEach((response) => {
            const id = response.config.params.sensorid;
            Object.assign(__sensorPropertyCache[id], response.data);
          });
        })
      )
      .catch((error) => {
        __errors.push(error);
        updateFrontendData();
        serverTest();
      });
  };

  const dateToW3CString = (date) => {
    if (date === NOW) {
      date = new Date();
    }
    return dayjs(date).format();
  };

  const get24HourData = async () => {
    let sensors = __sensorDataListItem?.sensors;

    // prepare property requests for uncached sensors
    let requests = [];
    sensors.forEach((sensor) => {
      const id = sensor.id;
      const propVals = __sensorPropertyCache[id]?.values?.[0];
      if (!propVals) return;

      requests.push(
        axios.get(baseURL + SENSOR_ONE_DAY_URL, {
          timeout: timeout,
          params: {
            sensorid: id,
            start: dateToW3CString(config.startTime),
            sensorname: propVals.typ,
            avgTime:
              __sensorDataListItem.avgTime ??
              config.avgTime ??
              DEFAULT_AVG_TIME,
            live: true,
            moving: true,
            longAVG: __sensorDataListItem.longAVG ?? config.longAVG ?? 1
          }
        })
      );

      // create property object with description from config
      Object.assign(__sensorPropertyCache[id], {
        description: __sensorDataListItem?.sensors?.filter(
          (sensor) => sensor.id === id
        )[0].description
      });
    });

    if (!requests.length) return;

    // fetch
    await axios
      .all(requests)
      .then(
        axios.spread((...responses) => {
          responses.forEach((response) => {
            const id = response.config.params.sensorid;
            __chartData[id] = response.data;
            getDayChartDataMinMaxAvg(id);
          });
        })
      )
      .catch((error) => {
        __errors.push(error);
        updateFrontendData();
        serverTest();
      });
  };

  const getWeekData = async () => {
    let sensors = __sensorDataListItem?.sensors;

    // prepare property requests for uncached sensors
    let requests = [];
    sensors.forEach((sensor) => {
      const id = sensor.id;
      const propVals = __sensorPropertyCache[id]?.values?.[0];
      if (!propVals) return;

      requests.push(
        axios.get(baseURL + SENSOR_ONE_WEEK_URL, {
          timeout: timeout,
          params: {
            sensorid: id,
            start: dateToW3CString(config.startTime),
            sensorname: propVals.typ,
            avgTime:
              __sensorDataListItem.avgTime ??
              config.avgTime ??
              DEFAULT_AVG_TIME,
            live: true,
            moving: true,
            longAVG: __sensorDataListItem.longAVG ?? config.longAVG ?? 1
          }
        })
      );

      // create property object with description from config
      Object.assign(__sensorPropertyCache[id], {
        description: __sensorDataListItem?.sensors?.filter(
          (sensor) => sensor.id === id
        )[0].description
      });
    });

    if (!requests.length) return;

    // fetch
    await axios
      .all(requests)
      .then(
        axios.spread((...responses) => {
          responses.forEach((response) => {
            const id = response.config.params.sensorid;
            __chartData[id] = response.data;
            getDayChartDataMinMaxAvg(id);
          });
        })
      )
      .catch((error) => {
        __errors.push(error);
        updateFrontendData();
        serverTest();
      });
  };

  const getMonthData = async () => {
    let sensors = __sensorDataListItem?.sensors;

    // prepare property requests for uncached sensors
    let requests = [];
    sensors.forEach((sensor) => {
      const id = sensor.id;
      const propVals = __sensorPropertyCache[id]?.values?.[0];
      if (!propVals) return;

      requests.push(
        axios.get(baseURL + SENSOR_ONE_MONTH_URL, {
          timeout: timeout,
          params: {
            sensorid: id,
            start: dateToW3CString(config.startTime),
            sensorname: propVals.typ,
            avgTime:
              __sensorDataListItem.avgTime ??
              config.avgTime ??
              DEFAULT_AVG_TIME,
            live: true,
            moving: true,
            longAVG: __sensorDataListItem.longAVG ?? config.longAVG ?? 48
          }
        })
      );

      // create property object with description from config
      Object.assign(__sensorPropertyCache[id], {
        description: __sensorDataListItem?.sensors?.filter(
          (sensor) => sensor.id === id
        )[0].description
      });
    });

    if (!requests.length) return;

    // fetch
    await axios
      .all(requests)
      .then(
        axios.spread((...responses) => {
          responses.forEach((response) => {
            const id = response.config.params.sensorid;
            __chartData[id] = response.data;
            getDayChartDataMinMaxAvg(id);
          });
        })
      )
      .catch((error) => {
        __errors.push(error);
        updateFrontendData();
        serverTest();
      });
  };

  const getDayChartDataMinMaxAvg = (id) => {
    __minVals[id] = {};
    __maxVals[id] = {};
    __avg48Vals[id] = {};
    __latestVals[id] = {};

    let radiation = __chartData[id]?.radiation;
    if (radiation?.values?.length) {
      let values = __chartData[id].radiation.values;

      // get min vals
      __minVals[id] = values.reduce((a, b) => {
        return {
          cpmAvg: a.cpmAvg < b.cpmAvg ? a.cpmAvg : b.cpmAvg,
          dateCpm: a.cpmAvg < b.cpmAvg ? a.dateCpm || a._id : b._id,
          uSvphAvg: a.uSvphAvg < b.uSvphAvg ? a.uSvphAvg : b.uSvphAvg,
          dateUSvph: a.uSvphAvg < b.uSvphAvg ? a.dateUSvph || a._id : b._id
        };
      });

      // get max vals
      __maxVals[id] = values.reduce((a, b) => {
        return {
          cpmAvg: a.cpmAvg > b.cpmAvg ? a.cpmAvg : b.cpmAvg,
          dateCpm: a.cpmAvg > b.cpmAvg ? a.dateCpm || a._id : b._id,
          uSvphAvg: a.uSvphAvg > b.uSvphAvg ? a.uSvphAvg : b.uSvphAvg,
          dateUSvph: a.uSvphAvg > b.uSvphAvg ? a.dateUSvph || a._id : b._id
        };
      });

      // avg48
      __avg48Vals[id] = {
        cpmAvg: radiation.avg48?.cpmAvg,
        uSvphAvg: radiation.avg48?.uSvphAvg
      };

      // get latest
      __latestVals[id] = values[values.length - 1];
    }
  };

  const showPreloader = () => {
    __avgs = null;
    __errors = [];
    updateFrontendData();
  };

  this.suspend = () => {
    hidden = true;
    if (updateOnVisibilityChangeRequested && updateOnSuspension === true) {
      proceed();
    } else if (!timerObj && updateOnSuspension !== true) {
      startInterval();
    }
  };

  this.resume = () => {
    hidden = false;
    if (updateOnVisibilityChangeRequested && updateOnSuspension === false) {
      proceed();
    } else if (!timerObj) {
      startInterval();
    }
  };
};

module.exports = DataFetcher;
