define(['knockout', 'moment', 'lodash', 'MedicalDeviceCategory', 'FakeMedicalDeviceData'],
  function (ko, moment, _, MedicalDeviceCategory, FakeMedicalDeviceData) {
      // TODO: process all data server side and retrieve it using an API instead of "FakeMedicalDeviceData"
      function MedicalDevicesService() {
          var self = this;
          $.extend(this, new FakeMedicalDeviceData());

          self.DevicesCategories = [];
          self.DevicesByLocations = [];

          //-------------
          // Service methods
          //-------------
          self.GetMedicalDevicesCategories = function GetMedicalDevicesCategories(timeframe) {
              self.DevicesCategories = [];
              var found = {};
              var distinctCategories = [];
              var devicesCountByCategory = {};
              // Count the number of devices by category 
              // and build and unique list of categories     
              _.filter(self.CensusData, function (item) {
                  return filterByDate(item.LastSeenTime, timeframe);
              }).forEach(function (x) {
                  if (!found[x.Category]) {
                      distinctCategories.push(x.Category);
                      devicesCountByCategory[x.Category] = 0;
                      found[x.Category] = true;
                  }
                  devicesCountByCategory[x.Category] += 1;
              });

              distinctCategories.sort()
                .forEach(function (category) {
                    var referenceDate = new Date(2016, 2, 3);
                    // Filter the usage data on the selected time range
                    var filteredHistoricalData = self.HistoryData[category].filter(function (item) {
                        return filterByDate(item.Time, timeframe, referenceDate);
                    });
                    var averageMap = filteredHistoricalData.map(function (item) { return parseInt(item.Average); });
                    var minMap = filteredHistoricalData.map(function (item) { return item.Min });
                    var maxMap = filteredHistoricalData.map(function (item) { return item.Max; });
                    var mean = Math.ceil(_.mean(averageMap));
                    var min = Math.ceil(_.mean(minMap));
                    var max = Math.ceil(_.mean(maxMap));

                    self.DevicesCategories.push(new MedicalDeviceCategory({
                        Name: category,
                        DevicesCount: devicesCountByCategory[category],
                        AverageUsage: mean,
                        MaxUsage: max,
                        MinUsage: min
                    }));
                });

              return self.DevicesCategories;
          }

          self.GetDevicesByManufacturer = function GetManufacturersRepartition(categoryName, timeframe) {
              return CountDevicesBy('Manufacturer', categoryName, timeframe);
          }
          self.GetDevicesByModel = function GetManufacturersRepartition(categoryName, timeframe) {
              return CountDevicesBy('Model', categoryName, timeframe);
          }
          self.GetDevicesCensus = function GetDevicesCensus(categoryName, timeframe) {
              return _.filter(self.CensusData, function (item) {
                  return item.Category === categoryName
                    && filterByDate(item.LastSeenTime, timeframe);
              });
          }
          self.GetUtilizationData = function GetUtilizationData(categoryName) {
              return _.filter(self.UtilizationData, function (item) {
                  return item.Category === categoryName;
              });
          }
          self.GetUtilizationDataByCategory = function GetUtilizationDataByCategory(categoryName, timeframe) {
              return _.filter(self.UtilizationData, function (item) {
                  return item.Category === categoryName;
              }).map(function (item) {
                  item.UsageForSelectedTimeframe = GetUsageByTimeframe(item, timeframe)
                  return item;
              });
          }
          self.GetDevicesByLocation = function GetDevicesByLocation(categoryName, timeframe) {
              self.DevicesByLocations = [];
              var foundLocations = {};
              var distinctLocations = [];
              var devicesCountByLocations = {};
              // Count the number of devices by category 
              // and build and unique list of categories     
              _.filter(self.UtilizationData, function (item) {
                  return item.Category === categoryName;
              }).forEach(function (x) {
                  if (!foundLocations[x.Location]) {
                      distinctLocations.push(x.Location);
                      devicesCountByLocations[x.Location] = 0;
                      foundLocations[x.Location] = true;
                  }
                  devicesCountByLocations[x.Location] += 1;
              });

              var utilizationDataByLocation = _.groupBy(self.UtilizationData, 'Location');
              distinctLocations.sort()
                .forEach(function (location) {
                    // Filter the usage data on the selected time range
                    var locationHistoricalData = utilizationDataByLocation[location];
                    var totalsMap = locationHistoricalData.map(function (item) { return Math.ceil(GetUsageByTimeframe(item, timeframe)); });
                    var meanByLocation = Math.ceil(_.mean(totalsMap) / devicesCountByLocations[location]);
                    var minByLocation = Math.ceil(_.min(totalsMap) / devicesCountByLocations[location]);
                    var maxByLocation = Math.ceil(_.max(totalsMap) / devicesCountByLocations[location]);

                    self.DevicesByLocations.push(new MedicalDeviceCategory({
                        Name: location,
                        DevicesCount: devicesCountByLocations[location],
                        AverageUsage: meanByLocation,
                        MaxUsage: maxByLocation,
                        MinUsage: minByLocation
                    }));
                });

              return self.DevicesByLocations;
          }

          //-------------
          // Private functions
          //-------------
          function GetUsageByTimeframe(usageDetails, timeframe) {
              var usage = 0;
              switch (timeframe) {
                  case 86400:
                      usage = usageDetails.HoursUsage24H;
                      break;
                  case 259200:
                      usage = usageDetails.HoursUsage72H;
                      break;
                  case 604800:
                      usage = usageDetails.HoursUsage7days;
                      break;
                  case 2592000:
                      usage = usageDetails.HoursUsage30days;
                      break;
              }
              return usage.toString().replace(',', '.');
          }
          function CountDevicesBy(propertyName, categoryName, timeframe) {
              return _
                .chain(self.CensusData)
                .filter(function (item) {
                    return item.Category === categoryName
                      && filterByDate(item.LastSeenTime, timeframe);
                })
                .countBy(propertyName)
                .value();
          }

          function filterByDate(date, timeframeInSeconds, referenceDate) {
              // Note: months are 0 based when creating dates in JavaScript. We also use this date
              // to always match with the test data, no matter when we actually are.
              if (!referenceDate) {
                  referenceDate = new Date(2016, 1, 18);
              }
              var dateLimit = moment(referenceDate).subtract(timeframeInSeconds, 'seconds');
              // change the date from  dd/mm/yy hh:ss to mm/dd/yyyy hh:ss
              var dateSplit = date.split('/')
              var months = dateSplit[1];
              var days = dateSplit[0];
              var normalizedDate = months + "/" + days + "/" + dateSplit[2];
              if (moment(new Date(normalizedDate)).isAfter(dateLimit)) {
                  return true;
              }
              return false;
          }
      };

      return MedicalDevicesService;
  });