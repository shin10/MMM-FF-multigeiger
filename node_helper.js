/* Magic Mirror
 * Module: MMM-FF-multigeiger
 *
 * By Michael Trenkler
 * ISC Licensed.
 */

const NodeHelper = require("node_helper");
const DataFetcher = require("./dataFetcher.js");

module.exports = NodeHelper.create({
  fetcherInstances: [],

  start: function () {
    console.log("Starting node helper: " + this.name);
  },

  getFetcher: function (config) {
    let instance = this.fetcherInstances.filter(
      (instance) => instance.moduleId === config.moduleId
    )[0];
    if (!instance) {
      instance = new DataFetcher(this, config);
      this.fetcherInstances.push(instance);
    }
    return instance;
  },

  socketNotificationReceived: function (notification, payload) {
    if (!payload.config) return;

    const fetcher = this.getFetcher(payload.config);

    switch (notification) {
      case "GET_INITIAL_SENSOR_DATA":
        fetcher.getSensorDataInitial();
        break;
      case "GET_PREVIOUS_SENSOR_LIST_ITEM":
        fetcher.getSensorDataPrevious();
        break;
      case "GET_NEXT_SENSOR_LIST_ITEM":
        fetcher.getSensorDataNext();
        break;
      case "GET_RANDOM_SENSOR_LIST_ITEM":
        fetcher.getSensorDataRandom();
        break;
      case "SUSPEND":
        fetcher.suspend();
        break;
      case "RESUME":
        fetcher.resume();
        break;
      default:
        break;
    }
  }
});
